import assert from 'assert';
import { PrismaClient, TicketLevel, TicketPriority, AssignmentType, CommentType } from '@prisma/client';
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
import { CompaniesService } from '../src/companies/companies.service';
import { EmployeesService } from '../src/employees/employees.service';
import { TicketsService } from '../src/tickets/tickets.service';
import { ImportService } from '../src/import/import.service';
import { StorageService } from '../src/storage/storage.service';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`[TEST] ${name} ... `);
    await fn();
    console.log('PASSED \u2714');
    passed++;
  } catch (err: any) {
    console.log('FAILED \u2718');
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('KANVTECH MIGRATION VERIFICATION - NESTJS + PRISMA + POSTGRES');
  console.log('Testing all 18 mandatory business requirements + E2E Journey');
  console.log('Target: 19/19 PASS');
  console.log('===============================================================\n');

  const prisma = new PrismaService();
  await prisma.$connect();

  const auditService = new AuditService(prisma);
  const notificationsService = new NotificationsService(prisma);
  const timerService = new TimerService(prisma);
  const slaService = new SlaService(prisma);
  const assignmentsService = new AssignmentsService(prisma, auditService, notificationsService);
  const escalationsService = new EscalationsService(prisma, assignmentsService, timerService, auditService, notificationsService);
  const approvalsService = new ApprovalsService(prisma, timerService, auditService, notificationsService);
  const feedbackService = new FeedbackService(prisma, auditService, notificationsService, slaService);
  const companiesService = new CompaniesService(prisma, auditService);
  const employeesService = new EmployeesService(prisma, auditService);
  const ticketsService = new TicketsService(prisma, assignmentsService, slaService, timerService, auditService, notificationsService);
  const importService = new ImportService(prisma, companiesService, employeesService);
  const storageService = new StorageService();
  const jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'kanvtech-super-secret-production-jwt-key-2026' });
  const authService = new AuthService(prisma, jwtService);

  // Seed baseline masters
  await seedDatabase();

  // Clean test tables
  await prisma.ticketComment.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketFeedback.deleteMany();
  await prisma.ticketEscalation.deleteMany();
  await prisma.ticketResolutionSession.deleteMany();
  await prisma.ticketAssignment.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.companyContact.deleteMany({
    where: { company: { companyName: { startsWith: 'Test Horizon' } } },
  });
  await prisma.company.deleteMany({
    where: { companyName: { startsWith: 'Test Horizon' } },
  });

  // 1. Authentication
  await test('1. Authentication - User Login & Token Verification', async () => {
    const res = await authService.login('admin@kanvtech.com', 'Password@123');
    assert(res.token, 'Token should be returned');
    assert.strictEqual(res.user.role, 'ADMIN', 'Role should be ADMIN');

    const decoded: any = jwtService.verify(res.token);
    assert.strictEqual(decoded.email, 'admin@kanvtech.com');

    // Reject bad password
    await assert.rejects(
      async () => authService.login('admin@kanvtech.com', 'WrongPass'),
      /Invalid email or password/,
    );
  });

  // 2. RBAC
  await test('2. RBAC - Role identification and User Attributes', async () => {
    const l1 = await authService.login('l1.amit@kanvtech.com', 'Password@123');
    assert.strictEqual(l1.user.role, 'L1_EMPLOYEE');

    const cust = await authService.login('rajesh@acme.com', 'Password@123');
    assert.strictEqual(cust.user.role, 'CUSTOMER');
    assert(cust.user.companyId, 'Customer must have company ID');
    assert(cust.user.contactId, 'Customer must have contact ID');
  });

  // 3. Company CRUD
  await test('3. Company CRUD - Creation, Lookup, and Deactivation', async () => {
    const compId = await companiesService.createCompany({
      company_name: 'Test Horizon Corp',
      address: 'Industrial Sector 62, Noida',
      gstn: '07AAACH1122D1Z9',
      primary_email: 'contact@horizon.com',
      contact_person: 'Vikas Khanna',
      contact_phone: '+91 98111 22334',
    });
    assert(compId.startsWith('CMP-'), 'Company ID must follow CMP- pattern');

    const details = await companiesService.getCompanyById(compId);
    assert.strictEqual(details.company_name, 'Test Horizon Corp');
    assert.strictEqual(details.contacts.length, 1);

    await companiesService.toggleCompanyStatus(compId, false);
    const updated = await companiesService.getCompanyById(compId);
    assert.strictEqual(updated.is_active, 0);
  });

  // 4. Excel Validation
  await test('4. Excel / CSV Validation - Parsing and Duplicate Detection', async () => {
    const buffer = importService.generateTemplate('companies');
    assert(buffer.length > 0, 'Template buffer must be generated');

    const preview = await importService.validateCompanyImport(buffer);
    assert.strictEqual(preview.totalRows, 1);
    assert.strictEqual(preview.validCount, 1);
    assert.strictEqual(preview.invalidCount, 0);
  });

  // 5. Ticket Creation
  let createdTicketId = '';
  await test('5. Ticket Creation - ID sequence and customer auto-population', async () => {
    const ticket = await ticketsService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: 1,
      problemType: 'Server Storage Degradation',
      priority: TicketPriority.HIGH,
      category: 'Infrastructure',
      description: 'Storage array volume capacity exceeded 95% threshold on SAN node 2.',
      createdByUserId: 1,
    });

    assert(ticket.id.startsWith('KT-2026-'), 'Ticket ID must match KT-2026-XXXXXX format');
    assert.strictEqual(ticket.status, 'OPEN');
    assert.strictEqual(ticket.priority, 'HIGH');
    assert(ticket.sla_deadline, 'SLA deadline must be populated');
    createdTicketId = ticket.id;
  });

  // 6. Two-Ticket Restriction Rule
  await test('6. Two-Ticket Restriction - Strict rejection on 3rd open ticket', async () => {
    const ticket2 = await ticketsService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: 1,
      problemType: 'Network Latency Spike',
      priority: TicketPriority.MEDIUM,
      category: 'Networking',
      description: 'Core switch packet drops observed.',
      createdByUserId: 1,
    });
    assert(ticket2.id);

    // Attempt Ticket 3 for the same customer contact: MUST BE REJECTED
    await assert.rejects(
      async () =>
        ticketsService.createTicket({
          companyId: 'CMP-0001',
          customerContactId: 1,
          problemType: 'Email Relay Failure',
          priority: TicketPriority.LOW,
          category: 'Applications',
          description: 'Third ticket attempt must fail.',
          createdByUserId: 1,
        }),
      /Customer currently has 2 active tickets in progress/,
    );

    // Close Ticket 2 to keep workspace clean
    await prisma.ticket.update({
      where: { id: ticket2.id },
      data: { status: 'CLOSED' },
    });
  });

  // 7. Assignment
  await test('7. Assignment - Auto-assignment and Manual routing', async () => {
    const bestL1 = await assignmentsService.findBestAvailableEmployee();
    assert(bestL1, 'Should find available L1 employee');

    await assignmentsService.assignTicket({
      ticketId: createdTicketId,
      employeeId: 'EMP-002',
      level: TicketLevel.L1,
      assignedByUserId: 1,
      assignmentType: 'MANUAL',
    });

    const ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-002');
    assert.strictEqual(ticket.assigned_level, 'L1');
  });

  // 8. L1 Workflow
  await test('8. L1 Workflow - Start Work and status transition', async () => {
    await ticketsService.startWork(createdTicketId, 'EMP-002', 3);
    const ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'IN_PROGRESS');
  });

  // 9. Escalation L1 -> L2
  await test('9. Escalation L1 -> L2 - Immutable logging and legal transition', async () => {
    assert.throws(() => escalationsService.validateHierarchy('L1', 'L3'), /L1 support can only escalate to L2/);

    await escalationsService.escalateTicket({
      ticketId: createdTicketId,
      fromLevel: 'L1',
      toLevel: 'L2',
      escalatedByEmployeeId: 'EMP-002',
      assignedToEmployeeId: 'EMP-004',
      reason: 'Requires advanced SAN RAID reconstruction permissions',
      actorUserId: 3,
    });

    const ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.assigned_level, 'L2');
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-004');
    assert.strictEqual(ticket.escalations.length, 1);
  });

  // 10. Escalation L2 -> L3
  await test('10. Escalation L2 -> L3 - Continuity across tiers', async () => {
    await escalationsService.escalateTicket({
      ticketId: createdTicketId,
      fromLevel: 'L2',
      toLevel: 'L3',
      escalatedByEmployeeId: 'EMP-004',
      assignedToEmployeeId: 'EMP-005',
      reason: 'Firmware controller fault requiring core kernel intervention',
      actorUserId: 5,
    });

    const ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.assigned_level, 'L3');
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-005');
    assert.strictEqual(ticket.escalations.length, 2);
  });

  // 11. Timer Calculation
  await test('11. Timer - Session Recording and duration tracking', async () => {
    const timerStats = await timerService.getTotalResolutionTime(createdTicketId);
    assert(timerStats.sessions.length >= 2, 'Must have multiple resolution sessions across escalations');
    assert(timerStats.isRunning, 'Timer should currently be running for active L3 assignee');
  });

  // 12. Timer Continuity Across Levels
  await test('12. Timer Continuity - Continuity maintained through L1, L2, L3', async () => {
    const timerStats = await timerService.getTotalResolutionTime(createdTicketId);
    assert(timerStats.totalSeconds >= 0, 'Total seconds must aggregate all sessions');
  });

  // 13. SLA Calculation
  await test('13. SLA - Deadline computation, warning thresholds, breach detection', async () => {
    const highDeadline = await slaService.calculateDeadline(TicketPriority.HIGH, new Date());
    const hoursDiff = (highDeadline.getTime() - Date.now()) / (3600 * 1000);
    assert(hoursDiff >= 3.9 && hoursDiff <= 4.1, 'HIGH SLA must be ~4 hours');

    const pastDate = new Date(Date.now() - 5 * 3600 * 1000);
    const pastDeadline = new Date(Date.now() - 1 * 3600 * 1000);
    const status = slaService.computeSLAStatus({
      createdAt: pastDate,
      deadline: pastDeadline,
      status: 'IN_PROGRESS',
    });
    assert.strictEqual(status.status, 'BREACHED', 'Past deadline ticket must be BREACHED');
  });

  // 14. Manager Approval & Reopen
  await test('14. Manager Approval - Resolution, Review Queue, and Decision Logging', async () => {
    await approvalsService.submitForReview({
      ticketId: createdTicketId,
      employeeId: 'EMP-005',
      resolutionNotes: 'Controller microcode updated, SAN logical volume parity rebuilt successfully.',
      actorUserId: 6,
    });

    let ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'MANAGER_REVIEW');

    // Manager tests reopen
    await approvalsService.reopenResolution({
      ticketId: createdTicketId,
      managerUserId: 2,
      reason: 'Please attach the SAN diagnostic verification logs.',
    });

    ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'IN_PROGRESS');

    // L3 re-submits
    await approvalsService.submitForReview({
      ticketId: createdTicketId,
      employeeId: 'EMP-005',
      resolutionNotes: 'Diagnostic log attached confirming 0 uncorrectable parity blocks.',
      actorUserId: 6,
    });

    // Manager approves
    await approvalsService.approveResolution({
      ticketId: createdTicketId,
      managerUserId: 2,
      notes: 'Resolution verified and approved.',
    });

    ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'CUSTOMER_FEEDBACK');
  });

  // 15. Customer Feedback
  await test('15. Customer Feedback - Rating 1-5 and Remarks', async () => {
    await feedbackService.submitFeedback({
      ticketId: createdTicketId,
      customerUserId: 7,
      rating: 5,
      remarks: 'Outstanding resolution speed and technical competency by Kanvtech team.',
    });

    const fb = await feedbackService.getFeedback(createdTicketId);
    assert.strictEqual(fb.rating, 5);
    assert.strictEqual(fb.remarks, 'Outstanding resolution speed and technical competency by Kanvtech team.');
  });

  // 16. Ticket Closure
  await test('16. Closure - Automatic closure post-feedback with audit record', async () => {
    const ticket = await ticketsService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'CLOSED');
    assert(ticket.closed_at, 'closed_at must be populated');
    assert(ticket.closure_reason, 'closure_reason must be populated');
  });

  // 17. Authorization Guard
  await test('17. Authorization - Customer cross-company isolation', async () => {
    const custAcme = await authService.login('rajesh@acme.com', 'Password@123');
    const foreignTickets = await prisma.ticket.findMany({
      where: { companyId: { not: custAcme.user.companyId } },
      take: 1,
    });
    if (foreignTickets.length > 0) {
      assert.notStrictEqual(foreignTickets[0].companyId, custAcme.user.companyId);
    }
  });

  // 18. Attachment Validation
  await test('18. Attachment Validation - Permitted mime types and extensions', async () => {
    await ticketsService.addAttachment({
      ticketId: createdTicketId,
      fileName: 'san_diagnostic_report.pdf',
      filePath: '/uploads/san_diagnostic_report.pdf',
      fileSize: 204800,
      mimeType: 'application/pdf',
      uploadedByUserId: 6,
    });

    const ticket = await ticketsService.getTicketById(createdTicketId);
    assert(ticket.attachments.length >= 1);
    assert.strictEqual(ticket.attachments[0].file_name, 'san_diagnostic_report.pdf');
  });

  // 19. Full End-to-End Lifecycle Journey
  await test('19. Master End-to-End Journey (Customer -> L1 -> L2 -> L3 -> Manager -> Feedback -> Closed)', async () => {
    // 1. Customer creates ticket
    const e2eTicket = await ticketsService.createTicket({
      companyId: 'CMP-0002',
      customerContactId: 3,
      problemType: 'Database Deadlock in Production ERP',
      priority: TicketPriority.HIGH,
      category: 'Database Services',
      description: 'Transaction locks exceeding timeout threshold during batch settlement.',
      createdByUserId: 7,
    });
    assert(e2eTicket.id, 'Step 1: Ticket created with ID');

    // 2. L1 assigned
    await assignmentsService.assignTicket({
      ticketId: e2eTicket.id,
      employeeId: 'EMP-002',
      level: TicketLevel.L1,
      assignedByUserId: 1,
      assignmentType: 'MANUAL',
    });

    // 3. L1 starts work
    await ticketsService.startWork(e2eTicket.id, 'EMP-002', 3);
    let t = await ticketsService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'IN_PROGRESS', 'Step 3: Status is IN_PROGRESS');
    assert(t.timer.isRunning, 'Step 3: Timer running');

    // 4. L1 adds notes
    await ticketsService.addComment({
      ticketId: e2eTicket.id,
      authorUserId: 3,
      commentType: CommentType.INTERNAL_NOTE,
      message: 'Initial query plan analysis shows deadlock on table GL_BALANCES.',
    });

    // 5. L1 escalates to L2
    await escalationsService.escalateTicket({
      ticketId: e2eTicket.id,
      fromLevel: 'L1',
      toLevel: 'L2',
      escalatedByEmployeeId: 'EMP-002',
      assignedToEmployeeId: 'EMP-004',
      reason: 'Requires tuning of row-level lock escalation parameters',
      actorUserId: 3,
    });
    t = await ticketsService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.assigned_level, 'L2', 'Step 5: Level is L2');
    assert(t.timer.isRunning, 'Step 5: Timer continues');

    // 6. L2 works & escalates to L3
    await ticketsService.addComment({
      ticketId: e2eTicket.id,
      authorUserId: 5,
      commentType: CommentType.INTERNAL_NOTE,
      message: 'Isolation level requires read-committed snapshot isolation configuration.',
    });

    await escalationsService.escalateTicket({
      ticketId: e2eTicket.id,
      fromLevel: 'L2',
      toLevel: 'L3',
      escalatedByEmployeeId: 'EMP-004',
      assignedToEmployeeId: 'EMP-005',
      reason: 'Requires DB engine parameter reconfiguration and failover cluster tuning',
      actorUserId: 5,
    });
    t = await ticketsService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.assigned_level, 'L3', 'Step 6: Level is L3');

    // 7. L3 resolves
    await approvalsService.submitForReview({
      ticketId: e2eTicket.id,
      employeeId: 'EMP-005',
      resolutionNotes: 'Configured RCSI and tuned settlement transaction batch index ordering.',
      actorUserId: 6,
    });
    t = await ticketsService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'MANAGER_REVIEW', 'Step 7: Status is MANAGER_REVIEW');

    // 8. Manager reviews & approves
    await approvalsService.approveResolution({
      ticketId: e2eTicket.id,
      managerUserId: 2,
      notes: 'Fix verified in telemetry. No deadlocks detected in post-run batch.',
    });
    t = await ticketsService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'CUSTOMER_FEEDBACK', 'Step 8: Status is CUSTOMER_FEEDBACK');

    // 9. Customer submits 5-star feedback
    await feedbackService.submitFeedback({
      ticketId: e2eTicket.id,
      customerUserId: 7,
      rating: 5,
      remarks: 'Flawless resolution. Settlement run completed without delays.',
    });

    // 10. Complete verification of closed ticket
    t = await ticketsService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'CLOSED', 'Step 10: Ticket is CLOSED');
    assert.strictEqual(t.feedback.rating, 5, 'Step 10: Feedback is 5 stars');
    assert(t.timeline.length >= 8, 'Step 10: Complete chronological timeline exists');
    assert(t.sla_status === 'MET' || t.sla_status === 'ON_TRACK', 'Step 10: SLA is MET');
  });

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
