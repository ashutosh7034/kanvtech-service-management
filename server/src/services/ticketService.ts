import { db } from '../db/database';
import { Ticket, TicketPriority, TicketStatus, TicketLevel } from '../types';
import { AssignmentService } from './assignmentService';
import { SLAService } from './slaService';
import { TimerService } from './timerService';
import { AuditService } from './auditService';
import { NotificationService } from './notificationService';

export class TicketService {
  /**
   * Centralized unique ticket ID generator: KT-YYYY-000001
   */
  public static async generateTicketId(): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await db.query<any>('SELECT id FROM tickets WHERE id LIKE ?', [`KT-${year}-%`]);
    let maxSeq = 0;
    for (const r of rows) {
      const match = r.id?.match(/^KT-\d{4}-(\d+)$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    return `KT-${year}-${String(maxSeq + 1).padStart(6, '0')}`;
  }

  /**
   * Enforces the two-open-ticket rule per customer contact.
   */
  public static async validateTwoOpenTicketRule(customerContactId: number): Promise<void> {
    const activeStatusList = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK'];
    const placeholders = activeStatusList.map(() => '?').join(',');

    const rows = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM tickets 
       WHERE customer_contact_id = ? AND status IN (${placeholders})`,
      [customerContactId, ...activeStatusList]
    );

    const activeCount = rows[0]?.count || 0;
    if (activeCount >= 2) {
      throw new Error(
        'Customer currently has 2 active tickets in progress. Per Kanvtech policy, a new ticket cannot be opened until an existing ticket is closed.'
      );
    }
  }

  /**
   * Creates a new support ticket (Customer Portal, Manual Portal, or API/Email).
   */
  public static async createTicket(params: {
    companyId: string;
    customerContactId: number;
    problemType: string;
    priority: TicketPriority;
    category: string;
    description: string;
    createdByUserId: number;
    assignedEmployeeId?: string | null;
  }): Promise<Ticket> {
    // 1. Strict Two-Open-Ticket Rule Validation on Backend
    await this.validateTwoOpenTicketRule(params.customerContactId);

    // 2. Centralized Ticket ID Generation
    const ticketId = await this.generateTicketId();

    // 3. Calculate SLA Deadline
    const now = new Date();
    const slaDeadline = await SLAService.calculateDeadline(params.priority, now);

    // 4. Determine initial assignment: if not provided, attempt auto-assignment to available L1
    let assignedEmployeeId = params.assignedEmployeeId || null;
    let initialAssignmentType: 'AUTO' | 'MANUAL' = 'MANUAL';

    if (!assignedEmployeeId) {
      const bestL1 = await AssignmentService.findBestAvailableEmployee('L1');
      if (bestL1) {
        assignedEmployeeId = bestL1.id;
        initialAssignmentType = 'AUTO';
      }
    }

    // 5. Insert Ticket Record
    await db.execute(
      `INSERT INTO tickets (
        id, company_id, customer_contact_id, problem_type, priority, category,
        description, created_by, assigned_employee_id, assigned_level, status,
        sla_priority, sla_deadline, sla_status, total_resolution_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'L1', 'OPEN', ?, ?, 'ON_TRACK', 0)`,
      [
        ticketId,
        params.companyId,
        params.customerContactId,
        params.problemType.trim(),
        params.priority,
        params.category.trim(),
        params.description.trim(),
        params.createdByUserId,
        assignedEmployeeId,
        params.priority,
        slaDeadline.toISOString().slice(0, 19).replace('T', ' '),
      ]
    );

    // 6. Record Initial Timeline Entry
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description)
       VALUES (?, ?, 'CREATED', 'Ticket Created', ?)`,
      [ticketId, params.createdByUserId, `Ticket opened with priority ${params.priority}. Description: ${params.description}`]
    );

    // 7. If assigned, record in ticket_assignments and notify
    if (assignedEmployeeId) {
      await AssignmentService.assignTicket({
        ticketId,
        employeeId: assignedEmployeeId,
        level: 'L1',
        assignedByUserId: params.createdByUserId,
        assignmentType: initialAssignmentType,
        notes: initialAssignmentType === 'AUTO' ? 'Auto-routed to available L1 specialist' : 'Assigned upon ticket creation',
      });
    }

    // 8. Notify Customer
    const contactRows = await db.query<any>('SELECT user_id, email, name FROM company_contacts WHERE id = ?', [params.customerContactId]);
    if (contactRows.length > 0) {
      await NotificationService.broadcastTicketEvent({
        eventType: 'TICKET_CREATED',
        ticketId,
        title: `Ticket Confirmed: ${ticketId}`,
        message: `Your ticket has been logged and assigned ID ${ticketId}. Our L1 support team will begin work promptly.`,
        recipientUserId: contactRows[0].user_id,
        recipientEmail: contactRows[0].email,
        linkUrl: `/tickets/${ticketId}`,
      });
    }

    await AuditService.log({
      actorUserId: params.createdByUserId,
      action: 'TICKET_CREATED',
      entityType: 'TICKET',
      entityId: ticketId,
      newValues: { id: ticketId, companyId: params.companyId, priority: params.priority },
    });

    const created = await this.getTicketById(ticketId);
    return created!;
  }

  /**
   * Retrieves a ticket with enriched company, contact, employee, timer, and SLA data.
   */
  public static async getTicketById(id: string): Promise<any | null> {
    const rows = await db.query<any>(
      `SELECT t.*,
              c.company_name, c.gstn as company_gstn, c.primary_email as company_email,
              cc.name as contact_name, cc.phone as contact_phone, cc.email as contact_email, cc.designation as contact_designation,
              e.name as assigned_employee_name, e.email as assigned_employee_email, e.level as assigned_employee_level, e.phone as assigned_employee_phone,
              u.email as creator_email
       FROM tickets t
       LEFT JOIN companies c ON t.company_id = c.id
       LEFT JOIN company_contacts cc ON t.customer_contact_id = cc.id
       LEFT JOIN employees e ON t.assigned_employee_id = e.id
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) return null;
    const ticket = rows[0];

    // Compute active SLA info
    const slaInfo = SLAService.computeSLAStatus({
      createdAt: ticket.created_at,
      deadline: ticket.sla_deadline,
      status: ticket.status,
      resolvedAt: ticket.resolution_ended_at,
    });

    // Compute Resolution Timer stats
    const timerStats = await TimerService.getTotalResolutionTime(id);

    // Timeline History
    const timeline = await db.query<any>(
      `SELECT h.*, u.email as actor_email, u.role as actor_role
       FROM ticket_history h
       LEFT JOIN users u ON h.actor_user_id = u.id
       WHERE h.ticket_id = ?
       ORDER BY h.created_at ASC`,
      [id]
    );

    // Comments
    const comments = await db.query<any>(
      `SELECT cm.*, u.email as author_email, u.role as author_role
       FROM ticket_comments cm
       LEFT JOIN users u ON cm.author_user_id = u.id
       WHERE cm.ticket_id = ?
       ORDER BY cm.created_at ASC`,
      [id]
    );

    // Attachments
    const attachments = await db.query<any>(
      `SELECT a.*, u.email as uploaded_by_email
       FROM ticket_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.ticket_id = ?
       ORDER BY a.created_at DESC`,
      [id]
    );

    // Escalation Records
    const escalations = await db.query<any>(
      `SELECT esc.*, 
              e1.name as escalated_by_name,
              e2.name as assigned_to_name
       FROM ticket_escalations esc
       LEFT JOIN employees e1 ON esc.escalated_by_employee_id = e1.id
       LEFT JOIN employees e2 ON esc.assigned_to_employee_id = e2.id
       WHERE esc.ticket_id = ?
       ORDER BY esc.created_at ASC`,
      [id]
    );

    // Feedback
    const feedback = await db.query<any>(
      `SELECT fb.*, u.email as customer_email
       FROM ticket_feedback fb
       LEFT JOIN users u ON fb.customer_user_id = u.id
       WHERE fb.ticket_id = ?`,
      [id]
    );

    return {
      ...ticket,
      computedSLA: slaInfo,
      timer: timerStats,
      timeline,
      comments,
      attachments,
      escalations,
      feedback: feedback.length > 0 ? feedback[0] : null,
    };
  }

  /**
   * Filters tickets with sorting, pagination, and multi-parameter filters.
   */
  public static async getTickets(params: {
    status?: string;
    priority?: string;
    level?: string;
    employeeId?: string;
    companyId?: string;
    contactId?: number;
    search?: string;
    slaStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 20);
    const offset = (page - 1) * limit;

    let whereSql = '1=1';
    const queryParams: any[] = [];

    if (params.status) {
      whereSql += ' AND t.status = ?';
      queryParams.push(params.status);
    }
    if (params.priority) {
      whereSql += ' AND t.priority = ?';
      queryParams.push(params.priority);
    }
    if (params.level) {
      whereSql += ' AND t.assigned_level = ?';
      queryParams.push(params.level);
    }
    if (params.employeeId) {
      whereSql += ' AND t.assigned_employee_id = ?';
      queryParams.push(params.employeeId);
    }
    if (params.companyId) {
      whereSql += ' AND t.company_id = ?';
      queryParams.push(params.companyId);
    }
    if (params.contactId) {
      whereSql += ' AND t.customer_contact_id = ?';
      queryParams.push(params.contactId);
    }
    if (params.slaStatus) {
      whereSql += ' AND t.sla_status = ?';
      queryParams.push(params.slaStatus);
    }
    if (params.search && params.search.trim()) {
      whereSql += ' AND (LOWER(t.id) LIKE ? OR LOWER(t.problem_type) LIKE ? OR LOWER(c.company_name) LIKE ? OR LOWER(cc.name) LIKE ?)';
      const s = `%${params.search.trim().toLowerCase()}%`;
      queryParams.push(s, s, s, s);
    }

    const countRows = await db.query<{ total: number }>(
      `SELECT COUNT(*) as total 
       FROM tickets t
       LEFT JOIN companies c ON t.company_id = c.id
       LEFT JOIN company_contacts cc ON t.customer_contact_id = cc.id
       WHERE ${whereSql}`,
      queryParams
    );
    const total = countRows[0]?.total || 0;

    const rows = await db.query<any>(
      `SELECT t.*,
              c.company_name,
              cc.name as contact_name, cc.phone as contact_phone,
              e.name as assigned_employee_name, e.level as assigned_employee_level,
              (SELECT COUNT(*) FROM ticket_resolution_sessions s WHERE s.ticket_id = t.id AND s.ended_at IS NULL) as is_timer_running,
              (SELECT description FROM ticket_history h WHERE h.ticket_id = t.id AND h.action_type = 'RESOLVED' ORDER BY h.created_at DESC LIMIT 1) as latest_resolution_notes,
              (SELECT reason FROM ticket_escalations esc WHERE esc.ticket_id = t.id ORDER BY esc.created_at DESC LIMIT 1) as latest_escalation_reason,
              (SELECT e_esc.name FROM ticket_escalations esc JOIN employees e_esc ON esc.escalated_by_employee_id = e_esc.id WHERE esc.ticket_id = t.id ORDER BY esc.created_at DESC LIMIT 1) as escalated_by_name,
              (SELECT esc.created_at FROM ticket_escalations esc WHERE esc.ticket_id = t.id ORDER BY esc.created_at DESC LIMIT 1) as escalated_at
       FROM tickets t
       LEFT JOIN companies c ON t.company_id = c.id
       LEFT JOIN company_contacts cc ON t.customer_contact_id = cc.id
       LEFT JOIN employees e ON t.assigned_employee_id = e.id
       WHERE ${whereSql}
       ORDER BY 
         CASE WHEN t.status = 'OPEN' THEN 1
              WHEN t.status = 'IN_PROGRESS' THEN 2
              WHEN t.status = 'MANAGER_REVIEW' THEN 3
              WHEN t.status = 'CUSTOMER_FEEDBACK' THEN 4
              WHEN t.status = 'RESOLVED' THEN 5
              ELSE 6 END ASC,
         t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    // Compute live SLA on list items
    const enrichedData = rows.map((r) => {
      const sla = SLAService.computeSLAStatus({
        createdAt: r.created_at,
        deadline: r.sla_deadline,
        status: r.status,
        resolvedAt: r.resolution_ended_at,
      });
      return {
        ...r,
        liveSlaStatus: sla.status,
        slaRemainingSeconds: sla.remainingSeconds,
        slaPercentElapsed: sla.percentElapsed,
      };
    });

    return {
      data: enrichedData,
      total,
      page,
      limit,
    };
  }

  /**
   * Starts work on a ticket (Employee action).
   */
  public static async startWork(ticketId: string, employeeId: string, actorUserId: number): Promise<void> {
    const ticketRows = await db.query<Ticket>('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (ticketRows.length === 0) throw new Error('Ticket not found');
    const ticket = ticketRows[0];

    // Check if employee is assigned or assign them
    if (!ticket.assigned_employee_id) {
      await AssignmentService.assignTicket({
        ticketId,
        employeeId,
        level: ticket.assigned_level,
        assignedByUserId: actorUserId,
        assignmentType: 'MANUAL',
      });
    }

    // Start resolution session in timer service
    await TimerService.startWorkSession(ticketId, employeeId, ticket.assigned_level);

    // Log timeline
    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description)
       VALUES (?, ?, 'STARTED', 'Work Started', 'Technical specialist initiated resolution work and resolution timer.')`,
      [ticketId, actorUserId]
    );

    await AuditService.log({
      actorUserId,
      action: 'TICKET_WORK_STARTED',
      entityType: 'TICKET',
      entityId: ticketId,
    });
  }

  /**
   * Adds an internal or communication note.
   */
  public static async addComment(params: {
    ticketId: string;
    authorUserId: number;
    commentType: 'INTERNAL_NOTE' | 'CUSTOMER_COMMUNICATION';
    message: string;
  }): Promise<void> {
    await db.execute(
      `INSERT INTO ticket_comments (ticket_id, author_user_id, comment_type, message)
       VALUES (?, ?, ?, ?)`,
      [params.ticketId, params.authorUserId, params.commentType, params.message.trim()]
    );

    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description)
       VALUES (?, ?, 'NOTE_ADDED', ?, ?)`,
      [
        params.ticketId,
        params.authorUserId,
        params.commentType === 'INTERNAL_NOTE' ? 'Internal Work Note Added' : 'Customer Communication Added',
        params.message.trim(),
      ]
    );
  }

  /**
   * Records an uploaded attachment.
   */
  public static async addAttachment(params: {
    ticketId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedByUserId: number;
  }): Promise<void> {
    await db.execute(
      `INSERT INTO ticket_attachments (ticket_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [params.ticketId, params.fileName, params.filePath, params.fileSize, params.mimeType, params.uploadedByUserId]
    );

    await db.execute(
      `INSERT INTO ticket_history (ticket_id, actor_user_id, action_type, title, description)
       VALUES (?, ?, 'ATTACHMENT_ADDED', 'Attachment Uploaded', ?)`,
      [params.ticketId, params.uploadedByUserId, `File attached: ${params.fileName} (${Math.round(params.fileSize / 1024)} KB)`]
    );
  }
}
