const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);

const formatDateIST = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(',', '');
};

const formatCurrency = (val) => {
  if (val === null || val === undefined) return '';
  return String(val);
};

const mapToSheetFormat = (item) => {
  const sv = Array.isArray(item.sent_to_vendor) ? item.sent_to_vendor[0] : item.sent_to_vendor;
  const ma = Array.isArray(item.management_approval) ? item.management_approval[0] : item.management_approval;
  const cm = Array.isArray(item.check_machine) ? item.check_machine[0] : item.check_machine;
  const si = Array.isArray(item.store_in) ? item.store_in[0] : item.store_in;
  const p = Array.isArray(item.posting) ? item.posting[0] : item.posting;
  const mp = Array.isArray(item.make_payment) ? item.make_payment[0] : item.make_payment;
  const acc = Array.isArray(item.accounts) ? item.accounts[0] : item.accounts;

  return {
    'Time Stemp': formatDateIST(item.created_at),
    'Task No': item.task_no || '',
    'Firm Name': item.firm_name || '',
    'Serial No': item.serial_no || '',
    'Machine Name': item.machine_name || '',
    'Machine Part Name': item.machine_part_name || '',
    'Authorized Name': item.given_by || '',
    'Indentor Name': item.indentor_name || '',
    'Problem With Machine': item.problem_description || '',
    'Enable Reminders': item.enable_reminders ? 'Yes' : 'No',
    'Require Attachment': 'No',
    'Task Start Date': formatDateIST(item.task_start_date),
    'Task Ending Date': formatDateIST(item.task_ending_date),
    'Priority': item.priority || 'Medium',
    'Department': item.department || '',
    'Location': item.location || '',
    'Image Link': item.machine_image_url || '',
    'UOM': item.uom || '',
    'Quantity': item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '1',

    // Sent to Vendor
    'Planned 1': formatDateIST(sv?.planned_date || item.planned_sent_date),
    'Actual 1': formatDateIST(sv?.actual_date),
    'Vendor Name': sv?.vendor_name_1 || '',
    'Vendor Name 1': sv?.vendor_name_1 || '',
    '(Transporter Name)': sv?.transporter_name_1 || '',
    '(Transporter Name) 1': sv?.transporter_name_1 || '',
    'Transportation Charges': formatCurrency(sv?.charges_1),
    'Transportation Charges 1': formatCurrency(sv?.charges_1),
    'Weighment Slip': sv?.weighment_slip_1 || '',
    'Weighment Slip 1': sv?.weighment_slip_1 || '',
    'Lead Time To Deliver ( In No. Of Days)': sv?.lead_time_1 || '',
    'Lead Time To Deliver 1': sv?.lead_time_1 || '',
    'Payment Type': sv?.payment_type_1 || '',
    'Vendor 1 Payment Type': sv?.payment_type_1 || '',
    'How Much': formatCurrency(sv?.advance_1),
    'Advance Payment 1': formatCurrency(sv?.advance_1),
    'Transporting Image With Machine': sv?.transport_image_url || '',

    // Management Approval
    'Management Pending Date': formatDateIST(ma?.planned_date),
    'Management Approval Date': formatDateIST(ma?.actual_date),
    'Approved Vendor Name': ma?.approved_vendor_name || '',
    'Approved Payment Term': ma?.approved_payment_term || '',
    'Management Remark': ma?.management_remark || '',
    'ThreePartyStatus': ma?.approval_status || '',

    // Check Machine
    'Planned 2': formatDateIST(cm?.planned_date),
    'Actual 2': formatDateIST(cm?.actual_date),
    'Bill No.': cm?.bill_no || '',
    'Type of Bill': cm?.type_of_bill || '',
    'Total Bill Amount': formatCurrency(cm?.total_bill_amount),
    'Bill Image': cm?.bill_image_url || '',

    // Store In
    'Planned 3': formatDateIST(si?.planned_date),
    'Actual 3': formatDateIST(si?.actual_date),
    'Received Quantity': formatCurrency(si?.received_quantity),
    'Bill Match': si?.bill_match ? 'Yes' : 'No',
    'Product Image': si?.store_image_url || '',

    // Posting
    'Planned Posting': formatDateIST(p?.planned_date),
    'Actual Posting': formatDateIST(p?.actual_date),
    'Posting Voucher No': p?.posting_voucher_no || '',

    // Make Payment
    'Planned 4': formatDateIST(mp?.planned_date),
    'Actual 4': formatDateIST(mp?.actual_date),
    'UTR / Cheque No': mp?.payment_utr_no || '',

    // Accounts
    'Planned 5': formatDateIST(acc?.planned_1),
    'Actual 5': formatDateIST(acc?.actual_1),
    'Status': acc?.status_1 || '',
    'Remark': acc?.remarks_1 || ''
  };
};

async function testMapper() {
  const { data: indents, error } = await supabase
    .from('indent')
    .select(`
      *,
      sent_to_vendor (*),
      management_approval (*),
      check_machine (*),
      store_in (*),
      posting (*),
      make_payment (*),
      accounts (*)
    `)
    .order('created_at', { ascending: false })
    .limit(3);

  const mapped = indents.map(mapToSheetFormat);
  console.log('Sample mapped task (matches sheet format exactly!):');
  console.log(mapped[0]);
}

testMapper();
