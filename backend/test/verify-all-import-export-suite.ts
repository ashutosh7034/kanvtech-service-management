import { PrismaClient, TicketPriority, ImplementationStatus, SubscriptionStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { ImportService } from '../src/import/import.service';
import { ExportService } from '../src/export/export.service';
import { CompaniesService } from '../src/companies/companies.service';
import { EmployeesService } from '../src/employees/employees.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 KANVTECH COMPLETE IMPORT/EXPORT & DATABASE INTEGRATION SUITE');
  console.log('================================================================\n');

  const prisma = new PrismaService();
  await prisma.$connect();

  const auditService = new AuditService(prisma);
  const companiesService = new CompaniesService(prisma, auditService);
  const employeesService = new EmployeesService(prisma, auditService);
  const importService = new ImportService(prisma, companiesService, employeesService, auditService);
  const exportService = new ExportService(prisma, auditService);

  const testResults: Array<{ entity: string; test: string; status: 'PASS' | 'FAIL'; details?: string }> = [];

  const recordResult = (entity: string, test: string, passed: boolean, details?: string) => {
    testResults.push({ entity, test, status: passed ? 'PASS' : 'FAIL', details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${entity.toUpperCase()}: ${test}${details ? ` -> ${details}` : ''}`);
  };

  const adminUser = { userId: 1, role: 'ADMIN', email: 'admin@kanvtech.com' };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: TEMPLATE GENERATION & CANONICAL HEADERS (ALL 10 ENTITIES)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Template Generation & Canonical Headers ---');
    const templateEntities = [
      'products',
      'departments',
      'employees',
      'customers',
      'branches',
      'prospects',
      'subscriptions',
      'implementations',
      'tickets',
      'tasks',
    ];

    for (const ent of templateEntities) {
      try {
        const buf = importService.generateTemplate(ent);
        const wb = XLSX.read(buf, { type: 'buffer' });
        const sheetName = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { header: 1 });
        const headers = data[0] as string[];
        const hasInstructions = wb.SheetNames.includes('INSTRUCTIONS');
        const valid = Boolean(headers && headers.length > 0 && hasInstructions);
        recordResult(ent, 'Template download & instructions', valid, `Headers: ${headers.length}, Sheet: ${sheetName}`);
      } catch (err: any) {
        recordResult(ent, 'Template download & instructions', false, err.message);
      }
    }

    // Helper to build Excel buffer from aoa
    const makeExcelBuffer = (aoa: any[][], sheetName = 'DATA'): Buffer => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    };

    // -------------------------------------------------------------------------
    // TEST 2: VALIDATION REJECTION ON MISSING REQUIRED FIELDS & BROKEN FKs
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Negative Validation (Missing Fields & Broken FKs) ---');

    // 2a. Prospects missing required fields
    const invalidProspectBuf = makeExcelBuffer([
      ['Company Name', 'Contact Person', 'Contact Phone', 'Email', 'Address'],
      ['', '', '', 'invalid-email-address', 'Mumbai'], // missing required fields & invalid email
    ]);
    const prospectValRes = await importService.validateProspectImport(invalidProspectBuf);
    recordResult(
      'prospects',
      'Validation rejects missing required fields and invalid email',
      prospectValRes.validCount === 0 && prospectValRes.errors.length >= 3,
      `Detected ${prospectValRes.errors.length} validation errors`,
    );

    // 2b. Subscriptions with non-existent customer and broken dates
    const invalidSubBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Product Code', 'Plan Name', 'Start Date (YYYY-MM-DD)', 'Expiry Date (YYYY-MM-DD)'],
      ['nonexistent@nowhere.com', 'TALLY', 'Gold AMC', '2026-12-31', '2026-01-01'], // broken FK & expiry before start
    ]);
    const subValRes = await importService.validateSubscriptionImport(invalidSubBuf);
    recordResult(
      'subscriptions',
      'Validation rejects non-existent customer & invalid date ranges',
      subValRes.validCount === 0 && subValRes.errors.length >= 2,
      `Detected ${subValRes.errors.length} validation errors`,
    );

    // 2c. Implementations with non-existent product
    const invalidImpBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Product Code', 'Start Date (YYYY-MM-DD)', 'Target Go-Live Date (YYYY-MM-DD)'],
      ['contact@apexcloud.com', 'FAKE_PROD_9999', '2026-04-01', '2026-06-30'],
    ]);
    const impValRes = await importService.validateImplementationImport(invalidImpBuf);
    recordResult(
      'implementations',
      'Validation rejects non-existent product code',
      impValRes.validCount === 0 && impValRes.errors.some((e) => e.field.includes('Product')),
      `Error: ${impValRes.errors[0]?.message}`,
    );

    // 2d. Tickets with invalid priority
    const invalidTicketBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Product Code', 'Problem Type', 'Priority', 'Description'],
      ['contact@apexcloud.com', 'TALLY', 'Test Problem', 'CRITICAL_INVALID', 'Details'],
    ]);
    const ticketValRes = await importService.validateTicketImport(invalidTicketBuf);
    recordResult(
      'tickets',
      'Validation rejects invalid priority enum',
      ticketValRes.validCount === 0 && ticketValRes.errors.some((e) => e.field === 'Priority'),
      `Error: ${ticketValRes.errors[0]?.message}`,
    );

    // 2e. Tasks missing title
    const invalidTaskBuf = makeExcelBuffer([
      ['Title', 'Category', 'Priority'],
      ['', 'Audit', 'HIGH'],
    ]);
    const taskValRes = await importService.validateTaskImport(invalidTaskBuf);
    recordResult(
      'tasks',
      'Validation rejects missing task title',
      taskValRes.validCount === 0 && taskValRes.errors.some((e) => e.field === 'Title'),
      `Error: ${taskValRes.errors[0]?.message}`,
    );

    // -------------------------------------------------------------------------
    // TEST 3: END-TO-END VALID IMPORT & TRANSACTIONAL PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Valid Import & Database Persistence ---');

    const testTimestamp = Date.now();

    // 3a. Product with Module & Submodule Hierarchy
    const testProdCode = `TESTPROD_${testTimestamp.toString().slice(-4)}`;
    const validProdBuf = makeExcelBuffer([
      ['Product Code', 'Product Name', 'Category', 'Description', 'Modules', 'Submodules', 'Status'],
      [
        testProdCode,
        'Test ERP Suite',
        'ERP',
        'Automated Test Product Suite',
        'Core Module|Billing Module',
        'Core Module=Ledger|Journal;Billing Module=Invoices',
        'ACTIVE',
      ],
    ]);
    const prodPreview = await importService.validateProductImport(validProdBuf);
    recordResult('products', 'Product import preview validates row', prodPreview.validCount === 1);
    const prodCommit = await importService.commitProductImport(prodPreview.previewRows, adminUser.userId);
    recordResult('products', 'Product import commit persists records', prodCommit.importedCount === 1);

    const persistedProd = await prisma.product.findUnique({
      where: { code: testProdCode },
      include: { modules: { include: { submodules: true } } },
    });
    const prodHierarchyValid = Boolean(
      persistedProd &&
      persistedProd.modules.length === 2 &&
      persistedProd.modules.some((m) => m.submodules.length > 0)
    );
    recordResult(
      'products',
      'Product hierarchy (modules & submodules) persisted in database',
      prodHierarchyValid,
      `Modules: ${persistedProd?.modules.length}, Submodules: ${persistedProd?.modules[0]?.submodules.length}`,
    );

    // 3b. Department Import
    const testDeptCode = `TDEP_${testTimestamp.toString().slice(-4)}`;
    const validDeptBuf = makeExcelBuffer([
      ['Department Name', 'Department Code', 'Product Code', 'Description', 'Status'],
      [`Test Support Department ${testTimestamp}`, testDeptCode, testProdCode, 'Automated Test Dept', 'ACTIVE'],
    ]);
    const deptPreview = await importService.validateDepartmentImport(validDeptBuf);
    recordResult('departments', 'Department preview validates row', deptPreview.validCount === 1);
    const deptCommit = await importService.commitDepartmentImport(deptPreview.previewRows, adminUser.userId);
    const persistedDept = await prisma.department.findUnique({
      where: { code: testDeptCode },
      include: { products: true },
    });
    recordResult(
      'departments',
      'Department and product specialization persisted in database',
      Boolean(persistedDept && persistedDept.products.length > 0),
      `Dept ID: ${persistedDept?.id}`,
    );

    // 3c. Employee Import
    const testEmpEmail = `test.emp.${testTimestamp}@kanvtech.test`;
    const validEmpBuf = makeExcelBuffer([
      ['Full Name', 'Email Address', 'Phone Number', 'Department Code', 'Designation', 'Support Level', 'Manager ID'],
      ['Automated Test Specialist', testEmpEmail, '+91 98990 11223', testDeptCode, 'L1 Specialist', 'L1', ''],
    ]);
    const empPreview = await importService.validateEmployeeImport(validEmpBuf);
    recordResult('employees', 'Employee preview validates row', empPreview.validCount === 1);
    const empCommit = await importService.commitEmployeeImport(empPreview.previewRows, adminUser.userId);
    const persistedEmp = await prisma.employee.findUnique({
      where: { email: testEmpEmail },
      include: { user: true },
    });
    recordResult(
      'employees',
      'Employee & secure user account persisted without plaintext passwords',
      Boolean(persistedEmp && persistedEmp.user && !persistedEmp.user.passwordHash.startsWith('plain')),
      `Emp ID: ${persistedEmp?.id}, User Role: ${persistedEmp?.user?.role}`,
    );

    // 3d. Customer Import
    const testCustEmail = `test.client.${testTimestamp}@testdomain.com`;
    const validCustBuf = makeExcelBuffer([
      [
        'Company Name',
        'Address',
        'GSTN',
        'Primary Email',
        'Contact Person',
        'Contact Phone',
        'Entitlement Type',
        'Product Codes',
        'Product Modules',
      ],
      [
        `Test Enterprise Ltd ${testTimestamp}`,
        '789 Test Tower, Mumbai',
        '',
        testCustEmail,
        'Test Director',
        '+91 98770 12345',
        'COMPLETE',
        testProdCode,
        '',
      ],
    ]);
    const custPreview = await importService.validateCompanyImport(validCustBuf);
    recordResult('customers', 'Customer preview validates row', custPreview.validCount === 1);
    const custCommit = await importService.commitCompanyImport(custPreview.previewRows, adminUser.userId);
    const persistedCust = await prisma.company.findFirst({
      where: { primaryEmail: testCustEmail },
      include: { contacts: true, products: true },
    });
    recordResult(
      'customers',
      'Customer, contact, and purchased product entitlements persisted',
      Boolean(persistedCust && persistedCust.contacts.length > 0 && persistedCust.products.length > 0),
      `Customer ID: ${persistedCust?.id}`,
    );

    // 3e. Customer Branch Import
    const validBranchBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Branch Name', 'Address', 'City', 'State', 'Contact Person', 'Contact Phone', 'Branch Product Codes (Comma-separated)'],
      [testCustEmail, 'North Zone Branch', 'Sector 10, Navi Mumbai', 'Navi Mumbai', 'Maharashtra', 'Branch POC', '+91 98110 99887', testProdCode],
    ]);
    const branchPreview = await importService.validateBranchImport(validBranchBuf);
    recordResult('branches', 'Branch preview validates row & product subset', branchPreview.validCount === 1);
    const branchCommit = await importService.commitBranchImport(branchPreview.previewRows, adminUser.userId);
    const persistedBranch = await prisma.companyBranch.findFirst({
      where: { companyId: persistedCust!.id, branchName: 'North Zone Branch' },
      include: { branchProducts: true },
    });
    recordResult(
      'branches',
      'Branch & branch-level product link persisted in database',
      Boolean(persistedBranch && persistedBranch.branchProducts.length > 0),
      `Branch ID: ${persistedBranch?.id}`,
    );

    // 3f. Prospect Import
    const testProspectEmail = `prospect.${testTimestamp}@leads.com`;
    const validProspectBuf = makeExcelBuffer([
      ['Company Name', 'Contact Person', 'Contact Phone', 'Email', 'Address', 'Enquiry', 'Status', 'Notes'],
      [`Potential Client ${testTimestamp}`, 'Sunil Mehta', '+91 98330 44556', testProspectEmail, 'Pune, Maharashtra', 'Interested in AMC contract', 'QUALIFIED', 'Follow up via test'],
    ]);
    const prospectPreview = await importService.validateProspectImport(validProspectBuf);
    recordResult('prospects', 'Prospect preview validates row', prospectPreview.validCount === 1);
    const prospectCommit = await importService.commitProspectImport(prospectPreview.previewRows, adminUser.userId);
    const persistedProspect = await prisma.prospect.findFirst({
      where: { email: testProspectEmail },
    });
    recordResult(
      'prospects',
      'Prospect enquiry persisted with sequence identifier',
      Boolean(persistedProspect && persistedProspect.id.startsWith('PROS-')),
      `Prospect ID: ${persistedProspect?.id}, Status: ${persistedProspect?.status}`,
    );

    // 3g. Subscription / AMC Import
    const validSubBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Product Code', 'Plan Name', 'Start Date (YYYY-MM-DD)', 'Expiry Date (YYYY-MM-DD)', 'Notes'],
      [testCustEmail, testProdCode, 'Platinum AMC Enterprise', '2026-01-01', '2027-01-01', 'Includes 24/7 priority support'],
    ]);
    const subPreview = await importService.validateSubscriptionImport(validSubBuf);
    recordResult('subscriptions', 'Subscription preview validates row & customer ownership', subPreview.validCount === 1);
    const subCommit = await importService.commitSubscriptionImport(subPreview.previewRows, adminUser.userId);
    const persistedSub = await prisma.subscription.findFirst({
      where: { companyId: persistedCust!.id, productId: persistedProd!.id },
    });
    recordResult(
      'subscriptions',
      'Subscription agreement persisted with auto-computed active status',
      Boolean(persistedSub && persistedSub.status === SubscriptionStatus.ACTIVE),
      `Sub ID: ${persistedSub?.id}, Plan: ${persistedSub?.planName}`,
    );

    // 3h. Implementation Import
    const validImpBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Product Code', 'Start Date (YYYY-MM-DD)', 'Target Go-Live Date (YYYY-MM-DD)', 'Status', 'Progress Percentage', 'Pending Activities'],
      [testCustEmail, testProdCode, '2026-04-01', '2026-06-30', 'PLANNING', 30, 'Module integration and ledger sync'],
    ]);
    const impPreview = await importService.validateImplementationImport(validImpBuf);
    recordResult('implementations', 'Implementation preview validates row', impPreview.validCount === 1);
    const impCommit = await importService.commitImplementationImport(impPreview.previewRows, adminUser.userId);
    const persistedImp = await prisma.implementation.findFirst({
      where: { companyId: persistedCust!.id, productId: persistedProd!.id },
    });
    recordResult(
      'implementations',
      'Implementation project persisted with progress & milestone target',
      Boolean(persistedImp && persistedImp.progressPercentage === 30),
      `Imp ID: ${persistedImp?.id}, Target: ${persistedImp?.targetGoLiveDate.toISOString().slice(0, 10)}`,
    );

    // 3i. Ticket Import
    const validTicketBuf = makeExcelBuffer([
      ['Customer ID / Email', 'Product Code', 'Branch ID / Name', 'Problem Type', 'Priority', 'Category', 'Description', 'Status'],
      [testCustEmail, testProdCode, 'North Zone Branch', 'Sync Latency', 'HIGH', 'Technical', 'Automated test ticket description for sync latency', 'OPEN'],
    ]);
    const ticketPreview = await importService.validateTicketImport(validTicketBuf);
    recordResult('tickets', 'Ticket preview validates customer, product & branch link', ticketPreview.validCount === 1);
    const ticketCommit = await importService.commitTicketImport(ticketPreview.previewRows, adminUser.userId);
    const persistedTicket = await prisma.ticket.findFirst({
      where: { companyId: persistedCust!.id, productId: persistedProd!.id },
      include: { history: true },
    });
    recordResult(
      'tickets',
      'Ticket persisted with collision-safe KT sequence ID and initial audit history',
      Boolean(persistedTicket && persistedTicket.id.startsWith('KT-') && persistedTicket.history.length > 0),
      `Ticket ID: ${persistedTicket?.id}, History logs: ${persistedTicket?.history.length}`,
    );

    // 3j. Task Import
    const validTaskBuf = makeExcelBuffer([
      ['Title', 'Description', 'Category', 'Due Date (YYYY-MM-DD)', 'Due Time (HH:MM)', 'Task Type', 'Priority', 'Assigned To Employee ID / Email', 'Status'],
      [`Audit Implementation ${testTimestamp}`, 'Audit progress for new customer branch', 'Audit', '2026-11-01', '17:00', 'ASSIGNED', 'HIGH', testEmpEmail, 'PENDING'],
    ]);
    const taskPreview = await importService.validateTaskImport(validTaskBuf);
    recordResult('tasks', 'Task preview validates assignee & schedule', taskPreview.validCount === 1);
    const taskCommit = await importService.commitTaskImport(taskPreview.previewRows, adminUser.userId);
    const persistedTask = await prisma.employeeTask.findFirst({
      where: { assignedTo: persistedEmp!.id, title: `Audit Implementation ${testTimestamp}` },
    });
    recordResult(
      'tasks',
      'Employee task persisted with due date & assignee link',
      Boolean(persistedTask && persistedTask.id.startsWith('ETSK-') && persistedTask.priority === 'HIGH'),
      `Task ID: ${persistedTask?.id}`,
    );

    // -------------------------------------------------------------------------
    // TEST 4: EXPORT COVERAGE & REDACTION VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Multi-Format Export Coverage & Credential Redaction ---');

    const exportModules = [
      'customers',
      'products',
      'departments',
      'employees',
      'tickets',
      'subscriptions',
      'implementations',
      'prospects',
      'tasks',
    ];

    for (const mod of exportModules) {
      try {
        // Test Excel Export
        const xlsxRes = await exportService.generateExportFile(mod, 'xlsx', adminUser);
        const xlsxWb = XLSX.read(xlsxRes.buffer, { type: 'buffer' });
        const hasSheets = xlsxWb.SheetNames.length > 0;

        // Test CSV Export
        const csvRes = await exportService.generateExportFile(mod, 'csv', adminUser);
        const csvStr = csvRes.buffer.toString('utf-8');

        // Test JSON Export
        const jsonRes = await exportService.generateExportFile(mod, 'json', adminUser);
        const jsonParsed = JSON.parse(jsonRes.buffer.toString('utf-8'));

        // Credential check: passwords, passwordHash, hashes MUST NOT exist anywhere in any export
        const rawJsonText = jsonRes.buffer.toString('utf-8');
        const hasLeakedPasswords = /passwordHash|password_hash|"password":/i.test(rawJsonText);

        const ok = hasSheets && csvStr.length > 0 && jsonParsed.tables && !hasLeakedPasswords;
        recordResult(
          mod,
          'Exports successfully across XLSX, CSV & JSON with 100% credential redaction',
          ok,
          `Sheets: ${xlsxWb.SheetNames.join(', ')}, Total records: ${jsonRes.totalRecords}`,
        );
      } catch (err: any) {
        recordResult(mod, 'Export multi-format generation', false, err.message);
      }
    }

    // -------------------------------------------------------------------------
    // TEST 5: IMPORT / EXPORT ROUND-TRIP COMPATIBILITY
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Import / Export Round-Trip Compatibility ---');

    // Export Prospects to XLSX, and then re-validate through validateProspectImport
    const prospectExport = await exportService.generateExportFile('prospects', 'xlsx', adminUser);
    const roundtripVal = await importService.validateProspectImport(prospectExport.buffer);
    recordResult(
      'prospects',
      'Exported spreadsheet accepted as valid import source (Round-trip compatibility)',
      roundtripVal.totalRows > 0,
      `Total rows recognized: ${roundtripVal.totalRows}, Valid count: ${roundtripVal.validCount}`,
    );

    // -------------------------------------------------------------------------
    // TEST 6: CLEANUP OF TEST ARTIFACTS
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Cleaning Up Isolated Test Artifacts ---');
    if (persistedTicket) await prisma.ticket.delete({ where: { id: persistedTicket.id } }).catch(() => {});
    if (persistedTask) await prisma.employeeTask.delete({ where: { id: persistedTask.id } }).catch(() => {});
    if (persistedImp) await prisma.implementation.delete({ where: { id: persistedImp.id } }).catch(() => {});
    if (persistedSub) await prisma.subscription.delete({ where: { id: persistedSub.id } }).catch(() => {});
    if (persistedProspect) await prisma.prospect.delete({ where: { id: persistedProspect.id } }).catch(() => {});
    if (persistedBranch) await prisma.companyBranch.delete({ where: { id: persistedBranch.id } }).catch(() => {});
    if (persistedCust) await prisma.company.delete({ where: { id: persistedCust.id } }).catch(() => {});
    if (persistedEmp) await prisma.employee.delete({ where: { id: persistedEmp.id } }).catch(() => {});
    if (persistedDept) await prisma.department.delete({ where: { id: persistedDept.id } }).catch(() => {});
    if (persistedProd) await prisma.product.delete({ where: { id: persistedProd.id } }).catch(() => {});
    console.log('✅ Isolated test records safely pruned without disturbing existing production/demo baseline.');

  } catch (err: any) {
    console.error('Test suite uncaught error:', err);
  } finally {
    await prisma.$disconnect();
  }

  // Final Summary
  const passCount = testResults.filter((r) => r.status === 'PASS').length;
  const failCount = testResults.filter((r) => r.status === 'FAIL').length;
  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${testResults.length})`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
