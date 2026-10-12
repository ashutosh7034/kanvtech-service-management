import assert from 'assert';
import * as XLSX from 'xlsx';

async function runExportRecoverySuite() {
  console.log('================================================================');
  console.log(' KANVTECH DATA EXPORT & DISASTER RECOVERY VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const BASE_URL = 'http://127.0.0.1:5000/api';

  // 1. Authenticate as Admin
  console.log('[Step 1] Authenticating as System Administrator...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginData.token, 'Admin login failed to return token');
  const adminToken = adminLoginData.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('   ✓ Admin authenticated successfully.\n');

  // 2. Fetch Export Modules
  console.log('[Step 2] Testing GET /api/export/modules...');
  const modulesRes = await fetch(`${BASE_URL}/export/modules`, { headers: adminHeaders });
  assert.strictEqual(modulesRes.status, 200, 'Modules endpoint must return 200');
  const modulesData = await modulesRes.json();
  assert(modulesData.success, 'Modules response success flag must be true');
  assert(Array.isArray(modulesData.modules), 'Modules must be an array');
  assert(modulesData.modules.length >= 10, 'Expected at least 10 business modules');
  console.log(`   ✓ Retrieved ${modulesData.modules.length} business modules.`);
  console.log(`   ✓ Total live database records: ${modulesData.totalSystemRecords}`);
  modulesData.modules.forEach((m: any) => {
    console.log(`     - [${m.id}] ${m.name}: ${m.recordCount} records (Auth: ${m.isAuthorized})`);
  });
  console.log();

  // 3. Test Excel (.xlsx) Export for Customers and All Data
  console.log('[Step 3] Testing Excel (.xlsx) Downloads...');
  const custXlsxRes = await fetch(`${BASE_URL}/export/download?module=customers&format=xlsx`, { headers: adminHeaders });
  assert.strictEqual(custXlsxRes.status, 200, 'Customer XLSX download failed');
  const custXlsxBuf = Buffer.from(await custXlsxRes.arrayBuffer());
  assert(custXlsxBuf.length > 1000, 'Customer XLSX buffer is too small');
  const custWb = XLSX.read(custXlsxBuf, { type: 'buffer' });
  assert(custWb.SheetNames.includes('Companies'), 'Customer XLSX must contain Companies sheet');
  console.log(`   ✓ Customers XLSX: ${custXlsxBuf.length} bytes, Sheets: ${custWb.SheetNames.join(', ')}`);

  const allXlsxRes = await fetch(`${BASE_URL}/export/download?module=all&format=xlsx`, { headers: adminHeaders });
  assert.strictEqual(allXlsxRes.status, 200, 'All Data XLSX download failed');
  const allXlsxBuf = Buffer.from(await allXlsxRes.arrayBuffer());
  const allWb = XLSX.read(allXlsxBuf, { type: 'buffer' });
  assert(allWb.SheetNames.length >= 8, 'All Data XLSX must contain multi-module worksheets');
  console.log(`   ✓ All Data XLSX: ${allXlsxBuf.length} bytes, Worksheets (${allWb.SheetNames.length}): ${allWb.SheetNames.slice(0, 6).join(', ')}...`);
  console.log();

  // 4. Test CSV Export
  console.log('[Step 4] Testing CSV (.csv) Downloads...');
  const csvRes = await fetch(`${BASE_URL}/export/download?module=products&format=csv`, { headers: adminHeaders });
  assert.strictEqual(csvRes.status, 200, 'Products CSV download failed');
  const csvText = await csvRes.text();
  assert(csvText.length > 50, 'Products CSV response too short');
  assert(csvText.includes('code') || csvText.includes('name') || csvText.includes('Products'), 'CSV must contain headers');
  console.log(`   ✓ Products CSV downloaded: ${csvText.length} characters.`);
  console.log();

  // 5. Test Structured JSON Backup & Credential Sanitization
  console.log('[Step 5] Testing Structured JSON Backup & Credential Sanitization...');
  const jsonRes = await fetch(`${BASE_URL}/export/download?module=all&format=json`, { headers: adminHeaders });
  assert.strictEqual(jsonRes.status, 200, 'JSON Backup download failed');
  const jsonText = await jsonRes.text();
  const backupObj = JSON.parse(jsonText);
  assert.strictEqual(backupObj.backupType, 'KANVTECH_ENTERPRISE_APPLICATION_BACKUP', 'Backup type header mismatch');
  assert.strictEqual(backupObj.version, '2.0.0', 'Backup schema version must be 2.0.0');
  assert(backupObj.tables, 'Backup must include tables');

  // Verify that NO password hashes exist in backup
  assert(!jsonText.includes('passwordHash'), 'SECURITY FAILURE: passwordHash found in exported JSON!');
  assert(!jsonText.includes('password_hash'), 'SECURITY FAILURE: password_hash found in exported JSON!');
  assert(!jsonText.includes('passwordEncrypted'), 'SECURITY FAILURE: passwordEncrypted found in exported JSON!');
  console.log(`   ✓ Versioned JSON backup verified: ${jsonText.length} bytes, Version: ${backupObj.version}`);
  console.log('   ✓ Zero credentials or password hashes exposed in backup.\n');

  // 6. Test Dry-Run Restore Preview
  console.log('[Step 6] Testing POST /api/export/backup/preview (Dry-Run Engine)...');
  const previewRes = await fetch(`${BASE_URL}/export/backup/preview`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(backupObj),
  });
  assert.strictEqual(previewRes.status, 201, 'Backup preview endpoint returned non-201/200');
  const previewData = await previewRes.json();
  assert(previewData.success, 'Preview response success flag must be true');
  assert(previewData.preview.isValid, 'Backup validation preview must be marked valid');
  assert(previewData.preview.summary.totalRecords > 0, 'Total records in preview must be > 0');
  console.log(`   ✓ Backup Validation Passed:`);
  console.log(`     - Total Tables Analyzed: ${previewData.preview.summary.totalTables}`);
  console.log(`     - Total Records in Backup: ${previewData.preview.summary.totalRecords}`);
  console.log(`     - Safe Upsert (Existing Records): ${previewData.preview.summary.wouldUpdate}`);
  console.log(`     - New Records to Insert: ${previewData.preview.summary.wouldCreate}`);
  console.log();

  // 7. Test Transactional Restore with Confirmation
  console.log('[Step 7] Testing POST /api/export/backup/restore (Transactional Restore)...');
  const restoreRes = await fetch(`${BASE_URL}/export/backup/restore`, {
    method: 'POST',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      backupPayload: backupObj,
      confirmed: true,
    }),
  });
  assert.strictEqual(restoreRes.status, 201, 'Backup restore failed');
  const restoreData = await restoreRes.json();
  assert(restoreData.success, 'Restore response success must be true');
  assert(restoreData.restoredCount > 0, 'Restored count must be > 0');
  console.log(`   ✓ Transactional Restore Committed: ${restoreData.restoredCount} core business records verified.`);
  console.log(`   ✓ Message: "${restoreData.message}"\n`);

  console.log('================================================================');
  console.log(' ALL DATA EXPORT & DISASTER RECOVERY TESTS PASSED! ✓            ');
  console.log('================================================================');
}

runExportRecoverySuite().catch((err) => {
  console.error('\n❌ Verification Suite Failed:', err);
  process.exit(1);
});
