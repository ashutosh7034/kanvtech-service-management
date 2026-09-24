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
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { customerContact: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const allowableStatuses: TicketStatus[] = [
      TicketStatus.IN_PROGRESS,
      TicketStatus.REOPENED,
      TicketStatus.OPEN,
    ];

    if (!allowableStatuses.includes(ticket.status)) {
      throw new BadRequestException(
        `Cannot resolve ticket in '${ticket.status}' status. Ticket must be IN_PROGRESS or REOPENED.`,
      );
    }

    // 1. Stop active work session
    await this.timerService.stopActiveSession(params.ticketId);

    // 2. Update ticket status directly to CUSTOMER_FEEDBACK for Customer Verification
    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: TicketStatus.CUSTOMER_FEEDBACK,
        resolutionEndedAt: new Date(),
      },
    });

    // 3. Add resolution comment
    await this.prisma.ticketComment.create({
      data: {
        ticketId: params.ticketId,
        authorUserId: params.actorUserId,
        commentType: CommentType.INTERNAL_NOTE,
        message: `Technical Resolution Notes: ${params.resolutionNotes}`,
      },
    });

    // 4. Log in history
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.actorUserId,
        actionType: 'RESOLVED',
        title: 'Technical Resolution Completed by Specialist',
        description: params.resolutionNotes,
        metadataJson: JSON.stringify({
          employeeId: params.employeeId,
          resolutionNotes: params.resolutionNotes,
        }),
      },
    });

    // 5. Notify customer for verification and CSAT feedback
    if (ticket.customerContact) {
      await this.notificationsService.broadcastTicketEvent({
        eventType: 'FEEDBACK_REQUESTED',
        ticketId: params.ticketId,
        title: `Your Ticket is Resolved: ${params.ticketId}`,
        message: `Technical work on ticket ${params.ticketId} has been completed. Please verify the solution and submit your feedback or reopen if needed.`,
        recipientUserId: ticket.customerContact.userId || undefined,
        recipientEmail: ticket.customerContact.email,
        linkUrl: `/tickets/${params.ticketId}`,
      });
    }

    // 6. Notify managers for operational reporting/dashboard oversight
    const managers = await this.prisma.employee.findMany({
      where: { managerId: null, status: 'ACTIVE' },
      include: { user: true },
    });

    for (const m of managers) {
      await this.notificationsService.broadcastTicketEvent({
        eventType: 'TICKET_RESOLVED_INFO',
        ticketId: params.ticketId,
        title: `Ticket Resolved: ${params.ticketId}`,
        message: `Ticket ${params.ticketId} has been resolved by specialist and transitioned to customer verification.`,
        recipientUserId: m.userId,
        recipientEmail: m.email,
        linkUrl: `/tickets/${params.ticketId}`,
      });
    }

    // 7. Audit log
    await this.auditService.log({
      actorUserId: params.actorUserId,
      action: 'TICKET_RESOLVED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { resolutionNotes: params.resolutionNotes, status: 'CUSTOMER_FEEDBACK' },
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

    if (ticket.status !== TicketStatus.MANAGER_REVIEW && ticket.status !== TicketStatus.CUSTOMER_FEEDBACK) {
      throw new BadRequestException(
        `Ticket is not in an approvable state (Current: ${ticket.status})`,
      );
    }

    if (ticket.status === TicketStatus.MANAGER_REVIEW) {
      await this.prisma.ticket.update({
        where: { id: params.ticketId },
        data: { status: TicketStatus.CUSTOMER_FEEDBACK },
      });
    }

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
    managerUserId?: number;
    userId?: number;
    reason: string;
    isCustomer?: boolean;
  }): Promise<void> {
    const actorId = params.userId || params.managerUserId || 1;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { assignedEmployee: true, customerContact: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const allowableStatuses: TicketStatus[] = [
      TicketStatus.MANAGER_REVIEW,
      TicketStatus.RESOLVED,
      TicketStatus.CUSTOMER_FEEDBACK,
      TicketStatus.CLOSED,
    ];

    if (!allowableStatuses.includes(ticket.status)) {
      throw new BadRequestException(`Ticket cannot be reopened from '${ticket.status}'.`);
    }

    // 1. Record in TicketReopenHistory
    await this.prisma.ticketReopenHistory.create({
      data: {
        ticketId: params.ticketId,
        reopenedBy: actorId,
        reopenReason: params.reason.trim(),
        previousStatus: ticket.status,
      },
    });

    // 2. Transition ticket back to active support
    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: TicketStatus.IN_PROGRESS,
        resolutionEndedAt: null,
        closedAt: null,
        closedBy: null,
        closureReason: null,
      },
    });

    // 3. Add note
    await this.prisma.ticketComment.create({
      data: {
        ticketId: params.ticketId,
        authorUserId: actorId,
        commentType: params.isCustomer ? CommentType.CUSTOMER_COMMUNICATION : CommentType.INTERNAL_NOTE,
        message: `Ticket Reopened (${params.isCustomer ? 'Customer' : 'Manager'}): ${params.reason}`,
      },
    });

    // 4. Log in timeline
    const actionType = params.isCustomer ? 'CUSTOMER_REOPENED_TICKET' : 'MANAGER_REOPENED_TICKET';
    const title = params.isCustomer ? 'Ticket Reopened by Customer' : 'Resolution Sent Back / Reopened by Manager';
    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: actorId,
        actionType,
        title,
        description: `Reason: ${params.reason}`,
        metadataJson: JSON.stringify({
          reopenedBy: actorId,
          reason: params.reason,
          previousStatus: ticket.status,
          isCustomer: !!params.isCustomer,
        }),
      },
    });

    // 5. Resume work timer if assigned employee exists
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
          message: `${params.isCustomer ? 'Customer' : 'Manager'} reopened ticket ${params.ticketId}. Reason: ${params.reason}`,
          recipientUserId: ticket.assignedEmployee.userId,
          recipientEmail: ticket.assignedEmployee.email,
          linkUrl: `/tickets/${params.ticketId}`,
        });
      }
    }

    // 6. Audit log
    await this.auditService.log({
      actorUserId: actorId,
      action: params.isCustomer ? 'CUSTOMER_REOPENED_TICKET' : 'MANAGER_REOPENED_TICKET',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { reason: params.reason, previousStatus: ticket.status },
    });
  }
}
