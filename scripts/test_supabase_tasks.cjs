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

async function testFetchAll() {
  console.log('Querying Supabase joined tables...');
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
    console.error('Error:', error);
    return;
  }

  console.log('Total indents fetched:', indents.length);
  const sample = indents.find(x => x.sent_to_vendor && x.sent_to_vendor.length > 0) || indents[0];
  console.log('Sample task joined:', {
    taskNo: sample.task_no,
    firm: sample.firm_name,
    machine: sample.machine_name,
    vendor: sample.sent_to_vendor,
    approval: sample.management_approval,
    check: sample.check_machine,
    store: sample.store_in,
    posting: sample.posting,
    payment: sample.make_payment
  });
}

testFetchAll();
