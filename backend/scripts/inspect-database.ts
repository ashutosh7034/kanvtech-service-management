import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  const envUrl = process.env.DATABASE_URL || '';
  const safeEnv = envUrl.includes('localhost') || envUrl.includes('127.0.0.1')
    ? 'local/development (PostgreSQL on localhost:5433)'
    : 'external/staging database';

  console.log('====================================================');
  console.log('DATABASE INSPECTION');
  console.log('====================================================');
  console.log('Environment:', safeEnv);

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, isActive: true, createdAt: true },
  });
  console.log('\n--- System Users (' + users.length + ') ---');
  users.forEach((u) => console.log(`[ID ${u.id}] ${u.email} (${u.role}) Active: ${u.isActive}`));

  const admin = users.find((u) => u.role === 'ADMIN');
  console.log('\n--- System Administrator ---');
  if (admin) {
    console.log(`Protected Admin: ID=${admin.id}, Email=${admin.email}, Role=${admin.role}`);
    const adminEmp = await prisma.employee.findFirst({ where: { userId: admin.id } });
    console.log('Admin Employee Record:', adminEmp ? `ID=${adminEmp.id}, Name=${adminEmp.name}` : 'None');
  } else {
    console.log('WARNING: No ADMIN role user found!');
  }

  const counts: Record<string, number> = {
    'Companies (Customers)': await prisma.company.count(),
    'Company Contacts': await prisma.companyContact.count(),
    'Company Branches': await prisma.companyBranch.count(),
    'Company Products': await prisma.companyProduct.count(),
    'Company Product Modules': await prisma.companyProductModule.count(),
    'Branch Products': await prisma.branchProduct.count(),
    'Branch Product Modules': await prisma.branchProductModule.count(),
    'Customer Credentials': await prisma.customerCredential.count(),
    'Prospects (Enquiries)': await prisma.prospect.count(),
    'Products': await prisma.product.count(),
    'Product Modules': await prisma.productModule.count(),
    'Product Submodules': await prisma.productSubmodule.count(),
    'Departments': await prisma.department.count(),
    'Department Products': await prisma.departmentProduct.count(),
    'Employees': await prisma.employee.count(),
    'Employee Attendance': await prisma.employeeAttendance.count(),
    'Tickets': await prisma.ticket.count(),
    'Ticket Assignments': await prisma.ticketAssignment.count(),
    'Ticket History': await prisma.ticketHistory.count(),
    'Ticket Escalations': await prisma.ticketEscalation.count(),
    'Ticket Resolution Sessions': await prisma.ticketResolutionSession.count(),
    'Ticket Comments': await prisma.ticketComment.count(),
    'Ticket Attachments': await prisma.ticketAttachment.count(),
    'Ticket Feedback (CSAT)': await prisma.ticketFeedback.count(),
    'Ticket Reopen History': await prisma.ticketReopenHistory.count(),
    'Personal Tasks (My Tasks)': await prisma.employeeTask.count(),
    'Subscriptions (AMC)': await prisma.subscription.count(),
    'Implementations': await prisma.implementation.count(),
    'Implementation Tasks': await prisma.implementationTask.count(),
    'Chat Conversations': await prisma.chatConversation.count(),
    'Chat Participants': await prisma.chatParticipant.count(),
    'Chat Messages': await prisma.chatMessage.count(),
    'Chat Read Receipts': await prisma.chatReadReceipt.count(),
    'Notifications': await prisma.notification.count(),
    'Notification Logs': await prisma.notificationLog.count(),
    'Email Verification Tokens': await prisma.emailVerificationToken.count(),
    'Audit Logs': await prisma.auditLog.count(),
    'Sequence Trackers': await prisma.sequenceTracker.count(),
    'SLA Configurations (System)': await prisma.slaConfiguration.count(),
    'System Settings (System)': await prisma.systemSetting.count(),
    'Roles (System)': await prisma.role.count(),
  };

  console.log('\n--- Current Record Counts ---');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`${table.padEnd(30)}: ${count}`);
  }

  await prisma.$disconnect();
}

inspect().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
