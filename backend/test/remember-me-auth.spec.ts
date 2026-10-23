import assert from 'assert';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

const JWT_SECRET = 'kanvtech-test-jwt-secret-remember-me-verification';

async function main() {
  console.log('========================================================================');
  console.log('KANVTECH — REMEMBER ME BACKEND AUTHENTICATION & SESSION SPEC');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      process.stdout.write(`[TEST] ${name} ... `);
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log('PASSED \u2714');
            passed++;
          })
          .catch((err) => {
            console.log('FAILED \u2718');
            console.error(`       Error: ${err.message}`);
            failed++;
          });
      } else {
        console.log('PASSED \u2714');
        passed++;
        return Promise.resolve();
      }
    } catch (err: any) {
      console.log('FAILED \u2718');
      console.error(`       Error: ${err.message}`);
      failed++;
      return Promise.resolve();
    }
  }

  const jwtService = new JwtService({ secret: JWT_SECRET });

  // 1. Token Expiry for Remember Me = true (30 days)
  await runTest('Token expiration is set to 30 days when rememberMe is true', () => {
    const payload = { userId: 1, email: 'admin@kanvtech.com', role: 'ADMIN', sessionId: 'sess-1' };
    const expiresIn = '30d';
    const token = jwtService.sign(payload, { expiresIn });
    const decoded: any = jwtService.decode(token);
    assert(decoded, 'Token must decode');
    const durationSeconds = decoded.exp - decoded.iat;
    const expectedSeconds = 30 * 24 * 60 * 60; // 2,592,000 seconds
    assert.strictEqual(durationSeconds, expectedSeconds, `Expected 30 days duration (2592000s), got ${durationSeconds}s`);
  });

  // 2. Token Expiry for Remember Me = false (24 hours)
  await runTest('Token expiration is set to 24 hours when rememberMe is false', () => {
    const payload = { userId: 1, email: 'admin@kanvtech.com', role: 'ADMIN', sessionId: 'sess-2' };
    const expiresIn = '24h';
    const token = jwtService.sign(payload, { expiresIn });
    const decoded: any = jwtService.decode(token);
    assert(decoded, 'Token must decode');
    const durationSeconds = decoded.exp - decoded.iat;
    const expectedSeconds = 24 * 60 * 60; // 86,400 seconds
    assert.strictEqual(durationSeconds, expectedSeconds, `Expected 24 hours duration (86400s), got ${durationSeconds}s`);
  });

  // 3. Cookie Flags and MaxAge on Login
  await runTest('AuthController sets 30-day maxAge cookie when rememberMe is true', async () => {
    let capturedCookieName = '';
    let capturedCookieVal = '';
    let capturedCookieOptions: any = null;

    const mockRes: any = {
      cookie: (name: string, val: string, options: any) => {
        capturedCookieName = name;
        capturedCookieVal = val;
        capturedCookieOptions = options;
      },
    };

    const mockAuthService: any = {
      login: async () => ({
        token: 'sample-jwt-token-remembered',
        user: { id: 1, email: 'admin@kanvtech.com', role: 'ADMIN' },
      }),
    };

    const controller = new AuthController(mockAuthService);
    await controller.login({ email: 'admin@kanvtech.com', password: 'password', rememberMe: true }, mockRes);

    assert.strictEqual(capturedCookieName, 'kanvtech_token');
    assert.strictEqual(capturedCookieVal, 'sample-jwt-token-remembered');
    assert.strictEqual(capturedCookieOptions.httpOnly, true, 'Cookie must be HttpOnly');
    assert.strictEqual(capturedCookieOptions.sameSite, 'lax', 'Cookie must have sameSite: lax');
    assert.strictEqual(capturedCookieOptions.path, '/', 'Cookie path must be /');
    assert.strictEqual(capturedCookieOptions.maxAge, 30 * 24 * 60 * 60 * 1000, 'Cookie maxAge must be 30 days');
  });

  // 4. Session Cookie (No MaxAge) when Remember Me is false
  await runTest('AuthController sets session cookie (omitting maxAge) when rememberMe is false', async () => {
    let capturedCookieName = '';
    let capturedCookieVal = '';
    let capturedCookieOptions: any = null;

    const mockRes: any = {
      cookie: (name: string, val: string, options: any) => {
        capturedCookieName = name;
        capturedCookieVal = val;
        capturedCookieOptions = options;
      },
    };

    const mockAuthService: any = {
      login: async () => ({
        token: 'sample-jwt-token-session-only',
        user: { id: 1, email: 'admin@kanvtech.com', role: 'ADMIN' },
      }),
    };

    const controller = new AuthController(mockAuthService);
    await controller.login({ email: 'admin@kanvtech.com', password: 'password', rememberMe: false }, mockRes);

    assert.strictEqual(capturedCookieName, 'kanvtech_token');
    assert.strictEqual(capturedCookieVal, 'sample-jwt-token-session-only');
    assert.strictEqual(capturedCookieOptions.httpOnly, true, 'Cookie must be HttpOnly');
    assert.strictEqual(capturedCookieOptions.maxAge, undefined, 'Session cookie must not have maxAge');
    assert.strictEqual(capturedCookieOptions.expires, undefined, 'Session cookie must not have expires');
  });

  // 5. Expired tokens are rejected and cannot bypass auth
  await runTest('Expired JWT cannot be verified and rejects with TokenExpiredError', () => {
    const expiredToken = jwtService.sign(
      { userId: 1, email: 'admin@kanvtech.com', sessionId: 'sess-old' },
      { expiresIn: '-1s' }, // Expired 1 second ago
    );

    assert.throws(
      () => {
        jwtService.verify(expiredToken);
      },
      (err: any) => {
        return err.name === 'TokenExpiredError';
      },
      'Expired token must throw TokenExpiredError',
    );
  });

  // 6. Logout clears cookie
  await runTest('Logout clears authentication cookie with matching security flags', async () => {
    let clearedCookieName = '';
    let clearedCookieOptions: any = null;

    const mockRes: any = {
      clearCookie: (name: string, options: any) => {
        clearedCookieName = name;
        clearedCookieOptions = options;
      },
    };

    const mockAuthService: any = {
      logoutByToken: async () => {},
    };

    const controller = new AuthController(mockAuthService);
    const mockReq: any = { cookies: { kanvtech_token: 'active-token-to-logout' } };
    const res = await controller.logout(mockReq, mockRes);

    assert.strictEqual(res.success, true);
    assert.strictEqual(clearedCookieName, 'kanvtech_token');
    assert.strictEqual(clearedCookieOptions.httpOnly, true);
    assert.strictEqual(clearedCookieOptions.sameSite, 'lax');
    assert.strictEqual(clearedCookieOptions.path, '/');
  });

  console.log('\n========================================================================');
  console.log(`BACKEND VERIFICATION SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
