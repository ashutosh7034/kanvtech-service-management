import { db } from '../db/database';
import { TicketLevel, TicketResolutionSession } from '../types';

export class TimerService {
  /**
   * Starts a resolution session when an assigned employee begins working on a ticket.
   */
  public static async startWorkSession(
    ticketId: string,
    employeeId: string,
    level: TicketLevel
  ): Promise<number> {
    // If there is already an active session for this ticket, close it first (safety check)
    await this.stopActiveSession(ticketId);

    const res = await db.execute(
      `INSERT INTO ticket_resolution_sessions (ticket_id, employee_id, level, started_at, duration_seconds)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)`,
      [ticketId, employeeId, level]
    );

    // Update ticket resolution started timestamp if this is the first work session
    await db.execute(
      `UPDATE tickets SET
         resolution_started_at = COALESCE(resolution_started_at, CURRENT_TIMESTAMP),
         status = 'IN_PROGRESS'
       WHERE id = ? AND status = 'OPEN'`,
      [ticketId]
    );

    return res.insertId;
  }

  /**
   * Closes any currently active session (e.g. when escalating or resolving).
   */
  public static async stopActiveSession(ticketId: string): Promise<number> {
    const activeSessions = await db.query<TicketResolutionSession>(
      `SELECT * FROM ticket_resolution_sessions 
       WHERE ticket_id = ? AND ended_at IS NULL 
       ORDER BY started_at DESC LIMIT 1`,
      [ticketId]
    );

    if (activeSessions.length === 0) return 0;

    const session = activeSessions[0];
    const startedMs = new Date(session.started_at).getTime();
    const nowMs = Date.now();
    const durationSeconds = Math.max(1, Math.round((nowMs - startedMs) / 1000));

    await db.execute(
      `UPDATE ticket_resolution_sessions SET
         ended_at = CURRENT_TIMESTAMP,
         duration_seconds = ?
       WHERE id = ?`,
      [durationSeconds, session.id]
    );

    // Recalculate total resolution seconds on the ticket
    await this.syncTotalTicketDuration(ticketId);

    return durationSeconds;
  }

  /**
   * Transitions active work session seamlessly across escalation levels without losing time.
   */
  public static async handoffSessionAcrossEscalation(
    ticketId: string,
    toEmployeeId: string,
    toLevel: TicketLevel
  ): Promise<void> {
    // 1. Close current level's active session
    await this.stopActiveSession(ticketId);

    // 2. Open new session under destination level & employee
    await db.execute(
      `INSERT INTO ticket_resolution_sessions (ticket_id, employee_id, level, started_at, duration_seconds)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)`,
      [ticketId, toEmployeeId, toLevel]
    );
  }

  /**
   * Aggregates all closed session durations plus ongoing session time (continuous timer source of truth).
   */
  public static async getTotalResolutionTime(ticketId: string): Promise<{
    totalSeconds: number;
    isRunning: boolean;
    activeSessionSeconds: number;
    sessions: TicketResolutionSession[];
  }> {
    const sessions = await db.query<any>(
      `SELECT s.*, e.name as employee_name
       FROM ticket_resolution_sessions s
       LEFT JOIN employees e ON s.employee_id = e.id
       WHERE s.ticket_id = ?
       ORDER BY s.started_at ASC`,
      [ticketId]
    );

    let totalSeconds = 0;
    let isRunning = false;
    let activeSessionSeconds = 0;

    for (const s of sessions) {
      if (s.ended_at) {
        totalSeconds += Number(s.duration_seconds || 0);
      } else {
        isRunning = true;
        const startedMs = new Date(s.started_at).getTime();
        activeSessionSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));
        totalSeconds += activeSessionSeconds;
      }
    }

    return {
      totalSeconds,
      isRunning,
      activeSessionSeconds,
      sessions,
    };
  }

  /**
   * Synchronizes ticket's total_resolution_seconds column from all completed sessions.
   */
  public static async syncTotalTicketDuration(ticketId: string): Promise<void> {
    const rows = await db.query<{ sum_duration: number }>(
      `SELECT COALESCE(SUM(duration_seconds), 0) as sum_duration 
       FROM ticket_resolution_sessions 
       WHERE ticket_id = ? AND ended_at IS NOT NULL`,
      [ticketId]
    );
    const sum = Number(rows[0]?.sum_duration || 0);
    await db.execute('UPDATE tickets SET total_resolution_seconds = ? WHERE id = ?', [sum, ticketId]);
  }
}
