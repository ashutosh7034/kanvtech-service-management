import assert from 'assert';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { MassUpdateService } from '../src/import/mass-update.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`[TEST] ${name} ... `);
    await fn();
    console.log('PASSED \u2714');
    passed++;
  } catch (err: any) {
    console.log('FAILED \u2718');
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  console.log('===============================================================');
  console.log('KANVTECH SERVICE MANAGEMENT — MASS UPDATE & DATA COMPLETION SUITE');
  console.log('Testing Mode A (Fill Missing), Mode B (Selective Overwrite), Safety & Auditing');
  console.log('===============================================================\n');

  const prisma = new PrismaClient();
  const prismaService = prisma as unknown as PrismaService;
  const auditService = new AuditService(prismaService);
  const massUpdateService = new MassUpdateService(prismaService, auditService);

  const testTenantId = 'KANVTECH';

  // Test 1: File Parsing Excel
  await test('1. Parse valid Excel workbook and extract columns and rows', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Employee ID', 'Full Name', 'Phone Number', 'Designation'],
      ['EMP-991', 'Test Candidate', '9876543210', 'Senior Lead'],
      ['EMP-992', 'Second Candidate', '9876500000', 'Specialist'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = massUpdateService.parseUploadedFile(buffer, 'test.xlsx');
    assert.strictEqual(parsed.totalRows, 2);
    assert(parsed.columns.includes('Employee ID'));
    assert(parsed.columns.includes('Full Name'));
    assert.strictEqual(parsed.sampleRows.length, 2);
    assert.strictEqual(parsed.rawRows[0]['Employee ID'], 'EMP-991');
  });

  // Test 2: File Parsing CSV
  await test('2. Parse valid CSV document', async () => {
    const csvContent = 'Employee ID,Full Name,Phone Number\nEMP-991,Test CSV,9876543210\n';
    const buffer = Buffer.from(csvContent, 'utf-8');

    const parsed = massUpdateService.parseUploadedFile(buffer, 'test.csv');
    assert.strictEqual(parsed.totalRows, 1);
    assert(parsed.columns.includes('Employee ID'));
    assert.strictEqual(parsed.rawRows[0]['Employee ID'], 'EMP-991');
  });

  // Test 3: Reject empty file
  await test('3. Reject empty files gracefully', async () => {
    let threw = false;
    try {
      massUpdateService.parseUploadedFile(Buffer.alloc(0), 'empty.xlsx');
    } catch {
      threw = true;
    }
    assert(threw, 'Should throw on empty buffer');
  });

  // Test 4: Template generation
  await test('4. Generate valid template buffer with instructions', async () => {
    const buf = massUpdateService.generateUpdateTemplate('employees');
    assert(buf instanceof Buffer);
    assert(buf.length > 100);

    const wb = XLSX.read(buf, { type: 'buffer' });
    assert(wb.SheetNames.includes('Employees Update'));
    assert(wb.SheetNames.includes('Instructions'));
  });

  // Test 5: Mode A: Fill Missing Fields Only
  const testEmpId = `EMP-TEST-${Date.now()}`;
  const testEmail = `massupdate.modea.${Date.now()}@kanvtech.com`;

  await test('5. Mode A: Preview preserves existing populated fields and populates missing fields', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'dummy-hash',
        role: 'L1_EMPLOYEE',
        defaultTenantId: testTenantId,
      },
    });

    await prisma.employee.create({
      data: {
        id: testEmpId,
        userId: user.id,
        name: 'Original Rahul',
        email: testEmail,
        phone: '9876543210', // Populated
        alternatePhones: null, // Missing / null
        designation: '', // Blank
        department: 'Support',
        level: 'L1',
        status: 'ACTIVE',
        tenantId: testTenantId,
      },
    });

    const rows = [
      {
        'Employee ID': testEmpId,
        'Phone Number': '9999999999', // Different from DB, should be SKIPPED because DB has 9876543210
        'Alternate Phone(s)': '9876500000', // Empty in DB, should WILL_UPDATE
        'Designation': 'Promoted Lead', // Empty in DB, should WILL_UPDATE
      },
    ];

    const preview = await massUpdateService.previewMassUpdate(
      'employees',
      {
        rows,
        identifierColumn: 'Employee ID',
        fieldMappings: {
          'Employee ID': '__IDENTIFIER__',
          'Phone Number': 'phone',
          'Alternate Phone(s)': 'alternatePhones',
          'Designation': 'designation',
        },
        updateMode: 'fill_missing',
      },
      testTenantId,
    );

    assert.strictEqual(preview.summary.matchedCount, 1);
    assert.strictEqual(preview.summary.readyCount, 1);

    const rowChanges = preview.rows[0].changes;

    // Phone must be SKIPPED_EXISTING
    const phoneChange = rowChanges.find((c) => c.field === 'phone');
    assert(phoneChange);
    assert.strictEqual(phoneChange.status, 'SKIPPED_EXISTING');
    assert.strictEqual(phoneChange.proposedValue, '9876543210'); // Keeps original DB value!

    // Alternate phone must be WILL_UPDATE
    const altPhoneChange = rowChanges.find((c) => c.field === 'alternatePhones');
    assert(altPhoneChange);
    assert.strictEqual(altPhoneChange.status, 'WILL_UPDATE');
    assert.strictEqual(altPhoneChange.proposedValue, '9876500000');

    // Designation must be WILL_UPDATE
    const desigChange = rowChanges.find((c) => c.field === 'designation');
    assert(desigChange);
    assert.strictEqual(desigChange.status, 'WILL_UPDATE');
    assert.strictEqual(desigChange.proposedValue, 'Promoted Lead');
  });

  // Test 6: Mode A commit
  await test('6. Mode A: Commit updates to DB and verify non-empty fields were untouched', async () => {
    const rows = [
      {
        'Employee ID': testEmpId,
        'Phone Number': '9999999999',
        'Alternate Phone(s)': '9876500000',
        'Designation': 'Promoted Lead',
      },
    ];

    const commitRes = await massUpdateService.commitMassUpdate(
      'employees',
      {
        rows,
        identifierColumn: 'Employee ID',
        fieldMappings: {
          'Employee ID': '__IDENTIFIER__',
          'Phone Number': 'phone',
          'Alternate Phone(s)': 'alternatePhones',
          'Designation': 'designation',
        },
        updateMode: 'fill_missing',
        selectedFields: [],
      },
        null,
        testTenantId,
    );

    assert.strictEqual(commitRes.updatedCount, 1);
    assert(commitRes.operationId.startsWith('MUP-'));

    // Verify in Database
    const updated = await prisma.employee.findUnique({ where: { id: testEmpId } });
    assert.strictEqual(updated?.phone, '9876543210'); // Populated value preserved!
    assert.strictEqual(updated?.alternatePhones, '9876500000'); // Missing filled!
    assert.strictEqual(updated?.designation, 'Promoted Lead'); // Missing filled!
  });

  // Cleanup Mode A
  await prisma.employee.deleteMany({ where: { id: testEmpId } });
  await prisma.user.deleteMany({ where: { email: testEmail } });

  // Test 7: Mode B: Selective Overwrite
  const testEmpIdB = `EMP-MODEB-${Date.now()}`;
  const testEmailB = `massupdate.modeb.${Date.now()}@kanvtech.com`;

  await test('7. Mode B: Update ONLY selected fields and preserve unselected fields', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmailB,
        passwordHash: 'dummy-hash',
        role: 'L1_EMPLOYEE',
        defaultTenantId: testTenantId,
      },
    });

    await prisma.employee.create({
      data: {
        id: testEmpIdB,
        userId: user.id,
        name: 'Original Name',
        email: testEmailB,
        phone: '9876543210',
        department: 'Support',
        designation: 'Engineer',
        level: 'L1',
        status: 'ACTIVE',
        tenantId: testTenantId,
      },
    });

    const rows = [
      {
        'Employee ID': testEmpIdB,
        'Full Name': 'Updated Name',
        'Phone Number': '9111111111',
        'Designation': 'Principal Architect',
      },
    ];

    // Only 'designation' is selected for update. 'name' and 'phone' are NOT selected.
    const commitRes = await massUpdateService.commitMassUpdate(
      'employees',
      {
        rows,
        identifierColumn: 'Employee ID',
        fieldMappings: {
          'Employee ID': '__IDENTIFIER__',
          'Full Name': 'name',
          'Phone Number': 'phone',
          'Designation': 'designation',
        },
        updateMode: 'selective_overwrite',
        selectedFields: ['designation'], // Only designation selected!
      },
        null,
        testTenantId,
    );

    assert.strictEqual(commitRes.updatedCount, 1);

    const dbEmp = await prisma.employee.findUnique({ where: { id: testEmpIdB } });
    assert.strictEqual(dbEmp?.designation, 'Principal Architect'); // Overwritten!
    assert.strictEqual(dbEmp?.name, 'Original Name'); // Unselected -> Preserved!
    assert.strictEqual(dbEmp?.phone, '9876543210'); // Unselected -> Preserved!
  });

  // Cleanup Mode B
  await prisma.employee.deleteMany({ where: { id: testEmpIdB } });
  await prisma.user.deleteMany({ where: { email: testEmailB } });

  // Test 8: Duplicate Identifier Detection
  await test('8. Duplicate identifier in upload file is flagged and skipped', async () => {
    const rows = [
      { 'Employee ID': 'EMP-001', 'Designation': 'Lead 1' },
      { 'Employee ID': 'EMP-001', 'Designation': 'Lead 2' }, // Duplicate!
    ];

    const preview = await massUpdateService.previewMassUpdate(
      'employees',
      {
        rows,
        identifierColumn: 'Employee ID',
        fieldMappings: { 'Employee ID': '__IDENTIFIER__', 'Designation': 'designation' },
        updateMode: 'fill_missing',
      },
      testTenantId,
    );

    assert.strictEqual(preview.summary.duplicateCount, 1);
    assert.strictEqual(preview.rows[1].matchStatus, 'DUPLICATE');
    assert(preview.rows[1].errors[0].includes('Duplicate identifier'));
  });

  // Test 9: Unmatched records detection and NEVER create records
  await test('9. Unmatched records are flagged and NEVER inserted into database', async () => {
    const nonExistentId = 'EMP-DOES-NOT-EXIST-999999';
    const rows = [{ 'Employee ID': nonExistentId, 'Designation': 'Ghost Lead' }];

    const initialCount = await prisma.employee.count();

    const preview = await massUpdateService.previewMassUpdate(
      'employees',
      {
        rows,
        identifierColumn: 'Employee ID',
        fieldMappings: { 'Employee ID': '__IDENTIFIER__', 'Designation': 'designation' },
        updateMode: 'fill_missing',
      },
      testTenantId,
    );

    assert.strictEqual(preview.summary.unmatchedCount, 1);
    assert.strictEqual(preview.summary.readyCount, 0);
    assert.strictEqual(preview.rows[0].matchStatus, 'UNMATCHED');

    let threw = false;
    try {
      await massUpdateService.commitMassUpdate(
        'employees',
        {
          rows,
          identifierColumn: 'Employee ID',
          fieldMappings: { 'Employee ID': '__IDENTIFIER__', 'Designation': 'designation' },
          updateMode: 'fill_missing',
          selectedFields: [],
        },
        null,
        testTenantId,
      );
    } catch {
      threw = true;
    }
    assert(threw, 'Should throw when no valid records to commit');

    const finalCount = await prisma.employee.count();
    assert.strictEqual(finalCount, initialCount, 'Database count must remain identical');
  });

  // Test 10: Tenant isolation
  await test('10. Enforce tenant isolation and reject cross-tenant updates', async () => {
    const rows = [{ 'Employee ID': 'EMP-001', 'Designation': 'Cross Tenant' }];

    const preview = await massUpdateService.previewMassUpdate(
      'employees',
      {
        rows,
        identifierColumn: 'Employee ID',
        fieldMappings: { 'Employee ID': '__IDENTIFIER__', 'Designation': 'designation' },
        updateMode: 'fill_missing',
      },
      'NON-EXISTENT-TENANT',
    );

    assert.strictEqual(preview.summary.matchedCount, 0);
    assert.strictEqual(preview.summary.unmatchedCount, 1);
  });

  // Test 11: Validation rules
  await test('11. Validate email and phone formatting errors', async () => {
    const rows = [
      {
        'Customer ID': 'CMP-0001',
        'Primary Email': 'invalid-email-address',
        'Primary Contact Phone': '12', // Too short
      },
    ];

    const preview = await massUpdateService.previewMassUpdate(
      'customers',
      {
        rows,
        identifierColumn: 'Customer ID',
        fieldMappings: {
          'Customer ID': '__IDENTIFIER__',
          'Primary Email': 'primaryEmail',
          'Primary Contact Phone': 'contactPhone',
        },
        updateMode: 'selective_overwrite',
        selectedFields: ['primaryEmail', 'contactPhone'],
      },
      testTenantId,
    );

    assert.strictEqual(preview.summary.invalidCount, 1);
    assert(preview.validationErrors.some((e) => e.message.includes('email')));
    assert(preview.validationErrors.some((e) => e.message.includes('phone')));
  });

  // Test 12: Audit history and Result Report
  await test('12. Audit history recorded and downloadable Excel result report generated', async () => {
    const history = await massUpdateService.getMassUpdateHistory(testTenantId);
    assert(Array.isArray(history));

    const { buffer, fileName } = massUpdateService.generateResultReport('DUMMY-OP-123');
    assert(buffer instanceof Buffer);
    assert(fileName.endsWith('.xlsx'));

    const wb = XLSX.read(buffer, { type: 'buffer' });
    assert(wb.SheetNames.includes('Mass Update Results'));
  });

  await prisma.$disconnect();

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
