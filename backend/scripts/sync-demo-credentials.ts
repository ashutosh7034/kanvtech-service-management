import { PrismaClient, UserRole, EmployeeLevel, EmployeeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Sync] Provisioning and synchronizing demo evaluation accounts...');

  const acme = await prisma.company.upsert({
    where: { id: 'CMP-0001' },
    update: {
      companyName: 'Acme Corp',
      primaryEmail: 'contact@acme.com',
      contactPerson: 'Rajesh Sharma',
      contactPhone: '+91 98200 12345',
      address: '101 Acme Towers, Tech Park, Mumbai',
      isActive: true,
    },
    create: {
      id: 'CMP-0001',
      companyName: 'Acme Corp',
      primaryEmail: 'contact@acme.com',
      contactPerson: 'Rajesh Sharma',
      contactPhone: '+91 98200 12345',
      address: '101 Acme Towers, Tech Park, Mumbai',
      isActive: true,
    },
  });

  const demoAccounts = [
    {
      email: 'contact@acme.com',
      password: 'cust123',
      role: UserRole.CUSTOMER,
      name: 'Acme Contact',
      phone: '+91 98200 12345',
    },
    {
      email: 'rajesh@acme.com',
      password: 'cust123',
      role: UserRole.CUSTOMER,
      name: 'Rajesh Sharma',
      phone: '+91 98200 12345',
    },
    {
      email: 'admin@kanvtech.com',
      password: 'admin123',
      role: UserRole.ADMIN,
      name: 'System Administrator',
      phone: '+91 98000 00000',
      employeeId: 'EMP-000',
      level: EmployeeLevel.MANAGER,
      designation: 'Chief Administrator',
      department: 'Executive Management',
    },
    {
      email: 'manager@kanvtech.com',
      password: 'manager123',
      role: UserRole.MANAGER,
      name: 'Operations Manager',
      phone: '+91 98000 00001',
      employeeId: 'EMP-001',
      level: EmployeeLevel.MANAGER,
      designation: 'Service Delivery Manager',
      department: 'Operations',
    },
    {
      email: 'amit.l1@kanvtech.com',
      password: 'l1pass123',
      role: UserRole.L1_EMPLOYEE,
      name: 'Amit Patel (L1)',
      phone: '+91 98000 00002',
      employeeId: 'EMP-010',
      level: EmployeeLevel.L1,
      designation: 'L1 Support Specialist',
      department: 'Technical Support',
    },
    {
      email: 'l1.amit@kanvtech.com',
      password: 'l1pass123',
      role: UserRole.L1_EMPLOYEE,
      name: 'Amit Patel',
      phone: '+91 98000 00002',
      employeeId: 'EMP-011',
      level: EmployeeLevel.L1,
      designation: 'L1 Support Specialist',
      department: 'Technical Support',
    },
    {
      email: 'rahul.l2@kanvtech.com',
      password: 'l2pass123',
      role: UserRole.L2_EMPLOYEE,
      name: 'Rahul Verma (L2)',
      phone: '+91 98000 00003',
      employeeId: 'EMP-020',
      level: EmployeeLevel.L2,
      designation: 'L2 Senior Specialist',
      department: 'Technical Support',
    },
    {
      email: 'l2.vikram@kanvtech.com',
      password: 'l2pass123',
      role: UserRole.L2_EMPLOYEE,
      name: 'Vikram Singh',
      phone: '+91 98000 00003',
      employeeId: 'EMP-021',
      level: EmployeeLevel.L2,
      designation: 'L2 Senior Specialist',
      department: 'Technical Support',
    },
    {
      email: 'priya.l3@kanvtech.com',
      password: 'l3pass123',
      role: UserRole.L3_EMPLOYEE,
      name: 'Priya Sharma (L3)',
      phone: '+91 98000 00004',
      employeeId: 'EMP-030',
      level: EmployeeLevel.L3,
      designation: 'L3 Principal Architect',
      department: 'Technical Support',
    },
    {
      email: 'l3.priya@kanvtech.com',
      password: 'l3pass123',
      role: UserRole.L3_EMPLOYEE,
      name: 'Priya Sharma',
      phone: '+91 98000 00004',
      employeeId: 'EMP-005',
      level: EmployeeLevel.L3,
      designation: 'L3 Principal Architect',
      department: 'Technical Support',
    },
  ];

  for (const acc of demoAccounts) {
    const passwordHash = await bcrypt.hash(acc.password, 10);
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        role: acc.role,
        isActive: true,
        passwordHash,
      },
      create: {
        email: acc.email,
        passwordHash,
        role: acc.role,
        isActive: true,
      },
    });

    console.log(`[User] Synced ${acc.email} (${acc.role}) with password: ${acc.password}`);

    // If customer, link to Acme Corp
    if (acc.role === UserRole.CUSTOMER) {
      const contact = await prisma.companyContact.findFirst({
        where: { companyId: acme.id, email: acc.email },
      });
      if (contact) {
        await prisma.companyContact.update({
          where: { id: contact.id },
          data: {
            userId: user.id,
            name: acc.name,
            phone: acc.phone,
            isActive: true,
            isPrimary: acc.email === 'contact@acme.com',
          },
        });
      } else {
        await prisma.companyContact.create({
          data: {
            companyId: acme.id,
            userId: user.id,
            email: acc.email,
            name: acc.name,
            phone: acc.phone,
            isActive: true,
            isPrimary: acc.email === 'contact@acme.com',
          },
        });
      }
      console.log(`[Customer Contact] Linked ${acc.email} to company ${acme.companyName} (${acme.id})`);
    }

    // If employee, link or create Employee profile
    if (acc.employeeId) {
      await prisma.employee.upsert({
        where: { id: acc.employeeId },
        update: {
          userId: user.id,
          name: acc.name,
          email: acc.email,
          phone: acc.phone,
          level: acc.level,
          department: acc.department,
          designation: acc.designation,
          availability: 'AVAILABLE',
          status: EmployeeStatus.ACTIVE,
        },
        create: {
          id: acc.employeeId,
          userId: user.id,
          name: acc.name,
          email: acc.email,
          phone: acc.phone,
          level: acc.level,
          department: acc.department,
          designation: acc.designation,
          availability: 'AVAILABLE',
          status: EmployeeStatus.ACTIVE,
        },
      });
      console.log(`[Employee Profile] Synced ${acc.employeeId} for ${acc.email}`);
    }
  }

  console.log('[Sync] All evaluation credentials synced successfully!');
}

main()
  .catch((e) => {
    console.error('Sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
