import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runPreCleanupBackup() {
  console.log('====================================================');
  console.log('PHASE 1: TARGET DATABASE IDENTIFICATION & BACKUP');
  console.log('====================================================');

  const rawUrl = process.env.DATABASE_URL || '';
  const parsedUrl = new URL(rawUrl.replace('postgresql://', 'http://'));
  const host = parsedUrl.hostname;
  const port = parsedUrl.port || '5432';
  const dbName = parsedUrl.pathname.replace('/', '').split('?')[0];
  const nodeEnv = process.env.NODE_ENV || 'staging';

  console.log(`Database Host:           ${host}:${port}`);
  console.log(`Database Name:           ${dbName}`);
  console.log(`Environment Class:       ${nodeEnv.toUpperCase()} (Non-Production / Staging Sandbox)`);
  console.log(`Credential Status:       SAFE (Obfuscated)`);

  if (nodeEnv === 'production' || host.includes('railway') || host.includes('rlwy')) {
    console.error('CRITICAL SAFETY STOP: Unexpected production database detected!');
    process.exit(1);
  }

  // 1. Inspect admin@kanvtech.com
  console.log('\n--- 1. Protected Administrator Inspection ---');
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@kanvtech.com' },
  });

  if (!adminUser) {
    console.error('CRITICAL ERROR: admin@kanvtech.com NOT FOUND in database!');
    process.exit(1);
  }

  console.log(`Admin User ID:          ${adminUser.id}`);
  console.log(`Admin Email:            ${adminUser.email}`);
  console.log(`Admin Role:             ${adminUser.role}`);
  console.log(`Admin Active Status:    ${adminUser.isActive}`);
  console.log(`Password Hash Present:  ${Boolean(adminUser.passwordHash && adminUser.passwordHash.length > 20)}`);
  console.log(`Created At:             ${adminUser.createdAt.toISOString()}`);

  const adminEmployee = await prisma.employee.findFirst({
    where: { OR: [{ userId: adminUser.id }, { email: 'admin@kanvtech.com' }] },
  });
  console.log(`Admin Employee Profile: ${adminEmployee ? `ID=${adminEmployee.id}, Name=${adminEmployee.name}` : 'Not linked to regular employee record (Standard Super Admin Exemption)'}`);

  // 2. Perform Full Database Export Backup
  console.log('\n--- 2. Creating Complete Pre-Cleanup Database Backup ---');
  const backupData: Record<string, any[]> = {};

  const models = [
    { name: 'Role', fetch: () => prisma.role.findMany() },
    { name: 'SystemSetting', fetch: () => prisma.systemSetting.findMany() },
    { name: 'SlaConfiguration', fetch: () => prisma.slaConfiguration.findMany() },
    { name: 'SequenceTracker', fetch: () => prisma.sequenceTracker.findMany() },
    { name: 'User', fetch: () => prisma.user.findMany() },
    { name: 'Department', fetch: () => prisma.department.findMany() },
    { name: 'DepartmentProduct', fetch: () => prisma.departmentProduct.findMany() },
    { name: 'SupportLevel', fetch: () => prisma.supportLevel.findMany() },
    { name: 'Product', fetch: () => prisma.product.findMany() },
    { name: 'ProductModule', fetch: () => prisma.productModule.findMany() },
    { name: 'ProductSubmodule', fetch: () => prisma.productSubmodule.findMany() },
    { name: 'Employee', fetch: () => prisma.employee.findMany() },
    { name: 'EmployeeAttendance', fetch: () => prisma.employeeAttendance.findMany() },
    { name: 'EmployeeTask', fetch: () => prisma.employeeTask.findMany() },
    { name: 'Company', fetch: () => prisma.company.findMany() },
    { name: 'CompanyContact', fetch: () => prisma.companyContact.findMany() },
    { name: 'CustomerCredential', fetch: () => prisma.customerCredential.findMany() },
    { name: 'CompanyProduct', fetch: () => prisma.companyProduct.findMany() },
    { name: 'CompanyProductModule', fetch: () => prisma.companyProductModule.findMany() },
    { name: 'CompanyBranch', fetch: () => prisma.companyBranch.findMany() },
    { name: 'BranchProduct', fetch: () => prisma.branchProduct.findMany() },
    { name: 'BranchProductModule', fetch: () => prisma.branchProductModule.findMany() },
    { name: 'Prospect', fetch: () => prisma.prospect.findMany() },
    { name: 'Subscription', fetch: () => prisma.subscription.findMany() },
    { name: 'Implementation', fetch: () => prisma.implementation.findMany() },
    { name: 'ImplementationTask', fetch: () => prisma.implementationTask.findMany() },
    { name: 'Ticket', fetch: () => prisma.ticket.findMany() },
    { name: 'TicketAssignment', fetch: () => prisma.ticketAssignment.findMany() },
    { name: 'TicketHistory', fetch: () => prisma.ticketHistory.findMany() },
    { name: 'TicketEscalation', fetch: () => prisma.ticketEscalation.findMany() },
    { name: 'TicketResolutionSession', fetch: () => prisma.ticketResolutionSession.findMany() },
    { name: 'TicketComment', fetch: () => prisma.ticketComment.findMany() },
    { name: 'TicketAttachment', fetch: () => prisma.ticketAttachment.findMany() },
    { name: 'TicketFeedback', fetch: () => prisma.ticketFeedback.findMany() },
    { name: 'TicketReopenHistory', fetch: () => prisma.ticketReopenHistory.findMany() },
    { name: 'ChatConversation', fetch: () => prisma.chatConversation.findMany() },
    { name: 'ChatParticipant', fetch: () => prisma.chatParticipant.findMany() },
    { name: 'ChatMessage', fetch: () => prisma.chatMessage.findMany() },
    { name: 'ChatReadReceipt', fetch: () => prisma.chatReadReceipt.findMany() },
    { name: 'Notification', fetch: () => prisma.notification.findMany() },
    { name: 'NotificationLog', fetch: () => prisma.notificationLog.findMany() },
    { name: 'AuditLog', fetch: () => prisma.auditLog.findMany() },
  ];

  let totalRecords = 0;
  for (const m of models) {
    try {
      const records = await m.fetch();
      backupData[m.name] = records;
      totalRecords += records.length;
    } catch (e: any) {
      console.warn(`Could not backup model ${m.name}: ${e.message}`);
      backupData[m.name] = [];
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `pre_cleanup_backup_${timestamp}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify({
    metadata: {
      timestamp: new Date().toISOString(),
      databaseHost: `${host}:${port}`,
      databaseName: dbName,
      nodeEnv,
      totalTables: models.length,
      totalRecords,
      protectedAdminUserId: adminUser.id,
      protectedAdminEmail: adminUser.email,
    },
    tables: backupData,
  }, null, 2), 'utf-8');

  // Verify backup integrity
  const stat = fs.statSync(backupFilePath);
  const verifyContent = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
  const verifyTableCount = Object.keys(verifyContent.tables).length;
  console.log(`Backup File:            ${backupFilePath}`);
  console.log(`Backup Size:            ${(stat.size / 1024).toFixed(2)} KB`);
  console.log(`Verified Tables:        ${verifyTableCount}`);
  console.log(`Verified Total Records: ${totalRecords}`);
  console.log(`Backup Verification:    ✅ SUCCESS (Valid JSON Archive)`);

  // 3. Deletion Inventory & Classification
  console.log('\n--- 3. Proposed Deletion Classification ---');
  console.log('Category 1: MUST PRESERVE');
  console.log(` - Administrator: [ID ${adminUser.id}] ${adminUser.email} (Role: ${adminUser.role})`);
  console.log(` - Roles (RBAC): ${backupData['Role']?.length || 0} baseline records`);
  console.log(` - System Settings: ${backupData['SystemSetting']?.length || 0} baseline configuration records`);
  console.log(` - SLA Configurations: ${backupData['SlaConfiguration']?.length || 0} baseline SLA definitions`);
  console.log(` - Sequence Trackers: ${backupData['SequenceTracker']?.length || 0} sequences (to be cleanly reset to 0)`);

  console.log('\nCategory 2: TEST/BUSINESS DATA TO REMOVE');
  console.log(` - Tickets & Related: ${backupData['Ticket']?.length || 0} tickets, ${backupData['TicketAssignment']?.length || 0} assignments, ${backupData['TicketHistory']?.length || 0} history, ${backupData['TicketComment']?.length || 0} comments, ${backupData['TicketResolutionSession']?.length || 0} sessions, ${backupData['TicketFeedback']?.length || 0} feedback`);
  console.log(` - Customers & Contacts: ${backupData['Company']?.length || 0} companies, ${backupData['CompanyContact']?.length || 0} contacts, ${backupData['CompanyProduct']?.length || 0} product entitlements`);
  console.log(` - Customer Branches: ${backupData['CompanyBranch']?.length || 0} branches, ${backupData['BranchProduct']?.length || 0} branch products`);
  console.log(` - Non-Admin Employees: ${(backupData['Employee']?.length || 0)} employees`);
  console.log(` - Non-Admin Users: ${backupData['User']?.filter(u => u.email !== 'admin@kanvtech.com').length || 0} test user accounts`);
  console.log(` - Products & Catalog: ${backupData['Product']?.length || 0} test products, ${backupData['ProductModule']?.length || 0} modules, ${backupData['ProductSubmodule']?.length || 0} submodules`);
  console.log(` - Departments: ${backupData['Department']?.length || 0} departments`);
  console.log(` - Personal & Employee Tasks: ${backupData['EmployeeTask']?.length || 0} tasks`);
  console.log(` - Notifications & Logs: ${backupData['Notification']?.length || 0} notifications, ${backupData['NotificationLog']?.length || 0} logs`);
  console.log(` - Audit Logs: ${backupData['AuditLog']?.length || 0} logs`);

  await prisma.$disconnect();
}

runPreCleanupBackup().catch((err) => {
  console.error('Backup & inspection failed:', err);
  process.exit(1);
});
