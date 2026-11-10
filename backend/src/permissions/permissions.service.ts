import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSION_CATALOG, PermissionDefinition } from './permissions.constants';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedPermissions();
  }

  /**
   * Idempotently seeds the Permission catalog into the database.
   */
  async seedPermissions(): Promise<void> {
    try {
      this.logger.log('Seeding granular permission catalog...');
      for (const perm of PERMISSION_CATALOG) {
        await this.prisma.permission.upsert({
          where: { permissionCode: perm.permissionCode },
          update: {
            module: perm.module,
            action: perm.action,
            description: perm.description,
          },
          create: {
            permissionCode: perm.permissionCode,
            module: perm.module,
            action: perm.action,
            description: perm.description,
          },
        });
      }
      this.logger.log(`Permission catalog verified: ${PERMISSION_CATALOG.length} permissions ready.`);
    } catch (error: any) {
      this.logger.error(`Failed to seed permissions: ${error.message}`);
    }
  }

  /**
   * Returns the centralized permission catalog grouped by module.
   */
  async getCatalog() {
    const dbPermissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { permissionCode: 'asc' }],
    });

    // Group permissions by module with friendly labels
    const moduleMap = new Map<string, { module: string; moduleLabel: string; permissions: any[] }>();

    for (const perm of dbPermissions) {
      const def = PERMISSION_CATALOG.find((p) => p.permissionCode === perm.permissionCode);
      const moduleLabel = def ? def.moduleLabel : perm.module.toUpperCase();

      if (!moduleMap.has(perm.module)) {
        moduleMap.set(perm.module, {
          module: perm.module,
          moduleLabel,
          permissions: [],
        });
      }

      moduleMap.get(perm.module)!.permissions.push({
        id: perm.id,
        permissionCode: perm.permissionCode,
        action: perm.action,
        description: perm.description,
      });
    }

    return {
      success: true,
      modules: Array.from(moduleMap.values()),
      totalPermissions: dbPermissions.length,
    };
  }

  /**
   * List all employees in the tenant with their granted permissions count and details.
   */
  async getEmployeesWithPermissions(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        status: EmployeeStatus.ACTIVE,
        user: {
          isActive: true,
          isSuperAdmin: false,
          role: {
            notIn: [UserRole.PLATFORM_INCHARGE, UserRole.SUPER_ADMIN],
          },
          OR: [
            { tenantMemberships: { none: {} } },
            {
              tenantMemberships: {
                some: {
                  tenantId,
                  isActive: true,
                  role: { notIn: [UserRole.PLATFORM_INCHARGE, UserRole.SUPER_ADMIN] },
                },
              },
            },
          ],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isSuperAdmin: true,
          },
        },
        departmentRel: {
          select: {
            id: true,
            name: true,
          },
        },
        employeePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                permissionCode: true,
                module: true,
                action: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = employees.map((emp) => {
      const assignedPermissions = emp.employeePermissions.map((ep) => ep.permission.permissionCode);
      return {
        id: emp.id,
        userId: emp.userId,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        department: emp.departmentRel?.name || emp.department || 'General',
        departmentId: emp.departmentId,
        designation: emp.designation,
        level: emp.level,
        status: emp.status,
        role: emp.user?.role || 'L1_EMPLOYEE',
        assignedPermissionsCount: assignedPermissions.length,
        assignedPermissions,
      };
    });

    return {
      success: true,
      employees: result,
      total: result.length,
    };
  }

  /**
   * Get granted permission codes for a single employee.
   */
  async getEmployeePermissions(tenantId: string, employeeId: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            isSuperAdmin: true,
          },
        },
        departmentRel: {
          select: { id: true, name: true },
        },
        employeePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee '${employeeId}' not found in the current tenant workspace.`);
    }

    // Security Rule: Platform administrator accounts are not subject to tenant permission management
    if (
      employee.user?.role === UserRole.PLATFORM_INCHARGE ||
      employee.user?.role === UserRole.SUPER_ADMIN ||
      employee.user?.isSuperAdmin
    ) {
      throw new ForbiddenException(
        'Platform administrator accounts are not subject to tenant permission management.',
      );
    }

    const grantedCodes = employee.employeePermissions.map((ep) => ep.permission.permissionCode);

    return {
      success: true,
      employee: {
        id: employee.id,
        userId: employee.userId,
        name: employee.name,
        email: employee.email,
        department: employee.departmentRel?.name || employee.department || 'General',
        designation: employee.designation,
        level: employee.level,
        status: employee.status,
        role: employee.user?.role || 'L1_EMPLOYEE',
      },
      assignedPermissions: grantedCodes,
      count: grantedCodes.length,
    };
  }

  /**
   * Updates granted permissions for an employee.
   * Enforces:
   * 1. Tenant isolation
   * 2. No self-assignment
   * 3. Active employee requirement
   * 4. Audit logging of all additions and revocations
   */
  async updateEmployeePermissions(
    tenantId: string,
    employeeId: string,
    permissionCodes: string[],
    actorUserId: number,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }

    // Tenant-isolated employee lookup
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: {
        user: true,
        employeePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee '${employeeId}' not found in the current tenant workspace.`);
    }

    // Security Rule: Platform administrator accounts are not subject to tenant permission management
    if (
      employee.user?.role === UserRole.PLATFORM_INCHARGE ||
      employee.user?.role === UserRole.SUPER_ADMIN ||
      employee.user?.isSuperAdmin
    ) {
      throw new ForbiddenException(
        'Platform administrator accounts are not subject to tenant permission management.',
      );
    }

    // Security Rule 4: Employees cannot grant permissions to themselves
    if (employee.userId === actorUserId) {
      throw new ForbiddenException('Security Violation: Users are strictly forbidden from modifying their own permissions.');
    }

    // Security Rule: Delegated employees cannot manage Tenant Admin accounts
    const actorUser = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, role: true, isSuperAdmin: true },
    });
    const isActorAdmin =
      actorUser?.role === 'ADMIN' ||
      actorUser?.role === 'SUPER_ADMIN' ||
      actorUser?.role === 'PLATFORM_INCHARGE' ||
      actorUser?.isSuperAdmin;

    const isTargetAdmin = employee.user?.role === 'ADMIN';

    if (isTargetAdmin && !isActorAdmin) {
      throw new ForbiddenException(
        'Security Policy Violation: Delegated employees are strictly forbidden from managing Tenant Admin permissions.',
      );
    }

    // Security Rule: Only Tenant Administrators can delegate permission assignment authority
    if (!isActorAdmin && permissionCodes.includes('employee.assign_permissions')) {
      throw new ForbiddenException(
        'Privilege Escalation Prevention: Only Tenant Administrators are permitted to delegate permission assignment authority.',
      );
    }

    // Security Rule 3: Inactive employees receive no effective permissions
    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot configure permissions for an inactive employee. Please activate the employee profile first.');
    }

    // Lookup requested permissions from catalog
    const targetPermissions = await this.prisma.permission.findMany({
      where: {
        permissionCode: { in: permissionCodes },
      },
    });

    const validCodes = targetPermissions.map((p) => p.permissionCode);
    const existingCodes = employee.employeePermissions.map((ep) => ep.permission.permissionCode);

    // Compute diff
    const toGrantCodes = validCodes.filter((code) => !existingCodes.includes(code));
    const toRevokeCodes = existingCodes.filter((code) => !validCodes.includes(code));

    const toGrantPerms = targetPermissions.filter((p) => toGrantCodes.includes(p.permissionCode));
    const toRevokeEmpPermIds = employee.employeePermissions
      .filter((ep) => toRevokeCodes.includes(ep.permission.permissionCode))
      .map((ep) => ep.id);

    // Execute atomic update
    await this.prisma.$transaction(async (tx) => {
      // 1. Remove revoked permissions
      if (toRevokeEmpPermIds.length > 0) {
        await tx.employeePermission.deleteMany({
          where: {
            id: { in: toRevokeEmpPermIds },
          },
        });
      }

      // 2. Add granted permissions
      if (toGrantPerms.length > 0) {
        await tx.employeePermission.createMany({
          data: toGrantPerms.map((p) => ({
            tenantId,
            employeeId,
            permissionId: p.id,
            grantedBy: String(actorUserId),
          })),
          skipDuplicates: true,
        });
      }
    });

    // Record detailed audit log entries for every permission grant and revocation
    for (const code of toGrantCodes) {
      await this.auditService.log({
        actorUserId,
        action: 'PERMISSION_GRANTED',
        entityType: 'EMPLOYEE_PERMISSION',
        entityId: employeeId,
        oldValues: null,
        newValues: { permissionCode: code, grantedBy: actorUserId },
        tenantId,
      });
    }

    for (const code of toRevokeCodes) {
      await this.auditService.log({
        actorUserId,
        action: 'PERMISSION_REVOKED',
        entityType: 'EMPLOYEE_PERMISSION',
        entityId: employeeId,
        oldValues: { permissionCode: code },
        newValues: null,
        tenantId,
      });
    }

    return {
      success: true,
      message: `Permissions updated successfully for ${employee.name}. Granted: ${toGrantCodes.length}, Revoked: ${toRevokeCodes.length}.`,
      employeeId,
      assignedPermissions: validCodes,
      count: validCodes.length,
    };
  }

  /**
   * Resolves effective permissions for the authenticated user.
   */
  async getEffectivePermissions(userId: number, tenantId?: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
      },
    });

    if (!user || !user.isActive) {
      return [];
    }

    // Platform Incharge and Super Admin have full access across all modules
    if (user.role === 'PLATFORM_INCHARGE' || user.isSuperAdmin) {
      return PERMISSION_CATALOG.map((p) => p.permissionCode);
    }

    // Tenant Admin inherits all capabilities within their tenant
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return PERMISSION_CATALOG.map((p) => p.permissionCode);
    }

    // Employees require active profile and verified tenant workspace
    const effectiveTenantId = tenantId || user.defaultTenantId || user.employee?.tenantId;
    if (!effectiveTenantId) {
      return [];
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { id: user.employee?.id || '' },
        ],
        tenantId: effectiveTenantId,
      },
      include: {
        employeePermissions: {
          include: {
            permission: {
              select: { permissionCode: true },
            },
          },
        },
      },
    });

    if (!employee || employee.status !== 'ACTIVE') {
      return [];
    }

    // Start with explicitly granted granular permissions
    const permissionsSet = new Set<string>(
      employee.employeePermissions.map((ep) => ep.permission.permissionCode),
    );

    // Baseline permissions inherently available to active support employees
    // L1/L2/L3 support agents have baseline ticket viewing & updating capabilities
    permissionsSet.add('ticket.view');
    permissionsSet.add('ticket.update');

    // Managers inherently have department viewing and ticket assignment
    if (user.role === 'MANAGER') {
      permissionsSet.add('department.view');
      permissionsSet.add('employee.view');
      permissionsSet.add('ticket.assign');
      permissionsSet.add('ticket.create');
    }

    return Array.from(permissionsSet);
  }
}

