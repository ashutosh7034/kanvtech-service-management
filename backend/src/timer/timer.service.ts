import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketLevel, TicketStatus } from '@prisma/client';

@Injectable()
export class TimerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Start a new work session. Ticket must be OPEN, REOPENED, or IN_PROGRESS.
   * If a session is accidentally left open, it is closed first (safety net).
   */
  async startWorkSession(ticketId: string, employeeId: string, level: TicketLevel): Promise<number> {
    if (!employeeId) {
      throw new BadRequestException('Valid employeeId is required to start a resolution session.');
    }

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new BadRequestException('Ticket not found.');

    const forbiddenStatuses: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CUSTOMER_FEEDBACK, TicketStatus.MANAGER_REVIEW];
    if (forbiddenStatuses.includes(ticket.status)) {
      throw new BadRequestException(`Cannot start timer: ticket is already ${ticket.status}.`);
    }

    if (ticket.status === TicketStatus.IN_PROGRESS) {
      // Check for already active session — reject double-start
      const existing = await this.prisma.ticketResolutionSession.findFirst({
        where: { ticketId, endedAt: null },
      });
      if (existing) {
        throw new BadRequestException('Timer is already running. Pause it before starting a new session.');
      }
    }

    // Close any orphaned session safely
    await this.closeActiveSessionSafely(ticketId);

    const session = await this.prisma.ticketResolutionSession.create({
      data: {
        ticket: { connect: { id: ticketId } },
        employee: { connect: { id: employeeId } },
        level,
        startedAt: new Date(),
        durationSeconds: 0,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        resolutionStartedAt: ticket.resolutionStartedAt || new Date(),
        status: TicketStatus.IN_PROGRESS,
      },
    });

    return session.id;
  }

  /**
   * Pause: close current active session, set ticket to PAUSED.
   */
  async pauseWorkSession(ticketId: string): Promise<number> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new BadRequestException('Ticket not found.');
    if (ticket.status !== TicketStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot pause: ticket is in ${ticket.status} state, not IN_PROGRESS.`);
    }

    const activeSession = await this.prisma.ticketResolutionSession.findFirst({
      where: { ticketId, endedAt: null },
    });
    if (!activeSession) {
      throw new BadRequestException('No active timer session to pause.');
    }

    const elapsed = await this.closeActiveSessionSafely(ticketId);

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.PAUSED },
    });

    return elapsed;
  }

  /**
   * Resume: create a new session, set ticket back to IN_PROGRESS.
   * Cumulative time remains intact.
   */
  async resumeWorkSession(ticketId: string, employeeId: string, level: TicketLevel): Promise<number> {
    if (!employeeId) throw new BadRequestException('employeeId is required to resume session.');

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new BadRequestException('Ticket not found.');
    if (ticket.status !== TicketStatus.PAUSED) {
      throw new BadRequestException(`Cannot resume: ticket is in ${ticket.status} state, not PAUSED.`);
    }

    // Verify no active session already (safety)
    const existing = await this.prisma.ticketResolutionSession.findFirst({
      where: { ticketId, endedAt: null },
    });
    if (existing) {
      throw new BadRequestException('Timer already has an active session. This should not happen — data inconsistency detected.');
    }

    const session = await this.prisma.ticketResolutionSession.create({
      data: {
        ticket: { connect: { id: ticketId } },
        employee: { connect: { id: employeeId } },
        level,
        startedAt: new Date(),
        durationSeconds: 0,
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.IN_PROGRESS },
    });

    return session.id;
  }

  /**
   * Stop the active session (used by escalation & resolution).
   * Returns elapsed seconds in stopped session.
   */
  async stopActiveSession(ticketId: string): Promise<number> {
    return this.closeActiveSessionSafely(ticketId);
  }

  private async closeActiveSessionSafely(ticketId: string): Promise<number> {
    const activeSession = await this.prisma.ticketResolutionSession.findFirst({
      where: { ticketId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeSession) return 0;

    const startedMs = new Date(activeSession.startedAt).getTime();
    const nowMs = Date.now();
    const durationSeconds = Math.max(1, Math.round((nowMs - startedMs) / 1000));

    await this.prisma.ticketResolutionSession.update({
      where: { id: activeSession.id },
      data: { endedAt: new Date(), durationSeconds },
    });

    await this.syncTotalTicketDuration(ticketId);
    return durationSeconds;
  }

  async handoffSessionAcrossEscalation(
    ticketId: string,
    toEmployeeId: string,
    toLevel: TicketLevel,
  ): Promise<void> {
    // 1. Close current active session and lock its duration
    await this.closeActiveSessionSafely(ticketId);

    // 2. Open new session under next tier without resetting total timer
    if (toEmployeeId) {
      await this.prisma.ticketResolutionSession.create({
        data: {
          ticket: { connect: { id: ticketId } },
          employee: { connect: { id: toEmployeeId } },
          level: toLevel,
          startedAt: new Date(),
          durationSeconds: 0,
        },
      });
    }
  }

  async getTotalResolutionTime(ticketId: string) {
    const sessions = await this.prisma.ticketResolutionSession.findMany({
      where: { ticketId },
      orderBy: { startedAt: 'asc' },
      include: {
        employee: { select: { id: true, name: true } },
      },
    });

    let totalSeconds = 0;
    let isRunning = false;
    let activeSessionSeconds = 0;

    for (const s of sessions) {
      if (s.endedAt) {
        totalSeconds += s.durationSeconds;
      } else {
        isRunning = true;
        const startedMs = new Date(s.startedAt).getTime();
        activeSessionSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
        totalSeconds += activeSessionSeconds;
      }
    }

    return {
      totalSeconds,
      isRunning,
      activeSessionSeconds,
      sessions: sessions.map((s) => ({
        id: s.id,
        ticket_id: s.ticketId,
        employee_id: s.employeeId,
        employee_name: s.employee?.name || s.employeeId,
        level: s.level,
        started_at: s.startedAt,
        ended_at: s.endedAt,
        duration_seconds: s.durationSeconds,
      })),
    };
  }

  async syncTotalTicketDuration(ticketId: string): Promise<void> {
    const sessions = await this.prisma.ticketResolutionSession.findMany({
      where: { ticketId, endedAt: { not: null } },
      select: { durationSeconds: true },
    });

    const total = sessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { totalResolutionSeconds: total },
    });
  }
}
