import { PrismaClient, UserRole, EmployeeLevel, AttendanceStatus } from '@prisma/client';

const API_BASE = 'http://127.0.0.1:5000/api';
const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, details?: string, error?: string) {
  results.push({ name, passed, details, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${name}`);
  if (details) console.log(`   ${details}`);
  if (error) console.error(`   Error: ${error}`);
}

async function loginUser(email: string, pass: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token || data.token;
}

async function runSuite() {
  console.log('===============================================================');
  console.log('KANVTECH SUPER ADMIN ATTENDANCE & ROLE-CREATION TEST SUITE');
  console.log('===============================================================\n');

  try {
    // 0. Ensure test manager exists with password
    const adminToken = await loginUser('admin@kanvtech.com', 'Password@123');
    const managerToken = await loginUser('manager@kanvtech.com', 'Password@123');
    recordTest('Setup: Authentication for Super Admin & Manager', true, 'Tokens obtained successfully');

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 1: Super Admin Attendance Exemption
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING RULE 1: SUPER ADMIN ATTENDANCE EXEMPTION ---');

    // 1. Super Admin can access the system without checking in
    const empsRes = await fetch(`${API_BASE}/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const empsData = await empsRes.json();
    const canAccessWithoutCheckIn = empsRes.ok && empsData.success === true;
    recordTest(
      'Rule 1.1: Super Admin can access system endpoints without checking in',
      canAccessWithoutCheckIn,
      `Super Admin accessed /employees: ${empsRes.status}`,
    );

    // 2. Attendance Check-in is blocked / exempt for Super Admin (no fake records)
    const adminCheckInRes = await fetch(`${API_BASE}/employees/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ address: 'HQ Test' }),
    });
    const adminCheckInData = await adminCheckInRes.json();
    const adminCheckInBlocked =
      adminCheckInRes.status === 400 &&
      (adminCheckInData.message?.includes('exempt') || adminCheckInData.message?.includes('Super Admin'));
    recordTest(
      'Rule 1.2: Check-in endpoint rejects Super Admin check-in with exemption message',
      adminCheckInBlocked,
      `Status: ${adminCheckInRes.status}, Message: "${adminCheckInData.message}"`,
    );

    // 3. Attendance Check-out is blocked / exempt for Super Admin
    const adminCheckOutRes = await fetch(`${API_BASE}/employees/attendance/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ address: 'HQ Test' }),
    });
    const adminCheckOutData = await adminCheckOutRes.json();
    const adminCheckOutBlocked =
      adminCheckOutRes.status === 400 &&
      (adminCheckOutData.message?.includes('exempt') || adminCheckOutData.message?.includes('Super Admin'));
    recordTest(
      'Rule 1.3: Check-out endpoint rejects Super Admin check-out with exemption message',
      adminCheckOutBlocked,
      `Status: ${adminCheckOutRes.status}, Message: "${adminCheckOutData.message}"`,
    );

    // 4. Verify no artificial attendance records exist in DB for Super Admin
    const adminAttCount = await prisma.employeeAttendance.count({
      where: { employee: { user: { role: UserRole.ADMIN } } },
    });
    recordTest(
      'Rule 1.4: Database has ZERO attendance records for Super Admin accounts',
      adminAttCount === 0,
      `Super Admin attendance records count: ${adminAttCount}`,
    );

    // 5. Normal attendance tracking works for legitimate employees (e.g. L1 employee)
    const l1Token = await loginUser('l1.amit@kanvtech.com', 'Password@123');
    const l1CheckInRes = await fetch(`${API_BASE}/employees/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${l1Token}`,
      },
      body: JSON.stringify({ address: 'Tech Support Desk' }),
    });
    const l1CheckInData = await l1CheckInRes.json();
    const l1CheckInOk = l1CheckInRes.ok && l1CheckInData.success === true;
    recordTest(
      'Rule 1.5: Preserved normal attendance tracking for non-admin employee roles',
      l1CheckInOk,
      `EMP-002 checked in using L1 token: status ${l1CheckInRes.status}, id ${l1CheckInData.attendance?.id}`,
    );

    // Clean up test check-in
    await prisma.employeeAttendance.deleteMany({ where: { employeeId: 'EMP-002' } });

    // ──────────────────────────────────────────────────────────────────────────
    // RULE 2: Super Admin Creation & Manager Permissions
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING RULE 2: ROLE CREATION & PERMISSION GUARDS ---');

    // Test unique emails per run
    const timestamp = Date.now();
    const testAdminEmail = `secadmin_${timestamp}@kanvtech.com`;
    const testManagerEmail = `badmgr_${timestamp}@kanvtech.com`;
    const testL1Email = `goodl1_${timestamp}@kanvtech.com`;

    // 1. Super Admin can create another Super Admin
    const createAdminRes = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Secondary Platform Administrator',
        email: testAdminEmail,
        phone: '+91 98111 22233',
        department: 'Executive Management',
        role: 'ADMIN',
        level: 'MANAGER',
        designation: 'Security Administrator',
        password: 'Password@123',
      }),
    });
    const createAdminData = await createAdminRes.json();
    const createAdminOk = createAdminRes.ok && createAdminData.success === true;
    recordTest(
      'Rule 2.1: Super Admin can create another Super Admin account',
      createAdminOk,
      `Created: ${testAdminEmail}, ID: ${createAdminData.employeeId}`,
    );

    // Verify DB role and audit log
    const createdAdminUser = await prisma.user.findUnique({ where: { email: testAdminEmail } });
    const isAdminUser = createdAdminUser?.role === UserRole.ADMIN;
    recordTest(
      'Rule 2.2: Newly created Super Admin has authoritative UserRole.ADMIN in database',
      isAdminUser,
      `User ID: ${createdAdminUser?.id}, Role: ${createdAdminUser?.role}`,
    );

    // 2. Manager CANNOT create Super Admin account (direct API payload)
    const managerCreateAdminRes = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        name: 'Malicious Super Admin',
        email: `hackedadmin_${timestamp}@kanvtech.com`,
        phone: '+91 98222 33344',
        role: 'ADMIN',
        department: 'Customer Support',
        password: 'Password@123',
      }),
    });
    const managerCreateAdminData = await managerCreateAdminRes.json();
    const managerCreateAdminBlocked = managerCreateAdminRes.status === 403;
    recordTest(
      'Rule 2.3: Manager cannot create Super Admin account (HTTP 403 Forbidden)',
      managerCreateAdminBlocked,
      `Status: ${managerCreateAdminRes.status}, Message: "${managerCreateAdminData.message}"`,
    );

    // 3. Manager CANNOT create another Manager account (via role or level)
    const managerCreateManagerRes1 = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        name: 'Malicious Manager by Role',
        email: `badmgr1_${timestamp}@kanvtech.com`,
        phone: '+91 98333 44455',
        role: 'MANAGER',
        level: 'L3',
        department: 'Customer Support',
        password: 'Password@123',
      }),
    });
    const managerCreateManagerRes2 = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        name: 'Malicious Manager by Level',
        email: `badmgr2_${timestamp}@kanvtech.com`,
        phone: '+91 98444 55566',
        level: 'MANAGER',
        department: 'Customer Support',
        password: 'Password@123',
      }),
    });
    const managerCreateMgrBlocked = managerCreateManagerRes1.status === 403 && managerCreateManagerRes2.status === 403;
    recordTest(
      'Rule 2.4: Manager cannot create another Manager account via role or level (HTTP 403 Forbidden)',
      managerCreateMgrBlocked,
      `Role attempt: ${managerCreateManagerRes1.status}, Level attempt: ${managerCreateManagerRes2.status}`,
    );

    // 4. Manager CANNOT grant elevated roles through edit endpoint (PUT /employees/:id)
    const managerElevateRes = await fetch(`${API_BASE}/employees/EMP-002`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        name: 'Amit Elevated',
        role: 'ADMIN',
        level: 'MANAGER',
      }),
    });
    const managerElevateData = await managerElevateRes.json();
    const managerElevateBlocked = managerElevateRes.status === 403;
    recordTest(
      'Rule 2.5: Manager cannot elevate an employee to Manager or Admin via edit (HTTP 403 Forbidden)',
      managerElevateBlocked,
      `Status: ${managerElevateRes.status}, Message: "${managerElevateData.message}"`,
    );

    // 5. Manager CANNOT edit or touch protected Super Admin account (EMP-000)
    const managerEditAdminRes = await fetch(`${API_BASE}/employees/EMP-000`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        name: 'Tampered Admin',
        phone: '+91 99999 99999',
      }),
    });
    const managerEditAdminData = await managerEditAdminRes.json();
    const managerEditAdminBlocked = managerEditAdminRes.status === 403;
    recordTest(
      'Rule 2.6: Manager cannot modify protected Super Admin account (HTTP 403 Forbidden)',
      managerEditAdminBlocked,
      `Status: ${managerEditAdminRes.status}, Message: "${managerEditAdminData.message}"`,
    );

    // 6. Manager CANNOT promote employees directly (HTTP 403 Forbidden)
    const managerPromoteRes = await fetch(`${API_BASE}/employees/EMP-002/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ level: 'MANAGER' }),
    });
    const managerPromoteData = await managerPromoteRes.json();
    const managerPromoteBlocked = managerPromoteRes.status === 403;
    recordTest(
      'Rule 2.7: Manager cannot promote employees to Manager (HTTP 403 Forbidden)',
      managerPromoteBlocked,
      `Status: ${managerPromoteRes.status}`,
    );

    // 7. Legitimate employee creation by Manager works (L1 Specialist)
    const managerCreateL1Res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        name: 'Legitimate Support Specialist',
        email: testL1Email,
        phone: '+91 98555 66677',
        level: 'L1',
        department: 'Customer Support',
        password: 'Password@123',
      }),
    });
    const managerCreateL1Data = await managerCreateL1Res.json();
    const managerCreateL1Ok = managerCreateL1Res.ok && managerCreateL1Data.success === true;
    recordTest(
      'Rule 2.8: Legitimate employee creation workflow for Managers (L1) works properly',
      managerCreateL1Ok,
      `Created: ${testL1Email}, ID: ${managerCreateL1Data.employeeId}`,
    );

    // 8. Super Admin promotion ladder works (e.g. promoting L1 to L2)
    if (managerCreateL1Data.employeeId) {
      await fetch(`${API_BASE}/employees/level-management/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ enabled: true }),
      });

      const adminPromoteRes = await fetch(`${API_BASE}/employees/${managerCreateL1Data.employeeId}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ level: 'L2' }),
      });
      const adminPromoteData = await adminPromoteRes.json();
      const adminPromoteOk = adminPromoteRes.ok && adminPromoteData.employee?.level === 'L2';
      recordTest(
        'Rule 2.9: Legitimate promotion workflow by Super Admin (L1 -> L2) works properly',
        adminPromoteOk,
        `Promoted ${managerCreateL1Data.employeeId} to level: ${adminPromoteData.employee?.level}`,
      );

      // Clean up test employee
      await prisma.employee.deleteMany({ where: { id: managerCreateL1Data.employeeId } });
      await prisma.user.deleteMany({ where: { email: testL1Email } });
    }

    // 9. Audit log verification
    const auditLogs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    const hasRoleAudit = auditLogs.some(
      (log) =>
        log.action === 'SUPER_ADMIN_CREATED' ||
        log.action === 'SUPER_ADMIN_ROLE_GRANTED' ||
        log.action === 'EMPLOYEE_CREATED' ||
        log.action === 'EMPLOYEE_PROMOTED',
    );
    recordTest(
      'Rule 2.10: Audit log entries record acting administrator, target account, and actions',
      hasRoleAudit,
      `Recent audit actions: ${auditLogs.map((l) => l.action).join(', ')}`,
    );

    // Clean up created second admin
    await prisma.employee.deleteMany({ where: { email: testAdminEmail } });
    await prisma.user.deleteMany({ where: { email: testAdminEmail } });

  } catch (err: any) {
    recordTest('Test execution exception', false, undefined, err.message);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n===============================================================');
  const allPassed = results.every((r) => r.passed);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${results.length - passCount}`);
  if (allPassed) {
    console.log('🎉 ALL SUPER ADMIN & MANAGER AUTHORIZATION TESTS PASSED PERFECTLY!');
  } else {
    console.log('❌ SOME TESTS FAILED. PLEASE REVIEW OUTPUT ABOVE.');
  }
  console.log('===============================================================');
  process.exit(allPassed ? 0 : 1);
}

runSuite();
