import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      throw new Error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing or empty. Application startup aborted.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
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
