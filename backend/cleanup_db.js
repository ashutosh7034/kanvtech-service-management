const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting business data cleanup in transaction...");
  
  await prisma.$transaction(async (tx) => {
    console.log("Deleting leaf records...");
    await tx.implementationTask.deleteMany({});
    await tx.ticketReopenHistory.deleteMany({});
    await tx.ticketFeedback.deleteMany({});
    await tx.ticketAttachment.deleteMany({});
    await tx.ticketComment.deleteMany({});
    await tx.ticketResolutionSession.deleteMany({});
    await tx.ticketEscalation.deleteMany({});
    await tx.ticketHistory.deleteMany({});
    await tx.ticketAssignment.deleteMany({});
    
    console.log("Deleting intermediate tickets and subscriptions...");
    await tx.implementation.deleteMany({});
    await tx.ticket.deleteMany({});
    await tx.subscription.deleteMany({});
    
    console.log("Deleting company relationships...");
    await tx.branchProduct.deleteMany({});
    await tx.companyProduct.deleteMany({});
    await tx.companyBranch.deleteMany({});
    await tx.companyContact.deleteMany({});
    
    console.log("Deleting root companies...");
    await tx.company.deleteMany({});
    
    console.log("Deleting employee attendance...");
    await tx.employeeAttendance.deleteMany({});
    
    console.log("Breaking circular dependency between Department and Employee...");
    await tx.department.updateMany({ data: { managerId: null } });
    
    console.log("Deleting employees and departments...");
    await tx.employee.deleteMany({});
    await tx.department.deleteMany({});
    
    console.log("Deleting products...");
    await tx.product.deleteMany({});
    
    console.log("Deleting non-ADMIN users...");
    await tx.user.deleteMany({
      where: {
        role: { not: 'ADMIN' }
      }
    });
    
    console.log("Clearing notifications and logs...");
    await tx.notificationLog.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.auditLog.deleteMany({});
    
    console.log("Resetting sequences...");
    await tx.sequenceTracker.updateMany({
      data: { currentValue: 0 }
    });
    
  }, {
    timeout: 120000
  });
  
  console.log("Cleanup successfully completed!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
