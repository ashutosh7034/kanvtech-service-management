const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/kanvtech_sm_staging?schema=public'
    }
  }
});

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
    }
  });
  console.log('Total users:', users.length);
  console.log(JSON.stringify(users, null, 2));

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      level: true,
      department: true,
      status: true,
      availability: true,
    }
  });
  console.log('Total employees:', employees.length);
  console.log(JSON.stringify(employees, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
