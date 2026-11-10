import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication context is missing or invalid.');
    }

    // Platform Incharge and Super Admin inherit full administrative permissions
    if (user.isPlatformIncharge || user.role === 'PLATFORM_INCHARGE') {
      return true;
    }

    // Tenant Admin inherits full permissions within their tenant
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      if (!user.tenantId) {
        throw new ForbiddenException('Tenant context is missing for tenant administrator.');
      }
      return true;
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant workspace context is required to verify permissions.');
    }

    // Resolve employee and granted permissions
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { userId: user.id || user.userId },
          { id: user.employeeId || '' },
        ],
        tenantId,
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

    if (!employee) {
      throw new ForbiddenException('No associated employee record found in the current tenant workspace.');
    }

    if (employee.status !== 'ACTIVE') {
      throw new ForbiddenException('Your employee account is suspended or inactive. Contact your administrator.');
    }

    const grantedCodes = new Set<string>(
      employee.employeePermissions.map((ep) => ep.permission.permissionCode),
    );

    // Baseline permissions inherently available to active support employees
    grantedCodes.add('ticket.view');
    grantedCodes.add('ticket.update');

    if (user.role === 'MANAGER') {
      grantedCodes.add('department.view');
      grantedCodes.add('employee.view');
      grantedCodes.add('ticket.assign');
      grantedCodes.add('ticket.create');
    }

    // Attach to request for downstream handlers
    request.user.effectivePermissions = Array.from(grantedCodes);

    // Verify all required permissions are present
    const missingPermissions = requiredPermissions.filter((p) => !grantedCodes.has(p));

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Access denied. You lack the required permission: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}

