const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = {
    Company: await prisma.company.count(),
    Product: await prisma.product.count(),
    Department: await prisma.department.count(),
    Employee: await prisma.employee.count(),
    Ticket: await prisma.ticket.count(),
    Implementation: await prisma.implementation.count(),
    Subscription: await prisma.subscription.count(),
    NonAdminUsers: await prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
    AdminUsers: await prisma.user.count({ where: { role: 'ADMIN' } }),
    Roles: await prisma.role.count(),
    SystemSettings: await prisma.systemSetting.count()
  };
  
  console.log("Database Entity Counts Post-Cleanup:");
  console.table(counts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
