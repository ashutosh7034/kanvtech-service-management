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
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive.');
    }

    return {
      userId: payload.userId,
      id: payload.userId,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
      companyId: payload.companyId,
      contactId: payload.contactId,
    };
  }
}
