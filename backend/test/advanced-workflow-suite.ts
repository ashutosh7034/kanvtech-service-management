import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:5000/api';
const prisma = new PrismaClient();

async function run() {
  console.log('====================================================');
  console.log('STARTING ADVANCED WORKFLOW UPDATE QA SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}\n   Error: ${err.message}`);
      failed++;
    }
  };

  const login = async (email: string, password = 'Password@123') => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data.token;
  };

  const adminToken = await login('admin@kanvtech.com');
  const managerToken = await login('manager@kanvtech.com');
  const l1Token = await login('l1.amit@kanvtech.com');
  const l3Token = await login('l3.priya@kanvtech.com');
  const customerToken = await login('rajesh@acme.com');

  // --- SUITE 1: PRODUCT MASTER ---
  console.log('--- SUITE 1: PRODUCT MASTER ---');
  let createdProductId = '';
  await test('Product Master -> Create New Product', async () => {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productName: 'Kanvtech ERP Core Enterprise',
        category: 'ERP / Core Business',
        description: 'Flagship enterprise resource planning module',
        unitPrice: 45000,
        billingCycle: 'YEARLY',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create product');
    if (!data.product || (!data.product.id?.startsWith('PROD-') && !data.product.product_code?.startsWith('KT-'))) {
      throw new Error('Invalid product code format');
    }
    createdProductId = data.product.id;
  });

  await test('Product Master -> Duplicate Product Code Rejection', async () => {
    const existing = await prisma.product.findUnique({ where: { id: createdProductId } });
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productCode: existing?.code,
        productName: 'Duplicate Code Product',
        category: 'Software',
      }),
    });
    if (res.status !== 400 && res.status !== 409) {
      throw new Error(`Expected 400/409 duplicate rejection, got ${res.status}`);
    }
  });

  await test('Product Master -> Toggle Active/Inactive Status', async () => {
    const res = await fetch(`${API_URL}/products/${createdProductId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const data = await res.json();
    if (!res.ok || (data.product.is_active !== false && data.product.isActive !== false)) {
      throw new Error('Failed to deactivate product');
    }
  });

  // --- SUITE 2: TASK ALLOTMENT (DIRECT ASSIGNMENT) ---
  console.log('\n--- SUITE 2: TASK ALLOTMENT & WORKLOAD ---');
  let testTicketId = '';
  await test('Task Allotment -> Customer Creates Ticket', async () => {
    // Clean up active tickets for rajesh@acme.com so 2-ticket limit passes
    const contact = await prisma.companyContact.findFirst({ where: { email: 'rajesh@acme.com' } });
    if (contact) {
      await prisma.ticket.updateMany({
        where: { customerContactId: contact.id, status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }

    const res = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        problemType: 'Database connection timeout during peak hours',
        priority: 'HIGH',
        category: 'Database / Performance',
        description: 'Users experiencing intermittent timeouts on ERP portal.',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create ticket');
    testTicketId = data.ticket.id;
  });

  await test('Task Allotment -> Manager Direct Assigns to L3 Principal Specialist', async () => {
    // Find L3 specialist Priya
    const priya = await prisma.user.findFirst({ where: { email: 'l3.priya@kanvtech.com' } });
    if (!priya) throw new Error('L3 Specialist Priya not found');

    const res = await fetch(`${API_URL}/task-allotment/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        ticketId: testTicketId,
        employeeId: priya.id,
        assignmentReason: 'High priority performance incident directly routed to L3 Senior Specialist',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed direct assignment');
    const tRes = await fetch(`${API_URL}/tickets/${testTicketId}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const tData = await tRes.json();
    if (tData.ticket?.assigned_level !== 'L3' && tData.ticket?.assignedLevel !== 'L3') {
      throw new Error('Ticket not correctly updated to L3 assignee');
    }
  });

  // --- SUITE 3: SUBSCRIPTIONS & ANNUAL MAINTENANCE (AMC) ---
  console.log('\n--- SUITE 3: ANNUAL MAINTENANCE & CONTRACTS ---');
  let createdSubId = '';
  await test('AMC / Subscriptions -> Create Contract with Auto Status', async () => {
    const acme = await prisma.company.findFirst({ where: { id: 'CMP-0001' } });
    if (!acme) throw new Error('Acme company not found');

    const res = await fetch(`${API_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        companyId: acme.id,
        contractName: 'Acme Annual SLA Support & Maintenance Gold',
        contractType: 'ANNUAL_MAINTENANCE',
        startDate: '2026-01-01',
        expiryDate: '2026-10-10', // Expiring in < 30 days
        annualValue: 120000,
        billingFrequency: 'ANNUAL',
        slaTier: '24/7 Priority Gold',
        notes: 'Includes dedicated account manager and 1-hour SLA',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create subscription');
    if (data.subscription.status !== 'EXPIRING_SOON') {
      throw new Error(`Expected status EXPIRING_SOON, got ${data.subscription.status}`);
    }
    createdSubId = data.subscription.id;
  });

  await test('AMC / Subscriptions -> Dispatch Expiry Warning Notification', async () => {
    const res = await fetch(`${API_URL}/subscriptions/${createdSubId}/warning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        message: 'Your AMC Gold contract expires in 16 days. Please review renewal quotation.',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch warning');
    if (!data.subscription?.last_warning_sent_at && !data.subscription?.warning_sent_at && !data.subscription?.lastWarningSentAt) {
      throw new Error('Warning timestamp not saved');
    }
  });

  await test('AMC / Subscriptions -> Renew Subscription Contract', async () => {
    const res = await fetch(`${API_URL}/subscriptions/${createdSubId}/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        newExpiryDate: '2027-10-10',
        annualValue: 135000,
        renewalNotes: 'Contract renewed for 2026-2027 with 12% price indexation',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to renew subscription');
    if (data.subscription.status !== 'ACTIVE' && data.subscription.status !== 'RENEWED') {
      throw new Error('Renewed subscription fields mismatch');
    }
  });

  // --- SUITE 4: NEW CLIENT IMPLEMENTATION LIFECYCLE ---
  console.log('\n--- SUITE 4: CLIENT IMPLEMENTATION LIFECYCLE ---');
  let createdImpId = '';
  await test('Implementations -> Onboard Client Implementation Project', async () => {
    const acme = await prisma.company.findFirst({ where: { id: 'CMP-0001' } });
    const vikram = await prisma.user.findFirst({ where: { email: 'l2.vikram@kanvtech.com' } });

    const res = await fetch(`${API_URL}/implementations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        companyId: acme?.id,
        projectName: 'Acme Cloud ERP & Analytics Onboarding',
        leadSpecialistId: vikram?.id,
        startDate: '2026-09-01',
        targetGoLiveDate: '2026-11-15',
        status: 'CONFIGURATION',
        progressPercentage: 35,
        milestones: [
          { name: 'Architecture Review', completed: true, date: '2026-09-05' },
          { name: 'Data Migration', completed: true, date: '2026-09-18' },
          { name: 'User Acceptance Testing', completed: false, date: '2026-10-15' },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create implementation');
    if (!data.implementation.project_code.startsWith('IMP-')) {
      throw new Error('Invalid project code format');
    }
    createdImpId = data.implementation.id;
  });

  await test('Implementations -> Update Milestones and Progress to Ready for Go-Live', async () => {
    const res = await fetch(`${API_URL}/implementations/${createdImpId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        status: 'READY_FOR_GO_LIVE',
        progressPercentage: 90,
        notes: 'Final load testing and signoff complete. Ready for production cutover.',
      }),
    });
    const data = await res.json();
    if (!res.ok || data.implementation.status !== 'READY_FOR_GO_LIVE' || data.implementation.progress_percentage !== 90) {
      throw new Error('Implementation update failed');
    }
  });

  // --- SUITE 5: CUSTOMER REOPEN, FEEDBACK & FINAL CLOSURE ---
  console.log('\n--- SUITE 5: CUSTOMER REOPEN & CLOSURE WORKFLOW ---');
  await test('Resolution & Approval -> L3 Resolves and Manager Approves', async () => {
    // 1. L3 starts work
    await fetch(`${API_URL}/tickets/${testTicketId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${l3Token}` },
    });

    // 2. L3 resolves
    const resRes = await fetch(`${API_URL}/tickets/${testTicketId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${l3Token}`,
      },
      body: JSON.stringify({
        resolutionCategory: 'Database Index Optimization',
        rootCause: 'Missing composite index on ERP order_line table causing table scan during report generation.',
        resolutionNotes: 'Added composite b-tree index and increased connection pool maximum capacity to 100.',
      }),
    });
    if (!resRes.ok) throw new Error('Resolution failed');

    // 3. Manager approves
    const resApp = await fetch(`${API_URL}/tickets/${testTicketId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        notes: 'Solution verified on staging. Production patch deployed.',
      }),
    });
    if (!resApp.ok) throw new Error('Manager approval failed');
  });

  await test('Customer Reopen -> Customer Reopens with Mandatory Reason', async () => {
    const res = await fetch(`${API_URL}/tickets/${testTicketId}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        reason: 'Intermittent query timeout is still occurring during the 10:00 AM batch report run.',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reopen failed');
    if (data.ticket.status !== 'IN_PROGRESS' || data.ticket.is_reopened !== true) {
      throw new Error(`Expected status IN_PROGRESS and is_reopened=true, got ${data.ticket.status}`);
    }

    // Verify reopen history was recorded in database
    const history = await prisma.ticketReopenHistory.findMany({
      where: { ticketId: testTicketId },
    });
    if (history.length === 0) {
      throw new Error('TicketReopenHistory record was not created');
    }
  });

  await test('Customer Final Resolution & Closure -> Re-resolve, Approve, CSAT Feedback & Final Close', async () => {
    // 1. Re-resolve
    await fetch(`${API_URL}/tickets/${testTicketId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${l3Token}`,
      },
      body: JSON.stringify({
        resolutionCategory: 'Batch Job Query Tuning',
        rootCause: 'Batch report was using unindexed view join.',
        resolutionNotes: 'Materialized view refreshed with pre-aggregated metrics.',
      }),
    });

    // 2. Manager approves
    await fetch(`${API_URL}/tickets/${testTicketId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ notes: 'Batch report execution verified under 400ms.' }),
    });

    // 3. Customer submits 5-star feedback
    const resFeedback = await fetch(`${API_URL}/tickets/${testTicketId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        rating: 5,
        remarks: 'Batch job executed flawlessly this morning. Exceptional responsiveness from L3 team!',
      }),
    });
    const dataFeedback = await resFeedback.json();
    if (!resFeedback.ok || dataFeedback.ticket.status !== 'CLOSED') {
      throw new Error('Feedback submission or auto-closure failed');
    }
  });

  // --- SUITE 6: STRICT 2-ACTIVE-TICKET RULE ENFORCEMENT ---
  console.log('\n--- SUITE 6: 2-ACTIVE-TICKET RULE ENFORCEMENT ---');
  await test('2-Ticket Rule -> Allow 2 Open Tickets and Strictly Block 3rd', async () => {
    // Clean up active tickets for rajesh@acme.com so we start with exactly 0 active tickets
    const contact = await prisma.companyContact.findFirst({ where: { email: 'rajesh@acme.com' } });
    if (contact) {
      await prisma.ticket.updateMany({
        where: { customerContactId: contact.id, status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED', 'RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK'] } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }

    // 1. Open Ticket 1
    const t1 = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ problemType: 'Open Ticket 1', priority: 'LOW', description: 'Test 1' }),
    });
    if (!t1.ok) throw new Error('Failed to create ticket 1');

    // 2. Open Ticket 2
    const t2 = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ problemType: 'Open Ticket 2', priority: 'MEDIUM', description: 'Test 2' }),
    });
    if (!t2.ok) throw new Error('Failed to create ticket 2');

    // 3. Attempt Ticket 3 (MUST BE REJECTED)
    const t3 = await fetch(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ problemType: 'Open Ticket 3 (Should fail)', priority: 'HIGH', description: 'Test 3' }),
    });
    if (t3.status !== 400) {
      throw new Error(`Expected 400 rejection for 3rd active ticket, got ${t3.status}`);
    }
    const data3 = await t3.json();
    if (!data3.error?.includes('2 active tickets') && !data3.error?.includes('Active Ticket Limit')) {
      throw new Error(`Unexpected error message: ${data3.error}`);
    }
  });

  console.log('\n====================================================');
  console.log('ADVANCED WORKFLOW UPDATE QA RESULTS');
  console.log(`TOTAL: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('====================================================\n');

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
