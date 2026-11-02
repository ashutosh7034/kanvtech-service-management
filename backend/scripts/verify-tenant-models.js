const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      memberships: {
        include: {
          user: { select: { email: true, role: true } }
        }
      }
    }
  });

  console.log('Tenants in dev database:', tenants.length);
  for (const t of tenants) {
    console.log(`Tenant: ${t.id} - ${t.name} (status: ${t.status}, members: ${t.memberships.length})`);
  }

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@kanvtech.com' },
    include: {
      tenantMemberships: {
        include: { tenant: true }
      }
    }
  });

  console.log('Admin user:', {
    id: admin.id,
    email: admin.email,
    isSuperAdmin: admin.isSuperAdmin,
    defaultTenantId: admin.defaultTenantId,
    memberships: admin.tenantMemberships.map(m => ({ tenant: m.tenant.name, role: m.role }))
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
