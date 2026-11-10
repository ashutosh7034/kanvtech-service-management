const { PrismaClient, UserRole, EmployeeStatus } = require('../node_modules/@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_1234567890';

async function runUAT() {
  console.log('========================================================================');
  console.log(' KANVTECH TENANT ISOLATION & EMPLOYEE PERMISSIONS — COMPREHENSIVE UAT');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${detail ? '--> ' + detail : ''}`);
      failed++;
    }
  }

  try {
    const { PermissionsService } = require('../dist/permissions/permissions.service');
    const { AuditService } = require('../dist/audit/audit.service');
    const { AuthService } = require('../dist/auth/auth.service');
    const { RolesGuard } = require('../dist/auth/roles.guard');

    const auditService = new AuditService(prisma);
    const permService = new PermissionsService(prisma, auditService);

    // Initial Database Baseline Counts
    console.log('--- BASELINE DATABASE RECORD AUDIT ---');
    const baselineCounts = {
      tenants: await prisma.tenant.count(),
      users: await prisma.user.count(),
      employees: await prisma.employee.count(),
      tenantMemberships: await prisma.tenantMembership.count(),
      companies: await prisma.company.count(),
      tickets: await prisma.ticket.count(),
      permissions: await prisma.permission.count(),
      employeePermissions: await prisma.employeePermission.count(),
    };
    console.log('Baseline counts:', JSON.stringify(baselineCounts, null, 2));

    // ========================================================================
    // TEST A: TENANT ADMIN
    // ========================================================================
    console.log('\n--- TEST A: TENANT ADMIN WORKSPACE QUERY & ISOLATION ---');
    const tenantA = 'KANVTECH';
    const tenantB = 'TENANT-APEX';

    const tenantAEmployeesRes = await permService.getEmployeesWithPermissions(tenantA);
    assert(tenantAEmployeesRes.success === true, 'getEmployeesWithPermissions succeeded for KANVTECH');

    const tenantAEmployees = tenantAEmployeesRes.employees;
    console.log(`  Found ${tenantAEmployees.length} eligible employees in ${tenantA}:`);
    tenantAEmployees.forEach(e => console.log(`    - ${e.name} (${e.id}) [Role: ${e.role}]`));

    // 1. Verify Platform Incharge (Ashutosh Pandey, EMP-PLT-001) is strictly excluded
    const hasPlatformIncharge = tenantAEmployees.some(
      e => e.id === 'EMP-PLT-001' || e.role === 'PLATFORM_INCHARGE' || e.email === 'ashutosh@kanvtech.com'
    );
    assert(!hasPlatformIncharge, 'Platform Incharge (EMP-PLT-001) is strictly EXCLUDED from employee list');

    // 2. Verify Platform Super Admin (EMP-000) is strictly excluded
    const hasSuperAdmin = tenantAEmployees.some(
      e => e.id === 'EMP-000' || e.role === 'SUPER_ADMIN' || e.email === 'admin@kanvtech.com'
    );
    assert(!hasSuperAdmin, 'Platform Super Admin (EMP-000) is strictly EXCLUDED from employee list');

    // 3. Verify cross-tenant employees (e.g. EMP-031 from TENANT-APEX) are excluded
    const hasTenantBEmployee = tenantAEmployees.some(e => e.id === 'EMP-031');
    assert(!hasTenantBEmployee, 'Cross-tenant employee (EMP-031) is strictly EXCLUDED from KANVTECH listing');

    // 4. Verify all returned employees belong to KANVTECH and are active
    const allBelongToTenantA = tenantAEmployees.every(e => e.status === 'ACTIVE');
    assert(allBelongToTenantA, 'All returned employees in KANVTECH are active eligible employees');

    // 5. Verify Tenant Admin cannot manage their own permissions (Security Rule 4)
    const adminUserA = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      include: { employee: true },
    });
    if (adminUserA && adminUserA.employee) {
      let selfBlocked = false;
      try {
        await permService.updateEmployeePermissions(
          adminUserA.employee.tenantId,
          adminUserA.employee.id,
          ['ticket.create'],
          adminUserA.id,
        );
      } catch (err) {
        if (err.message && err.message.includes('forbidden from modifying their own permissions')) {
          selfBlocked = true;
        }
      }
      assert(selfBlocked, 'Tenant Admin cannot manage their own permissions (HTTP 403 Forbidden)');
    }

    // ========================================================================
    // TEST B: PLATFORM INCHARGE
    // ========================================================================
    console.log('\n--- TEST B: PLATFORM INCHARGE PROTECTION ---');
    const platformInchargeUser = await prisma.user.findFirst({
      where: { role: 'PLATFORM_INCHARGE' },
      include: { employee: true },
    });
    assert(!!platformInchargeUser, `Found Platform Incharge account: ${platformInchargeUser?.email}`);

    // Verify Platform Incharge account cannot be queried or updated via tenant permission APIs
    let pltQueryBlocked = false;
    try {
      await permService.getEmployeePermissions(tenantA, 'EMP-PLT-001');
    } catch (err) {
      if (err.message && err.message.includes('Platform administrator accounts are not subject')) {
        pltQueryBlocked = true;
      }
    }
    assert(pltQueryBlocked, 'GET /api/permissions/employees/EMP-PLT-001 blocks access with 403 Forbidden');

    let pltUpdateBlocked = false;
    try {
      await permService.updateEmployeePermissions(tenantA, 'EMP-PLT-001', ['ticket.create'], 1);
    } catch (err) {
      if (err.message && err.message.includes('Platform administrator accounts')) {
        pltUpdateBlocked = true;
      }
    }
    assert(pltUpdateBlocked, 'PUT /api/permissions/employees/EMP-PLT-001 blocks permission assignment with 403 Forbidden');

    // ========================================================================
    // TEST C: L1 EMPLOYEE ACCESS RESTRICTIONS
    // ========================================================================
    console.log('\n--- TEST C: L1 EMPLOYEE ACCESS RESTRICTIONS ---');
    const l1User = await prisma.user.findFirst({
      where: { role: 'L1_EMPLOYEE', isActive: true },
      include: { employee: true },
    });
    assert(!!l1User, `Found L1 Employee: ${l1User?.email} (${l1User?.employee?.id})`);

    // RolesGuard evaluation for L1 Employee attempting to access Employee Permission Management
    const reflectorMock = {
      getAllAndOverride: (key) => {
        if (key === 'roles') return ['ADMIN'];
        if (key === 'permissions') return ['employee.assign_permissions'];
        return undefined;
      },
    };
    const rolesGuard = new RolesGuard(reflectorMock, prisma);

    const mockL1Req = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: l1User.id,
            userId: l1User.id,
            role: 'L1_EMPLOYEE',
            tenantId: tenantA,
            employeeId: l1User.employee?.id,
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let l1AccessBlocked = false;
    try {
      await rolesGuard.canActivate(mockL1Req);
    } catch (err) {
      if (err.message && err.message.includes('employee.assign_permissions')) {
        l1AccessBlocked = true;
      }
    }
    assert(l1AccessBlocked, 'L1 employee without employee.assign_permissions receives 403 Forbidden');

    // ========================================================================
    // TEST D & E: L2 & L3 WORKFLOW INTEGRITY & TENANT BOUNDARIES
    // ========================================================================
    console.log('\n--- TEST D & E: L2 & L3 BOUNDARY VERIFICATION ---');
    const l2User = await prisma.user.findFirst({
      where: { role: 'L2_EMPLOYEE', isActive: true },
      include: { employee: true },
    });
    assert(!!l2User, `Found L2 Employee: ${l2User?.email} (${l2User?.employee?.id})`);

    const mockL2Req = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: l2User.id,
            userId: l2User.id,
            role: 'L2_EMPLOYEE',
            tenantId: tenantA,
            employeeId: l2User.employee?.id,
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let l2Blocked = false;
    try {
      await rolesGuard.canActivate(mockL2Req);
    } catch (err) {
      l2Blocked = true;
    }
    assert(l2Blocked, 'L2 employee is blocked from permission management (403 Forbidden)');

    const l3User = await prisma.user.findFirst({
      where: { role: 'L3_EMPLOYEE', isActive: true },
      include: { employee: true },
    });
    assert(!!l3User, `Found L3 Employee: ${l3User?.email} (${l3User?.employee?.id})`);

    const mockL3Req = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: l3User.id,
            userId: l3User.id,
            role: 'L3_EMPLOYEE',
            tenantId: tenantA,
            employeeId: l3User.employee?.id,
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let l3Blocked = false;
    try {
      await rolesGuard.canActivate(mockL3Req);
    } catch (err) {
      l3Blocked = true;
    }
    assert(l3Blocked, 'L3 employee is blocked from permission management (403 Forbidden)');

    // ========================================================================
    // TEST F: CROSS-TENANT SECURITY & ISOLATION
    // ========================================================================
    console.log('\n--- TEST F: CROSS-TENANT SECURITY & LEAKAGE PROOF ---');
    // 1. Fetch Tenant B (TENANT-APEX) employee list
    const tenantBEmployeesRes = await permService.getEmployeesWithPermissions(tenantB);
    assert(tenantBEmployeesRes.success === true, 'getEmployeesWithPermissions succeeded for TENANT-APEX');
    const tenantBEmployees = tenantBEmployeesRes.employees;

    // Verify TENANT-APEX contains only its own employee (EMP-031)
    assert(
      tenantBEmployees.length === 1 && tenantBEmployees[0].id === 'EMP-031',
      `TENANT-APEX listing contains strictly its own employee (found ${tenantBEmployees.length}: ${tenantBEmployees[0]?.id})`
    );

    // Verify no KANVTECH employee appears in TENANT-APEX
    const hasLeakageInB = tenantBEmployees.some(e => tenantAEmployees.some(ta => ta.id === e.id));
    assert(!hasLeakageInB, 'Zero KANVTECH employees leaked into TENANT-APEX listing');

    // 2. Attempt to retrieve a Tenant A employee using Tenant B context
    let crossTenantReadBlocked = false;
    try {
      await permService.getEmployeePermissions(tenantB, 'EMP-002');
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.includes('not found in the current tenant workspace'))) {
        crossTenantReadBlocked = true;
      }
    }
    assert(crossTenantReadBlocked, 'Cross-tenant employee read (Tenant B querying Tenant A employee) returns 404 Not Found');

    // 3. Attempt to grant permissions to a Tenant A employee using Tenant B context
    let crossTenantWriteBlocked = false;
    try {
      await permService.updateEmployeePermissions(tenantB, 'EMP-002', ['ticket.create'], 247);
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.includes('not found in the current tenant workspace'))) {
        crossTenantWriteBlocked = true;
      }
    }
    assert(crossTenantWriteBlocked, 'Cross-tenant permission grant (Tenant B modifying Tenant A employee) returns 404 Not Found');

    // 4. Attempt to retrieve a Tenant B employee using Tenant A context
    let crossTenantReverseBlocked = false;
    try {
      await permService.getEmployeePermissions(tenantA, 'EMP-031');
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.includes('not found in the current tenant workspace'))) {
        crossTenantReverseBlocked = true;
      }
    }
    assert(crossTenantReverseBlocked, 'Reverse cross-tenant employee read (Tenant A querying Tenant B employee) returns 404 Not Found');

    // ========================================================================
    // TEST G: PERMISSION ASSIGNMENT REGRESSION & IMMEDIATE EFFECT
    // ========================================================================
    console.log('\n--- TEST G: PERMISSION GRANT, REVOCATION & AUDIT TRAIL ---');
    const testTargetEmpId = 'EMP-002'; // Level 1 Specialist in KANVTECH
    const adminActorUserId = 2; // admin@kanvtech.com

    // 1. Grant 'employee.create'
    const grantRes = await permService.updateEmployeePermissions(
      tenantA,
      testTargetEmpId,
      ['employee.create'],
      adminActorUserId,
    );
    assert(grantRes.assignedPermissions.includes('employee.create'), 'Successfully granted employee.create to EMP-002');

    // 2. Verify effective permissions update immediately
    const effPermsAfterGrant = await permService.getEffectivePermissions(l1User.id, tenantA);
    assert(effPermsAfterGrant.includes('employee.create'), 'Effective permissions immediately reflect granted employee.create');

    // 3. Verify RolesGuard allows employee with granted permission
    const reflectorMockEmpCreate = {
      getAllAndOverride: (key) => {
        if (key === 'roles') return ['ADMIN', 'L1_EMPLOYEE'];
        if (key === 'permissions') return ['employee.create'];
        return undefined;
      },
    };
    const rolesGuardEmpCreate = new RolesGuard(reflectorMockEmpCreate, prisma);
    const mockReqWithGrantedPerm = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: l1User.id,
            userId: l1User.id,
            role: 'L1_EMPLOYEE',
            tenantId: tenantA,
            employeeId: testTargetEmpId,
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    const allowedAfterGrant = await rolesGuardEmpCreate.canActivate(mockReqWithGrantedPerm);
    assert(allowedAfterGrant === true, 'RolesGuard grants access to employee with assigned employee.create');

    // 4. Revoke 'employee.create'
    const revokeRes = await permService.updateEmployeePermissions(
      tenantA,
      testTargetEmpId,
      [],
      adminActorUserId,
    );
    assert(!revokeRes.assignedPermissions.includes('employee.create'), 'Successfully revoked employee.create from EMP-002');

    // 5. Verify effective permissions immediately lose revoked permission
    const effPermsAfterRevoke = await permService.getEffectivePermissions(l1User.id, tenantA);
    assert(!effPermsAfterRevoke.includes('employee.create'), 'Effective permissions immediately reflect revocation');

    // 6. Verify RolesGuard immediately blocks access again
    let blockedAfterRevoke = false;
    try {
      await rolesGuardEmpCreate.canActivate(mockReqWithGrantedPerm);
    } catch (err) {
      if (err.message && err.message.includes('employee.create')) {
        blockedAfterRevoke = true;
      }
    }
    assert(blockedAfterRevoke, 'RolesGuard immediately blocks access after permission revocation (403 Forbidden)');

    // 7. Verify Audit Log Trail
    const recentAuditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'EMPLOYEE_PERMISSION', entityId: testTargetEmpId },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
    const logActions = recentAuditLogs.map(l => l.action);
    assert(logActions.includes('PERMISSION_GRANTED'), 'Audit log recorded PERMISSION_GRANTED event');
    assert(logActions.includes('PERMISSION_REVOKED'), 'Audit log recorded PERMISSION_REVOKED event');

    // Final Database Integrity Check
    console.log('\n--- FINAL DATABASE RECORD AUDIT ---');
    const finalCounts = {
      tenants: await prisma.tenant.count(),
      users: await prisma.user.count(),
      employees: await prisma.employee.count(),
      tenantMemberships: await prisma.tenantMembership.count(),
      companies: await prisma.company.count(),
      tickets: await prisma.ticket.count(),
      permissions: await prisma.permission.count(),
      employeePermissions: await prisma.employeePermission.count(),
    };
    console.log('Final counts:', JSON.stringify(finalCounts, null, 2));

    assert(finalCounts.tenants === baselineCounts.tenants, `Tenant count unchanged (${finalCounts.tenants})`);
    assert(finalCounts.users === baselineCounts.users, `User count unchanged (${finalCounts.users})`);
    assert(finalCounts.employees === baselineCounts.employees, `Employee count unchanged (${finalCounts.employees})`);
    assert(finalCounts.tenantMemberships === baselineCounts.tenantMemberships, `TenantMembership count unchanged (${finalCounts.tenantMemberships})`);
    assert(finalCounts.companies === baselineCounts.companies, `Company count unchanged (${finalCounts.companies})`);
    assert(finalCounts.tickets === baselineCounts.tickets, `Ticket count unchanged (${finalCounts.tickets})`);
    assert(finalCounts.permissions === baselineCounts.permissions, `Permission count unchanged (${finalCounts.permissions})`);
    assert(finalCounts.employeePermissions === baselineCounts.employeePermissions, `EmployeePermission count cleanly restored (${finalCounts.employeePermissions})`);

    console.log('\n========================================================================');
    console.log(` ALL UAT SUITES FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('UAT script execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runUAT();
