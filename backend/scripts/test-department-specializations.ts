import { PrismaClient } from '@prisma/client';
import assert from 'assert';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function main() {
  console.log('====================================================');
  console.log('DEPARTMENT HIERARCHICAL SPECIALIZATION TEST SUITE');
  console.log('====================================================\n');

  // 1. Authenticate as Admin
  const authRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  const authData = await authRes.json();
  assert(authData.token, 'Admin authentication failed');
  const token = authData.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const ts = Date.now();

  // Setup Test Products, Modules & Submodules
  console.log('Setting up test hierarchy data...');
  const prodA = await prisma.product.create({
    data: {
      id: `PROD-TEST-A-${ts}`,
      code: `PROD-A-${ts}`,
      name: `Spine HRMS Test ${ts}`,
      category: 'HRMS',
      modules: {
        create: [
          {
            id: `MOD-PAY-${ts}`,
            name: `Payroll ${ts}`,
            submodules: {
              create: [
                { id: `SMOD-SAL-${ts}`, name: `Salary Processing ${ts}` },
                { id: `SMOD-PAYSLIP-${ts}`, name: `Payslip ${ts}` },
                { id: `SMOD-STAT-${ts}`, name: `Statutory ${ts}` },
              ],
            },
          },
          {
            id: `MOD-ATT-${ts}`,
            name: `Attendance ${ts}`,
            submodules: {
              create: [
                { id: `SMOD-DATT-${ts}`, name: `Daily Attendance ${ts}` },
                { id: `SMOD-SHIFT-${ts}`, name: `Shift Management ${ts}` },
              ],
            },
          },
          {
            id: `MOD-LEAVE-${ts}`,
            name: `Leave ${ts}`,
            submodules: {
              create: [
                { id: `SMOD-LREQ-${ts}`, name: `Leave Request ${ts}` },
                { id: `SMOD-LAPP-${ts}`, name: `Leave Approval ${ts}` },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { submodules: true } } },
  });

  const prodB = await prisma.product.create({
    data: {
      id: `PROD-TEST-B-${ts}`,
      code: `PROD-B-${ts}`,
      name: `Tally ERP Test ${ts}`,
      category: 'Accounting',
      modules: {
        create: [
          {
            id: `MOD-ACC-${ts}`,
            name: `Accounting & GST ${ts}`,
            submodules: {
              create: [
                { id: `SMOD-INV-${ts}`, name: `Invoicing ${ts}` },
                { id: `SMOD-TAX-${ts}`, name: `Tax Filing ${ts}` },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { submodules: true } } },
  });

  const prodC = await prisma.product.create({
    data: {
      id: `PROD-TEST-C-${ts}`,
      code: `PROD-C-${ts}`,
      name: `BIOS 360 Test ${ts}`,
      category: 'Security',
      modules: {
        create: [
          {
            id: `MOD-BIO-${ts}`,
            name: `Biometric Sync ${ts}`,
            submodules: {
              create: [
                { id: `SMOD-FINGER-${ts}`, name: `Fingerprint ${ts}` },
                { id: `SMOD-FACE-${ts}`, name: `Face Recognition ${ts}` },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { submodules: true } } },
  });

  console.log('Products created:', prodA.id, prodB.id, prodC.id, '\n');

  // TEST-01: Create department with one complete product
  console.log('TEST-01: Create department with one complete product...');
  const res01 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Complete Spine Dept ${ts}`,
      code: `DEP-CSP-${ts}`,
      description: 'Department with complete Spine HRMS specialization',
      specializations: [
        {
          productId: prodA.id,
          isComplete: true,
          moduleIds: [],
          submoduleIds: [],
        },
      ],
    }),
  });
  const dept01 = await res01.json();
  assert.strictEqual(res01.status, 201, `Failed to create dept: ${JSON.stringify(dept01)}`);
  assert(dept01.id);
  assert.strictEqual(dept01.specializations[0].productId, prodA.id);
  assert.strictEqual(dept01.specializations[0].isComplete, true);
  console.log('✓ TEST-01 PASS: Created department with complete product specialization.\n');

  // TEST-02: Create department with multiple products
  console.log('TEST-02: Create department with multiple products...');
  const res02 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Multi Product Dept ${ts}`,
      code: `DEP-MPD-${ts}`,
      description: 'Department with multiple complete products',
      specializations: [
        { productId: prodA.id, isComplete: true },
        { productId: prodB.id, isComplete: true },
      ],
    }),
  });
  const dept02 = await res02.json();
  assert.strictEqual(res02.status, 201);
  assert.strictEqual(dept02.specializations.length, 2);
  const dpMappings02 = await prisma.departmentProduct.findMany({ where: { departmentId: dept02.id } });
  assert.strictEqual(dpMappings02.length, 2);
  console.log('✓ TEST-02 PASS: Created department with multiple complete products.\n');

  // TEST-03: Create department with one module only
  console.log('TEST-03: Create department with one module only...');
  const res03 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Payroll Only Dept ${ts}`,
      code: `DEP-PAY-${ts}`,
      specializations: [
        {
          productId: prodA.id,
          isComplete: false,
          moduleIds: [`MOD-PAY-${ts}`],
          submoduleIds: [],
        },
      ],
    }),
  });
  const dept03 = await res03.json();
  assert.strictEqual(res03.status, 201);
  assert.strictEqual(dept03.specializations[0].isComplete, false);
  assert.deepStrictEqual(dept03.specializations[0].moduleIds, [`MOD-PAY-${ts}`]);
  console.log('✓ TEST-03 PASS: Created department with single module specialization.\n');

  // TEST-04: Create department with selected submodule only
  console.log('TEST-04: Create department with selected submodule only...');
  const res04 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Salary Processing Dept ${ts}`,
      code: `DEP-SAL-${ts}`,
      specializations: [
        {
          productId: prodA.id,
          isComplete: false,
          moduleIds: [],
          submoduleIds: [`SMOD-SAL-${ts}`],
        },
      ],
    }),
  });
  const dept04 = await res04.json();
  assert.strictEqual(res04.status, 201);
  assert.deepStrictEqual(dept04.specializations[0].submoduleIds, [`SMOD-SAL-${ts}`]);
  console.log('✓ TEST-04 PASS: Created department with single submodule specialization.\n');

  // TEST-05: Create department with mixed selections
  console.log('TEST-05: Create department with mixed selections...');
  const res05 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Mixed Specialization Dept ${ts}`,
      code: `DEP-MIX-${ts}`,
      specializations: [
        { productId: prodA.id, isComplete: true },
        { productId: prodB.id, isComplete: false, moduleIds: [`MOD-ACC-${ts}`] },
        { productId: prodC.id, isComplete: false, submoduleIds: [`SMOD-FINGER-${ts}`] },
      ],
    }),
  });
  const dept05 = await res05.json();
  assert.strictEqual(res05.status, 201);
  assert.strictEqual(dept05.specializations.length, 3);
  console.log('✓ TEST-05 PASS: Created department with mixed product/module/submodule specializations.\n');

  // TEST-06: Edit department (Selections restored correctly)
  console.log('TEST-06: Edit department...');
  const res06 = await fetch(`${API_URL}/departments/${dept05.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: `Mixed Specialization Dept Updated ${ts}`,
      specializations: [
        { productId: prodA.id, isComplete: false, moduleIds: [`MOD-LEAVE-${ts}`] },
        { productId: prodB.id, isComplete: true },
      ],
    }),
  });
  const dept06 = await res06.json();
  assert.strictEqual(res06.status, 200);
  assert.strictEqual(dept06.specializations.length, 2);
  assert.strictEqual(dept06.specializations[0].moduleIds[0], `MOD-LEAVE-${ts}`);
  console.log('✓ TEST-06 PASS: Edited department and updated hierarchy specializations.\n');

  // TEST-07: Remove specialization
  console.log('TEST-07: Remove specialization...');
  const res07 = await fetch(`${API_URL}/departments/${dept06.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      specializations: [{ productId: prodB.id, isComplete: true }],
    }),
  });
  const dept07 = await res07.json();
  assert.strictEqual(res07.status, 200);
  assert.strictEqual(dept07.specializations.length, 1);
  assert.strictEqual(dept07.specializations[0].productId, prodB.id);
  const dpCheck07 = await prisma.departmentProduct.findMany({ where: { departmentId: dept06.id } });
  assert.strictEqual(dpCheck07.length, 1);
  assert.strictEqual(dpCheck07[0].productId, prodB.id);
  console.log('✓ TEST-07 PASS: Removed specialization and verified relational sync.\n');

  // TEST-08: Refresh / GET (Selections persist)
  console.log('TEST-08: Refresh / GET persistence...');
  const res08 = await fetch(`${API_URL}/departments/${dept07.id}`, { headers });
  const dept08 = await res08.json();
  assert.strictEqual(dept08.id, dept07.id);
  assert.strictEqual(dept08.specializations.length, 1);
  assert.strictEqual(dept08.specializations[0].productId, prodB.id);
  console.log('✓ TEST-08 PASS: Selections persist accurately across GET requests.\n');

  // TEST-09: Search department by name
  console.log('TEST-09: Search department...');
  const res09 = await fetch(`${API_URL}/departments?search=Mixed%20Specialization`, { headers });
  const list09 = await res09.json();
  assert(Array.isArray(list09));
  assert(list09.some((d: any) => d.id === dept07.id));
  console.log('✓ TEST-09 PASS: Search returns correct department.\n');

  // TEST-12: Invalid hierarchy relationship (submodule of Product A under Product B)
  console.log('TEST-12: Invalid hierarchy relationship...');
  const res12 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Invalid Rel Dept ${ts}`,
      code: `DEP-INV-${ts}`,
      specializations: [
        {
          productId: prodB.id, // Tally ERP
          submoduleIds: [`SMOD-SAL-${ts}`], // Salary Processing belongs to Spine HRMS!
        },
      ],
    }),
  });
  const err12 = await res12.json();
  assert.strictEqual(res12.status, 400, 'Expected 400 Bad Request for mismatched hierarchy');
  assert(err12.message.includes('does not belong to product'), `Error message mismatch: ${err12.message}`);
  console.log('✓ TEST-12 PASS: Backend strictly rejects mismatched product-module-submodule relationships.\n');

  // TEST-13: No specialization validation error
  console.log('TEST-13: No specialization validation error...');
  const res13 = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Empty Spec Dept ${ts}`,
      code: `DEP-EMP-${ts}`,
      specializations: [],
    }),
  });
  const err13 = await res13.json();
  assert.strictEqual(res13.status, 400, 'Expected 400 for empty specializations');
  assert(err13.message.includes('At least one valid product specialization must be selected'));
  console.log('✓ TEST-13 PASS: Rejected creation when no specializations provided.\n');

  // Cleanup test entities
  console.log('Cleaning up test entities...');
  await prisma.department.deleteMany({
    where: {
      id: { in: [dept01.id, dept02.id, dept03.id, dept04.id, dept05.id] },
    },
  });
  await prisma.product.deleteMany({
    where: {
      id: { in: [prodA.id, prodB.id, prodC.id] },
    },
  });

  console.log('\n====================================================');
  console.log('ALL DEPARTMENT SPECIALIZATION TESTS PASSED! (13/13)');
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
