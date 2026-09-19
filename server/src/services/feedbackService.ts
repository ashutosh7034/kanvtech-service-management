import { db } from '../db/database';
import { Ticket, TicketFeedback } from '../types';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { ClosureService } from './closureService';

export class FeedbackService {
  public static async submitFeedback(params: {
    ticketId: string;
    customerUserId: number;
    rating: number; // 1 to 5
    remarks?: string;
  }): Promise<void> {
    if (params.rating < 1 || params.rating > 5) {
      throw new Error('Rating must be an integer between 1 and 5 stars.');
    }

    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [params.ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    // Check existing feedback
    const existingFeedback = await db.query<TicketFeedback>(
      'SELECT id FROM ticket_feedback WHERE ticket_id = ?',
      [params.ticketId]
    );
    if (existingFeedback.length > 0) {
      throw new Error('Feedback has already been submitted for this ticket.');
    }

    // Insert feedback
    await db.execute(
      `INSERT INTO ticket_feedback (ticket_id, customer_user_id, rating, remarks)
       VALUES (?, ?, ?, ?)`,
      [params.ticketId, params.customerUserId, params.rating, params.remarks?.trim() || null]
    );

    // Timeline entry
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description, metadata_json)
       VALUES (?, ?, 'FEEDBACK_SUBMITTED', ?, ?, ?)`,
      [
        params.ticketId,
        params.customerUserId,
        `Customer Feedback Received: ${params.rating} / 5 Stars`,
        params.remarks ? `Remarks: "${params.remarks}"` : 'No additional remarks provided.',
        JSON.stringify({ rating: params.rating, remarks: params.remarks }),
      ]
    );

    await AuditService.log({
      actorUserId: params.customerUserId,
      action: 'CUSTOMER_FEEDBACK_SUBMITTED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { rating: params.rating, remarks: params.remarks },
    });

    // Auto-close ticket upon receiving feedback
    await ClosureService.closeTicket({
      ticketId: params.ticketId,
      closedByUserId: params.customerUserId,
      closureReason: `Closed automatically following customer feedback (${params.rating}/5 stars).`,
      source: 'FEEDBACK',
    });
  }

  public static async getFeedback(ticketId: string): Promise<any | null> {
    const rows = await db.query<any>(
      `SELECT f.*, u.email as customer_email, cc.name as customer_name
       FROM ticket_feedback f
       LEFT JOIN users u ON f.customer_user_id = u.id
       LEFT JOIN company_contacts cc ON cc.user_id = u.id
       WHERE f.ticket_id = ?`,
      [ticketId]
    );
    return rows.length > 0 ? rows[0] : null;
  }
}
