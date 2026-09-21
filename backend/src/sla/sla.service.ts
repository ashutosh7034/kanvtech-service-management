import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPriority, SLAStatus } from '@prisma/client';

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfigurations() {
    const cfgs = await this.prisma.slaConfiguration.findMany({
      orderBy: { responseTimeHours: 'asc' },
    });
    return cfgs.map((c) => ({
      id: c.id,
      priority: c.priority,
      response_time_hours: c.responseTimeHours,
      resolution_time_hours: c.resolutionTimeHours,
      warning_threshold_percent: c.warningThresholdPercent,
      is_active: c.isActive ? 1 : 0,
      updated_at: c.updatedAt,
    }));
  }

  async updateConfiguration(
    priority: TicketPriority,
    data: { response_time_hours: number; resolution_time_hours: number; warning_threshold_percent?: number },
  ) {
    await this.prisma.slaConfiguration.update({
      where: { priority },
      data: {
        responseTimeHours: Number(data.response_time_hours),
        resolutionTimeHours: Number(data.resolution_time_hours),
        warningThresholdPercent:
          data.warning_threshold_percent !== undefined
            ? Number(data.warning_threshold_percent)
            : undefined,
      },
    });
  }

  async calculateDeadline(priority: TicketPriority, createdAtDate: Date): Promise<Date> {
    const config = await this.prisma.slaConfiguration.findUnique({
      where: { priority },
    });
    const hours = config ? config.resolutionTimeHours : (priority === 'HIGH' ? 4 : priority === 'MEDIUM' ? 12 : 24);
    return new Date(createdAtDate.getTime() + hours * 60 * 60 * 1000);
  }

  computeSLAStatus(params: {
    createdAt: string | Date;
    deadline: string | Date | null;
    status: string;
    resolvedAt?: string | Date | null;
    warningPercent?: number;
  }): {
    status: SLAStatus;
    remainingSeconds: number;
    percentElapsed: number;
    isBreached: boolean;
  } {
    if (!params.deadline) {
      return { status: SLAStatus.ON_TRACK, remainingSeconds: 0, percentElapsed: 0, isBreached: false };
    }

    const createdTime = new Date(params.createdAt).getTime();
    const deadlineTime = new Date(params.deadline).getTime();
    const totalDurationMs = Math.max(1000, deadlineTime - createdTime);
    const warningThreshold = params.warningPercent || 75;

    const isResolvedOrClosed = ['RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK', 'CLOSED'].includes(params.status);

    if (isResolvedOrClosed && params.resolvedAt) {
      const resolvedTime = new Date(params.resolvedAt).getTime();
      if (resolvedTime <= deadlineTime) {
        return { status: SLAStatus.MET, remainingSeconds: 0, percentElapsed: 100, isBreached: false };
      } else {
        return { status: SLAStatus.BREACHED, remainingSeconds: 0, percentElapsed: 100, isBreached: true };
      }
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - createdTime);
    const remainingMs = deadlineTime - now;
    const remainingSeconds = Math.round(remainingMs / 1000);
    const percentElapsed = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));

    if (now > deadlineTime) {
      return { status: SLAStatus.BREACHED, remainingSeconds, percentElapsed: 100, isBreached: true };
    }

    if (percentElapsed >= warningThreshold) {
      return { status: SLAStatus.WARNING, remainingSeconds, percentElapsed, isBreached: false };
    }

    return { status: SLAStatus.ON_TRACK, remainingSeconds, percentElapsed, isBreached: false };
  }
}
