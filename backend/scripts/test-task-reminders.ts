import { PrismaClient, UserRole } from '@prisma/client';
import assert from 'assert';
import * as bcrypt from 'bcryptjs';
import { EmployeeTasksService } from '../src/employee-tasks/employee-tasks.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AuditService } from '../src/audit/audit.service';

const prisma = new PrismaClient();
const notificationsService = new NotificationsService(prisma as any);
const auditService = new AuditService(prisma as any);
const tasksService = new EmployeeTasksService(prisma as any, notificationsService, auditService);

async function runTaskReminderTests() {
  console.log('====================================================');
  console.log('TARGETED TEST SUITE: MY TASKS & IN-APP REMINDERS');
  console.log('====================================================');

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Setup Test Personas
  console.log('\n[1/11] Setting up test employees...');
  const createTestUser = async (email: string, name: string, role: UserRole, empId: string) => {
    let u = await prisma.user.findUnique({ where: { email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          isActive: true,
          employee: {
            create: {
              id: empId,
              name,
              email,
              phone: '9876543210',
              department: 'Technical Operations',
              designation: role === 'MANAGER' ? 'Technical Manager' : 'Support Engineer',
              level: role === 'MANAGER' ? 'L3' : 'L1',
            },
          },
        },
      });
    }
    return u;
  };

  const empA = await createTestUser(`task_alice_${ts}@kanvtech.test`, `Alice Task ${ts}`, UserRole.L1_EMPLOYEE, `TEMPA-${ts.toString().slice(-4)}`);
  const empB = await createTestUser(`task_bob_${ts}@kanvtech.test`, `Bob Task ${ts}`, UserRole.L2_EMPLOYEE, `TEMPB-${ts.toString().slice(-4)}`);
  const admin = await createTestUser(`task_admin_${ts}@kanvtech.test`, `Admin Task ${ts}`, UserRole.ADMIN, `TEMPADM-${ts.toString().slice(-4)}`);

  const empAId = `TEMPA-${ts.toString().slice(-4)}`;
  const empBId = `TEMPB-${ts.toString().slice(-4)}`;
  const adminId = `TEMPADM-${ts.toString().slice(-4)}`;

  console.log('✓ Test personas prepared (Alice, Bob, Admin)');

  // 2. Test Mandatory Validation: Empty Title
  console.log('\n[2/11] Testing validation rules (empty title, invalid reminder)...');
  try {
    await tasksService.createTask(empAId, empA.id, {
      title: '   ',
      dueDate: new Date().toISOString(),
    });
    assert.fail('Should have rejected empty title');
  } catch (err: any) {
    assert(err.message.includes('Task title is required'), `Expected title validation error, got: ${err.message}`);
    console.log('✓ Empty title rejected');
  }

  // Past reminder validation
  try {
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    await tasksService.createTask(empAId, empA.id, {
      title: 'Past Reminder Test',
      reminderTime: pastTime,
    });
    assert.fail('Should have rejected past reminder time');
  } catch (err: any) {
    assert(err.message.includes('past'), `Expected past reminder error, got: ${err.message}`);
    console.log('✓ Past reminder time rejected');
  }

  // 3. Create Valid Personal Task with Due Date and Reminder
  console.log('\n[3/11] Creating personal task with reminder...');
  const dueDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const reminderDate = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

  const task1 = await tasksService.createTask(empAId, empA.id, {
    title: `Call ABC Customer regarding AMC Renewal #${ts}`,
    description: 'Verify server logs and clarify payment schedule.',
    category: 'AMC',
    priority: 'HIGH',
    dueDate,
    dueTime: '16:00',
    reminderTime: reminderDate,
  });

  assert(task1.id.startsWith('ETSK-'), 'Task ID should start with ETSK-');
  assert.strictEqual(task1.status, 'PENDING');
  assert.strictEqual(task1.assigned_to, empAId);
  assert.strictEqual(task1.created_by, empAId);
  console.log(`✓ Personal task created: ${task1.id} ("${task1.title}")`);

  // 4. Verify Database Persistence
  console.log('\n[4/11] Verifying database persistence...');
  const dbTask = await prisma.employeeTask.findUnique({ where: { id: task1.id } });
  assert(dbTask, 'Task must exist in DB');
  assert.strictEqual(dbTask.title, task1.title);
  assert.strictEqual(dbTask.category, 'AMC');
  assert.strictEqual(dbTask.priority, 'HIGH');
  assert.strictEqual(dbTask.reminderTriggeredAt, null);
  console.log('✓ Task persisted in PostgreSQL database');

  // 5. Test Dashboard Summary Metrics (Dynamic Calculation)
  console.log('\n[5/11] Testing Dashboard summary metrics...');
  const summary = await tasksService.getDashboardSummary(empAId);
  assert(summary.metrics, 'Summary must have metrics');
  assert(summary.metrics.totalPendingCount >= 1, 'Pending count should be >= 1');
  assert(summary.metrics.upcomingCount >= 1, 'Upcoming count should be >= 1');
  console.log(`✓ Dashboard metrics calculated: ${JSON.stringify(summary.metrics)}`);

  // 6. Test Strict Ownership Security (Employee B and Admin blocked)
  console.log('\n[6/11] Testing Strict Ownership Privacy...');
  try {
    await tasksService.getTaskById(task1.id, empBId);
    assert.fail('Employee B should NOT be able to view Employee A task');
  } catch (err: any) {
    assert(err.status === 403 || err.message.includes('access'), `Expected 403 Forbidden, got: ${err.message}`);
    console.log('✓ Employee B blocked from Employee A personal task with 403');
  }

  try {
    await tasksService.getTaskById(task1.id, adminId);
    assert.fail('Admin should NOT automatically view Employee A personal task');
  } catch (err: any) {
    assert(err.status === 403 || err.message.includes('access'), `Expected 403 Forbidden, got: ${err.message}`);
    console.log('✓ Admin blocked from Employee A personal task with 403');
  }

  // 7. Test In-App Reminder Execution & Idempotency
  console.log('\n[7/11] Testing In-App Reminder Generation & Idempotency...');
  // Create a task with reminder due right now
  const taskDueNow = await prisma.employeeTask.create({
    data: {
      id: `ETSK-DUE-${ts.toString().slice(-4)}`,
      title: `Urgent Server Health Check #${ts}`,
      dueDate: new Date(Date.now() + 3600 * 1000),
      dueTime: '15:00',
      priority: 'URGENT',
      reminderTime: new Date(Date.now() - 5000), // Due 5 seconds ago
      reminderTriggeredAt: null,
      status: 'PENDING',
      createdBy: empAId,
      assignedTo: empAId,
    },
  });

  // Run reminder sweep
  const sweep1 = await tasksService.processDueReminders();
  assert(sweep1.processedCount >= 1, 'Sweep 1 should process due reminder');

  // Verify in-app notification in DB
  const notifications = await prisma.notification.findMany({
    where: { userId: empA.id, type: 'PERSONAL_TASK_REMINDER' },
    orderBy: { createdAt: 'desc' },
  });
  assert(notifications.length >= 1, 'In-app notification must be created in DB');
  const notif = notifications[0];
  assert(notif.title.includes('Task Reminder'), 'Notification title should contain Task Reminder');
  assert(notif.message.includes(taskDueNow.title), 'Notification message should contain task title');
  assert(notif.linkUrl?.includes(taskDueNow.id), 'Notification linkUrl should link to task');
  console.log(`✓ In-App Notification created in DB: "${notif.title}" -> "${notif.message}"`);

  // Idempotency: Run sweep 2 -> must NOT create duplicate notification
  const countBefore = await prisma.notification.count({ where: { userId: empA.id, type: 'PERSONAL_TASK_REMINDER' } });
  const sweep2 = await tasksService.processDueReminders();
  const countAfter = await prisma.notification.count({ where: { userId: empA.id, type: 'PERSONAL_TASK_REMINDER' } });
  assert.strictEqual(countBefore, countAfter, 'Idempotent reminder check must not produce duplicate notifications');
  console.log('✓ Idempotency verified: 0 duplicate notifications generated on subsequent sweep');

  // 8. Test Completed Task Before Reminder (Does NOT trigger reminder)
  console.log('\n[8/11] Testing Completed Task reminder suppression...');
  const taskCompletedEarly = await prisma.employeeTask.create({
    data: {
      id: `ETSK-EARLY-${ts.toString().slice(-4)}`,
      title: `Completed Early Task #${ts}`,
      dueDate: new Date(Date.now() + 3600 * 1000),
      dueTime: '17:00',
      priority: 'MEDIUM',
      reminderTime: new Date(Date.now() - 5000),
      reminderTriggeredAt: null,
      status: 'COMPLETED', // Completed before reminder
      completedAt: new Date(),
      createdBy: empAId,
      assignedTo: empAId,
    },
  });

  const countBeforeEarly = await prisma.notification.count({ where: { userId: empA.id, type: 'PERSONAL_TASK_REMINDER' } });
  await tasksService.processDueReminders();
  const countAfterEarly = await prisma.notification.count({ where: { userId: empA.id, type: 'PERSONAL_TASK_REMINDER' } });
  assert.strictEqual(countBeforeEarly, countAfterEarly, 'Completed tasks must never generate reminder notifications');
  console.log('✓ Completed task correctly suppressed reminder notification');

  // 9. Test Task Update (Editing reminder resets trigger)
  console.log('\n[9/11] Testing Task Editing...');
  const updatedTask = await tasksService.updateTask(task1.id, empAId, empA.id, {
    title: `Updated: Call ABC Customer regarding AMC Renewal #${ts}`,
    priority: 'URGENT',
    dueTime: '17:30',
  });
  assert.strictEqual(updatedTask.priority, 'URGENT');
  assert.strictEqual(updatedTask.due_time, '17:30');
  console.log('✓ Task updated successfully');

  // 10. Test Mark Completed & Reopen
  console.log('\n[10/11] Testing Mark Completed & Reopen...');
  const completed = await tasksService.completeTask(task1.id, empAId, empA.id);
  assert.strictEqual(completed.status, 'COMPLETED');
  assert(completed.completed_at, 'completed_at must be set');

  const reopened = await tasksService.updateTask(task1.id, empAId, empA.id, { status: 'PENDING' });
  assert.strictEqual(reopened.status, 'PENDING');
  assert.strictEqual(reopened.completed_at, null);
  console.log('✓ Complete & Reopen cycle validated');

  // 11. Test Notification Read State & Persistence
  console.log('\n[11/11] Testing Notification Read State Persistence...');
  await notificationsService.markAsRead(notif.id, empA.id);
  const updatedNotif = await prisma.notification.findUnique({ where: { id: notif.id } });
  assert.strictEqual(updatedNotif?.isRead, true, 'Notification must be marked as read in DB');
  console.log('✓ In-app notification read state persisted in database');

  console.log('\n====================================================');
  console.log('ALL 11 TARGETED MY TASKS & REMINDER TESTS PASSED ✔');
  console.log('====================================================');
}

runTaskReminderTests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('TEST SUITE FAILED:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
