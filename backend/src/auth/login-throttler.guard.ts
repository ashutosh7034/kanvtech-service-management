import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

interface AttemptRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class LoginThrottlerGuard implements CanActivate {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts = 100;
  private readonly windowMs = 60 * 1000; // 1 minute

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = this.attempts.get(ip);

    if (!record || now > record.resetTime) {
      this.attempts.set(ip, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      const remainingSeconds = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        {
          success: false,
          error: `Too many login attempts. Please wait ${remainingSeconds} seconds before trying again.`,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    return true;
  }
}
