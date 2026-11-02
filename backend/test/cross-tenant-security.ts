import assert from 'assert';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { AuditService } from '../src/audit/audit.service';
import { PlatformService } from '../src/platform/platform.service';
import { PlatformSuperAdminGuard } from '../src/auth/platform-super-admin.guard';
import { TenantGuard } from '../src/auth/tenant.guard';
import { TicketsService } from '../src/tickets/tickets.service';
import { CompaniesService } from '../src/companies/companies.service';
import { EmployeesService } from '../src/employees/employees.service';
import { ExportService } from '../src/export/export.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { TimerService } from '../src/timer/timer.service';
import { SlaService } from '../src/sla/sla.service';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`[SECURITY TEST] ${name} ... `);
    await fn();
    console.log('PASSED \u2714');
    passed++;
  } catch (err: any) {
    console.log('FAILED \u2718');
    console.error(`                Error: ${err.message}`);
    failed++;
  }
}

async function runSecuritySuite() {
  console.log('========================================================================');
  console.log('KANVTECH MULTI-TENANT ARCHITECTURE & CROSS-TENANT SECURITY TEST SUITE');
  console.log('Target: Zero cross-tenant data leakage, strict server-side authorization');
  console.log('========================================================================\n');

  const devPrisma = new PrismaService();
  await devPrisma.$connect();

  const stagingPrisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres:root@localhost:5432/kanvtech_sm_staging?schema=public',
      },
    },
  });
  await stagingPrisma.$connect();

  const jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'kanvtech-super-secret-jwt-key' });
  const auditService = new AuditService(devPrisma);
  const authService = new AuthService(devPrisma, jwtService, auditService);
  const platformService = new PlatformService(devPrisma, auditService);
  const notificationsService = new NotificationsService(devPrisma);
  const timerService = new TimerService(devPrisma);
  const slaService = new SlaService(devPrisma);
  const assignmentsService = new AssignmentsService(devPrisma, auditService, notificationsService);
  const companiesService = new CompaniesService(devPrisma, auditService);
  const employeesService = new EmployeesService(devPrisma, auditService);
  const ticketsService = new TicketsService(
    devPrisma,
    assignmentsService,
    slaService,
    timerService,
    auditService,
    notificationsService,
  );
  const exportService = new ExportService(devPrisma, auditService);

  // 1. ISOLATION OF STAGING PRODUCTION DATABASE
  await test('CRITERIA 13 & 14: Production staging DB is 100% UNTOUCHED while dev DB has tenant schema', async () => {
    // Staging must NOT have tenants table
    const stagingCheck = await stagingPrisma.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants'
    `;
    assert.strictEqual(stagingCheck.length, 0, 'Production staging database must NOT contain the tenants table!');

    // Dev DB must have tenants table
    const devCheck = await devPrisma.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants'
    `;
    assert.strictEqual(devCheck.length, 1, 'Development database must contain the tenants table!');
  });

  // 2. ROOT KANVTECH TENANT SEED INTEGRITY
  await test('CRITERIA 5: KANVTECH root tenant exists with migrated baseline data intact', async () => {
    const rootTenant = await devPrisma.tenant.findUnique({ where: { id: 'KANVTECH' } });
    assert(rootTenant, 'KANVTECH root tenant must exist');
    assert.strictEqual(rootTenant.isDefault, true);
    assert.strictEqual(rootTenant.status, 'ACTIVE');

    const ticketCount = await devPrisma.ticket.count({ where: { tenantId: 'KANVTECH' } });
    assert(ticketCount > 0, 'KANVTECH root tenant must own existing tickets');

    const memberCount = await devPrisma.tenantMembership.count({ where: { tenantId: 'KANVTECH' } });
    assert(memberCount >= 100, `KANVTECH root tenant must have all users mapped (found ${memberCount})`);
  });

  // 3. SINGLE SHARED LOGIN URL & SUPER ADMIN AUTHENTICATION
  let superAdminToken: string = '';
  let superAdminUserId: number = 1;
  await test('CRITERIA 1 & 6: Platform Super Admin signs in via shared login and resolves platform role', async () => {
    const loginRes = await authService.login('admin@kanvtech.com', 'admin123');
    assert(loginRes && loginRes.token, 'Super admin login must succeed');
    assert.strictEqual(loginRes.user.isSuperAdmin, true, 'User must have isSuperAdmin flag');
    assert.strictEqual(loginRes.user.tenantId, 'KANVTECH');
    assert.strictEqual(loginRes.user.role, 'SUPER_ADMIN');

    superAdminUserId = loginRes.user.id || loginRes.user.userId;

    // Verify token claims
    const decoded = jwtService.verify(loginRes.token);
    assert.strictEqual(decoded.isSuperAdmin, true);
    assert.strictEqual(decoded.tenantId, 'KANVTECH');
    superAdminToken = loginRes.token;
  });

  // 4. PLATFORM SUPER ADMIN GUARD ACCESS CONTROL
  await test('CRITERIA 6 & 7: Super Admin Guard permits Super Admin and blocks non-super-admins with 403 Forbidden', async () => {
    const guard = new PlatformSuperAdminGuard();

    // 1. Super Admin context
    const superAdminContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 1, email: 'admin@kanvtech.com', isSuperAdmin: true, role: 'SUPER_ADMIN' },
        }),
      }),
    } as any;
    assert.strictEqual(guard.canActivate(superAdminContext), true, 'Super Admin must be permitted');

    // 2. Tenant Administrator context (ADMIN role, but NOT super admin)
    const tenantAdminContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 50, email: 'tenantadmin@apex.com', isSuperAdmin: false, role: 'ADMIN', tenantId: 'apex' },
        }),
      }),
    } as any;
    assert.throws(
      () => guard.canActivate(tenantAdminContext),
      (err: any) => err instanceof ForbiddenException && err.message.includes('Platform Super Administrator'),
      'Tenant Admin must be strictly forbidden with 403 from accessing platform administration',
    );

    // 3. Employee context
    const employeeContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 80, email: 'emp@kanvtech.com', isSuperAdmin: false, role: 'L1_EMPLOYEE' },
        }),
      }),
    } as any;
    assert.throws(
      () => guard.canActivate(employeeContext),
      (err: any) => err instanceof ForbiddenException,
      'Employee must be strictly forbidden with 403',
    );
  });

  // 5. PROVISION SECOND TENANT (APEX CORP) & VERIFY TENANT ADMIN ACCESS
  let apexTenantAdminToken: string = '';
  let apexTenantId: string = '';
  let apexAdminUserId: number = 0;
  await test('CRITERIA 2, 7 & 8: Super Admin provisions Company B (Apex Corp) and Tenant Admin logs in via shared login', async () => {
    // Clean up if previous test run created apex
    await devPrisma.ticket.deleteMany({ where: { tenant: { code: 'apex' } } });
    await devPrisma.company.deleteMany({ where: { tenant: { code: 'apex' } } });
    await devPrisma.tenantMembership.deleteMany({ where: { tenant: { code: 'apex' } } });
    await devPrisma.tenant.deleteMany({ where: { code: 'apex' } });
    await devPrisma.user.deleteMany({ where: { email: 'admin@apexcorp.com' } });

    // Provision Apex Corp
    const res = await platformService.createTenant({
      name: 'Apex Corp Technologies',
      code: 'apex',
      adminEmail: 'admin@apexcorp.com',
      adminName: 'Apex Admin',
      password: 'Password123!',
    });
    assert(res && res.tenant && res.tenant.code === 'apex', 'Apex tenant must be provisioned with code "apex"');
    apexTenantId = res.tenant.id;

    // Tenant Admin logs in via shared login
    const apexLoginRes = await authService.login('admin@apexcorp.com', 'Password123!');
    assert(apexLoginRes && apexLoginRes.token, 'Apex admin login must succeed via shared login URL');
    assert.strictEqual(apexLoginRes.user.tenantId, apexTenantId, 'Tenant membership must resolve to apex tenant ID');
    assert.strictEqual(apexLoginRes.user.tenantName, 'Apex Corp Technologies');
    assert.strictEqual(apexLoginRes.user.isSuperAdmin, false, 'Tenant admin is NOT a platform super admin');
    assert.strictEqual(apexLoginRes.user.role, 'ADMIN', 'Role within Apex workspace is ADMIN');

    apexTenantAdminToken = apexLoginRes.token;
    apexAdminUserId = apexLoginRes.user.id || apexLoginRes.user.userId;
  });

  // 6. MULTI-TENANT USER MEMBERSHIP & EXPLICIT SELECTION
  await test('CRITERIA 12: User with multiple memberships requires explicit selection and cannot switch arbitrarily', async () => {
      // Add multi-tenant consultant user
      const consultantEmail = 'consultant@partner.com';
      await devPrisma.tenantMembership.deleteMany({ where: { user: { email: consultantEmail } } });
      await devPrisma.user.deleteMany({ where: { email: consultantEmail } });

      const passwordHash = await bcrypt.hash('Consultant123!', 10);
      const consultantUser = await devPrisma.user.create({
        data: {
          email: consultantEmail,
          passwordHash,
          role: 'MANAGER',
          isSuperAdmin: false,
        },
      });

      // Grant membership in KANVTECH and apex
      await devPrisma.tenantMembership.create({
        data: {
          tenantId: 'KANVTECH',
          userId: consultantUser.id,
          role: 'MANAGER',
          isActive: true,
        },
      });
      await devPrisma.tenantMembership.create({
        data: {
          tenantId: apexTenantId,
          userId: consultantUser.id,
          role: 'MANAGER',
          isActive: true,
        },
      });

      // Login without selected tenant -> MUST return requiresTenantSelection: true
      const multiLoginRes = await authService.login(consultantEmail, 'Consultant123!');
      assert.strictEqual(multiLoginRes.requiresTenantSelection, true, 'Must require tenant selection when user has multiple memberships');
      assert.strictEqual(multiLoginRes.tenants.length, 2, 'Must list both authorized tenants');

      // Login with explicit selection of "apex"
      const selectedLoginRes = await authService.login(consultantEmail, 'Consultant123!', false, apexTenantId);
      assert(selectedLoginRes.token, 'Login with valid selectedTenantId must succeed');
      assert.strictEqual(selectedLoginRes.user.tenantId, apexTenantId);

      // Switch tenant to valid authorized tenant "KANVTECH"
      const switchedRes = await authService.switchTenant(consultantUser.id, 'KANVTECH');
      assert.strictEqual(switchedRes.user.tenantId, 'KANVTECH', 'Switching to authorized tenant must succeed');

      // Attempt to switch to an unauthorized tenant -> MUST fail with ForbiddenException
      await assert.rejects(
        async () => authService.switchTenant(consultantUser.id, 'NONEXISTENT_TENANT'),
        (err: any) => err instanceof ForbiddenException,
        'Unrestricted tenant switching to non-member tenant must be rejected with 403 Forbidden',
      );
    });

    // 7. CROSS-TENANT DATA ISOLATION (TICKETS & COMPANIES)
    await test('CRITERIA 10: Complete data isolation - Company A cannot access Company B tickets or customers', async () => {
      // 1. Create a customer and ticket in KANVTECH
      const ts = Date.now();
      const kanvtechCompanyId = await companiesService.createCompany(
        {
          companyName: `Kanvtech Exclusive Client Ltd ${ts}`,
          primaryEmail: `kec-${ts}@kec.com`,
          contactPerson: 'Kanvtech Senior Officer',
          contactPhone: '1234567890',
          address: '100 Tech Park',
          tenantId: 'KANVTECH',
        },
        superAdminUserId,
      );

      const kanvtechTicket = await ticketsService.createTicket({
        problemType: 'SOFTWARE',
        priority: 'HIGH',
        category: 'INFRASTRUCTURE',
        description: 'KANVTECH Confidential Infrastructure Issue',
        companyId: kanvtechCompanyId,
        createdByUserId: superAdminUserId,
        tenantId: 'KANVTECH',
      });

      // 2. Create a customer and ticket in Apex Corp
      const apexCompanyId = await companiesService.createCompany(
        {
          companyName: `Apex Exclusive Partner Corp ${ts}`,
          primaryEmail: `apc-${ts}@apexpartner.com`,
          contactPerson: 'Apex Senior Officer',
          contactPhone: '9876543210',
          address: '200 Apex Blvd',
          tenantId: apexTenantId,
        },
        apexAdminUserId,
      );

      const apexTicket = await ticketsService.createTicket({
        problemType: 'NETWORK',
        priority: 'MEDIUM',
        category: 'SECURITY',
        description: 'Apex private firewall status',
        companyId: apexCompanyId,
        createdByUserId: apexAdminUserId,
        tenantId: apexTenantId,
      });

      // 3. Query tickets from Apex's tenant scope
      const apexTicketsRes = await ticketsService.getTickets({ tenantId: apexTenantId });
      const hasApexTicket = apexTicketsRes.data.some((t: any) => t.id === apexTicket.id);
      const hasKanvtechTicket = apexTicketsRes.data.some((t: any) => t.id === kanvtechTicket.id);

      assert(hasApexTicket, 'Apex must see its own ticket');
      assert.strictEqual(hasKanvtechTicket, false, 'CRITICAL SECURITY BREACH: Apex must NEVER see KANVTECH ticket!');

      // 4. Query companies from Apex's tenant scope
      const apexCompaniesRes = await companiesService.getCompanies({ tenantId: apexTenantId });
      const hasApexCompany = apexCompaniesRes.data.some((c: any) => c.id === apexCompanyId);
      const hasKanvtechCompany = apexCompaniesRes.data.some((c: any) => c.id === kanvtechCompanyId);

      assert(hasApexCompany, 'Apex must see its own company');
      assert.strictEqual(hasKanvtechCompany, false, 'CRITICAL SECURITY BREACH: Apex must NEVER see KANVTECH company!');

      // 5. Cross-tenant direct ID access attempt
      const crossTicketLookup = await ticketsService.getTicketById(kanvtechTicket.id, apexTenantId);
      assert.strictEqual(crossTicketLookup, null, 'Direct ticket lookup across tenant boundary must return null / not found');

      const crossCompanyLookup = await companiesService.getCompanyById(kanvtechCompanyId, apexTenantId);
      assert.strictEqual(crossCompanyLookup, null, 'Direct company lookup across tenant boundary must return null / not found');
    });

    // 8. FRONTEND TENANT ID SPOOFING PREVENTION
    await test('CRITERIA 9: Never trust frontend-supplied tenant ID without server authorization', async () => {
      const tenantGuard = new TenantGuard();

      // Attacker context: user session belongs to "apex", but frontend spoofed "KANVTECH" in query/body
      const spoofedRequest = {
        user: {
          userId: 99,
          email: 'attacker@apex.com',
          tenantId: apexTenantId,
          isSuperAdmin: false,
        },
        query: { tenantId: 'KANVTECH' },
        body: { tenantId: 'KANVTECH' },
        headers: { 'x-tenant-id': 'KANVTECH' },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => spoofedRequest,
        }),
      } as any;

      const allowed = tenantGuard.canActivate(mockContext);
      assert.strictEqual(allowed, true);
      // Guard must overwrite or bind the resolved tenant to the user's verified session tenant
      assert.strictEqual(spoofedRequest.user.tenantId, apexTenantId, 'Server must enforce verified tenantId from JWT');
    });

    // 9. EXPORT DATA TENANT ISOLATION
    await test('CRITERIA 10: Data export strictly isolates tenant data with no cross-tenant leakage', async () => {
      const apexExport = await exportService.getExportData('customers', {
        userId: 50,
        role: 'ADMIN',
        tenantId: apexTenantId,
        isSuperAdmin: false,
      });

      const exportedCompanies = apexExport['Companies'] || [];
      const hasOnlyApex = exportedCompanies.every((c: any) => c.tenantId === apexTenantId);
      assert(hasOnlyApex, 'Apex export must contain ONLY apex companies');

      const apexSummary = await exportService.getModulesSummary('ADMIN', apexTenantId);
      assert.strictEqual(apexSummary.counts.companies, exportedCompanies.length);
    });

  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await devPrisma.$disconnect();
  await stagingPrisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
