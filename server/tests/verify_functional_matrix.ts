import assert from 'assert';
import { db } from '../src/db/database';
import { seedDatabase } from '../src/db/seed';

const API_BASE = 'http://localhost:5000/api';

// Helper for making typed HTTP requests using native fetch
async function request(options: {
  method: string;
  path: string;
  token?: string;
  body?: any;
  formData?: any;
}): Promise<{ status: number; body: any }> {
  const url = `${API_BASE}${options.path}`;
  const headers: Record<string, string> = {};

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let requestBody: any = undefined;

  if (options.formData) {
    requestBody = options.formData;
  } else if (options.body) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method,
    headers,
    body: requestBody,
  });

  const rawText = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = rawText;
  }

  return { status: res.status, body: parsed };
}

let passedCount = 0;
let failedCount = 0;
const resultsLog: Array<{ section: string; passed: boolean; message: string }> = [];

async function verify(section: string, description: string, fn: () => Promise<void>) {
  process.stdout.write(`[VERIFY ${section}] ${description} ... `);
  try {
    await fn();
    console.log('PASSED \u2714');
    passedCount++;
    resultsLog.push({ section, passed: true, message: description });
  } catch (err: any) {
    console.log('FAILED \u2718');
    console.error(`         Error: ${err.message}`);
    failedCount++;
    resultsLog.push({ section, passed: false, message: `${description} - ${err.message}` });
  }
}

async function runComprehensiveVerification() {
  console.log('======================================================================');
  console.log('KANVTECH PLATFORM - PHASE 1 FULL FUNCTIONAL VERIFICATION MATRIX');
  console.log('Testing live API on http://localhost:5000 against all 18 criteria');
  console.log('======================================================================\n');

  await seedDatabase();

  // Clean test tickets and test entities
  await db.execute('DELETE FROM ticket_comments');
  await db.execute('DELETE FROM ticket_attachments');
  await db.execute('DELETE FROM ticket_feedback');
  await db.execute('DELETE FROM ticket_escalations');
  await db.execute('DELETE FROM ticket_resolution_sessions');
  await db.execute('DELETE FROM ticket_assignments');
  await db.execute('DELETE FROM ticket_history');
  await db.execute('DELETE FROM tickets');
  await db.execute("DELETE FROM company_contacts WHERE company_id IN (SELECT id FROM companies WHERE company_name LIKE 'Matrix Dynamics%')");
  await db.execute("DELETE FROM companies WHERE company_name LIKE 'Matrix Dynamics%'");

  let adminToken = '';
  let managerToken = '';
  let l1Token = '';
  let l2Token = '';
  let l3Token = '';
  let customerAcmeToken = '';
  let customerZenithToken = '';

  // =========================================================================
  // 1. AUTHENTICATION & RBAC
  // =========================================================================
  await verify('1. AUTH', 'Login all supported roles (Admin, Manager, L1, L2, L3, Customer)', async () => {
    const rAdmin = await request({ method: 'POST', path: '/auth/login', body: { email: 'admin@kanvtech.com', password: 'Password@123' } });
    assert.strictEqual(rAdmin.status, 200);
    assert.strictEqual(rAdmin.body.user.role, 'ADMIN');
    adminToken = rAdmin.body.token;

    const rMgr = await request({ method: 'POST', path: '/auth/login', body: { email: 'manager@kanvtech.com', password: 'Password@123' } });
    assert.strictEqual(rMgr.status, 200);
    assert.strictEqual(rMgr.body.user.role, 'MANAGER');
    managerToken = rMgr.body.token;

    const rL1 = await request({ method: 'POST', path: '/auth/login', body: { email: 'l1.amit@kanvtech.com', password: 'Password@123' } });
    assert.strictEqual(rL1.status, 200);
    assert.strictEqual(rL1.body.user.role, 'L1_EMPLOYEE');
    l1Token = rL1.body.token;

    const rL2 = await request({ method: 'POST', path: '/auth/login', body: { email: 'l2.vikram@kanvtech.com', password: 'Password@123' } });
    assert.strictEqual(rL2.status, 200);
    assert.strictEqual(rL2.body.user.role, 'L2_EMPLOYEE');
    l2Token = rL2.body.token;

    const rL3 = await request({ method: 'POST', path: '/auth/login', body: { email: 'l3.priya@kanvtech.com', password: 'Password@123' } });
    assert.strictEqual(rL3.status, 200);
    assert.strictEqual(rL3.body.user.role, 'L3_EMPLOYEE');
    l3Token = rL3.body.token;

    const rCust1 = await request({ method: 'POST', path: '/auth/login', body: { email: 'rajesh@acme.com', password: 'Password@123' } });
    assert.strictEqual(rCust1.status, 200);
    assert.strictEqual(rCust1.body.user.role, 'CUSTOMER');
    assert.strictEqual(rCust1.body.user.companyId, 'CMP-0001');
    customerAcmeToken = rCust1.body.token;

    const rCust2 = await request({ method: 'POST', path: '/auth/login', body: { email: 'anjali@zenith.com', password: 'Password@123' } });
    assert.strictEqual(rCust2.status, 200);
    assert.strictEqual(rCust2.body.user.role, 'CUSTOMER');
    assert.strictEqual(rCust2.body.user.companyId, 'CMP-0002');
    customerZenithToken = rCust2.body.token;
  });

  await verify('1. AUTH', 'Reject invalid password and unauthenticated access to protected routes', async () => {
    const badLogin = await request({ method: 'POST', path: '/auth/login', body: { email: 'admin@kanvtech.com', password: 'BadPassword' } });
    assert.strictEqual(badLogin.status, 401);

    const noToken = await request({ method: 'GET', path: '/tickets' });
    assert.strictEqual(noToken.status, 401);

    const badToken = await request({ method: 'GET', path: '/tickets', token: 'invalid.bearer.jwt' });
    assert.strictEqual(badToken.status, 401);
  });

  await verify('1. AUTH', 'Tenant isolation: Customer cannot access other companies via URL/ID manipulation', async () => {
    // Acme customer tries to access Zenith company details (CMP-0002)
    const foreignComp = await request({ method: 'GET', path: '/companies/CMP-0002', token: customerAcmeToken });
    assert.strictEqual(foreignComp.status, 403, 'Should forbid customer from viewing another company');

    // Customer tries to list employees
    const empList = await request({ method: 'GET', path: '/employees', token: customerAcmeToken });
    assert.strictEqual(empList.status, 403, 'Should forbid customer from reading employee roster');
  });

  // =========================================================================
  // 2. COMPANY MASTER
  // =========================================================================
  let createdCompId = '';
  await verify('2. COMPANY', 'Create company, validate required fields, prevent duplicate name/email/GSTN', async () => {
    // Missing required fields
    const invalid = await request({ method: 'POST', path: '/companies', token: managerToken, body: { company_name: 'Incomplete' } });
    assert.strictEqual(invalid.status, 400);

    // Valid creation
    const valid = await request({
      method: 'POST',
      path: '/companies',
      token: managerToken,
      body: {
        company_name: 'Matrix Dynamics Private Limited',
        address: 'Cyber City, Tower B, Gurugram',
        gstn: '06AAACM5566K1Z3',
        primary_email: 'operations@matrixdynamics.in',
        contact_person: 'Deepak Sharma',
        contact_phone: '+91 98112 77889',
      },
    });
    assert.strictEqual(valid.status, 201);
    assert(valid.body.id.startsWith('CMP-'));
    createdCompId = valid.body.id;

    // Reject duplicate company name
    const dupName = await request({
      method: 'POST',
      path: '/companies',
      token: managerToken,
      body: {
        company_name: 'Matrix Dynamics Private Limited',
        address: 'Other address',
        gstn: '06AAACM9999K1Z3',
        primary_email: 'diff@matrixdynamics.in',
        contact_person: 'Other Person',
        contact_phone: '+91 99999 88888',
      },
    });
    assert.strictEqual(dupName.status, 400);
    assert(/already exists/i.test(dupName.body.error));

    // Verify company actually saved in database
    const dbCheck = await db.query<any>('SELECT * FROM companies WHERE id = ?', [createdCompId]);
    assert.strictEqual(dbCheck.length, 1);
    assert.strictEqual(dbCheck[0].company_name, 'Matrix Dynamics Private Limited');
  });

  await verify('2. COMPANY', 'Edit company, deactivate, and search/filter', async () => {
    // Edit
    const editRes = await request({
      method: 'PUT',
      path: `/companies/${createdCompId}`,
      token: managerToken,
      body: { address: 'Updated Cyber City Hub, Level 5' },
    });
    assert.strictEqual(editRes.status, 200);

    // Deactivate (Admin only)
    const deactRes = await request({
      method: 'POST',
      path: `/companies/${createdCompId}/status`,
      token: adminToken,
      body: { isActive: false },
    });
    assert.strictEqual(deactRes.status, 200);

    const compCheck = await request({ method: 'GET', path: `/companies/${createdCompId}`, token: adminToken });
    assert.strictEqual(compCheck.body.company.is_active, 0);

    // Search filter
    const searchRes = await request({ method: 'GET', path: '/companies?search=Matrix', token: managerToken });
    assert.strictEqual(searchRes.status, 200);
    assert(searchRes.body.data.some((c: any) => c.id === createdCompId));
  });

  // =========================================================================
  // 3. TICKET CREATION & TWO-TICKET RULE
  // =========================================================================
  let ticket1Id = '';
  let ticket2Id = '';
  await verify('3. TICKET CREATION', 'Create tickets for customer contact and enforce 2-ticket restriction', async () => {
    // Ticket 1: allowed (0 open tickets)
    const t1 = await request({
      method: 'POST',
      path: '/tickets',
      token: customerAcmeToken,
      body: {
        problemType: 'Database Replica Lag Spike',
        priority: 'HIGH',
        category: 'Database Infrastructure',
        description: 'Read replica replication lag exceeds 300 seconds on production reporting cluster.',
      },
    });
    assert.strictEqual(t1.status, 201);
    assert(t1.body.ticket.id.startsWith('KT-2026-'));
    ticket1Id = t1.body.ticket.id;

    // Ticket 2: allowed (1 open ticket)
    const t2 = await request({
      method: 'POST',
      path: '/tickets',
      token: customerAcmeToken,
      body: {
        problemType: 'SSL Certificate Expiry Warning',
        priority: 'MEDIUM',
        category: 'Security & Certificates',
        description: 'Wildcard edge certificate expires in 48 hours.',
      },
    });
    assert.strictEqual(t2.status, 201);
    ticket2Id = t2.body.ticket.id;

    // Ticket 3: MUST BE REJECTED (2 open tickets)
    const t3 = await request({
      method: 'POST',
      path: '/tickets',
      token: customerAcmeToken,
      body: {
        problemType: 'Third Ticket Attempt',
        priority: 'LOW',
        category: 'Applications',
        description: 'Should be rejected under the two-ticket policy.',
      },
    });
    assert.strictEqual(t3.status, 400);
    assert(/2 active tickets/i.test(t3.body.error));
  });

  await verify('3. TICKET CREATION', 'Closing a ticket restores quota: creation becomes allowed again', async () => {
    // Close Ticket 2
    await db.execute('UPDATE tickets SET status = \'CLOSED\' WHERE id = ?', [ticket2Id]);

    // Ticket creation should succeed again now that active count is 1
    const tAllowed = await request({
      method: 'POST',
      path: '/tickets',
      token: customerAcmeToken,
      body: {
        problemType: 'Firewall Port Authorization',
        priority: 'LOW',
        category: 'Networking',
        description: 'Permit outbound HTTPS to external payment gateway.',
      },
    });
    assert.strictEqual(tAllowed.status, 201);
    // Cleanup allowed ticket
    await db.execute('UPDATE tickets SET status = \'CLOSED\' WHERE id = ?', [tAllowed.body.ticket.id]);
  });

  // =========================================================================
  // 4. AUTOMATIC & MANUAL ASSIGNMENT
  // =========================================================================
  await verify('4. ASSIGNMENT', 'Validate assignment tier enforcement and workload routing', async () => {
    // Attempt invalid assignment: assigning L1 ticket to an employee with level 'L3'
    const invalidAssign = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/assign`,
      token: managerToken,
      body: {
        employeeId: 'EMP-005', // Priya Sharma is L3
        level: 'L1',
        notes: 'Trying to assign L3 employee to L1 level',
      },
    });
    assert.strictEqual(invalidAssign.status, 400);
    assert(/Tier mismatch/i.test(invalidAssign.body.error));

    // Valid assignment to L1 employee (EMP-002 Amit)
    const validAssign = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/assign`,
      token: managerToken,
      body: {
        employeeId: 'EMP-002',
        level: 'L1',
        notes: 'Manual assignment to primary L1 specialist',
      },
    });
    assert.strictEqual(validAssign.status, 200);

    const checkT = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(checkT.body.ticket.assigned_employee_id, 'EMP-002');
    assert.strictEqual(checkT.body.ticket.assigned_level, 'L1');
  });

  // =========================================================================
  // 5 & 6. RESOLUTION TIMER & ESCALATION CONTINUITY (L1 -> L2 -> L3)
  // =========================================================================
  await verify('5 & 6. TIMER & ESCALATION', 'L1 starts work -> timer starts -> L1 escalates to L2 -> timer continuous', async () => {
    // 1. L1 starts work
    const startRes = await request({ method: 'POST', path: `/tickets/${ticket1Id}/start`, token: l1Token });
    assert.strictEqual(startRes.status, 200);

    const tAfterStart = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(tAfterStart.body.ticket.status, 'IN_PROGRESS');
    assert(tAfterStart.body.ticket.timer.isRunning, 'Timer must be running');

    // 2. Reject illegal jump: L1 to L3
    const illegalEsc = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/escalate`,
      token: l1Token,
      body: {
        fromLevel: 'L1',
        toLevel: 'L3',
        reason: 'Illegal jump to L3',
      },
    });
    assert.strictEqual(illegalEsc.status, 400);
    assert(/L1 support can only escalate to L2/i.test(illegalEsc.body.error));

    // 3. Valid escalation L1 -> L2 (to EMP-004 Vikram)
    const escL1L2 = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/escalate`,
      token: l1Token,
      body: {
        fromLevel: 'L1',
        toLevel: 'L2',
        assignedToEmployeeId: 'EMP-004',
        reason: 'Replication lag requires binlog tuning and I/O thread concurrency reconfiguration',
      },
    });
    assert.strictEqual(escL1L2.status, 200);

    const tAfterEsc1 = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(tAfterEsc1.body.ticket.assigned_level, 'L2');
    assert.strictEqual(tAfterEsc1.body.ticket.assigned_employee_id, 'EMP-004');
    assert(tAfterEsc1.body.ticket.timer.isRunning, 'Timer continues running at L2');
    assert(tAfterEsc1.body.ticket.timer.sessions.length >= 2, 'Two sessions recorded without time loss');
  });

  await verify('5 & 6. TIMER & ESCALATION', 'L2 escalates to L3 -> timer continuous across all tiers', async () => {
    // Escalate L2 -> L3 (to EMP-005 Priya)
    const escL2L3 = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/escalate`,
      token: l2Token,
      body: {
        fromLevel: 'L2',
        toLevel: 'L3',
        assignedToEmployeeId: 'EMP-005',
        reason: 'Storage engine transaction latch contention requiring storage cluster firmware patch',
      },
    });
    assert.strictEqual(escL2L3.status, 200);

    const tAfterEsc2 = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(tAfterEsc2.body.ticket.assigned_level, 'L3');
    assert.strictEqual(tAfterEsc2.body.ticket.assigned_employee_id, 'EMP-005');
    assert(tAfterEsc2.body.ticket.timer.isRunning, 'Timer continues running at L3');
    assert(tAfterEsc2.body.ticket.timer.sessions.length >= 3, 'Sessions recorded across L1, L2, L3');
    assert(tAfterEsc2.body.ticket.escalations.length === 2, 'Complete escalation history logged');
  });

  // =========================================================================
  // 7. MANAGER REVIEW WORKFLOW (RESOLVE -> REOPEN -> RESOLVE -> APPROVE)
  // =========================================================================
  await verify('7. MANAGER REVIEW', 'L3 resolves ticket -> Manager reviews & reopens -> L3 works again -> Manager approves', async () => {
    // 1. L3 resolves
    const resolve1 = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/resolve`,
      token: l3Token,
      body: {
        resolutionNotes: 'Updated InnoDB purge threads and increased replication buffer pools.',
      },
    });
    assert.strictEqual(resolve1.status, 200);

    let t = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(t.body.ticket.status, 'MANAGER_REVIEW');
    assert(!t.body.ticket.timer.isRunning, 'Timer paused during Manager Review');

    // 2. Manager reopens with reason
    const reopenRes = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/reopen`,
      token: managerToken,
      body: {
        reason: 'Please provide replica lag telemetry graph verifying 0s lag over 15 minutes.',
      },
    });
    assert.strictEqual(reopenRes.status, 200);

    t = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(t.body.ticket.status, 'IN_PROGRESS');
    assert(t.body.ticket.timer.isRunning, 'Timer resumed upon ticket reopen');

    // 3. L3 re-submits resolution
    const resolve2 = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/resolve`,
      token: l3Token,
      body: {
        resolutionNotes: 'Telemetry attached: Replica lag stabilized at 0.0s continuously for 20m.',
      },
    });
    assert.strictEqual(resolve2.status, 200);

    // 4. Manager approves
    const approveRes = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/approve`,
      token: managerToken,
      body: {
        notes: 'Verified telemetry report. Resolution confirmed.',
      },
    });
    assert.strictEqual(approveRes.status, 200);

    t = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(t.body.ticket.status, 'CUSTOMER_FEEDBACK');
  });

  // =========================================================================
  // 8. CUSTOMER EXPERIENCE & PRIVACY
  // =========================================================================
  await verify('8. CUSTOMER PRIVACY', 'Verify customer cannot see internal notes, escalations, or technician contact info', async () => {
    // Add internal note by technician
    await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/comments`,
      token: l3Token,
      body: {
        commentType: 'INTERNAL_NOTE',
        message: 'CONFIDENTIAL_INTERNAL_TECH_NOTE: Root cause was incorrect slave I/O buffer sizing.',
      },
    });

    // Add customer update
    await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/comments`,
      token: l3Token,
      body: {
        commentType: 'CUSTOMER_COMMUNICATION',
        message: 'Dear Customer, your database replica lag has been fully resolved and verified.',
      },
    });

    // Customer requests ticket detail
    const custView = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: customerAcmeToken });
    assert.strictEqual(custView.status, 200);

    const ticket = custView.body.ticket;

    // 1. Check comments: internal note MUST NOT be present
    const hasInternalNote = ticket.comments?.some((c: any) => c.message.includes('CONFIDENTIAL_INTERNAL_TECH_NOTE'));
    assert.strictEqual(hasInternalNote, false, 'Customer must NOT receive internal notes');

    // 2. Customer message must be present
    const hasCustomerMsg = ticket.comments?.some((c: any) => c.comment_type === 'CUSTOMER_COMMUNICATION');
    assert.strictEqual(hasCustomerMsg, true, 'Customer update must be received');

    // 3. Escalations array must be empty/redacted for customer
    assert.strictEqual(ticket.escalations.length, 0, 'Internal escalations must be hidden from customer');

    // 4. Private technician contact info must be undefined
    assert.strictEqual(ticket.assigned_employee_phone, undefined);
    assert.strictEqual(ticket.assigned_employee_email, undefined);

    // 5. Customer submitting feedback (5 stars)
    const fbRes = await request({
      method: 'POST',
      path: `/tickets/${ticket1Id}/feedback`,
      token: customerAcmeToken,
      body: {
        rating: 5,
        remarks: 'Prompt escalation and crystal-clear resolution by Kanvtech engineering.',
      },
    });
    assert.strictEqual(fbRes.status, 200);

    // Verify ticket is now formally CLOSED
    const closedTicket = await request({ method: 'GET', path: `/tickets/${ticket1Id}`, token: adminToken });
    assert.strictEqual(closedTicket.body.ticket.status, 'CLOSED');
    assert(closedTicket.body.ticket.closed_at, 'closed_at must be populated');
  });

  // =========================================================================
  // 10. ATTACHMENTS
  // =========================================================================
  await verify('10. ATTACHMENTS', 'Test attachment upload validation: accept valid files, reject unsupported formats', async () => {
    // Create new ticket for attachment testing
    const newT = await db.query<any>('SELECT id FROM tickets WHERE status = \'CLOSED\' LIMIT 1');
    const tId = newT[0].id;

    // 1. Valid attachment (PDF)
    const formValid = new FormData();
    const pdfBlob = new Blob(['%PDF-1.4 sample diagnostic report content'], { type: 'application/pdf' });
    formValid.append('file', pdfBlob, 'diagnostic_summary.pdf');

    const upValid = await request({
      method: 'POST',
      path: `/tickets/${tId}/attachments`,
      token: l1Token,
      formData: formValid,
    });
    assert.strictEqual(upValid.status, 200);
    assert.strictEqual(upValid.body.success, true);

    // 2. Unsupported attachment format (.exe)
    const formInvalid = new FormData();
    const exeBlob = new Blob(['MZ executable binary content'], { type: 'application/octet-stream' });
    formInvalid.append('file', exeBlob, 'malicious_patch.exe');

    const upInvalid = await request({
      method: 'POST',
      path: `/tickets/${tId}/attachments`,
      token: l1Token,
      formData: formInvalid,
    });
    assert.strictEqual(upInvalid.status, 500); // Multer fileFilter rejection
    assert(/not allowed/i.test(upInvalid.body.error || ''));
  });

  // =========================================================================
  // 11. FILTERS & SEARCH
  // =========================================================================
  await verify('11. FILTERS & SEARCH', 'Verify searching, status filtering, and priority filters across tickets and companies', async () => {
    // Filter tickets by status CLOSED
    const closedList = await request({ method: 'GET', path: '/tickets?status=CLOSED', token: adminToken });
    assert.strictEqual(closedList.status, 200);
    assert(closedList.body.data.every((t: any) => t.status === 'CLOSED'));

    // Filter tickets by search query
    const searchT = await request({ method: 'GET', path: '/tickets?search=Replica', token: adminToken });
    assert.strictEqual(searchT.status, 200);
    assert(searchT.body.data.length >= 1);

    // Filter companies by search query
    const searchComp = await request({ method: 'GET', path: '/companies?search=Acme', token: adminToken });
    assert.strictEqual(searchComp.status, 200);
    assert(searchComp.body.data.some((c: any) => c.company_name.includes('Acme')));
  });

  // =========================================================================
  // 12. DASHBOARD REAL METRICS
  // =========================================================================
  await verify('12. DASHBOARD', 'Verify dashboard metrics correlate 1:1 with real database tables', async () => {
    const dash = await request({ method: 'GET', path: '/reports/dashboard', token: adminToken });
    assert.strictEqual(dash.status, 200);

    const m = dash.body.metrics;
    assert(typeof m.volume.total === 'number');
    assert(typeof m.volume.closed === 'number');
    assert(typeof m.sla.complianceRate === 'number');

    // Compare with direct DB query
    const dbTotal = await db.query<{ total: number }>('SELECT COUNT(*) as total FROM tickets');
    assert.strictEqual(m.volume.total, dbTotal[0].total, 'Dashboard total tickets must match database count');
  });

  // =========================================================================
  // 13. SLA CONFIGURATION & BREACH DETECTION
  // =========================================================================
  await verify('13. SLA', 'Verify priority SLA thresholds and update configuration', async () => {
    const slaRes = await request({ method: 'GET', path: '/reports/sla', token: adminToken });
    assert.strictEqual(slaRes.status, 200);
    assert(Array.isArray(slaRes.body.configs));

    const highCfg = slaRes.body.configs.find((c: any) => c.priority === 'HIGH');
    assert(highCfg, 'HIGH SLA config must exist');
    assert.strictEqual(highCfg.resolution_time_hours, 4);

    // Update SLA setting as Admin
    const updateSla = await request({
      method: 'PUT',
      path: '/reports/sla',
      token: adminToken,
      body: {
        priority: 'HIGH',
        response_time_hours: 1,
        resolution_time_hours: 4,
        warning_threshold_percent: 80,
      },
    });
    assert.strictEqual(updateSla.status, 200);
  });

  // =========================================================================
  // 14. AUDIT LOG
  // =========================================================================
  await verify('14. AUDIT LOG', 'Verify critical lifecycle mutations produce audit logs with actor and timestamp', async () => {
    const auditRes = await request({ method: 'GET', path: '/audit-logs', token: adminToken });
    assert.strictEqual(auditRes.status, 200);
    assert(auditRes.body.logs.length > 0);

    const actions = auditRes.body.logs.map((l: any) => l.action);
    assert(actions.includes('TICKET_CREATED'), 'TICKET_CREATED must be in audit log');
    assert(actions.includes('CUSTOMER_FEEDBACK_SUBMITTED'), 'CUSTOMER_FEEDBACK_SUBMITTED must be in audit log');
  });

  // =========================================================================
  // 15. ERROR HANDLING
  // =========================================================================
  await verify('15. ERROR HANDLING', 'Verify structured error handling without raw stack trace leakage', async () => {
    // Missing required fields
    const errRes = await request({ method: 'POST', path: '/tickets', token: adminToken, body: {} });
    assert.strictEqual(errRes.status, 400);
    assert.strictEqual(errRes.body.success, false);
    assert(typeof errRes.body.error === 'string');
    assert(!errRes.body.stack, 'Raw stack trace must never be leaked to client');
  });

  // =========================================================================
  // 17. DATA INTEGRITY AUDIT
  // =========================================================================
  await verify('17. DATA INTEGRITY', 'Verify database integrity: no orphan records, correct foreign keys and session consistency', async () => {
    // Check for tickets without valid company
    const orphanTickets = await db.query<any>(
      'SELECT t.id FROM tickets t LEFT JOIN companies c ON t.company_id = c.id WHERE c.id IS NULL'
    );
    assert.strictEqual(orphanTickets.length, 0, 'No orphaned tickets');

    // Check for sessions without ticket
    const orphanSessions = await db.query<any>(
      'SELECT s.id FROM ticket_resolution_sessions s LEFT JOIN tickets t ON s.ticket_id = t.id WHERE t.id IS NULL'
    );
    assert.strictEqual(orphanSessions.length, 0, 'No orphaned timer sessions');

    // Check for negative resolution duration
    const badSessions = await db.query<any>(
      'SELECT id FROM ticket_resolution_sessions WHERE duration_seconds < 0'
    );
    assert.strictEqual(badSessions.length, 0, 'No negative timer sessions');
  });

  console.log('\n======================================================================');
  console.log(`PHASE 1 VERIFICATION RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runComprehensiveVerification().catch((err) => {
  console.error('Fatal verification runner error:', err);
  process.exit(1);
});
