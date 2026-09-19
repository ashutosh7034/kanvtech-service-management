import { db } from '../db/database';
import { Ticket } from '../types';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';
import { SLAService } from './slaService';

export class ClosureService {
  /**
   * Finalizes ticket closure following the authorized operational workflow.
   */
  public static async closeTicket(params: {
    ticketId: string;
    closedByUserId: number;
    closureReason: string;
    source?: 'FEEDBACK' | 'MANUAL' | 'AUTO_TIMEOUT';
  }): Promise<void> {
    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [params.ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    if (ticket.status === 'CLOSED') {
      return; // Already closed
    }

    // Must be in CUSTOMER_FEEDBACK, MANAGER_REVIEW, or explicitly forced by Admin/Manager
    if (!['CUSTOMER_FEEDBACK', 'MANAGER_REVIEW', 'RESOLVED'].includes(ticket.status)) {
      throw new Error(`Cannot close ticket in '${ticket.status}' status. Ticket must be resolved and reviewed.`);
    }

    // Determine final SLA Met/Breached result
    const slaResult = SLAService.computeSLAStatus({
      createdAt: ticket.created_at,
      deadline: ticket.sla_deadline || null,
      status: 'CLOSED',
      resolvedAt: ticket.resolution_ended_at || new Date(),
    });

    // Update ticket to CLOSED
    await db.execute(
      `UPDATE tickets SET
         status = 'CLOSED',
         sla_status = ?,
         closed_at = CURRENT_TIMESTAMP,
         closed_by = ?,
         closure_reason = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [slaResult.status, params.closedByUserId, params.closureReason.trim(), params.ticketId]
    );

    // Timeline entry
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description, metadata_json)
       VALUES (?, ?, 'CLOSED', 'Ticket Successfully Closed', ?, ?)`,
      [
        params.ticketId,
        params.closedByUserId,
        params.closureReason,
        JSON.stringify({
          closedBy: params.closedByUserId,
          reason: params.closureReason,
          finalSlaStatus: slaResult.status,
          totalResolutionSeconds: ticket.total_resolution_seconds,
        }),
      ]
    );

    // Notify Customer & Assigned Employee
    const contactRows = await db.query<any>('SELECT user_id, email FROM company_contacts WHERE id = ?', [ticket.customer_contact_id]);
    if (contactRows.length > 0) {
      await NotificationService.broadcastTicketEvent({
        eventType: 'TICKET_CLOSED',
        ticketId: params.ticketId,
        title: `Ticket Closed: ${params.ticketId}`,
        message: `Your service ticket ${params.ticketId} has been closed. Thank you for partnering with Kanvtech.`,
        recipientUserId: contactRows[0].user_id,
        recipientEmail: contactRows[0].email,
        linkUrl: `/tickets/${params.ticketId}`,
      });
    }

    await AuditService.log({
      actorUserId: params.closedByUserId,
      action: 'TICKET_CLOSED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { closureReason: params.closureReason, finalSlaStatus: slaResult.status },
    });
  }
}
