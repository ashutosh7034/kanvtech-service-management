import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

export async function cleanAndInitializeDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log('=============================================================');
  console.log(' KANVTECH SERVICE MANAGEMENT PLATFORM');
  console.log(' CONTROLLED DATABASE CLEANUP & REAL-DATA INITIALIZATION');
  console.log('=============================================================');
  console.log(`DATABASE TARGET: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`DATABASE HOST:   localhost:5433`);
  console.log(`DATABASE NAME:   kanvtech_sm_staging`);
  console.log(`ENVIRONMENT:     ${nodeEnv}`);
  console.log('=============================================================\n');

  // Strict Production Safety Verification
  if (nodeEnv === 'production' || dbUrl.includes('railway.app') || dbUrl.includes('rlwy.net')) {
    console.error('CRITICAL SAFETY STOP: Target environment is PRODUCTION or RAILWAY.');
    console.error('Destructive reset is strictly forbidden on production databases.');
    process.exit(1);
  }

  console.log('[1/4] Starting atomic transaction to remove all business demo data in dependency order...');

  const results = await prisma.$transaction(async (tx) => {
    // 1. Delete notifications & notification logs
    const notifs = await tx.notification.deleteMany({});
    const notifLogs = await tx.notificationLog.deleteMany({});

    // 2. Delete all ticket-related child records
    const attachments = await tx.ticketAttachment.deleteMany({});
    const comments = await tx.ticketComment.deleteMany({});
    const feedback = await tx.ticketFeedback.deleteMany({});
    const reopens = await tx.ticketReopenHistory.deleteMany({});
    const escalations = await tx.ticketEscalation.deleteMany({});
    const sessions = await tx.ticketResolutionSession.deleteMany({});
    const assignments = await tx.ticketAssignment.deleteMany({});
    const history = await tx.ticketHistory.deleteMany({});

    // 3. Delete tickets
    const tickets = await tx.ticket.deleteMany({});

    // 4. Delete implementation tasks & implementations
    const implTasks = await tx.implementationTask.deleteMany({});
    const impls = await tx.implementation.deleteMany({});

    // 5. Delete subscriptions
    const subscriptions = await tx.subscription.deleteMany({});

    // 6. Delete branch products & branches
    const branchProducts = await tx.branchProduct.deleteMany({});
    const branches = await tx.companyBranch.deleteMany({});

    // 7. Delete company products & contacts
    const companyProducts = await tx.companyProduct.deleteMany({});
    const contacts = await tx.companyContact.deleteMany({});

    // 8. Delete companies
    const companies = await tx.company.deleteMany({});

    // 9. Delete employee attendance
    const attendance = await tx.employeeAttendance.deleteMany({});

    // 10. Clear circular/foreign key relationships in departments and employees
    await tx.department.updateMany({ data: { managerId: null, productId: null } });
    await tx.employee.updateMany({ data: { managerId: null, departmentId: null } });

    // 11. Delete employees
    const employees = await tx.employee.deleteMany({});

    // 12. Delete departments
    const departments = await tx.department.deleteMany({});

    // 13. Delete products
    const products = await tx.product.deleteMany({});

    // 14. Delete non-admin users
    const nonAdminUsers = await tx.user.deleteMany({
      where: {
        email: { not: 'admin@kanvtech.com' },
      },
    });

    // 15. Delete business audit logs
    const auditLogs = await tx.auditLog.deleteMany({});

    // 16. Reset Sequence Counters to 0
    const sequenceNames = [
      'TICKET_SEQ',
      'COMPANY_SEQ',
      'BRANCH_SEQ',
      'DEPARTMENT_SEQ',
      'EMPLOYEE_SEQ',
      'PRODUCT_SEQ',
      'SUBSCRIPTION_SEQ',
      'IMPLEMENTATION_SEQ',
      'TASK_SEQ',
    ];

    for (const name of sequenceNames) {
      await tx.sequenceTracker.upsert({
        where: { name },
        update: { currentValue: 0 },
        create: { name, currentValue: 0 },
      });
    }

    // 17. Ensure Baseline RBAC Roles Exist
    const roles = [
      { name: 'ADMIN', description: 'Full Platform Administrator', permissions: ['all'] },
      { name: 'MANAGER', description: 'Service Operations Manager (Approvals, Reassignments, Reports)', permissions: ['tickets:read', 'tickets:approve', 'tickets:reopen', 'reports:read', 'companies:manage', 'employees:manage', 'departments:manage'] },
      { name: 'L1_EMPLOYEE', description: 'Level 1 Support Specialist (Initial Resolution & Triage)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_l2', 'tickets:resolve'] },
      { name: 'L2_EMPLOYEE', description: 'Level 2 Technical Specialist (In-depth Troubleshooting)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_l3', 'tickets:resolve'] },
      { name: 'L3_EMPLOYEE', description: 'Level 3 Senior Engineer (Core Architecture & Vendor Escalation)', permissions: ['tickets:read_assigned', 'tickets:work', 'tickets:escalate_parent', 'tickets:resolve'] },
      { name: 'CUSTOMER', description: 'Client Portal User (Ticket Creation & Feedback)', permissions: ['tickets:create', 'tickets:read_own', 'feedback:submit'] },
    ];

    for (const r of roles) {
      await tx.role.upsert({
        where: { name: r.name },
        update: { description: r.description, permissionsJson: JSON.stringify(r.permissions) },
        create: { name: r.name, description: r.description, permissionsJson: JSON.stringify(r.permissions) },
      });
    }

    // 18. Ensure Baseline SLA Configurations Exist
    const slas = [
      { priority: 'HIGH' as const, responseTimeHours: 0.5, resolutionTimeHours: 4.0, warningThresholdPercent: 75 },
      { priority: 'MEDIUM' as const, responseTimeHours: 2.0, resolutionTimeHours: 12.0, warningThresholdPercent: 75 },
      { priority: 'LOW' as const, responseTimeHours: 4.0, resolutionTimeHours: 24.0, warningThresholdPercent: 75 },
    ];

    for (const s of slas) {
      await tx.slaConfiguration.upsert({
        where: { priority: s.priority },
        update: { responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours, warningThresholdPercent: s.warningThresholdPercent, isActive: true },
        create: { priority: s.priority, responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours, warningThresholdPercent: s.warningThresholdPercent, isActive: true },
      });
    }

    // 19. Ensure Baseline System Settings Exist
    const settings = [
      { key: 'AUTO_ASSIGNMENT_ENABLED', value: 'true', description: 'Automatically assign new tickets to available L1 employees based on workload' },
      { key: 'AUTO_CLOSURE_HOURS', value: '48', description: 'Automatic ticket closure hours after manager approval if customer does not respond' },
      { key: 'TWO_TICKET_RULE_ENABLED', value: 'true', description: 'Enforce max 2 open tickets per customer contact' },
      { key: 'MAX_ATTACHMENT_SIZE_MB', value: '10', description: 'Maximum allowed attachment file size in MB' },
    ];

    for (const st of settings) {
      await tx.systemSetting.upsert({
        where: { settingKey: st.key },
        update: { settingValue: st.value, description: st.description },
        create: { settingKey: st.key, settingValue: st.value, description: st.description },
      });
    }

    // 20. Ensure Required System Administrator Exists
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const adminUser = await tx.user.upsert({
      where: { email: 'admin@kanvtech.com' },
      update: { role: UserRole.ADMIN, isActive: true, passwordHash },
      create: {
        email: 'admin@kanvtech.com',
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    return {
      notifs: notifs.count,
      notifLogs: notifLogs.count,
      attachments: attachments.count,
      comments: comments.count,
      feedback: feedback.count,
      reopens: reopens.count,
      escalations: escalations.count,
      sessions: sessions.count,
      assignments: assignments.count,
      history: history.count,
      tickets: tickets.count,
      implTasks: implTasks.count,
      impls: impls.count,
      subscriptions: subscriptions.count,
      branchProducts: branchProducts.count,
      branches: branches.count,
      companyProducts: companyProducts.count,
      contacts: contacts.count,
      companies: companies.count,
      attendance: attendance.count,
      employees: employees.count,
      departments: departments.count,
      products: products.count,
      nonAdminUsers: nonAdminUsers.count,
      auditLogs: auditLogs.count,
      adminUserId: adminUser.id,
    };
  });

  console.log('[2/4] Transaction committed successfully. Summary of records cleared:');
  console.log(` - Tickets & Child Records: ${results.tickets} tickets, ${results.assignments} assignments, ${results.sessions} sessions, ${results.escalations} escalations`);
  console.log(` - Implementations: ${results.impls} projects, ${results.implTasks} tasks`);
  console.log(` - Subscriptions / AMC: ${results.subscriptions}`);
  console.log(` - Customer Master: ${results.companies} companies, ${results.contacts} contacts, ${results.branches} branches, ${results.companyProducts} purchased products`);
  console.log(` - Department Master: ${results.departments}`);
  console.log(` - Product Master: ${results.products}`);
  console.log(` - Employee Master: ${results.employees} employees, ${results.nonAdminUsers} demo login accounts`);
  console.log(` - Notifications & Logs: ${results.notifs} in-app notifications, ${results.auditLogs} audit logs`);
  console.log(` - System Administrator preserved: admin@kanvtech.com (User ID: ${results.adminUserId})`);

  console.log('\n[3/4] Performing post-cleanup verification of all database models...');

  const remainingCounts = {
    products: await prisma.product.count(),
    departments: await prisma.department.count(),
    employees: await prisma.employee.count(),
    companies: await prisma.company.count(),
    companyContacts: await prisma.companyContact.count(),
    companyBranches: await prisma.companyBranch.count(),
    companyProducts: await prisma.companyProduct.count(),
    branchProducts: await prisma.branchProduct.count(),
    tickets: await prisma.ticket.count(),
    ticketAssignments: await prisma.ticketAssignment.count(),
    ticketEscalations: await prisma.ticketEscalation.count(),
    ticketSessions: await prisma.ticketResolutionSession.count(),
    ticketFeedback: await prisma.ticketFeedback.count(),
    ticketReopens: await prisma.ticketReopenHistory.count(),
    subscriptions: await prisma.subscription.count(),
    implementations: await prisma.implementation.count(),
    implementationTasks: await prisma.implementationTask.count(),
    notifications: await prisma.notification.count(),
    users: await prisma.user.count(),
    roles: await prisma.role.count(),
    slaConfigs: await prisma.slaConfiguration.count(),
    systemSettings: await prisma.systemSetting.count(),
  };

  console.table(
    Object.entries(remainingCounts).map(([entity, count]) => ({
      Entity: entity,
      'Remaining Count': count,
      Status:
        entity === 'users'
          ? count === 1
            ? 'VERIFIED (Admin Only)'
            : 'FAIL'
          : ['roles', 'slaConfigs', 'systemSettings'].includes(entity)
          ? count > 0
            ? 'VERIFIED (System Config Kept)'
            : 'FAIL'
          : count === 0
          ? 'VERIFIED (0 Clean)'
          : 'FAIL',
    }))
  );

  console.log('\n[4/4] Checking for orphaned records...');
  const orphanedUsers = await prisma.user.findMany({
    where: {
      role: { not: UserRole.ADMIN },
      employee: null,
      companyContacts: { none: {} },
    },
  });

  const orphanedDepartments = await prisma.department.findMany({
    where: { productId: { not: null } },
  });

  console.log(` - Orphaned Non-Admin Users: ${orphanedUsers.length}`);
  console.log(` - Orphaned Department Product references: ${orphanedDepartments.length}`);

  if (
    remainingCounts.products === 0 &&
    remainingCounts.departments === 0 &&
    remainingCounts.employees === 0 &&
    remainingCounts.companies === 0 &&
    remainingCounts.tickets === 0 &&
    remainingCounts.subscriptions === 0 &&
    remainingCounts.implementations === 0 &&
    remainingCounts.users === 1 &&
    orphanedUsers.length === 0
  ) {
    console.log('\nSUCCESS: Database successfully cleaned and initialized for Real Business Data!');
  } else {
    console.error('\nWARNING: Database state did not meet exact zero-business-data criteria.');
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  cleanAndInitializeDatabase().catch(async (e) => {
    console.error('Cleanup failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
}
