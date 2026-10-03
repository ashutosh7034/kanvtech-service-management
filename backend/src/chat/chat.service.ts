import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get or create a direct conversation between two users.
   * Customers cannot access this endpoint (enforced at controller).
   */
  async getOrCreateDirectConversation(userId1: number, userId2: number): Promise<any> {
    // Find existing direct conversation between these two users
    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: {
            userId: { in: [userId1, userId2] },
          },
        },
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } },
        ],
      },
      include: {
        participants: { include: { user: { select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (existing) return existing;

    // Create new
    const conversation = await this.prisma.chatConversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId: userId1 },
            { userId: userId2 },
          ],
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    return conversation;
  }

  async createGroupConversation(creatorUserId: number, participantUserIds: number[], title?: string): Promise<any> {
    const allIds = [...new Set([creatorUserId, ...participantUserIds])];

    const conversation = await this.prisma.chatConversation.create({
      data: {
        isGroup: true,
        title: title?.trim() || null,
        participants: {
          create: allIds.map((uid) => ({ userId: uid })),
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } } } } },
      },
    });

    return conversation;
  }

  async getConversationsForUser(userId: number) {
    const conversations = await this.prisma.chatConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: {
          include: {
            user: { select: { id: true, email: true, role: true, employee: { select: { id: true, name: true } } } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with unread count
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: conv.id,
            readReceipts: { none: { userId } },
            senderId: { not: userId },
          },
        });
        return { ...conv, unreadCount };
      }),
    );

    return enriched;
  }

  async getMessages(conversationId: number, requestingUserId: number, page = 1, limit = 50) {
    // Verify user is participant
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId: requestingUserId },
    });
    if (!isParticipant) throw new ForbiddenException('You are not a participant in this conversation.');

    const skip = (page - 1) * limit;
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, email: true, role: true, employee: { select: { name: true } } } },
        readReceipts: { select: { userId: true, readAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    return messages.reverse();
  }

  async sendMessage(conversationId: number, senderId: number, message: string): Promise<any> {
    // Verify sender is participant
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId: senderId },
    });
    if (!isParticipant) throw new ForbiddenException('You are not a participant in this conversation.');

    const newMsg = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId,
        message: message.trim(),
      },
      include: {
        sender: { select: { id: true, email: true, role: true, employee: { select: { name: true } } } },
      },
    });

    // Mark as read by sender immediately
    await this.prisma.chatReadReceipt.create({
      data: { messageId: newMsg.id, userId: senderId },
    });

    // Notify other participants
    const participants = await this.prisma.chatParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
    });
    const senderName = newMsg.sender.employee?.name || newMsg.sender.email;

    for (const p of participants) {
      await this.notificationsService.createInAppNotification(
        p.userId,
        'New Message',
        `${senderName}: ${message.trim().substring(0, 80)}${message.length > 80 ? '...' : ''}`,
        'CHAT_MESSAGE',
        `/chat/${conversationId}`,
      );
    }

    return newMsg;
  }

  async markMessagesRead(conversationId: number, userId: number): Promise<void> {
    // Verify participant
    const isParticipant = await this.prisma.chatParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!isParticipant) throw new ForbiddenException('Not a participant.');

    const unread = await this.prisma.chatMessage.findMany({
      where: {
        conversationId,
        readReceipts: { none: { userId } },
        senderId: { not: userId },
      },
      select: { id: true },
    });

    await this.prisma.chatReadReceipt.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });
  }

  async searchEmployeesForChat(query: string, requestingUserId: number) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: requestingUserId },
        role: { in: ['ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'] },
        isActive: true,
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { employee: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        email: true,
        role: true,
        employee: { select: { id: true, name: true, designation: true, department: true } },
      },
      take: 20,
    });
    return users;
  }
}
