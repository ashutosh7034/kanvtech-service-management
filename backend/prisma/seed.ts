import { PrismaClient, UserRole, EmployeeLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('[Seed] Seeding PostgreSQL/Prisma database with verified baseline masters...');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Roles
  const roles = [
    { name: 'ADMIN', description: 'Full Platform Administrator', permissions: ['all'] },
    { name: 'MANAGER', description: 'Service Operations Manager (Approvals, Reassignments, Reports)', permissions: ['tickets:read', 'tickets:approve', 'tickets:reopen', 'reports:read', 'companies:manage', 'employees:manage'] },
    { name: 'L1_EMPLOYEE', description: 'Level 1 Support Specialist (Initial Resolution & Triage)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_l2', 'tickets:resolve'] },
    { name: 'L2_EMPLOYEE', description: 'Level 2 Technical Specialist (In-depth Troubleshooting)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_l3', 'tickets:resolve'] },
    { name: 'L3_EMPLOYEE', description: 'Level 3 Senior Engineer (Core Architecture & Vendor Escalation)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_parent', 'tickets:resolve'] },
    { name: 'CUSTOMER', description: 'Client Portal User (Ticket Creation & Feedback)', permissions: ['tickets:create', 'tickets:read_own', 'feedback:submit'] },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, permissionsJson: JSON.stringify(r.permissions) },
      create: { name: r.name, description: r.description, permissionsJson: JSON.stringify(r.permissions) },
    });
  }

  // 2. SLA Configurations
  const slas = [
    { priority: 'HIGH' as const, responseTimeHours: 0.5, resolutionTimeHours: 4.0, warningThresholdPercent: 75 },
    { priority: 'MEDIUM' as const, responseTimeHours: 2.0, resolutionTimeHours: 12.0, warningThresholdPercent: 75 },
    { priority: 'LOW' as const, responseTimeHours: 4.0, resolutionTimeHours: 24.0, warningThresholdPercent: 75 },
  ];

  for (const s of slas) {
    await prisma.slaConfiguration.upsert({
      where: { priority: s.priority },
      update: { responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours, warningThresholdPercent: s.warningThresholdPercent, isActive: true },
      create: { priority: s.priority, responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours, warningThresholdPercent: s.warningThresholdPercent, isActive: true },
    });
  }

  // 3. System Settings
  const settings = [
    { key: 'AUTO_ASSIGNMENT_ENABLED', value: 'true', description: 'Automatically assign new tickets to available L1 employees based on workload' },
    { key: 'AUTO_CLOSURE_HOURS', value: '48', description: 'Automatic ticket closure hours after manager approval if customer does not respond' },
    { key: 'TWO_TICKET_RULE_ENABLED', value: 'true', description: 'Enforce max 2 open tickets per customer contact' },
    { key: 'MAX_ATTACHMENT_SIZE_MB', value: '10', description: 'Maximum allowed attachment file size in MB' },
  ];

  for (const st of settings) {
    await prisma.systemSetting.upsert({
      where: { settingKey: st.key },
      update: { settingValue: st.value, description: st.description },
      create: { settingKey: st.key, settingValue: st.value, description: st.description },
    });
  }

  // Helper to ensure user
  async function ensureUser(email: string, role: UserRole): Promise<number> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing.id;
    const user = await prisma.user.create({
      data: { email, passwordHash, role, isActive: true },
    });
    return user.id;
  }

  // 4. Default System Users
  const adminUserId = await ensureUser('admin@kanvtech.com', UserRole.ADMIN);
  const managerUserId = await ensureUser('manager@kanvtech.com', UserRole.MANAGER);
  const l1UserId = await ensureUser('l1.amit@kanvtech.com', UserRole.L1_EMPLOYEE);
  const l1AltUserId = await ensureUser('l1.neha@kanvtech.com', UserRole.L1_EMPLOYEE);
  const l2UserId = await ensureUser('l2.vikram@kanvtech.com', UserRole.L2_EMPLOYEE);
  const l3UserId = await ensureUser('l3.priya@kanvtech.com', UserRole.L3_EMPLOYEE);
  const customerUserId = await ensureUser('rajesh@acme.com', UserRole.CUSTOMER);
  const customerZenithUserId = await ensureUser('anjali@zenith.com', UserRole.CUSTOMER);

  // 5. Employees
  const employees = [
    { id: 'EMP-001', userId: managerUserId, name: 'Rahul Verma', email: 'manager@kanvtech.com', phone: '+91 98765 43210', dept: 'Service Delivery', desig: 'Service Operations Manager', level: EmployeeLevel.L3, managerId: null },
    { id: 'EMP-002', userId: l1UserId, name: 'Amit Sharma', email: 'l1.amit@kanvtech.com', phone: '+91 98765 43211', dept: 'Service Desk', desig: 'L1 Support Engineer', level: EmployeeLevel.L1, managerId: 'EMP-001' },
    { id: 'EMP-003', userId: l1AltUserId, name: 'Neha Gupta', email: 'l1.neha@kanvtech.com', phone: '+91 98765 43212', dept: 'Service Desk', desig: 'L1 Support Engineer', level: EmployeeLevel.L1, managerId: 'EMP-001' },
    { id: 'EMP-004', userId: l2UserId, name: 'Vikram Malhotra', email: 'l2.vikram@kanvtech.com', phone: '+91 98765 43213', dept: 'Technical Services', desig: 'L2 Senior Specialist', level: EmployeeLevel.L2, managerId: 'EMP-001' },
    { id: 'EMP-005', userId: l3UserId, name: 'Priya Nair', email: 'l3.priya@kanvtech.com', phone: '+91 98765 43214', dept: 'Core Engineering', desig: 'L3 Principal Architect', level: EmployeeLevel.L3, managerId: 'EMP-001' },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { id: emp.id },
      update: { name: emp.name, email: emp.email, phone: emp.phone, department: emp.dept, designation: emp.desig, level: emp.level, managerId: emp.managerId },
      create: { id: emp.id, userId: emp.userId, name: emp.name, email: emp.email, phone: emp.phone, department: emp.dept, designation: emp.desig, level: emp.level, managerId: emp.managerId },
    });
  }

  // 6. Companies & Contacts
  await prisma.company.upsert({
    where: { id: 'CMP-0001' },
    update: {},
    create: {
      id: 'CMP-0001',
      companyName: 'Acme Technologies Pvt Ltd',
      address: 'Tower B, 4th Floor, Tech Park, Bangalore 560100',
      gstn: '29AABCA1234F1Z5',
      primaryEmail: 'contact@acme.com',
      alternateEmails: 'billing@acme.com, alerts@acme.com',
      contactPerson: 'Rajesh Mehta',
      contactPhone: '+91 98200 11223',
      contactAddress: 'Bangalore Office',
      contactStatus: 'ACTIVE',
      alternateContact: 'Sunita Rao',
      alternateContactPhone: '+91 98200 99887',
      alternateContactEmail: 'sunita@acme.com',
      isActive: true,
      contacts: {
        create: [
          { name: 'Rajesh Mehta', email: 'rajesh@acme.com', phone: '+91 98200 11223', designation: 'IT Director', isPrimary: true, isActive: true, userId: customerUserId },
          { name: 'Sunita Rao', email: 'sunita@acme.com', phone: '+91 98200 99887', designation: 'System Administrator', isPrimary: false, isActive: true },
        ],
      },
    },
  });

  await prisma.company.upsert({
    where: { id: 'CMP-0002' },
    update: {},
    create: {
      id: 'CMP-0002',
      companyName: 'Zenith Infotech Global',
      address: 'DLF Cyber City, Phase 3, Gurugram 122002',
      gstn: '06XYZPA5678B2Z9',
      primaryEmail: 'support@zenith.com',
      contactPerson: 'Anjali Patel',
      contactPhone: '+91 97110 55443',
      contactStatus: 'ACTIVE',
      isActive: true,
      contacts: {
        create: [
          { name: 'Anjali Patel', email: 'anjali@zenith.com', phone: '+91 97110 55443', designation: 'VP Infrastructure', isPrimary: true, isActive: true, userId: customerZenithUserId },
        ],
      },
    },
  });

  // Initialize sequences if empty
  await prisma.sequenceTracker.upsert({
    where: { name: 'TICKET_SEQ' },
    update: {},
    create: { name: 'TICKET_SEQ', currentValue: 0 },
  });

  await prisma.sequenceTracker.upsert({
    where: { name: 'COMPANY_SEQ' },
    update: {},
    create: { name: 'COMPANY_SEQ', currentValue: 2 },
  });

  console.log('[Seed] Database successfully seeded with standard enterprise users, roles, SLAs, and masters!');
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('[Seed Error]:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
