import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!user.tenantId && !user.isSuperAdmin) {
      throw new UnauthorizedException('Authentication context missing verified tenant workspace.');
    }
    // Enforce server-side resolved tenantId: NEVER trust client-supplied tenant headers or query params
    request.tenantId = user.tenantId || (user.isSuperAdmin ? 'KANVTECH' : null);
    return true;
  }
}
