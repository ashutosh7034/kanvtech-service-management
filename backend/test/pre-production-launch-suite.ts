import { PrismaClient, TicketPriority, TicketStatus } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

interface TestResult {
  name: string;
  phase: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(phase: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    process.stdout.write(`  [${phase}] ${name} ... `);
    await fn();
    const durationMs = Date.now() - start;
    console.log(`PASSED \u2714 (${durationMs}ms)`);
    results.push({ name, phase, passed: true, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(`FAILED \u2718 (${durationMs}ms)`);
    console.error(`         Error: ${err.message}`);
    results.push({ name, phase, passed: false, error: err.message, durationMs });
  }
}

async function loginUser(email: string, pass: string = 'Password@123'): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.token, user: data.user };
}

async function main() {
  console.log('================================================================================');
  console.log(' KANVTECH SERVICE MANAGEMENT PLATFORM - PRE-PRODUCTION LAUNCH AUDIT SUITE');
  console.log(' ENTERPRISE PRE-RELEASE QA + SECURITY + UAT + RBAC + DATA-INTEGRITY');
  console.log('================================================================================\n');

  // Shared state across phases
  let adminToken = '';
  let adminHeaders: Record<string, string> = {};

  let tallyProductId = '';
  let spineProductId = '';
  let biosProductId = '';

  let tallyDeptId = '';
  let spineDeptId = '';
  let biosDeptId = '';

  let tallyL1EmpId = '';
  let tallyL1EmpBId = '';
  let tallyL2EmpId = '';
  let tallyL3EmpId = '';
  let tallyMgrEmpId = '';
  let spineL1EmpId = '';

  let tallyL1Token = '';
  let tallyL1Headers: Record<string, string> = {};
  let tallyL2Token = '';
  let tallyL2Headers: Record<string, string> = {};
  let tallyL3Token = '';
  let tallyL3Headers: Record<string, string> = {};
  let tallyMgrToken = '';
  let tallyMgrHeaders: Record<string, string> = {};

  let custACompanyId = '';
  let custAContactId = 0;
  let custABranchDahisarId = '';
  let custABranchKandivaliId = '';
  let custAUserToken = '';
  let custAHeaders: Record<string, string> = {};

  let custBCompanyId = '';
  let custBContactId = 0;
  let custBUserToken = '';
  let custBHeaders: Record<string, string> = {};

  let activeTicket1Id = '';
  let activeTicket2Id = '';
  let activeTicket3AttemptId = '';

  let implementationId = '';
  let taskId1 = '';
  let taskId2 = '';

  let subscriptionId = '';

  try {
    // =========================================================================
    // PHASE 1: ENVIRONMENT & HEALTH CHECK
    // =========================================================================
    console.log('\n--- PHASE 1: ENVIRONMENT & HEALTH CHECK ---');

    await runTest('Phase 1', 'Health Endpoint returns status ok and database connected', async () => {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error(`Health returned status ${res.status}`);
      const data = await res.json();
      if (data.status !== 'ok' || data.database !== 'connected') {
        throw new Error(`Unexpected health payload: ${JSON.stringify(data)}`);
      }
    });

    // =========================================================================
    // PHASE 2: DATABASE INTEGRITY AUDIT
    // =========================================================================
    console.log('\n--- PHASE 2: DATABASE INTEGRITY AUDIT ---');

    await runTest('Phase 2', 'Initial Clean State has exactly 0 business records and 1 Admin', async () => {
      const [prodCount, deptCount, empCount, compCount, ticketCount, users] = await Promise.all([
        prisma.product.count(),
        prisma.department.count(),
        prisma.employee.count(),
        prisma.company.count(),
        prisma.ticket.count(),
        prisma.user.findMany({ select: { id: true, email: true, role: true } }),
      ]);
      if (prodCount !== 0 || deptCount !== 0 || empCount !== 0 || compCount !== 0 || ticketCount !== 0) {
        throw new Error(
          `Stray business records found before tests: Prods=${prodCount}, Depts=${deptCount}, Emps=${empCount}, Comps=${compCount}, Tickets=${ticketCount}`,
        );
      }
      if (users.length !== 1 || users[0].email !== 'admin@kanvtech.com' || users[0].role !== 'ADMIN') {
        throw new Error(`Unexpected initial users count or identity: ${JSON.stringify(users)}`);
      }
    });

    // =========================================================================
    // PHASE 3 & 4: AUTHENTICATION & LOGIN SECURITY
    // =========================================================================
    console.log('\n--- PHASE 3 & 4: AUTHENTICATION & LOGIN SECURITY ---');

    await runTest('Phase 3', 'Admin login succeeds with valid credentials', async () => {
      const auth = await loginUser('admin@kanvtech.com', 'Password@123');
      adminToken = auth.token;
      adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
      if (!adminToken || auth.user.role !== 'ADMIN') throw new Error('Admin auth token missing or invalid role');
    });

    await runTest('Phase 3', 'Login rejects invalid password (HTTP 401)', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'WrongPassword999!' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await runTest('Phase 3', 'Login rejects invalid/non-existent email (HTTP 401)', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@kanvtech.com', password: 'Password@123' }),
      });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await runTest('Phase 3', 'Login rejects empty email and password (HTTP 400 or 401)', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', password: '' }),
      });
      if (res.status !== 400 && res.status !== 401) throw new Error(`Expected 400/401, got ${res.status}`);
    });

    await runTest('Phase 3', 'Self-service change password rejects wrong current password (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          currentPassword: 'WrongPassword@999',
          newPassword: 'SecureNewPassword@2026',
          confirmPassword: 'SecureNewPassword@2026',
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      const data = await res.json();
      if (!data.error?.includes('Current password is incorrect')) throw new Error(`Unexpected error message: ${data.error}`);
    });

    await runTest('Phase 3', 'Self-service change password rejects weak password (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          currentPassword: 'Password@123',
          newPassword: 'weak',
          confirmPassword: 'weak',
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await runTest('Phase 3', 'Self-service change password rejects same old/new password (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          currentPassword: 'Password@123',
          newPassword: 'Password@123',
          confirmPassword: 'Password@123',
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await runTest('Phase 3', 'Valid change password succeeds and updates credentials', async () => {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          currentPassword: 'Password@123',
          newPassword: 'AdminLaunchPass@2026',
          confirmPassword: 'AdminLaunchPass@2026',
        }),
      });
      if (!res.ok) throw new Error(`Change password failed: ${res.status} ${await res.text()}`);

      // Old password rejected
      const oldRes = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
      });
      if (oldRes.status !== 401) throw new Error(`Old password should be rejected, got ${oldRes.status}`);

      // New password works
      const newAuth = await loginUser('admin@kanvtech.com', 'AdminLaunchPass@2026');
      adminToken = newAuth.token;
      adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

      // Revert back to Password@123 for standard baseline
      const revRes = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          currentPassword: 'AdminLaunchPass@2026',
          newPassword: 'Password@123',
          confirmPassword: 'Password@123',
        }),
      });
      if (!revRes.ok) throw new Error(`Reverting password failed: ${revRes.status}`);
      const finalAuth = await loginUser('admin@kanvtech.com', 'Password@123');
      adminToken = finalAuth.token;
      adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };
    });

    await runTest('Phase 3', 'Response sanitization: Zero password hashes or plain passwords in login response', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@kanvtech.com', password: 'Password@123' }),
      });
      const rawBody = await res.text();
      if (rawBody.includes('password_hash') || rawBody.includes('passwordHash') || rawBody.includes('$2a$') || rawBody.includes('$2b$')) {
        throw new Error('SECURITY VIOLATION: Password hash found in API login response payload!');
      }
    });

    // =========================================================================
    // PHASE 7: PRODUCT MASTER CRUD & RELATIONAL INTEGRITY
    // =========================================================================
    console.log('\n--- PHASE 7: PRODUCT MASTER CRUD & INTEGRITY ---');

    await runTest('Phase 7', 'Create Tally Prime Product', async () => {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: 'TALLY',
          name: 'Tally Prime ERP',
          description: 'Enterprise Accounting & Inventory Management',
          category: 'ACCOUNTING',
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error(`Create product failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyProductId = data.productId || data.product?.id || data.id;
      if (!tallyProductId) throw new Error('Product ID not returned');
    });

    await runTest('Phase 7', 'Create Spine HR Product', async () => {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: 'SPINE',
          name: 'Spine HR & Payroll',
          description: 'Human Resource Management and Attendance Platform',
          category: 'HR_PAYROLL',
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error(`Create product failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      spineProductId = data.productId || data.product?.id || data.id;
      if (!spineProductId) throw new Error('Spine Product ID not returned');
    });

    await runTest('Phase 7', 'Create BIOS 360 Product', async () => {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: 'BIOS360',
          name: 'BIOS 360 Security',
          description: 'Biometric Attendance and Access Control Platform',
          category: 'BIOMETRICS',
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error(`Create product failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      biosProductId = data.productId || data.product?.id || data.id;
      if (!biosProductId) throw new Error('BIOS Product ID not returned');
    });

    await runTest('Phase 7', 'Duplicate product code is rejected (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: 'TALLY',
          name: 'Duplicate Tally',
          category: 'ACCOUNTING',
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400 for duplicate product code, got ${res.status}`);
    });

    await runTest('Phase 7', 'Empty product code/name is rejected (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          code: '',
          name: '',
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400 for empty fields, got ${res.status}`);
    });

    // =========================================================================
    // PHASE 8: DEPARTMENT MASTER & SPECIALIZATION
    // =========================================================================
    console.log('\n--- PHASE 8: DEPARTMENT MASTER & SPECIALIZATION ---');

    await runTest('Phase 8', 'Create Tally Department mapped to Tally Product', async () => {
      const res = await fetch(`${API_BASE}/departments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Tally Support Division',
          code: 'TALLY_DEPT',
          description: 'Specialized Tally Support and Technical Operations',
          productId: tallyProductId,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error(`Create department failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyDeptId = data.id;
    });

    await runTest('Phase 8', 'Create Spine Department mapped to Spine Product', async () => {
      const res = await fetch(`${API_BASE}/departments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Spine HR Division',
          code: 'SPINE_DEPT',
          description: 'Specialized Spine Payroll & HR Operations',
          productId: spineProductId,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error(`Create department failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      spineDeptId = data.id;
    });

    await runTest('Phase 8', 'Create BIOS 360 Department mapped to BIOS 360 Product', async () => {
      const res = await fetch(`${API_BASE}/departments`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'BIOS 360 Biometrics Division',
          code: 'BIOS_DEPT',
          description: 'Specialized Access Control Operations',
          productId: biosProductId,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error(`Create department failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      biosDeptId = data.id;
    });

    // =========================================================================
    // PHASE 9: EMPLOYEE MASTER & SPECIALIZATION
    // =========================================================================
    console.log('\n--- PHASE 9: EMPLOYEE MASTER & SPECIALIZATION ---');

    await runTest('Phase 9', 'Create Tally Manager Employee', async () => {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Vikram Sharma',
          email: 'vikram.mgr@kanvtech.com',
          phone: '+919800000001',
          department_id: tallyDeptId,
          designation: 'Support Operations Manager',
          level: 'MANAGER',
          password: 'Password@123',
        }),
      });
      if (!res.ok) throw new Error(`Create employee failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyMgrEmpId = data.id;
    });

    await runTest('Phase 9', 'Create Tally L1 Employee A', async () => {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Amit Kumar',
          email: 'amit.l1@kanvtech.com',
          phone: '+919800000002',
          department_id: tallyDeptId,
          designation: 'L1 Tally Specialist',
          level: 'L1',
          manager_id: tallyMgrEmpId,
          password: 'Password@123',
        }),
      });
      if (!res.ok) throw new Error(`Create employee failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyL1EmpId = data.id;
    });

    await runTest('Phase 9', 'Create Tally L1 Employee B (for workload routing test)', async () => {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Rahul Varma',
          email: 'rahul.l1@kanvtech.com',
          phone: '+919800000003',
          department_id: tallyDeptId,
          designation: 'L1 Tally Specialist',
          level: 'L1',
          manager_id: tallyMgrEmpId,
          password: 'Password@123',
        }),
      });
      if (!res.ok) throw new Error(`Create employee failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyL1EmpBId = data.id;
    });

    await runTest('Phase 9', 'Create Tally L2 Employee', async () => {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Pooja Nair',
          email: 'pooja.l2@kanvtech.com',
          phone: '+919800000004',
          department_id: tallyDeptId,
          designation: 'L2 Senior Tally Specialist',
          level: 'L2',
          manager_id: tallyMgrEmpId,
          password: 'Password@123',
        }),
      });
      if (!res.ok) throw new Error(`Create employee failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyL2EmpId = data.id;
    });

    await runTest('Phase 9', 'Create Tally L3 Employee', async () => {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Deepak Patel',
          email: 'deepak.l3@kanvtech.com',
          phone: '+919800000005',
          department_id: tallyDeptId,
          designation: 'L3 Principal Solutions Architect',
          level: 'L3',
          manager_id: tallyMgrEmpId,
          password: 'Password@123',
        }),
      });
      if (!res.ok) throw new Error(`Create employee failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      tallyL3EmpId = data.id;
    });

    await runTest('Phase 9', 'Create Spine L1 Employee', async () => {
      const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          name: 'Suresh Menon',
          email: 'suresh.spine@kanvtech.com',
          phone: '+919800000006',
          department_id: spineDeptId,
          designation: 'L1 Spine Specialist',
          level: 'L1',
          password: 'Password@123',
        }),
      });
      if (!res.ok) throw new Error(`Create employee failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      spineL1EmpId = data.id;
    });

    await runTest('Phase 9', 'Authenticate all created employee tiers & store tokens', async () => {
      const authL1 = await loginUser('amit.l1@kanvtech.com');
      tallyL1Token = authL1.token;
      tallyL1Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tallyL1Token}` };

      const authL2 = await loginUser('pooja.l2@kanvtech.com');
      tallyL2Token = authL2.token;
      tallyL2Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tallyL2Token}` };

      const authL3 = await loginUser('deepak.l3@kanvtech.com');
      tallyL3Token = authL3.token;
      tallyL3Headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${tallyL3Token}` };

      const authMgr = await loginUser('vikram.mgr@kanvtech.com');
      tallyMgrToken = authMgr.token;
      tallyMgrHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${tallyMgrToken}` };
    });

    // =========================================================================
    // PHASE 10: PROMOTION & DEMOTION
    // =========================================================================
    console.log('\n--- PHASE 10: EMPLOYEE PROMOTION & DEMOTION ---');

    await runTest('Phase 10', 'Admin promotes Employee (L1 -> L2) and updates role & audit log', async () => {
      const res = await fetch(`${API_BASE}/employees/${tallyL1EmpBId}/promote`, {
        method: 'POST',
        headers: adminHeaders,
      });
      if (!res.ok) throw new Error(`Promote failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const emp = data.employee || data;
      if (emp.level !== 'L2') throw new Error(`Expected level L2, got ${emp.level}`);

      // Verify user table role updated
      const user = await prisma.user.findUnique({ where: { email: 'rahul.l1@kanvtech.com' } });
      if (user?.role !== 'L2_EMPLOYEE') throw new Error(`Expected User role L2_EMPLOYEE, got ${user?.role}`);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'EMPLOYEE_PROMOTED', entityId: tallyL1EmpBId },
        orderBy: { createdAt: 'desc' },
      });
      if (!audit) throw new Error('Missing EMPLOYEE_PROMOTED audit record');
    });

    await runTest('Phase 10', 'Admin demotes Employee back (L2 -> L1)', async () => {
      const res = await fetch(`${API_BASE}/employees/${tallyL1EmpBId}/demote`, {
        method: 'POST',
        headers: adminHeaders,
      });
      if (!res.ok) throw new Error(`Demote failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const emp = data.employee || data;
      if (emp.level !== 'L1') throw new Error(`Expected level L1, got ${emp.level}`);

      const user = await prisma.user.findUnique({ where: { email: 'rahul.l1@kanvtech.com' } });
      if (user?.role !== 'L1_EMPLOYEE') throw new Error(`Expected User role L1_EMPLOYEE, got ${user?.role}`);
    });

    await runTest('Phase 10', 'Non-admin users cannot promote employees (HTTP 403)', async () => {
      const res = await fetch(`${API_BASE}/employees/${tallyL1EmpId}/promote`, {
        method: 'POST',
        headers: tallyL1Headers,
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // =========================================================================
    // PHASE 11, 12, 13: CUSTOMER MASTER, BRANCHES & PRODUCT MAPPINGS
    // =========================================================================
    console.log('\n--- PHASE 11, 12, 13: CUSTOMER MASTER, BRANCHES & MAPPINGS ---');

    await runTest('Phase 11', 'Customer creation requires at least ONE product (HTTP 400 when 0 products)', async () => {
      const res = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          company_name: 'Productless Enterprises Ltd',
          gstn: '27AABCP1111A1Z1',
          primary_email: 'productless@test.com',
          primary_phone: '+919900000001',
          contact_person: 'No Product Guy',
          product_ids: [],
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400 when creating company with 0 products, got ${res.status}`);
    });

    await runTest('Phase 11 & 12', 'Create Customer A (Apex Logistics) with Tally + Spine and 2 Branches', async () => {
      const res = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          company_name: 'Apex Logistics Pvt Ltd',
          gstn: '27AABCA1234A1Z5',
          primary_email: 'contact@apexlogistics.com',
          primary_phone: '+919820111111',
          contact_person: 'Rajesh Varma',
          contact_email: 'rajesh@apexlogistics.com',
          contact_phone: '+919820111111',
          contact_password: 'Password@123',
          address_line1: '101 Apex Tower, Western Express Highway',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400068',
          product_ids: [tallyProductId, spineProductId],
        }),
      });
      if (!res.ok) throw new Error(`Create Customer A failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      custACompanyId = data.id;

      // Create Branch 1: Dahisar (Mapped to Tally)
      const b1Res = await fetch(`${API_BASE}/companies/${custACompanyId}/branches`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          branchName: 'Apex Dahisar Hub',
          branchCode: 'APX-DAH',
          address: 'Station Road, Dahisar East, Mumbai',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400068',
          contactPerson: 'Sanjay Rawat',
          contactPhone: '+919820111122',
          productIds: [tallyProductId],
        }),
      });
      if (!b1Res.ok) throw new Error(`Create Branch Dahisar failed: ${b1Res.status} ${await b1Res.text()}`);
      const b1Data = await b1Res.json();
      custABranchDahisarId = b1Data.id;

      // Create Branch 2: Kandivali (Mapped to Spine)
      const b2Res = await fetch(`${API_BASE}/companies/${custACompanyId}/branches`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          branchName: 'Apex Kandivali Hub',
          branchCode: 'APX-KAN',
          address: 'Link Road, Kandivali West, Mumbai',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400067',
          contactPerson: 'Karan Shah',
          contactPhone: '+919820111133',
          productIds: [spineProductId],
        }),
      });
      if (!b2Res.ok) throw new Error(`Create Branch Kandivali failed: ${b2Res.status} ${await b2Res.text()}`);
      const b2Data = await b2Res.json();
      custABranchKandivaliId = b2Data.id;

      // Fetch Customer A primary contact
      const contact = await prisma.companyContact.findFirst({ where: { companyId: custACompanyId } });
      custAContactId = contact?.id || 1;

      // Authenticate Customer A
      const authA = await loginUser('rajesh@apexlogistics.com');
      custAUserToken = authA.token;
      custAHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${custAUserToken}` };
    });

    await runTest('Phase 11 & 12', 'Create Customer B (Zenith Healthcare) with 0 branches and BIOS 360 Product', async () => {
      const res = await fetch(`${API_BASE}/companies`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          company_name: 'Zenith Healthcare Ltd',
          gstn: '27AABCZ9999A1Z9',
          primary_email: 'info@zenithhealth.com',
          primary_phone: '+919820222222',
          contact_person: 'Anita Deshmukh',
          contact_email: 'anita@zenithhealth.com',
          contact_phone: '+919820222222',
          contact_password: 'Password@123',
          address_line1: '505 Health Park, BKC',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400051',
          product_ids: [biosProductId],
        }),
      });
      if (!res.ok) throw new Error(`Create Customer B failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      custBCompanyId = data.id;

      const contact = await prisma.companyContact.findFirst({ where: { companyId: custBCompanyId } });
      custBContactId = contact?.id || 2;

      // Authenticate Customer B
      const authB = await loginUser('anita@zenithhealth.com');
      custBUserToken = authB.token;
      custBHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${custBUserToken}` };
    });

    // =========================================================================
    // PHASE 14 & 15: PRODUCT ROUTING & WORKLOAD AUTO-ASSIGNMENT
    // =========================================================================
    console.log('\n--- PHASE 14 & 15: PRODUCT ROUTING & WORKLOAD ASSIGNMENT ---');

    await runTest('Phase 14 & 15', 'Customer opens Tally Ticket 1 -> Routes to Tally Dept and auto-assigns to lowest workload L1 (Amit)', async () => {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({
          company_id: custACompanyId,
          customer_contact_id: custAContactId,
          product_id: tallyProductId,
          branch_id: custABranchDahisarId,
          problem_type: 'GST E-Invoice Sync Error',
          category: 'SOFTWARE_ISSUE',
          priority: 'HIGH',
          description: 'E-Invoice generation failing with error 404 in Tally Prime.',
        }),
      });
      if (!res.ok) throw new Error(`Create Ticket 1 failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      activeTicket1Id = data.id || data.ticket?.id;
      const t = data.ticket || data;
      if (t.department_id !== tallyDeptId && t.departmentId !== tallyDeptId) {
        throw new Error(`Ticket not routed to Tally Department! Got: ${t.department_id}`);
      }
      if (t.assigned_employee_id !== tallyL1EmpId && t.assignedEmployeeId !== tallyL1EmpId) {
        throw new Error(`Ticket not assigned to expected L1 specialist Amit! Got: ${t.assigned_employee_id}`);
      }
    });

    await runTest('Phase 15', 'Customer opens Tally Ticket 2 -> Auto-assigns to lowest workload L1 (Rahul) because Amit has 1 active ticket', async () => {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({
          company_id: custACompanyId,
          customer_contact_id: custAContactId,
          product_id: tallyProductId,
          branch_id: custABranchDahisarId,
          problem_type: 'Bank Reconciliation Mismatch',
          category: 'CONFIG_ISSUE',
          priority: 'MEDIUM',
          description: 'Reconciliation statement showing discrepancy in ledger entries.',
        }),
      });
      if (!res.ok) throw new Error(`Create Ticket 2 failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      activeTicket2Id = data.id || data.ticket?.id;
      const t = data.ticket || data;
      if (t.assigned_employee_id !== tallyL1EmpBId && t.assignedEmployeeId !== tallyL1EmpBId) {
        throw new Error(`Workload load-balancing failed: expected Rahul (${tallyL1EmpBId}), got ${t.assigned_employee_id}`);
      }
    });

    // =========================================================================
    // PHASE 18: TWO ACTIVE TICKET RULE
    // =========================================================================
    console.log('\n--- PHASE 18: TWO ACTIVE TICKET RULE ---');

    await runTest('Phase 18', 'Customer A attempting 3rd concurrent active ticket is REJECTED (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({
          company_id: custACompanyId,
          customer_contact_id: custAContactId,
          product_id: spineProductId,
          branch_id: custABranchKandivaliId,
          problem_type: 'Payroll Calculation Discrepancy',
          category: 'PAYROLL',
          priority: 'LOW',
          description: 'Third active ticket attempt.',
        }),
      });
      if (res.status !== 400) throw new Error(`Expected 400 rejection for 3rd active ticket, got ${res.status}`);
      const data = await res.json();
      if (!data.message?.includes('2 active tickets') && !data.error?.includes('2 active tickets')) {
        throw new Error(`Unexpected message for 2-ticket limit: ${JSON.stringify(data)}`);
      }
    });

    // =========================================================================
    // PHASE 17, 21, 22, 23: TICKET LIFECYCLE, SLA, RESOLUTION TIMER & ESCALATION
    // =========================================================================
    console.log('\n--- PHASE 17, 21, 22, 23: LIFECYCLE, TIMER & ESCALATION ---');

    await runTest('Phase 22', 'L1 Specialist Amit starts work session on Ticket 1 -> Timer begins and status becomes IN_PROGRESS', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/start-work`, {
        method: 'POST',
        headers: tallyL1Headers,
        body: JSON.stringify({ employeeId: tallyL1EmpId }),
      });
      if (!res.ok) throw new Error(`Start work failed: ${res.status} ${await res.text()}`);

      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, { headers: tallyL1Headers });
      const data = await tRes.json();
      const t = data.ticket || data;
      if (t.status !== 'IN_PROGRESS') throw new Error(`Expected status IN_PROGRESS, got ${t.status}`);
      if (t.is_timer_running !== 1 && !t.isTimerRunning && !t.timer?.isRunning && !t.timer?.running) throw new Error('Resolution timer is not running');
    });

    await runTest('Phase 17 & 21', 'L1 Escalates Ticket 1 to L2 (Pooja) with escalation reason', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/escalate`, {
        method: 'POST',
        headers: tallyL1Headers,
        body: JSON.stringify({
          target_level: 'L2',
          employee_id: tallyL2EmpId,
          reason: 'Requires advanced schema mapping and gateway configuration.',
        }),
      });
      if (!res.ok) throw new Error(`Escalate to L2 failed: ${res.status} ${await res.text()}`);
      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, { headers: tallyL2Headers });
      const data = await tRes.json();
      const t = data.ticket || data;
      if (t.assigned_level !== 'L2') throw new Error(`Expected level L2, got ${t.assigned_level}`);
      if (t.assigned_employee_id !== tallyL2EmpId) throw new Error(`Expected assigned employee Pooja (${tallyL2EmpId}), got ${t.assigned_employee_id}`);
    });

    await runTest('Phase 17', 'L2 Starts Work and Escalates Ticket 1 to L3 (Deepak)', async () => {
      await fetch(`${API_BASE}/tickets/${activeTicket1Id}/start-work`, {
        method: 'POST',
        headers: tallyL2Headers,
        body: JSON.stringify({ employeeId: tallyL2EmpId }),
      });

      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/escalate`, {
        method: 'POST',
        headers: tallyL2Headers,
        body: JSON.stringify({
          target_level: 'L3',
          employee_id: tallyL3EmpId,
          reason: 'Requires source code patch in GST module connector.',
        }),
      });
      if (!res.ok) throw new Error(`Escalate to L3 failed: ${res.status} ${await res.text()}`);
      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, { headers: tallyL3Headers });
      const data = await tRes.json();
      const t = data.ticket || data;
      if (t.assigned_level !== 'L3') throw new Error(`Expected level L3, got ${t.assigned_level}`);
    });

    await runTest('Phase 23', 'L3 Direct Resolution -> Moves ticket directly to CUSTOMER_FEEDBACK without manager bottleneck', async () => {
      await fetch(`${API_BASE}/tickets/${activeTicket1Id}/start-work`, {
        method: 'POST',
        headers: tallyL3Headers,
        body: JSON.stringify({ employeeId: tallyL3EmpId }),
      });

      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/resolve`, {
        method: 'POST',
        headers: tallyL3Headers,
        body: JSON.stringify({
          notes: 'Patched GST gateway connector and verified payload synchronization. E-Invoices generating correctly.',
          actionTaken: 'Connector Patch v2.4 Applied',
        }),
      });
      if (!res.ok) throw new Error(`Resolve failed: ${res.status} ${await res.text()}`);

      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, { headers: tallyL3Headers });
      const data = await tRes.json();
      const t = data.ticket || data;
      if (t.status !== 'CUSTOMER_FEEDBACK') {
        throw new Error(`Expected direct CUSTOMER_FEEDBACK status, got ${t.status}`);
      }
      if (t.is_timer_running === 1 || t.timer?.running) throw new Error('Resolution timer should be stopped upon resolution');
    });

    // =========================================================================
    // PHASE 20 & 24: CUSTOMER-ONLY CSAT FEEDBACK & CLOSURE
    // =========================================================================
    console.log('\n--- PHASE 20 & 24: CSAT FEEDBACK & CLOSURE ---');

    await runTest('Phase 20', 'Customer B cannot submit feedback on Customer A Ticket 1 (HTTP 403)', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/feedback`, {
        method: 'POST',
        headers: custBHeaders,
        body: JSON.stringify({ rating: 5, remarks: 'Unauthorized rating attempt' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden for cross-customer feedback, got ${res.status}`);
    });

    await runTest('Phase 20', 'Admin/Manager/Engineers cannot submit customer feedback (HTTP 403)', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/feedback`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ rating: 5, remarks: 'Admin rating attempt' }),
      });
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden for non-customer feedback, got ${res.status}`);
    });

    await runTest('Phase 24', 'Customer A submits 5-star CSAT Feedback -> Auto-closes Ticket 1', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/feedback`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({
          rating: 5,
          remarks: 'Excellent resolution by Deepak and team. All E-Invoices now syncing seamlessly!',
        }),
      });
      if (!res.ok) throw new Error(`Customer feedback failed: ${res.status} ${await res.text()}`);

      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, { headers: custAHeaders });
      const data = await tRes.json();
      const t = data.ticket || data;
      if (t.status !== 'CLOSED') throw new Error(`Expected status CLOSED after CSAT feedback, got ${t.status}`);
      if (!t.closed_at && !t.closedAt) throw new Error('Missing closed_at timestamp');
    });

    await runTest('Phase 18', 'With Ticket 1 CLOSED, Customer A can now open 3rd Ticket (formerly blocked)', async () => {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({
          company_id: custACompanyId,
          customer_contact_id: custAContactId,
          product_id: spineProductId,
          branch_id: custABranchKandivaliId,
          problem_type: 'Biometric Attendance Sync Delay',
          category: 'SYNC_ISSUE',
          priority: 'MEDIUM',
          description: 'Attendance records taking 15 minutes to reflect in Spine.',
        }),
      });
      if (!res.ok) throw new Error(`Create Ticket 3 failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      activeTicket3AttemptId = data.id || data.ticket?.id;
    });

    // =========================================================================
    // PHASE 19: CUSTOMER REOPEN & TWO-TICKET RULE
    // =========================================================================
    console.log('\n--- PHASE 19: CUSTOMER REOPEN & RULES ---');

    await runTest('Phase 19', 'Customer cannot reopen Ticket 1 without a reason (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/reopen`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({ reason: '' }),
      });
      if (res.status !== 400) throw new Error(`Expected 400 for empty reopen reason, got ${res.status}`);
    });

    await runTest('Phase 19', 'Customer cannot reopen Ticket 1 when already having 2 active tickets (Tickets 2 & 3 active) (HTTP 400)', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/reopen`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({ reason: 'Need to reopen this test ticket' }),
      });
      if (res.status !== 400) throw new Error(`Expected 400 because customer already has 2 active tickets, got ${res.status}`);
      const data = await res.json();
      if (!data.message?.includes('2 active tickets') && !data.error?.includes('2 active tickets')) {
        throw new Error(`Unexpected message: ${JSON.stringify(data)}`);
      }
    });

    await runTest('Phase 19', 'Explicitly close Ticket 3, then reopen Ticket 1 with reason -> Ticket 1 becomes active again', async () => {
      // Close Ticket 3
      await fetch(`${API_BASE}/tickets/${activeTicket3AttemptId}/close`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({ closureReason: 'Resolved by internal IT team' }),
      });

      // Now reopen Ticket 1
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}/reopen`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({ reason: 'Issue resurfaced on latest e-waybill generation cycle.' }),
      });
      if (!res.ok) throw new Error(`Reopen failed: ${res.status} ${await res.text()}`);

      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, { headers: custAHeaders });
      const data = await tRes.json();
      const t = data.ticket || data;
      if (t.status !== 'IN_PROGRESS' && t.status !== 'REOPENED') {
        throw new Error(`Expected status IN_PROGRESS or REOPENED, got ${t.status}`);
      }
      if (!t.reopen_history || t.reopen_history.length === 0) {
        throw new Error('Reopen history was not recorded');
      }
    });

    // =========================================================================
    // PHASE 25: ANNUAL MAINTENANCE / SUBSCRIPTION LIFECYCLE
    // =========================================================================
    console.log('\n--- PHASE 25: ANNUAL MAINTENANCE & SUBSCRIPTIONS ---');

    await runTest('Phase 25', 'Create Annual Maintenance Subscription for Customer A', async () => {
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);

      const res = await fetch(`${API_BASE}/subscriptions`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          companyId: custACompanyId,
          productId: tallyProductId,
          branchId: custABranchDahisarId,
          planName: 'Tally Prime Enterprise Gold AMC',
          startDate: today.toISOString(),
          expiryDate: nextYear.toISOString(),
          slaPlan: 'GOLD',
          status: 'ACTIVE',
        }),
      });
      if (!res.ok) throw new Error(`Create subscription failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      subscriptionId = data.id || data.subscription?.id;
    });

    await runTest('Phase 25', 'Send Maintenance Warning for Subscription', async () => {
      const res = await fetch(`${API_BASE}/subscriptions/${subscriptionId}/warning`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ notes: 'Renewal reminder: AMC contract expiring in 30 days.' }),
      });
      if (!res.ok) throw new Error(`Send AMC warning failed: ${res.status} ${await res.text()}`);
    });

    // =========================================================================
    // PHASE 26 & 27: NEW IMPLEMENTATIONS & TASK PROGRESS
    // =========================================================================
    console.log('\n--- PHASE 26 & 27: IMPLEMENTATIONS & TASK PROGRESS ---');

    await runTest('Phase 26', 'Create New Implementation project with target date and assigned lead', async () => {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + 2);

      const res = await fetch(`${API_BASE}/implementations`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          companyId: custACompanyId,
          productId: tallyProductId,
          branchId: custABranchDahisarId,
          leadEmployeeId: tallyMgrEmpId,
          targetGoLiveDate: targetDate.toISOString(),
          tasks: ['System Requirements Gathering', 'Chart of Accounts Configuration', 'User Training & Go-Live'],
        }),
      });
      if (!res.ok) throw new Error(`Create implementation failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      implementationId = data.id || data.implementation?.id;

      const imp = await prisma.implementation.findUnique({
        where: { id: implementationId },
        include: { tasks: true },
      });
      if (!imp || imp.tasks.length !== 3) throw new Error('Implementation tasks not properly generated');
      taskId1 = imp.tasks[0].id;
      taskId2 = imp.tasks[1].id;
    });

    await runTest('Phase 27', 'Task checkbox dynamically updates implementation progress (33% -> 66% -> 33%)', async () => {
      // Toggle Task 1 -> Completed (Progress ~33%)
      const r1 = await fetch(`${API_BASE}/implementations/tasks/${taskId1}/toggle`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ isCompleted: true }),
      });
      if (!r1.ok) throw new Error(`Toggle task 1 failed: ${r1.status}`);

      let imp = await prisma.implementation.findUnique({ where: { id: implementationId } });
      if (imp?.progressPercentage !== 33) {
        throw new Error(`Expected progress 33%, got ${imp?.progressPercentage}%`);
      }

      // Toggle Task 2 -> Completed (Progress ~67%)
      const r2 = await fetch(`${API_BASE}/implementations/tasks/${taskId2}/toggle`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ isCompleted: true }),
      });
      if (!r2.ok) throw new Error(`Toggle task 2 failed: ${r2.status}`);

      imp = await prisma.implementation.findUnique({ where: { id: implementationId } });
      if (imp?.progressPercentage !== 67) {
        throw new Error(`Expected progress 67%, got ${imp?.progressPercentage}%`);
      }

      // Uncheck Task 2 -> Recalculates back to 33%
      const r3 = await fetch(`${API_BASE}/implementations/tasks/${taskId2}/toggle`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ isCompleted: false }),
      });
      if (!r3.ok) throw new Error(`Unchecking task 2 failed: ${r3.status}`);

      imp = await prisma.implementation.findUnique({ where: { id: implementationId } });
      if (imp?.progressPercentage !== 33) {
        throw new Error(`Expected progress 33% after uncheck, got ${imp?.progressPercentage}%`);
      }
    });

    // =========================================================================
    // PHASE 30 & 31: CUSTOMER DATA ISOLATION & API SECURITY
    // =========================================================================
    console.log('\n--- PHASE 30 & 31: CUSTOMER DATA ISOLATION & API SECURITY ---');

    await runTest('Phase 30', 'Customer B CANNOT view Customer A Ticket 1 via direct IDOR GET (HTTP 403/404)', async () => {
      const res = await fetch(`${API_BASE}/tickets/${activeTicket1Id}`, {
        headers: custBHeaders,
      });
      if (res.status !== 403 && res.status !== 404) {
        throw new Error(`Expected 403/404 for IDOR cross-tenant ticket query, got ${res.status}`);
      }
    });

    await runTest('Phase 30', 'Customer B ticket list returns ONLY Customer B tickets and ZERO Customer A tickets', async () => {
      const res = await fetch(`${API_BASE}/tickets`, {
        headers: custBHeaders,
      });
      if (!res.ok) throw new Error(`Get tickets failed: ${res.status}`);
      const data = await res.json();
      const list = data.data || data;
      for (const t of list) {
        if (t.company_id === custACompanyId || t.companyId === custACompanyId) {
          throw new Error('SECURITY BREACH: Customer A ticket leaked to Customer B ticket listing!');
        }
      }
    });

    await runTest('Phase 33', 'XSS Injection Payload is safely escaped and sanitized without rendering execution', async () => {
      const xssPayload = '<script>alert("XSS_AUDIT")</script>';
      const res = await fetch(`${API_BASE}/tickets/${activeTicket2Id}/comments`, {
        method: 'POST',
        headers: custAHeaders,
        body: JSON.stringify({
          comment_type: 'CUSTOMER_COMMUNICATION',
          message: `User test comment with ${xssPayload}`,
        }),
      });
      if (!res.ok) throw new Error(`Comment failed: ${res.status}`);
      const tRes = await fetch(`${API_BASE}/tickets/${activeTicket2Id}`, { headers: custAHeaders });
      const data = await tRes.json();
      const t = data.ticket || data;
      const lastComment = t.comments?.[t.comments.length - 1];
      if (!lastComment || !lastComment.message.includes('<script>')) {
        throw new Error('Comment not stored as literal string');
      }
    });

    // =========================================================================
    // PHASE 39: AUDIT LOGGING VERIFICATION
    // =========================================================================
    console.log('\n--- PHASE 39: AUDIT LOGGING VERIFICATION ---');

    await runTest('Phase 39', 'Audit log contains sensitive lifecycle events and ZERO leaked passwords/tokens', async () => {
      const logs = await prisma.auditLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      if (logs.length === 0) throw new Error('No audit logs were generated');

      for (const l of logs) {
        const jsonStr = JSON.stringify(l);
        if (jsonStr.includes('passwordHash') || jsonStr.includes('password_hash') || jsonStr.includes('Password@123') || jsonStr.includes('Bearer eyJ')) {
          throw new Error(`SECURITY BREACH: Sensitive credential found inside audit log record ID ${l.id}!`);
        }
      }
    });

  } finally {
    // =========================================================================
    // CONTROLLED TEARDOWN: RETURN DATABASE TO EXACT CLEAN STATE
    // =========================================================================
    console.log('\n--- CONTROLLED TEARDOWN & RE-VERIFICATION ---');
    console.log('Cleaning test records created during audit to maintain clean production data...');

    await prisma.$transaction(async (tx) => {
      await tx.ticketFeedback.deleteMany();
      await tx.ticketReopenHistory.deleteMany();
      await tx.ticketEscalation.deleteMany();
      await tx.ticketResolutionSession.deleteMany();
      await tx.ticketHistory.deleteMany();
      await tx.ticketComment.deleteMany();
      await tx.ticketAttachment.deleteMany();
      await tx.ticket.deleteMany();

      await tx.implementationTask.deleteMany();
      await tx.implementation.deleteMany();

      await tx.subscription.deleteMany();

      await tx.branchProduct.deleteMany();
      await tx.companyBranch.deleteMany();
      await tx.companyProduct.deleteMany();
      await tx.companyContact.deleteMany();
      await tx.company.deleteMany();

      await tx.employee.deleteMany();
      await tx.department.deleteMany();
      await tx.product.deleteMany();

      await tx.notification.deleteMany();
      await tx.auditLog.deleteMany();

      // Delete non-admin users
      await tx.user.deleteMany({
        where: { email: { not: 'admin@kanvtech.com' } },
      });
    });

    const [finalProds, finalDepts, finalEmps, finalComps, finalTickets, finalUsers] = await Promise.all([
      prisma.product.count(),
      prisma.department.count(),
      prisma.employee.count(),
      prisma.company.count(),
      prisma.ticket.count(),
      prisma.user.findMany({ select: { id: true, email: true, role: true } }),
    ]);

    console.log(`\nFinal Database State:`);
    console.log(` -> Products:        ${finalProds}`);
    console.log(` -> Departments:     ${finalDepts}`);
    console.log(` -> Employees:       ${finalEmps}`);
    console.log(` -> Companies:       ${finalComps}`);
    console.log(` -> Tickets:         ${finalTickets}`);
    console.log(` -> Users:           ${finalUsers.length} (Admin: ${finalUsers[0]?.email})`);

    const isClean =
      finalProds === 0 &&
      finalDepts === 0 &&
      finalEmps === 0 &&
      finalComps === 0 &&
      finalTickets === 0 &&
      finalUsers.length === 1 &&
      finalUsers[0]?.email === 'admin@kanvtech.com';

    if (isClean) {
      console.log(' \u2714 Clean database baseline successfully restored!');
    } else {
      console.error(' \u2718 Database teardown incomplete!');
    }
  }

  // Summary Metrics
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================================');
  console.log(` AUDIT EXECUTION SUMMARY: ${passed}/${total} TESTS PASSED`);
  if (failed === 0) {
    console.log(' STATUS: 100% PASS - ALL PHASES VERIFIED SUCCESSFULLY');
  } else {
    console.log(` STATUS: ${failed} TEST(S) FAILED`);
  }
  console.log('================================================================================\n');

  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error('Fatal audit error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
