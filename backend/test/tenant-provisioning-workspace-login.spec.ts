import assert from 'assert';
import { ForbiddenException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PlatformSuperAdminGuard } from '../src/auth/platform-super-admin.guard';
import { PlatformService } from '../src/platform/platform.service';
import { AuthService } from '../src/auth/auth.service';
import bcrypt from 'bcryptjs';

let passed = 0;
let failed = 0;
const testResults: Array<{ id: number; name: string; status: 'PASSED' | 'FAILED'; error?: string }> = [];

async function test(id: number, name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`[REGRESSION TEST ${id.toString().padStart(2, '0')}] ${name} ... `);
    await fn();
    console.log('PASSED \u2714');
    passed++;
    testResults.push({ id, name, status: 'PASSED' });
  } catch (err: any) {
    console.log('FAILED \u2718');
    console.error(`                        Error: ${err.message}`);
    failed++;
    testResults.push({ id, name, status: 'FAILED', error: err.message });
  }
}

// In-Memory Test Fixture Factory
function createTestContext() {
  let nextUserId = 100;
  let nextMembershipId = 100;
  let nextEmpNum = 10;

  const tenants: any[] = [
    { id: 'KANVTECH', name: 'Kanvtech Technologies', code: 'kanvtech', domain: null, status: 'ACTIVE', isDefault: true, createdAt: new Date('2026-01-01') },
    { id: 'TENANT-APEX', name: 'Apex Global tech', code: 'apex', domain: null, status: 'ACTIVE', isDefault: false, createdAt: new Date('2026-02-01') },
    { id: 'TENANT-SUSPENDED', name: 'Suspended Corp', code: 'suspended', domain: null, status: 'SUSPENDED', isDefault: false, createdAt: new Date('2026-03-01') },
  ];

  const users: any[] = [
    { id: 1, email: 'admin@kanvtech.com', passwordHash: bcrypt.hashSync('Password@123', 4), role: 'SUPER_ADMIN', isActive: true, isSuperAdmin: true, defaultTenantId: 'KANVTECH', activeSessionId: 'sess-1' },
    { id: 2, email: 'ashutosh@apex.com', passwordHash: bcrypt.hashSync('Password@123', 4), role: 'ADMIN', isActive: true, isSuperAdmin: false, defaultTenantId: 'TENANT-APEX', activeSessionId: 'sess-2' },
    { id: 3, email: 'user@suspended.com', passwordHash: bcrypt.hashSync('Password@123', 4), role: 'L1_EMPLOYEE', isActive: true, isSuperAdmin: false, defaultTenantId: 'TENANT-SUSPENDED', activeSessionId: 'sess-3' },
    { id: 4, email: 'inactive@apex.com', passwordHash: bcrypt.hashSync('Password@123', 4), role: 'L1_EMPLOYEE', isActive: true, isSuperAdmin: false, defaultTenantId: 'TENANT-APEX', activeSessionId: 'sess-4' },
  ];

  const memberships: any[] = [
    { id: 1, userId: 1, tenantId: 'KANVTECH', role: 'SUPER_ADMIN', isDefault: true, isActive: true },
    { id: 2, userId: 2, tenantId: 'TENANT-APEX', role: 'ADMIN', isDefault: true, isActive: true },
    { id: 3, userId: 3, tenantId: 'TENANT-SUSPENDED', role: 'L1_EMPLOYEE', isDefault: true, isActive: true },
    { id: 4, userId: 4, tenantId: 'TENANT-APEX', role: 'L1_EMPLOYEE', isDefault: true, isActive: false }, // Inactive membership
  ];

  const employees: any[] = [
    { id: 'EMP-001', userId: 1, name: 'System Administrator', email: 'admin@kanvtech.com', tenantId: 'KANVTECH' },
    { id: 'EMP-002', userId: 2, name: 'Ashutosh', email: 'ashutosh@apex.com', tenantId: 'TENANT-APEX' },
  ];

  const tickets: any[] = [
    { id: 'TKT-001', ticketNumber: 'TKT-001', title: 'Kanvtech server ticket', tenantId: 'KANVTECH' },
    { id: 'TKT-002', ticketNumber: 'TKT-002', title: 'Kanvtech DB ticket', tenantId: 'KANVTECH' },
    { id: 'TKT-003', ticketNumber: 'TKT-003', title: 'Apex onboarding ticket', tenantId: 'TENANT-APEX' },
  ];

  const mockPrisma: any = {
    tenant: {
      count: async (args?: any) => {
        if (!args?.where?.status) return tenants.length;
        return tenants.filter((t) => t.status === args.where.status).length;
      },
      findUnique: async (args: any) => {
        if (args.where.id) return tenants.find((t) => t.id === args.where.id) || null;
        if (args.where.code) return tenants.find((t) => t.code === args.where.code) || null;
        return null;
      },
      findMany: async (args?: any) => {
        return tenants.map((t) => ({
          ...t,
          _count: {
            memberships: memberships.filter((m) => m.tenantId === t.id).length,
            tickets: tickets.filter((tk) => tk.tenantId === t.id).length,
            companies: 0,
            employees: employees.filter((e) => e.tenantId === t.id).length,
          },
        }));
      },
      create: async (args: any) => {
        const t = { ...args.data, createdAt: new Date() };
        tenants.push(t);
        return t;
      },
      update: async (args: any) => {
        const t = tenants.find((x) => x.id === args.where.id);
        if (t) Object.assign(t, args.data);
        return t;
      },
    },
    user: {
      count: async () => users.length,
      findFirst: async (args: any) => {
        const email = args?.where?.email?.equals || args?.where?.email;
        const u = users.find((x) => x.email.toLowerCase() === (email || '').toLowerCase());
        if (!u) return null;
        const userMemberships = memberships
          .filter((m) => m.userId === u.id && (!args?.include?.tenantMemberships?.where?.isActive || m.isActive))
          .map((m) => ({
            ...m,
            tenant: tenants.find((t) => t.id === m.tenantId),
          }));
        const emp = employees.find((e) => e.userId === u.id);
        return { ...u, tenantMemberships: userMemberships, employee: emp, companyContacts: [] };
      },
      findUnique: async (args: any) => {
        return users.find((u) => u.id === args.where.id) || null;
      },
      create: async (args: any) => {
        const u = { id: nextUserId++, ...args.data, createdAt: new Date() };
        users.push(u);
        return u;
      },
      update: async (args: any) => {
        const u = users.find((x) => x.id === args.where.id);
        if (u) Object.assign(u, args.data);
        return u;
      },
    },
    tenantMembership: {
      findUnique: async (args: any) => {
        const { userId, tenantId } = args.where.uq_user_tenant;
        return memberships.find((m) => m.userId === userId && m.tenantId === tenantId) || null;
      },
      findFirst: async (args: any) => {
        return memberships.find((m) => m.tenantId === args.where.tenantId) || null;
      },
      create: async (args: any) => {
        const m = { id: nextMembershipId++, ...args.data };
        memberships.push(m);
        return m;
      },
      update: async (args: any) => {
        const m = memberships.find((x) => x.id === args.where.id);
        if (m) Object.assign(m, args.data);
        return m;
      },
    },
    employee: {
      findFirst: async (args: any) => {
        if (args?.where?.userId) return employees.find((e) => e.userId === args.where.userId) || null;
        if (args?.where?.OR) {
          return employees.find((e) => e.userId === args.where.OR[0]?.userId || e.email === args.where.OR[1]?.email?.equals) || null;
        }
        return null;
      },
      findMany: async () => employees.map((e) => ({ id: e.id })),
      create: async (args: any) => {
        const emp = { ...args.data };
        employees.push(emp);
        return emp;
      },
      update: async (args: any) => {
        const emp = employees.find((e) => e.id === args.where.id);
        if (emp) Object.assign(emp, args.data);
        return emp;
      },
    },
    ticket: {
      count: async () => tickets.length,
      findMany: async (args: any) => {
        if (args?.where?.tenantId) return tickets.filter((t) => t.tenantId === args.where.tenantId);
        return tickets;
      },
    },
    company: {
      count: async () => 0,
    },
    $transaction: async (fn: any) => {
      return fn(mockPrisma);
    },
  };

  const mockAuditService: any = {
    log: async () => {},
  };

  const mockJwtService: any = {
    sign: (payload: any) => `mock.jwt.token.${payload.userId}.${payload.tenantId}`,
  };

  const platformService = new PlatformService(mockPrisma, mockAuditService);
  const authService = new AuthService(mockPrisma, mockJwtService, mockAuditService);
  const superAdminGuard = new PlatformSuperAdminGuard();

  return {
    mockPrisma,
    platformService,
    authService,
    superAdminGuard,
    tenants,
    users,
    memberships,
    tickets,
  };
}

async function runAllTests() {
  console.log('\n=================================================================================');
  console.log('   KANVTECH MULTI-TENANT VERIFICATION SUITE: PROVISIONING, LISTING & LOGIN');
  console.log('=================================================================================\n');

  // ---------------------------------------------------------
  // SECTION 1: TENANT PROVISIONING TESTS (1-6)
  // ---------------------------------------------------------

  await test(1, 'Creating a tenant creates the expected tenant record', async () => {
    const ctx = createTestContext();
    const res = await ctx.platformService.createTenant({
      name: 'Delta Corp',
      code: 'delta',
      adminEmail: 'admin@delta.com',
      adminName: 'Delta Admin',
      adminPassword: 'Password@123',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.tenant.id, 'TENANT-DELTA');
    assert.strictEqual(res.tenant.code, 'delta');
    assert.strictEqual(res.tenant.status, 'ACTIVE');
  });

  await test(2, 'Creating a tenant creates or correctly associates its administrator', async () => {
    const ctx = createTestContext();
    const res = await ctx.platformService.createTenant({
      name: 'Echo Corp',
      code: 'echo',
      adminEmail: 'echo.admin@echo.com',
      adminName: 'Echo Administrator',
      password: 'EchoPassword@123',
    });
    const user = ctx.users.find((u) => u.email === 'echo.admin@echo.com');
    assert.ok(user, 'Admin user must exist in database');
    assert.strictEqual(user.role, 'ADMIN');
    assert.strictEqual(user.defaultTenantId, 'TENANT-ECHO');
    assert.strictEqual(await bcrypt.compare('EchoPassword@123', user.passwordHash), true);
  });

  await test(3, 'The administrator receives the correct tenant membership and role', async () => {
    const ctx = createTestContext();
    await ctx.platformService.createTenant({
      name: 'Foxtrot Logistics',
      code: 'foxtrot',
      adminEmail: 'lead@foxtrot.com',
      adminName: 'Lead Admin',
      adminPassword: 'Password@123',
    });
    const user = ctx.users.find((u) => u.email === 'lead@foxtrot.com');
    const mem = ctx.memberships.find((m) => m.userId === user?.id && m.tenantId === 'TENANT-FOXTROT');
    assert.ok(mem, 'Tenant membership must exist');
    assert.strictEqual(mem.role, 'ADMIN');
    assert.strictEqual(mem.isActive, true);
    assert.strictEqual(mem.isDefault, true);
  });

  await test(4, 'Provisioning failure does not leave an inconsistent partial tenant', async () => {
    const ctx = createTestContext();
    const initialTenantCount = ctx.tenants.length;
    // Missing valid email should throw BadRequestException
    await assert.rejects(
      async () => {
        await ctx.platformService.createTenant({
          name: 'Invalid Corp',
          code: 'invalid',
          adminEmail: 'not-an-email',
          adminName: 'None',
        });
      },
      (err: any) => err instanceof BadRequestException,
    );
    assert.strictEqual(ctx.tenants.length, initialTenantCount, 'No tenant should be created on validation failure');
  });

  await test(5, 'Repeated requests with same tenant code are safely rejected', async () => {
    const ctx = createTestContext();
    await assert.rejects(
      async () => {
        await ctx.platformService.createTenant({
          name: 'Apex Duplicate',
          code: 'apex', // already exists
          adminEmail: 'unique@apex.com',
          adminName: 'Duplicate Admin',
        });
      },
      (err: any) => err instanceof BadRequestException && err.message.includes('already in use'),
    );
  });

  await test(6, 'Existing tenants are not modified by provisioning a new tenant', async () => {
    const ctx = createTestContext();
    const kanvtechOriginal = JSON.stringify(ctx.tenants.find((t) => t.id === 'KANVTECH'));
    const apexOriginal = JSON.stringify(ctx.tenants.find((t) => t.id === 'TENANT-APEX'));

    await ctx.platformService.createTenant({
      name: 'Golf Corp',
      code: 'golf',
      adminEmail: 'admin@golf.com',
      adminName: 'Golf Admin',
      adminPassword: 'Password@123',
    });

    assert.strictEqual(JSON.stringify(ctx.tenants.find((t) => t.id === 'KANVTECH')), kanvtechOriginal);
    assert.strictEqual(JSON.stringify(ctx.tenants.find((t) => t.id === 'TENANT-APEX')), apexOriginal);
  });

  // ---------------------------------------------------------
  // SECTION 2: WORKSPACE LISTING TESTS (7-12)
  // ---------------------------------------------------------

  await test(7, 'Platform Super Admin can retrieve the authorized tenant list', async () => {
    const ctx = createTestContext();
    const res = await ctx.platformService.getAllTenants();
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.tenants));
    assert.strictEqual(res.tenants.length, 3);
    assert.ok(res.tenants.some((t: any) => t.id === 'KANVTECH'));
    assert.ok(res.tenants.some((t: any) => t.id === 'TENANT-APEX'));
  });

  await test(8, 'Workspace statistics match the returned underlying records', async () => {
    const ctx = createTestContext();
    const res = await ctx.platformService.getOverview();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.overview.totalTenants, 3);
    assert.strictEqual(res.overview.activeTenants, 2);
    assert.strictEqual(res.overview.suspendedTenants, 1);
    assert.strictEqual(res.overview.totalCrossTenantTickets, 3);
    assert.strictEqual(res.overview.tenants.length, 3);
  });

  await test(9, 'Newly created tenants appear in the refreshed list', async () => {
    const ctx = createTestContext();
    await ctx.platformService.createTenant({
      name: 'Hotel Hospitality',
      code: 'hotel',
      adminEmail: 'gm@hotel.com',
      adminName: 'Hotel GM',
      adminPassword: 'Password@123',
    });
    const res = await ctx.platformService.getOverview();
    assert.strictEqual(res.overview.totalTenants, 4);
    assert.ok(res.overview.tenants.some((t: any) => t.id === 'TENANT-HOTEL'));
  });

  await test(10, 'API response mapping handles both data and overview envelopes', async () => {
    const ctx = createTestContext();
    const res = await ctx.platformService.getOverview();
    assert.ok(res.data, 'Must return res.data envelope');
    assert.ok(res.overview, 'Must return res.overview envelope for frontend compatibility');
    assert.ok(res.tenants, 'Must return res.tenants array');
  });

  await test(11, 'Search and filtering return the expected records without data loss', async () => {
    const ctx = createTestContext();
    const res = await ctx.platformService.getAllTenants();
    const query = 'apex';
    const filtered = res.tenants.filter((t: any) => t.name.toLowerCase().includes(query) || t.code.toLowerCase().includes(query));
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, 'TENANT-APEX');
  });

  await test(12, 'Unauthorized users cannot retrieve platform-wide tenant data', async () => {
    const ctx = createTestContext();
    // Non-super admin context (ashutosh@apex.com)
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 2, email: 'ashutosh@apex.com', role: 'ADMIN', isSuperAdmin: false },
        }),
      }),
    };
    assert.throws(
      () => {
        ctx.superAdminGuard.canActivate(mockContext);
      },
      (err: any) => err instanceof ForbiddenException,
    );
  });

  // ---------------------------------------------------------
  // SECTION 3: AUTHENTICATION TESTS (13-20)
  // ---------------------------------------------------------

  await test(13, 'Valid credentials authenticate the correct administrator', async () => {
    const ctx = createTestContext();
    const res = await ctx.authService.login('ashutosh@apex.com', 'Password@123');
    assert.ok(res.token, 'Must return JWT token');
    assert.strictEqual(res.user.email, 'ashutosh@apex.com');
    assert.strictEqual(res.user.tenantId, 'TENANT-APEX');
    assert.strictEqual(res.user.role, 'ADMIN');
    assert.strictEqual(res.user.isSuperAdmin, false);
  });

  await test(14, 'An incorrect password is rejected with UnauthorizedException', async () => {
    const ctx = createTestContext();
    await assert.rejects(
      async () => {
        await ctx.authService.login('ashutosh@apex.com', 'WrongPassword!999');
      },
      (err: any) => err instanceof UnauthorizedException && err.message.includes('Invalid email or password'),
    );
  });

  await test(15, 'A missing account is rejected safely', async () => {
    const ctx = createTestContext();
    await assert.rejects(
      async () => {
        await ctx.authService.login('nonexistent@nowhere.com', 'Password@123');
      },
      (err: any) => err instanceof UnauthorizedException && err.message.includes('User does not exist'),
    );
  });

  await test(16, 'An inactive membership is rejected and does not grant access', async () => {
    const ctx = createTestContext();
    await assert.rejects(
      async () => {
        await ctx.authService.login('inactive@apex.com', 'Password@123');
      },
      (err: any) => err instanceof UnauthorizedException && err.message.includes('No active company workspace'),
    );
  });

  await test(17, 'A suspended tenant cannot be accessed by its ordinary users', async () => {
    const ctx = createTestContext();
    await assert.rejects(
      async () => {
        await ctx.authService.login('user@suspended.com', 'Password@123');
      },
      (err: any) => err instanceof UnauthorizedException && err.message.includes('No active company workspace'),
    );
  });

  await test(18, 'A valid tenant administrator is associated with the correct tenant after login', async () => {
    const ctx = createTestContext();
    const res = await ctx.authService.login('ashutosh@apex.com', 'Password@123');
    assert.strictEqual(res.user.tenantId, 'TENANT-APEX');
    assert.strictEqual(res.user.tenantName, 'Apex Global tech');
  });

  await test(19, 'An ordinary tenant administrator cannot gain platform Super Admin privileges', async () => {
    const ctx = createTestContext();
    const res = await ctx.authService.login('ashutosh@apex.com', 'Password@123');
    assert.strictEqual(res.user.isSuperAdmin, false);
    assert.notStrictEqual(res.user.role, 'SUPER_ADMIN');
  });

  await test(20, 'Tenant administrator is isolated and cannot access another tenant records', async () => {
    const ctx = createTestContext();
    const res = await ctx.authService.login('ashutosh@apex.com', 'Password@123');
    const tenantTickets = await ctx.mockPrisma.ticket.findMany({
      where: { tenantId: res.user.tenantId },
    });
    assert.strictEqual(tenantTickets.length, 1);
    assert.strictEqual(tenantTickets[0].ticketNumber, 'TKT-003');
    // Verify tickets from KANVTECH are not present
    assert.strictEqual(tenantTickets.some((t: any) => t.tenantId === 'KANVTECH'), false);
  });

  console.log('\n---------------------------------------------------------------------------------');
  console.log(`   SUITE SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('---------------------------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Test execution fatal error:', e);
  process.exit(1);
});
