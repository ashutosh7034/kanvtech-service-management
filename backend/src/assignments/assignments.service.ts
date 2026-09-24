import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeeLevel, TicketLevel, AssignmentType, TicketStatus } from '@prisma/client';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findBestAvailableEmployee(targetLevel: EmployeeLevel = EmployeeLevel.L1) {
    const employees = await this.prisma.employee.findMany({
      where: {
        level: targetLevel,
        status: 'ACTIVE',
        availability: 'AVAILABLE',
      },
      include: {
        assignedTickets: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (employees.length === 0) return null;

    employees.sort((a, b) => a.assignedTickets.length - b.assignedTickets.length);
    const best = employees[0];

    return {
      ...best,
      active_workload: best.assignedTickets.length,
    };
  }

  async getEligibleEmployees() {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, email: true, role: true } },
        assignedTickets: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] } },
          select: { id: true },
        },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    return employees.map((e) => ({
      id: e.id,
      userId: e.userId,
      name: e.name,
      email: e.email,
      phone: e.phone,
      department: e.department,
      designation: e.designation,
      level: e.level,
      availability: e.availability,
      status: e.status,
      activeWorkload: e.assignedTickets.length,
    }));
  }

  async assignTicket(params: {
    ticketId: string;
    employeeId: string | number;
    level?: TicketLevel;
    assignedByUserId: number;
    assignmentType: 'AUTO' | 'MANUAL';
    notes?: string;
  }): Promise<any> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { assignedEmployee: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    let employee = null;
    const rawId = String(params.employeeId);
    if (rawId.startsWith('EMP-')) {
      employee = await this.prisma.employee.findUnique({
        where: { id: rawId },
        include: { user: true },
      });
    } else {
      const numericId = Number(params.employeeId);
      if (!isNaN(numericId) && numericId > 0) {
        employee = await this.prisma.employee.findUnique({
          where: { userId: numericId },
          include: { user: true },
        });
      }
      if (!employee) {
        employee = await this.prisma.employee.findUnique({
          where: { id: rawId },
          include: { user: true },
        });
      }
    }

    if (!employee) throw new NotFoundException('Target employee not found');

    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot assign ticket to employee ${employee.name} because their status is ${employee.status}.`,
      );
    }

    const employeeId = employee.id;
    // Map level to employee level if not provided or to ensure tier accuracy
    const targetLevel = (params.level || (employee.level as unknown as TicketLevel)) as TicketLevel;
    const isReassignment = !!ticket.assignedEmployeeId && ticket.assignedEmployeeId !== employeeId;
    const previousEmployeeName = ticket.assignedEmployee?.name || 'Unassigned';

    // 1. Close prior open assignment
    await this.prisma.ticketAssignment.updateMany({
      where: { ticketId: params.ticketId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    // 2. Insert new assignment
    await this.prisma.ticketAssignment.create({
      data: {
        ticketId: params.ticketId,
        employeeId,
        level: targetLevel,
        assignedBy: params.assignedByUserId,
        assignmentType: params.assignmentType as AssignmentType,
      },
    });

    // 3. Update ticket row
    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        assignedEmployeeId: employeeId,
        assignedLevel: targetLevel,
      },
    });

    // 4. Log to history (separate from escalation)
    const actionType = isReassignment ? 'REASSIGNED' : 'ASSIGNED';
    const title = isReassignment
      ? `Reassigned to ${employee.name} (${targetLevel})`
      : `Assigned to ${employee.name} (${targetLevel})`;
    const description =
      params.notes ||
      (isReassignment
        ? `Ticket reassigned from ${previousEmployeeName} to ${employee.name}.`
        : `Direct task allotment to ${employee.name}.`);

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.assignedByUserId,
        actionType,
        title,
        description,
        metadataJson: JSON.stringify({
          previousEmployeeId: ticket.assignedEmployeeId,
          previousEmployeeName,
          newEmployeeId: params.employeeId,
          newEmployeeName: employee.name,
          level: targetLevel,
          type: params.assignmentType,
          notes: params.notes,
        }),
      },
    });

    // 5. Notify assigned employee
    await this.notificationsService.broadcastTicketEvent({
      eventType: isReassignment ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
      ticketId: params.ticketId,
      title: `${isReassignment ? 'Ticket Reassigned' : 'New Ticket Assigned'}: ${params.ticketId}`,
      message: `You have been ${isReassignment ? 'reassigned' : 'assigned'} ticket ${params.ticketId} (${targetLevel}).`,
      recipientUserId: employee.userId,
      recipientEmail: employee.email,
      linkUrl: `/tickets/${params.ticketId}`,
    });

    await this.auditService.log({
      actorUserId: params.assignedByUserId,
      action: isReassignment ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: {
        previousEmployeeId: ticket.assignedEmployeeId,
        employeeId,
        level: targetLevel,
        type: params.assignmentType,
        notes: params.notes,
      },
    });

    return {
      id: ticket.id,
      assigned_level: targetLevel,
      assignedLevel: targetLevel,
      assigned_employee_id: employeeId,
      assignedEmployeeId: employeeId,
      assigned_employee_name: employee.name,
      status: ticket.status,
    };
  }

  async getTaskAllotmentQueue(params: {
    status?: string;
    priority?: string;
    assignedStatus?: 'ASSIGNED' | 'UNASSIGNED' | 'ALL';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      status: { not: TicketStatus.CLOSED },
    };

    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    if (params.priority && params.priority !== 'ALL') {
      where.priority = params.priority;
    }

    if (params.assignedStatus === 'UNASSIGNED') {
      where.assignedEmployeeId = null;
    } else if (params.assignedStatus === 'ASSIGNED') {
      where.assignedEmployeeId = { not: null };
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { problemType: { contains: q, mode: 'insensitive' } },
        { company: { companyName: { contains: q, mode: 'insensitive' } } },
        { customerContact: { name: { contains: q, mode: 'insensitive' } } },
        { assignedEmployee: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, tickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        include: {
          company: { select: { id: true, companyName: true } },
          customerContact: { select: { id: true, name: true, phone: true } },
          assignedEmployee: { select: { id: true, name: true, level: true, email: true, department: true } },
          assignments: {
            orderBy: { assignedAt: 'desc' },
            take: 3,
            include: {
              employee: { select: { name: true, level: true } },
              assigner: { select: { email: true } },
            },
          },
        },
      }),
    ]);

    const formatted = tickets.map((t) => ({
      id: t.id,
      company_id: t.companyId,
      company_name: t.company?.companyName || null,
      contact_name: t.customerContact?.name || null,
      problem_type: t.problemType,
      priority: t.priority,
      category: t.category,
      description: t.description,
      status: t.status,
      assigned_level: t.assignedLevel,
      assigned_employee_id: t.assignedEmployeeId,
      assigned_employee_name: t.assignedEmployee?.name || null,
      assigned_employee_level: t.assignedEmployee?.level || null,
      assigned_employee_department: t.assignedEmployee?.department || null,
      sla_deadline: t.slaDeadline,
      sla_status: t.slaStatus,
      created_at: t.createdAt,
      recent_assignments: t.assignments.map((a) => ({
        id: a.id,
        employee_name: a.employee?.name,
        employee_level: a.employee?.level,
        assigned_by: a.assigner?.email,
        assigned_at: a.assignedAt,
        type: a.assignmentType,
      })),
    }));

    return {
      data: formatted,
      total,
      page,
      limit,
    };
  }

  async getAllotmentStats() {
    const [unassigned, assigned, totalOpen] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          assignedEmployeeId: null,
          status: { not: TicketStatus.CLOSED },
        },
      }),
      this.prisma.ticket.count({
        where: {
          assignedEmployeeId: { not: null },
          status: { not: TicketStatus.CLOSED },
        },
      }),
      this.prisma.ticket.count({
        where: { status: { not: TicketStatus.CLOSED } },
      }),
    ]);

    return {
      unassigned,
      assigned,
      totalOpen,
    };
  }
}
