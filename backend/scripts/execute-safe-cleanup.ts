import { PrismaClient, UserRole } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

export async function executeSafeCleanup() {
  console.log('====================================================');
  console.log('PHASE 1: EXECUTING SAFE TRANSACTIONAL CLEANUP');
  console.log('====================================================');

  const rawUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'staging';

  if (nodeEnv === 'production' || rawUrl.includes('railway') || rawUrl.includes('rlwy')) {
    throw new Error('SAFETY STOP: Attempted cleanup on production database!');
  }

  // Pre-cleanup check on admin
  const adminBefore = await prisma.user.findUnique({
    where: { email: 'admin@kanvtech.com' },
  });

  if (!adminUserCheck(adminBefore)) {
    throw new Error('Admin verification failed before cleanup!');
  }

  const existingPasswordHash = adminBefore.passwordHash;
  const adminId = adminBefore.id;

  console.log(`Protected Admin ID:    ${adminId}`);
  console.log(`Protected Admin Email: ${adminBefore.email}`);
  console.log('Preserving authentication hash untouched...');

  const deletedCounts = await prisma.$transaction(async (tx) => {
    // 1. Notifications
    const notifLogs = await tx.notificationLog.deleteMany({});
    const notifs = await tx.notification.deleteMany({});

    // 2. Chat
    const chatReceipts = await tx.chatReadReceipt.deleteMany({});
    const chatMsgs = await tx.chatMessage.deleteMany({});
    const chatParts = await tx.chatParticipant.deleteMany({});
    const chatConvs = await tx.chatConversation.deleteMany({});

    // 3. Ticket child tables
    const attachments = await tx.ticketAttachment.deleteMany({});
    const comments = await tx.ticketComment.deleteMany({});
    const feedback = await tx.ticketFeedback.deleteMany({});
    const reopens = await tx.ticketReopenHistory.deleteMany({});
    const escalations = await tx.ticketEscalation.deleteMany({});
    const sessions = await tx.ticketResolutionSession.deleteMany({});
    const assignments = await tx.ticketAssignment.deleteMany({});
    const history = await tx.ticketHistory.deleteMany({});

    // 4. Tickets
    const tickets = await tx.ticket.deleteMany({});

    // 5. Tasks
    const tasks = await tx.employeeTask.deleteMany({});

    // 6. Implementations
    const implTasks = await tx.implementationTask.deleteMany({});
    const impls = await tx.implementation.deleteMany({});

    // 7. Subscriptions
    const subs = await tx.subscription.deleteMany({});

    // 8. Prospects
    const prospects = await tx.prospect.deleteMany({});

    // 9. Customer branches & products
    const branchProdMods = await tx.branchProductModule.deleteMany({});
    const branchProds = await tx.branchProduct.deleteMany({});
    const branches = await tx.companyBranch.deleteMany({});

    // 10. Customers & contacts
    const compProdMods = await tx.companyProductModule.deleteMany({});
    const compProds = await tx.companyProduct.deleteMany({});
    const custCreds = await tx.customerCredential.deleteMany({});
    const contacts = await tx.companyContact.deleteMany({});
    const companies = await tx.company.deleteMany({});

    // 11. Employee Attendance
    const attendance = await tx.employeeAttendance.deleteMany({});

    // 12. Break self-referencing foreign keys on employees & departments
    await tx.employee.updateMany({ data: { managerId: null, departmentId: null } });
    await tx.department.updateMany({ data: { managerId: null } });

    // 13. Employees (preserve EMP-000 for admin if present)
    const empDelete = await tx.employee.deleteMany({
      where: {
        AND: [
          { email: { not: 'admin@kanvtech.com' } },
          { userId: { not: adminId } },
        ],
      },
    });

    // 14. Departments
    const deptProds = await tx.departmentProduct.deleteMany({});
    const depts = await tx.department.deleteMany({});

    // 15. Products & hierarchy
    const submodules = await tx.productSubmodule.deleteMany({});
    const modules = await tx.productModule.deleteMany({});
    const prods = await tx.product.deleteMany({});

    // 16. Non-admin users
    const users = await tx.user.deleteMany({
      where: { email: { not: 'admin@kanvtech.com' } },
    });

    // 17. Business audit logs
    const auditLogs = await tx.auditLog.deleteMany({});

    // 18. Cleanly reset sequence counters
    const seqNames = [
      'TICKET_SEQ',
      'COMPANY_SEQ',
      'BRANCH_SEQ',
      'DEPARTMENT_SEQ',
      'EMPLOYEE_SEQ',
      'PRODUCT_SEQ',
      'MODULE_SEQ',
      'SUBMODULE_SEQ',
      'SUBSCRIPTION_SEQ',
      'IMPLEMENTATION_SEQ',
      'TASK_SEQ',
      'EMP_TASK_SEQ',
      'PROSPECT_SEQ',
    ];
    for (const name of seqNames) {
      await tx.sequenceTracker.upsert({
        where: { name },
        update: { currentValue: 0 },
        create: { name, currentValue: 0 },
      });
    }

    return {
      tickets: tickets.count,
      ticketChildren: attachments.count + comments.count + feedback.count + reopens.count + escalations.count + sessions.count + assignments.count + history.count,
      tasks: tasks.count,
      implementations: impls.count + implTasks.count,
      subscriptions: subs.count,
      companies: companies.count,
      branches: branches.count,
      contacts: contacts.count,
      products: prods.count,
      modules: modules.count + submodules.count,
      departments: depts.count,
      employees: empDelete.count,
      users: users.count,
      notifications: notifs.count + notifLogs.count,
      auditLogs: auditLogs.count,
    };
  });

  // Post-cleanup verification
  console.log('\n--- Post-Cleanup Verification ---');
  const adminAfter = await prisma.user.findUnique({
    where: { email: 'admin@kanvtech.com' },
  });

  if (!adminUserCheck(adminAfter)) {
    throw new Error('Admin verification FAILED after cleanup!');
  }

  if (adminAfter.passwordHash !== existingPasswordHash) {
    throw new Error('SECURITY VIOLATION: Admin password hash was altered!');
  }

  console.log(`✅ Admin Account Verified: [ID ${adminAfter.id}] ${adminAfter.email} (Role: ${adminAfter.role}, Active: ${adminAfter.isActive})`);
  console.log(`✅ Authentication hash preserved identically.`);

  // Verify business tables are zero
  const remainingCounts = {
    companies: await prisma.company.count(),
    branches: await prisma.companyBranch.count(),
    contacts: await prisma.companyContact.count(),
    tickets: await prisma.ticket.count(),
    products: await prisma.product.count(),
    departments: await prisma.department.count(),
    tasks: await prisma.employeeTask.count(),
    subscriptions: await prisma.subscription.count(),
    implementations: await prisma.implementation.count(),
    nonAdminUsers: await prisma.user.count({ where: { email: { not: 'admin@kanvtech.com' } } }),
    roles: await prisma.role.count(),
    settings: await prisma.systemSetting.count(),
    slas: await prisma.slaConfiguration.count(),
  };

  console.log('\n--- Final Clean State Record Counts ---');
  console.log(`Companies:        ${remainingCounts.companies}`);
  console.log(`Branches:         ${remainingCounts.branches}`);
  console.log(`Contacts:         ${remainingCounts.contacts}`);
  console.log(`Tickets:          ${remainingCounts.tickets}`);
  console.log(`Products:         ${remainingCounts.products}`);
  console.log(`Departments:      ${remainingCounts.departments}`);
  console.log(`Tasks:            ${remainingCounts.tasks}`);
  console.log(`Subscriptions:    ${remainingCounts.subscriptions}`);
  console.log(`Implementations:  ${remainingCounts.implementations}`);
  console.log(`Non-Admin Users:  ${remainingCounts.nonAdminUsers}`);
  console.log(`Preserved Roles:  ${remainingCounts.roles}`);
  console.log(`System Settings:  ${remainingCounts.settings}`);
  console.log(`SLA Configs:      ${remainingCounts.slas}`);

  await prisma.$disconnect();
  return { deletedCounts, remainingCounts };
}

function adminUserCheck(user: any): boolean {
  return Boolean(user && user.email === 'admin@kanvtech.com' && user.role === UserRole.ADMIN && user.isActive === true);
}

if (require.main === module) {
  executeSafeCleanup().catch((err) => {
    console.error('Cleanup execution failed:', err);
    process.exit(1);
  });
}
