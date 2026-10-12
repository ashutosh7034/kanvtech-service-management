import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../sla/sla.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly slaService: SlaService,
  ) {}

  async submitFeedback(params: {
    ticketId: string;
    customerUserId: number;
    rating: number;
    remarks?: string;
  }): Promise<void> {
    if (params.rating < 1 || params.rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5 stars.');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { customerContact: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const existingFeedback = await this.prisma.ticketFeedback.findUnique({
      where: { ticketId: params.ticketId },
    });
    if (existingFeedback) {
      throw new BadRequestException('Feedback has already been submitted for this ticket.');
    }

    await this.prisma.ticketFeedback.create({
      data: {
        ticketId: params.ticketId,
        customerUserId: params.customerUserId,
        rating: params.rating,
        remarks: params.remarks?.trim() || null,
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.customerUserId,
        actionType: 'FEEDBACK_SUBMITTED',
        title: `Customer Feedback Received: ${params.rating} / 5 Stars`,
        description: params.remarks ? `Remarks: "${params.remarks}"` : 'No additional remarks provided.',
        metadataJson: JSON.stringify({ rating: params.rating, remarks: params.remarks }),
      },
    });

    await this.auditService.log({
      actorUserId: params.customerUserId,
      action: 'CUSTOMER_FEEDBACK_SUBMITTED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: { rating: params.rating, remarks: params.remarks },
    });

    // Auto-close ticket upon receiving feedback
    await this.closeTicket({
      ticketId: params.ticketId,
      closedByUserId: params.customerUserId,
      closureReason: `Closed automatically following customer feedback (${params.rating}/5 stars).`,
      source: 'FEEDBACK',
    });
  }

  async closeTicket(params: {
    ticketId: string;
    closedByUserId: number;
    closureReason: string;
    source?: 'FEEDBACK' | 'MANUAL' | 'AUTO_TIMEOUT';
  }): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      include: { customerContact: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.status === TicketStatus.CLOSED) {
      if (params.source === 'FEEDBACK') {
        return;
      }
      throw new BadRequestException('Ticket is already closed.');
    }

    const allowableClosureStatuses: TicketStatus[] = [
      TicketStatus.CUSTOMER_FEEDBACK,
      TicketStatus.RESOLVED,
      TicketStatus.MANAGER_REVIEW,
    ];

    if (!allowableClosureStatuses.includes(ticket.status)) {
      throw new BadRequestException(
        `Cannot close an unresolved ticket in '${ticket.status}' status. The ticket must first be resolved.`,
      );
    }

    if (!params.closureReason || !params.closureReason.trim()) {
      throw new BadRequestException('A valid closure reason is required.');
    }

    const slaResult = this.slaService.computeSLAStatus({
      createdAt: ticket.createdAt,
      deadline: ticket.slaDeadline,
      status: 'CLOSED',
      resolvedAt: ticket.resolutionEndedAt || new Date(),
    });

    const closingActor = await this.prisma.user.findUnique({
      where: { id: params.closedByUserId },
      include: { employee: true, companyContacts: true },
    });

    const actorRole = closingActor?.role || 'USER';
    const actorName =
      closingActor?.employee?.name ||
      closingActor?.companyContacts?.[0]?.name ||
      (actorRole === 'ADMIN' ? 'System Administrator' : closingActor?.email || 'User');

    let historyTitle = 'Ticket Successfully Closed';
    if (params.source === 'FEEDBACK') {
      historyTitle = `Ticket Closed via Customer Feedback (${actorName})`;
    } else if (actorRole === 'ADMIN') {
      historyTitle = `Ticket Closed Manually by Administrator (${actorName})`;
    } else if (actorRole === 'MANAGER') {
      historyTitle = `Ticket Closed Manually by Manager (${actorName})`;
    } else if (actorRole === 'CUSTOMER') {
      historyTitle = `Ticket Closed by Customer (${actorName})`;
    }

    await this.prisma.ticket.update({
      where: { id: params.ticketId },
      data: {
        status: TicketStatus.CLOSED,
        slaStatus: slaResult.status,
        closedAt: new Date(),
        closedBy: params.closedByUserId,
        closureReason: params.closureReason.trim(),
      },
    });

    await this.prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: params.closedByUserId,
        actionType: 'CLOSED',
        title: historyTitle,
        description: params.closureReason.trim(),
        metadataJson: JSON.stringify({
          closedBy: params.closedByUserId,
          closedByName: actorName,
          closedByRole: actorRole,
          reason: params.closureReason.trim(),
          source: params.source || 'MANUAL',
          finalSlaStatus: slaResult.status,
          totalResolutionSeconds: ticket.totalResolutionSeconds,
        }),
      },
    });

    if (ticket.customerContact) {
      await this.notificationsService.broadcastTicketEvent({
        eventType: 'TICKET_CLOSED',
        ticketId: params.ticketId,
        title: `Ticket Closed: ${params.ticketId}`,
        message: `Your service ticket ${params.ticketId} has been closed. Reason: ${params.closureReason.trim()}`,
        recipientUserId: ticket.customerContact.userId || undefined,
        recipientEmail: ticket.customerContact.email,
        linkUrl: `/tickets/${params.ticketId}`,
      });
    }

    await this.auditService.log({
      actorUserId: params.closedByUserId,
      action: 'TICKET_CLOSED',
      entityType: 'TICKET',
      entityId: params.ticketId,
      newValues: {
        previousStatus: ticket.status,
        newStatus: TicketStatus.CLOSED,
        closureReason: params.closureReason.trim(),
        closedByRole: actorRole,
        closedByName: actorName,
        finalSlaStatus: slaResult.status,
      },
    });
  }

  async getFeedback(ticketId: string) {
    const fb = await this.prisma.ticketFeedback.findUnique({
      where: { ticketId },
      include: {
        customer: {
          select: {
            email: true,
            companyContacts: { select: { name: true } },
          },
        },
      },
    });

    if (!fb) return null;

    return {
      id: fb.id,
      ticket_id: fb.ticketId,
      customer_user_id: fb.customerUserId,
      rating: fb.rating,
      remarks: fb.remarks,
      created_at: fb.createdAt,
      customer_email: fb.customer.email,
      customer_name: fb.customer.companyContacts[0]?.name || fb.customer.email,
    };
  }
}
