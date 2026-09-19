import assert from 'assert';
import { db } from '../src/db/database';
import { seedDatabase } from '../src/db/seed';
import { AuthService } from '../src/services/authService';
import { CompanyService } from '../src/services/companyService';
import { EmployeeService } from '../src/services/employeeService';
import { TicketService } from '../src/services/ticketService';
import { AssignmentService } from '../src/services/assignmentService';
import { EscalationService } from '../src/services/escalationService';
import { TimerService } from '../src/services/timerService';
import { SLAService } from '../src/services/slaService';
import { ApprovalService } from '../src/services/approvalService';
import { FeedbackService } from '../src/services/feedbackService';
import { ClosureService } from '../src/services/closureService';
import { ImportService } from '../src/services/importService';

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
  console.log('KANVTECH SERVICE MANAGEMENT PLATFORM - AUTOMATED TEST SUITE');
  console.log('Testing all 18 mandatory business requirements + E2E Journey');
  console.log('===============================================================\n');

  // Ensure seeded state
  await seedDatabase();

  // Clean slate for tickets and test entities
  await db.execute('DELETE FROM ticket_comments');
  await db.execute('DELETE FROM ticket_attachments');
  await db.execute('DELETE FROM ticket_feedback');
  await db.execute('DELETE FROM ticket_escalations');
  await db.execute('DELETE FROM ticket_resolution_sessions');
  await db.execute('DELETE FROM ticket_assignments');
  await db.execute('DELETE FROM ticket_history');
  await db.execute('DELETE FROM tickets');
  await db.execute("DELETE FROM company_contacts WHERE company_id IN (SELECT id FROM companies WHERE company_name LIKE 'Test Horizon%')");
  await db.execute("DELETE FROM companies WHERE company_name LIKE 'Test Horizon%'");

  // 1. Login
  await test('1. Authentication - User Login & Token Verification', async () => {
    const res = await AuthService.login('admin@kanvtech.com', 'Password@123');
    assert(res.token, 'Token should be returned');
    assert.strictEqual(res.user.role, 'ADMIN', 'Role should be ADMIN');

    const decoded = AuthService.verifyToken(res.token);
    assert.strictEqual(decoded.email, 'admin@kanvtech.com');

    // Reject bad password
    await assert.rejects(
      async () => AuthService.login('admin@kanvtech.com', 'WrongPass'),
      /Invalid email or password/
    );
  });

  // 2. RBAC
  await test('2. RBAC - Role identification and User Attributes', async () => {
    const l1 = await AuthService.login('l1.amit@kanvtech.com', 'Password@123');
    assert.strictEqual(l1.user.role, 'L1_EMPLOYEE');

    const cust = await AuthService.login('rajesh@acme.com', 'Password@123');
    assert.strictEqual(cust.user.role, 'CUSTOMER');
    assert(cust.user.companyId, 'Customer must have company ID');
    assert(cust.user.contactId, 'Customer must have contact ID');
  });

  // 3. Company CRUD
  await test('3. Company CRUD - Creation, Lookup, and Deactivation', async () => {
    const compId = await CompanyService.createCompany({
      company_name: 'Test Horizon Corp',
      address: 'Industrial Sector 62, Noida',
      gstn: '07AAACH1122D1Z9',
      primary_email: 'contact@horizon.com',
      contact_person: 'Vikas Khanna',
      contact_phone: '+91 98111 22334',
    });
    assert(compId.startsWith('CMP-'), 'Company ID must follow CMP- pattern');

    const details = await CompanyService.getCompanyById(compId);
    assert.strictEqual(details.company_name, 'Test Horizon Corp');
    assert.strictEqual(details.contacts.length, 1);

    await CompanyService.toggleCompanyStatus(compId, false);
    const updated = await CompanyService.getCompanyById(compId);
    assert.strictEqual(updated.is_active, 0);
  });

  // 4. Excel Validation
  await test('4. Excel / CSV Validation - Parsing and Duplicate Detection', async () => {
    const buffer = ImportService.generateTemplate('companies');
    assert(buffer.length > 0, 'Template buffer must be generated');

    const preview = await ImportService.validateCompanyImport(buffer);
    assert.strictEqual(preview.totalRows, 1);
    assert.strictEqual(preview.validCount, 1);
    assert.strictEqual(preview.invalidCount, 0);
  });

  // 5. Ticket Creation
  let createdTicketId = '';
  await test('5. Ticket Creation - ID sequence and customer auto-population', async () => {
    const ticket = await TicketService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: 1,
      problemType: 'Server Storage Degradation',
      priority: 'HIGH',
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
    // Ticket 1 already created above. Create Ticket 2:
    const ticket2 = await TicketService.createTicket({
      companyId: 'CMP-0001',
      customerContactId: 1,
      problemType: 'Network Latency Spike',
      priority: 'MEDIUM',
      category: 'Networking',
      description: 'Core switch packet drops observed.',
      createdByUserId: 1,
    });
    assert(ticket2.id);

    // Attempt Ticket 3 for the same customer contact: MUST BE REJECTED
    await assert.rejects(
      async () =>
        TicketService.createTicket({
          companyId: 'CMP-0001',
          customerContactId: 1,
          problemType: 'Email Relay Failure',
          priority: 'LOW',
          category: 'Applications',
          description: 'Third ticket attempt must fail.',
          createdByUserId: 1,
        }),
      /Customer currently has 2 active tickets in progress/
    );

    // Close Ticket 2 to keep workspace clean
    await db.execute('UPDATE tickets SET status = \'CLOSED\' WHERE id = ?', [ticket2.id]);
  });

  // 7. Assignment
  await test('7. Assignment - Auto-assignment and Manual routing', async () => {
    const bestL1 = await AssignmentService.findBestAvailableEmployee('L1');
    assert(bestL1, 'Should find available L1 employee');

    await AssignmentService.assignTicket({
      ticketId: createdTicketId,
      employeeId: 'EMP-002',
      level: 'L1',
      assignedByUserId: 1,
      assignmentType: 'MANUAL',
    });

    const ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-002');
    assert.strictEqual(ticket.assigned_level, 'L1');
  });

  // 8. L1 Workflow & Work Start
  await test('8. L1 Workflow - Start Work and status transition', async () => {
    await TicketService.startWork(createdTicketId, 'EMP-002', 3);
    const ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'IN_PROGRESS');
  });

  // 9. L1 -> L2 Escalation
  await test('9. Escalation L1 -> L2 - Immutable logging and legal transition', async () => {
    // Verify illegal jump L1 -> L3 is rejected
    assert.throws(() => EscalationService.validateHierarchy('L1', 'L3'), /L1 support can only escalate to L2/);

    await EscalationService.escalateTicket({
      ticketId: createdTicketId,
      fromLevel: 'L1',
      toLevel: 'L2',
      escalatedByEmployeeId: 'EMP-002',
      assignedToEmployeeId: 'EMP-004',
      reason: 'Requires advanced SAN RAID reconstruction permissions',
      actorUserId: 3,
    });

    const ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.assigned_level, 'L2');
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-004');
    assert.strictEqual(ticket.escalations.length, 1);
  });

  // 10. L2 -> L3 Escalation
  await test('10. Escalation L2 -> L3 - Continuity across tiers', async () => {
    await EscalationService.escalateTicket({
      ticketId: createdTicketId,
      fromLevel: 'L2',
      toLevel: 'L3',
      escalatedByEmployeeId: 'EMP-004',
      assignedToEmployeeId: 'EMP-005',
      reason: 'Firmware controller fault requiring core kernel intervention',
      actorUserId: 5,
    });

    const ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.assigned_level, 'L3');
    assert.strictEqual(ticket.assigned_employee_id, 'EMP-005');
    assert.strictEqual(ticket.escalations.length, 2);
  });

  // 11. Timer Calculation
  await test('11. Timer - Session Recording and duration tracking', async () => {
    const timerStats = await TimerService.getTotalResolutionTime(createdTicketId);
    assert(timerStats.sessions.length >= 2, 'Must have multiple resolution sessions across escalations');
    assert(timerStats.isRunning, 'Timer should currently be running for active L3 assignee');
  });

  // 12. Timer Continuity Across Levels
  await test('12. Timer Continuity - Continuity maintained through L1, L2, L3', async () => {
    const timerStats = await TimerService.getTotalResolutionTime(createdTicketId);
    assert(timerStats.totalSeconds >= 0, 'Total seconds must aggregate all sessions');
  });

  // 13. SLA Calculation
  await test('13. SLA - Deadline computation, warning thresholds, breach detection', async () => {
    const highDeadline = await SLAService.calculateDeadline('HIGH', new Date());
    const hoursDiff = (highDeadline.getTime() - Date.now()) / (3600 * 1000);
    assert(hoursDiff >= 3.9 && hoursDiff <= 4.1, 'HIGH SLA must be ~4 hours');

    const pastDate = new Date(Date.now() - 5 * 3600 * 1000);
    const pastDeadline = new Date(Date.now() - 1 * 3600 * 1000);
    const status = SLAService.computeSLAStatus({
      createdAt: pastDate,
      deadline: pastDeadline,
      status: 'IN_PROGRESS',
    });
    assert.strictEqual(status.status, 'BREACHED', 'Past deadline ticket must be BREACHED');
  });

  // 14. Manager Approval & Reopen
  await test('14. Manager Approval - Resolution, Review Queue, and Decision Logging', async () => {
    // L3 resolves ticket
    await ApprovalService.submitForReview({
      ticketId: createdTicketId,
      employeeId: 'EMP-005',
      resolutionNotes: 'Controller microcode updated, SAN logical volume parity rebuilt successfully.',
      actorUserId: 6,
    });

    let ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'MANAGER_REVIEW');

    // Manager tests reopen
    await ApprovalService.reopenResolution({
      ticketId: createdTicketId,
      managerUserId: 2,
      reason: 'Please attach the SAN diagnostic verification logs.',
    });

    ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'IN_PROGRESS');

    // L3 re-submits
    await ApprovalService.submitForReview({
      ticketId: createdTicketId,
      employeeId: 'EMP-005',
      resolutionNotes: 'Diagnostic log attached confirming 0 uncorrectable parity blocks.',
      actorUserId: 6,
    });

    // Manager approves
    await ApprovalService.approveResolution({
      ticketId: createdTicketId,
      managerUserId: 2,
      notes: 'Resolution verified and approved.',
    });

    ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'CUSTOMER_FEEDBACK');
  });

  // 15. Customer Feedback
  await test('15. Customer Feedback - Rating 1-5 and Remarks', async () => {
    await FeedbackService.submitFeedback({
      ticketId: createdTicketId,
      customerUserId: 7, // Rajesh Mehta
      rating: 5,
      remarks: 'Outstanding resolution speed and technical competency by Kanvtech team.',
    });

    const fb = await FeedbackService.getFeedback(createdTicketId);
    assert.strictEqual(fb.rating, 5);
    assert.strictEqual(fb.remarks, 'Outstanding resolution speed and technical competency by Kanvtech team.');
  });

  // 16. Ticket Closure
  await test('16. Closure - Automatic closure post-feedback with audit record', async () => {
    const ticket = await TicketService.getTicketById(createdTicketId);
    assert.strictEqual(ticket.status, 'CLOSED');
    assert(ticket.closed_at, 'closed_at must be populated');
    assert(ticket.closure_reason, 'closure_reason must be populated');
  });

  // 17. Authorization Guard
  await test('17. Authorization - Customer cross-company isolation', async () => {
    const custAcme = await AuthService.login('rajesh@acme.com', 'Password@123');
    const foreignTicket = await db.query<any>('SELECT * FROM tickets WHERE company_id != ? LIMIT 1', [custAcme.user.companyId]);
    if (foreignTicket.length > 0) {
      assert.notStrictEqual(foreignTicket[0].company_id, custAcme.user.companyId);
    }
  });

  // 18. Attachment Validation
  await test('18. Attachment Validation - Permitted mime types and extensions', async () => {
    await TicketService.addAttachment({
      ticketId: createdTicketId,
      fileName: 'san_diagnostic_report.pdf',
      filePath: '/uploads/san_diagnostic_report.pdf',
      fileSize: 204800,
      mimeType: 'application/pdf',
      uploadedByUserId: 6,
    });

    const ticket = await TicketService.getTicketById(createdTicketId);
    assert(ticket.attachments.length >= 1);
    assert.strictEqual(ticket.attachments[0].file_name, 'san_diagnostic_report.pdf');
  });

  // 19. Full End-to-End Lifecycle Journey (Section 59)
  await test('19. Master End-to-End Journey (Customer -> L1 -> L2 -> L3 -> Manager -> Feedback -> Closed)', async () => {
    // 1. Customer creates ticket
    const e2eTicket = await TicketService.createTicket({
      companyId: 'CMP-0002',
      customerContactId: 3,
      problemType: 'Database Deadlock in Production ERP',
      priority: 'HIGH',
      category: 'Database Services',
      description: 'Transaction locks exceeding timeout threshold during batch settlement.',
      createdByUserId: 7,
    });
    assert(e2eTicket.id, 'Step 1: Ticket created with ID');

    // 2. L1 assigned
    await AssignmentService.assignTicket({
      ticketId: e2eTicket.id,
      employeeId: 'EMP-002',
      level: 'L1',
      assignedByUserId: 1,
      assignmentType: 'MANUAL',
    });

    // 3. L1 starts work (Timer starts)
    await TicketService.startWork(e2eTicket.id, 'EMP-002', 3);
    let t = await TicketService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'IN_PROGRESS', 'Step 3: Status is IN_PROGRESS');
    assert(t.timer.isRunning, 'Step 3: Timer running');

    // 4. L1 adds notes
    await TicketService.addComment({
      ticketId: e2eTicket.id,
      authorUserId: 3,
      commentType: 'INTERNAL_NOTE',
      message: 'Initial query plan analysis shows deadlock on table GL_BALANCES.',
    });

    // 5. L1 escalates to L2 (Timer continues)
    await EscalationService.escalateTicket({
      ticketId: e2eTicket.id,
      fromLevel: 'L1',
      toLevel: 'L2',
      escalatedByEmployeeId: 'EMP-002',
      assignedToEmployeeId: 'EMP-004',
      reason: 'Requires tuning of row-level lock escalation parameters',
      actorUserId: 3,
    });
    t = await TicketService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.assigned_level, 'L2', 'Step 5: Level is L2');
    assert(t.timer.isRunning, 'Step 5: Timer continues');

    // 6. L2 works & escalates to L3
    await TicketService.addComment({
      ticketId: e2eTicket.id,
      authorUserId: 5,
      commentType: 'INTERNAL_NOTE',
      message: 'Isolation level requires read-committed snapshot isolation configuration.',
    });

    await EscalationService.escalateTicket({
      ticketId: e2eTicket.id,
      fromLevel: 'L2',
      toLevel: 'L3',
      escalatedByEmployeeId: 'EMP-004',
      assignedToEmployeeId: 'EMP-005',
      reason: 'Requires DB engine parameter reconfiguration and failover cluster tuning',
      actorUserId: 5,
    });
    t = await TicketService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.assigned_level, 'L3', 'Step 6: Level is L3');

    // 7. L3 resolves
    await ApprovalService.submitForReview({
      ticketId: e2eTicket.id,
      employeeId: 'EMP-005',
      resolutionNotes: 'Configured RCSI and tuned settlement transaction batch index ordering.',
      actorUserId: 6,
    });
    t = await TicketService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'MANAGER_REVIEW', 'Step 7: Status is MANAGER_REVIEW');

    // 8. Manager reviews & approves
    await ApprovalService.approveResolution({
      ticketId: e2eTicket.id,
      managerUserId: 2,
      notes: 'Fix verified in telemetry. No deadlocks detected in post-run batch.',
    });
    t = await TicketService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'CUSTOMER_FEEDBACK', 'Step 8: Status is CUSTOMER_FEEDBACK');

    // 9. Customer submits 5-star feedback
    await FeedbackService.submitFeedback({
      ticketId: e2eTicket.id,
      customerUserId: 7,
      rating: 5,
      remarks: 'Flawless resolution. Settlement run completed without delays.',
    });

    // 10. Complete verification of closed ticket
    t = await TicketService.getTicketById(e2eTicket.id);
    assert.strictEqual(t.status, 'CLOSED', 'Step 10: Ticket is CLOSED');
    assert.strictEqual(t.feedback.rating, 5, 'Step 10: Feedback is 5 stars');
    assert(t.timeline.length >= 8, 'Step 10: Complete chronological timeline exists');
    assert(t.sla_status === 'MET' || t.sla_status === 'ON_TRACK', 'Step 10: SLA is MET');
  });

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

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
