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
const BUCKET = 'repair-docs';
const FOLDER = 'files';

function extractDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  const matchD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) return matchD[1];
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) return matchId[1];
  return null;
}

async function downloadDriveFile(fileId) {
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: contentType.includes('text/html') ? 'image/jpeg' : contentType
  };
}

async function uploadToSupabase(fileName, buffer, contentType) {
  const filePath = `${FOLDER}/${fileName}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (error) throw error;

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  return publicData?.publicUrl || '';
}

async function migrateTable(tableName, column, idColumn = 'id', prefix = '') {
  console.log(`\n========================================`);
  console.log(`Checking table '${tableName}' on column '${column}'...`);
  
  const { data: rows, error } = await supabase
    .from(tableName)
    .select(`*`);

  if (error) {
    console.error(`Error querying ${tableName}:`, error);
    return;
  }

  const driveRows = (rows || []).filter(
    (r) => r[column] && typeof r[column] === 'string' && r[column].includes('drive.google.com')
  );

  console.log(`Found ${driveRows.length} drive links in ${tableName}.${column}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < driveRows.length; i++) {
    const row = driveRows[i];
    const originalUrl = row[column];
    const fileId = extractDriveId(originalUrl);
    const rowId = row[idColumn] || row.task_no || i;

    if (!fileId) {
      console.log(`[${i + 1}/${driveRows.length}] Skipping (no drive ID): ${originalUrl}`);
      continue;
    }

    const safePrefix = prefix || tableName;
    const fileName = `${safePrefix}_${row.task_no || rowId}_${fileId}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');

    try {
      console.log(`[${i + 1}/${driveRows.length}] Downloading Drive ID ${fileId}...`);
      const { buffer, contentType } = await downloadDriveFile(fileId);

      console.log(`[${i + 1}/${driveRows.length}] Uploading to ${BUCKET}/${FOLDER}/${fileName}...`);
      const supabaseUrl = await uploadToSupabase(fileName, buffer, contentType);

      console.log(`[${i + 1}/${driveRows.length}] Updating ${tableName} row ${rowId} with Supabase URL...`);
      const updatePayload = {};
      updatePayload[column] = supabaseUrl;

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq(idColumn, row[idColumn]);

      if (updateError) {
        console.error(`Update failed for ${rowId}:`, updateError);
        failCount++;
      } else {
        console.log(`✅ Success for ${row.task_no || rowId} -> ${supabaseUrl}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Failed on row ${rowId}:`, err.message);
      failCount++;
    }
  }

  console.log(`Finished ${tableName}.${column}: ${successCount} updated, ${failCount} failed.`);
}

async function runMigration() {
  console.log('Starting Migration of Drive links to Supabase Storage repair-docs/files/ ...');

  // 1. Indent (machine_image_url)
  await migrateTable('indent', 'machine_image_url', 'id', 'indent');

  // 2. Sent To Vendor (transport_image_url)
  await migrateTable('sent_to_vendor', 'transport_image_url', 'id', 'sent');

  // 3. Check Machine (bill_image_url)
  await migrateTable('check_machine', 'bill_image_url', 'id', 'bill');

  // 4. Store In (store_image_url)
  await migrateTable('store_in', 'store_image_url', 'id', 'store');

  console.log('\nMigration run completed!');
}

runMigration();
