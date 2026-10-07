import { PrismaClient, EmployeeLevel, UserRole } from '@prisma/client';
import assert from 'assert';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:5000/api';

async function main() {
  console.log('====================================================');
  console.log('ADMIN-CONTROLLED TICKET AUTO-ASSIGNMENT LEVEL TEST');
  console.log('====================================================\n');

  const ts = Date.now();
  let adminToken: string;
  let deptId: string;
  let prodId: string;
  let l1UserId: number;
  let l2UserId: number;
  let l3UserId: number;
  let l1EmpId: string;
  let l2EmpId: string;
  let l3EmpId: string;
  let customerCompanyId: string;
  let customerContactId: number;

  const createdTicketIds: string[] = [];

  try {
    // 1. Authenticate Admin
    console.log('[1/12] Authenticating as Admin...');
    const adminRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
    });
    const adminData = await adminRes.json();
    assert(adminData.token, 'Admin authentication failed');
    adminToken = adminData.token;
    console.log('✓ Admin authenticated');

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // 2. Setup Test Department & Product
    console.log('\n[2/12] Setting up Test Product & Department...');
    const prod = await prisma.product.create({
      data: {
        id: `PROD-LVL-${ts}`,
        code: `PRD-L-${ts}`,
        name: `Level Test Product ${ts}`,
        category: 'ERP',
        isActive: true,
      },
    });
    prodId = prod.id;

    const dept = await prisma.department.create({
      data: {
        id: `DEP-LVL-${ts}`,
        code: `D-LVL-${ts}`,
        name: `Level Test Dept ${ts}`,
        description: 'Auto assignment level testing department',
        isActive: true,
        specializationJson: JSON.stringify([{ productId: prodId, isComplete: true, moduleIds: [], submoduleIds: [] }]),
        products: {
          create: {
            productId: prodId,
          },
        },
      },
    });
    deptId = dept.id;

    // 3. Create L1, L2, L3 Employees in Department
    console.log('\n[3/12] Creating L1, L2, L3 Employees in Test Department...');
    l1EmpId = `EMP-L1-${ts}`;
    const l1User = await prisma.user.create({
      data: {
        email: `emp.l1.${ts}@kanvtech.com`,
        passwordHash: '$2b$10$dummyhashfortestusers000000000000000000000000000000',
        role: UserRole.L1_EMPLOYEE,
        employee: {
          create: {
            id: l1EmpId,
            name: `L1 Engineer ${ts}`,
            email: `emp.l1.${ts}@kanvtech.com`,
            phone: '+91 9999911111',
            department: dept.name,
            departmentId: deptId,
            designation: 'L1 Support Engineer',
            level: EmployeeLevel.L1,
            status: 'ACTIVE',
          },
        },
      },
      include: { employee: true },
    });
    l1UserId = l1User.id;

    l2EmpId = `EMP-L2-${ts}`;
    const l2User = await prisma.user.create({
      data: {
        email: `emp.l2.${ts}@kanvtech.com`,
        passwordHash: '$2b$10$dummyhashfortestusers000000000000000000000000000000',
        role: UserRole.L2_EMPLOYEE,
        employee: {
          create: {
            id: l2EmpId,
            name: `L2 Senior Engineer ${ts}`,
            email: `emp.l2.${ts}@kanvtech.com`,
            phone: '+91 9999922222',
            department: dept.name,
            departmentId: deptId,
            designation: 'L2 Senior Support Specialist',
            level: EmployeeLevel.L2,
            status: 'ACTIVE',
          },
        },
      },
      include: { employee: true },
    });
    l2UserId = l2User.id;

    l3EmpId = `EMP-L3-${ts}`;
    const l3User = await prisma.user.create({
      data: {
        email: `emp.l3.${ts}@kanvtech.com`,
        passwordHash: '$2b$10$dummyhashfortestusers000000000000000000000000000000',
        role: UserRole.L3_EMPLOYEE,
        employee: {
          create: {
            id: l3EmpId,
            name: `L3 Principal Architect ${ts}`,
            email: `emp.l3.${ts}@kanvtech.com`,
            phone: '+91 9999933333',
            department: dept.name,
            departmentId: deptId,
            designation: 'L3 Principal Architect',
            level: EmployeeLevel.L3,
            status: 'ACTIVE',
          },
        },
      },
      include: { employee: true },
    });
    l3UserId = l3User.id;

    // Create Customer Company
    const comp = await prisma.company.create({
      data: {
        id: `CMP-LVL-${ts}`,
        companyName: `Level Test Client ${ts}`,
        primaryEmail: `client.${ts}@kanvtech.com`,
        contactPerson: 'Client Rep',
        contactPhone: '+91 9999988888',
        address: '123 Business Way',
        isActive: true,
        products: {
          create: {
            productId: prodId,
            purchaseType: 'COMPLETE',
            isActive: true,
          },
        },
        contacts: {
          create: [
            {
              name: 'Client Rep 1',
              email: `rep1.${ts}@kanvtech.com`,
              phone: '+91 9999988881',
              designation: 'IT Head',
              isPrimary: true,
            },
            {
              name: 'Client Rep 2',
              email: `rep2.${ts}@kanvtech.com`,
              phone: '+91 9999988882',
              designation: 'Ops Head',
              isPrimary: false,
            },
          ],
        },
      },
      include: { contacts: true },
    });
    customerCompanyId = comp.id;
    customerContactId = comp.contacts[0].id;
    const customerContactId2 = comp.contacts[1].id;

    console.log(`✓ Setup Complete: Dept=${deptId}, L1=${l1EmpId}, L2=${l2EmpId}, L3=${l3EmpId}`);

    // 4. Test Default Setting = L1
    console.log('\n[4/12] Testing Default Setting (L1)...');
    await prisma.systemSetting.deleteMany({ where: { settingKey: 'TICKET_AUTO_ASSIGNMENT_LEVEL' } });
    const defGetRes = await fetch(`${API_URL}/tickets/settings/auto-assignment-level`, {
      headers: adminHeaders,
    });
    const defGetData = await defGetRes.json();
    assert.strictEqual(defGetRes.status, 200);
    assert.strictEqual(defGetData.level, 'L1', `Expected default level L1, got ${defGetData.level}`);
    console.log('✓ TEST PASS: Default Auto Assignment Level is L1');

    // 5. Test Ticket Creation with Default L1 Routing
    console.log('\n[5/12] Testing Ticket Assignment with Default L1 Setting...');
    const t1Res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: customerCompanyId,
        customerContactId: customerContactId,
        productId: prodId,
        problemType: 'Configuration Query',
        priority: 'MEDIUM',
        category: 'Software',
        description: 'Auto-assignment test under default L1',
      }),
    });
    const t1Data = await t1Res.json();
    assert.strictEqual(t1Res.status, 201, `Ticket 1 creation failed: ${JSON.stringify(t1Data)}`);
    const ticket1 = t1Data.ticket || t1Data;
    createdTicketIds.push(ticket1.id);
    const t1AssignedEmp = ticket1.assigned_employee_id ?? ticket1.assignedEmployeeId;
    const t1AssignedLvl = ticket1.assigned_level ?? ticket1.assignedLevel;
    assert.strictEqual(t1AssignedEmp, l1EmpId, `Expected ticket assigned to L1 employee ${l1EmpId}, got ${t1AssignedEmp}`);
    assert.strictEqual(t1AssignedLvl, 'L1');
    console.log(`✓ TEST PASS: Ticket ${ticket1.id} automatically assigned to L1 Employee ${l1EmpId}`);

    // 6. Test Non-Admin cannot change setting (Authorization check)
    console.log('\n[6/12] Testing Non-Admin Authorization Guard...');
    const nonAdminRes = await fetch(`${API_URL}/tickets/settings/auto-assignment-level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // No auth header
      body: JSON.stringify({ level: 'L2' }),
    });
    assert.strictEqual(nonAdminRes.status, 401, `Expected 401 Unauthorized for unauthenticated user, got ${nonAdminRes.status}`);
    console.log('✓ TEST PASS: Unauthenticated/Non-admin request rejected');

    // 7. Test Admin Changes Setting L1 -> L2 and Audit Logging
    console.log('\n[7/12] Testing Admin changes setting to L2 & Audit Log...');
    const setL2Res = await fetch(`${API_URL}/tickets/settings/auto-assignment-level`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ level: 'L2' }),
    });
    const setL2Data = await setL2Res.json();
    assert.strictEqual(setL2Res.status, 201, `Failed to set level L2: ${JSON.stringify(setL2Data)}`);
    assert.strictEqual(setL2Data.level, 'L2');

    // Verify DB persistence
    const dbSettingL2 = await prisma.systemSetting.findUnique({
      where: { settingKey: 'TICKET_AUTO_ASSIGNMENT_LEVEL' },
    });
    assert.strictEqual(dbSettingL2?.settingValue, 'L2');

    // Verify Audit Log
    const auditL2 = await prisma.auditLog.findFirst({
      where: { action: 'TICKET_ASSIGNMENT_LEVEL_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditL2, 'Audit log entry for TICKET_ASSIGNMENT_LEVEL_CHANGED not found');
    console.log(`✓ TEST PASS: Changed setting to L2. Audit logged: oldValue=${auditL2.oldValuesJson}, newValue=${auditL2.newValuesJson}`);

    // 8. Test Ticket Creation with L2 Routing
    console.log('\n[8/12] Testing Ticket Assignment with L2 Setting...');
    const t2Res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: customerCompanyId,
        customerContactId: customerContactId,
        productId: prodId,
        problemType: 'Database Query',
        priority: 'HIGH',
        category: 'Software',
        description: 'Auto-assignment test under L2 setting',
      }),
    });
    const t2Data = await t2Res.json();
    assert.strictEqual(t2Res.status, 201, `Ticket 2 creation failed: ${JSON.stringify(t2Data)}`);
    const ticket2 = t2Data.ticket || t2Data;
    createdTicketIds.push(ticket2.id);
    const t2AssignedEmp = ticket2.assigned_employee_id ?? ticket2.assignedEmployeeId;
    const t2AssignedLvl = ticket2.assigned_level ?? ticket2.assignedLevel;
    assert.strictEqual(t2AssignedEmp, l2EmpId, `Expected ticket assigned to L2 employee ${l2EmpId}, got ${t2AssignedEmp}`);
    assert.strictEqual(t2AssignedLvl, 'L2');
    console.log(`✓ TEST PASS: Ticket ${ticket2.id} automatically assigned to L2 Employee ${l2EmpId}`);

    // 9. Verify Existing Ticket (Ticket 1) was NOT modified/reassigned
    console.log('\n[9/12] Verifying Existing Ticket 1 was NOT reassigned...');
    const checkT1 = await prisma.ticket.findUnique({ where: { id: ticket1.id } });
    assert.strictEqual(checkT1?.assignedEmployeeId, l1EmpId, 'Existing ticket 1 should still belong to L1');
    assert.strictEqual(checkT1?.assignedLevel, 'L1');
    console.log('✓ TEST PASS: Existing tickets maintain their assigned employee and level');

    // 10. Test Admin Changes Setting L2 -> L3 & Ticket Creation with L3 Routing
    console.log('\n[10/12] Testing Admin changes setting to L3 & L3 Ticket Assignment...');
    const setL3Res = await fetch(`${API_URL}/tickets/settings/auto-assignment-level`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ level: 'L3' }),
    });
    const setL3Data = await setL3Res.json();
    assert.strictEqual(setL3Res.status, 201);
    assert.strictEqual(setL3Data.level, 'L3');

    const t3Res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: customerCompanyId,
        customerContactId: customerContactId2,
        productId: prodId,
        problemType: 'Architecture Review',
        priority: 'HIGH',
        category: 'Software',
        description: 'Auto-assignment test under L3 setting',
      }),
    });
    const t3Data = await t3Res.json();
    assert.strictEqual(t3Res.status, 201, `Ticket 3 creation failed: ${JSON.stringify(t3Data)}`);
    const ticket3 = t3Data.ticket || t3Data;
    createdTicketIds.push(ticket3.id);
    const t3AssignedEmp = ticket3.assigned_employee_id ?? ticket3.assignedEmployeeId;
    const t3AssignedLvl = ticket3.assigned_level ?? ticket3.assignedLevel;
    assert.strictEqual(t3AssignedEmp, l3EmpId, `Expected ticket assigned to L3 employee ${l3EmpId}, got ${t3AssignedEmp}`);
    assert.strictEqual(t3AssignedLvl, 'L3');
    console.log(`✓ TEST PASS: Ticket ${ticket3.id} automatically assigned to L3 Employee ${l3EmpId}`);

    // 11. Test No Eligible Employee at Configured Level
    console.log('\n[11/12] Testing No Eligible Employee at Configured Level Handling...');
    const isoDept = await prisma.department.create({
      data: {
        id: `DEP-ISO-${ts}`,
        code: `D-ISO-${ts}`,
        name: `Isolated Dept No L3 ${ts}`,
        isActive: true,
      },
    });
    const isoProd = await prisma.product.create({
      data: {
        id: `PRD-ISO-${ts}`,
        code: `P-ISO-${ts}`,
        name: `Isolated Product ${ts}`,
        category: 'ERP',
        isActive: true,
        departments: {
          create: { departmentId: isoDept.id },
        },
      },
    });
    const isoEmpId = `EMP-ISO-L1-${ts}`;
    const isoL1 = await prisma.user.create({
      data: {
        email: `emp.iso.l1.${ts}@kanvtech.com`,
        passwordHash: '$2b$10$dummyhashfortestusers000000000000000000000000000000',
        role: UserRole.L1_EMPLOYEE,
        employee: {
          create: {
            id: isoEmpId,
            name: `Isolated L1 ${ts}`,
            email: `emp.iso.l1.${ts}@kanvtech.com`,
            phone: '+91 9999944444',
            department: isoDept.name,
            departmentId: isoDept.id,
            designation: 'L1 Specialist',
            level: EmployeeLevel.L1,
            status: 'ACTIVE',
          },
        },
      },
      include: { employee: true },
    });

    const isoComp = await prisma.company.create({
      data: {
        id: `CMP-ISO-${ts}`,
        companyName: `Isolated Client ${ts}`,
        primaryEmail: `isoclient.${ts}@kanvtech.com`,
        contactPerson: 'Iso Contact',
        contactPhone: '+91 9999955555',
        address: 'Isolated Street',
        isActive: true,
        products: {
          create: { productId: isoProd.id, purchaseType: 'COMPLETE', isActive: true },
        },
        contacts: {
          create: { name: 'Iso Contact', email: `isocontact.${ts}@kanvtech.com`, phone: '+91 9999955555', isPrimary: true },
        },
      },
      include: { contacts: true },
    });

    // Currently setting is L3. We create a ticket for isoProd which has only an L1 employee (no L3 employee)!
    const t4Res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        companyId: isoComp.id,
        customerContactId: isoComp.contacts[0].id,
        productId: isoProd.id,
        problemType: 'No L3 available test',
        priority: 'HIGH',
        category: 'Software',
        description: 'Testing safe fallback to unassigned queue without silent L1 assignment',
      }),
    });
    const t4Data = await t4Res.json();
    assert.strictEqual(t4Res.status, 201, `Ticket 4 creation failed: ${JSON.stringify(t4Data)}`);
    const ticket4 = t4Data.ticket || t4Data;
    createdTicketIds.push(ticket4.id);

    const t4AssignedEmp = ticket4.assigned_employee_id !== undefined ? ticket4.assigned_employee_id : ticket4.assignedEmployeeId;
    assert(t4AssignedEmp === null || t4AssignedEmp === undefined || t4AssignedEmp === '', `Ticket should NOT be assigned, got: ${t4AssignedEmp}`);
    assert.strictEqual(ticket4.status, 'OPEN');

    // Check ticket history timeline for clear note
    const t4History = await prisma.ticketHistory.findMany({
      where: { ticketId: ticket4.id },
    });
    const unassignedEntry = t4History.find(h => h.actionType === 'ROUTING_UNASSIGNED');
    assert(unassignedEntry, 'ROUTING_UNASSIGNED history entry not recorded for ticket with no eligible L3');
    console.log(`✓ TEST PASS: Ticket remains in unassigned queue safely. Log: "${unassignedEntry.description}"`);

    // Clean up isolated records
    await prisma.ticketHistory.deleteMany({ where: { ticketId: ticket4.id } });
    await prisma.ticket.delete({ where: { id: ticket4.id } });
    await prisma.companyProduct.deleteMany({ where: { companyId: isoComp.id } });
    await prisma.companyContact.deleteMany({ where: { companyId: isoComp.id } });
    await prisma.company.delete({ where: { id: isoComp.id } });
    await prisma.employee.delete({ where: { id: isoEmpId } });
    await prisma.user.delete({ where: { id: isoL1.id } });
    await prisma.departmentProduct.deleteMany({ where: { departmentId: isoDept.id } });
    await prisma.product.delete({ where: { id: isoProd.id } });
    await prisma.department.delete({ where: { id: isoDept.id } });

    // 12. Restore Setting to L1
    console.log('\n[12/12] Restoring Setting to L1...');
    const restoreRes = await fetch(`${API_URL}/tickets/settings/auto-assignment-level`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ level: 'L1' }),
    });
    const restoreData = await restoreRes.json();
    assert.strictEqual(restoreRes.status, 201);
    assert.strictEqual(restoreData.level, 'L1');
    console.log('✓ Auto Assignment Level successfully restored to L1');

    console.log('\n====================================================');
    console.log('ALL 12 TARGETED ASSIGNMENT LEVEL TESTS PASSED!');
    console.log('====================================================');

  } finally {
    // Cleanup created test records
    console.log('\nCleaning up test records...');
    for (const tid of createdTicketIds) {
      await prisma.ticketHistory.deleteMany({ where: { ticketId: tid } }).catch(() => {});
      await prisma.ticket.delete({ where: { id: tid } }).catch(() => {});
    }
    if (customerCompanyId!) {
      await prisma.companyProduct.deleteMany({ where: { companyId: customerCompanyId } }).catch(() => {});
      await prisma.companyContact.deleteMany({ where: { companyId: customerCompanyId } }).catch(() => {});
      await prisma.company.delete({ where: { id: customerCompanyId } }).catch(() => {});
    }
    if (l1UserId!) {
      await prisma.employee.deleteMany({ where: { userId: l1UserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: l1UserId } }).catch(() => {});
    }
    if (l2UserId!) {
      await prisma.employee.deleteMany({ where: { userId: l2UserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: l2UserId } }).catch(() => {});
    }
    if (l3UserId!) {
      await prisma.employee.deleteMany({ where: { userId: l3UserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: l3UserId } }).catch(() => {});
    }
    if (deptId!) {
      await prisma.departmentProduct.deleteMany({ where: { departmentId: deptId } }).catch(() => {});
      await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
    }
    if (prodId!) {
      await prisma.product.delete({ where: { id: prodId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
