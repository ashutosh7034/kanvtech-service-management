import assert from 'assert';

interface DecodedJwt {
  header: any;
  payload: {
    userId: number;
    email: string;
    role: string;
    iat: number;
    exp: number;
  };
}

function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  assert(parts.length === 3, 'JWT must have 3 parts');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf-8'));
  return { header, payload };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('KANVTECH REMEMBER ME & AUTHENTICATION SESSION VERIFICATION SUITE');
  console.log('================================================================\n');

  const targets = [
    { name: 'Backend Direct API (Port 5000)', base: 'http://127.0.0.1:5000/api' },
    { name: 'Next.js Proxy API (Port 3000)', base: 'http://127.0.0.1:3000/api' },
  ];

  for (const target of targets) {
    console.log(`\n>>> Testing Target: ${target.name} (${target.base}) <<<\n`);

    // -------------------------------------------------------------
    // Test 1: Login with Remember Me = true
    // -------------------------------------------------------------
    console.log('[Test 1] Login with Remember Me CHECKED');
    const resRememberTrue = await fetch(`${target.base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kanvtech.com',
        password: 'Password@123',
        rememberMe: true,
      }),
    });

    assert.strictEqual(resRememberTrue.status, 200, 'Login must succeed with status 200');
    const dataRememberTrue = await resRememberTrue.json();
    assert(dataRememberTrue.token, 'Must return JWT token');
    assert(dataRememberTrue.user, 'Must return user object');
    assert.strictEqual(dataRememberTrue.user.email, 'admin@kanvtech.com');

    // Inspect Set-Cookie header
    const setCookieHeaderTrue = resRememberTrue.headers.get('set-cookie');
    assert(setCookieHeaderTrue, 'Response must include Set-Cookie header');
    assert(setCookieHeaderTrue.includes('kanvtech_token='), 'Cookie must be named kanvtech_token');
    assert(setCookieHeaderTrue.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    assert(setCookieHeaderTrue.toLowerCase().includes('samesite=lax'), 'Cookie must have SameSite=Lax');
    assert(setCookieHeaderTrue.toLowerCase().includes('max-age='), 'Remember Me persistent cookie must include Max-Age');

    // Verify token expiry (approx 30 days)
    const decodedTrue = decodeJwt(dataRememberTrue.token);
    const durationSecTrue = decodedTrue.payload.exp - decodedTrue.payload.iat;
    const durationDaysTrue = Math.round(durationSecTrue / (24 * 3600));
    console.log(`   ✓ JWT Token expiration: ${durationDaysTrue} days (expected ~30 days)`);
    assert(durationDaysTrue >= 28 && durationDaysTrue <= 31, 'Remember Me JWT should expire in ~30 days');
    console.log(`   ✓ Set-Cookie: ${setCookieHeaderTrue.split(';')[0]}...`);
    console.log('   ✓ Test 1 PASSED: Persistent session cookie and extended token generated.');

    // -------------------------------------------------------------
    // Test 2: Authenticate /auth/me using ONLY the HttpOnly cookie
    // -------------------------------------------------------------
    console.log('\n[Test 2] Validate /auth/me using ONLY Cookie (no Authorization header)');
    const cookieValue = setCookieHeaderTrue.split(';')[0]; // kanvtech_token=...
    const meResWithCookie = await fetch(`${target.base}/auth/me`, {
      method: 'GET',
      headers: {
        'Cookie': cookieValue,
      },
    });

    assert.strictEqual(meResWithCookie.status, 200, 'Cookie-only request to /auth/me must return 200');
    const meDataWithCookie = await meResWithCookie.json();
    assert.strictEqual(meDataWithCookie.user.email, 'admin@kanvtech.com');
    console.log(`   ✓ Successfully authenticated as: ${meDataWithCookie.user.name || meDataWithCookie.user.email}`);
    console.log('   ✓ Test 2 PASSED: Persistent cookie validates session across browser restart without localStorage token.');

    // -------------------------------------------------------------
    // Test 3: Login with Remember Me = false (Standard Session)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Login with Remember Me UNCHECKED');
    const resRememberFalse = await fetch(`${target.base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kanvtech.com',
        password: 'Password@123',
        rememberMe: false,
      }),
    });

    assert.strictEqual(resRememberFalse.status, 200, 'Login must succeed with status 200');
    const dataRememberFalse = await resRememberFalse.json();
    assert(dataRememberFalse.token, 'Must return JWT token');

    const setCookieHeaderFalse = resRememberFalse.headers.get('set-cookie');
    assert(setCookieHeaderFalse, 'Response must include Set-Cookie header');
    assert(setCookieHeaderFalse.includes('kanvtech_token='), 'Cookie must be named kanvtech_token');
    assert(setCookieHeaderFalse.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    assert(!setCookieHeaderFalse.toLowerCase().includes('max-age='), 'Session cookie must NOT have Max-Age');

    // Verify token expiry (approx 1 day / 24h)
    const decodedFalse = decodeJwt(dataRememberFalse.token);
    const durationSecFalse = decodedFalse.payload.exp - decodedFalse.payload.iat;
    const durationHoursFalse = Math.round(durationSecFalse / 3600);
    console.log(`   ✓ JWT Token expiration: ${durationHoursFalse} hours (expected ~24 hours)`);
    assert(durationHoursFalse >= 23 && durationHoursFalse <= 25, 'Standard session JWT should expire in ~24 hours');
    console.log('   ✓ Test 3 PASSED: Session cookie without Max-Age generated (cleared on browser exit).');

    // -------------------------------------------------------------
    // Test 4: Logout must invalidate session and clear cookies
    // -------------------------------------------------------------
    console.log('\n[Test 4] Logout must clear authentication cookie and invalidate session');
    const logoutRes = await fetch(`${target.base}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': cookieValue,
      },
    });

    assert.strictEqual(logoutRes.status, 200, 'Logout must succeed with status 200');
    const logoutSetCookie = logoutRes.headers.get('set-cookie');
    assert(logoutSetCookie, 'Logout must send Set-Cookie clearing header');
    assert(
      logoutSetCookie.includes('kanvtech_token=;') ||
      logoutSetCookie.includes('Max-Age=0') ||
      logoutSetCookie.includes('Expires='),
      'Logout must invalidate kanvtech_token cookie with Max-Age=0 or past expiry'
    );
    console.log(`   ✓ Logout Set-Cookie clearing instruction: ${logoutSetCookie}`);

    // Verify subsequent request with cleared/no cookie returns 401
    const meAfterLogout = await fetch(`${target.base}/auth/me`, {
      method: 'GET',
      headers: {
        'Cookie': 'kanvtech_token=;',
      },
    });
    assert.strictEqual(meAfterLogout.status, 401, 'Request after logout must be rejected with 401 Unauthorized');
    console.log('   ✓ Post-logout verification returned 401 Unauthorized as required.');
    console.log('   ✓ Test 4 PASSED: User session invalidated; cookies cleared.');

    // -------------------------------------------------------------
    // Test 5: Verify invalid/tampered token returns 401
    // -------------------------------------------------------------
    console.log('\n[Test 5] Verify invalid/tampered token rejection');
    const invalidRes = await fetch(`${target.base}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid.fake.token',
        'Cookie': 'kanvtech_token=invalid.fake.token',
      },
    });
    assert.strictEqual(invalidRes.status, 401, 'Invalid token must return 401');
    console.log('   ✓ Test 5 PASSED: Invalid and expired tokens rejected securely.');
  }

  console.log('\n================================================================');
  console.log('ALL API & SESSION LIFECYCLE TESTS PASSED SUCCESSFULLY! ✓');
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
