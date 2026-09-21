import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketLevel } from '@prisma/client';

@Injectable()
export class TimerService {
  constructor(private readonly prisma: PrismaService) {}

  async startWorkSession(ticketId: string, employeeId: string, level: TicketLevel): Promise<number> {
    if (!employeeId) {
      throw new Error('Valid employeeId is required to start a resolution session.');
    }
    await this.stopActiveSession(ticketId);

    const session = await this.prisma.ticketResolutionSession.create({
      data: {
        ticket: { connect: { id: ticketId } },
        employee: { connect: { id: employeeId } },
        level,
        startedAt: new Date(),
        durationSeconds: 0,
      },
    });

    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (ticket && ticket.status === 'OPEN') {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          resolutionStartedAt: ticket.resolutionStartedAt || new Date(),
          status: 'IN_PROGRESS',
        },
      });
    }

    return session.id;
  }

  async stopActiveSession(ticketId: string): Promise<number> {
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
      data: {
        endedAt: new Date(),
        durationSeconds,
      },
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
    await this.stopActiveSession(ticketId);

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
