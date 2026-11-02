import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PlatformSuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || (user.role !== 'PLATFORM_INCHARGE' && !user.isPlatformIncharge)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Platform Administration is strictly restricted to Platform Incharge. Access denied.',
      });
    }
    return true;
  }
}
