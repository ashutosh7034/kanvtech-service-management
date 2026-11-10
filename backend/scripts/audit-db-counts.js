const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [users, employees, companies, tickets, tenants, permissions, employeePermissions, auditLogs, departments, products, subscriptions, implementations] = await Promise.all([
    prisma.user.count(),
    prisma.employee.count(),
    prisma.company.count(),
    prisma.ticket.count(),
    prisma.tenant.count(),
    prisma.permission.count(),
    prisma.employeePermission.count(),
    prisma.auditLog.count(),
    prisma.department.count(),
    prisma.product.count(),
    prisma.subscription.count(),
    prisma.implementation.count(),
  ]);

  console.log(JSON.stringify({
    users,
    employees,
    companies,
    tickets,
    tenants,
    permissions,
    employeePermissions,
    auditLogs,
    departments,
    products,
    subscriptions,
    implementations
  }, null, 2));

  // Check the DATABASE_URL
  console.log('DATABASE_URL starts with:', (process.env.DATABASE_URL || '').split('@')[1] || 'local');
}

main().catch(console.error).finally(() => prisma.$disconnect());

