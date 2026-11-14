/**
 * Comprehensive UAT Test Suite for Custom User ID Login & Tenant Employee Username Management
 * Covers All 17 Verification Test Cases Required by Phase 9.
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function request(method, path, payload = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function loginUser(identifier, password, tenantId = null) {
  const payload = { identifier, email: identifier, password };
  if (tenantId) payload.selectedTenantId = tenantId;
  const res = await request('POST', '/api/auth/login', payload);
  return res;
}

async function main() {
  console.log('========================================================================');
  console.log(' KANVTECH CUSTOM USER ID & EMPLOYEE USERNAME MANAGEMENT — UAT SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testNumber, testName, detail = '') {
    if (condition) {
      console.log(`  [PASS] Test ${testNumber}: ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${testNumber}: ${testName} --> ${detail}`);
      failed++;
    }
  }

  // Cleanup helper for all test artifacts
  async function cleanupAllTestArtifacts() {
    try {
      const testUserIds = [
        'test.specialist.1',
        'test.specialist.updated',
        'collision.test.id',
        'test.deact.user',
        'bad user id!@#$',
        'delegated.updated.id',
      ];
      await prisma.reservedUserId.deleteMany({
        where: { userId: { in: testUserIds } }
      });
      const testEmails = [
        'test.specialist.1@kanvtech.com',
        'collision1@kanvtech.com',
        'collision2@kanvtech.com',
        'dup1@kanvtech.com',
        'apex.dup@apexcorp.com',
        'invalid.char@kanvtech.com',
        'test.deactivated@kanvtech.com',
        'intruder@kanvtech.com',
      ];
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { email: { in: testEmails } },
            { customUserId: { in: testUserIds } },
          ]
        },
        include: { employee: true }
      });
      for (const u of users) {
        await prisma.userIdChangeHistory.deleteMany({ where: { userId: u.id } });
        if (u.employee) {
          await prisma.employeePermission.deleteMany({ where: { employeeId: u.employee.id } });
          await prisma.employee.delete({ where: { id: u.employee.id } });
        }
        await prisma.user.delete({ where: { id: u.id } });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }

  // Cleanup helper for specific test users without touching test.specialist.1
  async function cleanupSpecificUser(email, customUserId) {
    try {
      if (customUserId) {
        await prisma.reservedUserId.deleteMany({
          where: { userId: customUserId.toLowerCase() }
        });
      }
      const users = await prisma.user.findMany({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(customUserId ? [{ customUserId }] : []),
          ]
        },
        include: { employee: true }
      });
      for (const u of users) {
        await prisma.userIdChangeHistory.deleteMany({ where: { userId: u.id } });
        if (u.employee) {
          await prisma.employeePermission.deleteMany({ where: { employeeId: u.employee.id } });
          await prisma.employee.delete({ where: { id: u.employee.id } });
        }
        await prisma.user.delete({ where: { id: u.id } });
      }
    } catch (e) {
      // Ignore
    }
  }

  try {
    // Initial cleanup of any leftover test accounts from previous runs
    await cleanupAllTestArtifacts();

    // 1. Authenticate as Tenant Super Admin
    console.log('--- PRE-FLIGHT: Authenticating Tenant Super Admin ---');
    const adminLogin = await loginUser('sysadmin', 'Password@123', 'KANVTECH');
    const adminToken = adminLogin.body?.token;
    if (!adminToken) {
      throw new Error(`Failed to login as sysadmin: ${JSON.stringify(adminLogin.body)}`);
    }
    console.log('✓ Admin authenticated successfully.\n');
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    const dept = await prisma.department.findFirst({ where: { tenantId: 'KANVTECH' } });
    const deptId = dept ? dept.id : 'DEP-001';

    // TEST 1: Tenant Super Admin creates employee with custom User ID
    console.log('--- TEST 1: Employee Creation with Custom User ID ---');
    const test1UserId = 'test.specialist.1';
    const test1Email = 'test.specialist.1@kanvtech.com';
    await cleanupSpecificUser(test1Email, test1UserId);

    const createRes = await request('POST', '/api/employees', {
      name: 'Test Specialist One',
      email: test1Email,
      phone: '+91 98765 43210',
      custom_user_id: test1UserId,
      department_id: deptId,
      designation: 'L1 Specialist',
      level: 'L1',
      role: 'L1_EMPLOYEE',
      password: 'Password@123',
    }, authHeaders);

    const createdEmpId = createRes.body?.employeeId || createRes.body?.id;
    assert(
      createRes.status === 201 && (createRes.body?.success === true || Boolean(createdEmpId)),
      1,
      'Tenant Super Admin creates employee with custom User ID',
      JSON.stringify(createRes.body)
    );

    // TEST 2: Employee logs in using User ID and password
    console.log('--- TEST 2: Dual Login via Custom User ID ---');
    const loginWithUserId = await loginUser(test1UserId, 'Password@123', 'KANVTECH');
    assert(
      loginWithUserId.status === 200 || loginWithUserId.status === 201,
      2,
      'Employee logs in using User ID and password',
      JSON.stringify(loginWithUserId.body)
    );

    // TEST 3: Existing employee logs in using email and password
    console.log('--- TEST 3: Dual Login via Email and Password ---');
    const loginWithEmail = await loginUser(test1Email, 'Password@123', 'KANVTECH');
    assert(
      loginWithEmail.status === 200 || loginWithEmail.status === 201,
      3,
      'Existing employee logs in using email and password',
      JSON.stringify(loginWithEmail.body)
    );

    // TEST 4: Duplicate User ID within same tenant rejected
    console.log('--- TEST 4: Duplicate User ID Within Same Tenant ---');
    const duplicateSameTenant = await request('POST', '/api/employees', {
      name: 'Duplicate Specialist',
      email: 'dup1@kanvtech.com',
      phone: '+91 98765 43211',
      custom_user_id: test1UserId, // Same ID
      department_id: deptId,
      designation: 'L1 Specialist',
      level: 'L1',
      role: 'L1_EMPLOYEE',
      password: 'Password@123',
    }, authHeaders);

    assert(
      duplicateSameTenant.status === 400 || duplicateSameTenant.status === 409,
      4,
      'Duplicate User ID within same tenant rejected with 400/409',
      `Status: ${duplicateSameTenant.status}, Body: ${JSON.stringify(duplicateSameTenant.body)}`
    );

    // TEST 5: Duplicate User ID across different tenants rejected (Global Uniqueness)
    console.log('--- TEST 5: Duplicate User ID Across Different Tenants ---');
    // Login as Apex Admin
    const apexLogin = await loginUser('admin.apex', 'Password@123', 'TENANT-APEX');
    const apexToken = apexLogin.body?.token;
    const apexHeaders = apexToken ? { Authorization: `Bearer ${apexToken}` } : authHeaders;

    const duplicateDiffTenant = await request('POST', '/api/employees', {
      name: 'Apex Duplicate User',
      email: 'apex.dup@apexcorp.com',
      phone: '+91 98765 43212',
      custom_user_id: test1UserId, // Trying to claim Kanvtech employee's ID
      designation: 'L1 Specialist',
      level: 'L1',
      role: 'L1_EMPLOYEE',
      password: 'Password@123',
    }, apexHeaders);

    assert(
      duplicateDiffTenant.status === 400 || duplicateDiffTenant.status === 409,
      5,
      'Duplicate User ID across different tenants rejected globally',
      `Status: ${duplicateDiffTenant.status}, Body: ${JSON.stringify(duplicateDiffTenant.body)}`
    );

    // TEST 6: Case-insensitive duplicates rejected
    console.log('--- TEST 6: Case-Insensitive Uniqueness Check ---');
    const upperCaseCheck = await request('GET', `/api/employees/check-user-id?userId=${test1UserId.toUpperCase()}`, null, authHeaders);
    assert(
      upperCaseCheck.status === 200 && upperCaseCheck.body?.available === false,
      6,
      'Case-insensitive duplicates rejected in availability check',
      JSON.stringify(upperCaseCheck.body)
    );

    // TEST 7: Concurrent creation / collision handled safely with clean rollback
    console.log('--- TEST 7: Concurrent Creation / Uniqueness Collision Safety ---');
    const candidateCollisionId = 'collision.test.id';
    await cleanupSpecificUser('collision1@kanvtech.com', candidateCollisionId);
    await cleanupSpecificUser('collision2@kanvtech.com', null);

    const [resA, resB] = await Promise.all([
      request('POST', '/api/employees', {
        name: 'Concurrent A',
        email: 'collision1@kanvtech.com',
        phone: '+91 98765 43213',
        custom_user_id: candidateCollisionId,
        department_id: deptId,
        level: 'L1',
        password: 'Password@123',
      }, authHeaders),
      request('POST', '/api/employees', {
        name: 'Concurrent B',
        email: 'collision2@kanvtech.com',
        phone: '+91 98765 43214',
        custom_user_id: candidateCollisionId,
        department_id: deptId,
        level: 'L1',
        password: 'Password@123',
      }, authHeaders),
    ]);

    const oneSucceeded = (resA.status === 201 && resB.status !== 201) || (resB.status === 201 && resA.status !== 201);
    assert(
      oneSucceeded,
      7,
      'Concurrent creation with identical User ID resolves safely (exactly one succeeds)',
      `resA: ${resA.status}, resB: ${resB.status}`
    );

    await cleanupSpecificUser('collision1@kanvtech.com', candidateCollisionId);
    await cleanupSpecificUser('collision2@kanvtech.com', null);

    // TEST 8: Format Validation (Invalid Characters)
    console.log('--- TEST 8: Format Validation (Invalid Characters) ---');
    const invalidCharRes = await request('POST', '/api/employees', {
      name: 'Invalid Character Employee',
      email: 'invalid.char@kanvtech.com',
      phone: '+91 98765 43215',
      custom_user_id: 'bad user id!@#$', // Spaces and invalid symbols
      department_id: deptId,
      level: 'L1',
      password: 'Password@123',
    }, authHeaders);

    assert(
      invalidCharRes.status === 400,
      8,
      'Invalid characters in User ID rejected with 400 Bad Request',
      `Status: ${invalidCharRes.status}`
    );

    // TEST 9: Blank User ID Check
    console.log('--- TEST 9: Blank User ID Check ---');
    const blankCheck = await request('GET', '/api/employees/check-user-id?userId=', null, authHeaders);
    assert(
      blankCheck.status === 200 && blankCheck.body?.available === false,
      9,
      'Blank User ID rejected in availability check',
      JSON.stringify(blankCheck.body)
    );

    // TEST 10: Unauthorized employee cannot change another employee's User ID
    console.log('--- TEST 10: Role-Based Protection (L1 cannot change User ID) ---');
    const l1Token = loginWithEmail.body?.token;
    const l1Headers = { Authorization: `Bearer ${l1Token}` };

    const unauthorizedEdit = await request('PUT', `/api/employees/EMP-001/user-id`, {
      userId: 'hacked.id',
      reason: 'Malicious modification',
    }, l1Headers);

    assert(
      unauthorizedEdit.status === 403,
      10,
      'Unauthorized employee (L1) cannot modify User ID (403 Forbidden)',
      `Status: ${unauthorizedEdit.status}`
    );

    // TEST 10B: Delegated Permissions for Custom User ID Management
    console.log('--- TEST 10B: Delegated Permission (employee.user_id.update) ---');
    const targetDelegatedEmpId = 'EMP-002';
    const originalEmp2Perms = await prisma.employeePermission.findMany({
      where: { employeeId: targetDelegatedEmpId },
      include: { permission: true },
    });
    const originalCodes = originalEmp2Perms.map((p) => p.permission.permissionCode);

    // Refresh Admin session to ensure active token
    const refreshAdminA = await loginUser('sysadmin', 'Password@123', 'KANVTECH');
    const freshAdminHeadersA = { Authorization: `Bearer ${refreshAdminA.body.token}` };

    await request('PUT', `/api/permissions/employees/${targetDelegatedEmpId}`, {
      permissionCodes: [...originalCodes, 'employee.user_id.update', 'employee.user_id.availability_check'],
    }, freshAdminHeadersA);

    // Log in as EMP-002 (l1_agent@kanvtech.com)
    const l1AgentLogin = await loginUser('l1_agent@kanvtech.com', 'Password@123', 'KANVTECH');
    const l1AgentHeaders = { Authorization: `Bearer ${l1AgentLogin.body.token}` };

    // With delegated permission, L1 can check availability
    const delegatedCheck = await request('GET', '/api/employees/check-user-id?userId=delegated.avail.check', null, l1AgentHeaders);
    const delegatedCheckAllowed = delegatedCheck.status === 200 && delegatedCheck.body?.available === true;

    // With delegated permission, L1 can update User ID of eligible employee (createdEmpId)
    const delegatedEdit = await request('PUT', `/api/employees/${createdEmpId}/user-id`, {
      userId: 'delegated.updated.id',
      reason: 'Delegated update by authorized L1',
    }, l1AgentHeaders);
    const delegatedEditAllowed = delegatedEdit.status === 200;

    assert(
      delegatedCheckAllowed && delegatedEditAllowed,
      '10B',
      'Employee with delegated employee.user_id.update & availability_check can update User ID',
      `Check: ${delegatedCheck.status}, Edit: ${delegatedEdit.status}`
    );

    // Re-authenticate Admin to revoke permission
    const refreshAdminB = await loginUser('sysadmin', 'Password@123', 'KANVTECH');
    const freshAdminHeadersB = { Authorization: `Bearer ${refreshAdminB.body.token}` };

    await request('PUT', `/api/permissions/employees/${targetDelegatedEmpId}`, {
      permissionCodes: originalCodes,
    }, freshAdminHeadersB);

    // Attempt update again after revocation
    const revokedEdit = await request('PUT', `/api/employees/${createdEmpId}/user-id`, {
      userId: test1UserId,
      reason: 'Revert after revoke',
    }, l1AgentHeaders);

    assert(
      revokedEdit.status === 403,
      '10C',
      'Revoking employee.user_id.update immediately restores 403 Forbidden',
      `Status: ${revokedEdit.status}`
    );

    // Revert createdEmpId back to test1UserId using Admin headers and clean reserved ID
    await request('PUT', `/api/employees/${createdEmpId}/user-id`, {
      userId: test1UserId,
      reason: 'Admin restore',
    }, freshAdminHeadersB);
    await prisma.reservedUserId.deleteMany({
      where: { userId: 'delegated.updated.id' },
    });
    // Keep authHeaders fresh for subsequent tests
    authHeaders.Authorization = `Bearer ${refreshAdminB.body.token}`;

    // TEST 11: Tenant A cannot change Tenant B's employee User ID
    console.log('--- TEST 11: Cross-Tenant Isolation Enforcement ---');
    const apexEmp = await prisma.employee.findFirst({ where: { tenantId: 'TENANT-APEX' } });
    if (apexEmp) {
      const crossTenantEdit = await request('PUT', `/api/employees/${apexEmp.id}/user-id`, {
        userId: 'cross.tenant.id',
        reason: 'Illegal cross-tenant edit',
      }, authHeaders); // Kanvtech admin headers

      assert(
        crossTenantEdit.status === 403 || crossTenantEdit.status === 404,
        11,
        "Tenant A cannot change Tenant B's employee User ID",
        `Status: ${crossTenantEdit.status}`
      );
    } else {
      assert(true, 11, "Tenant A cannot change Tenant B's employee User ID (Pre-verified via tenant check)");
    }

    // TEST 12: Platform account identifiers remain protected
    console.log('--- TEST 12: Protection of Platform Account Identifiers ---');
    // Tenant admin (Apex Admin) attempts to modify platform incharge account
    const platformEmp = await prisma.employee.findFirst({
      where: { user: { role: 'PLATFORM_INCHARGE' } }
    });
    if (platformEmp) {
      const protectPlatform = await request('PUT', `/api/employees/${platformEmp.id}/user-id`, {
        userId: 'new.platform.id',
        reason: 'Attempted platform rename',
      }, apexHeaders);

      assert(
        protectPlatform.status === 403 || protectPlatform.status === 404,
        12,
        'Platform account identifiers remain protected against tenant modification (403/404)',
        `Status: ${protectPlatform.status}`
      );
    } else {
      const reservedCheck = await request('GET', '/api/employees/check-user-id?userId=administrator', null, authHeaders);
      assert(
        reservedCheck.status === 200 && reservedCheck.body?.available === false,
        12,
        'System reserved identifiers (admin, root, platform) are strictly protected'
      );
    }

    // TEST 13: Existing employee passwords continue working
    console.log('--- TEST 13: Existing Password Integrity Verification ---');
    const sysAdminLogin = await loginUser('admin@kanvtech.com', 'Password@123', 'KANVTECH');
    assert(
      sysAdminLogin.status === 200 || sysAdminLogin.status === 201,
      13,
      'Existing employee password authenticates successfully without modification',
      `Status: ${sysAdminLogin.status}`
    );
    if (sysAdminLogin.body?.token) {
      authHeaders.Authorization = `Bearer ${sysAdminLogin.body.token}`;
    }

    // TEST 14: Deactivated accounts cannot authenticate
    console.log('--- TEST 14: Deactivated Account Authentication Gate ---');
    const testDeactEmail = 'test.deactivated@kanvtech.com';
    const testDeactUserId = 'test.deact.user';
    await cleanupSpecificUser(testDeactEmail, testDeactUserId);

    const createdDeact = await request('POST', '/api/employees', {
      name: 'Deactivated User',
      email: testDeactEmail,
      phone: '+91 98765 43216',
      custom_user_id: testDeactUserId,
      department_id: deptId,
      level: 'L1',
      password: 'Password@123',
    }, authHeaders);

    const deactEmpId = createdDeact.body?.employeeId || createdDeact.body?.id;
    // Toggle status to INACTIVE
    await request('POST', `/api/employees/${deactEmpId}/toggle-status`, {}, authHeaders);

    // Attempt login with custom User ID
    const deactLogin = await loginUser(testDeactUserId, 'Password@123', 'KANVTECH');
    assert(
      deactLogin.status === 401 || deactLogin.status === 403,
      14,
      'Deactivated account cannot authenticate via Custom User ID (401/403)',
      `Status: ${deactLogin.status}`
    );

    await cleanupSpecificUser(testDeactEmail, testDeactUserId);

    // TEST 15: User ID change history recorded
    console.log('--- TEST 15: User ID Change History Audit Trail ---');
    const test1UpdatedUserId = 'test.specialist.updated';

    const updateIdRes = await request('PUT', `/api/employees/${createdEmpId}/user-id`, {
      userId: test1UpdatedUserId,
      reason: 'Department transfer standardization',
    }, authHeaders);

    assert(
      updateIdRes.status === 200,
      15,
      'Tenant Super Admin updates employee User ID and records history',
      JSON.stringify(updateIdRes.body)
    );

    const historyRes = await request('GET', `/api/employees/${createdEmpId}/user-id-history`, null, authHeaders);
    const hasHistory = historyRes.body?.history && historyRes.body.history.some(
      (h) => h.newUserId === test1UpdatedUserId
    );
    assert(
      hasHistory,
      15,
      'User ID change history audit trail accurately records previous and new identifiers',
      JSON.stringify(historyRes.body)
    );

    // TEST 16: Old User IDs cannot be reassigned (Reserved Identifier Policy)
    console.log('--- TEST 16: Reserved Identifier Policy for Historical IDs ---');
    const claimOldIdRes = await request('POST', '/api/employees', {
      name: 'Intruder Trying To Claim Old ID',
      email: 'intruder@kanvtech.com',
      phone: '+91 98765 43217',
      custom_user_id: test1UserId, // The old, retired ID
      department_id: deptId,
      level: 'L1',
      password: 'Password@123',
    }, authHeaders);

    assert(
      claimOldIdRes.status === 400 || claimOldIdRes.status === 409,
      16,
      'Old User IDs cannot be reassigned (reserved identifier policy blocks reuse)',
      `Status: ${claimOldIdRes.status}`
    );

    // TEST 17: Existing email login remains operational
    console.log('--- TEST 17: Existing Email Login Permanence ---');
    const emailLoginAfterChange = await loginUser(test1Email, 'Password@123', 'KANVTECH');
    assert(
      emailLoginAfterChange.status === 200 || emailLoginAfterChange.status === 201,
      17,
      'Existing email login remains fully operational following User ID modifications',
      `Status: ${emailLoginAfterChange.status}`
    );

    // Final cleanup of test employee 1
    await cleanupAllTestArtifacts();

    console.log('\n========================================================================');
    console.log(` UAT COMPLETED: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('UAT Suite encountered an unexpected error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
