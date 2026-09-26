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

  async findBestAvailableEmployee(targetLevel: EmployeeLevel = EmployeeLevel.L1, departmentId?: string) {
    const where: any = {
      level: targetLevel,
      status: 'ACTIVE',
    };

    if (departmentId) {
      where.OR = [
        { departmentId: departmentId },
        { departmentRel: { id: departmentId } },
        { departmentRel: { name: departmentId } },
        { departmentRel: { code: departmentId } },
      ];
    }

    const activeStatuses: TicketStatus[] = [
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.REOPENED,
      TicketStatus.CUSTOMER_FEEDBACK,
      TicketStatus.MANAGER_REVIEW,
    ];

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        departmentRel: true,
        assignedTickets: {
          where: { status: { in: activeStatuses } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (employees.length === 0) return null;

    // Prioritize AVAILABLE over BUSY if any available, but always sort by lowest real active workload
    employees.sort((a, b) => {
      if (a.assignedTickets.length !== b.assignedTickets.length) {
        return a.assignedTickets.length - b.assignedTickets.length;
      }
      if (a.availability === 'AVAILABLE' && b.availability !== 'AVAILABLE') return -1;
      if (b.availability === 'AVAILABLE' && a.availability !== 'AVAILABLE') return 1;
      return 0;
    });

    const best = employees[0];

    return {
      ...best,
      active_workload: best.assignedTickets.length,
      activeWorkload: best.assignedTickets.length,
    };
  }

  async getEligibleEmployees(departmentId?: string) {
    const where: any = { status: 'ACTIVE' };
    if (departmentId) {
      where.OR = [
        { departmentId: departmentId },
        { departmentRel: { id: departmentId } },
        { departmentRel: { name: departmentId } },
      ];
    }

    const activeStatuses: TicketStatus[] = [
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.REOPENED,
      TicketStatus.CUSTOMER_FEEDBACK,
      TicketStatus.MANAGER_REVIEW,
    ];

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, role: true } },
        departmentRel: { select: { id: true, name: true, code: true } },
        assignedTickets: {
          where: { status: { in: activeStatuses } },
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
      department: e.departmentRel?.name || e.department,
      department_id: e.departmentId || e.departmentRel?.id || null,
      department_code: e.departmentRel?.code || null,
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
      include: { assignedEmployee: true, department: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    let employee = null;
    const rawId = String(params.employeeId);
    if (rawId.startsWith('EMP-')) {
      employee = await this.prisma.employee.findUnique({
        where: { id: rawId },
        include: { user: true, departmentRel: true },
      });
    } else {
      const numericId = Number(params.employeeId);
      if (!isNaN(numericId) && numericId > 0) {
        employee = await this.prisma.employee.findUnique({
          where: { userId: numericId },
          include: { user: true, departmentRel: true },
        });
      }
      if (!employee) {
        employee = await this.prisma.employee.findUnique({
          where: { id: rawId },
          include: { user: true, departmentRel: true },
        });
      }
    }

    if (!employee) throw new NotFoundException('Target employee not found');

    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot assign ticket to employee ${employee.name} because their status is ${employee.status}.`,
      );
    }

    // DEPARTMENT INTEGRITY CHECK:
    // If ticket is attached to a department, ensure assigned employee belongs to that department (unless authorized override)
    if (ticket.departmentId && employee.departmentId && ticket.departmentId !== employee.departmentId) {
      // Check if department names match or throw cross-department assignment rejection
      const dept = await this.prisma.department.findUnique({ where: { id: ticket.departmentId } });
      const empDept = await this.prisma.department.findUnique({ where: { id: employee.departmentId } });
      if (dept && empDept && dept.id !== empDept.id) {
        throw new BadRequestException(
          `Cannot assign ${dept.name} ticket to employee ${employee.name} who belongs to the ${empDept.name} department.`,
        );
      }
    }

    const employeeId = employee.id;
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

    // 4. Log to history
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
          department: employee.departmentRel?.name || employee.department,
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
        department: employee.departmentRel?.name || employee.department,
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
    departmentId?: string;
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

    if (params.departmentId && params.departmentId !== 'ALL') {
      where.departmentId = params.departmentId;
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
          product: { select: { id: true, code: true, name: true } },
          branch: { select: { id: true, branchName: true } },
          department: { select: { id: true, name: true, code: true } },
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
      product_id: t.productId,
      product_name: t.product?.name || null,
      branch_id: t.branchId,
      branch_name: t.branch?.branchName || null,
      department_id: t.departmentId,
      department_name: t.department?.name || null,
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
