const path = require('path');
const { PrismaClient, UserRole, EmployeeLevel, EmployeeAvailability, EmployeeStatus } = require(path.join(__dirname, '../backend/node_modules/@prisma/client'));
const bcrypt = require(path.join(__dirname, '../backend/node_modules/bcryptjs'));

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/kanvtech_sm_staging?schema=public'
    }
  }
});

async function main() {
  console.log('[Seed] Seeding isolated test fixtures for RBAC & Parity Audit...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Department
  const dept = await prisma.department.upsert({
    where: { id: 'DEP-001' },
    update: { name: 'Technical Support', code: 'TECH_SUP', description: 'Core technical support desk' },
    create: {
      id: 'DEP-001',
      name: 'Technical Support',
      code: 'TECH_SUP',
      description: 'Core technical support desk',
      isActive: true,
    }
  });

  // 2. Product
  const product = await prisma.product.upsert({
    where: { id: 'PRD-001' },
    update: { name: 'KanvSuite Enterprise', code: 'PRD-001', category: 'ENTERPRISE_ERP' },
    create: {
      id: 'PRD-001',
      code: 'PRD-001',
      name: 'KanvSuite Enterprise',
      category: 'ENTERPRISE_ERP',
      description: 'Flagship enterprise ERP solution',
      isActive: true,
    }
  });

  // 3. Product Module
  const pModule = await prisma.productModule.upsert({
    where: { id: 'MOD-001' },
    update: { name: 'Finance & Billing' },
    create: {
      id: 'MOD-001',
      productId: 'PRD-001',
      name: 'Finance & Billing',
      description: 'Core financial ledger module',
      isActive: true,
    }
  });

  // 4. Company (Customer Master)
  const company = await prisma.company.upsert({
    where: { id: 'CMP-0001' },
    update: { companyName: 'Acme Global Industries' },
    create: {
      id: 'CMP-0001',
      companyName: 'Acme Global Industries',
      address: '100 Technology Park, Suite 400',
      primaryEmail: 'info@acme.com',
      contactPerson: 'John Acme',
      contactPhone: '+91 98765 43210',
      isActive: true,
    }
  });

  // 5. Company Branch
  await prisma.companyBranch.upsert({
    where: { id: 'BRN-0001' },
    update: { branchName: 'HQ Tech Campus', city: 'Mumbai', state: 'Maharashtra', contactPerson: 'John Acme', contactPhone: '+91 98765 43210' },
    create: {
      id: 'BRN-0001',
      companyId: 'CMP-0001',
      branchName: 'HQ Tech Campus',
      address: '100 Technology Park, Suite 400',
      city: 'Mumbai',
      state: 'Maharashtra',
      contactPerson: 'John Acme',
      contactPhone: '+91 98765 43210',
      status: 'ACTIVE',
    }
  });

  // 6. Users across 6 Roles
  const rolesData = [
    {
      email: 'admin@kanvtech.com',
      role: UserRole.ADMIN,
      empId: 'EMP-000',
      name: 'System Administrator',
      level: EmployeeLevel.MANAGER,
      designation: 'Chief Administrator'
    },
    {
      email: 'manager@kanvtech.com',
      role: UserRole.MANAGER,
      empId: 'EMP-001',
      name: 'Operations Manager',
      level: EmployeeLevel.MANAGER,
      designation: 'Service Delivery Manager'
    },
    {
      email: 'l1_agent@kanvtech.com',
      role: UserRole.L1_EMPLOYEE,
      empId: 'EMP-002',
      name: 'Level 1 Specialist',
      level: EmployeeLevel.L1,
      designation: 'L1 Support Engineer'
    },
    {
      email: 'l2_agent@kanvtech.com',
      role: UserRole.L2_EMPLOYEE,
      empId: 'EMP-003',
      name: 'Level 2 Specialist',
      level: EmployeeLevel.L2,
      designation: 'L2 Escalation Engineer'
    },
    {
      email: 'l3_agent@kanvtech.com',
      role: UserRole.L3_EMPLOYEE,
      empId: 'EMP-004',
      name: 'Level 3 Specialist',
      level: EmployeeLevel.L3,
      designation: 'L3 Senior Core Architect'
    },
  ];

  for (const item of rolesData) {
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: { passwordHash, role: item.role, isActive: true },
      create: { email: item.email, passwordHash, role: item.role, isActive: true },
    });

    await prisma.employee.upsert({
      where: { id: item.empId },
      update: { userId: user.id, email: item.email, name: item.name, level: item.level, department: 'Technical Support', status: EmployeeStatus.ACTIVE, availability: EmployeeAvailability.AVAILABLE },
      create: {
        id: item.empId,
        userId: user.id,
        name: item.name,
        email: item.email,
        phone: '+91 98000 000' + item.empId.slice(-2),
        level: item.level,
        department: 'Technical Support',
        designation: item.designation,
        availability: EmployeeAvailability.AVAILABLE,
        status: EmployeeStatus.ACTIVE,
      }
    });
  }

  // 7. Customer User & Company Contact
  const custUser = await prisma.user.upsert({
    where: { email: 'customer@acme.com' },
    update: { passwordHash, role: UserRole.CUSTOMER, isActive: true },
    create: { email: 'customer@acme.com', passwordHash, role: UserRole.CUSTOMER, isActive: true }
  });

  const existingContact = await prisma.companyContact.findFirst({
    where: { email: 'customer@acme.com' }
  });

  if (existingContact) {
    await prisma.companyContact.update({
      where: { id: existingContact.id },
      data: { userId: custUser.id, companyId: 'CMP-0001', isPrimary: true, isActive: true }
    });
  } else {
    await prisma.companyContact.create({
      data: {
        companyId: 'CMP-0001',
        userId: custUser.id,
        name: 'John Acme',
        email: 'customer@acme.com',
        phone: '+91 98765 43210',
        designation: 'IT Director',
        isPrimary: true,
        isActive: true,
      }
    });
  }

  // 8. Company Product Entitlement
  await prisma.companyProduct.upsert({
    where: { uq_company_product: { companyId: 'CMP-0001', productId: 'PRD-001' } },
    update: { isActive: true },
    create: {
      companyId: 'CMP-0001',
      productId: 'PRD-001',
      purchaseType: 'COMPLETE',
      isActive: true,
    }
  });

  console.log('[Seed] Isolated RBAC test accounts seeded successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
