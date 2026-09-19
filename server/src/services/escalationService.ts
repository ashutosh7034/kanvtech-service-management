import { db } from '../db/database';
import { Ticket, TicketLevel } from '../types';
import { AssignmentService } from './assignmentService';
import { TimerService } from './timerService';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export class EscalationService {
  /**
   * Validates escalation hierarchy transition rules.
   */
  public static validateHierarchy(fromLevel: string, toLevel: string): void {
    if (fromLevel === 'L1' && toLevel !== 'L2') {
      throw new Error('L1 support can only escalate to L2.');
    }
    if (fromLevel === 'L2' && toLevel !== 'L3') {
      throw new Error('L2 support can only escalate to L3.');
    }
    if (fromLevel === 'L3' && toLevel !== 'PARENT_COMPANY') {
      throw new Error('L3 support can only escalate to Parent Company / Principal Vendor.');
    }
  }

  /**
   * Escalates a ticket to the next operational tier with immutable history logging and continuous timer handoff.
   */
  public static async escalateTicket(params: {
    ticketId: string;
    fromLevel: 'L1' | 'L2' | 'L3';
    toLevel: 'L2' | 'L3' | 'PARENT_COMPANY';
    escalatedByEmployeeId: string;
    assignedToEmployeeId?: string | null;
    reason: string;
    notes?: string;
    actorUserId: number;
  }): Promise<void> {
    // 1. Verify hierarchy
    this.validateHierarchy(params.fromLevel, params.toLevel);

    // 2. Fetch ticket
    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [params.ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    if (ticket.status !== 'IN_PROGRESS' && ticket.status !== 'OPEN') {
      throw new Error(`Cannot escalate ticket in '${ticket.status}' status. Ticket must be IN_PROGRESS.`);
    }

    let targetEmployeeId = params.assignedToEmployeeId;

    // 3. Validate designated employee or auto-find best available at toLevel
    if (targetEmployeeId && params.toLevel !== 'PARENT_COMPANY') {
      const targetEmp = await db.query<any>('SELECT * FROM employees WHERE id = ?', [targetEmployeeId]);
      if (targetEmp.length === 0) throw new Error('Designated escalation specialist not found.');
      if (targetEmp[0].status !== 'ACTIVE') {
        throw new Error(`Cannot escalate to employee ${targetEmp[0].name} because their status is ${targetEmp[0].status}.`);
      }
      if (targetEmp[0].level !== params.toLevel) {
        throw new Error(`Tier mismatch: Cannot assign ticket escalated to ${params.toLevel} to employee ${targetEmp[0].name} who is configured at ${targetEmp[0].level}.`);
      }
    } else if (!targetEmployeeId && params.toLevel !== 'PARENT_COMPANY') {
      const bestEmp = await AssignmentService.findBestAvailableEmployee(params.toLevel as TicketLevel);
      if (bestEmp) {
        targetEmployeeId = bestEmp.id;
      }
    }

    // 4. Record immutable escalation entry
    await db.execute(
      `INSERT INTO ticket_escalations (ticket_id, from_level, to_level, escalated_by_employee_id, assigned_to_employee_id, reason, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.ticketId,
        params.fromLevel,
        params.toLevel,
        params.escalatedByEmployeeId,
        targetEmployeeId || null,
        params.reason.trim(),
        params.notes?.trim() || null,
      ]
    );

    // 5. Hand off resolution timer across escalation (closes old level session, opens new session)
    if (targetEmployeeId) {
      await TimerService.handoffSessionAcrossEscalation(params.ticketId, targetEmployeeId, params.toLevel as TicketLevel);
    } else {
      await TimerService.stopActiveSession(params.ticketId);
    }

    // 6. Update ticket record
    await db.execute(
      `UPDATE tickets SET
         assigned_level = ?,
         assigned_employee_id = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [params.toLevel, targetEmployeeId || null, params.ticketId]
    );

    // 7. Re-assign in ticket_assignments if an employee was designated
    if (targetEmployeeId) {
      await db.execute(
        `UPDATE ticket_assignments SET unassigned_at = CURRENT_TIMESTAMP 
         WHERE ticket_id = ? AND unassigned_at IS NULL`,
        [params.ticketId]
      );
      await db.execute(
        `INSERT INTO ticket_assignments (ticket_id, employee_id, level, assigned_by, assignment_type)
         VALUES (?, ?, ?, ?, 'MANUAL')`,
        [params.ticketId, targetEmployeeId, params.toLevel, params.actorUserId]
      );
    }

    // 8. Log in chronological ticket timeline
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description, metadata_json)
       VALUES (?, ?, 'ESCALATED', ?, ?, ?)`,
      [
        params.ticketId,
        params.actorUserId,
        `Escalated: ${params.fromLevel} → ${params.toLevel}`,
        `Reason: ${params.reason}. ${params.notes ? 'Notes: ' + params.notes : ''}`,
        JSON.stringify({
          fromLevel: params.fromLevel,
          toLevel: params.toLevel,
          escalatedBy: params.escalatedByEmployeeId,
          assignedTo: targetEmployeeId,
        }),
      ]
    );

    // 9. Notify operations / target employee
    if (targetEmployeeId) {
      const empRows = await db.query<any>('SELECT user_id, email, name FROM employees WHERE id = ?', [targetEmployeeId]);
      if (empRows.length > 0) {
        await NotificationService.broadcastTicketEvent({
          eventType: 'TICKET_ESCALATED',
          ticketId: params.ticketId,
          title: `Ticket Escalated to ${params.toLevel}: ${params.ticketId}`,
          message: `Ticket ${params.ticketId} escalated from ${params.fromLevel} to ${params.toLevel}. Reason: ${params.reason}`,
          recipientUserId: empRows[0].user_id,
          recipientEmail: empRows[0].email,
          linkUrl: `/tickets/${params.ticketId}`,
        });
      }
    }

    await AuditService.log({
      actorUserId: params.actorUserId,
      action: 'TICKET_ESCALATED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { fromLevel: params.fromLevel, toLevel: params.toLevel, reason: params.reason },
    });
  }
}
