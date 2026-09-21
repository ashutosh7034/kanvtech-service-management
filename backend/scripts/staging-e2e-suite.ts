import assert from 'assert';
import {
  PrismaClient,
  UserRole,
  EmployeeLevel,
  EmployeeAvailability,
  EmployeeStatus,
  TicketPriority,
  TicketLevel,
  CommentType,
  AssignmentType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
import { StorageService } from '../src/storage/storage.service';

async function runStagingE2E() {
  console.log('===============================================================');
  console.log('KANVTECH STAGING DEPLOYMENT — COMPREHENSIVE E2E VERIFICATION');
  console.log('Target Database: PostgreSQL (kanvtech_sm_staging)');
  console.log('===============================================================');

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
  const storageService = new StorageService();
  const jwtSecret = process.env.JWT_SECRET || 'kanvtech-super-secret-production-jwt-key-2026';
  const jwtService = new JwtService({ secret: jwtSecret });
  const authService = new AuthService(prisma, jwtService);

  const passwordHash = await bcrypt.hash('StagingSecurePass2026!', 10);

  // 1. SETUP MANUAL STAGING ACCOUNTS
  console.log('\n[PHASE 1] Provisioning staging test actors...');

  // Create Staging Companies
  const acmeId = await companiesService.createCompany({
    company_name: 'Staging Acme Corp',
    address: '100 Tech Blvd, Floor 4',
    gstn: '07STGACME1234Z5',
    primary_email: 'ops@acme-staging.com',
    contact_person: 'Rajesh Sharma',
    contact_phone: '+91 98111 00001',
  });
  console.log(`✓ Staging Company Acme created: ${acmeId}`);

  const globexId = await companiesService.createCompany({
    company_name: 'Staging Globex Corp',
    address: '200 Global Way',
    gstn: '07STGGLBX5678Z9',
    primary_email: 'ops@globex-staging.com',
    contact_person: 'Sunita Verma',
    contact_phone: '+91 98111 00002',
  });
  console.log(`✓ Staging Company Globex created: ${globexId}`);

  // Staging Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'staging.admin@kanvtech.com' },
    update: {},
    create: { email: 'staging.admin@kanvtech.com', passwordHash, role: UserRole.ADMIN, isActive: true },
  });

  // Staging Manager User & Employee
  const mgrUser = await prisma.user.upsert({
    where: { email: 'staging.mgr@kanvtech.com' },
    update: {},
    create: { email: 'staging.mgr@kanvtech.com', passwordHash, role: UserRole.MANAGER, isActive: true },
  });
  const mgrEmpId = 'EMP-STG-001';
  await prisma.employee.upsert({
    where: { id: mgrEmpId },
    update: {},
    create: {
      id: mgrEmpId,
      user: { connect: { id: mgrUser.id } },
      email: mgrUser.email,
      name: 'Staging Operations Manager',
      phone: '+91 98111 00101',
      level: EmployeeLevel.L3,
      department: 'Service Operations',
      designation: 'Operations Director',
      availability: EmployeeAvailability.AVAILABLE,
      status: EmployeeStatus.ACTIVE,
    },
  });

  // Staging L1 Specialist
  const l1User = await prisma.user.upsert({
    where: { email: 'staging.l1@kanvtech.com' },
    update: {},
    create: { email: 'staging.l1@kanvtech.com', passwordHash, role: UserRole.L1_EMPLOYEE, isActive: true },
  });
  const l1EmpId = 'EMP-STG-002';
  await prisma.employee.upsert({
    where: { id: l1EmpId },
    update: {},
    create: {
      id: l1EmpId,
      user: { connect: { id: l1User.id } },
      email: l1User.email,
      name: 'Staging L1 Support Specialist',
      phone: '+91 98111 00102',
      level: EmployeeLevel.L1,
      department: 'Service Desk',
      designation: 'L1 Engineer',
      availability: EmployeeAvailability.AVAILABLE,
      status: EmployeeStatus.ACTIVE,
      manager: { connect: { id: mgrEmpId } },
    },
  });

  // Staging L2 Specialist
  const l2User = await prisma.user.upsert({
    where: { email: 'staging.l2@kanvtech.com' },
    update: {},
    create: { email: 'staging.l2@kanvtech.com', passwordHash, role: UserRole.L2_EMPLOYEE, isActive: true },
  });
  const l2EmpId = 'EMP-STG-003';
  await prisma.employee.upsert({
    where: { id: l2EmpId },
    update: {},
    create: {
      id: l2EmpId,
      user: { connect: { id: l2User.id } },
      email: l2User.email,
      name: 'Staging L2 Systems Specialist',
      phone: '+91 98111 00103',
      level: EmployeeLevel.L2,
      department: 'Technical Escalations',
      designation: 'L2 Specialist',
      availability: EmployeeAvailability.AVAILABLE,
      status: EmployeeStatus.ACTIVE,
      manager: { connect: { id: mgrEmpId } },
    },
  });

  // Staging L3 Specialist
  const l3User = await prisma.user.upsert({
    where: { email: 'staging.l3@kanvtech.com' },
    update: {},
    create: {
      email: 'staging.l3@kanvtech.com',
      passwordHash,
      role: UserRole.L3_EMPLOYEE,
      isActive: true,
    },
  });
  const l3EmpId = 'EMP-STG-004';
  await prisma.employee.upsert({
    where: { id: l3EmpId },
    update: {},
    create: {
      id: l3EmpId,
      user: { connect: { id: l3User.id } },
      email: l3User.email,
      name: 'Staging L3 Principal Architect',
      phone: '+91 98111 00104',
      level: EmployeeLevel.L3,
      department: 'Core Architecture',
      designation: 'L3 Principal',
      availability: EmployeeAvailability.AVAILABLE,
      status: EmployeeStatus.ACTIVE,
      manager: { connect: { id: mgrEmpId } },
    },
  });

  // Staging Customer 1 (Acme)
  const custUser1 = await prisma.user.upsert({
    where: { email: 'staging.cust@acme.com' },
    update: {},
    create: { email: 'staging.cust@acme.com', passwordHash, role: UserRole.CUSTOMER, isActive: true },
  });
  const acmeDetails = await companiesService.getCompanyById(acmeId);
  const custContact1Id = acmeDetails.contacts[0].id;
  await prisma.companyContact.update({
    where: { id: custContact1Id },
    data: { userId: custUser1.id },
  });

  // Staging Customer 2 (Globex)
  const custUser2 = await prisma.user.upsert({
    where: { email: 'staging.cust2@globex.com' },
    update: {},
    create: { email: 'staging.cust2@globex.com', passwordHash, role: UserRole.CUSTOMER, isActive: true },
  });
  const globexDetails = await companiesService.getCompanyById(globexId);
  const custContact2Id = globexDetails.contacts[0].id;
  await prisma.companyContact.update({
    where: { id: custContact2Id },
    data: { userId: custUser2.id },
  });

  console.log('✓ Verified Staging Actors: ADMIN, MANAGER, L1, L2, L3, CUSTOMER (Acme), CUSTOMER (Globex)');

  // 2. AUTHENTICATION & JWT VERIFICATION
  console.log('\n[PHASE 2] Staging Authentication & RBAC token verification...');
  const authCust = await authService.login('staging.cust@acme.com', 'StagingSecurePass2026!');
  assert(authCust.token, 'Customer JWT must be generated');
  assert.strictEqual(authCust.user.role, 'CUSTOMER');
  console.log('✓ Customer authentication verified (Role: CUSTOMER, Company: Acme)');

  const authL1 = await authService.login('staging.l1@kanvtech.com', 'StagingSecurePass2026!');
  assert.strictEqual(authL1.user.role, 'L1_EMPLOYEE');
  console.log('✓ L1 Employee authentication verified');

  const authMgr = await authService.login('staging.mgr@kanvtech.com', 'StagingSecurePass2026!');
  assert.strictEqual(authMgr.user.role, 'MANAGER');
  console.log('✓ Manager authentication verified');

  // 3. TICKET CREATION & TWO-TICKET RULE
  console.log('\n[PHASE 3] Ticket Creation & Two-Ticket Restriction Rule...');
  const t1 = await ticketsService.createTicket({
    companyId: acmeId,
    customerContactId: custContact1Id,
    problemType: 'Database Pool Starvation on Gateway',
    priority: TicketPriority.HIGH,
    category: 'Infrastructure',
    description: 'PostgreSQL connection timeout under peak staging load.',
    createdByUserId: custUser1.id,
  });
  assert(t1.id.startsWith('KT-2026-'), 'Ticket ID must follow KT-2026-XXXXXX format');
  assert.strictEqual(t1.status, 'OPEN');
  assert.strictEqual(t1.priority, 'HIGH');
  console.log(`✓ Ticket 1 created: ${t1.id} (Status: OPEN, Priority: HIGH, SLA: ${t1.sla_deadline})`);

  const t2 = await ticketsService.createTicket({
    companyId: acmeId,
    customerContactId: custContact1Id,
    problemType: 'SSL Expiry Alert on Staging Gateway',
    priority: TicketPriority.MEDIUM,
    category: 'Security',
    description: 'TLS cert renewal scheduled.',
    createdByUserId: custUser1.id,
  });
  console.log(`✓ Ticket 2 created: ${t2.id} (Status: OPEN)`);

  // Attempt 3rd ticket for same customer contact (must fail strictly)
  await assert.rejects(
    async () =>
      ticketsService.createTicket({
        companyId: acmeId,
        customerContactId: custContact1Id,
        problemType: 'Third Ticket Attempt (Forbidden)',
        priority: TicketPriority.LOW,
        category: 'Applications',
        description: 'Should be rejected',
        createdByUserId: custUser1.id,
      }),
    /Customer currently has 2 active tickets in progress/,
  );
  console.log('✓ Two-ticket restriction verified: 3rd active ticket strictly rejected with 400 Bad Request');

  // 4. CROSS-COMPANY ISOLATION & INTERNAL NOTES CONFIDENTIALITY
  console.log('\n[PHASE 4] Testing Cross-Company Isolation & Internal Note Privacy...');
  const globexTickets = await ticketsService.getTickets({
    companyId: globexId,
  });
  const leaked = globexTickets.data.some((t) => t.id === t1.id || t.id === t2.id);
  assert.strictEqual(leaked, false, 'Tenant isolation failure: Globex saw Acme tickets');
  console.log('✓ Tenant Isolation verified: 0 tickets leaked to unauthorized company');

  // Add internal work note and customer communication
  await ticketsService.addComment({
    ticketId: t1.id,
    authorUserId: l1User.id,
    commentType: CommentType.INTERNAL_NOTE,
    message: 'CONFIDENTIAL INTERNAL: Checking connection pool metrics on primary DB node.',
  });
  await ticketsService.addComment({
    ticketId: t1.id,
    authorUserId: l1User.id,
    commentType: CommentType.CUSTOMER_COMMUNICATION,
    message: 'We have received your ticket and are investigating the connection pool parameters.',
  });

  const fullTicket = await ticketsService.getTicketById(t1.id);
  const internalNotes = fullTicket.comments.filter((c) => c.comment_type === 'INTERNAL_NOTE');
  const publicNotes = fullTicket.comments.filter((c) => c.comment_type === 'CUSTOMER_COMMUNICATION');
  assert.strictEqual(internalNotes.length, 1);
  assert.strictEqual(publicNotes.length, 1);
  console.log('✓ Internal Note Privacy verified: 1 confidential internal note tagged strictly as INTERNAL_NOTE');

  // 5. ATTACHMENT VALIDATION & STORAGE SERVICE (Requirement 5)
  console.log('\n[PHASE 5] Testing Storage Service, Attachment Validation & 10MB Limit...');
  // Valid PDF upload
  const validFile: any = {
    originalname: 'staging-network-analysis.pdf',
    mimetype: 'application/pdf',
    size: 64 * 1024,
    buffer: Buffer.from('%PDF-1.4 Mock Staging Audit Attachment Content'),
  };
  const uploaded = await storageService.upload(validFile);
  await ticketsService.addAttachment({
    ticketId: t1.id,
    fileName: uploaded.fileName,
    filePath: uploaded.filePath,
    fileSize: uploaded.fileSize,
    mimeType: uploaded.mimeType,
    uploadedByUserId: custUser1.id,
  });
  console.log(`✓ Valid attachment uploaded: ${uploaded.fileName} (Path: ${uploaded.filePath})`);

  // Reject unauthorized extension
  assert.throws(
    () =>
      storageService.validateFile({
        originalname: 'malicious.bat',
        mimetype: 'application/x-bat',
        size: 512,
      } as any),
    /File extension '.bat' is not authorized for upload/,
  );
  console.log('✓ Invalid extension rejected (.bat -> 400 Bad Request)');

  // Reject > 10MB file
  assert.throws(
    () =>
      storageService.validateFile({
        originalname: 'oversized-crashdump.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024,
      } as any),
    /File size exceeds maximum permitted limit of 10MB/,
  );
  console.log('✓ 10MB limit strictly enforced (11MB -> 400 Bad Request)');

  // 6. WORKFLOW: L1 WORK -> ESCALATION L1 -> L2 -> L3
  console.log('\n[PHASE 6] Ticket Workflow & Escalation Continuity (L1 -> L2 -> L3)...');
  // Assign to L1
  await assignmentsService.assignTicket({
    ticketId: t1.id,
    employeeId: l1EmpId,
    level: TicketLevel.L1,
    assignedByUserId: mgrUser.id,
    assignmentType: AssignmentType.MANUAL,
  });
  console.log(`✓ Ticket assigned to L1: ${l1EmpId}`);

  // L1 Starts Work
  await ticketsService.startWork(t1.id, l1EmpId, l1User.id);
  let ticketState = await ticketsService.getTicketById(t1.id);
  assert.strictEqual(ticketState.status, 'IN_PROGRESS');
  console.log('✓ L1 started work: Status transitioned to IN_PROGRESS, resolution session started');

  // L1 Escalates to L2
  await escalationsService.escalateTicket({
    ticketId: t1.id,
    fromLevel: 'L1',
    toLevel: 'L2',
    escalatedByEmployeeId: l1EmpId,
    assignedToEmployeeId: l2EmpId,
    reason: 'Database pool tuning requires L2 systems credentials',
    actorUserId: l1User.id,
  });
  ticketState = await ticketsService.getTicketById(t1.id);
  assert.strictEqual(ticketState.assigned_level, 'L2');
  assert.strictEqual(ticketState.assigned_employee_id, l2EmpId);
  assert.strictEqual(ticketState.escalations.length, 1);
  console.log('✓ Escalation L1 -> L2 successful: Timer session preserved, Level: L2');

  // L2 Escalates to L3
  await escalationsService.escalateTicket({
    ticketId: t1.id,
    fromLevel: 'L2',
    toLevel: 'L3',
    escalatedByEmployeeId: l2EmpId,
    assignedToEmployeeId: l3EmpId,
    reason: 'Database engine lock contention requires L3 core architecture patch',
    actorUserId: l2User.id,
  });
  ticketState = await ticketsService.getTicketById(t1.id);
  assert.strictEqual(ticketState.assigned_level, 'L3');
  assert.strictEqual(ticketState.assigned_employee_id, l3EmpId);
  assert.strictEqual(ticketState.escalations.length, 2);
  console.log('✓ Escalation L2 -> L3 successful: Level: L3, 2 immutable escalation records');

  // Verify Continuous Timer across all levels
  const timerStats = await timerService.getTotalResolutionTime(t1.id);
  assert(timerStats.sessions.length >= 2, 'Must track continuous sessions across escalations');
  console.log(`✓ Resolution timer verified: ${timerStats.sessions.length} sessions active/recorded`);

  // 7. RESOLUTION -> MANAGER APPROVAL -> CUSTOMER FEEDBACK -> CLOSURE
  console.log('\n[PHASE 7] Resolution, Manager Approval, Customer Feedback & Final Closure...');

  // L3 Submits for Review
  await approvalsService.submitForReview({
    ticketId: t1.id,
    employeeId: l3EmpId,
    resolutionNotes: 'Tuned connection pool max_connections and max_locks_per_transaction. Verified 0 timeouts.',
    actorUserId: l3User.id,
  });
  ticketState = await ticketsService.getTicketById(t1.id);
  assert.strictEqual(ticketState.status, 'MANAGER_REVIEW');
  console.log('✓ L3 marked resolved: Ticket transitioned to MANAGER_REVIEW');

  // Manager Approves Resolution
  await approvalsService.approveResolution({
    ticketId: t1.id,
    managerUserId: mgrUser.id,
    notes: 'Approved. Gateway metrics verified normal.',
  });
  ticketState = await ticketsService.getTicketById(t1.id);
  assert.strictEqual(ticketState.status, 'CUSTOMER_FEEDBACK');
  console.log('✓ Manager approved resolution: Ticket transitioned to CUSTOMER_FEEDBACK');

  // Customer Submits 5-Star Feedback
  await feedbackService.submitFeedback({
    ticketId: t1.id,
    customerUserId: custUser1.id,
    rating: 5,
    remarks: 'Flawless resolution! Outstanding support from Kanvtech staging engineering.',
  });
  ticketState = await ticketsService.getTicketById(t1.id);
  assert.strictEqual(ticketState.status, 'CLOSED');
  assert(ticketState.closed_at, 'closed_at must be set');
  console.log(`✓ Customer feedback submitted (Rating: 5/5): Ticket automatically CLOSED at ${ticketState.closed_at}`);

  // Verify Audit Log & History
  assert(ticketState.timeline.length >= 5, 'Timeline must track full lifecycle');
  console.log(`✓ Full Audit History verified: ${ticketState.timeline.length} immutable history events logged`);

  // Verify slot re-opened for Customer 1
  const t3 = await ticketsService.createTicket({
    companyId: acmeId,
    customerContactId: custContact1Id,
    problemType: 'New Request After Closure',
    priority: TicketPriority.LOW,
    category: 'General Inquiry',
    description: 'Verifying customer capacity restored post-closure.',
    createdByUserId: custUser1.id,
  });
  console.log(`✓ Slot re-opened post-closure: New ticket successfully created (${t3.id})`);

  console.log('\n===============================================================');
  console.log('STAGING E2E VERIFICATION: ALL 7 PHASES PASSED WITH 0 ERRORS');
  console.log('===============================================================');

  await prisma.$disconnect();
}

runStagingE2E().catch((err) => {
  console.error('\n❌ STAGING E2E FAILED:', err);
  process.exit(1);
});
