import { db } from '../db/database';
import { NotificationChannel } from '../types';

export interface NotificationPayload {
  userId?: number;
  recipient: string;
  eventType: string;
  title: string;
  message: string;
  linkUrl?: string;
  metadata?: any;
}

export interface INotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }>;
}

class EmailProvider implements INotificationProvider {
  channel: NotificationChannel = 'EMAIL';
  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    // Enterprise email provider abstraction (SMTP / Resend / Sendgrid)
    console.log(`[EmailProvider] Sending Email to: ${payload.recipient} | Subject: ${payload.title}`);
    return { success: true };
  }
}

class WhatsAppProvider implements INotificationProvider {
  channel: NotificationChannel = 'WHATSAPP';
  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    // Enterprise WhatsApp Cloud API / Twilio abstraction
    console.log(`[WhatsAppProvider] Sending WhatsApp message to: ${payload.recipient} | Content: ${payload.title}`);
    return { success: true };
  }
}

class PushProvider implements INotificationProvider {
  channel: NotificationChannel = 'PUSH';
  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    // WebPush / FCM notification abstraction
    console.log(`[PushProvider] Sending Mobile/Web Push to: ${payload.recipient} | Title: ${payload.title}`);
    return { success: true };
  }
}

export class NotificationService {
  private static providers: Record<NotificationChannel, INotificationProvider> = {
    EMAIL: new EmailProvider(),
    WHATSAPP: new WhatsAppProvider(),
    PUSH: new PushProvider(),
    IN_APP: {
      channel: 'IN_APP',
      send: async () => ({ success: true }),
    },
  };

  public static async notify(
    channel: NotificationChannel,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      // 1. If In-App, save to notifications table
      if (payload.userId) {
        await db.execute(
          `INSERT INTO notifications (user_id, title, message, type, is_read, link_url)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [payload.userId, payload.title, payload.message, payload.eventType, payload.linkUrl || null]
        );
      }

      // 2. Dispatch via external provider
      const provider = this.providers[channel];
      let status: 'SENT' | 'FAILED' = 'SENT';
      let errorMessage: string | null = null;

      if (provider && channel !== 'IN_APP') {
        const result = await provider.send(payload);
        if (!result.success) {
          status = 'FAILED';
          errorMessage = result.error || 'Provider dispatch failed';
        }
      }

      // 3. Log into notification_logs
      await db.execute(
        `INSERT INTO notification_logs (channel, recipient, event_type, payload_json, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          channel,
          payload.recipient || 'system',
          payload.eventType,
          JSON.stringify(payload),
          status,
          errorMessage,
        ]
      );
    } catch (err: any) {
      console.error('[NotificationService] Error dispatching notification:', err);
    }
  }

  public static async broadcastTicketEvent(event: {
    eventType: string;
    ticketId: string;
    title: string;
    message: string;
    recipientUserId?: number;
    recipientEmail?: string;
    linkUrl?: string;
  }): Promise<void> {
    // In-app notification
    if (event.recipientUserId) {
      await this.notify('IN_APP', {
        userId: event.recipientUserId,
        recipient: event.recipientEmail || 'user',
        eventType: event.eventType,
        title: event.title,
        message: event.message,
        linkUrl: event.linkUrl,
      });
    }

    // Email notification
    if (event.recipientEmail) {
      await this.notify('EMAIL', {
        recipient: event.recipientEmail,
        eventType: event.eventType,
        title: event.title,
        message: event.message,
        linkUrl: event.linkUrl,
      });
    }
  }

  public static async getUserNotifications(userId: number): Promise<any[]> {
    return db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );
  }

  public static async markAsRead(notificationId: number, userId: number): Promise<void> {
    await db.execute(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
  }

  public static async markAllAsRead(userId: number): Promise<void> {
    await db.execute(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      [userId]
    );
  }
}
