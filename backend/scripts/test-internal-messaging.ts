import { PrismaClient, UserRole } from '@prisma/client';
import assert from 'assert';
import * as bcrypt from 'bcryptjs';
import { ChatService } from '../src/chat/chat.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AuditService } from '../src/audit/audit.service';

const prisma = new PrismaClient();
const notificationsService = new NotificationsService(prisma as any);
const auditService = new AuditService(prisma as any);
const chatService = new ChatService(prisma as any, notificationsService, auditService);

async function runTargetedMessagingTests() {
  console.log('====================================================');
  console.log('TARGETED INTERNAL MESSAGING SUITE');
  console.log('====================================================');

  const ts = Date.now();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Setup Test Employees: EmpA, EmpB, EmpC, Manager, Admin, EmpD (unrelated)
  console.log('\n[1/10] Setting up test employees...');
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
              department: 'Support',
              designation: role,
              level: role === 'L3_EMPLOYEE' ? 'L3' : role === 'L2_EMPLOYEE' ? 'L2' : 'L1',
            },
          },
        },
      });
    }
    return u;
  };

  const empA = await createTestUser(`empa_${ts}@kanvtech.test`, `Employee A ${ts}`, UserRole.L1_EMPLOYEE, `EMP-A-${ts.toString().slice(-4)}`);
  const empB = await createTestUser(`empb_${ts}@kanvtech.test`, `Employee B ${ts}`, UserRole.L2_EMPLOYEE, `EMP-B-${ts.toString().slice(-4)}`);
  const empC = await createTestUser(`empc_${ts}@kanvtech.test`, `Employee C ${ts}`, UserRole.L3_EMPLOYEE, `EMP-C-${ts.toString().slice(-4)}`);
  const mgr = await createTestUser(`mgr_${ts}@kanvtech.test`, `Manager ${ts}`, UserRole.MANAGER, `EMP-M-${ts.toString().slice(-4)}`);
  const unrelatedEmpD = await createTestUser(`empd_${ts}@kanvtech.test`, `Employee D ${ts}`, UserRole.L1_EMPLOYEE, `EMP-D-${ts.toString().slice(-4)}`);
  const testAdmin = await createTestUser(`admin_${ts}@kanvtech.test`, `System Admin ${ts}`, UserRole.ADMIN, `EMP-ADM-${ts.toString().slice(-4)}`);

  console.log('✓ Test employees prepared');

  // 2. Test Mandatory "To" validation
  console.log('\n[2/10] Testing To, Subject, and Message validation...');
  try {
    await chatService.composeMessage({
      senderUserId: empA.id,
      toUserIds: [],
      subject: 'Test Subject',
      message: 'Test Message',
    });
    assert.fail('Should have failed when toUserIds is empty');
  } catch (err: any) {
    assert(err.message.includes('To'), 'Error message should mention "To" recipient');
    console.log('✓ Empty To rejected as expected');
  }

  // 3. Test Rejection of Non-Employee / Customer
  console.log('\n[3/10] Testing customer / non-employee rejection...');
  const customerUser = await prisma.user.create({
    data: {
      email: `cust_${ts}@external.com`,
      passwordHash,
      role: UserRole.CUSTOMER,
      isActive: true,
    },
  });

  try {
    await chatService.composeMessage({
      senderUserId: empA.id,
      toUserIds: [customerUser.id],
      subject: 'Test Subject',
      message: 'Hello customer',
    });
    assert.fail('Should have rejected non-employee recipient');
  } catch (err: any) {
    assert(err.message.includes('Only active internal employees are permitted') || err.message.includes('Invalid'));
    console.log('✓ Customer recipient properly rejected');
  }

  // 4. Test Valid Compose: EmpA -> To: EmpB, CC: EmpC + Manager
  console.log('\n[4/10] Testing Internal Compose (EmpA -> To: EmpB, CC: EmpC, Mgr)...');
  const composed = await chatService.composeMessage({
    senderUserId: empA.id,
    toUserIds: [empB.id],
    ccUserIds: [empC.id, mgr.id],
    subject: `Ticket Escalation Required - Batch ${ts}`,
    message: 'Please check ticket #CMP-1024 and take required resolution action.',
  });

  assert(composed.success, 'Compose should return success');
  assert(composed.conversationId, 'Compose should return conversationId');
  const convId = composed.conversationId;
  console.log(`✓ Conversation created with ID: ${convId}`);

  // 5. Test Database Persistence of Thread, Participants, and Initial Message
  console.log('\n[5/10] Verifying database persistence for thread and participants...');
  const dbConv = await prisma.chatConversation.findUnique({
    where: { id: convId },
    include: { participants: true, messages: true },
  });
  assert(dbConv, 'Conversation must exist in database');
  assert.strictEqual(dbConv.title, `Ticket Escalation Required - Batch ${ts}`);
  assert.strictEqual(dbConv.participants.length, 4, 'Participants must be 4: EmpA, EmpB, EmpC, Mgr');
  assert.strictEqual(dbConv.messages.length, 1, 'Initial message must exist');
  console.log('✓ Database persistence verified: 4 participants, 1 message');

  // 6. Test In-App Notification Delivery
  console.log('\n[6/10] Verifying in-app notifications generated for all recipients...');
  const notifsB = await prisma.notification.findMany({ where: { userId: empB.id, type: 'INTERNAL_MESSAGE' } });
  const notifsC = await prisma.notification.findMany({ where: { userId: empC.id, type: 'INTERNAL_MESSAGE' } });
  const notifsMgr = await prisma.notification.findMany({ where: { userId: mgr.id, type: 'INTERNAL_MESSAGE' } });
  const notifsA = await prisma.notification.findMany({ where: { userId: empA.id, type: 'INTERNAL_MESSAGE' } });

  assert(notifsB.length >= 1, 'EmpB should receive in-app notification');
  assert(notifsC.length >= 1, 'EmpC should receive in-app notification');
  assert(notifsMgr.length >= 1, 'Manager should receive in-app notification');
  assert.strictEqual(notifsA.filter(n => n.linkUrl?.includes(`id=${convId}`)).length, 0, 'Sender EmpA should NOT receive notification for own message');
  console.log('✓ In-app notifications generated in DB for EmpB, EmpC, and Manager');

  // 7. Test Strict Participant Security / Authorization
  console.log('\n[7/10] Testing Strict Participant-based authorization...');
  // EmpB, EmpC, Mgr, EmpA should have access
  const detailsEmpB = await chatService.getConversationDetails(convId, empB.id);
  assert(detailsEmpB, 'EmpB must have access');

  // Unrelated EmpD must NOT have access
  try {
    await chatService.getConversationDetails(convId, unrelatedEmpD.id);
    assert.fail('Unrelated EmpD should NOT be able to view private conversation');
  } catch (err: any) {
    assert.strictEqual(err.status, 403);
    console.log('✓ Unrelated EmpD blocked with 403 Forbidden');
  }

  // Admin NOT in participants must NOT have access
  try {
    await chatService.getConversationDetails(convId, testAdmin.id);
    assert.fail('Admin should NOT have automatic access to private conversations unless participant');
  } catch (err: any) {
    assert.strictEqual(err.status, 403);
    console.log('✓ Non-participant Admin blocked with 403 Forbidden');
  }

  // 8. Test Mailbox Folders (Inbox, Sent, Unread)
  console.log('\n[8/10] Testing Mailbox Folders (Inbox, Sent, Unread)...');
  const inboxB = await chatService.getConversationsForUser(empB.id, { folder: 'inbox' });
  assert(inboxB.some((c: any) => c.id === convId), 'Conversation should appear in EmpB Inbox');
  assert(inboxB.find((c: any) => c.id === convId)?.unreadCount > 0, 'Conversation should have unreadCount > 0 for EmpB');

  const sentA = await chatService.getConversationsForUser(empA.id, { folder: 'sent' });
  assert(sentA.some((c: any) => c.id === convId), 'Conversation should appear in EmpA Sent');

  const unreadB = await chatService.getConversationsForUser(empB.id, { folder: 'unread' });
  assert(unreadB.some((c: any) => c.id === convId), 'Conversation should appear in EmpB Unread folder');
  console.log('✓ Mailbox Inbox, Sent, and Unread folders validated');

  // 9. Test Reply and Reply All in Thread
  console.log('\n[9/10] Testing Reply and Reply All with in-app notification routing...');
  // EmpB replies All
  const replyMsg = await chatService.replyMessage({
    conversationId: convId,
    senderUserId: empB.id,
    message: 'Acknowledged. I have checked CMP-1024 and assigned the L2 engineer.',
    isReplyAll: true,
  });
  assert(replyMsg.id, 'Reply message created');

  const updatedThread = await chatService.getConversationDetails(convId, empB.id);
  assert.strictEqual(updatedThread.messages.length, 2, 'Thread should now contain 2 messages');
  assert.strictEqual(updatedThread.messages[1].senderId, empB.id);
  console.log('✓ Reply All added to existing thread preserving thread ID and title');

  // 10. Test Mark as Read & Notification Persistence
  console.log('\n[10/10] Testing Mark Read and notification update...');
  await chatService.markMessagesRead(convId, empB.id);
  const inboxBAfterRead = await chatService.getConversationsForUser(empB.id, { folder: 'inbox' });
  const readConv = inboxBAfterRead.find((c: any) => c.id === convId);
  assert.strictEqual(readConv?.unreadCount, 0, 'Unread count should be 0 after reading');

  const notifAfter = await prisma.notification.findFirst({
    where: { userId: empB.id, linkUrl: { contains: `id=${convId}` } },
  });
  assert(notifAfter?.isRead, 'Notification should be marked as read');
  console.log('✓ Mark as read and notification state update verified');

  console.log('\n====================================================');
  console.log('ALL TARGETED INTERNAL MESSAGING TESTS PASSED ✔');
  console.log('====================================================');
}

runTargetedMessagingTests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('TEST FAILED:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
