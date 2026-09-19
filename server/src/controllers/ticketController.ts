import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { TicketService } from '../services/ticketService';
import { AssignmentService } from '../services/assignmentService';
import { EscalationService } from '../services/escalationService';
import { ApprovalService } from '../services/approvalService';
import { FeedbackService } from '../services/feedbackService';
import { ClosureService } from '../services/closureService';

export class TicketController {
  public static async getTickets(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, priority, level, employeeId, companyId, search, slaStatus, page, limit } = req.query;

      let scopedCompanyId = companyId as string;
      let scopedContactId: number | undefined = undefined;

      // Role-based visibility scoping
      if (req.user?.role === 'CUSTOMER') {
        scopedCompanyId = req.user.companyId || 'UNKNOWN';
        if (req.user.contactId) {
          scopedContactId = req.user.contactId;
        }
      }

      const result = await TicketService.getTickets({
        status: status as string,
        priority: priority as string,
        level: level as string,
        employeeId: employeeId as string,
        companyId: scopedCompanyId,
        contactId: scopedContactId,
        search: search as string,
        slaStatus: slaStatus as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      // Redact internal escalation information for Customer role
      if (req.user?.role === 'CUSTOMER' && result && Array.isArray(result.data)) {
        result.data = result.data.map((item: any) => ({
          ...item,
          latest_escalation_reason: undefined,
          escalated_by_name: undefined,
          escalated_at: undefined,
        }));
      }

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const ticket = await TicketService.getTicketById(id);
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found.' });
      }

      // Authorization guard: customer cannot view other companies' tickets
      if (req.user?.role === 'CUSTOMER') {
        if (ticket.company_id !== req.user.companyId) {
          return res.status(403).json({ success: false, error: 'Access denied to this ticket.' });
        }

        // Sanitize sensitive internal data for Customer role
        if (ticket.comments && Array.isArray(ticket.comments)) {
          ticket.comments = ticket.comments.filter((c: any) => c.comment_type === 'CUSTOMER_COMMUNICATION');
        }
        // Customer cannot see internal technical escalation routing
        ticket.escalations = [];
        // Customer cannot see private technician phone and internal email
        ticket.assigned_employee_phone = undefined;
        ticket.assigned_employee_email = undefined;
        // Filter timeline to customer-relevant events only
        if (ticket.timeline && Array.isArray(ticket.timeline)) {
          ticket.timeline = ticket.timeline.filter((tl: any) =>
            !['TIMER_START', 'TIMER_STOP', 'ESCALATED'].includes(tl.action_type)
          );
        }
      }

      return res.json({ success: true, ticket });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async createTicket(req: AuthenticatedRequest, res: Response) {
    try {
      let { companyId, customerContactId, problemType, priority, category, description, assignedEmployeeId } = req.body;

      // Auto-populate for logged-in Customer
      if (req.user?.role === 'CUSTOMER') {
        if (!companyId && req.user.companyId) companyId = req.user.companyId;
        if (!customerContactId && req.user.contactId) customerContactId = req.user.contactId;
      }

      if (!companyId || !customerContactId || !problemType || !priority || !category || !description) {
        return res.status(400).json({
          success: false,
          error: 'Required fields missing: companyId, customerContactId, problemType, priority, category, description.',
        });
      }

      const ticket = await TicketService.createTicket({
        companyId,
        customerContactId: Number(customerContactId),
        problemType,
        priority,
        category,
        description,
        createdByUserId: req.user!.userId,
        assignedEmployeeId,
      });

      return res.status(201).json({ success: true, ticket });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async assignTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { employeeId, level, notes } = req.body;

      if (!employeeId || !level) {
        return res.status(400).json({ success: false, error: 'employeeId and level are required.' });
      }

      await AssignmentService.assignTicket({
        ticketId: id,
        employeeId,
        level,
        assignedByUserId: req.user!.userId,
        assignmentType: 'MANUAL',
        notes,
      });

      return res.json({ success: true, message: `Ticket successfully assigned to employee ${employeeId} (${level}).` });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async startWork(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const employeeId = req.user?.employeeId || (req.body.employeeId as string);

      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee identification required to start work.' });
      }

      await TicketService.startWork(id, employeeId, req.user!.userId);
      return res.json({ success: true, message: 'Work started and resolution timer initiated.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async escalateTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { fromLevel, toLevel, reason, notes, assignedToEmployeeId } = req.body;

      const employeeId = req.user?.employeeId || (req.body.escalatedByEmployeeId as string);
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Escalating employee ID required.' });
      }

      if (!fromLevel || !toLevel || !reason) {
        return res.status(400).json({ success: false, error: 'fromLevel, toLevel, and reason are required.' });
      }

      await EscalationService.escalateTicket({
        ticketId: id,
        fromLevel,
        toLevel,
        escalatedByEmployeeId: employeeId,
        assignedToEmployeeId,
        reason,
        notes,
        actorUserId: req.user!.userId,
      });

      return res.json({ success: true, message: `Ticket escalated from ${fromLevel} to ${toLevel}. Timer continuous.` });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async resolveTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;
      const employeeId = req.user?.employeeId || (req.body.employeeId as string);

      if (!resolutionNotes || !resolutionNotes.trim()) {
        return res.status(400).json({ success: false, error: 'Resolution notes are required.' });
      }

      await ApprovalService.submitForReview({
        ticketId: id,
        employeeId: employeeId || 'EMP-SYS',
        resolutionNotes,
        actorUserId: req.user!.userId,
      });

      return res.json({ success: true, message: 'Ticket resolved and submitted for Manager Review.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async approveTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      // Only Manager or Admin
      if (!['ADMIN', 'MANAGER'].includes(req.user?.role || '')) {
        return res.status(403).json({ success: false, error: 'Only Managers and Admins can approve resolutions.' });
      }

      await ApprovalService.approveResolution({
        ticketId: id,
        managerUserId: req.user!.userId,
        notes,
      });

      return res.json({ success: true, message: 'Resolution approved. Feedback requested from customer.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async reopenTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, error: 'Reopen reason is required.' });
      }

      await ApprovalService.reopenResolution({
        ticketId: id,
        managerUserId: req.user!.userId,
        reason,
      });

      return res.json({ success: true, message: 'Ticket reopened and returned to IN_PROGRESS.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async submitFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rating, remarks } = req.body;

      if (!rating) {
        return res.status(400).json({ success: false, error: 'Rating (1 to 5) is required.' });
      }

      await FeedbackService.submitFeedback({
        ticketId: id,
        customerUserId: req.user!.userId,
        rating: Number(rating),
        remarks,
      });

      return res.json({ success: true, message: 'Thank you! Feedback recorded and ticket successfully closed.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async closeTicket(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await ClosureService.closeTicket({
        ticketId: id,
        closedByUserId: req.user!.userId,
        closureReason: reason || 'Closed by authorized personnel.',
        source: 'MANUAL',
      });

      return res.json({ success: true, message: 'Ticket closed successfully.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async addComment(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      let { commentType } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
      }

      // Check tenant access if customer
      if (req.user?.role === 'CUSTOMER') {
        const ticket = await TicketService.getTicketById(id);
        if (!ticket || ticket.company_id !== req.user.companyId) {
          return res.status(403).json({ success: false, error: 'Access denied to this ticket.' });
        }
        commentType = 'CUSTOMER_COMMUNICATION';
      }

      await TicketService.addComment({
        ticketId: id,
        authorUserId: req.user!.userId,
        commentType: commentType || 'INTERNAL_NOTE',
        message,
      });

      return res.json({ success: true, message: 'Comment added.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async uploadAttachment(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const file = (req as any).file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No file uploaded.' });
      }

      if (req.user?.role === 'CUSTOMER') {
        const ticket = await TicketService.getTicketById(id);
        if (!ticket || ticket.company_id !== req.user.companyId) {
          return res.status(403).json({ success: false, error: 'Access denied to this ticket.' });
        }
      }

      await TicketService.addAttachment({
        ticketId: id,
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedByUserId: req.user!.userId,
      });

      return res.json({
        success: true,
        message: 'Attachment uploaded.',
        attachment: {
          fileName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileSize: file.size,
        },
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
