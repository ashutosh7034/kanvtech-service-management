const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:password@localhost:5433/kanvtech_sm_staging?schema=public'
    }
  }
});

async function main() {
  const depts = await prisma.department.findMany();
  console.log('Departments:', depts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
