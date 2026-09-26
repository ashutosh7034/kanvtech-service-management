const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database backup...");

  const data = {};

  data.Role = await prisma.role.findMany();
  data.User = await prisma.user.findMany();
  data.Company = await prisma.company.findMany();
  data.CompanyContact = await prisma.companyContact.findMany();
  data.CompanyProduct = await prisma.companyProduct.findMany();
  data.CompanyBranch = await prisma.companyBranch.findMany();
  data.BranchProduct = await prisma.branchProduct.findMany();
  data.Department = await prisma.department.findMany();
  data.Employee = await prisma.employee.findMany();
  data.EmployeeAttendance = await prisma.employeeAttendance.findMany();
  data.Ticket = await prisma.ticket.findMany();
  data.TicketAssignment = await prisma.ticketAssignment.findMany();
  data.TicketHistory = await prisma.ticketHistory.findMany();
  data.TicketEscalation = await prisma.ticketEscalation.findMany();
  data.TicketResolutionSession = await prisma.ticketResolutionSession.findMany();
  data.TicketComment = await prisma.ticketComment.findMany();
  data.TicketAttachment = await prisma.ticketAttachment.findMany();
  data.TicketFeedback = await prisma.ticketFeedback.findMany();
  data.SlaConfiguration = await prisma.slaConfiguration.findMany();
  data.Notification = await prisma.notification.findMany();
  data.NotificationLog = await prisma.notificationLog.findMany();
  data.AuditLog = await prisma.auditLog.findMany();
  data.SystemSetting = await prisma.systemSetting.findMany();
  data.SequenceTracker = await prisma.sequenceTracker.findMany();
  data.Product = await prisma.product.findMany();
  data.Subscription = await prisma.subscription.findMany();
  data.Implementation = await prisma.implementation.findMany();
  data.TicketReopenHistory = await prisma.ticketReopenHistory.findMany();
  data.ImplementationTask = await prisma.implementationTask.findMany();

  fs.writeFileSync('db_backup_prod.json', JSON.stringify(data, null, 2));
  console.log("Backup complete! Saved to db_backup_prod.json");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
