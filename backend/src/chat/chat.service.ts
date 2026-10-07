import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@prisma/client';

const EMPLOYEE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.L1_EMPLOYEE,
  UserRole.L2_EMPLOYEE,
  UserRole.L3_EMPLOYEE,
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  /**
   * Validate that all user IDs are active internal employees (no customers, no external users).
   */
  private async validateInternalEmployees(userIds: number[]): Promise<any[]> {
    if (!userIds || userIds.length === 0) return [];
    const uniqueIds = [...new Set(userIds.map(Number))];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
        role: { in: EMPLOYEE_ROLES },
      },
      include: {
        employee: { select: { id: true, name: true, designation: true } },
      },
    });

    if (users.length !== uniqueIds.length) {
      const foundIds = new Set(users.map((u) => u.id));
      const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid or non-employee recipient(s) specified: ID(s) ${missingIds.join(', ')}. Only active internal employees are permitted.`
      );
    }

    return users;
  }

  /**
   * Compose and send a new internal message (Email/Mailbox style).
   * 100% internal within Kanvtech DB. Zero external SMTP/Nodemailer/APIs.
   */
  async composeMessage(params: {
    senderUserId: number;
    toUserIds: number[];
    ccUserIds?: number[];
    subject: string;
    message: string;
  }): Promise<any> {
    const { senderUserId, toUserIds, ccUserIds = [], subject, message } = params;

    if (!toUserIds || !Array.isArray(toUserIds) || toUserIds.length === 0) {
      throw new BadRequestException('At least one "To" recipient is mandatory.');
    }
    if (!subject || !subject.trim()) {
      throw new BadRequestException('Subject is mandatory for internal messages.');
    }
    if (!message || !message.trim()) {
      throw new BadRequestException('Message body cannot be empty.');
    }

    // Validate sender
    const sender = await this.prisma.user.findUnique({
      where: { id: senderUserId },
      include: { employee: { select: { id: true, name: true } } },
    });
    if (!sender || !sender.isActive || !EMPLOYEE_ROLES.includes(sender.role)) {
      throw new ForbiddenException('Only active Kanvtech employees can send internal messages.');
    }

    // Validate To and CC recipients
    const toUsers = await this.validateInternalEmployees(toUserIds);
    const ccCleanIds = (ccUserIds || []).filter((id) => !toUserIds.includes(id));
    const ccUsers = await this.validateInternalEmployees(ccCleanIds);

    const allRecipientIds = [...new Set([...toUsers.map((u) => u.id), ...ccUsers.map((u) => u.id)])].filter(
      (id) => id !== senderUserId
    );

    if (allRecipientIds.length === 0 && toUsers.length === 1 && toUsers[0].id === senderUserId) {
      throw new BadRequestException('You cannot send an internal message only to yourself.');
    }

    // All participants: Sender + To + Cc
    const allParticipantIds = [...new Set([senderUserId, ...toUsers.map((u) => u.id), ...ccUsers.map((u) => u.id)])];

    // Create Conversation thread
    const conversation = await this.prisma.chatConversation.create({
      data: {
        title: subject.trim(),
        isGroup: false,
        participants: {
          create: allParticipantIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // Create initial message
    const chatMsg = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderId: senderUserId,
        message: message.trim(),
      },
      include: {
        sender: { select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } } },
      },
    });

    // Mark as read immediately for the sender
    await this.prisma.chatReadReceipt.create({
      data: { messageId: chatMsg.id, userId: senderUserId },
    });

    // Create In-App Notifications for all recipients (To + CC)
    const senderName = sender.employee?.name || sender.email;
    const snippet = message.trim().length > 80 ? `${message.trim().substring(0, 80)}...` : message.trim();

    for (const recipientId of allRecipientIds) {
      await this.notificationsService.createInAppNotification(
        recipientId,
        `New message from ${senderName}`,
        `${subject.trim()} - ${snippet}`,
        'INTERNAL_MESSAGE',
        `/chat?id=${conversation.id}`
      );
    }

    // Audit log
    await this.auditService.log({
      actorUserId: senderUserId,
      action: 'INTERNAL_MESSAGE_SENT',
      entityType: 'CHAT_CONVERSATION',
      entityId: String(conversation.id),
      newValues: {
        subject: subject.trim(),
        toCount: toUsers.length,
        ccCount: ccUsers.length,
      },
    });

    return {
      success: true,
      conversationId: conversation.id,
      messageId: chatMsg.id,
      subject: conversation.title,
    };
  }

  /**
   * Reply or Reply All to an existing conversation thread.
   */
  async replyMessage(params: {
    conversationId: number;
    senderUserId: number;
    message: string;
    isReplyAll?: boolean;
  }): Promise<any> {
    const { conversationId, senderUserId, message, isReplyAll = false } = params;

    if (!message || !message.trim()) {
      throw new BadRequestException('Reply message cannot be empty.');
    }

    // Strictly check participant authorization
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId: senderUserId },
      include: { conversation: true },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not authorized to participate or reply in this conversation.');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderUserId },
      include: { employee: { select: { id: true, name: true } } },
    });
    if (!sender || !sender.isActive || !EMPLOYEE_ROLES.includes(sender.role)) {
      throw new ForbiddenException('Only active Kanvtech employees can send replies.');
    }

    // Create reply message in the existing thread
    const newMsg = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: senderUserId,
        message: message.trim(),
      },
      include: {
        sender: { select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } } },
      },
    });

    // Mark as read for sender
    await this.prisma.chatReadReceipt.create({
      data: { messageId: newMsg.id, userId: senderUserId },
    });

    // Find recipients to notify
    const allParticipants = await this.prisma.chatParticipant.findMany({
      where: { conversationId, userId: { not: senderUserId } },
    });

    let targetUserIds: number[] = [];
    if (isReplyAll) {
      // Notify all other participants
      targetUserIds = allParticipants.map((p) => p.userId);
    } else {
      // Standard Reply: Find the sender of the most recent message before this reply
      const previousMsg = await this.prisma.chatMessage.findFirst({
        where: { conversationId, senderId: { not: senderUserId } },
        orderBy: { createdAt: 'desc' },
      });
      if (previousMsg) {
        targetUserIds = [previousMsg.senderId];
      } else {
        targetUserIds = allParticipants.map((p) => p.userId);
      }
    }

    const senderName = sender.employee?.name || sender.email;
    const convTitle = isParticipant.conversation?.title || 'Internal Message';
    const snippet = message.trim().length > 80 ? `${message.trim().substring(0, 80)}...` : message.trim();

    for (const uid of targetUserIds) {
      await this.notificationsService.createInAppNotification(
        uid,
        `New reply from ${senderName}`,
        `Re: ${convTitle} - ${snippet}`,
        'INTERNAL_MESSAGE',
        `/chat?id=${conversationId}`
      );
    }

    await this.auditService.log({
      actorUserId: senderUserId,
      action: 'INTERNAL_MESSAGE_REPLY',
      entityType: 'CHAT_CONVERSATION',
      entityId: String(conversationId),
      newValues: { isReplyAll, recipientCount: targetUserIds.length },
    });

    return newMsg;
  }

  /**
   * Get conversations for user with Mailbox filtering (Inbox, Sent, Unread) and Search.
   * STRICT PARTICIPANT AUTHORIZATION: Users (even Admin) can ONLY see conversations they participate in.
   */
  async getConversationsForUser(
    userId: number,
    options: { folder?: 'inbox' | 'sent' | 'unread'; search?: string } = {}
  ) {
    const { folder = 'inbox', search } = options;

    const whereClause: any = {
      participants: { some: { userId } },
    };

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { messages: { some: { message: { contains: q, mode: 'insensitive' } } } },
        { participants: { some: { user: { employee: { name: { contains: q, mode: 'insensitive' } } } } } },
        { participants: { some: { user: { email: { contains: q, mode: 'insensitive' } } } } },
      ];
    }

    const conversations = await this.prisma.chatConversation.findMany({
      where: whereClause,
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                employee: { select: { id: true, name: true, designation: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                role: true,
                employee: { select: { id: true, name: true, designation: true } },
              },
            },
            readReceipts: { select: { userId: true, readAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich and apply folder filtering
    const enriched = conversations.map((conv) => {
      const firstMessage = conv.messages[conv.messages.length - 1] || null;
      const latestMessage = conv.messages[0] || null;

      const unreadCount = conv.messages.filter(
        (m) => m.senderId !== userId && !m.readReceipts.some((r) => r.userId === userId)
      ).length;

      const isSentByMe = firstMessage?.senderId === userId;

      return {
        ...conv,
        firstMessage,
        latestMessage,
        unreadCount,
        isSentByMe,
      };
    });

    // Sort by latest message date descending
    enriched.sort((a, b) => {
      const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    if (folder === 'sent') {
      return enriched.filter((c) => c.isSentByMe);
    }
    if (folder === 'unread') {
      return enriched.filter((c) => c.unreadCount > 0);
    }

    // Default inbox
    return enriched;
  }

  /**
   * Get single conversation details and complete message thread.
   */
  async getConversationDetails(conversationId: number, requestingUserId: number) {
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId: requestingUserId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not authorized to view this private conversation.');
    }

    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                employee: { select: { id: true, name: true, designation: true } },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                role: true,
                employee: { select: { id: true, name: true, designation: true } },
              },
            },
            readReceipts: { select: { userId: true, readAt: true } },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  /**
   * Get messages in a conversation (paginated or complete).
   */
  async getMessages(conversationId: number, requestingUserId: number, page = 1, limit = 50) {
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId: requestingUserId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('You are not authorized to view messages in this conversation.');
    }

    const skip = (page - 1) * limit;
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            role: true,
            employee: { select: { id: true, name: true, designation: true } },
          },
        },
        readReceipts: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return messages.reverse();
  }

  /**
   * Send a direct message in a conversation.
   */
  async sendMessage(conversationId: number, senderId: number, message: string): Promise<any> {
    return this.replyMessage({
      conversationId,
      senderUserId: senderId,
      message,
      isReplyAll: true,
    });
  }

  /**
   * Mark all unread messages in conversation as read for the user, and clear in-app notifications.
   */
  async markMessagesRead(conversationId: number, userId: number): Promise<void> {
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant in this conversation.');
    }

    const unread = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        readReceipts: { none: { userId } },
        senderId: { not: userId },
      },
      select: { id: true },
    });

    if (unread.length > 0) {
      await this.prisma.chatReadReceipt.createMany({
        data: unread.map((m) => ({ messageId: m.id, userId })),
        skipDuplicates: true,
      });
    }

    // Mark any associated notifications as read
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        OR: [
          { linkUrl: `/chat?id=${conversationId}` },
          { linkUrl: `/chat/${conversationId}` },
        ],
      },
      data: { isRead: true },
    });
  }

  /**
   * Get active internal employees for recipient selection.
   */
  async getActiveEmployeesForMessaging(requestingUserId: number) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: requestingUserId },
        role: { in: EMPLOYEE_ROLES },
        isActive: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            designation: true,
            department: true,
          },
        },
      },
      orderBy: { employee: { name: 'asc' } },
    });

    return users.map((u) => ({
      userId: u.id,
      email: u.email,
      role: u.role,
      name: u.employee?.name || u.email,
      designation: u.employee?.designation || u.role,
      department: u.employee?.department || 'General',
    }));
  }

  /**
   * Search employees.
   */
  async searchEmployeesForChat(query: string, requestingUserId: number) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: requestingUserId },
        role: { in: EMPLOYEE_ROLES },
        isActive: true,
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { employee: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            designation: true,
            department: true,
          },
        },
      },
      take: 25,
    });

    return users.map((u) => ({
      userId: u.id,
      email: u.email,
      role: u.role,
      name: u.employee?.name || u.email,
      designation: u.employee?.designation || u.role,
      department: u.employee?.department || 'General',
    }));
  }

  /**
   * Backward-compatible direct chat initiator
   */
  async getOrCreateDirectConversation(userId1: number, userId2: number): Promise<any> {
    const users = await this.validateInternalEmployees([userId2]);
    const targetUser = users[0];

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: { userId: { in: [userId1, userId2] } },
        },
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } },
            },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (existing) return existing;

    const targetName = targetUser.employee?.name || targetUser.email;
    return this.prisma.chatConversation.create({
      data: {
        title: `Message with ${targetName}`,
        isGroup: false,
        participants: {
          create: [{ userId: userId1 }, { userId: userId2 }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } },
            },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }
}

