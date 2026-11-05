const XLSX = require('xlsx');

const API_BASE = 'http://localhost:5000/api';

async function run() {
  console.log('================================================================');
  console.log('KANVTECH PRODUCT ENTITLEMENTS MASS UPDATE VERIFICATION');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, extra = '') {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} ${extra ? '-> ' + extra : ''}`);
      failed++;
    }
  }

  // 1. Login as ADMIN
  console.log('\n--- 1. Authenticating as ADMIN ---');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  assert('Admin login successful (HTTP 200)', loginRes.status === 200);
  const token = loginData.token;
  assert('Received JWT token', Boolean(token));

  // 1b. Create a test branch under CMP-0001 for Branch Entitlement tests
  console.log('\n--- 1b. Setting up Test Branch under CMP-0001 ---');
  const branchRes = await fetch(`${API_BASE}/companies/CMP-0001/branches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branchName: 'Mumbai Regional Office',
      address: 'Suite 401, Nariman Point',
      city: 'Mumbai',
      state: 'Maharashtra',
      contactPerson: 'Arun Kumar',
      contactPhone: '9822000000',
    }),
  });
  const branchData = await branchRes.json();
  const branchId = branchData.id || branchData.branchId;
  assert('Test branch created or resolved under CMP-0001', Boolean(branchId), `Branch ID: ${branchId}`);

  // 2. Download Customer Mass Update Template
  console.log('\n--- 2. Downloading Customer Mass Update Multi-Sheet Template ---');
  const templateRes = await fetch(`${API_BASE}/import/mass-update/template/customers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert('Template download returns HTTP 200', templateRes.status === 200);
  const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
  const wb = XLSX.read(templateBuffer, { type: 'buffer' });

  assert('Workbook contains at least 3 sheets', wb.SheetNames.length >= 3, `Found: ${wb.SheetNames.join(', ')}`);
  assert('Sheet 1 is "Customers Update"', wb.SheetNames[0] === 'Customers Update');
  assert('Sheet 2 is "Product Entitlements"', wb.SheetNames[1] === 'Product Entitlements');
  assert('Sheet 3 is "Instructions"', wb.SheetNames[2] === 'Instructions');

  // Verify Sheet 1 Columns (15 customer fields)
  const custSheet = wb.Sheets['Customers Update'];
  const custRows = XLSX.utils.sheet_to_json(custSheet, { header: 1 });
  const custHeaders = custRows[0] || [];
  assert('Sheet 1 has 15 customer columns', custHeaders.length === 15, `Count: ${custHeaders.length}`);
  assert('Sheet 1 includes Customer ID', custHeaders[0] === 'Customer ID');
  assert('Sheet 1 includes Company Name', custHeaders[1] === 'Company Name');
  assert('Sheet 1 includes Office Address', custHeaders[2] === 'Office Address');
  assert('Sheet 1 includes GSTN / Tax ID', custHeaders[3] === 'GSTN / Tax ID');
  assert('Sheet 1 includes Alternate Contact Location / Address', custHeaders.includes('Alternate Contact Location / Address'));
  assert('Sheet 1 includes Is Active', custHeaders.includes('Is Active'));

  // Verify Sheet 2 Columns (12 entitlement fields)
  const entSheet = wb.Sheets['Product Entitlements'];
  const entRows = XLSX.utils.sheet_to_json(entSheet, { header: 1 });
  const entHeaders = entRows[0] || [];
  const expectedEntHeaders = [
    'Customer ID', 'Company Name', 'Branch ID', 'Branch Name',
    'Product ID', 'Product Name', 'Module ID', 'Module Name',
    'Sub-Module ID', 'Sub-Module Name', 'Action', 'Status',
  ];
  assert('Sheet 2 has 12 entitlement columns', entHeaders.length === 12, `Count: ${entHeaders.length}`);
  expectedEntHeaders.forEach((h, idx) => {
    assert(`Sheet 2 Column ${idx + 1} is "${h}"`, entHeaders[idx] === h);
  });
  assert('Sheet 2 has sample data rows', entRows.length > 2, `Total rows: ${entRows.length}`);

  // 3. Test File Parse Endpoint with Multi-Sheet
  console.log('\n--- 3. Testing Upload & Parsing of Multi-Sheet Workbook ---');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const filePart = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="kanvtech_customers_mass_update_template.xlsx"',
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '',
    templateBuffer.toString('binary'),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const parseRes = await fetch(`${API_BASE}/import/mass-update/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.from(filePart, 'binary'),
  });
  const parseData = await parseRes.json();
  assert('Parse endpoint returns HTTP 200/201', [200, 201].includes(parseRes.status), JSON.stringify(parseData));
  assert('Parse response returns sheets list', Array.isArray(parseData.sheets) && parseData.sheets.length >= 2);
  const entSheetMeta = parseData.sheets?.find(s => s.name === 'Product Entitlements');
  assert('Product Entitlements sheet recognized with isEntitlementsSheet=true', entSheetMeta?.isEntitlementsSheet === true);

  // 4. Test Preview Entitlements Update (Mode A - Selective)
  console.log('\n--- 4. Testing Preview Entitlements Update (Mode A - Selective) ---');
  const testEntitlementRows = [
    // Row 1: Valid ADD company product & module & submodule
    {
      'Customer ID': 'CMP-0001',
      'Company Name': 'Acme Technologies',
      'Branch ID': '',
      'Product ID': 'PROD-0001',
      'Module ID': 'MOD-TALLY-ACC',
      'Sub-Module ID': 'SUB-TALLY-LED',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
    // Row 2: Valid ADD branch entitlement with real branch
    {
      'Customer ID': 'CMP-0001',
      'Branch ID': branchId,
      'Product ID': 'PROD-0001',
      'Module ID': 'MOD-TALLY-ACC',
      'Sub-Module ID': 'SUB-TALLY-LED',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
    // Row 3: Valid UPDATE status to INACTIVE
    {
      'Customer ID': 'CMP-0001',
      'Branch ID': '',
      'Product ID': 'PROD-0002',
      'Module ID': 'MOD-SPINE-PAY',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
    // Row 4: Valid REMOVE
    {
      'Customer ID': 'CMP-0001',
      'Branch ID': '',
      'Product ID': 'PROD-0003-BIOS',
      Action: 'REMOVE',
    },
    // Row 5: INVALID - Module does not belong to Product
    {
      'Customer ID': 'CMP-0001',
      'Product ID': 'PROD-0001', // Tally
      'Module ID': 'MOD-SPINE-PAY', // Spine Payroll -> Invalid hierarchy
      Action: 'ADD',
      Status: 'ACTIVE',
    },
    // Row 6: INVALID - Submodule without Module
    {
      'Customer ID': 'CMP-0001',
      'Product ID': 'PROD-0001',
      'Sub-Module ID': 'SUB-TALLY-LED',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
    // Row 7: INVALID - Non-existent Customer
    {
      'Customer ID': 'CMP-9999-NOTFOUND',
      'Product ID': 'PROD-0001',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
  ];

  const previewRes = await fetch(`${API_BASE}/import/mass-update/entitlements/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rows: testEntitlementRows,
      mode: 'selective',
    }),
  });
  const previewData = await previewRes.json();
  assert('Entitlements preview returns HTTP 200/201', [200, 201].includes(previewRes.status), JSON.stringify(previewData));
  const summary = previewData.preview?.summary;
  assert('Summary exists with totalRows === 7', summary?.totalRows === 7, `Total: ${summary?.totalRows}`);
  assert('Invalid rows detected (invalidCount === 3)', summary?.invalidCount === 3, `Invalid: ${summary?.invalidCount}`);
  assert('Ready count calculated correctly (readyCount >= 2)', summary?.readyCount >= 2, `Ready: ${summary?.readyCount}`);
  assert('Affected customers identified', summary?.affectedCustomerCount >= 1, `Affected: ${summary?.affectedCustomerCount}`);

  // Check row-level validations
  const rows = previewData.preview?.rows || [];
  const invalidModRow = rows[4];
  assert(
    'Row 5 rejected due to invalid Module-Product hierarchy',
    invalidModRow?.isValid === false && invalidModRow?.errors.some(e => e.includes('does not belong to Product')),
    `Errors: ${invalidModRow?.errors}`
  );

  const submodNoModRow = rows[5];
  assert(
    'Row 6 rejected due to Sub-Module specified without Module',
    submodNoModRow?.isValid === false && submodNoModRow?.errors.some(e => e.includes('without a valid Module')),
    `Errors: ${submodNoModRow?.errors}`
  );

  const unknownCustRow = rows[6];
  assert(
    'Row 7 rejected due to non-existent Customer ID',
    unknownCustRow?.isValid === false && unknownCustRow?.errors.some(e => e.includes('not found')),
    `Errors: ${unknownCustRow?.errors}`
  );

  // 5. Test Commit Entitlements Update
  console.log('\n--- 5. Testing Commit Entitlements Update ---');
  const commitRows = [
    {
      'Customer ID': 'CMP-0001',
      'Branch ID': '',
      'Product ID': 'PROD-0001',
      'Module ID': 'MOD-TALLY-ACC',
      'Sub-Module ID': 'SUB-TALLY-LED',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
    {
      'Customer ID': 'CMP-0001',
      'Branch ID': branchId,
      'Product ID': 'PROD-0001',
      'Module ID': 'MOD-TALLY-ACC',
      'Sub-Module ID': 'SUB-TALLY-LED',
      Action: 'ADD',
      Status: 'ACTIVE',
    },
  ];

  const commitRes = await fetch(`${API_BASE}/import/mass-update/entitlements/commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rows: commitRows,
      mode: 'selective',
      fileName: 'test_entitlements.xlsx',
    }),
  });
  const commitData = await commitRes.json();
  assert('Commit returns HTTP 200/201', [200, 201].includes(commitRes.status), JSON.stringify(commitData));
  assert('Processed count is 2 (Applied: ' + commitData.result?.appliedCount + ', Skipped: ' + commitData.result?.skippedCount + ')', (commitData.result?.appliedCount + commitData.result?.skippedCount) === 2);
  assert('Failed count is 0', commitData.result?.failedCount === 0, `Failed: ${commitData.result?.failedCount}`);
  assert('Operation ID generated', Boolean(commitData.result?.operationId));

  // 6. Test Mode B (Full Entitlement Synchronization)
  console.log('\n--- 6. Testing Preview in Mode B (Full Entitlement Synchronization) ---');
  // List only PROD-0002 for CMP-0001. PROD-0001 (which is active) should be detected for removal!
  const fullSyncRes = await fetch(`${API_BASE}/import/mass-update/entitlements/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rows: [
        {
          'Customer ID': 'CMP-0001',
          'Product ID': 'PROD-0002',
          Action: 'ADD',
          Status: 'ACTIVE',
        },
      ],
      mode: 'full_sync',
    }),
  });
  const fullSyncData = await fullSyncRes.json();
  assert('Full sync preview returns HTTP 200/201', [200, 201].includes(fullSyncRes.status));
  assert('Full sync mode detected', fullSyncData.preview?.mode === 'full_sync');
  const fullSyncRows = fullSyncData.preview?.rows || [];
  const flaggedForRemoval = fullSyncRows.filter(r => r.warnings.some(w => w.includes('Full Sync')));
  assert('Unlisted active product (PROD-0001) flagged for removal in Full Sync', flaggedForRemoval.length >= 1, `Flagged: ${flaggedForRemoval.length}`);

  // 7. Verify Audit Log entry
  console.log('\n--- 7. Verifying Mass Update Audit Log ---');
  const historyRes = await fetch(`${API_BASE}/import/mass-update/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const historyData = await historyRes.json();
  assert('History endpoint returns HTTP 200', historyRes.status === 200);
  assert('History items returned', Array.isArray(historyData.history));

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in test script:', err);
  process.exit(1);
});
