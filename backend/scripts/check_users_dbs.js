const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const dbs = await prisma.$queryRawUnsafe('SELECT datname FROM pg_database WHERE datistemplate = false;');
  console.log('Databases on PostgreSQL server:', dbs);

  const usersDev = await prisma.user.findMany({
    select: { id: true, email: true, role: true, isSuperAdmin: true, defaultTenantId: true }
  });
  console.log('Total users in kanvtech_sm_dev:', usersDev.length);
  const foundAshutosh = usersDev.find(u => u.email.toLowerCase().includes('ashutosh'));
  console.log('Found ashutosh in dev:', foundAshutosh);
  const foundAdmin = usersDev.find(u => u.email.toLowerCase().includes('admin@kanvtech.com'));
  console.log('Found admin in dev:', foundAdmin);

  // Check staging db if exists
  const hasStaging = dbs.some(d => d.datname === 'kanvtech_sm_staging');
  if (hasStaging) {
    const prismaStaging = new PrismaClient({
      datasources: { db: { url: 'postgresql://postgres:root@localhost:5432/kanvtech_sm_staging?schema=public' } }
    });
    const usersStaging = await prismaStaging.user.findMany({
      select: { id: true, email: true, role: true, isSuperAdmin: true, defaultTenantId: true }
    });
    console.log('Total users in kanvtech_sm_staging:', usersStaging.length);
    console.log('Found ashutosh in staging:', usersStaging.find(u => u.email.toLowerCase().includes('ashutosh')));
    console.log('Found admin in staging:', usersStaging.find(u => u.email.toLowerCase().includes('admin@kanvtech.com')));
    await prismaStaging.$disconnect();
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
