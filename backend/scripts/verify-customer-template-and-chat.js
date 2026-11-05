const XLSX = require('xlsx');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('========================================================================');
  console.log('KANVTECH CUSTOMER 3-SHEET WORKBOOK & PLATFORM INCHARGE CHAT VERIFICATION');
  console.log('========================================================================\n');

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

  // 1. Authenticate as ADMIN
  console.log('--- 1. Authenticating as ADMIN ---');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const adminLogin = await adminLoginRes.json();
  assert('Admin login successful (HTTP 200)', adminLoginRes.status === 200);
  const adminToken = adminLogin.token;

  // 2. Authenticate as PLATFORM_INCHARGE (ashutosh@kanvtech.com)
  console.log('\n--- 2. Authenticating as PLATFORM_INCHARGE (ashutosh@kanvtech.com) ---');
  const inchargeLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ashutosh@kanvtech.com', password: 'Password@123' }),
  });
  const inchargeLogin = await inchargeLoginRes.json();
  assert('ashutosh@kanvtech.com login successful (HTTP 200)', inchargeLoginRes.status === 200);
  assert('User has role PLATFORM_INCHARGE', inchargeLogin.user?.role === 'PLATFORM_INCHARGE');
  const inchargeToken = inchargeLogin.token;

  // 3. Verify PLATFORM_INCHARGE chat endpoints (fixing issue in user screenshot)
  console.log('\n--- 3. Testing Chat Endpoints for PLATFORM_INCHARGE ---');
  const empRes = await fetch(`${API_BASE}/chat/employees`, {
    headers: { Authorization: `Bearer ${inchargeToken}` },
  });
  assert('GET /api/chat/employees returns HTTP 200 for PLATFORM_INCHARGE', empRes.status === 200);
  const empData = await empRes.json();
  assert('Returned employees list is non-empty', Array.isArray(empData.employees) && empData.employees.length > 0, `Count: ${empData.employees?.length}`);

  const convRes = await fetch(`${API_BASE}/chat/conversations`, {
    headers: { Authorization: `Bearer ${inchargeToken}` },
  });
  assert('GET /api/chat/conversations returns HTTP 200 for PLATFORM_INCHARGE', convRes.status === 200);

  const searchRes = await fetch(`${API_BASE}/chat/search/employees?q=admin`, {
    headers: { Authorization: `Bearer ${inchargeToken}` },
  });
  assert('GET /api/chat/search/employees returns HTTP 200 for PLATFORM_INCHARGE', searchRes.status === 200);

  // 4. Download and verify Customer Workbook from Mode 1 (/api/import/template/customers)
  console.log('\n--- 4. Verifying Template from GET /api/import/template/customers ---');
  const mode1Res = await fetch(`${API_BASE}/import/template/customers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Mode 1 template download returns HTTP 200', mode1Res.status === 200);
  const mode1Buf = Buffer.from(await mode1Res.arrayBuffer());
  const wb1 = XLSX.read(mode1Buf, { type: 'buffer', cellStyles: true });

  assert('Workbook contains exactly 3 worksheets', wb1.SheetNames.length === 3, `Found: ${wb1.SheetNames.join(', ')}`);
  assert('Sheet 1 is "CUSTOMERS"', wb1.SheetNames[0] === 'CUSTOMERS');
  assert('Sheet 2 is "UPDATE CUSTOMERS"', wb1.SheetNames[1] === 'UPDATE CUSTOMERS');
  assert('Sheet 3 is "INSTRUCTIONS"', wb1.SheetNames[2] === 'INSTRUCTIONS');

  // Verify Sheet 1 CUSTOMERS columns
  const ws1Data = XLSX.utils.sheet_to_json(wb1.Sheets['CUSTOMERS'], { header: 1 });
  assert('Sheet 1 has 13 creation columns', ws1Data[0].length === 13, `Count: ${ws1Data[0].length}`);

  // Verify Sheet 2 UPDATE CUSTOMERS columns (exact 23 columns in exact order)
  const expected23 = [
    'Customer ID',
    'Company Name',
    'Address',
    'GSTN',
    'Primary Email',
    'Alternate Emails',
    'Contact Person',
    'Contact Phone',
    'Contact Location',
    'Contact Status',
    'Alternate Contact',
    'Alternate Contact Phone',
    'Alternate Contact Email',
    'Alternate Contact Location / Address',
    'Entitlement Type',
    'Branch ID',
    'Branch Name',
    'Product Codes',
    'Product Modules',
    'Product Submodules',
    'Entitlement Action',
    'Entitlement Status',
    'Is Active',
  ];
  const ws2Data = XLSX.utils.sheet_to_json(wb1.Sheets['UPDATE CUSTOMERS'], { header: 1 });
  const actualCols = ws2Data[0];
  assert('Sheet 2 has exactly 23 columns', actualCols.length === 23, `Actual: ${actualCols.length}`);
  let colsMatch = true;
  for (let i = 0; i < expected23.length; i++) {
    if (actualCols[i] !== expected23[i]) {
      colsMatch = false;
      console.error(`Column mismatch at index ${i}: expected "${expected23[i]}", got "${actualCols[i]}"`);
    }
  }
  assert('Sheet 2 columns match the required 23 columns in exact specified order', colsMatch);

  // Check column widths and autofilter
  const ws2 = wb1.Sheets['UPDATE CUSTOMERS'];
  assert('Sheet 2 has column width definitions (!cols)', Boolean(ws2['!cols']) && ws2['!cols'].length === 23);
  assert('Sheet 2 has autofilter configured (!autofilter)', Boolean(ws2['!autofilter']));

  // 5. Download and verify Customer Workbook from Mode 2 (/api/import/mass-update/template/customers)
  console.log('\n--- 5. Verifying Template from GET /api/import/mass-update/template/customers ---');
  const mode2Res = await fetch(`${API_BASE}/import/mass-update/template/customers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Mode 2 template download returns HTTP 200', mode2Res.status === 200);
  const mode2Buf = Buffer.from(await mode2Res.arrayBuffer());
  const wb2 = XLSX.read(mode2Buf, { type: 'buffer', cellStyles: true });
  assert('Mode 2 workbook also has 3 sheets', wb2.SheetNames.length === 3);
  assert('Mode 2 has UPDATE CUSTOMERS sheet with 23 columns', wb2.SheetNames[1] === 'UPDATE CUSTOMERS');
  assert('Mode 2 Sheet 2 has column widths configured', Boolean(wb2.Sheets['UPDATE CUSTOMERS']['!cols']) && wb2.Sheets['UPDATE CUSTOMERS']['!cols'].length === 23);

  // 6. Test Parsing Uploaded Workbook
  console.log('\n--- 6. Testing Document Parsing via POST /api/import/mass-update/parse ---');
  const boundary = '----WebKitFormBoundaryTest1234567890';
  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="customers_update.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}--\r\n`;
  const multipartBody = Buffer.concat([
    Buffer.from(fileHeader, 'utf8'),
    mode2Buf,
    Buffer.from(fileFooter, 'utf8'),
  ]);

  const parseRes = await fetch(`${API_BASE}/import/mass-update/parse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  assert('Parse file returns HTTP 200 or 201', parseRes.status === 200 || parseRes.status === 201);
  const parseData = await parseRes.json();
  assert('Multi-sheet summary returned with 2 data sheets (excluding Instructions)', parseData.sheets?.length === 2);
  assert('Active sheet defaults to "UPDATE CUSTOMERS"', parseData.activeSheet === 'UPDATE CUSTOMERS');
  assert('Active sheet has 23 columns', parseData.columns?.length === 23);

  // 7. Test Customer Master Mass Update Preview with 15 Profile Fields
  console.log('\n--- 7. Testing Customer Master Mass Update Preview ---');
  const previewPayload = {
    rows: [
      {
        'Customer ID': 'CMP-0001',
        'Company Name': 'Acme Global Corporation Updated',
        'Office Address': 'Plot 42, MIDC Industrial Area, Pune 411018',
        'GSTN / Tax ID': '27AABCA1234F1Z5',
        'Primary Email': 'accounts@acme.com',
        'Alternate Emails': 'billing@acme.com, ops@acme.com',
        'Primary Contact Person': 'Suresh Patil',
        'Primary Contact Phone': '+919822012345',
        'Contact Location': 'Floor 3, Building B, Pune Hub',
        'Contact Status': 'VERIFIED',
        'Alternate Contact Person': 'Pooja Mehta',
        'Alternate Contact Phone': '+919822099999',
        'Alternate Contact Email': 'pooja@acme.com',
        'Alternate Contact Location / Address': 'Pune Regional Operations Centre',
        'Is Active': 'true',
      },
    ],
    identifierColumn: 'Customer ID',
    fieldMappings: {
      'Customer ID': '__IDENTIFIER__',
      'Company Name': 'companyName',
      'Office Address': 'address',
      'GSTN / Tax ID': 'gstn',
      'Primary Email': 'primaryEmail',
      'Alternate Emails': 'alternateEmails',
      'Primary Contact Person': 'contactPerson',
      'Primary Contact Phone': 'contactPhone',
      'Contact Location': 'contactAddress',
      'Contact Status': 'contactStatus',
      'Alternate Contact Person': 'alternateContact',
      'Alternate Contact Phone': 'alternateContactPhone',
      'Alternate Contact Email': 'alternateContactEmail',
      'Alternate Contact Location / Address': 'alternateContactAddress',
      'Is Active': 'isActive',
    },
    updateMode: 'selective_overwrite',
    selectedFields: [
      'companyName',
      'address',
      'gstn',
      'primaryEmail',
      'alternateEmails',
      'contactPerson',
      'contactPhone',
      'contactAddress',
      'contactStatus',
      'alternateContact',
      'alternateContactPhone',
      'alternateContactEmail',
      'alternateContactAddress',
      'isActive',
    ],
  };

  const custPreviewRes = await fetch(`${API_BASE}/import/mass-update/preview/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(previewPayload),
  });
  assert('Customer preview returns HTTP 200 or 201', custPreviewRes.status === 200 || custPreviewRes.status === 201);
  const custPreviewData = await custPreviewRes.json();
  const summary = custPreviewData.preview?.summary;
  assert('Customer record matched by ID (CMP-0001)', summary?.matchedCount === 1, `Matched: ${summary?.matchedCount}`);
  assert('Zero unmatched records', summary?.unmatchedCount === 0);
  assert('Zero validation errors', summary?.invalidCount === 0);

  console.log('\n========================================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
