import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from '../permissions/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If neither roles nor permissions are specified on this route/class, allow
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User context is not authenticated');
    }

    // Section 8: Subscription Expiry Operational Restriction
    const req = context.switchToHttp().getRequest();
    const reqPath = req.path || req.url || '';
    if (user.isSubscriptionExpired && !user.isPlatformIncharge) {
      const isRenewalPath =
        reqPath.includes('/entitlements') ||
        reqPath.includes('/subscriptions') ||
        reqPath.includes('/auth') ||
        reqPath.includes('/notifications');

      if (!isRenewalPath) {
        throw new ForbiddenException(
          'Your tenant subscription has expired. Normal operational modules are blocked until renewal is completed.',
        );
      }
    }

    // Platform Incharge and Super Admin operate with full platform administrative privileges
    if (user.role === 'PLATFORM_INCHARGE' || user.isPlatformIncharge) {
      return true;
    }

    const userRole = user.role;
    const effectiveRoles = [userRole];
    if (userRole === 'SUPER_ADMIN') {
      effectiveRoles.push('ADMIN');
    }

    // Tenant Admin inherits full permissions and roles within their workspace
    if (effectiveRoles.includes('ADMIN')) {
      return true;
    }

    // Check granular employee permissions if required
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (user.role === 'CUSTOMER') {
        if (requiredRoles && requiredRoles.includes('CUSTOMER')) {
          return true;
        }
        throw new ForbiddenException('Customers are not authorized to perform employee administrative operations');
      }

      if (!user.tenantId) {
        throw new ForbiddenException('Tenant workspace context is required to verify permissions');
      }

      const employee = await this.prisma.employee.findFirst({
        where: {
          OR: [
            { userId: user.id || user.userId },
            { id: user.employeeId || '' },
          ],
          tenantId: user.tenantId,
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
        throw new ForbiddenException('Active employee profile is required to exercise permissions');
      }

      const grantedCodes = new Set<string>(
        employee.employeePermissions.map((ep) => ep.permission.permissionCode),
      );

      // Baseline support role permissions
      grantedCodes.add('ticket.view');
      grantedCodes.add('ticket.update');

      // Baseline task capabilities for all active tenant employees
      grantedCodes.add('task.view_assigned');
      grantedCodes.add('task.view_sent');
      grantedCodes.add('task.assign');
      grantedCodes.add('task.update_progress');
      grantedCodes.add('task.complete');
      grantedCodes.add('task.send_reminder');
      grantedCodes.add('task.edit');
      grantedCodes.add('task.cancel');

      if (user.role === 'MANAGER' || employee.level === 'MANAGER') {
        grantedCodes.add('department.view');
        grantedCodes.add('employee.view');
        grantedCodes.add('ticket.assign');
        grantedCodes.add('ticket.create');
        grantedCodes.add('task.view_team');
      }

      const hasAllRequiredPermissions = requiredPermissions.every((p) =>
        grantedCodes.has(p),
      );

      if (hasAllRequiredPermissions) {
        return true;
      }

      throw new ForbiddenException(
        `User lacks required permission: ${requiredPermissions
          .filter((p) => !grantedCodes.has(p))
          .join(', ')}`,
      );
    }

    // If no specific permissions were required, evaluate standard role membership
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => effectiveRoles.includes(r));
      if (!hasRole) {
        throw new ForbiddenException(
          `User role '${userRole}' is not authorized to access this resource`,
        );
      }
    }

    return true;
  }
}
