import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedProductionMasters() {
  console.log('[ProdSeed] Seeding production master roles, SLA configs, and settings...');

  // 1. Roles Master (Immutable System Roles)
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

  // 2. Production Default SLA Configurations
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

  // 3. System Configuration Settings
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

  // 4. Initialize Monotonic Sequence Trackers
  await prisma.sequenceTracker.upsert({
    where: { name: 'TICKET_SEQ' },
    update: {},
    create: { name: 'TICKET_SEQ', currentValue: 0 },
  });

  await prisma.sequenceTracker.upsert({
    where: { name: 'COMPANY_SEQ' },
    update: {},
    create: { name: 'COMPANY_SEQ', currentValue: 0 },
  });

  console.log('[ProdSeed] Master data successfully initialized (ZERO test accounts or mock companies created).');
}

if (require.main === module) {
  seedProductionMasters()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('Production seeding error:', err);
      prisma.$disconnect();
      process.exit(1);
    });
}
