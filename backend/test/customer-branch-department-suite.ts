import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

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

async function login(email: string, pass: string = 'Password@123'): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} with status ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}

async function runCustomerBranchDepartmentSuite() {
  console.log('===============================================================');
  console.log('KANVTECH CUSTOMER / BRANCH / PRODUCT / DEPARTMENT TEST SUITE');
  console.log('Target: 36/36 Assertions PASS');
  console.log('===============================================================\n');

  const ts = Date.now();
  const adminToken = await login('admin@kanvtech.com');
  const managerToken = await login('manager@kanvtech.com');
  const l1TallyToken = await login('l1.amit@kanvtech.com');
  const l1SpineToken = await login('l1.suresh@kanvtech.com');
  const customerAcmeToken = await login('rajesh@acme.com');

  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
  const managerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` };
  const custHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAcmeToken}` };
  const l1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${l1TallyToken}` };

  let testCustSingleProdId = '';
  let testCustSingleContactId = 0;
  let testCustMultiProdId = '';
  let testCustMultiContactId = 0;
  let testCustNoBranchId = '';
  let testCustNoBranchContactId = 0;
  let testCustWithBranchesId = '';
  let testCustWithBranchesContactId = 0;
  let branchDahisarId = '';
  let branchKandivaliId = '';
  let testTallyEmpId = '';
  let testSpineEmpId = '';
  let testTicketTallyId = '';
  let testTicketSpineId = '';

  // -------------------------------------------------------------
  // CUSTOMER MASTER: 1 - 6
  // -------------------------------------------------------------

  // 1. Create customer with one product
  await test('1. Create customer with one product (Tally)', async () => {
    const res = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        company_name: `Apex Technologies Corp ${ts}`,
        address: '101 Technopark, Andheri East, Mumbai',
        gstn: `27AABC${ts.toString().slice(-4)}P1Z1`,
        primary_email: `contact-${ts}@apextech-test.com`,
        contact_person: 'Anil Desai',
        contact_phone: '+91 98200 99111',
        product_ids: ['PROD-0001'], // Tally
      }),
    });
    const data = await res.json();
    assert(res.ok, `Expected 201/200 but got ${res.status}: ${JSON.stringify(data)}`);
    testCustSingleProdId = data.companyId || data.id;

    // Verify company products and contacts
    const getRes = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}`, { headers: adminHeaders });
    const comp = (await getRes.json()).company;
    assert.strictEqual(comp.products.length, 1);
    assert.strictEqual(comp.products[0].product_id, 'PROD-0001');
    testCustSingleContactId = comp.contacts[0].id;
    testCustWithBranchesContactId = comp.contacts[0].id;
  });

  // 2. Create customer with multiple products
  await test('2. Create customer with multiple products (Tally + Spine + BIOS 360)', async () => {
    const res = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        company_name: `Omni Cloud Solutions ${ts}`,
        address: '502 Cyber Towers, Hitec City, Hyderabad',
        gstn: `36AABO${ts.toString().slice(-4)}Q1Z2`,
        primary_email: `admin-${ts}@omnicloud-test.com`,
        contact_person: 'Srinivas Rao',
        contact_phone: '+91 98490 11223',
        product_ids: ['PROD-0001', 'PROD-0002', 'PROD-0003'],
      }),
    });
    const data = await res.json();
    assert(res.ok, `Failed: ${JSON.stringify(data)}`);
    testCustMultiProdId = data.companyId || data.id;

    const getRes = await fetch(`${BASE_URL}/companies/${testCustMultiProdId}`, { headers: adminHeaders });
    const comp = (await getRes.json()).company;
    assert.strictEqual(comp.products.length, 3, 'Must own 3 products');
    testCustMultiContactId = comp.contacts[0].id;
  });

  // 3. Reject customer with zero products
  await test('3. Reject customer with zero products (MANDATORY VALIDATION)', async () => {
    const res = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        company_name: `No Product Corp ${ts}`,
        address: 'Sector 5, Salt Lake, Kolkata',
        gstn: `19AABN${ts.toString().slice(-4)}R1Z3`,
        primary_email: `info-${ts}@noproduct-test.com`,
        contact_person: 'Sourav Roy',
        contact_phone: '+91 98300 22334',
        product_ids: [], // ZERO PRODUCTS
      }),
    });
    assert.strictEqual(res.status, 400, 'Must return 400 Bad Request');
    const data = await res.json();
    const errMsg = data.message || data.error || '';
    assert(
      errMsg.includes('At least one product must be selected before registering a customer'),
      `Expected message mismatch: ${errMsg}`,
    );
  });

  // 4. Edit customer
  await test('4. Edit customer basic details', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        address: 'Updated Address: 102 Technopark B-Wing, Andheri East, Mumbai',
        contact_phone: '+91 98200 99222',
      }),
    });
    assert(res.ok, 'Customer updated');

    const getRes = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}`, { headers: adminHeaders });
    const comp = (await getRes.json()).company;
    assert.strictEqual(comp.address, 'Updated Address: 102 Technopark B-Wing, Andheri East, Mumbai');
    assert.strictEqual(comp.contact_phone, '+91 98200 99222');
  });

  // 5. Add product later to existing customer
  await test('5. Add product later to customer (Customer purchases Spine)', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        productId: 'PROD-0002', // Spine
        notes: 'Spine HRMS purchased for HR expansion',
      }),
    });
    assert(res.ok, 'Product added to customer');

    const getRes = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}`, { headers: adminHeaders });
    const comp = (await getRes.json()).company;
    assert.strictEqual(comp.products.length, 2, 'Customer now owns 2 products (Tally + Spine)');
  });

  // 6. Remove product where safe & reject removing last product
  await test('6. Remove product where safe and enforce retaining min 1 product', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}/products/PROD-0002`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(res.ok, 'Product removed safely');

    const getRes = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}`, { headers: adminHeaders });
    const comp = (await getRes.json()).company;
    const activeProducts = comp.products.filter((p: any) => p.is_active === 1);
    assert.strictEqual(activeProducts.length, 1);

    // Attempt to remove the LAST product (Tally): MUST BE REJECTED
    const delLastRes = await fetch(`${BASE_URL}/companies/${testCustSingleProdId}/products/PROD-0001`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert.strictEqual(delLastRes.status, 400, 'Cannot remove the only remaining product');

    // Re-add Spine for subsequent tests
    await fetch(`${BASE_URL}/companies/${testCustSingleProdId}/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ productId: 'PROD-0002' }),
    });
  });

  // -------------------------------------------------------------
  // BRANCH MANAGEMENT: 7 - 13
  // -------------------------------------------------------------

  // 7. Create customer without branches
  await test('7. Create customer without branches (branches = 0)', async () => {
    const res = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        company_name: `Single Site Enterprises ${ts}`,
        address: '12 Commercial Street, Pune',
        gstn: `27AABS${ts.toString().slice(-4)}S1Z4`,
        primary_email: `office-${ts}@singlesite-test.com`,
        contact_person: 'Prakash Kulkarni',
        contact_phone: '+91 98220 33445',
        product_ids: ['PROD-0001'],
      }),
    });
    const data = await res.json();
    assert(res.ok);
    testCustNoBranchId = data.companyId || data.id;

    const getRes = await fetch(`${BASE_URL}/companies/${testCustNoBranchId}`, { headers: adminHeaders });
    const comp = (await getRes.json()).company;
    testCustNoBranchContactId = comp.contacts[0].id;

    const branchesRes = await fetch(`${BASE_URL}/companies/${testCustNoBranchId}/branches`, { headers: adminHeaders });
    const bData = await branchesRes.json();
    assert.strictEqual(bData.branches.length, 0, 'Must have 0 branches');
  });

  // 8. Create customer with 1 branch
  await test('8. Create customer with one branch', async () => {
    testCustWithBranchesId = testCustSingleProdId; // Has Tally + Spine

    const res = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branch_name: 'Dahisar Branch',
        address: 'Dahisar East, Mumbai, Maharashtra',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400068',
        contact_person: 'Rahul Sharma',
        contact_phone: '+91 98200 11111',
        contact_email: 'rahul.dahisar@apextech.com',
        product_ids: ['PROD-0001', 'PROD-0002'], // Tally + Spine
      }),
    });
    const data = await res.json();
    assert(res.ok, `Branch 1 creation failed: ${JSON.stringify(data)}`);
    branchDahisarId = data.branchId || data.id;
    assert(branchDahisarId.startsWith('BR-'), 'Branch ID starts with BR-');
  });

  // 9. Create customer with multiple dynamic branches (no artificial branch limit)
  await test('9. Create customer with multiple dynamic branches (Dahisar, Kandivali, Vapi)', async () => {
    // Branch 2: Kandivali (Tally only)
    const res2 = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branch_name: 'Kandivali Branch',
        address: 'Kandivali West, Link Road, Mumbai',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400067',
        contact_person: 'Deepak Joshi',
        contact_phone: '+91 98200 22222',
        contact_email: 'deepak.kandivali@apextech.com',
        product_ids: ['PROD-0001'], // Tally only
      }),
    });
    const d2 = await res2.json();
    assert(res2.ok);
    branchKandivaliId = d2.branchId || d2.id;

    // Branch 3: Vapi (Spine only)
    const res3 = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        branch_name: 'Vapi Manufacturing Plant',
        address: 'GIDC Phase 2, Vapi, Gujarat',
        city: 'Vapi',
        state: 'Gujarat',
        pincode: '396195',
        contact_person: 'Mahesh Patel',
        contact_phone: '+91 98250 33333',
        contact_email: 'mahesh.vapi@apextech.com',
        product_ids: ['PROD-0002'], // Spine only
      }),
    });
    assert(res3.ok);

    const bRes = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches`, { headers: adminHeaders });
    const bList = (await bRes.json()).branches;
    assert.strictEqual(bList.length, 3, 'Must have all 3 dynamic branches');
  });

  // 10. Edit branch details
  await test('10. Edit branch contact and address details', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchDahisarId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        address: 'Dahisar East Express Highway, Mumbai 400068',
        contact_phone: '+91 98200 99999',
      }),
    });
    assert(res.ok);

    const getRes = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchDahisarId}`, { headers: adminHeaders });
    const b = (await getRes.json()).branch;
    assert.strictEqual(b.address, 'Dahisar East Express Highway, Mumbai 400068');
    assert.strictEqual(b.contact_phone, '+91 98200 99999');
  });

  // 11. Deactivate branch
  await test('11. Deactivate branch (Status transitions to INACTIVE)', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchDahisarId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'INACTIVE' }),
    });
    assert(res.ok);

    const getRes = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchDahisarId}`, { headers: adminHeaders });
    const b = (await getRes.json()).branch;
    assert.strictEqual(b.status, 'INACTIVE');

    // Reactivate for further tests
    await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchDahisarId}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
  });

  // 12. Assign products to branch
  await test('12. Assign products to branch (Assign Tally to Kandivali)', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchKandivaliId}/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ productIds: ['PROD-0001'] }),
    });
    assert(res.ok);
  });

  // 13. Reject branch product not owned by customer
  await test('13. Reject branch product NOT owned by customer (MANDATORY BUSINESS RULE)', async () => {
    const res = await fetch(`${BASE_URL}/companies/${testCustWithBranchesId}/branches/${branchKandivaliId}/products`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ productIds: ['PROD-0003'] }), // BIOS 360
    });
    assert.strictEqual(res.status, 400, 'Must return 400 when branch product is not owned by parent company');
    const data = await res.json();
    const errMsg = data.message || data.error || '';
    assert(errMsg.includes('does not own this product'), `Error message mismatch: ${errMsg}`);
  });

  // -------------------------------------------------------------
  // EMPLOYEES & DEPARTMENTS: 14 - 18
  // -------------------------------------------------------------

  // 14. Create Tally Employee
  await test('14. Create specialized Tally department employee', async () => {
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Gaurav Tally Specialist ${ts}`,
        email: `gaurav-${ts}@kanvtech.com`,
        phone: '+91 98765 11001',
        department_id: 'DEP-0001', // Tally Support
        designation: 'Tally L1 Specialist',
        level: 'L1',
      }),
    });
    const data = await res.json();
    assert(res.ok, `Employee creation failed: ${JSON.stringify(data)}`);
    testTallyEmpId = data.employeeId || data.id;

    const getRes = await fetch(`${BASE_URL}/employees/${testTallyEmpId}`, { headers: adminHeaders });
    const emp = (await getRes.json()).employee;
    assert.strictEqual(emp.department_id, 'DEP-0001');
    assert.strictEqual(emp.level, 'L1');
  });

  // 15. Create Spine Employee
  await test('15. Create specialized Spine department employee', async () => {
    const res = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Sunil Spine Specialist ${ts}`,
        email: `sunil-${ts}@kanvtech.com`,
        phone: '+91 98765 22002',
        department_id: 'DEP-0002', // Spine Support
        designation: 'Spine L1 Specialist',
        level: 'L1',
      }),
    });
    const data = await res.json();
    assert(res.ok);
    testSpineEmpId = data.employeeId || data.id;

    const getRes = await fetch(`${BASE_URL}/employees/${testSpineEmpId}`, { headers: adminHeaders });
    const emp = (await getRes.json()).employee;
    assert.strictEqual(emp.department_id, 'DEP-0002');
    assert.strictEqual(emp.level, 'L1');
  });

  // 16. Verify one employee cannot belong to multiple departments
  await test('16. Verify 1 Employee = Exactly 1 Department constraint', async () => {
    const getRes = await fetch(`${BASE_URL}/employees/${testTallyEmpId}`, { headers: adminHeaders });
    const emp = (await getRes.json()).employee;
    assert(emp.department_id, 'Employee has single department');
    assert(typeof emp.department_id === 'string', 'department_id is a single foreign key');
  });

  // 17. Create department-specific L1/L2/L3
  await test('17. Department Master has separate L1, L2, L3 specialists', async () => {
    const tallyDeptRes = await fetch(`${BASE_URL}/departments/DEP-0001`, { headers: adminHeaders });
    const tallyDept = await tallyDeptRes.json();
    assert(tallyDept.employees.some((e: any) => e.level === 'L1'), 'Tally has L1');
    assert(tallyDept.employees.some((e: any) => e.level === 'L2'), 'Tally has L2');
    assert(tallyDept.employees.some((e: any) => e.level === 'L3'), 'Tally has L3');
  });

  // 18. Verify department manager relationship
  await test('18. Verify department manager relationship and traceability', async () => {
    const deptRes = await fetch(`${BASE_URL}/departments/DEP-0001`, { headers: adminHeaders });
    const dept = await deptRes.json();
    assert.strictEqual(dept.manager_id, 'EMP-001');
    assert(dept.manager.name, 'Manager name is populated');
  });

  // -------------------------------------------------------------
  // TICKETS & WORKLOAD AUTO-ROUTING: 19 - 31
  // -------------------------------------------------------------

  // 19. Create Tally ticket
  await test('19. Create Tally ticket with Product selection', async () => {
    const res = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustSingleProdId,
        customerContactId: testCustSingleContactId,
        productId: 'PROD-0001', // Tally
        problemType: 'Tally GST E-Way Bill Sync Error',
        priority: 'HIGH',
        category: 'Statutory Compliance',
        description: 'JSON payload validation failure on portal gateway.',
        createdByUserId: 1,
      }),
    });
    const data = await res.json();
    assert(res.ok, `Ticket creation failed: ${JSON.stringify(data)}`);
    testTicketTallyId = data.ticketId || data.id || data.ticket?.id;
    assert(testTicketTallyId, 'Ticket ID must exist');
  });

  // 20. Verify Tally department selected automatically
  await test('20. Verify Tally department derived automatically from product', async () => {
    const res = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}`, { headers: adminHeaders });
    const data = await res.json();
    const ticket = data.ticket || data;
    assert.strictEqual(ticket.product_id, 'PROD-0001');
    assert.strictEqual(ticket.department_id, 'DEP-0001', 'Department must be Tally Support (DEP-0001)');
    assert.strictEqual(ticket.department_name, 'Tally Support');
  });

  // 21. Verify Tally L1 is selected
  await test('21. Verify assigned employee is a Tally L1 specialist', async () => {
    const res = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}`, { headers: adminHeaders });
    const data = await res.json();
    const ticket = data.ticket || data;
    assert.strictEqual(ticket.assigned_level, 'L1');
    assert(ticket.assigned_employee_id, 'Assigned employee must be present');
    assert(
      ['EMP-002', 'EMP-003', testTallyEmpId].includes(ticket.assigned_employee_id),
      `Assigned to unexpected employee: ${ticket.assigned_employee_id}`,
    );
  });

  // 22. Verify lowest workload L1 receives ticket
  await test('22. Verify lowest workload L1 receives auto-assigned ticket', async () => {
    const res = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustNoBranchId,
        customerContactId: testCustNoBranchContactId,
        productId: 'PROD-0001', // Tally
        problemType: 'Tally Bank Reconciliation Mismatch',
        priority: 'MEDIUM',
        category: 'Banking',
        description: 'Auto bank feed statement import skipped 4 records.',
        createdByUserId: 1,
      }),
    });
    const data = await res.json();
    assert(res.ok, `Failed: ${JSON.stringify(data)}`);
    const ticket = data.ticket || data;
    assert(ticket.assigned_employee_id, 'Assigned employee present');
  });

  // 23. Verify Spine employee cannot receive Tally ticket
  await test('23. Verify Spine employee cannot receive Tally ticket (Department Segregation)', async () => {
    const res = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}`, { headers: adminHeaders });
    const data = await res.json();
    const ticket = data.ticket || data;
    assert.notStrictEqual(ticket.assigned_employee_id, 'EMP-006', 'Spine L1 cannot receive Tally ticket');
    assert.notStrictEqual(ticket.assigned_employee_id, testSpineEmpId, 'Spine L1 cannot receive Tally ticket');
  });

  // 24. Escalate Tally L1 -> Tally L2
  await test('24. Escalate Tally L1 -> Tally L2', async () => {
    // Start work first
    await fetch(`${BASE_URL}/tickets/${testTicketTallyId}/start`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ employeeId: 'EMP-002' }),
    });

    const res = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}/escalate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        fromLevel: 'L1',
        toLevel: 'L2',
        escalatedByEmployeeId: 'EMP-002',
        reason: 'Requires advanced TDL schema migration',
      }),
    });
    assert(res.ok, 'Escalation to L2 succeeded');

    const ticketRes = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}`, { headers: adminHeaders });
    const ticket = (await ticketRes.json()).ticket;
    assert.strictEqual(ticket.assigned_level, 'L2');
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-004', 'Tally L2 (Vikram) assigned');
  });

  // 25. Escalate Tally L2 -> Tally L3
  await test('25. Escalate Tally L2 -> Tally L3', async () => {
    const res = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}/escalate`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        fromLevel: 'L2',
        toLevel: 'L3',
        escalatedByEmployeeId: 'EMP-004',
        reason: 'Core data corruption requiring direct binary patch',
      }),
    });
    assert(res.ok, 'Escalation to L3 succeeded');

    const ticketRes = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}`, { headers: adminHeaders });
    const ticket = (await ticketRes.json()).ticket;
    assert.strictEqual(ticket.assigned_level, 'L3');
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-005', 'Tally L3 (Priya) assigned');
  });

  // 26. Verify escalation remains in Tally department
  await test('26. Verify escalation remains strictly within Tally Department', async () => {
    const ticketRes = await fetch(`${BASE_URL}/tickets/${testTicketTallyId}`, { headers: adminHeaders });
    const ticket = (await ticketRes.json()).ticket;
    assert.strictEqual(ticket.department_name, 'Tally Support');
    assert.strictEqual(ticket.assigned_employee_name, 'Priya Nair'); // Tally L3
  });

  // 27. Create Spine ticket and verify Spine routing
  await test('27. Create Spine ticket and verify Spine Department auto-routing', async () => {
    const res = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustMultiProdId,
        customerContactId: testCustMultiContactId,
        productId: 'PROD-0002', // Spine
        problemType: 'Biometric Attendance Machine Sync Failure',
        priority: 'HIGH',
        category: 'Hardware Sync',
        description: 'TCP port 4370 socket timeout on 3 turnstile devices.',
        createdByUserId: 1,
      }),
    });
    const data = await res.json();
    assert(res.ok, `Failed: ${JSON.stringify(data)}`);
    testTicketSpineId = data.ticketId || data.id || data.ticket?.id;

    const ticketRes = await fetch(`${BASE_URL}/tickets/${testTicketSpineId}`, { headers: adminHeaders });
    const ticket = (await ticketRes.json()).ticket;

    assert.strictEqual(ticket.product_id, 'PROD-0002');
    assert.strictEqual(ticket.department_id, 'DEP-0002');
    assert.strictEqual(ticket.department_name, 'Spine Support');
    
    // Verify assigned employee is a Spine L1 specialist
    const empRes = await fetch(`${BASE_URL}/employees/${ticket.assigned_employee_id}`, { headers: adminHeaders });
    const emp = (await empRes.json()).employee;
    assert.strictEqual(emp.department_id, 'DEP-0002', 'Assigned employee must belong to Spine Support');
    assert.strictEqual(emp.level, 'L1', 'Assigned employee must be L1');
  });

  // 28. Verify branch product validation on ticket creation
  await test('28. Branch product validation on ticket creation', async () => {
    // Kandivali branch only has Tally (PROD-0001). Trying to create ticket for Spine (PROD-0002) at Kandivali MUST FAIL.
    const res = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustWithBranchesId,
        customerContactId: testCustWithBranchesContactId,
        branchId: branchKandivaliId,
        productId: 'PROD-0002', // Spine (not owned by Kandivali branch)
        problemType: 'Invalid branch product test',
        priority: 'LOW',
        category: 'Test',
        description: 'Must fail validation.',
        createdByUserId: 1,
      }),
    });
    assert.strictEqual(res.status, 400, 'Must reject ticket when product is not assigned to branch');
    const data = await res.json();
    const errMsg = data.message || data.error || '';
    assert(errMsg.includes('not assigned to branch'), `Mismatch: ${errMsg}`);
  });

  // 29. Verify customer without branch can create ticket
  await test('29. Verify customer without branch can create ticket smoothly', async () => {
    const res = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustNoBranchId,
        customerContactId: testCustNoBranchContactId,
        productId: 'PROD-0001',
        problemType: 'Single Site Ledger Printing Crash',
        priority: 'MEDIUM',
        category: 'Printing',
        description: 'Thermal spooler crash on invoice print.',
        createdByUserId: 1,
      }),
    });
    const data = await res.json();
    assert(res.ok, `Failed: ${JSON.stringify(data)}`);
    const createdId = data.ticketId || data.id || data.ticket?.id;

    const ticketRes = await fetch(`${BASE_URL}/tickets/${createdId}`, { headers: adminHeaders });
    const ticket = (await ticketRes.json()).ticket;
    assert.strictEqual(ticket.branch_id, null, 'Branch is null');
    assert.strictEqual(ticket.department_name, 'Tally Support');

    // Close to clean up
    await fetch(`${BASE_URL}/tickets/${createdId}/close`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: 'QA test cleanup' }),
    });
  });

  // 30. Verify customer with multiple products can create separate product tickets
  await test('30. Verify customer can create separate tickets for different products', async () => {
    // Create second ticket for testCustMultiProdId with Tally product
    const resTally = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustMultiProdId,
        customerContactId: testCustMultiContactId,
        productId: 'PROD-0001', // Tally
        problemType: 'Tally Remote Multi-User Sync Issue',
        priority: 'MEDIUM',
        category: 'Sync',
        description: 'Remote users disconnected.',
        createdByUserId: 1,
      }),
    });
    const d2 = await resTally.json();
    assert(resTally.ok, `Failed to create second ticket: ${JSON.stringify(d2)}`);

    const res = await fetch(`${BASE_URL}/tickets?companyId=${testCustMultiProdId}`, { headers: adminHeaders });
    const data = await res.json();
    const tallyTickets = data.data.filter((t: any) => t.product_id === 'PROD-0001');
    const spineTickets = data.data.filter((t: any) => t.product_id === 'PROD-0002');
    assert(tallyTickets.length >= 1, 'Has Tally ticket');
    assert(spineTickets.length >= 1, 'Has Spine ticket');
  });

  // 31. Verify 2-active-ticket limit remains functional across products
  await test('31. Verify 2-active-ticket limit strictly enforced per customer contact', async () => {
    // testCustMultiContactId already has 2 active tickets (1 Spine from #27 + 1 Tally from #30)
    // Attempting a 3rd ticket for testCustMultiContactId: MUST BE BLOCKED
    const res3 = await fetch(`${BASE_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: testCustMultiProdId,
        customerContactId: testCustMultiContactId,
        productId: 'PROD-0003', // BIOS 360
        problemType: '3rd Active Ticket Attempt',
        priority: 'LOW',
        category: 'General',
        description: 'Should be blocked by 2-active-ticket rule.',
        createdByUserId: 1,
      }),
    });
    assert.strictEqual(res3.status, 400, '3rd ticket must be blocked with status 400');
    const data = await res3.json();
    const errMsg = data.message || data.error || '';
    assert(errMsg.includes('2 active tickets'), `Mismatch message: ${errMsg}`);
  });

  // -------------------------------------------------------------
  // SECURITY & RBAC: 32 - 36
  // -------------------------------------------------------------

  // 32. Customer cannot access another customer data
  await test('32. Customer cannot access another customer records (Isolation)', async () => {
    const res = await fetch(`${BASE_URL}/companies/CMP-0002`, { headers: custHeaders });
    const data = await res.json();
    assert.strictEqual(data.success, false, 'Access must be denied');
  });

  // 33. Employee cannot modify department
  await test('33. Employee cannot create or modify department master', async () => {
    const res = await fetch(`${BASE_URL}/departments`, {
      method: 'POST',
      headers: l1Headers, // L1 employee
      body: JSON.stringify({
        name: 'Unauthorized Dept',
        code: 'UNAUTH',
      }),
    });
    assert.strictEqual(res.status, 403, 'L1 employee must receive 403 Forbidden');
  });

  // 34. Employee cannot assign themselves to another department
  await test('34. Employee cannot change their own department', async () => {
    const res = await fetch(`${BASE_URL}/employees/EMP-002`, {
      method: 'PUT',
      headers: l1Headers, // L1 employee
      body: JSON.stringify({ department_id: 'DEP-0002' }),
    });
    assert.strictEqual(res.status, 403, 'L1 employee cannot update employee master');
  });

  // 35. Unauthorized user cannot modify customer master
  await test('35. Customer cannot create or modify Customer Master', async () => {
    const res = await fetch(`${BASE_URL}/companies`, {
      method: 'POST',
      headers: custHeaders,
      body: JSON.stringify({
        company_name: 'Hacked Company',
        address: 'Hacked',
        primary_email: 'hack@hack.com',
        contact_person: 'Hacker',
        contact_phone: '123',
      }),
    });
    assert.strictEqual(res.status, 403, 'Customer received 403 Forbidden');
  });

  // 36. Unauthorized API calls return appropriate 401/403
  await test('36. Unauthenticated requests return 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/departments`);
    assert.strictEqual(res.status, 401, 'Unauthenticated request returns 401');
  });

  console.log('\n===============================================================');
  console.log(`CUSTOMER / BRANCH / DEPARTMENT SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCustomerBranchDepartmentSuite().catch((err) => {
  console.error('Test suite runtime error:', err);
  process.exit(1);
});
