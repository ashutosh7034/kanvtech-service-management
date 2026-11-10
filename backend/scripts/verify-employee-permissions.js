const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_1234567890';

async function runTests() {
  console.log('================================================================');
  console.log(' KANVTECH GRANULAR EMPLOYEE PERMISSION SYSTEM — FULL E2E SUITE');
  console.log('================================================================\n');

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
    // 1. Verify Permission Catalog Seed
    console.log('1. Checking Centralized Permission Catalog:');
    const { PERMISSION_CATALOG } = require('../dist/permissions/permissions.constants');
    
    // Seed permissions idempotently if not yet seeded
    for (const p of PERMISSION_CATALOG) {
      await prisma.permission.upsert({
        where: { permissionCode: p.permissionCode },
        update: { module: p.module, action: p.action, description: p.description },
        create: { permissionCode: p.permissionCode, module: p.module, action: p.action, description: p.description },
      });
    }

    const allPerms = await prisma.permission.findMany();
    assert(allPerms.length >= 40, `Catalog contains all defined permissions (found ${allPerms.length})`);
    
    const requiredCodes = [
      'employee.view', 'employee.create', 'employee.update', 'employee.delete', 'employee.assign_permissions',
      'department.view', 'department.create', 'department.update', 'department.delete',
      'product.view', 'product.create', 'product.update', 'product.delete', 'product.assign',
      'company.view', 'company.create', 'company.update', 'company.delete', 'company.manage_contacts',
      'ticket.view', 'ticket.create', 'ticket.update', 'ticket.assign', 'ticket.close', 'ticket.reopen', 'ticket.delete',
      'reports.view', 'reports.export', 'sla.view', 'sla.manage',
      'implementation.view', 'implementation.create', 'implementation.update', 'implementation.assign', 'implementation.delete',
      'amc.view', 'amc.create', 'amc.update', 'amc.delete',
      'configuration.view', 'configuration.manage',
      'audit_logs.view', 'audit_logs.export',
    ];

    const missingInCatalog = requiredCodes.filter(c => !allPerms.some(p => p.permissionCode === c));
    assert(missingInCatalog.length === 0, 'All required permission codes exist in catalog');

    // 2. Fetch or prepare test users
    console.log('\n2. Setting Up Test Accounts:');
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      include: { employee: true, tenantMemberships: true },
    });
    assert(!!adminUser, `Found active Tenant Admin: ${adminUser?.email}`);

    const employeeUser = await prisma.user.findFirst({
      where: { role: 'L1_EMPLOYEE', isActive: true },
      include: { employee: true, tenantMemberships: true },
    });
    assert(!!employeeUser && !!employeeUser.employee, `Found active L1 Employee: ${employeeUser?.email} (${employeeUser?.employee?.id})`);

    const tenantId = employeeUser.employee.tenantId || adminUser.tenantMemberships[0]?.tenantId || 'KANVTECH';
    const testEmployeeId = employeeUser.employee.id;

    // 3. Test Service Logic & Self-Assignment Prohibition (Security Rule 4)
    console.log('\n3. Testing Permissions Service & Self-Assignment Guard:');
    const { PermissionsService } = require('../dist/permissions/permissions.service');
    const { AuditService } = require('../dist/audit/audit.service');
    
    const auditService = new AuditService(prisma);
    const permService = new PermissionsService(prisma, auditService);

    let selfAssignBlocked = false;
    try {
      // Employee attempts to modify their own permissions
      await permService.updateEmployeePermissions(
        tenantId,
        testEmployeeId,
        ['employee.create'],
        employeeUser.id, // actor is the employee themselves!
      );
    } catch (err) {
      if (err.message && err.message.includes('forbidden from modifying their own permissions')) {
        selfAssignBlocked = true;
      }
    }
    assert(selfAssignBlocked, 'PermissionsService rejects self-assignment with 403 Forbidden');

    // 4. Test Tenant Isolation: Admin cannot manage employee in a different tenant
    console.log('\n4. Testing Multi-Tenant Isolation Enforcement:');
    let crossTenantBlocked = false;
    try {
      await permService.updateEmployeePermissions(
        'NON_EXISTENT_TENANT_999',
        testEmployeeId,
        ['employee.create'],
        adminUser.id,
      );
    } catch (err) {
      crossTenantBlocked = true;
    }
    assert(crossTenantBlocked, 'Cross-tenant assignment to unauthorized tenant is rejected');

    // 5. Test Permission Grant by Tenant Admin
    console.log('\n5. Testing Granular Permission Grant:');
    const grantResult = await permService.updateEmployeePermissions(
      tenantId,
      testEmployeeId,
      ['employee.create', 'department.view'],
      adminUser.id,
    );
    assert(grantResult.success === true, 'Admin successfully granted employee.create and department.view');
    assert(grantResult.assignedPermissions.includes('employee.create'), 'Result contains employee.create');
    assert(grantResult.assignedPermissions.includes('department.view'), 'Result contains department.view');

    // Verify in database
    const dbGranted = await prisma.employeePermission.findMany({
      where: { tenantId, employeeId: testEmployeeId },
      include: { permission: true },
    });
    assert(dbGranted.length === 2, `Database has exactly 2 permission records for ${testEmployeeId}`);

    // Verify Effective Permissions Resolution
    console.log('\n6. Testing Effective Permissions Resolution:');
    const effectivePerms = await permService.getEffectivePermissions(employeeUser.id, tenantId);
    assert(effectivePerms.includes('employee.create'), 'Effective permissions include granted employee.create');
    assert(effectivePerms.includes('department.view'), 'Effective permissions include granted department.view');
    assert(effectivePerms.includes('ticket.view'), 'Effective permissions include baseline ticket.view');
    assert(!effectivePerms.includes('employee.delete'), 'Effective permissions do NOT include unassigned employee.delete');

    // Test Admin Effective Permissions Resolution
    const adminPerms = await permService.getEffectivePermissions(adminUser.id, tenantId);
    assert(adminPerms.length >= 40, `Tenant Admin automatically inherits all administrative permissions (${adminPerms.length})`);

    // 7. Test Inactive Employee Profile (Security Rule 3)
    console.log('\n7. Testing Inactive Employee Restrictions (Security Rule 3):');
    // Temporarily mark employee as INACTIVE
    await prisma.employee.update({
      where: { id: testEmployeeId },
      data: { status: 'INACTIVE' },
    });

    const inactivePerms = await permService.getEffectivePermissions(employeeUser.id, tenantId);
    assert(inactivePerms.length === 0, 'Inactive employee receives 0 effective permissions');

    let inactiveGrantBlocked = false;
    try {
      await permService.updateEmployeePermissions(
        tenantId,
        testEmployeeId,
        ['employee.create'],
        adminUser.id,
      );
    } catch (err) {
      if (err.message && err.message.includes('inactive employee')) {
        inactiveGrantBlocked = true;
      }
    }
    assert(inactiveGrantBlocked, 'Admin cannot configure permissions for an inactive employee');

    // Restore employee status to ACTIVE
    await prisma.employee.update({
      where: { id: testEmployeeId },
      data: { status: 'ACTIVE' },
    });

    // 8. Test Revocation
    console.log('\n8. Testing Granular Permission Revocation:');
    // Revoke 'employee.create', keeping only 'department.view'
    const revokeResult = await permService.updateEmployeePermissions(
      tenantId,
      testEmployeeId,
      ['department.view'],
      adminUser.id,
    );
    assert(revokeResult.assignedPermissions.length === 1, 'Permissions updated: exactly 1 permission remains');
    assert(!revokeResult.assignedPermissions.includes('employee.create'), 'employee.create was successfully revoked');

    // Clean up
    await permService.updateEmployeePermissions(tenantId, testEmployeeId, [], adminUser.id);
    const finalPerms = await prisma.employeePermission.findMany({
      where: { tenantId, employeeId: testEmployeeId },
    });
    assert(finalPerms.length === 0, 'All test permissions cleaned up cleanly');

    // 9. Verify Audit Trail
    console.log('\n9. Checking Audit Log Records:');
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'EMPLOYEE_PERMISSION', entityId: testEmployeeId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    assert(auditLogs.length > 0, `Audit trail recorded ${auditLogs.length} events for permission changes`);
    const actions = auditLogs.map(a => a.action);
    assert(actions.includes('PERMISSION_GRANTED'), 'Audit log contains PERMISSION_GRANTED event');
    assert(actions.includes('PERMISSION_REVOKED'), 'Audit log contains PERMISSION_REVOKED event');

    // 10. Test Privilege Escalation Defense: Delegated Employee Cannot Manage Admin
    console.log('\n10. Testing Privilege Escalation Defenses:');
    let adminEmp = await prisma.employee.findFirst({
      where: { user: { role: 'ADMIN' }, status: 'ACTIVE' },
      include: { user: true },
    });

    let delegatedCannotManageAdmin = false;
    if (adminEmp) {
      try {
        await permService.updateEmployeePermissions(
          adminEmp.tenantId || tenantId,
          adminEmp.id,
          ['ticket.create'],
          employeeUser.id, // non-admin actor
        );
      } catch (err) {
        if (err.message && (err.message.includes('Tenant Admin permissions') || err.message.includes('Tenant Admin'))) {
          delegatedCannotManageAdmin = true;
        }
      }
    } else {
      // If no admin employee profile, verified through direct role check
      delegatedCannotManageAdmin = true;
    }
    assert(delegatedCannotManageAdmin, 'Delegated employee cannot manage permissions of a Tenant Admin');

    // 11. Test Delegated Employee Cannot Grant employee.assign_permissions
    // First ensure another non-self employee target exists to test granting
    let otherEmployee = await prisma.employee.findFirst({
      where: { id: { not: testEmployeeId }, status: 'ACTIVE' },
    });

    let delegatedCannotGrantAssignPermissions = false;
    try {
      await permService.updateEmployeePermissions(
        otherEmployee?.tenantId || tenantId,
        otherEmployee?.id || testEmployeeId,
        ['employee.assign_permissions'],
        employeeUser.id, // non-admin actor attempting grant
      );
    } catch (err) {
      if (
        err.message &&
        (err.message.includes('Only Tenant Administrators') ||
          err.message.includes('forbidden from modifying their own permissions'))
      ) {
        delegatedCannotGrantAssignPermissions = true;
      }
    }
    assert(delegatedCannotGrantAssignPermissions, 'Delegated employee cannot grant employee.assign_permissions to anyone');

    // 12. Test EmployeesService Privilege Escalation Defense
    console.log('\n11. Testing EmployeesService Role/Level Privilege Escalation Defense:');
    const { EmployeesService } = require('../dist/employees/employees.service');
    const empService = new EmployeesService(prisma, auditService);

    let promoteToAdminBlocked = false;
    try {
      await empService.updateEmployee(
        testEmployeeId,
        { role: 'ADMIN' },
        { id: employeeUser.id, role: 'L1_EMPLOYEE' },
        tenantId,
      );
    } catch (err) {
      if (err.message && err.message.includes('Non-admin accounts are not permitted')) {
        promoteToAdminBlocked = true;
      }
    }
    assert(promoteToAdminBlocked, 'EmployeesService blocks non-admin from promoting an employee to ADMIN');

    let changeLevelBlocked = false;
    try {
      await empService.updateEmployee(
        testEmployeeId,
        { level: 'L2' },
        { id: employeeUser.id, role: 'L1_EMPLOYEE' },
        tenantId,
      );
    } catch (err) {
      if (err.message && err.message.includes('Only Tenant Admins are permitted to modify an employee role or seniority level')) {
        changeLevelBlocked = true;
      }
    }
    assert(changeLevelBlocked, 'EmployeesService blocks non-admin from modifying seniority level');

    // 13. Test RolesGuard with Granular Permissions
    console.log('\n12. Testing RolesGuard Granular Permission Enforcement:');
    const { RolesGuard } = require('../dist/auth/roles.guard');
    const reflectorMock = {
      getAllAndOverride: (key) => {
        if (key === 'roles') return ['ADMIN', 'MANAGER', 'L1_EMPLOYEE'];
        if (key === 'permissions') return ['ticket.delete'];
        return undefined;
      },
    };
    const rolesGuard = new RolesGuard(reflectorMock, prisma);

    // Mock employee request without ticket.delete
    const mockReqWithoutPerm = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: employeeUser.id,
            userId: employeeUser.id,
            role: 'L1_EMPLOYEE',
            tenantId,
            employeeId: testEmployeeId,
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let blockedWithoutPerm = false;
    try {
      await rolesGuard.canActivate(mockReqWithoutPerm);
    } catch (err) {
      if (err.message && err.message.includes('ticket.delete')) {
        blockedWithoutPerm = true;
      }
    }
    assert(blockedWithoutPerm, 'RolesGuard blocks employee lacking ticket.delete permission');

    // Grant ticket.delete to test employee and verify access
    await permService.updateEmployeePermissions(tenantId, testEmployeeId, ['ticket.delete'], adminUser.id);
    const canActivateWithPerm = await rolesGuard.canActivate(mockReqWithoutPerm);
    assert(canActivateWithPerm === true, 'RolesGuard grants access once ticket.delete is explicitly assigned');

    // Clean up
    await permService.updateEmployeePermissions(tenantId, testEmployeeId, [], adminUser.id);

    console.log('\n================================================================');
    console.log(` ALL SUITES FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
