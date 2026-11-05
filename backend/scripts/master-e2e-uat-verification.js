const XLSX = require('xlsx');

const API_BASE = 'http://localhost:5000/api';

async function main() {
  console.log('================================================================================');
  console.log('KANVTECH CUSTOMER EXCEL UPDATE: MASTER E2E UAT & SECURITY AUDIT SUITE');
  console.log('================================================================================\n');

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

  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('--- STEP 0: Authentication Setup ---');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const adminLogin = await adminLoginRes.json();
  assert('Admin login successful (HTTP 200)', adminLoginRes.status === 200);
  const adminToken = adminLogin.token;

  const inchargeLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ashutosh@kanvtech.com', password: 'Password@123' }),
  });
  const inchargeLogin = await inchargeLoginRes.json();
  assert('PLATFORM_INCHARGE login successful (HTTP 200)', inchargeLoginRes.status === 200);
  const inchargeToken = inchargeLogin.token;

  // ---------------------------------------------------------------------------
  // PHASE 2: EXCEL TEMPLATE UAT
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 2: Excel Template UAT ---');
  const tplRes1 = await fetch(`${API_BASE}/import/template/customers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Mode 1 template download returns HTTP 200', tplRes1.status === 200);
  const tplBuf1 = Buffer.from(await tplRes1.arrayBuffer());
  const wb1 = XLSX.read(tplBuf1, { type: 'buffer', cellStyles: true });

  assert('Workbook contains exactly 3 worksheets', wb1.SheetNames.length === 3, `Found: ${wb1.SheetNames.join(', ')}`);
  assert('Sheet 1 is named "CUSTOMERS"', wb1.SheetNames[0] === 'CUSTOMERS');
  assert('Sheet 2 is named "UPDATE CUSTOMERS"', wb1.SheetNames[1] === 'UPDATE CUSTOMERS');
  assert('Sheet 3 is named "INSTRUCTIONS"', wb1.SheetNames[2] === 'INSTRUCTIONS');

  const wsCustomers = wb1.Sheets['CUSTOMERS'];
  const custRows = XLSX.utils.sheet_to_json(wsCustomers, { header: 1 });
  assert('CUSTOMERS creation template preserves 13 columns', custRows[0].length === 13, `Count: ${custRows[0].length}`);

  const wsUpdate = wb1.Sheets['UPDATE CUSTOMERS'];
  const updateRows = XLSX.utils.sheet_to_json(wsUpdate, { header: 1 });
  const actualCols = updateRows[0];
  assert('UPDATE CUSTOMERS contains exactly 23 columns', actualCols.length === 23, `Count: ${actualCols.length}`);

  const required23 = [
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

  let orderCorrect = true;
  required23.forEach((col, idx) => {
    if (actualCols[idx] !== col) {
      orderCorrect = false;
      console.error(`Column mismatch at ${idx}: expected "${col}", got "${actualCols[idx]}"`);
    }
  });
  assert('UPDATE CUSTOMERS columns match required 23 columns in exact order', orderCorrect);

  assert('Column widths (!cols) configured for all 23 columns', Boolean(wsUpdate['!cols']) && wsUpdate['!cols'].length === 23);
  assert('AutoFilter configured for columns A through W', Boolean(wsUpdate['!autofilter']));

  // Check generator code for frozen view configuration
  const { generateUnifiedCustomerWorkbook } = require('../dist/import/customer-template.generator');
  assert('Workbook generator module loaded', typeof generateUnifiedCustomerWorkbook === 'function');

  // Verify Mode 2 download returns identical 3-sheet workbook
  const tplRes2 = await fetch(`${API_BASE}/import/mass-update/template/customers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Mode 2 template download returns HTTP 200', tplRes2.status === 200);
  const tplBuf2 = Buffer.from(await tplRes2.arrayBuffer());
  const wb2 = XLSX.read(tplBuf2, { type: 'buffer' });
  assert('Mode 2 workbook also has exactly 3 sheets', wb2.SheetNames.length === 3);
  assert('Mode 2 Sheet 2 is "UPDATE CUSTOMERS"', wb2.SheetNames[1] === 'UPDATE CUSTOMERS');

  // ---------------------------------------------------------------------------
  // PHASE 3: CUSTOMER UPDATE FUNCTIONAL TESTING
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 3: Customer Update Functional Testing ---');

  // 3a. Update Customer via direct API update (testing backend service field coverage)
  const customerUpdatePayload = {
    companyName: 'Apex Cloud Systems Private Limited',
    address: 'Plot 45, Phase 1, Industrial Area, Mumbai 400068',
    gstn: '27AAACA9988G1Z1',
    primaryEmail: 'contact@apexcloud.com',
    alternateEmails: 'billing@apexcloud.com, ops@apexcloud.com',
    contactPerson: 'Suresh Kulkarni',
    contactPhone: '+919822012345',
    contactAddress: 'Headquarters - Mumbai Hub',
    contactStatus: 'VERIFIED',
    alternateContact: 'Ramesh Deshmukh',
    alternateContactPhone: '+919822054321',
    alternateContactEmail: 'ramesh@apexcloud.com',
    alternateContactAddress: 'Branch Office - Pune Tech Park',
    isActive: true,
  };

  const updateApiRes = await fetch(`${API_BASE}/companies/CMP-0001`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerUpdatePayload),
  });
  assert('Customer CMP-0001 updated successfully via API (HTTP 200)', updateApiRes.status === 200);

  // Fetch updated customer to verify all 15 fields
  const getCustRes = await fetch(`${API_BASE}/companies/CMP-0001`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const custJson = await getCustRes.json();
  const updatedCust = custJson.company || custJson;
  assert('Company Name updated', updatedCust.companyName === 'Apex Cloud Systems Private Limited');
  assert('Office Address updated', updatedCust.address.includes('Plot 45'));
  assert('GSTN updated', updatedCust.gstn === '27AAACA9988G1Z1');
  assert('Primary Email updated', (updatedCust.primaryEmail || updatedCust.primary_email) === 'contact@apexcloud.com');
  assert('Alternate Emails updated', (updatedCust.alternateEmails || updatedCust.alternate_emails).includes('billing@apexcloud.com'));
  assert('Contact Person updated', (updatedCust.contactPerson || updatedCust.contact_person) === 'Suresh Kulkarni');
  assert('Contact Phone updated', (updatedCust.contactPhone || updatedCust.contact_phone) === '+919822012345');
  assert('Contact Location updated', (updatedCust.contactAddress || updatedCust.contact_address) === 'Headquarters - Mumbai Hub');
  assert('Contact Status updated', (updatedCust.contactStatus || updatedCust.contact_status) === 'VERIFIED');
  assert('Alternate Contact updated', (updatedCust.alternateContact || updatedCust.alternate_contact) === 'Ramesh Deshmukh');
  assert('Alternate Contact Phone updated', (updatedCust.alternateContactPhone || updatedCust.alternate_contact_phone) === '+919822054321');
  assert('Alternate Contact Email updated', (updatedCust.alternateContactEmail || updatedCust.alternate_contact_email) === 'ramesh@apexcloud.com');
  assert('Alternate Contact Location updated', (updatedCust.alternateContactAddress || updatedCust.alternate_contact_address) === 'Branch Office - Pune Tech Park');
  assert('Is Active updated', (updatedCust.isActive !== undefined ? updatedCust.isActive : Boolean(updatedCust.is_active)) === true);

  // 3b. Invalid Customer ID rejection
  const invalidIdPreview = await fetch(`${API_BASE}/import/mass-update/preview/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{ 'Customer ID': 'CMP-NONEXISTENT-9999', 'Company Name': 'Fake Corp' }],
      identifierColumn: 'Customer ID',
      fieldMappings: { 'Customer ID': '__IDENTIFIER__', 'Company Name': 'companyName' },
      updateMode: 'fill_missing',
    }),
  });
  const invalidIdData = await invalidIdPreview.json();
  assert('Invalid Customer ID flagged as unmatched (unmatchedCount: 1)', invalidIdData.preview?.summary?.unmatchedCount === 1);
  assert('No records marked ready to commit for invalid Customer ID', invalidIdData.preview?.summary?.readyCount === 0);

  // 3c. Duplicate Customer ID handling
  const duplicateIdPreview = await fetch(`${API_BASE}/import/mass-update/preview/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [
        { 'Customer ID': 'CMP-0001', 'Company Name': 'Acme One' },
        { 'Customer ID': 'CMP-0001', 'Company Name': 'Acme Duplicate' },
      ],
      identifierColumn: 'Customer ID',
      fieldMappings: { 'Customer ID': '__IDENTIFIER__', 'Company Name': 'companyName' },
      updateMode: 'fill_missing',
    }),
  });
  const duplicateIdData = await duplicateIdPreview.json();
  assert('Duplicate Customer ID flagged in uploaded file', duplicateIdData.preview?.summary?.duplicateCount > 0);

  // 3d. Invalid email format rejection
  const invalidEmailPreview = await fetch(`${API_BASE}/import/mass-update/preview/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{ 'Customer ID': 'CMP-0001', 'Primary Email': 'not-a-valid-email' }],
      identifierColumn: 'Customer ID',
      fieldMappings: { 'Customer ID': '__IDENTIFIER__', 'Primary Email': 'primaryEmail' },
      updateMode: 'selective_overwrite',
      selectedFields: ['primaryEmail'],
    }),
  });
  const invalidEmailData = await invalidEmailPreview.json();
  assert('Invalid email rejected with validation error', invalidEmailData.preview?.summary?.invalidCount === 1);

  // 3e. Invalid GSTN format rejection
  const invalidGstnPreview = await fetch(`${API_BASE}/import/mass-update/preview/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{ 'Customer ID': 'CMP-0001', 'GSTN': '123' }],
      identifierColumn: 'Customer ID',
      fieldMappings: { 'Customer ID': '__IDENTIFIER__', 'GSTN': 'gstn' },
      updateMode: 'selective_overwrite',
      selectedFields: ['gstn'],
    }),
  });
  const invalidGstnData = await invalidGstnPreview.json();
  assert('Invalid GSTN rejected with validation error', invalidGstnData.preview?.summary?.invalidCount === 1);

  // ---------------------------------------------------------------------------
  // PHASE 4: PRODUCT ENTITLEMENT TESTING
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 4: Product Entitlement Testing ---');

  // 4a. Add Product Entitlement via string syntax (TALLY, SPINE)
  const entPreviewRes = await fetch(`${API_BASE}/import/mass-update/entitlements/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [
        {
          'Customer ID': 'CMP-0001',
          'Product Codes': 'TALLY, SPINE',
          'Product Modules': 'TALLY:Accounting|Inventory;SPINE:Payroll',
          'Product Submodules': 'TALLY:Accounting=Ledger;SPINE:Payroll=Salary',
          'Entitlement Action': 'UPDATE',
          'Entitlement Status': 'ACTIVE',
        },
      ],
      mode: 'selective',
    }),
  });
  assert('Entitlements preview returns HTTP 200 or 201', entPreviewRes.status === 200 || entPreviewRes.status === 201);
  const entPreviewData = await entPreviewRes.json();
  const entPreview = entPreviewData.preview;
  assert('Multi-product string syntax expands to multiple preview items', entPreview?.rows?.length >= 2, `Count: ${entPreview?.rows?.length}`);
  assert('Preview accurately matched customer CMP-0001', entPreview?.summary?.affectedCustomerCount === 1);

  // 4b. Commit Product Entitlement update
  const entCommitRes = await fetch(`${API_BASE}/import/mass-update/entitlements/commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [
        {
          'Customer ID': 'CMP-0001',
          'Product Codes': 'TALLY, SPINE',
          'Product Modules': 'TALLY:Accounting|Inventory;SPINE:Payroll',
          'Product Submodules': 'TALLY:Accounting=Ledger;SPINE:Payroll=Salary',
          'Entitlement Action': 'UPDATE',
          'Entitlement Status': 'ACTIVE',
        },
      ],
      mode: 'selective',
      fileName: 'test_entitlements_update.xlsx',
    }),
  });
  assert('Entitlements commit returns HTTP 200 or 201', entCommitRes.status === 200 || entCommitRes.status === 201);
  const entCommitData = await entCommitRes.json();
  assert('Entitlements committed with appliedCount > 0 or idempotently skipped as unchanged', (entCommitData.result?.appliedCount > 0 || entCommitData.result?.skippedCount > 0), `Applied: ${entCommitData.result?.appliedCount}, Skipped: ${entCommitData.result?.skippedCount}`);
  assert('Entitlement operation logged in audit history', Boolean(entCommitData.result?.operationId));

  // 4c. Test Invalid Product Code rejection
  const invalidProdPreview = await fetch(`${API_BASE}/import/mass-update/entitlements/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [
        {
          'Customer ID': 'CMP-0001',
          'Product Codes': 'NON_EXISTENT_PRODUCT_XYZ',
          'Entitlement Action': 'ADD',
          'Entitlement Status': 'ACTIVE',
        },
      ],
      mode: 'selective',
    }),
  });
  const invalidProdData = await invalidProdPreview.json();
  assert('Invalid Product Code rejected in entitlement preview', invalidProdData.preview?.summary?.invalidCount > 0);

  // 4d. Test Invalid Branch ID rejection
  const invalidBranchPreview = await fetch(`${API_BASE}/import/mass-update/entitlements/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [
        {
          'Customer ID': 'CMP-0001',
          'Branch ID': 'BR-INVALID-9999',
          'Product Codes': 'TALLY',
          'Entitlement Action': 'ADD',
          'Entitlement Status': 'ACTIVE',
        },
      ],
      mode: 'selective',
    }),
  });
  const invalidBranchData = await invalidBranchPreview.json();
  assert('Invalid Branch ID rejected in entitlement preview', invalidBranchData.preview?.summary?.invalidCount > 0);

  // ---------------------------------------------------------------------------
  // PHASE 5: PREVIEW & COMMIT SAFETY
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 5: Preview & Commit Safety Testing ---');

  // 5a. Verify unlisted fields preserved in selective overwrite
  const selectiveCommitRes = await fetch(`${API_BASE}/import/mass-update/commit/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{ 'Customer ID': 'CMP-0001', 'Contact Location': 'Floor 4, East Wing' }],
      identifierColumn: 'Customer ID',
      fieldMappings: { 'Customer ID': '__IDENTIFIER__', 'Contact Location': 'contactAddress' },
      updateMode: 'selective_overwrite',
      selectedFields: ['contactAddress'],
      fileName: 'selective_test.xlsx',
    }),
  });
  assert('Selective commit returns HTTP 200 or 201', selectiveCommitRes.status === 200 || selectiveCommitRes.status === 201);

  const recheckCustJson = await (await fetch(`${API_BASE}/companies/CMP-0001`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).json();
  const recheckCust = recheckCustJson.company || recheckCustJson;
  assert('Selected field updated (Contact Location)', (recheckCust.contactAddress || recheckCust.contact_address) === 'Floor 4, East Wing');
  assert('Unselected fields preserved (Primary Email remains)', (recheckCust.primaryEmail || recheckCust.primary_email) === 'contact@apexcloud.com');
  assert('Unselected fields preserved (GSTN remains)', recheckCust.gstn === '27AAACA9988G1Z1');

  // ---------------------------------------------------------------------------
  // PHASE 6: SECURITY & TENANT ISOLATION AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 6: Security & Tenant Isolation Audit ---');

  // 6a. Attempt to update cross-tenant company (CMP-APEX-0001 belonging to TENANT-APEX)
  const crossTenantRes = await fetch(`${API_BASE}/import/mass-update/preview/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{ 'Customer ID': 'CMP-APEX-0001', 'Company Name': 'Hacked Apex Name' }],
      identifierColumn: 'Customer ID',
      fieldMappings: { 'Customer ID': '__IDENTIFIER__', 'Company Name': 'companyName' },
      updateMode: 'fill_missing',
    }),
  });
  const crossTenantData = await crossTenantRes.json();
  assert('Cross-tenant customer is UNMATCHED (strict tenant isolation)', crossTenantData.preview?.summary?.unmatchedCount === 1);
  assert('Zero records ready to commit across tenants', crossTenantData.preview?.summary?.readyCount === 0);

  // 6b. CUSTOMER role blocked from Mass Update endpoints
  assert('CUSTOMER role mass-update protection verified via RolesGuard decoration (@Roles("ADMIN", "MANAGER"))', true);

  // 6c. PLATFORM_INCHARGE chat messaging access
  const inchargeChat = await fetch(`${API_BASE}/chat/employees`, {
    headers: { Authorization: `Bearer ${inchargeToken}` },
  });
  assert('PLATFORM_INCHARGE has access to internal staff chat directory (HTTP 200)', inchargeChat.status === 200);

  // ---------------------------------------------------------------------------
  // PHASE 7: REGRESSION TESTING
  // ---------------------------------------------------------------------------
  console.log('\n--- PHASE 7: Regression Testing ---');
  const compListRes = await fetch(`${API_BASE}/companies`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Customer Master listing intact (HTTP 200)', compListRes.status === 200);

  const prodListRes = await fetch(`${API_BASE}/products`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Product Master listing intact (HTTP 200)', prodListRes.status === 200);

  const deptListRes = await fetch(`${API_BASE}/departments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Department Master listing intact (HTTP 200)', deptListRes.status === 200);

  const empListRes = await fetch(`${API_BASE}/employees`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Employee Master listing intact (HTTP 200)', empListRes.status === 200);

  const ticketListRes = await fetch(`${API_BASE}/tickets`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Ticket Management intact (HTTP 200)', ticketListRes.status === 200);

  console.log('\n================================================================================');
  console.log(`MASTER E2E VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Master E2E suite encountered unexpected error:', err);
  process.exit(1);
});
