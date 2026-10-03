import { PrismaClient, UserRole, EmployeeLevel, EmployeeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedTestUsers() {
  console.log('[Test Seed] Seeding local test users...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const testUsers = [
    { email: 'manager@kanvtech.com', role: UserRole.MANAGER },
    { email: 'l1.amit@kanvtech.com', role: UserRole.L1_EMPLOYEE },
    { email: 'l2.vikram@kanvtech.com', role: UserRole.L2_EMPLOYEE },
    { email: 'l3.priya@kanvtech.com', role: UserRole.L3_EMPLOYEE },
    { email: 'rajesh@acme.com', role: UserRole.CUSTOMER }
  ];

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, isActive: true, passwordHash },
      create: { email: user.email, role: user.role, isActive: true, passwordHash }
    });
  }

  await prisma.company.upsert({
    where: { id: 'CMP-0001' },
    update: { isActive: true },
    create: {
      id: 'CMP-0001',
      companyName: 'Acme Corp',
      address: '123 Acme St',
      primaryEmail: 'rajesh@acme.com',
      contactPerson: 'Rajesh',
      contactPhone: '1234567890',
      isActive: true,
    }
  });

  const u = await prisma.user.findUnique({where: {email: 'rajesh@acme.com'}});
  if (u) {
    // Delete if exists by companyId and email since CompanyContactWhereUnique might be ID
    await prisma.companyContact.deleteMany({where: {email: 'rajesh@acme.com'}});
    await prisma.companyContact.create({
      data: {
        name: 'Rajesh',
        email: 'rajesh@acme.com',
        phone: '1234567890',
        designation: 'Manager',
        isPrimary: true,
        isActive: true,
        companyId: 'CMP-0001',
        userId: u.id
      }
    });
  }
  
  await prisma.company.upsert({
    where: { id: 'CMP-0002' },
    update: { isActive: true },
    create: {
      id: 'CMP-0002',
      companyName: 'Zenith Corp',
      address: '456 Zenith St',
      primaryEmail: 'anjali@zenith.com',
      contactPerson: 'Anjali',
      contactPhone: '1234567890',
      isActive: true,
    }
  });

  const u2 = await prisma.user.findUnique({where: {email: 'anjali@zenith.com'}});
  if (u2) {
    await prisma.companyContact.deleteMany({where: {email: 'anjali@zenith.com'}});
    await prisma.companyContact.create({
      data: {
        name: 'Anjali',
        email: 'anjali@zenith.com',
        phone: '1234567890',
        designation: 'Admin',
        isPrimary: true,
        isActive: true,
        companyId: 'CMP-0002',
        userId: u2.id
      }
    });
  }

  // Need employees for tests
  const employees = [
    { id: 'EMP-001', name: 'Manager', email: 'manager@kanvtech.com', level: EmployeeLevel.MANAGER },
    { id: 'EMP-002', name: 'Amit', email: 'l1.amit@kanvtech.com', level: EmployeeLevel.L1 },
    { id: 'EMP-004', name: 'Vikram', email: 'l2.vikram@kanvtech.com', level: EmployeeLevel.L2 },
    { id: 'EMP-005', name: 'Priya', email: 'l3.priya@kanvtech.com', level: EmployeeLevel.L3 }
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: { id: emp.id, level: emp.level, status: EmployeeStatus.ACTIVE },
      create: { 
        id: emp.id, 
        name: emp.name, 
        email: emp.email, 
        level: emp.level, 
        designation: emp.level, 
        department: 'Support',
        phone: '1234567890',
        status: EmployeeStatus.ACTIVE,
        user: { connect: { email: emp.email } }
      }
    });
  }

  // Need a product for tests
  await prisma.product.upsert({
    where: { id: 'PROD-0001' },
    update: { isActive: true },
    create: {
      id: 'PROD-0001',
      name: 'Test Product',
      code: 'PROD-0001',
      category: 'Software',
      isActive: true
    }
  });

  console.log('[Test Seed] Test users and basic fixtures seeded successfully.');
}

seedTestUsers()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
