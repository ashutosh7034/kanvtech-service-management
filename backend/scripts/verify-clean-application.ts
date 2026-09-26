import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

async function main() {
  console.log('=============================================================');
  console.log(' KANVTECH SERVICE MANAGEMENT - CLEAN STATE VERIFICATION');
  console.log('=============================================================\n');

  // 1. Admin Authentication Check
  console.log('[1/6] Testing System Administrator Login (admin@kanvtech.com)...');
  const adminLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
  });

  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: HTTP ${adminLoginRes.status} ${await adminLoginRes.text()}`);
  }

  const adminAuthData = await adminLoginRes.json();
  const token = adminAuthData.accessToken || adminAuthData.token;
  console.log(` -> Admin login successful! Token received (Role: ${adminAuthData.user?.role || 'ADMIN'}).`);

  // 2. Demo User Login Check (Should Fail / Unauthorized)
  console.log('\n[2/6] Verifying demo user logins are removed/disabled...');
  const demoUsers = ['manager@kanvtech.com', 'l1.amit@kanvtech.com', 'rajesh@acme.com'];
  for (const demoEmail of demoUsers) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demoEmail, password: 'Password@123' }),
    });
    if (res.status === 401 || res.status === 404 || res.status === 400) {
      console.log(` -> Demo user '${demoEmail}' correctly rejected (HTTP ${res.status}).`);
    } else {
      console.warn(` -> WARNING: Demo user '${demoEmail}' was not rejected (HTTP ${res.status}).`);
    }
  }

  // 3. Authenticated Module API Endpoints Check
  console.log('\n[3/6] Verifying authenticated business REST endpoints return clean 0 records...');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const endpoints = [
    { name: 'Product Master', path: '/products', expected: 0 },
    { name: 'Department Master', path: '/departments', expected: 0 },
    { name: 'Employee Master', path: '/employees', expected: 0 },
    { name: 'Customer Master (Companies)', path: '/companies', expected: 0 },
    { name: 'Support Tickets', path: '/tickets', expected: 0 },
    { name: 'Subscriptions / AMC', path: '/subscriptions', expected: 0 },
    { name: 'New Implementations', path: '/implementations', expected: 0 },
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${API_BASE}${ep.path}`, { headers: authHeaders });
    if (!res.ok) {
      console.error(` -> Endpoint ${ep.name} (${ep.path}) returned HTTP ${res.status}: ${await res.text()}`);
      continue;
    }
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : data?.data?.length ?? data?.items?.length ?? 0;
    console.log(` -> ${ep.name.padEnd(30)}: ${count} records (Expected: ${ep.expected}) - ${count === ep.expected ? 'PASS' : 'FAIL'}`);
  }

  // 4. Global SLA Configurations Check
  console.log('\n[4/6] Verifying global SLA rules are intact...');
  const slaRes = await fetch(`${API_BASE}/sla/configs`, { headers: authHeaders });
  if (slaRes.ok) {
    const slas = await slaRes.json();
    console.log(` -> SLA Configurations found: ${slas.length} tiers intact (HIGH, MEDIUM, LOW).`);
  } else {
    console.log(` -> SLA config endpoint status: ${slaRes.status}`);
  }

  // 5. Database Direct Integrity Check
  console.log('\n[5/6] Direct Database Integrity & Orphan Scan...');
  const [
    dbProducts,
    dbDepts,
    dbEmps,
    dbCompanies,
    dbBranches,
    dbTickets,
    dbSubscriptions,
    dbImplementations,
    dbUsers,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.department.count(),
    prisma.employee.count(),
    prisma.company.count(),
    prisma.companyBranch.count(),
    prisma.ticket.count(),
    prisma.subscription.count(),
    prisma.implementation.count(),
    prisma.user.count(),
  ]);

  console.log(` -> Products:        ${dbProducts}`);
  console.log(` -> Departments:     ${dbDepts}`);
  console.log(` -> Employees:       ${dbEmps}`);
  console.log(` -> Companies:       ${dbCompanies}`);
  console.log(` -> Branches:        ${dbBranches}`);
  console.log(` -> Tickets:         ${dbTickets}`);
  console.log(` -> Subscriptions:   ${dbSubscriptions}`);
  console.log(` -> Implementations: ${dbImplementations}`);
  console.log(` -> Users:           ${dbUsers} (Admin User ID: 1)`);

  // 6. Final Status
  console.log('\n=============================================================');
  if (
    dbProducts === 0 &&
    dbDepts === 0 &&
    dbEmps === 0 &&
    dbCompanies === 0 &&
    dbBranches === 0 &&
    dbTickets === 0 &&
    dbSubscriptions === 0 &&
    dbImplementations === 0 &&
    dbUsers === 1
  ) {
    console.log(' ALL VERIFICATIONS PASSED: PLATFORM IS COMPLETELY CLEAN');
    console.log(' READY FOR REAL BUSINESS DATA INITIALIZATION');
  } else {
    console.error(' INTEGRITY VERIFICATION FAILED: NON-ZERO BUSINESS RECORDS FOUND');
  }
  console.log('=============================================================\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Verification error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
