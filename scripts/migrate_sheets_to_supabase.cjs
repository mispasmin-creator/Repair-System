/**
 * migrate_sheets_to_supabase.cjs
 * Safely reads Google Sheets data and UPSERTS it into Supabase tables.
 * Google Sheets is strictly READ-ONLY (no data modified or deleted).
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env file
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envVars[key] = val;
  }
});

const SCRIPT_URL = envVars.VITE_SCRIPT_URL;
const SHEET_ID = envVars.VITE_SHEET_ID;
const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Helper functions
const parseDate = (val) => {
  if (!val || val === '-' || val === '') return null;
  val = String(val).trim();
  // ISO string check
  if (val.includes('T') && !isNaN(Date.parse(val))) return new Date(val).toISOString();

  // "DD/MM/YYYY" or "DD/MM/YYYY HH:mm:ss"
  const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hour, min, sec));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const parseNum = (val) => {
  if (val === null || val === undefined || val === '' || val === '-') return null;
  const clean = String(val).replace(/[^0-9.-]+/g, '');
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
};

const cleanStr = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

async function migrateUsers() {
  console.log('\n--- 1. Migrating Users ---');
  try {
    const res = await fetch(`${SCRIPT_URL}?sheetId=${SHEET_ID}&sheet=Repair%20Login`);
    const data = await res.json();
    const rows = data?.table?.rows || [];
    const usersToUpsert = [];

    rows.forEach((r) => {
      const c = r.c || [];
      const username = cleanStr(c[0]?.v);
      const password = cleanStr(c[1]?.v);
      const role = cleanStr(c[2]?.v) || 'user';
      const accessStr = cleanStr(c[3]?.v);
      const firmName = cleanStr(c[4]?.v) || 'All';
      const manual = cleanStr(c[6]?.v);

      if (!username || username.toLowerCase() === 'username') return;

      const pageAccess = {
        Dashboard: 'none',
        Indent: 'none',
        'Sent to Vendor': 'none',
        'Management Approval': 'none',
        'Check Machine': 'none',
        'Store In': 'none',
        Posting: 'none',
        'Make Payment': 'none',
        Accounts: 'none',
      };

      if (accessStr) {
        const pages = accessStr.split(',').map((p) => p.trim());
        pages.forEach((p) => {
          if (p === 'Check Machin') p = 'Check Machine';
          pageAccess[p] = 'full';
        });
      }

      usersToUpsert.push({
        username,
        password: password || '123',
        role,
        firm_name: firmName,
        page_access: pageAccess,
        manual: manual || null,
      });
    });

    if (usersToUpsert.length > 0) {
      const { error } = await supabase.from('users').upsert(usersToUpsert, { onConflict: 'username' });
      if (error) console.error('Users upsert error:', error);
      else console.log(`✅ Upserted ${usersToUpsert.length} users into public.users`);
    } else {
      console.log('No users found to upsert.');
    }
  } catch (err) {
    console.error('Error migrating users:', err);
  }
}

async function migrateRepairTasks() {
  console.log('\n--- 2. Migrating Repair System Tasks ---');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getRepairTasks&sheetId=${SHEET_ID}`);
    const data = await res.json();
    const headers = data.headers || [];
    const rows = data.rows || [];

    const rawTasks = rows.map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = r[idx] ?? '';
      });
      return obj;
    }).filter((t) => cleanStr(t['Task No']));

    console.log(`Found ${rawTasks.length} tasks in Repair System sheet.`);

    // 2a. Indent table (Base table for foreign keys)
    const indents = rawTasks.map((t) => ({
      task_no: cleanStr(t['Task No']),
      firm_name: cleanStr(t['Firm Name']) || 'All',
      machine_name: cleanStr(t['Machine Name']) || '-',
      serial_no: cleanStr(t['Serial No']) || '-',
      department: cleanStr(t['Department']) || null,
      location: cleanStr(t['Location']) || null,
      machine_part_name: cleanStr(t['Machine Part Name']) || null,
      priority: cleanStr(t['Priority']) || 'Medium',
      uom: cleanStr(t['UOM']) || null,
      quantity: parseNum(t['Quantity']) || 1,
      problem_description: cleanStr(t['Problem With Machine']) || null,
      given_by: cleanStr(t['Authorized Name']) || null,
      indentor_name: cleanStr(t['Indentor Name']) || null,
      task_start_date: parseDate(t['Task Start Date']),
      task_ending_date: parseDate(t['Task Ending Date']),
      enable_reminders: cleanStr(t['Enable Reminders']).toLowerCase() === 'yes',
      machine_image_url: cleanStr(t['Image Link']) || null,
      planned_sent_date: parseDate(t['Planned 1']),
    }));

    // Upsert indents in chunks of 50
    for (let i = 0; i < indents.length; i += 50) {
      const chunk = indents.slice(i, i + 50);
      const { error } = await supabase.from('indent').upsert(chunk, { onConflict: 'task_no' });
      if (error) console.error(`Indent chunk ${i} error:`, error);
    }
    console.log(`✅ Upserted ${indents.length} rows into public.indent`);

    // 2b. Sent to Vendor
    const sentToVendor = rawTasks.filter((t) => t['Actual 1'] || t['Vendor Name'] || t['Vendor Name 1']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      planned_date: parseDate(t['Planned 1']),
      actual_date: parseDate(t['Actual 1']),
      vendor_name_1: cleanStr(t['Vendor Name 1'] || t['Vendor Name']) || null,
      transporter_name_1: cleanStr(t['(Transporter Name) 1'] || t['(Transporter Name)']) || null,
      charges_1: parseNum(t['Transportation Charges 1'] || t['Transportation Charges']),
      weighment_slip_1: cleanStr(t['Weighment Slip 1'] || t['Weighment Slip']) || null,
      lead_time_1: cleanStr(t['Lead Time To Deliver 1'] || t['Lead Time To Deliver ( In No. Of Days)']) || null,
      payment_type_1: cleanStr(t['Vendor 1 Payment Type'] || t['Payment Type']) || null,
      advance_1: parseNum(t['Advance Payment 1'] || t['How Much']),
      vendor_name_2: cleanStr(t['Vendor Name 2']) || null,
      transporter_name_2: cleanStr(t['(Transporter Name) 2']) || null,
      charges_2: parseNum(t['Transportation Charges 2']),
      weighment_slip_2: cleanStr(t['Weighment Slip 2']) || null,
      lead_time_2: cleanStr(t['Lead Time To Deliver 2']) || null,
      payment_type_2: cleanStr(t['Vendor 2 Payment Type']) || null,
      advance_2: parseNum(t['Advance Payment 2']),
      vendor_name_3: cleanStr(t['Vendor Name 3']) || null,
      transporter_name_3: cleanStr(t['(Transporter Name) 3']) || null,
      charges_3: parseNum(t['Transportation Charges 3']),
      weighment_slip_3: cleanStr(t['Weighment Slip 3']) || null,
      lead_time_3: cleanStr(t['Lead Time To Deliver 3']) || null,
      payment_type_3: cleanStr(t['Vendor 3 Payment Type']) || null,
      advance_3: parseNum(t['Advance Payment 3']),
      transport_image_url: cleanStr(t['Transporting Image With Machine']) || null,
    }));
    if (sentToVendor.length > 0) {
      const { error } = await supabase.from('sent_to_vendor').upsert(sentToVendor, { onConflict: 'task_no' });
      if (error) console.error('sent_to_vendor error:', error);
      else console.log(`✅ Upserted ${sentToVendor.length} rows into public.sent_to_vendor`);
    }

    // 2c. Management Approval
    const approvals = rawTasks.filter((t) => t['Management Approval Date'] || t['Approved Vendor Name']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      planned_date: parseDate(t['Management Pending Date']),
      actual_date: parseDate(t['Management Approval Date']),
      approved_vendor_name: cleanStr(t['Approved Vendor Name'] || t['Vendor Name']) || 'Approved',
      approved_payment_term: cleanStr(t['Approved Payment Term'] || t['Payment Type']) || 'Normal',
      advance_amount: parseNum(t['Advance Payment 1'] || t['How Much']) || 0,
      management_remark: cleanStr(t['Management Remark']) || null,
      approval_status: cleanStr(t['ThreePartyStatus']) || 'Approved',
    }));
    if (approvals.length > 0) {
      const { error } = await supabase.from('management_approval').upsert(approvals, { onConflict: 'task_no' });
      if (error) console.error('management_approval error:', error);
      else console.log(`✅ Upserted ${approvals.length} rows into public.management_approval`);
    }

    // 2d. Check Machine
    const checkMachines = rawTasks.filter((t) => t['Actual 2'] || t['Bill No.']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      planned_date: parseDate(t['Planned 2']),
      actual_date: parseDate(t['Actual 2']),
      bill_no: cleanStr(t['Bill No.']) || null,
      bill_date: parseDate(t['Actual 2']) ? parseDate(t['Actual 2']).slice(0, 10) : null,
      type_of_bill: cleanStr(t['Type of Bill']) || null,
      total_bill_amount: parseNum(t['Total Bill Amount']),
      bill_image_url: cleanStr(t['Bill Image']) || null,
      checked_by: cleanStr(t['Authorized Name']) || null,
    }));
    if (checkMachines.length > 0) {
      const { error } = await supabase.from('check_machine').upsert(checkMachines, { onConflict: 'task_no' });
      if (error) console.error('check_machine error:', error);
      else console.log(`✅ Upserted ${checkMachines.length} rows into public.check_machine`);
    }

    // 2e. Store In
    const storeIns = rawTasks.filter((t) => t['Actual 3'] || t['Received Quantity']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      planned_date: parseDate(t['Planned 3']),
      actual_date: parseDate(t['Actual 3']),
      received_quantity: parseNum(t['Received Quantity']) || 1,
      bill_match: cleanStr(t['Bill Match']).toLowerCase() !== 'no',
      store_in_done_by: cleanStr(t['Authorized Name']) || null,
      store_image_url: cleanStr(t['Product Image']) || null,
    }));
    if (storeIns.length > 0) {
      const { error } = await supabase.from('store_in').upsert(storeIns, { onConflict: 'task_no' });
      if (error) console.error('store_in error:', error);
      else console.log(`✅ Upserted ${storeIns.length} rows into public.store_in`);
    }

    // 2f. Posting
    const postings = rawTasks.filter((t) => t['Actual Posting']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      planned_date: parseDate(t['Planned Posting']),
      actual_date: parseDate(t['Actual Posting']),
      posting_voucher_no: cleanStr(t['Posting Voucher No']) || 'AUTO-VOUCHER',
      posting_done_by: cleanStr(t['Authorized Name']) || null,
      process_remark: cleanStr(t['Remark']) || null,
    }));
    if (postings.length > 0) {
      const { error } = await supabase.from('posting').upsert(postings, { onConflict: 'task_no' });
      if (error) console.error('posting error:', error);
      else console.log(`✅ Upserted ${postings.length} rows into public.posting`);
    }

    // 2g. Make Payment
    const makePayments = rawTasks.filter((t) => t['Actual 4']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      planned_date: parseDate(t['Planned 4']),
      actual_date: parseDate(t['Actual 4']),
      payment_type: cleanStr(t['Payment Type']) || 'Final',
      payment_utr_no: cleanStr(t['UTR / Cheque No']) || 'PAID',
      amount_paid: parseNum(t['To Be Paid Amount'] || t['Total Bill Amount']) || 0,
      payment_done_by: cleanStr(t['Authorized Name']) || null,
    }));
    if (makePayments.length > 0) {
      const { error } = await supabase.from('make_payment').upsert(makePayments);
      if (error) console.error('make_payment error:', error);
      else console.log(`✅ Upserted ${makePayments.length} rows into public.make_payment`);
    }

    // 2h. Accounts
    const accounts = rawTasks.filter((t) => t['Actual 5'] || t['Status']).map((t) => ({
      task_no: cleanStr(t['Task No']),
      bill_no: cleanStr(t['Bill No.']) || null,
      firm_name: cleanStr(t['Firm Name']) || null,
      vendor_name: cleanStr(t['Vendor Name']) || null,
      total_amount: parseNum(t['Total Bill Amount']),
      planned_1: parseDate(t['Planned 5']),
      actual_1: parseDate(t['Actual 5']),
      status_1: cleanStr(t['Status']) || null,
      remarks_1: cleanStr(t['Remark']) || null,
    }));
    if (accounts.length > 0) {
      const { error } = await supabase.from('accounts').upsert(accounts);
      if (error) console.error('accounts error:', error);
      else console.log(`✅ Upserted ${accounts.length} rows into public.accounts`);
    }
  } catch (err) {
    console.error('Error migrating repair tasks:', err);
  }
}

async function migrateAdvanceTasks() {
  console.log('\n--- 3. Migrating Repair Advance Tasks ---');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getAdvancePayments&sheetId=${SHEET_ID}`);
    const data = await res.json();
    const raw = (data.data || []).filter((r) => cleanStr(r['Repair Task No']));
    console.log(`Found ${raw.length} tasks in Repair FMS Advance Payment sheet.`);

    // First ensure every advance task exists in `indent` table
    const advanceIndents = raw.map((r) => ({
      task_no: cleanStr(r['Repair Task No']),
      firm_name: cleanStr(r['Firm Name']) || 'All',
      machine_name: cleanStr(r['Machine Name']) || '-',
      serial_no: cleanStr(r['Serial No']) || '-',
      department: cleanStr(r['Department']) || null,
      priority: 'High',
      problem_description: 'Advance Payment Repair',
    }));

    const { error: indError } = await supabase.from('indent').upsert(advanceIndents, { onConflict: 'task_no' });
    if (indError) console.error('Advance indents ensure error:', indError);

    const advanceRecords = raw.map((r) => ({
      repair_task_no: cleanStr(r['Repair Task No']),
      firm_name: cleanStr(r['Firm Name']) || null,
      machine_name: cleanStr(r['Machine Name']) || null,
      vendor_name: cleanStr(r['Vendor Name'] || r['Vendor Name ']) || null,
      to_be_paid_amount: parseNum(r['To Be Paid Amount']),
      planned_posting: parseDate(r['Planned Posting']),
      actual_posting: parseDate(r['Actual Posting']),
      posting_voucher_no: cleanStr(r['Posting Voucher No']) || null,
      posting_done_by: cleanStr(r['Posting Done By']) || null,
      planned_payment: parseDate(r['Planned Payment']),
      actual_payment_date: parseDate(r['Actual Payment Date']),
      advance_payment_utr: cleanStr(r['Advance Payment UTR / Cheque No']) || null,
      advance_amount_paid: parseNum(r['Advance Amount Paid']),
      payment_done_by: cleanStr(r['Payment Done By']) || null,
      planned_check_machine: parseDate(r['Planned Check Machine']),
      actual_check_machine_date: parseDate(r['Actual Check Machine Date']),
      bill_no: cleanStr(r['Bill No.']) || null,
      bill_date: parseDate(r['Bill Date']) ? parseDate(r['Bill Date']).slice(0, 10) : null,
      bill_image_link: cleanStr(r['Bill Image Link']) || null,
      checked_by: cleanStr(r['Checked By']) || null,
      planned_store_in: parseDate(r['Planned Store In']),
      actual_store_in_date: parseDate(r['Actual Store In Date']),
      received_quantity: parseNum(r['Received Quantity']),
      store_in_done_by: cleanStr(r['Store In Done By']) || null,
    }));

    const { error: advError } = await supabase.from('repair_advance').upsert(advanceRecords, { onConflict: 'repair_task_no' });
    if (advError) console.error('repair_advance error:', advError);
    else console.log(`✅ Upserted ${advanceRecords.length} rows into public.repair_advance`);
  } catch (err) {
    console.error('Error migrating advance tasks:', err);
  }
}

async function run() {
  console.log('🚀 Starting Google Sheets to Supabase Migration (READ ONLY from sheets)...');
  await migrateUsers();
  await migrateRepairTasks();
  await migrateAdvanceTasks();
  console.log('\n🎉 Migration finished! Verifying row counts in Supabase...\n');

  const tables = ['users', 'indent', 'sent_to_vendor', 'management_approval', 'check_machine', 'store_in', 'posting', 'make_payment', 'accounts', 'repair_advance'];
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`- ${t.padEnd(22)}: ${count} rows`);
  }
}

run();
