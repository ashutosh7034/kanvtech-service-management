import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing or empty. Application startup aborted.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => {
          let token: string | null = null;
          if (req?.cookies && req.cookies['kanvtech_token']) {
            token = req.cookies['kanvtech_token'];
          } else if (req?.headers?.cookie) {
            const match = req.headers.cookie.match(/(?:^|;\s*)kanvtech_token=([^;]+)/);
            if (match) token = decodeURIComponent(match[1]);
          }
          return token;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true, activeSessionId: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive.');
    }

    // Enforce one active login session per user account across web and mobile
    if (!payload.sessionId || payload.sessionId !== user.activeSessionId) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'SESSION_TERMINATED',
        message: 'Your account has been logged in on another device. You have been logged out for security reasons.',
      });
    }

    const isPlatformIncharge = payload.role === 'PLATFORM_INCHARGE' || payload.isPlatformIncharge || false;
    const tenantId = payload.tenantId;

    // Platform Incharge operates at the platform layer. All tenant roles (including SUPER_ADMIN)
    // require an active, verified tenant membership in the target workspace.
    if (!isPlatformIncharge) {
      if (!tenantId) {
        throw new UnauthorizedException('Authentication context missing verified tenant workspace.');
      }

      const membership = await this.prisma.tenantMembership.findFirst({
        where: {
          userId: user.id,
          tenantId,
          isActive: true,
        },
        include: {
          tenant: {
            select: { id: true, name: true, status: true },
          },
        },
      });

      if (!membership || !membership.tenant || membership.tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException({
          statusCode: 401,
          error: 'Unauthorized',
          code: 'TENANT_SUSPENDED',
          message: 'Company workspace is suspended or access has been revoked.',
        });
      }
    }

    return {
      userId: payload.userId,
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: tenantId || (isPlatformIncharge ? 'KANVTECH' : null),
      tenantName: payload.tenantName || (isPlatformIncharge ? 'Platform Administration' : 'Company Workspace'),
      isSuperAdmin: false,
      isPlatformIncharge,
      employeeId: payload.employeeId,
      companyId: payload.companyId,
      contactId: payload.contactId,
      sessionId: payload.sessionId,
    };
  }
}
