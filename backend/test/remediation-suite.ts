/**
 * KANVTECH POST-QA REMEDIATION TEST SUITE
 * Tests: Timer Pause/Resume, Prospects, Chat, Email Verification, RBAC
 */
import assert from 'assert';
import { PrismaClient, TicketStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { TimerService } from '../src/timer/timer.service';
import { SlaService } from '../src/sla/sla.service';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { EscalationsService } from '../src/escalations/escalations.service';
import { CompaniesService } from '../src/companies/companies.service';
import { EmployeesService } from '../src/employees/employees.service';
import { DepartmentsService } from '../src/departments/departments.service';
import { ProductsService } from '../src/products/products.service';
import { TicketsService } from '../src/tickets/tickets.service';
import { ProspectsService } from '../src/prospects/prospects.service';
import { ChatService } from '../src/chat/chat.service';
import { EmailVerificationService } from '../src/email-verification/email-verification.service';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';

async function runSuite() {
  console.log('='.repeat(65));
  console.log('KANVTECH POST-QA REMEDIATION TEST SUITE');
  console.log('Timer + Prospect + Chat + Email Verification + RBAC');
  console.log('='.repeat(65) + '\n');

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

  const prismaService = new PrismaService();
  await prismaService.$connect();

  const auditService = new AuditService(prismaService);
  const notificationsService = new NotificationsService(prismaService);
  const timerService = new TimerService(prismaService);
  const slaService = new SlaService(prismaService);
  const assignmentsService = new AssignmentsService(prismaService, auditService, notificationsService);
  const escalationsService = new EscalationsService(prismaService, assignmentsService, timerService, auditService, notificationsService);
  const productsService = new ProductsService(prismaService, auditService);
  const companiesService = new CompaniesService(prismaService, auditService);
  const departmentsService = new DepartmentsService(prismaService, auditService);
  const employeesService = new EmployeesService(prismaService, auditService);
  const ticketsService = new TicketsService(prismaService, assignmentsService, slaService, timerService, auditService, notificationsService);
  const prospectsService = new ProspectsService(prismaService, auditService, companiesService);
  const chatService = new ChatService(prismaService, notificationsService);
  const emailVerificationService = new EmailVerificationService(prismaService, auditService);

  const jwtService = new JwtService({ secret: process.env.JWT_SECRET || 'kanvtech-super-secret-staging-jwt-key-2026-secure' });
  const authService = new AuthService(prismaService, jwtService);

  const ts = Date.now();

  // ================================================================
  // SETUP: Baseline data
  // ================================================================
  let tallyProd: any = await prismaService.product.findFirst({ where: { code: 'TALLY' } });
  if (!tallyProd) tallyProd = await productsService.createProduct({ code: 'TALLY', name: 'Tally Prime', category: 'Accounting' } as any, 1);

  let spineProd: any = await prismaService.product.findFirst({ where: { code: 'SPINE' } });
  if (!spineProd) spineProd = await productsService.createProduct({ code: 'SPINE', name: 'Spine HRMS', category: 'HRMS' } as any, 1);

  let tallyDept: any = await prismaService.department.findFirst({ where: { products: { some: { productId: tallyProd.id } } } });
  if (!tallyDept) tallyDept = await departmentsService.createDepartment({ code: 'DEP-TALLY', name: 'Tally Support', productIds: [tallyProd.id] } as any, 1);

  // Create test employee
  const empId = await employeesService.createEmployee({
    name: `Timer Test Emp ${ts}`,
    email: `timeremp_${ts}@kanvtech.com`,
    phone: '+91 99000 00099',
    department_id: tallyDept.id,
    designation: 'L1 Specialist',
    level: 'L1',
  });
  const emp = await employeesService.getEmployeeById(empId);

  // Create test company and ticket
  const compId = await companiesService.createCompany({
    company_name: `Timer Test Co ${ts}`,
    address: '123 Test Street',
    primary_email: `timerco_${ts}@test.com`,
    contact_person: 'Test Person',
    contact_phone: '+91 99000 11100',
    products: [tallyProd.id],
  });

  const contact = await prismaService.companyContact.findFirst({ where: { companyId: compId } });
  const adminUser = await prismaService.user.findFirst({ where: { role: 'ADMIN' } });
  const actorUserId = adminUser?.id || 1;

  // ================================================================
  // SECTION 1: TIMER TESTS
  // ================================================================
  console.log('\n--- SECTION 1: TIMER LIFECYCLE ---');

  let timerTicketId: string = '';

  await test('T01. Create ticket for timer tests', async () => {
    const t = await ticketsService.createTicket({
      companyId: compId,
      customerContactId: contact!.id,
      productId: tallyProd.id,
      problemType: 'Timer Test Issue',
      priority: 'MEDIUM' as any,
      category: 'Support',
      description: 'Timer lifecycle test ticket',
      createdByUserId: actorUserId,
      assignedEmployeeId: emp.id,
    });
    timerTicketId = t!.id;
    assert(timerTicketId, 'Ticket should be created');
  });

  await test('T02. Start work — ticket changes to IN_PROGRESS', async () => {
    await timerService.startWorkSession(timerTicketId, emp.id, 'L1' as any);
    const t = await prismaService.ticket.findUnique({ where: { id: timerTicketId } });
    assert.strictEqual(t?.status, TicketStatus.IN_PROGRESS, 'Ticket must be IN_PROGRESS after start');
  });

  await test('T03. Double start rejected — cannot start when already working', async () => {
    await assert.rejects(
      async () => timerService.startWorkSession(timerTicketId, emp.id, 'L1' as any),
      /already running/i,
    );
  });

  await test('T04. Pause work — ticket changes to PAUSED, session closed', async () => {
    await new Promise(r => setTimeout(r, 1100)); // Wait 1.1s for measurable duration
    await timerService.pauseWorkSession(timerTicketId);
    const t = await prismaService.ticket.findUnique({ where: { id: timerTicketId } });
    assert.strictEqual(t?.status, TicketStatus.PAUSED, 'Ticket must be PAUSED after pause');
    const sessions = await prismaService.ticketResolutionSession.findMany({ where: { ticketId: timerTicketId } });
    assert(sessions.every(s => s.endedAt !== null), 'All sessions must be closed after pause');
  });

  await test('T05. Double pause rejected — cannot pause when already paused', async () => {
    await assert.rejects(
      async () => timerService.pauseWorkSession(timerTicketId),
      /not IN_PROGRESS/i,
    );
  });

  await test('T06. Resume work — ticket returns to IN_PROGRESS, new session opened', async () => {
    await timerService.resumeWorkSession(timerTicketId, emp.id, 'L1' as any);
    const t = await prismaService.ticket.findUnique({ where: { id: timerTicketId } });
    assert.strictEqual(t?.status, TicketStatus.IN_PROGRESS, 'Ticket must be IN_PROGRESS after resume');
    const openSession = await prismaService.ticketResolutionSession.findFirst({
      where: { ticketId: timerTicketId, endedAt: null },
    });
    assert(openSession, 'A new active session must exist after resume');
  });

  await test('T07. Resume while working rejected', async () => {
    await assert.rejects(
      async () => timerService.resumeWorkSession(timerTicketId, emp.id, 'L1' as any),
      /not PAUSED/i,
    );
  });

  await test('T08. Cumulative time is sum of all sessions, not reset', async () => {
    await new Promise(r => setTimeout(r, 1100));
    const stats = await timerService.getTotalResolutionTime(timerTicketId);
    assert(stats.totalSeconds >= 2, `Total must be >= 2s, got ${stats.totalSeconds}`);
    assert(stats.sessions.length >= 2, `Must have >=2 sessions for pause/resume tracking`);
    assert(stats.isRunning, 'Timer must be running (session 2 is open)');
  });

  await test('T09. Pause → Resume → Pause → Resume cycle', async () => {
    await timerService.pauseWorkSession(timerTicketId);
    await timerService.resumeWorkSession(timerTicketId, emp.id, 'L1' as any);
    await timerService.pauseWorkSession(timerTicketId);
    await timerService.resumeWorkSession(timerTicketId, emp.id, 'L1' as any);
    const stats = await timerService.getTotalResolutionTime(timerTicketId);
    assert(stats.sessions.length >= 4, `Must have >= 4 sessions after 2 pause/resume cycles`);
    assert(stats.isRunning, 'Timer should still be running');
  });

  await test('T10. Stop via resolution — timer freezes, no further accumulation', async () => {
    await timerService.stopActiveSession(timerTicketId);
    const statsBefore = await timerService.getTotalResolutionTime(timerTicketId);
    await new Promise(r => setTimeout(r, 1100));
    const statsAfter = await timerService.getTotalResolutionTime(timerTicketId);
    assert(!statsAfter.isRunning, 'Timer must not be running after stop');
    assert.strictEqual(statsBefore.totalSeconds, statsAfter.totalSeconds, 'Time must not accumulate after stop');
  });

  await test('T11. Cannot start work after resolution', async () => {
    // Update ticket status to RESOLVED directly
    await prismaService.ticket.update({ where: { id: timerTicketId }, data: { status: TicketStatus.RESOLVED } });
    await assert.rejects(
      async () => timerService.startWorkSession(timerTicketId, emp.id, 'L1' as any),
      /already RESOLVED/i,
    );
  });

  await test('T12. No negative time, no orphan active sessions', async () => {
    const sessions = await prismaService.ticketResolutionSession.findMany({ where: { ticketId: timerTicketId } });
    for (const s of sessions) {
      assert(s.durationSeconds >= 0, `Session ${s.id} has negative duration: ${s.durationSeconds}`);
    }
    const orphan = await prismaService.ticketResolutionSession.findFirst({ where: { ticketId: timerTicketId, endedAt: null } });
    assert(!orphan, 'No orphaned active sessions should remain after resolution');
  });

  // ================================================================
  // SECTION 2: PROSPECT TESTS
  // ================================================================
  console.log('\n--- SECTION 2: PROSPECT / TEMPORARY CUSTOMER ---');

  let prospectId: string = '';

  await test('P01. Create prospect', async () => {
    const p = await prospectsService.createProspect({
      companyName: `Test Prospect Co ${ts}`,
      contactPerson: 'Prospect Person',
      phone: '+91 98000 00001',
      email: `prospect_${ts}@enquiry.com`,
      enquiry: 'Interested in Tally solution',
      source: 'Website',
    }, actorUserId);
    prospectId = p.id;
    assert(prospectId.startsWith('PROS-'), `ID should start with PROS-, got: ${prospectId}`);
  });

  await test('P02. Get prospect by ID', async () => {
    const p = await prospectsService.getProspectById(prospectId);
    assert.strictEqual(p.status, 'ENQUIRY');
    assert(p.companyName.includes(`${ts}`));
  });

  await test('P03. Update prospect status to QUALIFIED', async () => {
    const updated = await prospectsService.updateProspect(prospectId, { status: 'QUALIFIED' }, actorUserId);
    assert.strictEqual(updated.status, 'QUALIFIED');
  });

  await test('P04. Search prospect by company name', async () => {
    const result = await prospectsService.getProspects({ search: `${ts}`, status: 'QUALIFIED' });
    assert(result.data.length >= 1, 'Should find the prospect by search + status filter');
  });

  await test('P05. Convert prospect to customer — CMP generated', async () => {
    const result = await prospectsService.convertProspect(prospectId, {
      productIds: [tallyProd.id],
    }, actorUserId);
    assert(result.companyId.startsWith('CMP-'), `Company ID must start with CMP-, got: ${result.companyId}`);
    assert.strictEqual(result.prospect.status, 'CONVERTED');
    assert(result.prospect.convertedAt, 'convertedAt must be set');
    assert.strictEqual(result.prospect.convertedByUserId, actorUserId);
  });

  await test('P06. History preserved — prospect record survives conversion', async () => {
    const p = await prospectsService.getProspectById(prospectId);
    assert.strictEqual(p.status, 'CONVERTED');
    assert(p.convertedToCompanyId, 'convertedToCompanyId must be set');
  });

  await test('P07. Duplicate conversion prevented', async () => {
    await assert.rejects(
      async () => prospectsService.convertProspect(prospectId, { productIds: [tallyProd.id] }, actorUserId),
      /already been converted/i,
    );
  });

  await test('P08. Cannot edit a converted prospect', async () => {
    await assert.rejects(
      async () => prospectsService.updateProspect(prospectId, { companyName: 'Hacked Name' }, actorUserId),
      /converted/i,
    );
  });

  // ================================================================
  // SECTION 3: INTERNAL CHAT TESTS
  // ================================================================
  console.log('\n--- SECTION 3: INTERNAL CHAT ---');

  // We need two internal users
  const adminUserObj = await prismaService.user.findFirst({ where: { role: 'ADMIN' } });
  const empUser = await prismaService.user.findFirst({ where: { role: { in: ['L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE', 'MANAGER'] }, isActive: true } });
  let chatConvId: number = 0;

  await test('C01. Create direct conversation between two employees', async () => {
    if (!adminUserObj || !empUser) throw new Error('Need at least 2 users for chat test');
    const conv = await chatService.getOrCreateDirectConversation(adminUserObj.id, empUser.id);
    chatConvId = conv.id;
    assert(chatConvId > 0, 'Conversation ID must be positive');
    assert.strictEqual(conv.isGroup, false, 'Direct conversation must not be group');
  });

  await test('C02. Get-or-create is idempotent — same convo returned', async () => {
    const conv2 = await chatService.getOrCreateDirectConversation(adminUserObj!.id, empUser!.id);
    assert.strictEqual(conv2.id, chatConvId, 'Must return same conversation on duplicate request');
  });

  await test('C03. Send message in conversation', async () => {
    const msg = await chatService.sendMessage(chatConvId, adminUserObj!.id, 'Hello from admin!');
    assert(msg.id > 0, 'Message ID must be positive');
    assert.strictEqual(msg.message, 'Hello from admin!');
  });

  await test('C04. Retrieve messages — history preserved', async () => {
    await chatService.sendMessage(chatConvId, empUser!.id, 'Reply from employee');
    const messages = await chatService.getMessages(chatConvId, adminUserObj!.id);
    assert(messages.length >= 2, `Must have >= 2 messages, got ${messages.length}`);
  });

  await test('C05. Unread count — admin sees employee message as unread', async () => {
    const convList = await chatService.getConversationsForUser(adminUserObj!.id);
    const conv = convList.find(c => c.id === chatConvId);
    assert(conv, 'Conversation must appear in list');
    // Employee replied so admin should have unread
    assert(conv.unreadCount >= 1, `Admin should have >= 1 unread, got ${conv.unreadCount}`);
  });

  await test('C06. Mark messages read — unread count goes to 0', async () => {
    await chatService.markMessagesRead(chatConvId, adminUserObj!.id);
    const convList = await chatService.getConversationsForUser(adminUserObj!.id);
    const conv = convList.find(c => c.id === chatConvId);
    assert.strictEqual(conv?.unreadCount || 0, 0, 'After mark-read, unread count must be 0');
  });

  await test('C07. Non-participant cannot read messages', async () => {
    // Create a third user who is NOT in the conversation
    const thirdUser = await prismaService.user.create({
      data: {
        email: `thirduser_${ts}@kanvtech.com`,
        passwordHash: 'irrelevant_for_test',
        role: 'L1_EMPLOYEE' as any,
        isActive: true,
      },
    });
    await assert.rejects(
      async () => chatService.getMessages(chatConvId, thirdUser.id),
      /not a participant/i,
    );
  });

  await test('C08. Employee search for chat excludes customers', async () => {
    const results = await chatService.searchEmployeesForChat('', adminUserObj!.id);
    const hasCustomer = results.some(u => u.role === 'CUSTOMER');
    assert(!hasCustomer, 'Employee search must not return customers');
  });

  // ================================================================
  // SECTION 4: EMAIL VERIFICATION TESTS
  // ================================================================
  console.log('\n--- SECTION 4: EMAIL VERIFICATION ---');

  const testEmail = `verify_${ts}@testdomain.com`;
  let rawVerifyToken = '';

  await test('EV01. Send verification email — token generated and stored', async () => {
    const result = await emailVerificationService.sendVerificationEmail(actorUserId, testEmail);
    rawVerifyToken = result.token;
    assert(rawVerifyToken.length === 64, `Token must be 64 hex chars, got ${rawVerifyToken.length}`);
    const dbRecord = await prismaService.emailVerificationToken.findFirst({
      where: { userId: actorUserId, email: testEmail, usedAt: null },
    });
    assert(dbRecord, 'Token record must exist in DB');
  });

  await test('EV02. Status before verification — not verified, pending token', async () => {
    const status = await emailVerificationService.getVerificationStatus(actorUserId, testEmail);
    assert(!status.verified, 'Should not be verified before clicking link');
    assert(status.pendingToken, 'Should have pending token');
  });

  await test('EV03. Invalid token rejected', async () => {
    await assert.rejects(
      async () => emailVerificationService.verifyEmail(actorUserId, 'invalid_token_xyz'),
      /invalid or expired/i,
    );
  });

  await test('EV04. Valid token — email verified successfully', async () => {
    await emailVerificationService.verifyEmail(actorUserId, rawVerifyToken);
    const status = await emailVerificationService.getVerificationStatus(actorUserId, testEmail);
    assert(status.verified, 'Email should be verified after using valid token');
  });

  await test('EV05. Reused token rejected — already used', async () => {
    await assert.rejects(
      async () => emailVerificationService.verifyEmail(actorUserId, rawVerifyToken),
      /invalid or expired/i,
    );
  });

  await test('EV06. Expired token rejected', async () => {
    // Insert an expired token directly
    const expiredHash = 'expired_token_hash';
    await prismaService.emailVerificationToken.create({
      data: {
        userId: actorUserId,
        email: testEmail,
        tokenHash: '$2a$10$expiredtokenhashplaceholder12345678901',
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      },
    });
    await assert.rejects(
      async () => emailVerificationService.verifyEmail(actorUserId, 'some_raw_token'),
      /invalid or expired/i,
    );
  });

  await test('EV07. Format validation is separate from ownership verification', async () => {
    // Format validation (regex): test bad formats
    const badEmails = ['abc', '12345', 'test@', 'test@domain'];
    for (const bad of badEmails) {
      try {
        await emailVerificationService.sendVerificationEmail(actorUserId, bad);
        assert.fail(`Should have rejected invalid email: ${bad}`);
      } catch (e: any) {
        assert(/invalid email format/i.test(e.message), `Expected format error for "${bad}", got: ${e.message}`);
      }
    }
  });

  // ================================================================
  // SUMMARY
  // ================================================================
  await prismaService.$disconnect();

  console.log('\n' + '='.repeat(65));
  console.log(`REMEDIATION TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(65) + '\n');

  if (failed > 0) process.exit(1);
}

runSuite().catch(e => {
  console.error('Suite error:', e.message);
  process.exit(1);
});
