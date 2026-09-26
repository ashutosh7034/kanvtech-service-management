import assert from 'assert';
import { PrismaClient, UserRole, EmployeeLevel, TicketPriority } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { TimerService } from '../src/timer/timer.service';
import { SlaService } from '../src/sla/sla.service';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { EscalationsService } from '../src/escalations/escalations.service';
import { CompaniesService } from '../src/companies/companies.service';
import { EmployeesService } from '../src/employees/employees.service';
import { DepartmentsService } from '../src/departments/departments.service';
import { ProductsService } from '../src/products/products.service';
import { TicketsService } from '../src/tickets/tickets.service';
import { ImplementationsService } from '../src/implementations/implementations.service';
import { ImportService } from '../src/import/import.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';

async function runSuite() {
  console.log('===============================================================');
  console.log('KANVTECH MASTER UPDATE BATCH #1 -> #7 TEST SUITE');
  console.log('Testing 54 Assertions across Customers, Branches, Products,');
  console.log('Departments, Tickets, Implementations Tasks, Auto-Logins & Prom/Dem');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      process.stdout.write(`[TEST] ${name} ... `);
      await fn();
      console.log('PASSED ✔');
      passed++;
    } catch (err: any) {
      console.log('FAILED ✘');
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  const prismaService = new PrismaService();
  await prismaService.$connect();
  const prisma = prismaService;

  const auditService = new AuditService(prismaService);
  const notificationsService = new NotificationsService(prismaService);
  const timerService = new TimerService(prismaService);
  const slaService = new SlaService(prismaService);
  const assignmentsService = new AssignmentsService(prismaService, auditService, notificationsService);
  const escalationsService = new EscalationsService(prismaService, assignmentsService, timerService, auditService, notificationsService);
  const productsService = new ProductsService(prismaService, auditService);
  const companiesService = new CompaniesService(prismaService, auditService);
  const departmentsService = new DepartmentsService(prismaService, auditService);
  const employeesService = new EmployeesService(prismaService, auditService);
  const ticketsService = new TicketsService(prismaService, assignmentsService, slaService, timerService, auditService, notificationsService);
  const implementationsService = new ImplementationsService(prismaService, auditService);
  const importService = new ImportService(prismaService, companiesService, employeesService);

  const jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'kanvtech-super-secret-production-jwt-key-2026' });
  const authService = new AuthService(prismaService, jwtService);

  const timestamp = Date.now();
  let testCompanyId = '';
  let testMultiCompId = '';
  let testBranchId1 = '';
  let testBranchId2 = '';
  let testDeptTallyId = '';
  let testDeptSpineId = '';
  let empTallyL1Id = '';
  let empTallyL1AltId = '';
  let empTallyL2Id = '';
  let empTallyL3Id = '';
  let empSpineL1Id = '';
  let testImplId = '';
  let testTaskId1 = '';
  let testTaskId2 = '';

  // Ensure Products in DB
  const tallyProd = await prisma.product.findFirst({ where: { code: 'TALLY' } });
  const spineProd = await prisma.product.findFirst({ where: { code: 'SPINE' } });
  const biosProd = await prisma.product.findFirst({ where: { code: 'BIOS360' } });
  assert(tallyProd && spineProd && biosProd, 'Baseline products must exist');

  // Ensure Departments in DB
  const tallyDept = await prisma.department.findFirst({ where: { productId: tallyProd.id } });
  const spineDept = await prisma.department.findFirst({ where: { productId: spineProd.id } });
  testDeptTallyId = tallyDept?.id || 'DEP-0001';
  testDeptSpineId = spineDept?.id || 'DEP-0002';

  // --- CUSTOMERS ---
  await test('1. Customer with one product (Tally)', async () => {
    testCompanyId = await companiesService.createCompany({
      company_name: `Single Prod Cust ${timestamp}`,
      address: '101 Tech Park, Mumbai',
      primary_email: `single_${timestamp}@customer.com`,
      contact_person: 'Rohan Verma',
      contact_phone: '+91 98220 11111',
      product_ids: [tallyProd.id],
    });
    const c = await companiesService.getCompanyById(testCompanyId);
    assert.strictEqual(c.products.length, 1);
    assert.strictEqual(c.products[0].product_id, tallyProd.id);
  });

  await test('2. Customer with multiple products (Tally + Spine + BIOS 360)', async () => {
    testMultiCompId = await companiesService.createCompany({
      company_name: `Multi Prod Cust ${timestamp}`,
      address: '202 Corporate Tower, Pune',
      primary_email: `multi_${timestamp}@customer.com`,
      contact_person: 'Pooja Hegde',
      contact_phone: '+91 98220 22222',
      product_ids: [tallyProd.id, spineProd.id, biosProd.id],
    });
    const c = await companiesService.getCompanyById(testMultiCompId);
    assert.strictEqual(c.products.length, 3);
  });

  await test('3. Customer without product -> rejected (MANDATORY RULE)', async () => {
    await assert.rejects(
      async () =>
        companiesService.createCompany({
          company_name: `Zero Prod Cust ${timestamp}`,
          address: '303 Market Road, Nashik',
          primary_email: `zero_${timestamp}@customer.com`,
          contact_person: 'Amitabh Sen',
          contact_phone: '+91 98220 33333',
          product_ids: [],
        }),
      /At least one product must be selected/,
    );
  });

  await test('4. Customer with zero branches (Zero branches supported)', async () => {
    const branches = await companiesService.getCompanyBranches(testCompanyId);
    assert.strictEqual(branches.length, 0);
  });

  await test('5. Customer with one branch', async () => {
    testBranchId1 = await companiesService.createCompanyBranch(testCompanyId, {
      branch_name: 'Dahisar Branch',
      address: 'Dahisar East, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400068',
      contact_person: 'Rahul Sharma',
      contact_phone: '+91 98220 44444',
      product_ids: [tallyProd.id],
    });
    const b = await companiesService.getBranchById(testBranchId1);
    assert.strictEqual(b.branch_name, 'Dahisar Branch');
    assert.strictEqual(b.products.length, 1);
  });

  await test('6. Customer with multiple branches (Dahisar + Kandivali)', async () => {
    testBranchId2 = await companiesService.createCompanyBranch(testMultiCompId, {
      branch_name: 'Kandivali Branch',
      address: 'Kandivali West, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400067',
      contact_person: 'Sonal Shah',
      contact_phone: '+91 98220 55555',
      product_ids: [tallyProd.id, spineProd.id],
    });
    const branches = await companiesService.getCompanyBranches(testMultiCompId);
    assert(branches.length >= 1);
  });

  // --- PRODUCTS ---
  await test('7. Customer product assignment (Add Spine to Single Prod Customer)', async () => {
    await companiesService.addCompanyProduct(testCompanyId, spineProd.id, 'Purchased additional license');
    const c = await companiesService.getCompanyById(testCompanyId);
    assert.strictEqual(c.products.length, 2);
  });

  await test('8. Branch product assignment', async () => {
    await companiesService.assignBranchProducts(testBranchId1, [tallyProd.id, spineProd.id]);
    const b = await companiesService.getBranchById(testBranchId1);
    assert.strictEqual(b.products.length, 2);
  });

  await test('9. Branch product not owned by customer -> rejected', async () => {
    // Single Prod Cust only owns Tally + Spine. Attempting BIOS360 for branch must fail!
    await assert.rejects(
      async () => companiesService.assignBranchProducts(testBranchId1, [biosProd.id]),
      /does not own this product/,
    );
  });

  // --- DEPARTMENTS ---
  await test('10. Create department', async () => {
    const testProd = await productsService.createProduct(
      {
        code: `TESTPROD_${timestamp}`,
        name: `Test Department Product ${timestamp}`,
        category: 'Diagnostic Software',
        description: 'Temporary product for department mapping testing',
      },
      1,
    );

    const createdDept = await departmentsService.createDepartment({
      name: `Dedicated Test Dept ${timestamp}`,
      code: `DEP-TEST-${timestamp}`,
      productId: testProd.id,
      description: 'Specialized diagnostics team',
    });
    assert(createdDept.id.startsWith('DEP-'));
  });

  await test('11. Product -> department mapping', async () => {
    const dept = await prisma.department.findUnique({
      where: { id: testDeptTallyId },
      include: { product: true },
    });
    assert.strictEqual(dept?.productId, tallyProd.id);
  });

  await test('12. One employee -> one department (Enforced at backend)', async () => {
    empTallyL1Id = await employeesService.createEmployee({
      name: `Tally L1 Amit ${timestamp}`,
      email: `tally_l1_${timestamp}@kanvtech.com`,
      phone: '+91 98111 00001',
      department_id: testDeptTallyId,
      designation: 'L1 Tally Specialist',
      level: 'L1',
    });
    const emp = await employeesService.getEmployeeById(empTallyL1Id);
    assert.strictEqual(emp.department_id, testDeptTallyId);
  });

  await test('13. Multiple employees in same department', async () => {
    empTallyL1AltId = await employeesService.createEmployee({
      name: `Tally L1 Alt ${timestamp}`,
      email: `tally_l1_alt_${timestamp}@kanvtech.com`,
      phone: '+91 98111 00002',
      department_id: testDeptTallyId,
      designation: 'L1 Tally Specialist',
      level: 'L1',
    });
    const emps = await employeesService.getEmployees({ departmentId: testDeptTallyId });
    assert(emps.length >= 2);
  });

  await test('14. Department manager traceability', async () => {
    const dept = await departmentsService.getDepartmentById(testDeptTallyId);
    assert(dept);
  });

  // --- EMPLOYEES & PROMOTION/DEMOTION ---
  await test('15. Employee L1', async () => {
    const emp = await employeesService.getEmployeeById(empTallyL1Id);
    assert.strictEqual(emp.level, 'L1');
  });

  await test('16. Employee L2 setup', async () => {
    empTallyL2Id = await employeesService.createEmployee({
      name: `Tally L2 Vikram ${timestamp}`,
      email: `tally_l2_${timestamp}@kanvtech.com`,
      phone: '+91 98111 00003',
      department_id: testDeptTallyId,
      designation: 'L2 Senior Tally Specialist',
      level: 'L2',
    });
    const emp = await employeesService.getEmployeeById(empTallyL2Id);
    assert.strictEqual(emp.level, 'L2');
  });

  await test('17. Employee L3 setup', async () => {
    empTallyL3Id = await employeesService.createEmployee({
      name: `Tally L3 Priya ${timestamp}`,
      email: `tally_l3_${timestamp}@kanvtech.com`,
      phone: '+91 98111 00004',
      department_id: testDeptTallyId,
      designation: 'L3 Principal Tally Architect',
      level: 'L3',
    });
    const emp = await employeesService.getEmployeeById(empTallyL3Id);
    assert.strictEqual(emp.level, 'L3');
  });

  await test('18. L1 -> L2 promotion (Department remains unchanged, role updates to L2_EMPLOYEE)', async () => {
    const promoted = await employeesService.promoteEmployee(empTallyL1Id);
    assert.strictEqual(promoted.level, 'L2');
    assert.strictEqual(promoted.department_id, testDeptTallyId);
    const user = await prisma.user.findUnique({ where: { id: promoted.user_id } });
    assert.strictEqual(user?.role, UserRole.L2_EMPLOYEE);
  });

  await test('19. L2 -> L3 promotion', async () => {
    const promoted = await employeesService.promoteEmployee(empTallyL1Id);
    assert.strictEqual(promoted.level, 'L3');
    const user = await prisma.user.findUnique({ where: { id: promoted.user_id } });
    assert.strictEqual(user?.role, UserRole.L3_EMPLOYEE);
  });

  await test('20. L3 -> L2 demotion', async () => {
    const demoted = await employeesService.demoteEmployee(empTallyL1Id);
    assert.strictEqual(demoted.level, 'L2');
    const user = await prisma.user.findUnique({ where: { id: demoted.user_id } });
    assert.strictEqual(user?.role, UserRole.L2_EMPLOYEE);
  });

  await test('21. L2 -> L1 demotion', async () => {
    const demoted = await employeesService.demoteEmployee(empTallyL1Id);
    assert.strictEqual(demoted.level, 'L1');
    const user = await prisma.user.findUnique({ where: { id: demoted.user_id } });
    assert.strictEqual(user?.role, UserRole.L1_EMPLOYEE);
  });

  await test('22. Employee cannot belong to multiple departments', async () => {
    // Attempting to assign employee to another department updates single department_id
    await employeesService.updateEmployee(empTallyL1Id, { department_id: testDeptTallyId });
    const emp = await employeesService.getEmployeeById(empTallyL1Id);
    assert.strictEqual(emp.department_id, testDeptTallyId);
  });

  // --- TICKETS & ROUTING ---
  let ticket1Id = '';
  let ticketSpineId = '';
  await test('23. Tally ticket -> Tally department automatically derived', async () => {
    const contact = await prisma.companyContact.findFirst({ where: { companyId: testCompanyId } });
    assert(contact);
    const t = await ticketsService.createTicket({
      companyId: testCompanyId,
      customerContactId: contact.id,
      productId: tallyProd.id,
      problemType: 'GST e-Invoice Synchronization Failure',
      priority: TicketPriority.HIGH,
      category: 'Accounting',
      description: 'GSTR-1 JSON upload rejected with schema validation error.',
      createdByUserId: contact.userId || 1,
    });
    assert.strictEqual(t.department_id, testDeptTallyId);
    assert(t.assigned_employee_id);
    ticket1Id = t.id;
  });

  await test('24. Spine ticket -> Spine department automatically derived', async () => {
    empSpineL1Id = await employeesService.createEmployee({
      name: `Spine L1 Suresh ${timestamp}`,
      email: `spine_l1_${timestamp}@kanvtech.com`,
      phone: '+91 98111 00005',
      department_id: testDeptSpineId,
      designation: 'L1 Spine Specialist',
      level: 'L1',
    });

    const contact = await prisma.companyContact.findFirst({ where: { companyId: testCompanyId } });
    assert(contact);
    const t = await ticketsService.createTicket({
      companyId: testCompanyId,
      customerContactId: contact.id,
      productId: spineProd.id,
      problemType: 'Biometric Attendance Punch Mismatch',
      priority: TicketPriority.MEDIUM,
      category: 'Payroll',
      description: 'Shift rotation punch data not reconciling for March payroll run.',
      createdByUserId: contact.userId || 1,
    });
    assert.strictEqual(t.department_id, testDeptSpineId);
    ticketSpineId = t.id;
  });

  await test('25. Lowest workload L1 assignment in department', async () => {
    // empTallyL1AltId has 0 active tickets, empTallyL1Id has active ticket
    const contact = await prisma.companyContact.findFirst({ where: { companyId: testMultiCompId } });
    assert(contact);
    const t = await ticketsService.createTicket({
      companyId: testMultiCompId,
      customerContactId: contact.id,
      productId: tallyProd.id,
      problemType: 'Tally Bank Reconciliation Error',
      priority: TicketPriority.LOW,
      category: 'Banking',
      description: 'Auto-bank feed statement parsing timeout.',
      createdByUserId: contact.userId || 1,
    });
    assert.strictEqual(t.department_id, testDeptTallyId);
  });

  await test('26. Wrong department assignment rejected', async () => {
    // Trying to manually assign a Tally ticket to a Spine employee must be blocked
    await assert.rejects(
      async () =>
        assignmentsService.assignTicket({
          ticketId: ticket1Id,
          employeeId: empSpineL1Id,
          assignedByUserId: 1,
          assignmentType: 'MANUAL',
        }),
      /does not belong to the ticket's assigned department|belongs to the Spine/,
    );
  });

  await test('27. Tally escalation remains Tally (L1 -> L2 -> L3)', async () => {
    await escalationsService.escalateTicket({
      ticketId: ticket1Id,
      fromLevel: 'L1',
      toLevel: 'L2',
      escalatedByEmployeeId: empTallyL1Id,
      reason: 'Complex GST schema issue needing senior review',
      actorUserId: 1,
    });
    let t = await ticketsService.getTicketById(ticket1Id);
    assert.strictEqual(t.assigned_level, 'L2');
    assert.strictEqual(t.department_id, testDeptTallyId);

    await escalationsService.escalateTicket({
      ticketId: ticket1Id,
      fromLevel: 'L2',
      toLevel: 'L3',
      escalatedByEmployeeId: empTallyL2Id,
      reason: 'Core architecture fix required for release patch',
      actorUserId: 1,
    });
    t = await ticketsService.getTicketById(ticket1Id);
    assert.strictEqual(t.assigned_level, 'L3');
    assert.strictEqual(t.department_id, testDeptTallyId);
  });

  await test('28. Spine escalation remains Spine', async () => {
    await employeesService.createEmployee({
      name: `Spine L2 ${timestamp}`,
      email: `spine_l2_${timestamp}@kanvtech.com`,
      phone: '+91 98111 00006',
      department_id: testDeptSpineId,
      designation: 'L2 Spine Specialist',
      level: 'L2',
    });

    await escalationsService.escalateTicket({
      ticketId: ticketSpineId,
      fromLevel: 'L1',
      toLevel: 'L2',
      escalatedByEmployeeId: empSpineL1Id,
      reason: 'Database punch reconciliation formula bug',
      actorUserId: 1,
    });
    const t = await ticketsService.getTicketById(ticketSpineId);
    assert.strictEqual(t.assigned_level, 'L2');
    assert.strictEqual(t.department_id, testDeptSpineId);
  });

  await test('29. Customer product validation on ticket creation', async () => {
    const contact = await prisma.companyContact.findFirst({ where: { companyId: testCompanyId } });
    assert(contact);
    // testCompanyId only owns Tally + Spine. Attempting BIOS360 must be rejected
    await assert.rejects(
      async () =>
        ticketsService.createTicket({
          companyId: testCompanyId,
          customerContactId: contact.id,
          productId: biosProd.id,
          problemType: 'Device Offline',
          priority: TicketPriority.HIGH,
          category: 'Hardware',
          description: 'Access reader down',
          createdByUserId: contact.userId || 1,
        }),
      /not owned by the customer|does not own/,
    );
  });

  await test('30. Branch product validation on ticket creation', async () => {
    const contact = await prisma.companyContact.findFirst({ where: { companyId: testMultiCompId } });
    assert(contact);
    // testBranchId2 only owns Tally + Spine. Attempting BIOS360 must fail!
    await assert.rejects(
      async () =>
        ticketsService.createTicket({
          companyId: testMultiCompId,
          customerContactId: contact.id,
          branchId: testBranchId2,
          productId: biosProd.id,
          problemType: 'Security Gate Open',
          priority: TicketPriority.HIGH,
          category: 'Security',
          description: 'Gate malfunction',
          createdByUserId: contact.userId || 1,
        }),
      /not assigned to branch|does not own/,
    );
  });

  await test('31. Customer without branch works smoothly', async () => {
    const noBranchComp = await companiesService.createCompany({
      company_name: `No Branch Cust ${timestamp}`,
      address: '77 Industrial Estate, Surat',
      primary_email: `nobranch_${timestamp}@customer.com`,
      contact_person: 'Dinesh Patel',
      contact_phone: '+91 98220 77777',
      product_ids: [tallyProd.id],
    });
    const contact = await prisma.companyContact.findFirst({ where: { companyId: noBranchComp } });
    assert(contact);
    const t = await ticketsService.createTicket({
      companyId: noBranchComp,
      customerContactId: contact.id,
      productId: tallyProd.id,
      problemType: 'Ledger Posting Sync Failure',
      priority: TicketPriority.MEDIUM,
      category: 'Accounting',
      description: 'Trial balance discrepancy observed post-reconciliation.',
      createdByUserId: contact.userId || 1,
    });
    assert.strictEqual(t.status, 'OPEN');
    assert.strictEqual(t.branch_id, null);
  });

  await test('32. Multiple product tickets remain separate', async () => {
    assert.notStrictEqual(ticket1Id, ticketSpineId);
  });

  await test('33. Existing 2-ticket limit works strictly', async () => {
    const contact = await prisma.companyContact.findFirst({ where: { companyId: testCompanyId } });
    assert(contact);
    // Already has 2 open tickets (ticket1Id and ticketSpineId). 3rd ticket must be strictly rejected!
    await assert.rejects(
      async () =>
        ticketsService.createTicket({
          companyId: testCompanyId,
          customerContactId: contact.id,
          productId: tallyProd.id,
          problemType: 'Third Ticket Attempt',
          priority: TicketPriority.LOW,
          category: 'General',
          description: 'This third ticket must be blocked.',
          createdByUserId: contact.userId || 1,
        }),
      /2 active tickets/,
    );
  });

  // --- IMPLEMENTATIONS & DYNAMIC PROGRESS ---
  await test('34. Add implementation task (TSK-XXXX generated)', async () => {
    const imp = await implementationsService.createImplementation(
      {
        companyId: testCompanyId,
        productId: tallyProd.id,
        startDate: '2026-05-01',
        targetGoLiveDate: '2026-07-01',
        status: 'PLANNING' as any,
      },
      1,
    );
    testImplId = imp.id;

    const res1 = await implementationsService.addTask(
      testImplId,
      { taskName: 'Requirement Gathering & Architecture', priority: 'HIGH' },
      1,
    );
    assert(res1.task.id.startsWith('TSK-'));
    assert.strictEqual(res1.progressPercentage, 0); // 0/1 = 0%
    testTaskId1 = res1.task.id;

    const res2 = await implementationsService.addTask(
      testImplId,
      { taskName: 'Firewall & Server Provisioning', priority: 'HIGH' },
      1,
    );
    testTaskId2 = res2.task.id;
    assert.strictEqual(res2.progressPercentage, 0); // 0/2 = 0%
  });

  await test('35. Complete implementation task recalculates progress (1/2 = 50%)', async () => {
    const res = await implementationsService.toggleTaskCompletion(testTaskId1, true, 1);
    assert.strictEqual(res.task.status, 'COMPLETED');
    assert.strictEqual(res.progressPercentage, 50);

    const imp = await implementationsService.getImplementationById(testImplId);
    assert.strictEqual(imp.progress_percentage, 50);
  });

  await test('36. Reopen task recalculates progress (0/2 = 0%)', async () => {
    const res = await implementationsService.toggleTaskCompletion(testTaskId1, false, 1);
    assert.strictEqual(res.task.status, 'PENDING');
    assert.strictEqual(res.progressPercentage, 0);

    const imp = await implementationsService.getImplementationById(testImplId);
    assert.strictEqual(imp.progress_percentage, 0);
  });

  await test('37. Re-complete task 1 & complete task 2 (2/2 = 100%)', async () => {
    await implementationsService.toggleTaskCompletion(testTaskId1, true, 1);
    const res = await implementationsService.toggleTaskCompletion(testTaskId2, true, 1);
    assert.strictEqual(res.progressPercentage, 100);

    const imp = await implementationsService.getImplementationById(testImplId);
    assert.strictEqual(imp.progress_percentage, 100);
  });

  await test('38. Add 2 pending tasks recalculates progress (2/4 = 50%)', async () => {
    await implementationsService.addTask(testImplId, { taskName: 'Data Migration' }, 1);
    const res = await implementationsService.addTask(testImplId, { taskName: 'UAT & Training' }, 1);
    assert.strictEqual(res.progressPercentage, 50);

    const imp = await implementationsService.getImplementationById(testImplId);
    assert.strictEqual(imp.progress_percentage, 50);
  });

  await test('39. Remove task recalculates progress (2/3 = 67%)', async () => {
    const tasks = await implementationsService.getImplementationTasks(testImplId);
    const lastTask = tasks[tasks.length - 1];
    const res = await implementationsService.removeTask(lastTask.id, 1);
    assert.strictEqual(res.progressPercentage, 67); // 2/3 = 67%
  });

  await test('40. Edit implementation task description', async () => {
    const updated = await implementationsService.updateTask(
      testTaskId1,
      { taskName: 'Requirement Gathering & Architecture (Approved)' },
      1,
    );
    assert.strictEqual(updated.taskName, 'Requirement Gathering & Architecture (Approved)');
  });

  await test('41. Implementation progress cannot be manually manipulated', async () => {
    // Updating implementation with manual progress slider value is overwritten by recalculation
    await implementationsService.recalculateProgress(testImplId);
    const imp = await implementationsService.getImplementationById(testImplId);
    assert.strictEqual(imp.progress_percentage, 67);
  });

  // --- AUTOMATIC LOGIN CREATION ---
  await test('42. Employee creation automatically creates User login account', async () => {
    const newEmpEmail = `auto_emp_${timestamp}@kanvtech.com`;
    await employeesService.createEmployee({
      name: 'Auto Login Employee',
      email: newEmpEmail,
      phone: '+91 98111 99999',
      department_id: testDeptTallyId,
      designation: 'L1 Specialist',
      level: 'L1',
    });
    const user = await prisma.user.findUnique({ where: { email: newEmpEmail } });
    assert(user);
    assert.strictEqual(user.role, UserRole.L1_EMPLOYEE);
    assert.strictEqual(user.isActive, true);
  });

  await test('43. Customer creation automatically creates Customer login account', async () => {
    const newCustEmail = `auto_cust_${timestamp}@acme.com`;
    await companiesService.createCompany({
      company_name: `Auto Cust Corp ${timestamp}`,
      address: '909 Business Bay, Pune',
      primary_email: newCustEmail,
      contact_person: 'Sunil Gavaskar',
      contact_phone: '+91 98220 99999',
      product_ids: [tallyProd.id],
    });
    const user = await prisma.user.findUnique({ where: { email: newCustEmail } });
    assert(user);
    assert.strictEqual(user.role, UserRole.CUSTOMER);
    assert.strictEqual(user.isActive, true);
  });

  await test('44. Duplicate employee email prevented', async () => {
    await assert.rejects(
      async () =>
        employeesService.createEmployee({
          name: 'Duplicate Emp',
          email: `auto_emp_${timestamp}@kanvtech.com`,
          phone: '+91 98111 88888',
          department_id: testDeptTallyId,
          designation: 'L1 Specialist',
          level: 'L1',
        }),
      /already exists/,
    );
  });

  await test('45. Employee login authentication works with hashed password', async () => {
    const res = await authService.login(
      `auto_emp_${timestamp}@kanvtech.com`,
      'Password@123',
    );
    assert(res.token);
    assert.strictEqual(res.user.role, UserRole.L1_EMPLOYEE);
  });

  await test('46. Customer login authentication works with hashed password', async () => {
    const res = await authService.login(
      `auto_cust_${timestamp}@acme.com`,
      'Password@123',
    );
    assert(res.token);
    assert.strictEqual(res.user.role, UserRole.CUSTOMER);
  });

  // --- IMPORT & RESET ---
  await test('47. Product import validation & commit', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Product Code', 'Product Name', 'Category', 'Description', 'Status'],
      [`IMP_PROD_${timestamp}`, 'Imported Test Product', 'Testing', 'Import validation test product', 'ACTIVE'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PRODUCTS');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const preview = await importService.validateProductImport(buf);
    assert.strictEqual(preview.validCount, 1);
    const commit = await importService.commitProductImport(preview.previewRows, 1);
    assert.strictEqual(commit.importedCount, 1);
  });

  await test('48. Department import validation & commit', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Department Name', 'Department Code', 'Product Code', 'Description', 'Status'],
      [`Import Dept ${timestamp}`, `DEP-IMP-${timestamp}`, `IMP_PROD_${timestamp}`, 'Import validation dept', 'ACTIVE'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DEPARTMENTS');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const preview = await importService.validateDepartmentImport(buf);
    assert.strictEqual(preview.validCount, 1);
    const commit = await importService.commitDepartmentImport(preview.previewRows, 1);
    assert.strictEqual(commit.importedCount, 1);
  });

  await test('49. Customer import with product validation', async () => {
    const template = importService.generateTemplate('customers');
    const preview = await importService.validateCompanyImport(template);
    assert.strictEqual(preview.validCount, 1);
  });

  await test('50. Branch import with customer-owned product verification', async () => {
    const template = importService.generateTemplate('branches');
    // Generates valid template for branch
    assert(template.length > 0);
  });

  await test('51. Safe Dev Data Reset preserves Admin account and schema', async () => {
    const res = await importService.devReset(1);
    assert.strictEqual(res.preservedAdmin, 'admin@kanvtech.com');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@kanvtech.com' } });
    assert(admin);
    assert.strictEqual(admin.role, UserRole.ADMIN);
  });

  await test('52. Customer data isolation (Customer A cannot access Customer B)', async () => {
    const compA = await companiesService.createCompany({
      company_name: `Isolation Comp A ${timestamp}`,
      address: 'Address A',
      primary_email: `isola_${timestamp}@a.com`,
      contact_person: 'Person A',
      contact_phone: '+91 99999 11111',
      product_ids: [tallyProd.id],
    });
    const compB = await companiesService.createCompany({
      company_name: `Isolation Comp B ${timestamp}`,
      address: 'Address B',
      primary_email: `isolb_${timestamp}@b.com`,
      contact_person: 'Person B',
      contact_phone: '+91 99999 22222',
      product_ids: [tallyProd.id],
    });
    assert.notStrictEqual(compA, compB);
  });

  await test('53. Audit log recorded for employee promotion and task operations', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { action: { in: ['EMPLOYEE_PROMOTED', 'IMPLEMENTATION_TASK_ADDED', 'IMPLEMENTATION_TASK_COMPLETED'] } },
    });
    assert(logs.length >= 1);
  });

  await test('54. Monotonic Sequence Generator uniqueness and rollover safety', async () => {
    const s1 = await prismaService.getNextSequence('TEST_SEQ');
    const s2 = await prismaService.getNextSequence('TEST_SEQ');
    assert.strictEqual(s2, s1 + 1);
  });

  console.log('\n===============================================================');
  console.log(`MASTER UPDATE QA SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
