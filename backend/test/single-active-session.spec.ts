import assert from 'assert';
import { PrismaClient, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// Enforce test configuration on isolated port 5433 (Never 5432)
process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5433/kanvtech_sm_staging?schema=public';
process.env.JWT_SECRET = 'kanvtech-super-secret-staging-jwt-key-2026-secure';

const EXPECTED_SECURITY_MESSAGE =
  'Your account has been logged in on another device. You have been logged out for security reasons.';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`[TEST] ${name} ... `);
    await fn();
    console.log('PASSED \u2714');
    passed++;
  } catch (err: any) {
    console.log('FAILED \u2718');
    console.error(`       Error: ${err.message}`);
    if (err.stack) console.error(`       Stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
    failed++;
  }
}

async function main() {
  console.log('========================================================================');
  console.log('KANVTECH — SINGLE ACTIVE SESSION ACROSS WEB & MOBILE VERIFICATION');
  console.log('Environment: Isolated Local Test DB (Port 5433, embedded postgres)');
  console.log('========================================================================\n');

  const prisma = new PrismaService();
  await prisma.$connect();

  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '24h' },
  });

  const authService = new AuthService(prisma, jwtService);
  const jwtStrategy = new JwtStrategy(prisma);

  // Helper to decode JWT token
  function decodeToken(token: string) {
    return jwtService.decode(token) as any;
  }

  // Ensure test users exist with known test password
  const testPassword = 'Password@123';
  const testPasswordHash = await bcrypt.hash(testPassword, 10);

  const testAccounts = [
    { email: 'admin@kanvtech.com', role: UserRole.ADMIN },
    { email: 'manager@kanvtech.com', role: UserRole.MANAGER },
    { email: 'l1.amit@kanvtech.com', role: UserRole.L1_EMPLOYEE },
    { email: 'l2.vikram@kanvtech.com', role: UserRole.L2_EMPLOYEE },
    { email: 'l3.priya@kanvtech.com', role: UserRole.L3_EMPLOYEE },
    { email: 'rajesh@acme.com', role: UserRole.CUSTOMER },
  ];

  for (const acc of testAccounts) {
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash: testPasswordHash, isActive: true },
      create: {
        email: acc.email,
        passwordHash: testPasswordHash,
        role: acc.role,
        isActive: true,
      },
    });
  }

  // ============================================================================
  // Scenario 1 & 2: User logs in on web; then logs in on mobile -> web rejected
  // ============================================================================
  await runTest('1 & 2. Web login works; mobile login succeeds and invalidates old web session', async () => {
    const userEmail = 'l1.amit@kanvtech.com';

    // 1. User logs in on Web
    const webLogin = await authService.login(userEmail, testPassword);
    assert(webLogin.token, 'Web login must return token');
    const webPayload = decodeToken(webLogin.token);
    assert(webPayload.sessionId, 'Web token must have sessionId embedded');

    // Web request succeeds
    const webValidation = await jwtStrategy.validate(webPayload);
    assert.strictEqual(webValidation.email, userEmail, 'Web session must validate successfully');

    // 2. User logs in on Mobile
    const mobileLogin = await authService.login(userEmail, testPassword);
    assert(mobileLogin.token, 'Mobile login must return token');
    const mobilePayload = decodeToken(mobileLogin.token);
    assert(mobilePayload.sessionId, 'Mobile token must have sessionId embedded');
    assert.notStrictEqual(webPayload.sessionId, mobilePayload.sessionId, 'Sessions must have distinct session IDs');

    // Mobile request succeeds
    const mobileValidation = await jwtStrategy.validate(mobilePayload);
    assert.strictEqual(mobileValidation.email, userEmail, 'Mobile session must validate successfully');

    // Old web session is now REJECTED
    try {
      await jwtStrategy.validate(webPayload);
      assert.fail('Old web session should have been rejected');
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'Must throw UnauthorizedException');
      const resp = err.getResponse() as any;
      assert.strictEqual(resp.code, 'SESSION_TERMINATED', 'Error code must be SESSION_TERMINATED');
      assert.strictEqual(resp.message, EXPECTED_SECURITY_MESSAGE, 'Must match exact security logout message');
    }
  });

  // ============================================================================
  // Scenario 3: User logs in on mobile; then logs in on web -> mobile rejected
  // ============================================================================
  await runTest('3. Mobile login works; subsequent web login invalidates old mobile session', async () => {
    const userEmail = 'l2.vikram@kanvtech.com';

    // 1. Mobile Login
    const mobileLogin = await authService.login(userEmail, testPassword);
    const mobilePayload = decodeToken(mobileLogin.token);
    const mobileVal = await jwtStrategy.validate(mobilePayload);
    assert.strictEqual(mobileVal.email, userEmail);

    // 2. Web Login
    const webLogin = await authService.login(userEmail, testPassword);
    const webPayload = decodeToken(webLogin.token);
    const webVal = await jwtStrategy.validate(webPayload);
    assert.strictEqual(webVal.email, userEmail);

    // Old mobile session rejected
    try {
      await jwtStrategy.validate(mobilePayload);
      assert.fail('Old mobile session should have been rejected');
    } catch (err: any) {
      assert(err instanceof UnauthorizedException);
      const resp = err.getResponse() as any;
      assert.strictEqual(resp.code, 'SESSION_TERMINATED');
      assert.strictEqual(resp.message, EXPECTED_SECURITY_MESSAGE);
    }
  });

  // ============================================================================
  // Scenario 4: Second browser login invalidates first browser session
  // ============================================================================
  await runTest('4. Second browser login invalidates first browser session', async () => {
    const userEmail = 'manager@kanvtech.com';

    const browser1 = await authService.login(userEmail, testPassword);
    const browser1Payload = decodeToken(browser1.token);
    assert(await jwtStrategy.validate(browser1Payload));

    const browser2 = await authService.login(userEmail, testPassword);
    const browser2Payload = decodeToken(browser2.token);
    assert(await jwtStrategy.validate(browser2Payload));

    // Browser 1 rejected
    try {
      await jwtStrategy.validate(browser1Payload);
      assert.fail('Browser 1 should be invalidated');
    } catch (err: any) {
      const resp = err.getResponse() as any;
      assert.strictEqual(resp.code, 'SESSION_TERMINATED');
    }
  });

  // ============================================================================
  // Scenario 5: Requests using invalidated JWT receive 401 with exact message
  // ============================================================================
  await runTest('5. Invalidated JWT receives 401 SESSION_TERMINATED with exact message', async () => {
    const userEmail = 'l3.priya@kanvtech.com';

    const login1 = await authService.login(userEmail, testPassword);
    const payload1 = decodeToken(login1.token);

    // Supersede session
    await authService.login(userEmail, testPassword);

    try {
      await jwtStrategy.validate(payload1);
      assert.fail('Expected UnauthorizedException');
    } catch (err: any) {
      assert.strictEqual(err.status, 401);
      const resp = err.getResponse() as any;
      assert.strictEqual(resp.statusCode, 401);
      assert.strictEqual(resp.code, 'SESSION_TERMINATED');
      assert.strictEqual(resp.message, EXPECTED_SECURITY_MESSAGE);
    }
  });

  // ============================================================================
  // Scenario 6: Logging out from an old session does NOT invalidate new active session
  // ============================================================================
  await runTest('6. Logging out from old session does NOT invalidate active session on another device', async () => {
    const userEmail = 'admin@kanvtech.com';

    // Device 1 logs in
    const device1 = await authService.login(userEmail, testPassword);
    const dev1Payload = decodeToken(device1.token);

    // Device 2 logs in (becomes active)
    const device2 = await authService.login(userEmail, testPassword);
    const dev2Payload = decodeToken(device2.token);

    // Device 1 performs explicit logout
    await authService.logout(dev1Payload.userId, dev1Payload.sessionId);

    // Device 2 MUST STILL BE ACTIVE!
    const dev2Check = await jwtStrategy.validate(dev2Payload);
    assert.strictEqual(dev2Check.email, userEmail, 'Device 2 must remain valid after old session logout');

    // Only when Device 2 explicitly logs out does its session end
    await authService.logout(dev2Payload.userId, dev2Payload.sessionId);
    try {
      await jwtStrategy.validate(dev2Payload);
      assert.fail('Device 2 should now be invalidated');
    } catch (err: any) {
      const resp = err.getResponse() as any;
      assert.strictEqual(resp.code, 'SESSION_TERMINATED');
    }
  });

  // ============================================================================
  // Scenario 7: Different user accounts do not invalidate one another
  // ============================================================================
  await runTest('7. Different user accounts do not invalidate one another', async () => {
    const userA = await authService.login('admin@kanvtech.com', testPassword);
    const userB = await authService.login('manager@kanvtech.com', testPassword);
    const userC = await authService.login('rajesh@acme.com', testPassword);

    const payloadA = decodeToken(userA.token);
    const payloadB = decodeToken(userB.token);
    const payloadC = decodeToken(userC.token);

    const valA = await jwtStrategy.validate(payloadA);
    const valB = await jwtStrategy.validate(payloadB);
    const valC = await jwtStrategy.validate(payloadC);

    assert.strictEqual(valA.email, 'admin@kanvtech.com');
    assert.strictEqual(valB.email, 'manager@kanvtech.com');
    assert.strictEqual(valC.email, 'rajesh@acme.com');
  });

  // ============================================================================
  // Scenario 8: Verify behavior across all six roles
  // ============================================================================
  await runTest('8. Single-session enforcement across all six roles (ADMIN, MANAGER, L1, L2, L3, CUSTOMER)', async () => {
    for (const acc of testAccounts) {
      const firstLogin = await authService.login(acc.email, testPassword);
      const firstPayload = decodeToken(firstLogin.token);
      assert.strictEqual(firstPayload.role, acc.role);

      // Verify active
      const activeCheck = await jwtStrategy.validate(firstPayload);
      assert.strictEqual(activeCheck.role, acc.role);

      // Second login from another device
      const secondLogin = await authService.login(acc.email, testPassword);
      const secondPayload = decodeToken(secondLogin.token);

      // Second is active
      const secondCheck = await jwtStrategy.validate(secondPayload);
      assert.strictEqual(secondCheck.role, acc.role);

      // First is rejected
      try {
        await jwtStrategy.validate(firstPayload);
        assert.fail(`Role ${acc.role} first session should have been terminated`);
      } catch (err: any) {
        const resp = err.getResponse() as any;
        assert.strictEqual(resp.code, 'SESSION_TERMINATED', `Role ${acc.role} must receive SESSION_TERMINATED`);
      }
    }
  });

  // ============================================================================
  // Scenario 9: Existing role-based authorization & data fields preserved
  // ============================================================================
  await runTest('9. Preserved role authorization attributes in active session', async () => {
    const login = await authService.login('admin@kanvtech.com', testPassword);
    const payload = decodeToken(login.token);
    const validated = await jwtStrategy.validate(payload);

    assert(validated.userId, 'userId must be preserved');
    assert.strictEqual(validated.role, UserRole.ADMIN, 'role must be preserved');
    assert.strictEqual(validated.email, 'admin@kanvtech.com');
    assert(validated.sessionId, 'sessionId must be present');
  });

  // ============================================================================
  // Scenario 10: Simultaneous logins & legacy token handling
  // ============================================================================
  await runTest('10. Safe concurrent login handling and rejection of legacy tokens without sessionId', async () => {
    const userEmail = 'l1.amit@kanvtech.com';

    // Simulate 5 simultaneous login attempts
    const simultaneousLogins = await Promise.all([
      authService.login(userEmail, testPassword),
      authService.login(userEmail, testPassword),
      authService.login(userEmail, testPassword),
      authService.login(userEmail, testPassword),
      authService.login(userEmail, testPassword),
    ]);

    // Check user activeSessionId in database
    const dbUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { activeSessionId: true },
    });
    assert(dbUser?.activeSessionId, 'User must have exactly one active session ID in DB');

    // Exactly one of the simultaneous tokens should match the DB activeSessionId
    let activeMatches = 0;
    for (const res of simultaneousLogins) {
      const p = decodeToken(res.token);
      if (p.sessionId === dbUser.activeSessionId) {
        activeMatches++;
        const val = await jwtStrategy.validate(p);
        assert.strictEqual(val.email, userEmail);
      } else {
        try {
          await jwtStrategy.validate(p);
          assert.fail('Superseded simultaneous session must be rejected');
        } catch (err: any) {
          const resp = err.getResponse() as any;
          assert.strictEqual(resp.code, 'SESSION_TERMINATED');
        }
      }
    }
    assert.strictEqual(activeMatches, 1, 'Exactly one simultaneous login must remain active');

    // Legacy token without sessionId is rejected
    const legacyPayload = {
      userId: dbUser ? 762 : 1,
      email: userEmail,
      role: 'L1_EMPLOYEE',
    };
    try {
      await jwtStrategy.validate(legacyPayload);
      assert.fail('Legacy token without sessionId should be rejected');
    } catch (err: any) {
      const resp = err.getResponse() as any;
      assert.strictEqual(resp.code, 'SESSION_TERMINATED');
    }
  });

  console.log('\n========================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
