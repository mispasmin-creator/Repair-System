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

async function previewAndSync() {
  console.log('Fetching store_in records with actual_date...');
  const { data: stores, error: sErr } = await supabase
    .from('store_in')
    .select('*')
    .not('actual_date', 'is', null);

  if (sErr) {
    console.error('Error fetching store_in:', sErr);
    return;
  }

  const { data: checks } = await supabase.from('check_machine').select('*');
  const { data: sents } = await supabase.from('sent_to_vendor').select('*');
  const { data: existingPostings } = await supabase.from('posting').select('task_no');
  const { data: existingPayments } = await supabase.from('make_payment').select('task_no');

  const checkMap = {};
  (checks || []).forEach((c) => { checkMap[c.task_no] = c; });

  const sentMap = {};
  (sents || []).forEach((s) => { sentMap[s.task_no] = s; });

  const existingPostSet = new Set((existingPostings || []).map((p) => p.task_no));
  const existingPaySet = new Set((existingPayments || []).map((m) => m.task_no));

  console.log(`Found ${stores.length} store_in records with actual_date.`);

  const postingInserts = [];
  const paymentInserts = [];

  for (const s of stores) {
    const taskNo = s.task_no;
    const storeDate = s.actual_date;
    const cm = checkMap[taskNo] || {};
    const sv = sentMap[taskNo] || {};

    const amount = Number(cm.total_bill_amount) || Number(sv.vendor_1_total_amount) || 0;
    const paymentType = sv.payment_type_1 || 'Credit';
    const doneBy = s.store_in_done_by || 'Admin';

    if (!existingPostSet.has(taskNo)) {
      postingInserts.push({
        task_no: taskNo,
        planned_date: cm.actual_date || storeDate,
        actual_date: storeDate,
        posting_voucher_no: `PV-${taskNo}`,
        posting_done_by: doneBy,
        process_remark: 'Store In Completed (Auto-Synced)'
      });
    }

    if (!existingPaySet.has(taskNo)) {
      paymentInserts.push({
        task_no: taskNo,
        planned_date: storeDate,
        actual_date: storeDate,
        payment_type: paymentType,
        payment_utr_no: 'PAID',
        amount_paid: amount,
        payment_done_by: doneBy
      });
    }
  }

  console.log(`Prepared ${postingInserts.length} posting records and ${paymentInserts.length} make_payment records.`);
  
  if (postingInserts.length > 0) {
    console.log('Inserting into posting...');
    const { error: postErr } = await supabase.from('posting').insert(postingInserts);
    if (postErr) {
      console.error('Error inserting into posting:', postErr);
    } else {
      console.log('✅ Successfully inserted into posting table!');
    }
  }

  if (paymentInserts.length > 0) {
    console.log('Inserting into make_payment...');
    const { error: payErr } = await supabase.from('make_payment').insert(paymentInserts);
    if (payErr) {
      console.error('Error inserting into make_payment:', payErr);
    } else {
      console.log('✅ Successfully inserted into make_payment table!');
    }
  }

  // Also sync to Google Sheet so both stay 100% in sync
  const scriptUrl = envVars.VITE_SCRIPT_URL;
  if (scriptUrl) {
    console.log('\nSyncing to Google Sheet Repair System...');
    for (const p of postingInserts) {
      try {
        const d = p.actual_date ? new Date(p.actual_date).toLocaleDateString('en-GB') : '';
        const payload = {
          action: 'update1',
          sheetName: 'Repair System',
          taskNo: p.task_no,
          'Actual Posting': d,
          'Posting Voucher No': p.posting_voucher_no,
          'Actual 4': d,
          'UTR / Cheque No': 'PAID'
        };
        await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload).toString()
        });
        console.log(`Sheet updated for ${p.task_no}`);
      } catch (e) {
        console.warn(`Sheet update failed for ${p.task_no}:`, e.message);
      }
    }
  }

  console.log('\nAll done!');
}

previewAndSync();
