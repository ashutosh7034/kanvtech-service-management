import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { SlaService } from '../sla/sla.service';
import { TimerService } from '../timer/timer.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketPriority, TicketStatus, TicketLevel, EmployeeLevel, CommentType, AssignmentType } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentsService: AssignmentsService,
    private readonly slaService: SlaService,
    private readonly timerService: TimerService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateTicketId(): Promise<string> {
    const year = new Date().getFullYear();
    const allTicketsThisYear = await this.prisma.ticket.findMany({
      where: { id: { startsWith: `KT-${year}-` } },
      select: { id: true },
    });
    let maxSeq = 0;
    for (const t of allTicketsThisYear) {
      const match = t.id.match(/^KT-\d{4}-(\d+)$/);
      if (match) {
        const s = parseInt(match[1], 10);
        if (s > maxSeq) maxSeq = s;
      }
    }
    const nextSeq = await this.prisma.getNextSequence('TICKET_SEQ');
    const safeSeq = Math.max(nextSeq, maxSeq + 1);
    return `KT-${year}-${String(safeSeq).padStart(6, '0')}`;
  }

  async validateTwoOpenTicketRule(customerContactId?: number): Promise<void> {
    if (!customerContactId || isNaN(customerContactId) || customerContactId <= 0) {
      return;
    }
    const activeStatuses: TicketStatus[] = [
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.REOPENED,
      TicketStatus.RESOLVED,
      TicketStatus.MANAGER_REVIEW,
      TicketStatus.CUSTOMER_FEEDBACK,
    ];

    const activeCount = await this.prisma.ticket.count({
      where: {
        customerContactId: Number(customerContactId),
        status: { in: activeStatuses },
      },
    });

    if (activeCount >= 2) {
      throw new BadRequestException(
        'You already have 2 active tickets. Please close an existing ticket before creating a new one.',
      );
    }
  }

  async createTicket(params: {
    companyId: string;
    customerContactId?: number;
    customer_contact_id?: number;
    productId?: string;
    product_id?: string;
    branchId?: string;
    branch_id?: string;
    problemType: string;
    priority: TicketPriority;
    category: string;
    description: string;
    createdByUserId: number;
    assignedEmployeeId?: string | null;
  }) {
    let customerContactId = Number(params.customerContactId || params.customer_contact_id);
    if (!customerContactId || isNaN(customerContactId)) {
      const primaryContact = await this.prisma.companyContact.findFirst({
        where: { companyId: params.companyId, isPrimary: true },
      });
      if (primaryContact) {
        customerContactId = primaryContact.id;
      } else {
        const anyContact = await this.prisma.companyContact.findFirst({
          where: { companyId: params.companyId },
        });
        if (anyContact) customerContactId = anyContact.id;
        else customerContactId = 1;
      }
    }

    // 1. Resolve & Validate Product & Branch
    let productId = params.productId || params.product_id;
    const branchId = params.branchId || params.branch_id || null;

    // If productId not explicitly provided, check customer's owned products
    if (!productId) {
      const ownedProds = await this.prisma.companyProduct.findMany({
        where: { companyId: params.companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (ownedProds.length === 1) {
        productId = ownedProds[0].productId;
      } else if (ownedProds.length > 1) {
        productId = ownedProds[0].productId;
      } else {
        // Check if global product exists for legacy tests
        const firstProd = await this.prisma.product.findFirst({ where: { isActive: true } });
        if (firstProd) productId = firstProd.id;
      }
    }

    if (!productId) {
      throw new BadRequestException('A product must be selected for ticket creation.');
    }

    // Verify Product exists and is active
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new BadRequestException(`Product '${productId}' is not available or active.`);
    }

    // Verify Product belongs to Customer
    const companyProduct = await this.prisma.companyProduct.findFirst({
      where: { companyId: params.companyId, productId, isActive: true },
    });
    // If not found in company_products, verify if company exists and auto-link or reject
    if (!companyProduct) {
      const countCp = await this.prisma.companyProduct.count({ where: { companyId: params.companyId } });
      if (countCp > 0) {
        throw new BadRequestException(`Product '${product.name}' is not owned by the customer.`);
      }
    }

    // If Branch is selected: verify branch belongs to company and branch has this product
    if (branchId) {
      const branch = await this.prisma.companyBranch.findUnique({
        where: { id: branchId },
        include: { branchProducts: { where: { isActive: true } } },
      });
      if (!branch || branch.companyId !== params.companyId) {
        throw new BadRequestException('Selected branch does not belong to the customer organization.');
      }
      const branchHasProduct = branch.branchProducts.some((bp) => bp.productId === productId);
      if (!branchHasProduct) {
        throw new BadRequestException(
          `Product '${product.name}' is not assigned to branch '${branch.branchName}'.`,
        );
      }
    }

    // 2. Strict Two-Open-Ticket Rule Validation on Backend
    await this.validateTwoOpenTicketRule(customerContactId);

    // 3. Automatic Department Derivation from Product
    let department = await this.prisma.department.findFirst({
      where: { productId, isActive: true },
    });
    if (!department) {
      // Try finding department by product code or name
      department = await this.prisma.department.findFirst({
        where: {
          OR: [
            { code: { equals: product.code, mode: 'insensitive' } },
            { name: { contains: product.name, mode: 'insensitive' } },
          ],
          isActive: true,
        },
      });
    }

    const departmentId = department?.id || null;

    // 4. Collision-safe Monotonic Ticket ID Generation
    const ticketId = await this.generateTicketId();

    // 5. Compute SLA Deadline
    const now = new Date();
    const slaDeadline = await this.slaService.calculateDeadline(params.priority, now);

    // 6. Automatic Workload-Based Assignment to Eligible L1 within Department
    let assignedEmployeeId = params.assignedEmployeeId || null;
    let initialAssignmentType: AssignmentType = AssignmentType.MANUAL;
    let assignedWorkload = 0;

    if (!assignedEmployeeId) {
      // Find lowest workload active L1 engineer in this department
      const bestL1 = await this.assignmentsService.findBestAvailableEmployee(
        EmployeeLevel.L1,
        departmentId || undefined,
      );

      if (bestL1) {
        assignedEmployeeId = bestL1.id;
        assignedWorkload = bestL1.active_workload || 0;
        initialAssignmentType = AssignmentType.AUTO;
      }
    }

    // 7. Create Ticket Record
    await this.prisma.ticket.create({
      data: {
        id: ticketId,
        companyId: params.companyId,
        customerContactId,
        productId,
        branchId,
        departmentId,
        problemType: (params.problemType || 'General Incident').trim(),
        priority: params.priority,
        category: (params.category || 'General Support').trim(),
        description: (params.description || '').trim(),
        createdBy: params.createdByUserId,
        assignedEmployeeId,
        assignedLevel: TicketLevel.L1,
        status: TicketStatus.OPEN,
        slaPriority: params.priority,
        slaDeadline,
        slaStatus: 'ON_TRACK',
        totalResolutionSeconds: 0,
      },
    });

    // 8. Record Initial Timeline Entry
    await this.prisma.ticketHistory.create({
      data: {
        ticketId,
        actorUserId: params.createdByUserId,
        actionType: 'CREATED',
        title: 'Ticket Created',
        description: `Ticket opened for product ${product.name} with priority ${params.priority}. Department: ${department?.name || 'General Support'}. Description: ${params.description}`,
        metadataJson: JSON.stringify({
          productId,
          productName: product.name,
          branchId,
          departmentId,
          departmentName: department?.name,
        }),
      },
    });

    // 9. Route and record assignment
    if (assignedEmployeeId) {
      await this.assignmentsService.assignTicket({
        ticketId,
        employeeId: assignedEmployeeId,
        level: TicketLevel.L1,
        assignedByUserId: params.createdByUserId,
        assignmentType: initialAssignmentType,
        notes:
          initialAssignmentType === AssignmentType.AUTO
            ? `Auto-routed to available L1 specialist in ${department?.name || 'Support'} (workload: ${assignedWorkload})`
            : 'Assigned upon ticket creation',
      });

      await this.auditService.log({
        actorUserId: params.createdByUserId,
        action: 'TICKET_AUTO_ASSIGNED',
        entityType: 'TICKET',
        entityId: ticketId,
        newValues: {
          ticketId,
          productId,
          productName: product.name,
          departmentId,
          departmentName: department?.name,
          level: 'L1',
          assignedEmployeeId,
          workloadAtAssignment: assignedWorkload,
        },
      });
    } else {
      // Alert when no L1 engineer is available in this department
      if (department) {
        await this.notificationsService.broadcastTicketEvent({
          eventType: 'NO_ENGINEER_AVAILABLE',
          ticketId,
          title: `Unassigned Ticket Alert: ${ticketId}`,
          message: `No active L1 engineer is currently available in the ${department.name} department for ticket ${ticketId}.`,
          linkUrl: `/tickets/${ticketId}`,
        });
      }
    }

    // 10. Notify Customer
    if (customerContactId) {
      const contact = await this.prisma.companyContact.findUnique({
        where: { id: customerContactId },
      });
      if (contact) {
        await this.notificationsService.broadcastTicketEvent({
          eventType: 'TICKET_CREATED',
          ticketId,
          title: `Ticket Confirmed: ${ticketId}`,
          message: `Your ticket for ${product.name} has been logged and assigned ID ${ticketId}. Our ${department?.name || 'L1 support'} team will begin work promptly.`,
          recipientUserId: contact.userId || undefined,
          recipientEmail: contact.email,
          linkUrl: `/tickets/${ticketId}`,
        });
      }
    }

    await this.auditService.log({
      actorUserId: params.createdByUserId,
      action: 'TICKET_CREATED',
      entityType: 'TICKET',
      entityId: ticketId,
      newValues: { id: ticketId, companyId: params.companyId, productId, branchId, departmentId, priority: params.priority },
    });

    return this.getTicketById(ticketId);
  }

  async getTicketById(id: string) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        company: true,
        product: true,
        branch: true,
        department: true,
        customerContact: true,
        assignedEmployee: { include: { departmentRel: true } },
        creator: { select: { email: true } },
        history: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { email: true, role: true } } },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { email: true, role: true } } },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: { uploader: { select: { email: true } } },
        },
        escalations: {
          orderBy: { createdAt: 'asc' },
          include: {
            escalatedBy: { select: { name: true, department: true } },
            assignedTo: { select: { name: true, department: true } },
          },
        },
        feedback: {
          include: { customer: { select: { email: true } } },
        },
        reopenHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            reopenedByUser: { select: { email: true, role: true } },
          },
        },
      },
    });

    if (!t) return null;

    const slaInfo = this.slaService.computeSLAStatus({
      createdAt: t.createdAt,
      deadline: t.slaDeadline,
      status: t.status,
      resolvedAt: t.resolutionEndedAt,
    });

    const timerStats = await this.timerService.getTotalResolutionTime(id);

    const formattedReopenHistory = (t.reopenHistory || []).map((rh) => ({
      id: rh.id,
      ticket_id: rh.ticketId,
      reopened_by: rh.reopenedBy,
      reopened_by_email: rh.reopenedByUser?.email,
      reopened_by_role: rh.reopenedByUser?.role,
      reopen_reason: rh.reopenReason,
      previous_status: rh.previousStatus,
      created_at: rh.createdAt,
    }));

    return {
      id: t.id,
      company_id: t.companyId,
      customer_contact_id: t.customerContactId,
      product_id: t.productId,
      product_code: t.product?.code || null,
      product_name: t.product?.name || null,
      product: t.product,
      branch_id: t.branchId,
      branch_name: t.branch?.branchName || null,
      branch: t.branch,
      department_id: t.departmentId,
      department_code: t.department?.code || null,
      department_name: t.department?.name || null,
      department: t.department,
      problem_type: t.problemType,
      priority: t.priority,
      category: t.category,
      description: t.description,
      created_by: t.createdBy,
      assigned_employee_id: t.assignedEmployeeId,
      assigned_level: t.assignedLevel,
      status: t.status,
      sla_priority: t.slaPriority,
      sla_deadline: t.slaDeadline,
      sla_status: t.slaStatus,
      resolution_started_at: t.resolutionStartedAt,
      resolution_ended_at: t.resolutionEndedAt,
      total_resolution_seconds: t.totalResolutionSeconds,
      closed_at: t.closedAt,
      closed_by: t.closedBy,
      closure_reason: t.closureReason,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      company_name: t.company?.companyName || null,
      company_gstn: t.company?.gstn || null,
      company_email: t.company?.primaryEmail || null,
      contact_name: t.customerContact?.name || null,
      contact_phone: t.customerContact?.phone || null,
      contact_email: t.customerContact?.email || null,
      contact_designation: t.customerContact?.designation || null,
      assigned_employee_name: t.assignedEmployee?.name || null,
      assigned_employee_email: t.assignedEmployee?.email || null,
      assigned_employee_level: t.assignedEmployee?.level || null,
      assigned_employee_phone: t.assignedEmployee?.phone || null,
      assigned_employee_department: t.assignedEmployee?.departmentRel?.name || t.assignedEmployee?.department || null,
      creator_email: t.creator?.email || null,
      is_reopened: (t.reopenHistory && t.reopenHistory.length > 0) || t.status === TicketStatus.REOPENED,
      isReopened: (t.reopenHistory && t.reopenHistory.length > 0) || t.status === TicketStatus.REOPENED,
      computedSLA: slaInfo,
      timer: timerStats,
      is_timer_running: timerStats.isRunning ? 1 : 0,
      isTimerRunning: timerStats.isRunning,
      reopen_history: formattedReopenHistory,
      reopenHistory: formattedReopenHistory,
      timeline: t.history.map((h) => ({
        id: h.id,
        ticket_id: h.ticketId,
        actor_user_id: h.actorUserId,
        actor_email: h.actor?.email,
        actor_role: h.actor?.role,
        action_type: h.actionType,
        title: h.title,
        description: h.description,
        metadata_json: h.metadataJson,
        created_at: h.createdAt,
      })),
      comments: t.comments.map((c) => ({
        id: c.id,
        ticket_id: c.ticketId,
        author_user_id: c.authorUserId,
        author_email: c.author?.email,
        author_role: c.author?.role,
        comment_type: c.commentType,
        message: c.message,
        created_at: c.createdAt,
      })),
      attachments: t.attachments.map((a) => ({
        id: a.id,
        ticket_id: a.ticketId,
        file_name: a.fileName,
        file_path: a.filePath,
        file_size: a.fileSize,
        mime_type: a.mimeType,
        uploaded_by: a.uploadedBy,
        uploaded_by_email: a.uploader?.email,
        created_at: a.createdAt,
      })),
      escalations: t.escalations.map((esc) => ({
        id: esc.id,
        ticket_id: esc.ticketId,
        from_level: esc.fromLevel,
        to_level: esc.toLevel,
        escalated_by_employee_id: esc.escalatedByEmployeeId,
        escalated_by_name: esc.escalatedBy?.name,
        assigned_to_employee_id: esc.assignedToEmployeeId,
        assigned_to_name: esc.assignedTo?.name,
        reason: esc.reason,
        notes: esc.notes,
        created_at: esc.createdAt,
      })),
      feedback: t.feedback
        ? {
            id: t.feedback.id,
            ticket_id: t.feedback.ticketId,
            customer_user_id: t.feedback.customerUserId,
            rating: t.feedback.rating,
            remarks: t.feedback.remarks,
            created_at: t.feedback.createdAt,
            customer_email: t.feedback.customer?.email,
          }
        : null,
    };
  }

  async getTickets(params: {
    status?: string;
    priority?: string;
    level?: string;
    employeeId?: string;
    companyId?: string;
    contactId?: number;
    productId?: string;
    branchId?: string;
    departmentId?: string;
    search?: string;
    slaStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.status) where.status = params.status as TicketStatus;
    if (params.priority) where.priority = params.priority as TicketPriority;
    if (params.level) where.assignedLevel = params.level as TicketLevel;
    if (params.employeeId) where.assignedEmployeeId = params.employeeId;
    if (params.companyId) where.companyId = params.companyId;
    if (params.contactId) where.customerContactId = Number(params.contactId);
    if (params.productId) where.productId = params.productId;
    if (params.branchId) where.branchId = params.branchId;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.slaStatus) where.slaStatus = params.slaStatus;

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { problemType: { contains: q, mode: 'insensitive' } },
        { company: { companyName: { contains: q, mode: 'insensitive' } } },
        { customerContact: { name: { contains: q, mode: 'insensitive' } } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { department: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, tickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          company: { select: { companyName: true } },
          product: { select: { code: true, name: true } },
          branch: { select: { branchName: true } },
          department: { select: { name: true, code: true } },
          customerContact: { select: { name: true, phone: true } },
          assignedEmployee: { select: { name: true, level: true, department: true } },
          resolutionSessions: { where: { endedAt: null }, select: { id: true } },
          history: {
            where: { actionType: 'RESOLVED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { description: true },
          },
          escalations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { escalatedBy: { select: { name: true } } },
          },
        },
      }),
    ]);

    const enrichedData = tickets.map((r) => {
      const sla = this.slaService.computeSLAStatus({
        createdAt: r.createdAt,
        deadline: r.slaDeadline,
        status: r.status,
        resolvedAt: r.resolutionEndedAt,
      });

      return {
        id: r.id,
        company_id: r.companyId,
        customer_contact_id: r.customerContactId,
        product_id: r.productId,
        product_name: r.product?.name || null,
        product_code: r.product?.code || null,
        branch_id: r.branchId,
        branch_name: r.branch?.branchName || null,
        department_id: r.departmentId,
        department_name: r.department?.name || null,
        problem_type: r.problemType,
        priority: r.priority,
        category: r.category,
        description: r.description,
        created_by: r.createdBy,
        assigned_employee_id: r.assignedEmployeeId,
        assigned_level: r.assignedLevel,
        status: r.status,
        sla_priority: r.slaPriority,
        sla_deadline: r.slaDeadline,
        sla_status: r.slaStatus,
        resolution_started_at: r.resolutionStartedAt,
        resolution_ended_at: r.resolutionEndedAt,
        total_resolution_seconds: r.totalResolutionSeconds,
        closed_at: r.closedAt,
        closed_by: r.closedBy,
        closure_reason: r.closureReason,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
        company_name: r.company?.companyName || null,
        contact_name: r.customerContact?.name || null,
        contact_phone: r.customerContact?.phone || null,
        assigned_employee_name: r.assignedEmployee?.name || null,
        assigned_employee_level: r.assignedEmployee?.level || null,
        assigned_employee_department: r.assignedEmployee?.department || null,
        is_timer_running: r.resolutionSessions.length > 0 ? 1 : 0,
        latest_resolution_notes: r.history[0]?.description || null,
        latest_escalation_reason: r.escalations[0]?.reason || null,
        escalated_by_name: r.escalations[0]?.escalatedBy?.name || null,
        escalated_at: r.escalations[0]?.createdAt || null,
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

  async startWork(ticketId: string, employeeId?: string, actorUserId?: number): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    let effectiveEmployeeId = employeeId || ticket.assignedEmployeeId;

    if (!effectiveEmployeeId) {
      const bestEmp = await this.assignmentsService.findBestAvailableEmployee(
        ticket.assignedLevel as any,
        ticket.departmentId || undefined,
      );
      if (bestEmp) {
        effectiveEmployeeId = bestEmp.id;
      } else {
        const fallbackEmp = await this.prisma.employee.findFirst({
          where: { level: ticket.assignedLevel as any, status: 'ACTIVE' },
        });
        if (fallbackEmp) {
          effectiveEmployeeId = fallbackEmp.id;
        } else {
          throw new BadRequestException('Cannot start work session: No active employee found for this ticket level.');
        }
      }

      await this.assignmentsService.assignTicket({
        ticketId,
        employeeId: effectiveEmployeeId,
        level: ticket.assignedLevel,
        assignedByUserId: actorUserId || 1,
        assignmentType: AssignmentType.AUTO,
        notes: 'Auto-assigned upon starting work',
      });
    } else if (!ticket.assignedEmployeeId) {
      await this.assignmentsService.assignTicket({
        ticketId,
        employeeId: effectiveEmployeeId,
        level: ticket.assignedLevel,
        assignedByUserId: actorUserId || 1,
        assignmentType: AssignmentType.MANUAL,
      });
    }

    await this.timerService.startWorkSession(ticketId, effectiveEmployeeId, ticket.assignedLevel);

    await this.prisma.ticketHistory.create({
      data: {
        ticketId,
        actorUserId: actorUserId || 1,
        actionType: 'STARTED',
        title: 'Work Started',
        description: 'Technical specialist initiated resolution work and resolution timer.',
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'TICKET_WORK_STARTED',
      entityType: 'TICKET',
      entityId: ticketId,
      newValues: { assignedEmployeeId: effectiveEmployeeId, status: 'IN_PROGRESS' },
    });
  }

  async addComment(params: {
    ticketId: string;
    authorUserId: number;
    commentType: CommentType;
    message: string;
  }): Promise<void> {
    await this.prisma.ticketComment.create({
      data: {
        ticketId: params.ticketId,
        authorUserId: params.authorUserId,
        commentType: params.commentType,
        message: params.message.trim(),
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.authorUserId,
        actionType: 'NOTE_ADDED',
        title:
          params.commentType === CommentType.INTERNAL_NOTE
            ? 'Internal Work Note Added'
            : 'Customer Communication Added',
        description: params.message.trim(),
      },
    });
  }

  async addAttachment(params: {
    ticketId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedByUserId: number;
  }): Promise<void> {
    await this.prisma.ticketAttachment.create({
      data: {
        ticketId: params.ticketId,
        fileName: params.fileName,
        filePath: params.filePath,
        fileSize: params.fileSize,
        mimeType: params.mimeType,
        uploadedBy: params.uploadedByUserId,
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.uploadedByUserId,
        actionType: 'ATTACHMENT_ADDED',
        title: 'Attachment Uploaded',
        description: `File attached: ${params.fileName} (${Math.round(params.fileSize / 1024)} KB)`,
      },
    });
  }

  async findContactForCustomer(email?: string, userId?: number): Promise<{ companyId: string; id?: number | null } | null> {
    if (userId) {
      const contact = await this.prisma.companyContact.findFirst({ where: { userId } });
      if (contact) return { companyId: contact.companyId, id: contact.id };
    }
    if (email) {
      const contact = await this.prisma.companyContact.findFirst({ where: { email } });
      if (contact) return { companyId: contact.companyId, id: contact.id };
      const comp = await this.prisma.company.findFirst({ where: { primaryEmail: email } });
      if (comp) return { companyId: comp.id, id: null };
    }
    return null;
  }
}
