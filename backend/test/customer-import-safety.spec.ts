import assert from 'assert';
import * as XLSX from 'xlsx';
import { ImportService } from '../src/import/import.service';

async function runCustomerImportSafetyTests() {
  console.log('========================================================================');
  console.log('KANVTECH — CUSTOMER IMPORT SAFETY & RESILIENCY UNIT TEST SUITE');
  console.log('Environment: Isolated In-Memory Mock (Zero Database Writes)');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      process.stdout.write(`[TEST] ${name} ... `);
      await fn();
      console.log('PASSED \u2714');
      passed++;
    } catch (err: any) {
      console.log('FAILED \u2718');
      console.error(`       Error: ${err.message}`);
      if (err.stack) console.error(`       Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
      failed++;
    }
  };

  // Mock Prisma and Services (100% In-Memory, NO database connection)
  const mockExistingCompanies = [
    { companyName: 'Existing Corp', primaryEmail: 'existing@corp.com', gstn: '27AAACA1234A1Z1' },
  ];

  const mockPrisma: any = {
    company: {
      findMany: async () => mockExistingCompanies,
    },
    product: {
      findMany: async () => [
        {
          id: 'PROD-0001',
          code: 'TALLY',
          name: 'Tally Prime ERP',
          isActive: true,
          modules: [
            {
              id: 'MOD-0001',
              name: 'Accounting',
              isActive: true,
              submodules: [{ id: 'SUB-0001', name: 'Ledger', isActive: true }],
            },
          ],
        },
      ],
    },
  };

  const mockCompaniesService: any = {
    createCompany: async (row: any) => {
      if (row.company_name === 'Faulty DB Row') {
        throw new Error('Simulated unique constraint or database write error');
      }
      return 'CMP-TEST';
    },
  };

  const mockEmployeesService: any = {};
  const mockAuditService: any = {};

  const importService = new ImportService(
    mockPrisma,
    mockCompaniesService,
    mockEmployeesService,
    mockAuditService,
  );

  // Helper to build a multi-sheet Excel buffer
  const buildWorkbookBuffer = (sheets: Record<string, any[][]>): Buffer => {
    const wb = XLSX.utils.book_new();
    for (const [sheetName, aoa] of Object.entries(sheets)) {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  const headers = [
    'Company Name',
    'Address',
    'Primary Email',
    'Contact Person',
    'Contact Phone',
    'GSTN',
    'Entitlement Type',
    'Product Codes',
  ];

  // TEST 1: Validate sheet selection (CUSTOMERS sheet when INSTRUCTIONS is sheet 0)
  await test('1. Correctly selects CUSTOMERS worksheet even when INSTRUCTIONS is sheet 0', async () => {
    const wbBuf = buildWorkbookBuffer({
      INSTRUCTIONS: [
        ['Help Text', 'Do not import this sheet'],
        ['Rule 1', 'Fill company name'],
      ],
      CUSTOMERS: [
        headers,
        ['Alpha Corp', '123 Main St, Mumbai', 'alpha@corp.com', 'Rajesh K', '+91 98000 11111', '', 'COMPLETE', 'TALLY'],
      ],
    });

    const preview = await importService.validateCompanyImport(wbBuf);
    assert.strictEqual(preview.totalRows, 1, `Expected 1 total row, got ${preview.totalRows}`);
    assert.strictEqual(preview.validCount, 1, `Expected 1 valid row, got ${preview.validCount}`);
    assert.strictEqual(preview.previewRows[0].company_name, 'Alpha Corp');
  });

  // TEST 2: Handles >10 valid customer rows and returns all in validRows while previewRows has 10
  await test('2. Returns all valid rows (>10) in validRows while capping previewRows to 10', async () => {
    const rows: any[][] = [headers];
    for (let i = 1; i <= 25; i++) {
      rows.push([
        `Customer Entity ${i}`,
        `Industrial Estate Road ${i}, Pune`,
        `contact${i}@entity${i}.com`,
        `Manager ${i}`,
        `+91 98000 ${String(10000 + i).slice(1)}`,
        '',
        'COMPLETE',
        'TALLY',
      ]);
    }

    const wbBuf = buildWorkbookBuffer({ CUSTOMERS: rows });
    const preview = await importService.validateCompanyImport(wbBuf);

    assert.strictEqual(preview.totalRows, 25, `Expected totalRows 25, got ${preview.totalRows}`);
    assert.strictEqual(preview.validCount, 25, `Expected validCount 25, got ${preview.validCount}`);
    assert.strictEqual(preview.previewRows.length, 10, `Expected previewRows length 10, got ${preview.previewRows.length}`);
    assert(Array.isArray(preview.validRows), 'Expected validRows array to be returned');
    assert.strictEqual(preview.validRows!.length, 25, `Expected validRows length 25, got ${preview.validRows!.length}`);
    assert.strictEqual(preview.invalidCount, 0, 'Expected 0 invalid rows');
    assert.strictEqual(preview.duplicateCount, 0, 'Expected 0 duplicates');
  });

  // TEST 3: Blank rows interspersed between populated rows are skipped cleanly
  await test('3. Blank rows between populated rows are cleanly skipped without false validation errors', async () => {
    const rows: any[][] = [
      headers,
      ['Beta Industries', 'Plot 10, Nashik', 'beta@ind.com', 'Sunil V', '+91 98111 22222', '', 'COMPLETE', 'TALLY'],
      ['', '', '', '', '', '', '', ''], // Completely blank row 1
      ['Gamma Enterprises', 'Plot 12, Thane', 'gamma@ent.com', 'Pooja M', '+91 98222 33333', '', 'COMPLETE', 'TALLY'],
      [null, null, undefined, '', '   ', null, '', ''], // Completely blank row 2
      ['Delta Logistics', 'Sector 5, Navi Mumbai', 'delta@log.com', 'Vikram S', '+91 98333 44444', '', 'COMPLETE', 'TALLY'],
    ];

    const wbBuf = buildWorkbookBuffer({ CUSTOMERS: rows });
    const preview = await importService.validateCompanyImport(wbBuf);

    assert.strictEqual(preview.totalRows, 3, `Expected totalRows 3 (ignoring 2 blank rows), got ${preview.totalRows}`);
    assert.strictEqual(preview.validCount, 3, `Expected validCount 3, got ${preview.validCount}`);
    assert.strictEqual(preview.invalidCount, 0, `Expected invalidCount 0, got ${preview.invalidCount}`);
    assert.strictEqual(preview.errors.length, 0, `Expected 0 errors, got ${preview.errors.length}`);
  });

  // TEST 4: Duplicate company name detection (within spreadsheet and against DB)
  await test('4. Detects duplicate company names within spreadsheet and against DB with exact messages', async () => {
    const rows: any[][] = [
      headers,
      ['Duplicate Corp', 'Address 1, Mumbai', 'dup1@corp.com', 'Contact 1', '+91 98111 11111', '', 'COMPLETE', 'TALLY'],
      ['Duplicate Corp', 'Address 2, Mumbai', 'dup2@corp.com', 'Contact 2', '+91 98222 22222', '', 'COMPLETE', 'TALLY'], // duplicate in file
      ['Existing Corp', 'Address 3, Delhi', 'newemail@corp.com', 'Contact 3', '+91 98333 33333', '', 'COMPLETE', 'TALLY'], // matches DB companyName
      ['Unique Tech', 'Address 4, Bangalore', 'unique@tech.com', 'Contact 4', '+91 98444 44444', '', 'COMPLETE', 'TALLY'], // valid
    ];

    const wbBuf = buildWorkbookBuffer({ CUSTOMERS: rows });
    const preview = await importService.validateCompanyImport(wbBuf);

    assert.strictEqual(preview.totalRows, 4, `Expected totalRows 4, got ${preview.totalRows}`);
    assert.strictEqual(preview.validCount, 2, `Expected validCount 2, got ${preview.validCount}`);
    assert.strictEqual(preview.duplicateCount, 2, `Expected duplicateCount 2, got ${preview.duplicateCount}`);
    assert.strictEqual(preview.invalidCount, 2, `Expected invalidCount 2, got ${preview.invalidCount}`);

    const dupFileErr = preview.errors.find((e) => e.rowNumber === 3 && e.field === 'Company Name');
    assert(dupFileErr, 'Expected duplicate error for row 3');
    assert(dupFileErr.message.includes('Duplicate company name'), `Unexpected message: ${dupFileErr.message}`);

    const dupDbErr = preview.errors.find((e) => e.rowNumber === 4 && e.field === 'Company Name');
    assert(dupDbErr, 'Expected duplicate error for row 4');
    assert(dupDbErr.message.includes('Duplicate company name'), `Unexpected message: ${dupDbErr.message}`);
  });

  // TEST 5: Negative validation (missing required fields, invalid email format)
  await test('5. Rejects rows with missing required fields or invalid email with exact row numbers', async () => {
    const rows: any[][] = [
      headers,
      ['', 'Address 1', 'valid@email.com', 'Person 1', '+91 98000 00001', '', 'COMPLETE', 'TALLY'], // Missing Company Name (row 2)
      ['Company B', '', 'b@email.com', 'Person 2', '+91 98000 00002', '', 'COMPLETE', 'TALLY'], // Missing Address (row 3)
      ['Company C', 'Address 3', 'not-an-email', 'Person 3', '+91 98000 00003', '', 'COMPLETE', 'TALLY'], // Invalid Email (row 4)
      ['Company D', 'Address 4', 'd@email.com', '', '+91 98000 00004', '', 'COMPLETE', 'TALLY'], // Missing Contact Person (row 5)
      ['Company E', 'Address 5', 'e@email.com', 'Person 5', '', '', 'COMPLETE', 'TALLY'], // Missing Contact Phone (row 6)
      ['Valid Company F', 'Address 6', 'f@email.com', 'Person 6', '+91 98000 00006', '', 'COMPLETE', 'TALLY'], // Valid (row 7)
    ];

    const wbBuf = buildWorkbookBuffer({ CUSTOMERS: rows });
    const preview = await importService.validateCompanyImport(wbBuf);

    assert.strictEqual(preview.totalRows, 6, `Expected totalRows 6, got ${preview.totalRows}`);
    assert.strictEqual(preview.validCount, 1, `Expected validCount 1, got ${preview.validCount}`);
    assert.strictEqual(preview.invalidCount, 5, `Expected invalidCount 5, got ${preview.invalidCount}`);

    assert(preview.errors.some((e) => e.rowNumber === 2 && e.field === 'Company Name'));
    assert(preview.errors.some((e) => e.rowNumber === 3 && e.field === 'Address'));
    assert(preview.errors.some((e) => e.rowNumber === 4 && e.field === 'Primary Email'));
    assert(preview.errors.some((e) => e.rowNumber === 5 && e.field === 'Contact Person'));
    assert(preview.errors.some((e) => e.rowNumber === 6 && e.field === 'Contact Phone'));
  });

  // TEST 6: Resilient commit with partial failure reporting
  await test('6. commitCompanyImport processes all rows resiliently, reporting exact imported and failed counts', async () => {
    const testRows = [
      { company_name: 'Customer 1', address: 'A', primary_email: 'c1@test.com', contact_person: 'P1', contact_phone: '111' },
      { company_name: 'Customer 2', address: 'B', primary_email: 'c2@test.com', contact_person: 'P2', contact_phone: '222' },
      { company_name: 'Faulty DB Row', address: 'C', primary_email: 'fail@test.com', contact_person: 'P3', contact_phone: '333' },
      { company_name: 'Customer 4', address: 'D', primary_email: 'c4@test.com', contact_person: 'P4', contact_phone: '444' },
    ];

    const result = await importService.commitCompanyImport(testRows, 1);

    assert.strictEqual(result.importedCount, 3, `Expected importedCount 3, got ${result.importedCount}`);
    assert.strictEqual(result.failedCount, 1, `Expected failedCount 1, got ${result.failedCount}`);
    assert.strictEqual(result.errors.length, 1, `Expected 1 failure error, got ${result.errors.length}`);
    assert.strictEqual(result.errors[0].companyName, 'Faulty DB Row');
    assert.strictEqual(result.errors[0].rowNumber, 3);
  });

  // SUMMARY
  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerImportSafetyTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
