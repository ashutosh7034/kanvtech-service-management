import { db } from '../db/database';
import { SLAConfiguration, TicketPriority, SLAStatus } from '../types';

export class SLAService {
  public static async getConfigurations(): Promise<SLAConfiguration[]> {
    return db.query<SLAConfiguration>('SELECT * FROM sla_configurations ORDER BY response_time_hours ASC');
  }

  public static async updateConfiguration(
    priority: TicketPriority,
    data: { response_time_hours: number; resolution_time_hours: number; warning_threshold_percent?: number }
  ): Promise<void> {
    await db.execute(
      `UPDATE sla_configurations SET
        response_time_hours = ?,
        resolution_time_hours = ?,
        warning_threshold_percent = COALESCE(?, warning_threshold_percent),
        updated_at = CURRENT_TIMESTAMP
       WHERE priority = ?`,
      [data.response_time_hours, data.resolution_time_hours, data.warning_threshold_percent || null, priority]
    );
  }

  public static async calculateDeadline(priority: TicketPriority, createdAtDate: Date): Promise<Date> {
    const configs = await db.query<SLAConfiguration>(
      'SELECT resolution_time_hours FROM sla_configurations WHERE priority = ?',
      [priority]
    );
    const hours = configs.length > 0 ? Number(configs[0].resolution_time_hours) : (priority === 'HIGH' ? 4 : priority === 'MEDIUM' ? 12 : 24);
    const deadline = new Date(createdAtDate.getTime() + hours * 60 * 60 * 1000);
    return deadline;
  }

  public static computeSLAStatus(params: {
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
      return { status: 'ON_TRACK', remainingSeconds: 0, percentElapsed: 0, isBreached: false };
    }

    const createdTime = new Date(params.createdAt).getTime();
    const deadlineTime = new Date(params.deadline).getTime();
    const totalDurationMs = Math.max(1000, deadlineTime - createdTime);
    const warningThreshold = params.warningPercent || 75;

    const isResolvedOrClosed = ['RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK', 'CLOSED'].includes(params.status);

    if (isResolvedOrClosed && params.resolvedAt) {
      const resolvedTime = new Date(params.resolvedAt).getTime();
      if (resolvedTime <= deadlineTime) {
        return { status: 'MET', remainingSeconds: 0, percentElapsed: 100, isBreached: false };
      } else {
        return { status: 'BREACHED', remainingSeconds: 0, percentElapsed: 100, isBreached: true };
      }
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - createdTime);
    const remainingMs = deadlineTime - now;
    const remainingSeconds = Math.round(remainingMs / 1000);
    const percentElapsed = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));

    if (now > deadlineTime) {
      return { status: 'BREACHED', remainingSeconds, percentElapsed: 100, isBreached: true };
    }

    if (percentElapsed >= warningThreshold) {
      return { status: 'WARNING', remainingSeconds, percentElapsed, isBreached: false };
    }

    return { status: 'ON_TRACK', remainingSeconds, percentElapsed, isBreached: false };
  }
}
