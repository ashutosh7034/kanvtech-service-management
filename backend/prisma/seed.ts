import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('[Seed] Initializing platform system baseline (Roles, SLAs, Settings, and System Administrator)...');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Roles & Permissions Master
  const roles = [
    { name: 'ADMIN', description: 'Full Platform Administrator', permissions: ['all'] },
    { name: 'MANAGER', description: 'Service Operations Manager (Approvals, Reassignments, Reports)', permissions: ['tickets:read', 'tickets:approve', 'tickets:reopen', 'reports:read', 'companies:manage', 'employees:manage', 'departments:manage'] },
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

  // 4. Default System Administrator User (Ensures platform remains login-capable)
  const adminEmail = 'admin@kanvtech.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: UserRole.ADMIN, isActive: true, passwordHash },
    });
  } else {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
  }

  // 5. Initialize Monotonic Sequence Trackers
  const trackers = [
    { name: 'TICKET_SEQ', currentValue: 0 },
    { name: 'COMPANY_SEQ', currentValue: 0 },
    { name: 'BRANCH_SEQ', currentValue: 0 },
    { name: 'DEPARTMENT_SEQ', currentValue: 0 },
    { name: 'EMPLOYEE_SEQ', currentValue: 0 },
    { name: 'PRODUCT_SEQ', currentValue: 0 },
    { name: 'SUBSCRIPTION_SEQ', currentValue: 0 },
    { name: 'IMPLEMENTATION_SEQ', currentValue: 0 },
    { name: 'TASK_SEQ', currentValue: 0 },
  ];

  for (const tr of trackers) {
    await prisma.sequenceTracker.upsert({
      where: { name: tr.name },
      update: {},
      create: tr,
    });
  }

  console.log('[Seed] System baseline initialized successfully. ZERO demo products, departments, employees, or customers exist.');
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
