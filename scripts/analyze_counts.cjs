const fs = require('fs');
const path = require('path');
const { createClient } = require('c:/Users/USER/OneDrive/Desktop/Repair FMS/Repair-System/node_modules/@supabase/supabase-js');

const envPath = 'c:/Users/USER/OneDrive/Desktop/Repair FMS/Repair-System/.env';
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
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  return isNaN(num) ? String(val) : num.toLocaleString('en-IN');
};

const isAdvanceRow = (row) => {
  const paymentType = (
    row['Payment Type'] ||
    row['Vendor 1 Payment Type'] ||
    row['Approved Payment Term'] ||
    row.payment_type ||
    ''
  ).toLowerCase().trim();
  return paymentType === 'advance';
};

async function fetchRepairTasksFromSupabase() {
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
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching indents:', error);
    return [];
  }

  return (indents || []).map((item) => {
    const sv = Array.isArray(item.sent_to_vendor) ? item.sent_to_vendor[0] : item.sent_to_vendor;
    const ma = Array.isArray(item.management_approval) ? item.management_approval[0] : item.management_approval;
    const cm = Array.isArray(item.check_machine) ? item.check_machine[0] : item.check_machine;
    const si = Array.isArray(item.store_in) ? item.store_in[0] : item.store_in;
    const p = Array.isArray(item.posting) ? item.posting[0] : item.posting;
    const mp = Array.isArray(item.make_payment) ? item.make_payment[0] : item.make_payment;
    const acc = Array.isArray(item.accounts) ? item.accounts[0] : item.accounts;

    return {
      'Task No': item.task_no || '',
      'Firm Name': item.firm_name || '',
      'Serial No': item.serial_no || '',
      'Machine Name': item.machine_name || '',
      'Machine Part Name': item.machine_part_name || '',
      'Doer Name': item.indentor_name || '',
      'Problem': item.problem_description || '',
      'Priority': item.priority || 'Medium',
      'Department': item.department || '',
      'Vendor Name': sv?.vendor_name_1 || '',
      'Payment Type': sv?.payment_type_1 || '',
      'Actual 1': formatDateIST(sv?.actual_date),
      'Management Approval Date': formatDateIST(ma?.actual_date),
      'Actual 2': formatDateIST(cm?.actual_date),
      'Bill No.': cm?.bill_no || '',
      'Type of Bill': cm?.type_of_bill || '',
      'Total Bill Amount': cm?.total_bill_amount || '',
      'Bill Image': cm?.bill_image_url || '',
      'Actual 3': formatDateIST(si?.actual_date),
      'Product Image': si?.store_image_url || '',
      'Actual Posting': formatDateIST(p?.actual_date),
      'Posting Voucher No': p?.posting_voucher_no || '',
      'Actual 4': formatDateIST(mp?.actual_date),
      'UTR / Cheque No': mp?.payment_utr_no || '',
    };
  });
}

async function fetchAdvancePaymentsFromSupabase() {
  const { data, error } = await supabase
    .from('repair_advance')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching repair_advance:', error);
    return [];
  }

  return (data || []).map((row) => ({
    isAdvance: true,
    taskNo: row.repair_task_no || '',
    repairTaskNo: row.repair_task_no || '',
    firmName: row.firm_name || '',
    machineName: row.machine_name || '',
    vendorName: row.vendor_name || '',
    toBePaidAmount: row.to_be_paid_amount || '',
    totalBillAmount: row.to_be_paid_amount || '',
    managementApprovalDate: formatDateIST(row.created_at),
    plannedPosting: formatDateIST(row.planned_posting),
    actualPosting: formatDateIST(row.actual_posting),
    plannedPayment: formatDateIST(row.planned_payment),
    actualPayment: formatDateIST(row.actual_payment_date),
    actualPaymentDate: formatDateIST(row.actual_payment_date),
    actualCheckMachineDate: formatDateIST(row.actual_check_machine_date),
    actualStoreInDate: formatDateIST(row.actual_store_in_date),
    billNo: row.bill_no || '',
    paymentType: 'Advance',
  }));
}

async function runAnalysis() {
  const rawTasks = await fetchRepairTasksFromSupabase();
  const advList = await fetchAdvancePaymentsFromSupabase();

  console.log('=== DATA BREAKDOWN ===');
  console.log('Total Raw Repair Tasks:', rawTasks.length);
  console.log('Total Advance Tasks:', advList.length);

  // 1. POSTING PAGE ANALYSIS
  console.log('\n--- 1. POSTING PAGE ---');
  // Normal tasks
  const normalPostingTasks = rawTasks.map((row, index) => ({
    taskNo: row['Task No'],
    billNo: row['Bill No.'],
    actual2: row['Actual 2'],
    actualPosting: row['Actual Posting'],
    isAdvancePayment: isAdvanceRow(row),
  }));

  const normalPostingPending = normalPostingTasks.filter(t => t.actual2 && !t.actualPosting);
  const normalPostingHistory = normalPostingTasks.filter(t => t.actualPosting);

  // Advance tasks in posting
  const advPostingPending = advList.filter(t => t.managementApprovalDate && !t.actualPosting);
  const advPostingHistory = advList.filter(t => t.managementApprovalDate && t.actualPosting);

  console.log('Normal Posting Pending:', normalPostingPending.length);
  console.log('Normal Posting History:', normalPostingHistory.length);
  console.log('Advance Posting Pending:', advPostingPending.length);
  console.log('Advance Posting History:', advPostingHistory.length);
  console.log('Total Posting History:', normalPostingHistory.length + advPostingHistory.length);

  if (advPostingHistory.length > 0) {
    console.log('Advance Posting History Tasks:', advPostingHistory.map(t => t.taskNo));
  }

  // 2. MAKE PAYMENT PAGE ANALYSIS
  console.log('\n--- 2. MAKE PAYMENT PAGE ---');
  // Normal
  const normalPayPending = rawTasks.filter(t => t['Actual Posting'] && !t['Actual 4']);
  const normalPayHistory = rawTasks.filter(t => t['Actual 4']);

  // Advance
  const advPayPending = advList.filter(t => t.actualPosting && !t.actualPayment);
  const advPayHistory = advList.filter(t => t.actualPosting && t.actualPayment);

  console.log('Normal Pay Pending (Raw):', normalPayPending.length);
  console.log('Normal Pay History (Raw):', normalPayHistory.length);
  console.log('Advance Pay Pending (Raw):', advPayPending.length);
  console.log('Advance Pay History (Raw):', advPayHistory.length);
  console.log('Total Make Payment Raw History:', normalPayHistory.length + advPayHistory.length);
  console.log('Total Make Payment Raw Pending:', normalPayPending.length + advPayPending.length);

  // Now check grouping in Make Payment (Parent/Child and Grouped)
  // Let's see how Make Payment groups by Bill No:
  const allPayHistory = [
    ...normalPayHistory.map(t => ({ taskNo: t['Task No'], billNo: t['Bill No.'], isAdvance: false, firmName: t['Firm Name'], totalBillAmount: t['Total Bill Amount'] })),
    ...advPayHistory.map(t => ({ taskNo: t.taskNo, billNo: t.billNo, isAdvance: true, firmName: t.firmName, totalBillAmount: t.totalBillAmount }))
  ];

  const payHistoryGroups = {};
  allPayHistory.forEach(task => {
    let billKey;
    if (task.billNo && task.billNo !== '-') {
      billKey = task.billNo;
    } else if (task.isAdvance) {
      billKey = `ADV-${(task.firmName || '').toLowerCase()}-${task.totalBillAmount}`;
    } else {
      billKey = `NO-BILL-${task.taskNo}`;
    }
    if (!payHistoryGroups[billKey]) payHistoryGroups[billKey] = [];
    payHistoryGroups[billKey].push(task.taskNo);
  });

  console.log('Make Payment Grouped History count:', Object.keys(payHistoryGroups).length);
  const groupedKeys = Object.keys(payHistoryGroups).filter(k => payHistoryGroups[k].length > 1);
  console.log('Common Bill groups in History (more than 1 task in same bill):', groupedKeys);
  groupedKeys.forEach(k => console.log('  Bill', k, '-> tasks:', payHistoryGroups[k]));

  // Check Make Payment Pending grouping
  const allPayPending = [
    ...normalPayPending.map(t => ({ taskNo: t['Task No'], billNo: t['Bill No.'], isAdvance: false, firmName: t['Firm Name'], totalBillAmount: t['Total Bill Amount'] })),
    ...advPayPending.map(t => ({ taskNo: t.taskNo, billNo: t.billNo, isAdvance: true, firmName: t.firmName, totalBillAmount: t.totalBillAmount }))
  ];
  const payPendingGroups = {};
  allPayPending.forEach(task => {
    let billKey;
    if (task.billNo && task.billNo !== '-') {
      billKey = task.billNo;
    } else if (task.isAdvance) {
      billKey = `ADV-${(task.firmName || '').toLowerCase()}-${task.totalBillAmount}`;
    } else {
      billKey = `NO-BILL-${task.taskNo}`;
    }
    if (!payPendingGroups[billKey]) payPendingGroups[billKey] = [];
    payPendingGroups[billKey].push(task.taskNo);
  });
  console.log('Make Payment Grouped Pending count:', Object.keys(payPendingGroups).length);
  console.log('Make Payment Pending task list:', allPayPending.map(t => ({ taskNo: t.taskNo, isAdvance: t.isAdvance, billNo: t.billNo })));

  // 3. STORE IN PAGE ANALYSIS
  console.log('\n--- 3. STORE IN PAGE ---');
  const normalStorePending = rawTasks.filter(t => t['Actual 4'] && !t['Actual 3']);
  const normalStoreHistory = rawTasks.filter(t => t['Actual 3']);
  const advStorePending = advList.filter(t => t.actualCheckMachineDate && !t.actualStoreInDate);
  const advStoreHistory = advList.filter(t => t.actualCheckMachineDate && t.actualStoreInDate);

  console.log('Normal Store In Pending:', normalStorePending.length);
  console.log('Normal Store In History:', normalStoreHistory.length);
  console.log('Advance Store In Pending:', advStorePending.length);
  console.log('Advance Store In History:', advStoreHistory.length);
  console.log('Total Store In History:', normalStoreHistory.length + advStoreHistory.length);
}

runAnalysis();
