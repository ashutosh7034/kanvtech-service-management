import { db } from '../db/database';
import { Ticket } from '../types';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export class ApprovalService {
  /**
   * Submits a ticket for Manager Review upon employee resolution.
   */
  public static async submitForReview(params: {
    ticketId: string;
    employeeId: string;
    resolutionNotes: string;
    actorUserId: number;
  }): Promise<void> {
    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [params.ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    if (ticket.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot resolve ticket in '${ticket.status}' status. Ticket must be IN_PROGRESS.`);
    }

    // Stop active work session
    const { TimerService } = require('./timerService');
    await TimerService.stopActiveSession(params.ticketId);

    // Update ticket status
    await db.execute(
      `UPDATE tickets SET
         status = 'MANAGER_REVIEW',
         resolution_ended_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [params.ticketId]
    );

    // Add resolution comment
    await db.execute(
      `INSERT INTO ticket_comments (ticket_id, author_user_id, comment_type, message)
       VALUES (?, ?, 'INTERNAL_NOTE', ?)`,
      [params.ticketId, params.actorUserId, `Resolution Notes: ${params.resolutionNotes}`]
    );

    // Log in timeline
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description, metadata_json)
       VALUES (?, ?, 'RESOLVED', 'Ticket Resolved by Specialist', ?, ?)`,
      [
        params.ticketId,
        params.actorUserId,
        params.resolutionNotes,
        JSON.stringify({ employeeId: params.employeeId, resolutionNotes: params.resolutionNotes }),
      ]
    );

    // Notify managers
    const managers = await db.query<any>('SELECT user_id, email FROM employees WHERE manager_id IS NULL AND status = \'ACTIVE\'');
    for (const m of managers) {
      await NotificationService.broadcastTicketEvent({
        eventType: 'TICKET_REVIEW_REQUIRED',
        ticketId: params.ticketId,
        title: `Manager Review Required: ${params.ticketId}`,
        message: `Ticket ${params.ticketId} has been resolved and is pending manager review.`,
        recipientUserId: m.user_id,
        recipientEmail: m.email,
        linkUrl: `/approvals`,
      });
    }

    await AuditService.log({
      actorUserId: params.actorUserId,
      action: 'TICKET_RESOLVED_SUBMITTED_FOR_REVIEW',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { resolutionNotes: params.resolutionNotes },
    });
  }

  /**
   * Manager approves resolution; ticket advances to CUSTOMER_FEEDBACK.
   */
  public static async approveResolution(params: {
    ticketId: string;
    managerUserId: number;
    notes?: string;
  }): Promise<void> {
    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [params.ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    if (ticket.status !== 'MANAGER_REVIEW') {
      throw new Error(`Ticket is not in MANAGER_REVIEW state (Current: ${ticket.status})`);
    }

    await db.execute(
      `UPDATE tickets SET
         status = 'CUSTOMER_FEEDBACK',
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [params.ticketId]
    );

    // Timeline entry
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description)
       VALUES (?, ?, 'REVIEW_APPROVED', 'Resolution Approved by Manager', ?)`,
      [params.ticketId, params.managerUserId, params.notes || 'Manager approved the technical resolution. Requesting customer feedback.']
    );

    // Notify Customer
    const contactRows = await db.query<any>(
      `SELECT cc.user_id, cc.email, cc.name 
       FROM company_contacts cc 
       WHERE cc.id = ?`,
      [ticket.customer_contact_id]
    );

    if (contactRows.length > 0) {
      await NotificationService.broadcastTicketEvent({
        eventType: 'FEEDBACK_REQUESTED',
        ticketId: params.ticketId,
        title: `Your Ticket is Resolved: ${params.ticketId}`,
        message: `Your ticket has been resolved. Please rate your experience and provide your feedback.`,
        recipientUserId: contactRows[0].user_id,
        recipientEmail: contactRows[0].email,
        linkUrl: `/tickets/${params.ticketId}`,
      });
    }

    await AuditService.log({
      actorUserId: params.managerUserId,
      action: 'MANAGER_APPROVED_RESOLUTION',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { approvalNotes: params.notes },
    });
  }

  /**
   * Manager rejects/reopens resolution; sends back to IN_PROGRESS with explanation.
   */
  public static async reopenResolution(params: {
    ticketId: string;
    managerUserId: number;
    reason: string;
  }): Promise<void> {
    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [params.ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    if (ticket.status !== 'MANAGER_REVIEW' && ticket.status !== 'RESOLVED') {
      throw new Error(`Ticket cannot be reopened from '${ticket.status}'.`);
    }

    await db.execute(
      `UPDATE tickets SET
         status = 'IN_PROGRESS',
         resolution_ended_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [params.ticketId]
    );

    // Reopen comment
    await db.execute(
      `INSERT INTO ticket_comments (ticket_id, author_user_id, comment_type, message)
       VALUES (?, ?, 'INTERNAL_NOTE', ?)`,
      [params.ticketId, params.managerUserId, `Reopened by Manager: ${params.reason}`]
    );

    // Timeline entry
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description)
       VALUES (?, ?, 'REVIEW_REOPENED', 'Resolution Sent Back / Reopened by Manager', ?)`,
      [params.ticketId, params.managerUserId, params.reason]
    );

    // Re-engage timer session if assigned employee exists
    if (ticket.assigned_employee_id) {
      const { TimerService } = require('./timerService');
      await TimerService.startWorkSession(ticket.id, ticket.assigned_employee_id, ticket.assigned_level);

      const empRows = await db.query<any>('SELECT user_id, email FROM employees WHERE id = ?', [ticket.assigned_employee_id]);
      if (empRows.length > 0) {
        await NotificationService.broadcastTicketEvent({
          eventType: 'TICKET_REOPENED',
          ticketId: params.ticketId,
          title: `Ticket Reopened: ${params.ticketId}`,
          message: `Manager requested additional work on ticket ${params.ticketId}. Reason: ${params.reason}`,
          recipientUserId: empRows[0].user_id,
          recipientEmail: empRows[0].email,
          linkUrl: `/tickets/${params.ticketId}`,
        });
      }
    }

    await AuditService.log({
      actorUserId: params.managerUserId,
      action: 'MANAGER_REOPENED_TICKET',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { reason: params.reason },
    });
  }
}
