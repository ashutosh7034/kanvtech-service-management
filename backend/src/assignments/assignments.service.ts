import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeeLevel, TicketLevel, AssignmentType } from '@prisma/client';

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
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
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

  async assignTicket(params: {
    ticketId: string;
    employeeId: string;
    level: TicketLevel;
    assignedByUserId: number;
    assignmentType: 'AUTO' | 'MANUAL';
    notes?: string;
  }): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: params.employeeId },
      include: { user: true },
    });

    if (!employee) throw new NotFoundException('Target employee not found');

    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot assign ticket to employee ${employee.name} because their status is ${employee.status}.`,
      );
    }

    if (employee.level !== params.level) {
      throw new BadRequestException(
        `Tier mismatch: Employee ${employee.name} is configured at tier ${employee.level}, but ticket assignment requested ${params.level}.`,
      );
    }

    // 1. Close prior open assignment
    await this.prisma.ticketAssignment.updateMany({
      where: { ticketId: params.ticketId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });

    // 2. Insert new assignment
    await this.prisma.ticketAssignment.create({
      data: {
        ticketId: params.ticketId,
        employeeId: params.employeeId,
        level: params.level,
        assignedBy: params.assignedByUserId,
        assignmentType: params.assignmentType as AssignmentType,
      },
    });

    // 3. Update ticket row
    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        assignedEmployeeId: params.employeeId,
        assignedLevel: params.level,
      },
    });

    // 4. Log to history
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.assignedByUserId,
        actionType: 'ASSIGNED',
        title: `Assigned to ${employee.name} (${params.level})`,
        description: params.notes || `Ticket assigned via ${params.assignmentType.toLowerCase()} routing.`,
        metadataJson: JSON.stringify({
          employeeId: params.employeeId,
          level: params.level,
          type: params.assignmentType,
        }),
      },
    });

    // 5. Notify assigned employee
    await this.notificationsService.broadcastTicketEvent({
      eventType: 'TICKET_ASSIGNED',
      ticketId: params.ticketId,
      title: `New Ticket Assigned: ${params.ticketId}`,
      message: `You have been assigned ticket ${params.ticketId} (${params.level}).`,
      recipientUserId: employee.userId,
      recipientEmail: employee.email,
      linkUrl: `/tickets/${params.ticketId}`,
    });

    await this.auditService.log({
      actorUserId: params.assignedByUserId,
      action: 'TICKET_ASSIGNED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { employeeId: params.employeeId, level: params.level, type: params.assignmentType },
    });
  }
}
