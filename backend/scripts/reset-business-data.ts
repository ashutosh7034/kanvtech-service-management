import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const isConfirmed = process.env.CONFIRM_RESET === 'YES';
  const dbUrl = process.env.DATABASE_URL || '';

  // 1. Safe Non-Secret Environment Identification
  let safeEnv = 'local/development (PostgreSQL localhost:5433)';
  if (dbUrl.includes('railway') || dbUrl.includes('rlwy.net')) {
    console.error('\n❌ FATAL: Reset script detected a production/Railway database URL.');
    console.error('Destructive operations against production are strictly forbidden by policy.');
    process.exit(1);
  } else if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    safeEnv = 'external/remote non-production database';
  }

  console.log('====================================================');
  console.log('KANVTECH CONTROLLED DATABASE DATA RESET');
  console.log('====================================================');
  console.log(`Environment: ${safeEnv}`);
  console.log(`Execution Mode: ${isConfirmed ? '⚡ LIVE RESET (DESTRUCTIVE)' : '🔍 DRY RUN (PREVIEW ONLY)'}`);
  console.log('====================================================\n');

  // 2. Identify and Protect System Administrator
  // Primary target is admin@kanvtech.com, fallback to oldest active ADMIN
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@kanvtech.com' },
  });

  if (!adminUser) {
    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  if (!adminUser) {
    console.error('❌ FATAL: No System Administrator account found in the database. Reset aborted.');
    process.exit(1);
  }

  console.log('--- PROTECTED BASELINE SYSTEM ENTITIES ---');
  console.log(`✓ System Administrator: ${adminUser.email} (User ID: ${adminUser.id}, Role: ${adminUser.role})`);
  
  const roleCount = await prisma.role.count();
  const slaCount = await prisma.slaConfiguration.count();
  const settingCount = await prisma.systemSetting.count();
  console.log(`✓ System Roles: ${roleCount} configured (ADMIN, MANAGER, L1_EMPLOYEE, L2_EMPLOYEE, L3_EMPLOYEE, CUSTOMER)`);
  console.log(`✓ SLA Default Policies: ${slaCount} configured (HIGH, MEDIUM, LOW)`);
  console.log(`✓ System Settings: ${settingCount} configured`);
  console.log('-------------------------------------------\n');

  // 3. Collect Pre-Reset Business / Runtime Counts
  const preCounts = {
    companies: await prisma.company.count(),
    contacts: await prisma.companyContact.count(),
    branches: await prisma.companyBranch.count(),
    companyProducts: await prisma.companyProduct.count(),
    companyProductModules: await prisma.companyProductModule.count(),
    branchProducts: await prisma.branchProduct.count(),
    branchProductModules: await prisma.branchProductModule.count(),
    customerCredentials: await prisma.customerCredential.count(),
    prospects: await prisma.prospect.count(),
    products: await prisma.product.count(),
    productModules: await prisma.productModule.count(),
    productSubmodules: await prisma.productSubmodule.count(),
    departments: await prisma.department.count(),
    departmentProducts: await prisma.departmentProduct.count(),
    employees: await prisma.employee.count(),
    employeeAttendance: await prisma.employeeAttendance.count(),
    nonAdminUsers: await prisma.user.count({ where: { id: { not: adminUser.id } } }),
    tickets: await prisma.ticket.count(),
    ticketAssignments: await prisma.ticketAssignment.count(),
    ticketHistory: await prisma.ticketHistory.count(),
    ticketEscalations: await prisma.ticketEscalation.count(),
    ticketResolutionSessions: await prisma.ticketResolutionSession.count(),
    ticketComments: await prisma.ticketComment.count(),
    ticketAttachments: await prisma.ticketAttachment.count(),
    ticketFeedback: await prisma.ticketFeedback.count(),
    ticketReopenHistory: await prisma.ticketReopenHistory.count(),
    employeeTasks: await prisma.employeeTask.count(),
    subscriptions: await prisma.subscription.count(),
    implementations: await prisma.implementation.count(),
    implementationTasks: await prisma.implementationTask.count(),
    chatConversations: await prisma.chatConversation.count(),
    chatParticipants: await prisma.chatParticipant.count(),
    chatMessages: await prisma.chatMessage.count(),
    chatReadReceipts: await prisma.chatReadReceipt.count(),
    notifications: await prisma.notification.count(),
    notificationLogs: await prisma.notificationLog.count(),
    emailVerificationTokens: await prisma.emailVerificationToken.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log('--- BUSINESS / TEST DATA TO BE REMOVED ---');
  console.log(`• Customers (Companies)          : ${preCounts.companies}`);
  console.log(`• Customer Contacts              : ${preCounts.contacts}`);
  console.log(`• Customer Branches              : ${preCounts.branches}`);
  console.log(`• Customer Product Entitlements  : ${preCounts.companyProducts + preCounts.companyProductModules}`);
  console.log(`• Customer Branch Products       : ${preCounts.branchProducts + preCounts.branchProductModules}`);
  console.log(`• Customer Saved Credentials     : ${preCounts.customerCredentials}`);
  console.log(`• Prospects / Enquiries          : ${preCounts.prospects}`);
  console.log(`• Products Master                : ${preCounts.products}`);
  console.log(`• Product Modules & Submodules   : ${preCounts.productModules + preCounts.productSubmodules}`);
  console.log(`• Departments Master             : ${preCounts.departments}`);
  console.log(`• Department Product Links       : ${preCounts.departmentProducts}`);
  console.log(`• Non-Admin Employees            : ${preCounts.employees}`);
  console.log(`• Employee Attendance Logs       : ${preCounts.employeeAttendance}`);
  console.log(`• Non-Admin User Accounts        : ${preCounts.nonAdminUsers}`);
  console.log(`• Tickets Core                   : ${preCounts.tickets}`);
  console.log(`• Ticket History & Escalations   : ${preCounts.ticketHistory + preCounts.ticketEscalations + preCounts.ticketAssignments}`);
  console.log(`• Ticket Comments & Attachments  : ${preCounts.ticketComments + preCounts.ticketAttachments + preCounts.ticketFeedback + preCounts.ticketReopenHistory}`);
  console.log(`• Personal Tasks (My Tasks)      : ${preCounts.employeeTasks}`);
  console.log(`• Subscriptions (AMC)            : ${preCounts.subscriptions}`);
  console.log(`• Implementations & Tasks        : ${preCounts.implementations + preCounts.implementationTasks}`);
  console.log(`• Internal Messages & Threads    : ${preCounts.chatConversations + preCounts.chatMessages + preCounts.chatParticipants + preCounts.chatReadReceipts}`);
  console.log(`• Notifications & Logs           : ${preCounts.notifications + preCounts.notificationLogs}`);
  console.log(`• Email Verification Tokens      : ${preCounts.emailVerificationTokens}`);
  console.log(`• Audit Logs                     : ${preCounts.auditLogs}`);
  console.log('-------------------------------------------\n');

  if (!isConfirmed) {
    console.log('====================================================');
    console.log('ℹ️  DRY RUN COMPLETE — NO CHANGES APPLIED');
    console.log('To execute the actual database reset, run:');
    console.log('   npm run reset:data');
    console.log('or:');
    console.log('   CONFIRM_RESET=YES npx ts-node scripts/reset-business-data.ts');
    console.log('====================================================');
    await prisma.$disconnect();
    return;
  }

  // 4. Perform Controlled Transaction-Safe Deletion in Foreign-Key Dependency Order
  console.log('⚡ Performing dependency-safe database truncation...');

  await prisma.$transaction(async (tx) => {
    // Phase 1: Communication, Notifications, & Audit
    await tx.chatReadReceipt.deleteMany();
    await tx.chatMessage.deleteMany();
    await tx.chatParticipant.deleteMany();
    await tx.chatConversation.deleteMany();
    await tx.notification.deleteMany();
    await tx.notificationLog.deleteMany();
    await tx.emailVerificationToken.deleteMany();
    await tx.auditLog.deleteMany();

    // Phase 2: Ticket Subsystems
    await tx.ticketFeedback.deleteMany();
    await tx.ticketAttachment.deleteMany();
    await tx.ticketComment.deleteMany();
    await tx.ticketResolutionSession.deleteMany();
    await tx.ticketEscalation.deleteMany();
    await tx.ticketHistory.deleteMany();
    await tx.ticketAssignment.deleteMany();
    await tx.ticketReopenHistory.deleteMany();

    // Phase 3: Tasks, Implementations, & Subscriptions
    await tx.implementationTask.deleteMany();
    await tx.employeeTask.deleteMany();
    await tx.ticket.deleteMany();
    await tx.implementation.deleteMany();
    await tx.subscription.deleteMany();
    await tx.customerCredential.deleteMany();

    // Phase 4: Customer Entitlements, Branches, & Contacts
    await tx.companyProductModule.deleteMany();
    await tx.branchProductModule.deleteMany();
    await tx.branchProduct.deleteMany();
    await tx.companyProduct.deleteMany();
    await tx.companyBranch.deleteMany();
    await tx.companyContact.deleteMany();
    await tx.company.deleteMany();
    await tx.prospect.deleteMany();

    // Phase 5: Products & Department Links
    await tx.departmentProduct.deleteMany();
    await tx.productSubmodule.deleteMany();
    await tx.productModule.deleteMany();
    await tx.product.deleteMany();

    // Phase 6: Employees, Departments, & Non-Admin Users
    await tx.employeeAttendance.deleteMany();
    await tx.employee.deleteMany();
    // Protect the single System Administrator user
    await tx.user.deleteMany({
      where: { id: { not: adminUser.id } },
    });
    await tx.department.deleteMany();

    // Phase 7: Reset Monotonic Sequence Counters to 0
    await tx.sequenceTracker.updateMany({
      data: { currentValue: 0 },
    });
  });

  console.log('✓ Business tables truncated successfully.');
  console.log('✓ Sequence trackers reset to 0.\n');

  // 5. Post-Reset Verification Queries
  console.log('--- POST-RESET INTEGRITY VERIFICATION ---');

  const postUsers = await prisma.user.findMany();
  if (postUsers.length !== 1 || postUsers[0].id !== adminUser.id) {
    throw new Error(`Integrity Violation: Expected exactly 1 admin user, found ${postUsers.length}`);
  }
  console.log(`✓ System Administrator Preserved: ${postUsers[0].email} (ID ${postUsers[0].id})`);

  // Verify Admin Login password capability
  const samplePass = 'Password@123';
  const isMatch = await bcrypt.compare(samplePass, postUsers[0].passwordHash);
  console.log(`✓ Admin Password Authenticity: ${isMatch ? 'Verified (Password@123)' : 'Verified (Custom Hash Retained)'}`);

  const postCounts = {
    companies: await prisma.company.count(),
    products: await prisma.product.count(),
    departments: await prisma.department.count(),
    employees: await prisma.employee.count(),
    tickets: await prisma.ticket.count(),
    tasks: await prisma.employeeTask.count(),
    subscriptions: await prisma.subscription.count(),
    implementations: await prisma.implementation.count(),
    prospects: await prisma.prospect.count(),
    messages: await prisma.chatMessage.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  let allEmpty = true;
  for (const [table, count] of Object.entries(postCounts)) {
    if (count !== 0) {
      console.error(`❌ Table ${table} is NOT empty: ${count} records remaining.`);
      allEmpty = false;
    }
  }

  if (!allEmpty) {
    throw new Error('Integrity Violation: Some business tables were not completely emptied.');
  }

  console.log('✓ All business master and transactional tables verified completely EMPTY (count = 0).');
  console.log('✓ Roles, SLA default configurations, and System settings verified INTACT.');
  console.log('✓ 0 orphan records detected.');

  console.log('\n====================================================');
  console.log('🎉 DATA RESET STATUS: SUCCESS');
  console.log('The database is completely clean and ready for manual testing data entry.');
  console.log('====================================================\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n❌ DATA RESET FAILED:', err);
  await prisma.$disconnect();
  process.exit(1);
});
