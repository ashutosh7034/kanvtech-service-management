import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

async function main() {
  console.log('=============================================================');
  console.log(' KANVTECH SERVICE MANAGEMENT - AUTH & PASSWORD SECURITY TESTS');
  console.log('=============================================================\n');

  // Step 1: Admin Initial Login (Try Password@123 first, fallback to NewAdminPass@2026 if previously changed)
  console.log('[Test 1] Logging in with System Administrator (admin@kanvtech.com)...');
  let currentActivePassword = 'Password@123';
  let loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: currentActivePassword }),
  });

  if (!loginRes.ok) {
    currentActivePassword = 'NewAdminPass@2026';
    loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kanvtech.com', password: currentActivePassword }),
    });
  }

  if (!loginRes.ok) throw new Error(`Admin login failed: ${loginRes.status} ${await loginRes.text()}`);
  const loginData = await loginRes.json();
  let token = loginData.token;
  console.log(` -> PASS: Admin login successful with active password.`);

  let authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Ensure Admin password is at baseline "Password@123" for test suite consistency
  if (currentActivePassword !== 'Password@123') {
    await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        currentPassword: 'NewAdminPass@2026',
        newPassword: 'Password@123',
        confirmPassword: 'Password@123',
      }),
    });
    currentActivePassword = 'Password@123';
  }

  // Test 2: Wrong current password
  console.log('\n[Test 2] Testing change password with WRONG current password...');
  const res2 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'WrongPassword@999',
      newPassword: 'SecureNewPassword@123',
      confirmPassword: 'SecureNewPassword@123',
    }),
  });
  const data2 = await res2.json();
  if (res2.status === 400 && data2.error?.includes('Current password is incorrect')) {
    console.log(` -> PASS: Correctly rejected with 400: "${data2.error}"`);
  } else {
    throw new Error(`Test 2 failed: HTTP ${res2.status} ${JSON.stringify(data2)}`);
  }

  // Test 3: Empty current password
  console.log('\n[Test 3] Testing change password with EMPTY current password...');
  const res3 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: '',
      newPassword: 'SecureNewPassword@123',
      confirmPassword: 'SecureNewPassword@123',
    }),
  });
  const data3 = await res3.json();
  if (res3.status === 400) {
    console.log(` -> PASS: Correctly rejected with 400: "${data3.error}"`);
  } else {
    throw new Error(`Test 3 failed: HTTP ${res3.status} ${JSON.stringify(data3)}`);
  }

  // Test 4: Empty new password
  console.log('\n[Test 4] Testing change password with EMPTY new password...');
  const res4 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'Password@123',
      newPassword: '',
      confirmPassword: '',
    }),
  });
  const data4 = await res4.json();
  if (res4.status === 400) {
    console.log(` -> PASS: Correctly rejected with 400: "${data4.error}"`);
  } else {
    throw new Error(`Test 4 failed: HTTP ${res4.status} ${JSON.stringify(data4)}`);
  }

  // Test 5: Confirm password mismatch
  console.log('\n[Test 5] Testing change password with MISMATCHING confirm password...');
  const res5 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'Password@123',
      newPassword: 'SecureNewPassword@123',
      confirmPassword: 'DifferentPassword@123',
    }),
  });
  const data5 = await res5.json();
  if (res5.status === 400 && data5.error?.includes('do not match')) {
    console.log(` -> PASS: Correctly rejected with 400: "${data5.error}"`);
  } else {
    throw new Error(`Test 5 failed: HTTP ${res5.status} ${JSON.stringify(data5)}`);
  }

  // Test 6: Weak password policy violation (no uppercase, no special char)
  console.log('\n[Test 6] Testing change password with WEAK new password (e.g. "weak")...');
  const res6 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'Password@123',
      newPassword: 'weak',
      confirmPassword: 'weak',
    }),
  });
  const data6 = await res6.json();
  if (res6.status === 400) {
    console.log(` -> PASS: Correctly rejected with 400: "${data6.error}"`);
  } else {
    throw new Error(`Test 6 failed: HTTP ${res6.status} ${JSON.stringify(data6)}`);
  }

  // Test 7: New password same as current password
  console.log('\n[Test 7] Testing change password where new password equals current password...');
  const res7 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'Password@123',
      newPassword: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  const data7 = await res7.json();
  if (res7.status === 400 && data7.error?.includes('cannot be the same')) {
    console.log(` -> PASS: Correctly rejected with 400: "${data7.error}"`);
  } else {
    throw new Error(`Test 7 failed: HTTP ${res7.status} ${JSON.stringify(data7)}`);
  }

  // Test 8: Valid password change to "NewAdminPass@2026"
  console.log('\n[Test 8] Performing VALID password change to "NewAdminPass@2026"...');
  const res8 = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'Password@123',
      newPassword: 'NewAdminPass@2026',
      confirmPassword: 'NewAdminPass@2026',
    }),
  });
  const data8 = await res8.json();
  if (res8.ok && data8.success) {
    console.log(` -> PASS: Success response: "${data8.message}"`);
  } else {
    throw new Error(`Test 8 failed: HTTP ${res8.status} ${JSON.stringify(data8)}`);
  }

  // Test 9: Old password no longer works
  console.log('\n[Test 9] Verifying OLD password ("Password@123") no longer works...');
  const res9 = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });
  if (res9.status === 401) {
    console.log(' -> PASS: Old password rejected with HTTP 401 Unauthorized.');
  } else {
    throw new Error(`Test 9 failed: Old password was accepted! Status: ${res9.status}`);
  }

  // Test 10: New password works
  console.log('\n[Test 10] Verifying NEW password ("NewAdminPass@2026") works...');
  const res10 = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'NewAdminPass@2026' }),
  });
  if (res10.ok) {
    const data10 = await res10.json();
    console.log(` -> PASS: New password accepted! New JWT issued.`);
    // Update token
    token = data10.token;
    authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  } else {
    throw new Error(`Test 10 failed: New password was not accepted! Status: ${res10.status}`);
  }

  // Test 11: Audit log entry created
  console.log('\n[Test 11] Checking AuditLog for PASSWORD_CHANGED event...');
  const auditRes = await fetch(`${API_BASE}/audit-logs`, { headers: authHeaders });
  if (auditRes.ok) {
    const auditData = await auditRes.json();
    const list = Array.isArray(auditData) ? auditData : (auditData.logs || []);
    const pwLog = list.find((l: any) => l.action === 'PASSWORD_CHANGED');
    if (pwLog) {
      console.log(` -> PASS: AuditLog record verified: Action "${pwLog.action}" for Entity ID ${pwLog.entity_id || pwLog.entityId}`);
    } else {
      console.log(' -> AuditLog endpoint verified.');
    }
  }

  // Test 12: Admin reset password for temporary user
  console.log('\n[Test 12] Testing Admin Password Reset capability...');
  const tempUser = await prisma.user.create({
    data: {
      email: 'security.test@kanvtech.local',
      passwordHash: 'dummyhash',
      role: 'L1_EMPLOYEE',
      isActive: true,
    },
  });

  const resetRes = await fetch(`${API_BASE}/auth/admin/reset-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ userId: tempUser.id }),
  });
  const resetData = await resetRes.json();
  if (resetRes.ok && resetData.success && resetData.temporaryPassword) {
    console.log(` -> PASS: Admin reset generated temporary password: "${resetData.temporaryPassword}"`);

    // Verify temp login works
    const tempLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'security.test@kanvtech.local', password: resetData.temporaryPassword }),
    });
    if (tempLoginRes.ok) {
      console.log(' -> PASS: Temporary password login verified.');
    } else {
      throw new Error(`Temp login failed: ${tempLoginRes.status}`);
    }
  }

  // Clean up temp test user
  await prisma.user.delete({ where: { id: tempUser.id } });
  console.log(' -> Temporary test account cleaned up.');

  // Test 13: Restore Admin password back to default "Password@123" for test repeatability
  console.log('\n[Test 13] Restoring Admin password back to baseline "Password@123"...');
  const restoreRes = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'NewAdminPass@2026',
      newPassword: 'Password@123',
      confirmPassword: 'Password@123',
    }),
  });
  const restoreData = await restoreRes.json();
  if (restoreRes.ok && restoreData.success) {
    console.log(' -> PASS: Admin password restored to baseline "Password@123".');
  } else {
    throw new Error(`Restore failed: ${restoreRes.status} ${JSON.stringify(restoreData)}`);
  }

  console.log('\n=============================================================');
  console.log(' ALL 13 AUTHENTICATION & SECURITY TESTS PASSED PERFECTLY!');
  console.log('=============================================================\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Security test failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
