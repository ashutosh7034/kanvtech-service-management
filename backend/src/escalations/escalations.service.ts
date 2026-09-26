import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { TimerService } from '../timer/timer.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmployeeLevel, TicketLevel, AssignmentType } from '@prisma/client';

@Injectable()
export class EscalationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentsService: AssignmentsService,
    private readonly timerService: TimerService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  validateHierarchy(fromLevel: string, toLevel: string): void {
    if (fromLevel === 'L1' && toLevel !== 'L2') {
      throw new BadRequestException('L1 support can only escalate to L2.');
    }
    if (fromLevel === 'L2' && toLevel !== 'L3') {
      throw new BadRequestException('L2 support can only escalate to L3.');
    }
    if (fromLevel === 'L3' && toLevel !== 'PARENT_COMPANY') {
      throw new BadRequestException('L3 support can only escalate to Parent Company / Principal Vendor.');
    }
  }

  async escalateTicket(params: {
    ticketId: string;
    fromLevel?: 'L1' | 'L2' | 'L3' | string;
    toLevel?: 'L2' | 'L3' | 'PARENT_COMPANY' | string;
    escalatedByEmployeeId?: string;
    assignedToEmployeeId?: string | null;
    reason: string;
    notes?: string;
    actorUserId: number;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { department: true, product: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const effectiveFromLevel = params.fromLevel || (ticket.assignedLevel as any) || 'L1';
    let effectiveToLevel = params.toLevel;
    if (!effectiveToLevel) {
      if (effectiveFromLevel === 'L1') effectiveToLevel = 'L2';
      else if (effectiveFromLevel === 'L2') effectiveToLevel = 'L3';
      else if (effectiveFromLevel === 'L3') effectiveToLevel = 'PARENT_COMPANY';
      else effectiveToLevel = 'L2';
    }

    this.validateHierarchy(effectiveFromLevel, effectiveToLevel);

    if (ticket.status !== 'IN_PROGRESS' && ticket.status !== 'OPEN') {
      throw new BadRequestException(
        `Cannot escalate ticket in '${ticket.status}' status. Ticket must be IN_PROGRESS.`,
      );
    }

    let targetEmployeeId = params.assignedToEmployeeId;

    // Validate designated specialist or auto-assign best at toLevel within the same department
    if (targetEmployeeId && effectiveToLevel !== 'PARENT_COMPANY') {
      const targetEmp = await this.prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        include: { departmentRel: true },
      });
      if (!targetEmp) throw new NotFoundException('Designated escalation specialist not found.');
      if (targetEmp.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Cannot escalate to employee ${targetEmp.name} because their status is ${targetEmp.status}.`,
        );
      }
      if (targetEmp.level !== effectiveToLevel) {
        throw new BadRequestException(
          `Tier mismatch: Cannot assign ticket escalated to ${effectiveToLevel} to employee ${targetEmp.name} who is configured at ${targetEmp.level}.`,
        );
      }

      // STRICT DEPARTMENT ISOLATION DURING ESCALATION:
      // Tally escalates to Tally, Spine escalates to Spine, etc.
      if (ticket.departmentId && targetEmp.departmentId && ticket.departmentId !== targetEmp.departmentId) {
        const ticketDeptName = ticket.department?.name || 'Assigned Department';
        const empDeptName = targetEmp.departmentRel?.name || targetEmp.department;
        throw new BadRequestException(
          `Cannot escalate across departments. Ticket belongs to '${ticketDeptName}', but employee '${targetEmp.name}' is in '${empDeptName}'.`,
        );
      }
    } else if (!targetEmployeeId && effectiveToLevel !== 'PARENT_COMPANY') {
      // Auto-assign to lowest workload engineer at target level strictly within the same department
      const bestEmp = await this.assignmentsService.findBestAvailableEmployee(
        effectiveToLevel as EmployeeLevel,
        ticket.departmentId || undefined,
      );
      if (bestEmp) {
        targetEmployeeId = bestEmp.id;
      }
    }

    let escalatedByEmployeeId = params.escalatedByEmployeeId || ticket.assignedEmployeeId;
    if (!escalatedByEmployeeId) {
      const fallbackEmp = await this.prisma.employee.findFirst({
        where: { level: effectiveFromLevel as any, status: 'ACTIVE' },
      });
      escalatedByEmployeeId = fallbackEmp?.id || 'EMP-001';
    }

    // 1. Record immutable escalation entry
    await this.prisma.ticketEscalation.create({
      data: {
        ticket: { connect: { id: params.ticketId } },
        fromLevel: effectiveFromLevel as EmployeeLevel,
        toLevel: effectiveToLevel as TicketLevel,
        escalatedBy: { connect: { id: escalatedByEmployeeId } },
        assignedTo: targetEmployeeId ? { connect: { id: targetEmployeeId } } : undefined,
        reason: (params.reason || 'Escalated to next support tier').trim(),
        notes: params.notes?.trim() || null,
      },
    });

    // 2. Hand off resolution timer across escalation without resetting total duration
    if (targetEmployeeId) {
      await this.timerService.handoffSessionAcrossEscalation(
        params.ticketId,
        targetEmployeeId,
        params.toLevel as TicketLevel,
      );
    } else {
      await this.timerService.stopActiveSession(params.ticketId);
    }

    // 3. Update ticket record
    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        assignedLevel: params.toLevel as TicketLevel,
        assignedEmployeeId: targetEmployeeId || null,
      },
    });

    // 4. Re-assign in ticket_assignments if an employee was designated
    if (targetEmployeeId) {
      await this.prisma.ticketAssignment.updateMany({
        where: { ticketId: params.ticketId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });

      await this.prisma.ticketAssignment.create({
        data: {
          ticketId: params.ticketId,
          employeeId: targetEmployeeId,
          level: params.toLevel as TicketLevel,
          assignedBy: params.actorUserId,
          assignmentType: AssignmentType.MANUAL,
        },
      });
    }

    // 5. Log in timeline
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.actorUserId,
        actionType: 'ESCALATED',
        title: `Escalated: ${params.fromLevel} -> ${params.toLevel}`,
        description: `Reason: ${params.reason}. ${params.notes ? 'Notes: ' + params.notes : ''}`,
        metadataJson: JSON.stringify({
          fromLevel: params.fromLevel,
          toLevel: params.toLevel,
          escalatedBy: params.escalatedByEmployeeId,
          assignedTo: targetEmployeeId,
          departmentId: ticket.departmentId,
          departmentName: ticket.department?.name,
        }),
      },
    });

    // 6. Notify operations / specialist
    if (targetEmployeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: targetEmployeeId } });
      if (emp) {
        await this.notificationsService.broadcastTicketEvent({
          eventType: 'TICKET_ESCALATED',
          ticketId: params.ticketId,
          title: `Ticket Escalated to ${params.toLevel}: ${params.ticketId}`,
          message: `Ticket ${params.ticketId} escalated from ${params.fromLevel} to ${params.toLevel}. Reason: ${params.reason}`,
          recipientUserId: emp.userId,
          recipientEmail: emp.email,
          linkUrl: `/tickets/${params.ticketId}`,
        });
      }
    }

    await this.auditService.log({
      actorUserId: params.actorUserId,
      action: 'TICKET_ESCALATED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: {
        fromLevel: params.fromLevel,
        toLevel: params.toLevel,
        reason: params.reason,
        departmentId: ticket.departmentId,
      },
    });
  }
}
