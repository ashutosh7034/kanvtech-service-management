import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User context is not authenticated');
    }

    const userRole = user.role;
    const effectiveRoles = [userRole];
    // SUPER_ADMIN is the company workspace super-administrator and inherits tenant ADMIN capabilities
    if (userRole === 'SUPER_ADMIN') {
      effectiveRoles.push('ADMIN');
    }

    const hasRole = requiredRoles.some((r) => effectiveRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(`User role '${userRole}' is not authorized to access this resource`);
    }

    return true;
  }
}
