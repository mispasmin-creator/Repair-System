/**
 * seed_master_to_supabase.cjs
 * Seeds master data into Supabase 'master' table in COLUMN-WISE format
 * matching the exact Google Sheets layout.
 */

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

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  console.log('🚀 Checking if column-wise "master" table exists in Supabase...');
  const { data: colsCheck, error: checkError } = await supabase
    .from('master')
    .select('machine_name, vendor_name')
    .limit(1);

  if (checkError) {
    console.error('❌ Master table not found or columns do not match:', checkError.message);
    console.log('\n👉 Please run "supabase_master_table.sql" in your Supabase SQL Editor first!');
    return;
  }

  console.log('✅ Column-wise master table found! Reading masterData.json...');
  const masterDataPath = path.resolve(__dirname, '..', 'src', 'data', 'masterData.json');
  const masterData = JSON.parse(fs.readFileSync(masterDataPath, 'utf8'));

  const indentors = masterData['Indentor Name '] || masterData['Indentor Name'] || [];
  const auth = masterData['Authorized Name'] || ['Self'];
  const machines = masterData['Machine Name'] || [];
  const depts = masterData['Department'] || [];
  const uoms = masterData['UOM'] || [];
  const firms = masterData['Firm Name'] || ['Pmmpl', 'Purab', 'Refrasynth', 'Rkl', 'Refratech'];
  const pTypes = masterData['Payment Type'] || ['Advance', 'Full', 'Cash'];
  const bTypes = masterData['Type of Bill'] || ['Common', 'Independent'];
  const vendors = masterData['Vendor Name'] || [];
  const transporters = masterData['Transporter Name'] || [
    'Self',
    'Boby Cargo',
    'Gagan Roadways',
    'OM Logistics',
    'V-Trans',
  ];

  const maxLen = Math.max(
    indentors.length,
    auth.length,
    machines.length,
    depts.length,
    uoms.length,
    firms.length,
    pTypes.length,
    bTypes.length,
    vendors.length,
    transporters.length
  );

  console.log(`📦 Preparing ${maxLen} rows with columns matching Google Sheets...`);

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push({
      indentor_name: indentors[i] ? String(indentors[i]).trim() : null,
      authorized_name: auth[i] ? String(auth[i]).trim() : null,
      machine_name: machines[i] ? String(machines[i]).trim() : null,
      department: depts[i] ? String(depts[i]).trim() : null,
      uom: uoms[i] ? String(uoms[i]).trim() : null,
      firm_name: firms[i] ? String(firms[i]).trim() : null,
      payment_type: pTypes[i] ? String(pTypes[i]).trim() : null,
      type_of_bill: bTypes[i] ? String(bTypes[i]).trim() : null,
      vendor_name: vendors[i] ? String(vendors[i]).trim() : null,
      transporter_name: transporters[i] ? String(transporter_name = transporters[i]).trim() : null,
    });
  }

  // Clear any existing rows to avoid duplication
  const { error: delError } = await supabase.from('master').delete().neq('id', 0);
  if (delError) {
    console.warn('Note on clearing rows:', delError.message);
  }

  // Insert in batches of 100
  const batchSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('master').insert(batch);

    if (error) {
      console.error(`❌ Batch error (${i} - ${i + batch.length}):`, error.message);
    } else {
      totalInserted += batch.length;
      process.stdout.write(`\r✅ Inserted ${totalInserted} / ${rows.length} rows...`);
    }
  }

  console.log('\n\n🎉 Successfully seeded column-wise Supabase Master table!');
}

seed();
