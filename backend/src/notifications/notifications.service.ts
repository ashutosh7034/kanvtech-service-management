import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel } from '@prisma/client';

export interface NotificationPayload {
  userId?: number;
  recipient: string;
  eventType: string;
  title: string;
  message: string;
  linkUrl?: string;
  metadata?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    try {
      if (payload.userId) {
        await this.prisma.notification.create({
          data: {
            userId: payload.userId,
            title: payload.title,
            message: payload.message,
            type: payload.eventType,
            isRead: false,
            linkUrl: payload.linkUrl || null,
          },
        });
      }

      await this.prisma.notificationLog.create({
        data: {
          channel,
          recipient: payload.recipient || 'system',
          eventType: payload.eventType,
          payloadJson: JSON.stringify(payload),
          status: 'SENT',
          errorMessage: null,
        },
      });
    } catch (err: any) {
      this.logger.error(`[NotificationService] Error dispatching notification: ${err.message}`);
    }
  }

  async broadcastTicketEvent(event: {
    eventType: string;
    ticketId: string;
    title: string;
    message: string;
    recipientUserId?: number;
    recipientEmail?: string;
    linkUrl?: string;
  }): Promise<void> {
    if (event.recipientUserId) {
      await this.notify(NotificationChannel.IN_APP, {
        userId: event.recipientUserId,
        recipient: event.recipientEmail || 'user',
        eventType: event.eventType,
        title: event.title,
        message: event.message,
        linkUrl: event.linkUrl,
      });
    }

    if (event.recipientEmail) {
      await this.notify(NotificationChannel.EMAIL, {
        recipient: event.recipientEmail,
        eventType: event.eventType,
        title: event.title,
        message: event.message,
        linkUrl: event.linkUrl,
      });
    }
  }

  async getUserNotifications(userId: number) {
    const list = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return list.map((n) => ({
      id: n.id,
      user_id: n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      is_read: n.isRead ? 1 : 0,
      link_url: n.linkUrl,
      created_at: n.createdAt,
    }));
  }

  async markAsRead(notificationId: number, userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId },
      data: { isRead: true },
    });
  }
}
