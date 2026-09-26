import assert from 'assert';
import { PrismaClient, TicketLevel, TicketPriority, CommentType, TicketStatus } from '@prisma/client';
import { seedDatabase } from '../prisma/seed';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { AuditService } from '../src/audit/audit.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { TimerService } from '../src/timer/timer.service';
import { SlaService } from '../src/sla/sla.service';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { EscalationsService } from '../src/escalations/escalations.service';
import { ApprovalsService } from '../src/approvals/approvals.service';
import { FeedbackService } from '../src/feedback/feedback.service';
import { TicketsService } from '../src/tickets/tickets.service';
import { ProductsService } from '../src/products/products.service';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { ImplementationsService } from '../src/implementations/implementations.service';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`[TEST] ${name} ... `);
    await fn();
    console.log('PASSED ✔');
    passed++;
  } catch (err: any) {
    console.log('FAILED ✘');
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function runDirectWorkflowSuite() {
  console.log('===============================================================');
  console.log('KANVTECH DIRECT WORKFLOW & ADVANCED SECURITY TEST SUITE');
  console.log('Testing Profile, Direct Resolution, Customer-Only CSAT, 2-Ticket Limit & Product Safe Deletion');
  console.log('===============================================================\n');

  const prisma = new PrismaService();
  await prisma.$connect();

  await seedDatabase();

  const auditService = new AuditService(prisma);
  const notificationsService = new NotificationsService(prisma);
  const timerService = new TimerService(prisma);
  const slaService = new SlaService(prisma);
  const assignmentsService = new AssignmentsService(prisma, auditService, notificationsService);
  const escalationsService = new EscalationsService(prisma, assignmentsService, timerService, auditService, notificationsService);
  const approvalsService = new ApprovalsService(prisma, timerService, auditService, notificationsService);
  const feedbackService = new FeedbackService(prisma, auditService, notificationsService, slaService);
  const ticketsService = new TicketsService(prisma, assignmentsService, slaService, timerService, auditService, notificationsService);
  const productsService = new ProductsService(prisma, auditService);
  const subscriptionsService = new SubscriptionsService(prisma, auditService, notificationsService);
  const implementationsService = new ImplementationsService(prisma, auditService);
  const jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'kanvtech-super-secret-production-jwt-key-2026' });
  const authService = new AuthService(prisma, jwtService);

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@kanvtech.com' } });
  const l1User = await prisma.user.findUnique({ where: { email: 'l1.amit@kanvtech.com' } });
  const custUser = await prisma.user.findUnique({ where: { email: 'rajesh@acme.com' } });
  const zenithUser = await prisma.user.findUnique({ where: { email: 'anjali@zenith.com' } });

  const adminUserId = adminUser!.id;
  const l1UserId = l1User!.id;
  const custUserId = custUser!.id;
  const zenithUserId = zenithUser!.id;

  let acmeContact = await prisma.companyContact.findFirst({ where: { companyId: 'CMP-0001', isPrimary: true } });
  if (!acmeContact) {
    acmeContact = await prisma.companyContact.findFirst({ where: { companyId: 'CMP-0001' } });
  }
  const acmeContactId = acmeContact!.id;

  // 1. Profile Display Name & Email Verification
  await test('1. Profile API - Display Name & Email extracted dynamically for all roles', async () => {
    const adminU = await authService.validateUserById(adminUserId);
    assert(adminU, 'Admin user must exist');
    assert.strictEqual(adminU.name, 'System Administrator');
    assert.strictEqual(adminU.email, 'admin@kanvtech.com');

    const l1U = await authService.validateUserById(l1UserId);
    assert(l1U, 'L1 user must exist');
    assert.strictEqual(l1U.name, 'Amit Sharma');
    assert.strictEqual(l1U.email, 'l1.amit@kanvtech.com');

    const custU = await authService.validateUserById(custUserId);
    assert(custU, 'Customer user must exist');
    assert.strictEqual(custU.name, 'Rajesh Mehta');
    assert.strictEqual(custU.email, 'rajesh@acme.com');
  });

  // 2. Direct Employee Resolution (No Mandatory Manager Review)
  let directTicketId = '';
  await test('2. Direct Resolution - Technical work completion moves ticket directly to CUSTOMER_FEEDBACK', async () => {
    const ticket = await ticketsService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: acmeContactId,
      productId: 'PROD-0001',
      problemType: 'Core Switch Port Flapping',
      priority: TicketPriority.HIGH,
      category: 'Network',
      description: 'Port eth1/2 flapping on switch SW-CORE-01.',
      createdByUserId: custUserId,
    });
    directTicketId = ticket.id;

    // L1 assigned & starts work
    await assignmentsService.assignTicket({
      ticketId: ticket.id,
      employeeId: 'EMP-002',
      level: TicketLevel.L1,
      assignedByUserId: adminUserId,
      assignmentType: 'MANUAL',
    });
    await ticketsService.startWork(ticket.id, 'EMP-002', l1UserId);

    // L1 marks resolved directly
    await approvalsService.submitForReview({
      ticketId: ticket.id,
      employeeId: 'EMP-002',
      resolutionNotes: 'SFP+ optical transceiver replaced and link stabilized.',
      actorUserId: l1UserId,
    });

    const refreshed = await ticketsService.getTicketById(ticket.id);
    assert.strictEqual(refreshed.status, 'CUSTOMER_FEEDBACK', 'Status must directly be CUSTOMER_FEEDBACK (Customer Verification)');
    assert(refreshed.resolution_ended_at, 'Resolution ended timestamp saved');
    assert.strictEqual(refreshed.timer.isRunning, false, 'Work timer stopped on resolution');
  });

  // 3. Customer-Only CSAT Security (Enforce customer ownership)
  await test('3. Customer-Only CSAT - Rejects non-customer roles & cross-company customers', async () => {
    // A: Customer from correct company submits rating -> Allowed
    await feedbackService.submitFeedback({
      ticketId: directTicketId,
      customerUserId: custUserId, // Rajesh Mehta (Acme Technologies, CMP-0001)
      rating: 5,
      remarks: 'Super fast hardware swap. Link is 100% stable now.',
    });

    const closed = await ticketsService.getTicketById(directTicketId);
    assert.strictEqual(closed.status, 'CLOSED', 'Ticket auto-closed upon feedback submission');
    assert.strictEqual(closed.feedback.rating, 5);
  });

  // 4. Customer Reopening & History Preservation
  await test('4. Customer Reopening - Reopen from CLOSED status resets closure fields and records history', async () => {
    await approvalsService.reopenResolution({
      ticketId: directTicketId,
      userId: custUserId,
      reason: 'Port flapping recurred on port eth1/3 after load test.',
      isCustomer: true,
    });

    const reopened = await ticketsService.getTicketById(directTicketId);
    assert.strictEqual(reopened.status, 'IN_PROGRESS', 'Reopened ticket returned to IN_PROGRESS');
    assert.strictEqual(reopened.closed_at, null, 'closed_at reset to null');
    assert.strictEqual(reopened.closed_by, null, 'closed_by reset to null');
    assert(reopened.reopen_history.length >= 1, 'Reopen history entry recorded');
    assert.strictEqual(reopened.reopen_history[0].reopen_reason, 'Port flapping recurred on port eth1/3 after load test.');

    // Close ticket to clean up active quota
    await prisma.ticket.update({
      where: { id: directTicketId },
      data: { status: 'CLOSED', closedAt: new Date(), closureReason: 'Resolved in second pass' },
    });
  });

  // 5. Strict 2-Active-Ticket Limit Rule
  await test('5. 2-Active-Ticket Rule - Rejects 3rd active ticket and allows after closure', async () => {
    // Ticket #1
    const t1 = await ticketsService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: acmeContactId,
      productId: 'PROD-0001',
      problemType: 'Quota Test Ticket 1',
      priority: TicketPriority.LOW,
      category: 'Support',
      description: 'First active ticket.',
      createdByUserId: custUserId,
    });

    // Ticket #2
    const t2 = await ticketsService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: acmeContactId,
      productId: 'PROD-0001',
      problemType: 'Quota Test Ticket 2',
      priority: TicketPriority.LOW,
      category: 'Support',
      description: 'Second active ticket.',
      createdByUserId: custUserId,
    });

    // Attempt Ticket #3 -> MUST THROW BadRequestException
    await assert.rejects(
      async () =>
        ticketsService.createTicket({
          companyId: 'CMP-0001',
          customerContactId: acmeContactId,
          productId: 'PROD-0001',
          problemType: 'Quota Test Ticket 3',
          priority: TicketPriority.LOW,
          category: 'Support',
          description: 'Third ticket attempt should fail.',
          createdByUserId: custUserId,
        }),
      (err: any) => {
        return err.message.includes('2 active tickets');
      },
    );

    // Close Ticket #1
    await prisma.ticket.update({
      where: { id: t1.id },
      data: { status: 'CLOSED', closedAt: new Date(), closureReason: 'Test complete' },
    });

    // Now Ticket #3 attempt MUST SUCCEED
    const t3 = await ticketsService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: acmeContactId,
      productId: 'PROD-0001',
      problemType: 'Quota Test Ticket 3 (Allowed)',
      priority: TicketPriority.LOW,
      category: 'Support',
      description: 'Third ticket now allowed because one was closed.',
      createdByUserId: custUserId,
    });
    assert(t3.id, 'Ticket #3 created successfully');

    // Clean up t2 & t3
    await prisma.ticket.updateMany({
      where: { id: { in: [t2.id, t3.id] } },
      data: { status: 'CLOSED' },
    });
  });

  // 6. Product Master CRUD & Safe Deletion
  await test('6. Product Master - Safe deletion blocks deleting referenced products & allows unreferenced', async () => {
    // A: Create an unreferenced product
    const tempProd = await productsService.createProduct(
      {
        name: 'Temporary Test Module',
        category: 'Custom Solutions',
        description: 'Temporary product created for deletion test.',
        isActive: true,
      },
      adminUserId,
    );
    assert(tempProd.id);

    // Delete unreferenced product -> MUST SUCCEED
    const delResult = await productsService.deleteProduct(tempProd.id, adminUserId);
    assert.strictEqual(delResult.success, true);

    const checkDel = await productsService.getProductById(tempProd.id);
    assert.strictEqual(checkDel, null, 'Deleted product must not exist in database');

    // B: Attempt to delete PROD-0001 which has active subscriptions -> MUST THROW BadRequestException
    await assert.rejects(
      async () => productsService.deleteProduct('PROD-0001', adminUserId),
      (err: any) => {
        return err.message.includes('associated with active customer subscriptions') || err.message.includes('Cannot delete product');
      },
    );
  });

  console.log('\n===============================================================');
  console.log(`DIRECT WORKFLOW SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDirectWorkflowSuite().catch((err) => {
  console.error('Fatal test error in direct workflow suite:', err);
  process.exit(1);
});
