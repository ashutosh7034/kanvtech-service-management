const { PrismaClient } = require('@prisma/client');

async function run() {
  const prismaStaging = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:root@localhost:5432/kanvtech_sm_staging?schema=public' } }
  });
  const res = await prismaStaging.$queryRawUnsafe("SELECT id, email, role FROM users WHERE email ILIKE '%ashutosh%'");
  console.log('Ashutosh in staging:', res);
  await prismaStaging.$disconnect();
}

run().catch(console.error);

