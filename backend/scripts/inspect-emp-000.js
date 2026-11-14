const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- SEARCHING FOR EMP-000 ---');
  const emp = await prisma.employee.findFirst({
    where: { id: 'EMP-000' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          customUserId: true,
          isActive: true,
          isSuperAdmin: true,
          defaultTenantId: true,
        }
      },
      tenant: true,
    }
  });

  console.log('Employee record with ID EMP-000:');
  console.log(emp);

  // Also search if any user has customUserId = 'EMP-000' or employeeId = 'EMP-000'
  const userByCustomId = await prisma.user.findFirst({
    where: {
      OR: [
        { customUserId: { equals: 'EMP-000', mode: 'insensitive' } },
        { email: { contains: 'emp-000', mode: 'insensitive' } },
      ]
    },
    include: { employee: true }
  });
  console.log('\nUser matching customUserId / email EMP-000:');
  console.log(userByCustomId);

  // Search for all employees with their customUserId and linked user
  const allEmps = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      customUserId: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          customUserId: true,
          isActive: true
        }
      }
    }
  });
  console.log('\nAll Employees in DB:');
  console.log(allEmps);
}

main().catch(console.error).finally(() => prisma.$disconnect());

