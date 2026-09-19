import { db } from '../db/database';
import { Employee, TicketLevel } from '../types';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export class AssignmentService {
  /**
   * Finds the best eligible employee for auto-assignment based on level, active status, availability, and lowest workload.
   */
  public static async findBestAvailableEmployee(targetLevel: TicketLevel = 'L1'): Promise<Employee | null> {
    const rows = await db.query<any>(
      `SELECT e.*,
              (SELECT COUNT(*) FROM tickets t WHERE t.assigned_employee_id = e.id AND t.status IN ('OPEN', 'IN_PROGRESS')) as active_workload
       FROM employees e
       WHERE e.level = ? 
         AND e.status = 'ACTIVE' 
         AND e.availability = 'AVAILABLE'
       ORDER BY active_workload ASC, e.created_at ASC
       LIMIT 1`,
      [targetLevel]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Assigns a ticket to an employee, updating ticket status, creating assignment history, and notifying employee.
   */
  public static async assignTicket(params: {
    ticketId: string;
    employeeId: string;
    level: TicketLevel;
    assignedByUserId: number;
    assignmentType: 'AUTO' | 'MANUAL';
    notes?: string;
  }): Promise<void> {
    const empRows = await db.query<Employee>('SELECT * FROM employees WHERE id = ?', [params.employeeId]);
    if (empRows.length === 0) throw new Error('Target employee not found');
    const employee = empRows[0];

    if (employee.status !== 'ACTIVE') {
      throw new Error(`Cannot assign ticket to employee ${employee.name} because their status is ${employee.status}.`);
    }
    if (employee.level !== params.level) {
      throw new Error(`Tier mismatch: Employee ${employee.name} is configured at tier ${employee.level}, but ticket assignment requested ${params.level}.`);
    }

    // 1. Close any prior open assignment
    await db.execute(
      `UPDATE ticket_assignments SET unassigned_at = CURRENT_TIMESTAMP 
       WHERE ticket_id = ? AND unassigned_at IS NULL`,
      [params.ticketId]
    );

    // 2. Insert new assignment record
    await db.execute(
      `INSERT INTO ticket_assignments (ticket_id, employee_id, level, assigned_by, assignment_type)
       VALUES (?, ?, ?, ?, ?)`,
      [params.ticketId, params.employeeId, params.level, params.assignedByUserId, params.assignmentType]
    );

    // 3. Update ticket row
    await db.execute(
      `UPDATE tickets SET
         assigned_employee_id = ?,
         assigned_level = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [params.employeeId, params.level, params.ticketId]
    );

    // 4. Log to ticket_history
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description, metadata_json)
       VALUES (?, ?, 'ASSIGNED', ?, ?, ?)`,
      [
        params.ticketId,
        params.assignedByUserId,
        `Assigned to ${employee.name} (${params.level})`,
        params.notes || `Ticket assigned via ${params.assignmentType.toLowerCase()} routing.`,
        JSON.stringify({ employeeId: params.employeeId, level: params.level, type: params.assignmentType }),
      ]
    );

    // 5. Notify assigned employee
    await NotificationService.broadcastTicketEvent({
      eventType: 'TICKET_ASSIGNED',
      ticketId: params.ticketId,
      title: `New Ticket Assigned: ${params.ticketId}`,
      message: `You have been assigned ticket ${params.ticketId} (${params.level}).`,
      recipientUserId: employee.user_id,
      recipientEmail: employee.email,
      linkUrl: `/tickets/${params.ticketId}`,
    });

    await AuditService.log({
      actorUserId: params.assignedByUserId,
      action: 'TICKET_ASSIGNED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { employeeId: params.employeeId, level: params.level, type: params.assignmentType },
    });
  }
}
