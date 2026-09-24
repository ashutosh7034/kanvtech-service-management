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

  // 7. Product Master
  const products = [
    { id: 'PROD-0001', code: 'KT-ERP-ENTERPRISE', name: 'KANVTECH Enterprise ERP', category: 'Enterprise Software', description: 'Comprehensive enterprise resource planning suite for business automation and logistics.', isActive: true },
    { id: 'PROD-0002', code: 'KT-CLOUD-POS', name: 'KANVTECH Retail POS Cloud', category: 'Cloud POS', description: 'Cloud-based point of sale and inventory management for multi-store retail.', isActive: true },
    { id: 'PROD-0003', code: 'KT-PAY-GATEWAY', name: 'KANVTECH Unified PayFlow Gateway', category: 'FinTech', description: 'Secure real-time payment gateway and reconciliation module.', isActive: true },
    { id: 'PROD-0004', code: 'KT-SEC-SHIELD', name: 'KANVTECH CyberShield Endpoint', category: 'Cybersecurity', description: 'Zero-trust endpoint security, encryption, and proactive threat prevention.', isActive: true },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, category: p.category, description: p.description, isActive: p.isActive },
      create: p,
    });
  }

  // 8. Annual Maintenance & Subscriptions
  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const expiringSoonDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days remaining
  const expiredDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // expired 10 days ago

  const subscriptions = [
    {
      id: 'SUB-0001',
      companyId: 'CMP-0001',
      productId: 'PROD-0001',
      planName: 'Enterprise Platinum Annual (24x7 SLA)',
      startDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      expiryDate: oneYearLater,
      status: 'ACTIVE' as const,
      ownerEmployeeId: 'EMP-001',
      notes: 'Full production SLA coverage with dedicated account management.',
    },
    {
      id: 'SUB-0002',
      companyId: 'CMP-0002',
      productId: 'PROD-0002',
      planName: 'Retail Cloud Gold Tier',
      startDate: new Date(now.getTime() - 350 * 24 * 60 * 60 * 1000),
      expiryDate: expiringSoonDate,
      status: 'EXPIRING_SOON' as const,
      ownerEmployeeId: 'EMP-001',
      notes: 'Renewal discussions initiated with VP Infrastructure.',
    },
    {
      id: 'SUB-0003',
      companyId: 'CMP-0001',
      productId: 'PROD-0003',
      planName: 'PayFlow Standard Maintenance',
      startDate: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000),
      expiryDate: expiredDate,
      status: 'EXPIRED' as const,
      ownerEmployeeId: 'EMP-001',
      notes: 'Grace period warning dispatched. Pending PO renewal approval.',
    },
  ];

  for (const sub of subscriptions) {
    await prisma.subscription.upsert({
      where: { id: sub.id },
      update: { planName: sub.planName, expiryDate: sub.expiryDate, status: sub.status, notes: sub.notes },
      create: sub,
    });
  }

  // 9. New Implementations
  const implementations = [
    {
      id: 'IMP-0001',
      companyId: 'CMP-0002',
      productId: 'PROD-0001',
      subscriptionId: 'SUB-0002',
      ownerEmployeeId: 'EMP-001',
      teamMembersJson: JSON.stringify(['Amit Sharma', 'Vikram Malhotra', 'Priya Nair']),
      startDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      targetGoLiveDate: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
      status: 'CONFIGURATION' as const,
      progressPercentage: 65,
      pendingActivities: 'Data migration validation and user acceptance sign-off.',
      notes: 'Initial ERP customization underway for 5 warehouses.',
    },
    {
      id: 'IMP-0002',
      companyId: 'CMP-0001',
      productId: 'PROD-0004',
      subscriptionId: 'SUB-0001',
      ownerEmployeeId: 'EMP-005',
      teamMembersJson: JSON.stringify(['Priya Nair', 'Vikram Malhotra']),
      startDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      targetGoLiveDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
      status: 'PLANNING' as const,
      progressPercentage: 25,
      pendingActivities: 'Firewall architecture review and agent rollout schedule.',
      notes: 'CyberShield deployment across 450 corporate endpoints.',
    },
  ];

  for (const imp of implementations) {
    await prisma.implementation.upsert({
      where: { id: imp.id },
      update: { status: imp.status, progressPercentage: imp.progressPercentage, pendingActivities: imp.pendingActivities },
      create: imp,
    });
  }

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

  await prisma.sequenceTracker.upsert({
    where: { name: 'PRODUCT_SEQ' },
    update: {},
    create: { name: 'PRODUCT_SEQ', currentValue: 4 },
  });

  await prisma.sequenceTracker.upsert({
    where: { name: 'SUBSCRIPTION_SEQ' },
    update: {},
    create: { name: 'SUBSCRIPTION_SEQ', currentValue: 3 },
  });

  await prisma.sequenceTracker.upsert({
    where: { name: 'IMPLEMENTATION_SEQ' },
    update: {},
    create: { name: 'IMPLEMENTATION_SEQ', currentValue: 2 },
  });

  console.log('[Seed] Database successfully seeded with standard enterprise users, roles, SLAs, products, subscriptions, implementations, and masters!');
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
