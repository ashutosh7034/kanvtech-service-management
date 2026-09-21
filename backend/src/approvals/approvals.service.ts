import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimerService } from '../timer/timer.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketStatus, CommentType } from '@prisma/client';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timerService: TimerService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitForReview(params: {
    ticketId: string;
    employeeId: string;
    resolutionNotes: string;
    actorUserId: number;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: params.ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot resolve ticket in '${ticket.status}' status. Ticket must be IN_PROGRESS.`,
      );
    }

    // 1. Stop active work session
    await this.timerService.stopActiveSession(params.ticketId);

    // 2. Update ticket status
    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: TicketStatus.MANAGER_REVIEW,
        resolutionEndedAt: new Date(),
      },
    });

    // 3. Add resolution comment
    await this.prisma.ticketComment.create({
      data: {
        ticketId: params.ticketId,
        authorUserId: params.actorUserId,
        commentType: CommentType.INTERNAL_NOTE,
        message: `Resolution Notes: ${params.resolutionNotes}`,
      },
    });

    // 4. Log in history
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.actorUserId,
        actionType: 'RESOLVED',
        title: 'Ticket Resolved by Specialist',
        description: params.resolutionNotes,
        metadataJson: JSON.stringify({
          employeeId: params.employeeId,
          resolutionNotes: params.resolutionNotes,
        }),
      },
    });

    // 5. Notify managers
    const managers = await this.prisma.employee.findMany({
      where: { managerId: null, status: 'ACTIVE' },
      include: { user: true },
    });

    for (const m of managers) {
      await this.notificationsService.broadcastTicketEvent({
        eventType: 'TICKET_REVIEW_REQUIRED',
        ticketId: params.ticketId,
        title: `Manager Review Required: ${params.ticketId}`,
        message: `Ticket ${params.ticketId} has been resolved and is pending manager review.`,
        recipientUserId: m.userId,
        recipientEmail: m.email,
        linkUrl: `/approvals`,
      });
    }

    await this.auditService.log({
      actorUserId: params.actorUserId,
      action: 'TICKET_RESOLVED_SUBMITTED_FOR_REVIEW',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { resolutionNotes: params.resolutionNotes },
    });
  }

  async approveResolution(params: {
    ticketId: string;
    managerUserId: number;
    notes?: string;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { customerContact: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.MANAGER_REVIEW) {
      throw new BadRequestException(
        `Ticket is not in MANAGER_REVIEW state (Current: ${ticket.status})`,
      );
    }

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: { status: TicketStatus.CUSTOMER_FEEDBACK },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.managerUserId,
        actionType: 'REVIEW_APPROVED',
        title: 'Resolution Approved by Manager',
        description: params.notes || 'Manager approved the technical resolution. Requesting customer feedback.',
      },
    });

    if (ticket.customerContact) {
      await this.notificationsService.broadcastTicketEvent({
        eventType: 'FEEDBACK_REQUESTED',
        ticketId: params.ticketId,
        title: `Your Ticket is Resolved: ${params.ticketId}`,
        message: `Your ticket has been resolved. Please rate your experience and provide your feedback.`,
        recipientUserId: ticket.customerContact.userId || undefined,
        recipientEmail: ticket.customerContact.email,
        linkUrl: `/tickets/${params.ticketId}`,
      });
    }

    await this.auditService.log({
      actorUserId: params.managerUserId,
      action: 'MANAGER_APPROVED_RESOLUTION',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { approvalNotes: params.notes },
    });
  }

  async reopenResolution(params: {
    ticketId: string;
    managerUserId: number;
    reason: string;
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { assignedEmployee: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status !== TicketStatus.MANAGER_REVIEW && ticket.status !== TicketStatus.RESOLVED) {
      throw new BadRequestException(`Ticket cannot be reopened from '${ticket.status}'.`);
    }

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: TicketStatus.IN_PROGRESS,
        resolutionEndedAt: null,
      },
    });

    await this.prisma.ticketComment.create({
      data: {
        ticketId: params.ticketId,
        authorUserId: params.managerUserId,
        commentType: CommentType.INTERNAL_NOTE,
        message: `Reopened by Manager: ${params.reason}`,
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.managerUserId,
        actionType: 'REVIEW_REOPENED',
        title: 'Resolution Sent Back / Reopened by Manager',
        description: params.reason,
      },
    });

    if (ticket.assignedEmployeeId) {
      await this.timerService.startWorkSession(
        ticket.id,
        ticket.assignedEmployeeId,
        ticket.assignedLevel,
      );

      if (ticket.assignedEmployee) {
        await this.notificationsService.broadcastTicketEvent({
          eventType: 'TICKET_REOPENED',
          ticketId: params.ticketId,
          title: `Ticket Reopened: ${params.ticketId}`,
          message: `Manager requested additional work on ticket ${params.ticketId}. Reason: ${params.reason}`,
          recipientUserId: ticket.assignedEmployee.userId,
          recipientEmail: ticket.assignedEmployee.email,
          linkUrl: `/tickets/${params.ticketId}`,
        });
      }
    }

    await this.auditService.log({
      actorUserId: params.managerUserId,
      action: 'MANAGER_REOPENED_TICKET',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { reason: params.reason },
    });
  }
}
