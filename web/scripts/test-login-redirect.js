const assert = require('assert');

function calculateTargetUrl(userOrRes) {
  const user = userOrRes?.user || userOrRes;
  const isPlatformIncharge =
    user?.role === 'PLATFORM_INCHARGE' || user?.isPlatformIncharge === true;
  return isPlatformIncharge ? '/platform' : '/dashboard';
}

console.log('===============================================================');
console.log('LOGIN REDIRECT LOGIC COMPREHENSIVE VERIFICATION SUITE');
console.log('===============================================================\n');

const testCases = [
  { role: 'PLATFORM_INCHARGE', isPlatformIncharge: true, isSuperAdmin: false, expected: '/platform' },
  { role: 'PLATFORM_INCHARGE', isPlatformIncharge: false, isSuperAdmin: false, expected: '/platform' },
  { role: 'SUPER_ADMIN', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  { role: 'ADMIN', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  { role: 'MANAGER', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  { role: 'L1_EMPLOYEE', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  { role: 'L2_EMPLOYEE', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  { role: 'L3_EMPLOYEE', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  { role: 'CUSTOMER', isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
  // Edge cases
  { role: 'CUSTOMER', isPlatformIncharge: true, isSuperAdmin: false, expected: '/platform' },
  { role: 'SUPER_ADMIN', isPlatformIncharge: false, isSuperAdmin: true, expected: '/dashboard' }, // isSuperAdmin true cannot override
  { role: undefined, isPlatformIncharge: undefined, isSuperAdmin: false, expected: '/dashboard' },
  { role: null, isPlatformIncharge: false, isSuperAdmin: false, expected: '/dashboard' },
];

let passed = 0;
let failed = 0;

for (const [idx, tc] of testCases.entries()) {
  const actualDirect = calculateTargetUrl(tc);
  const actualWrapped = calculateTargetUrl({ user: tc });

  try {
    assert.strictEqual(actualDirect, tc.expected, `Direct check failed for role ${tc.role}`);
    assert.strictEqual(actualWrapped, tc.expected, `Wrapped check failed for role ${tc.role}`);
    console.log(`[PASS] Case ${idx + 1}: role=${tc.role}, isPlatformIncharge=${tc.isPlatformIncharge} -> ${actualDirect}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Case ${idx + 1}: role=${tc.role} -> Expected ${tc.expected}, got ${actualDirect}`);
    failed++;
  }
}

console.log('\n===============================================================');
console.log(`TOTAL REDIRECT TESTS: ${testCases.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('===============================================================');

if (failed > 0) process.exit(1);

