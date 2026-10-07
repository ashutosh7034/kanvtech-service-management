const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function cleanAndResetProductionDatabase() {
  console.log('================================================================');
  console.log('STARTING CLEAN PRODUCTION DATABASE RESET AS REQUESTED');
  console.log('================================================================\n');

  // 1. Truncate all business, ticket, customer, and operational tables with CASCADE
  console.log('[1/4] Truncating all business, ticket, employee, customer, and communication tables...');
  
  const tables = [
    'ticket_attachments',
    'ticket_comments',
    'ticket_resolution_sessions',
    'ticket_escalations',
    'ticket_history',
    'ticket_assignments',
    'ticket_feedback',
    'tickets',
    'employee_tasks',
    'chat_read_receipts',
    'chat_messages',
    'chat_participants',
    'chat_conversations',
    'notifications',
    'implementation_milestones',
    'implementation_tasks',
    'implementations',
    'company_subscriptions',
    'branch_product_modules',
    'branch_products',
    'company_branches',
    'company_product_modules',
    'company_products',
    'company_contacts',
    'customer_credentials',
    'email_verification_tokens',
    'prospects',
    'companies',
    'department_products',
    'employees',
    'departments',
    'product_submodules',
    'product_modules',
    'products',
    'audit_logs',
    'sequence_trackers',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
      console.log(`  ✓ Truncated table: ${table}`);
    } catch (err) {
      console.warn(`  - Notice on table ${table}: ${err.message}`);
    }
  }

  // 2. Remove all non-admin users
  console.log('\n[2/4] Removing all non-admin user accounts...');
  try {
    await prisma.user.deleteMany({
      where: {
        role: { not: 'ADMIN' },
      },
    });
    console.log('  ✓ Cleaned non-admin users.');
  } catch (err) {
    console.warn(`  - Notice on users delete: ${err.message}`);
  }

  // 3. Re-seed system baseline (Admin user, Roles, SLA, System Settings, Sequence Trackers)
  console.log('\n[3/4] Re-initializing pristine system baseline...');
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 3.1 Roles & Permissions Master
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

  // 3.2 SLA Configurations
  const slas = [
    { priority: 'HIGH', responseTimeHours: 0.5, resolutionTimeHours: 4.0, warningThresholdPercent: 75 },
    { priority: 'MEDIUM', responseTimeHours: 2.0, resolutionTimeHours: 12.0, warningThresholdPercent: 75 },
    { priority: 'LOW', responseTimeHours: 4.0, resolutionTimeHours: 24.0, warningThresholdPercent: 75 },
  ];

  for (const s of slas) {
    await prisma.slaConfiguration.upsert({
      where: { priority: s.priority },
      update: { responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours, warningThresholdPercent: s.warningThresholdPercent, isActive: true },
      create: { priority: s.priority, responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours, warningThresholdPercent: s.warningThresholdPercent, isActive: true },
    });
  }

  // 3.3 System Settings
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

  // 3.4 Default System Administrator
  const adminEmail = 'admin@kanvtech.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN', isActive: true, passwordHash },
    });
  } else {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
    });
  }

  // 3.5 Monotonic Sequence Trackers
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
    { name: 'PROSPECT_SEQ', currentValue: 0 },
  ];

  for (const tr of trackers) {
    await prisma.sequenceTracker.upsert({
      where: { name: tr.name },
      update: { currentValue: tr.currentValue },
      create: tr,
    });
  }

  // 4. Verify Final State
  console.log('\n[4/4] Verifying clean database state...');
  const counts = {
    products: await prisma.product.count(),
    departments: await prisma.department.count(),
    employees: await prisma.employee.count(),
    companies: await prisma.company.count(),
    tickets: await prisma.ticket.count(),
    subscriptions: await prisma.companySubscription.count(),
    implementations: await prisma.implementation.count(),
    tasks: await prisma.employeeTask.count(),
    messages: await prisma.chatMessage.count(),
    adminUsers: await prisma.user.count({ where: { role: 'ADMIN' } }),
  };

  console.log('Database Counts post-reset:', counts);
  console.log('\n================================================================');
  console.log('CLEAN DATABASE RESET COMPLETED SUCCESSFULLY!');
  console.log('Admin login: admin@kanvtech.com / Password@123');
  console.log('================================================================');
}

cleanAndResetProductionDatabase()
  .catch((e) => {
    console.error('Reset error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
