import { db } from '../db/database';

export class ReportService {
  /**
   * Executive Dashboard & Operations Metrics calculated from real database records.
   */
  public static async getDashboardMetrics(userRole: string, userId?: number, employeeId?: string, companyId?: string): Promise<any> {
    let scopeWhere = '1=1';
    const scopeParams: any[] = [];

    if (userRole === 'CUSTOMER' && companyId) {
      scopeWhere += ' AND t.company_id = ?';
      scopeParams.push(companyId);
    } else if (['L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'].includes(userRole) && employeeId) {
      scopeWhere += ' AND t.assigned_employee_id = ?';
      scopeParams.push(employeeId);
    }

    // 1. Core volume counts
    const volumeRows = await db.query<any>(
      `SELECT 
         COUNT(*) as total_tickets,
         SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
         SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
         SUM(CASE WHEN t.status = 'MANAGER_REVIEW' THEN 1 ELSE 0 END) as review_count,
         SUM(CASE WHEN t.status = 'CUSTOMER_FEEDBACK' THEN 1 ELSE 0 END) as feedback_count,
         SUM(CASE WHEN t.status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_count,
         SUM(CASE WHEN t.status = 'CLOSED' THEN 1 ELSE 0 END) as closed_count
       FROM tickets t
       WHERE ${scopeWhere}`,
      scopeParams
    );

    // 2. SLA Compliance metrics
    const slaRows = await db.query<any>(
      `SELECT 
         COUNT(*) as evaluated_count,
         SUM(CASE WHEN t.sla_status = 'BREACHED' THEN 1 ELSE 0 END) as breach_count,
         SUM(CASE WHEN t.sla_status = 'MET' THEN 1 ELSE 0 END) as met_count,
         SUM(CASE WHEN t.sla_status = 'WARNING' THEN 1 ELSE 0 END) as warning_count,
         SUM(CASE WHEN t.sla_status = 'ON_TRACK' THEN 1 ELSE 0 END) as on_track_count
       FROM tickets t
       WHERE ${scopeWhere}`,
      scopeParams
    );

    // 3. Priority distribution
    const priorityRows = await db.query<any>(
      `SELECT priority, COUNT(*) as count 
       FROM tickets t 
       WHERE ${scopeWhere} 
       GROUP BY priority`,
      scopeParams
    );

    // 4. Escalations metric
    const escalationCountRows = await db.query<any>(
      `SELECT COUNT(*) as total_escalations 
       FROM ticket_escalations esc
       JOIN tickets t ON esc.ticket_id = t.id
       WHERE ${scopeWhere}`,
      scopeParams
    );

    // 5. Customer CSAT metrics
    const csatRows = await db.query<any>(
      `SELECT 
         COUNT(*) as feedback_count,
         AVG(rating) as avg_rating,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
       FROM ticket_feedback fb
       JOIN tickets t ON fb.ticket_id = t.id
       WHERE ${scopeWhere}`,
      scopeParams
    );

    // 6. Average resolution time overall
    const avgResRows = await db.query<any>(
      `SELECT AVG(total_resolution_seconds) as avg_resolution_seconds
       FROM tickets t
       WHERE ${scopeWhere} AND total_resolution_seconds > 0`,
      scopeParams
    );

    // 7. Recent tickets requiring attention
    const attentionTickets = await db.query<any>(
      `SELECT t.id, t.problem_type, t.priority, t.status, t.assigned_level, t.sla_status, t.created_at,
              c.company_name, e.name as assigned_employee_name
       FROM tickets t
       LEFT JOIN companies c ON t.company_id = c.id
       LEFT JOIN employees e ON t.assigned_employee_id = e.id
       WHERE ${scopeWhere} AND t.status IN ('OPEN', 'IN_PROGRESS', 'MANAGER_REVIEW')
       ORDER BY 
         CASE WHEN t.sla_status = 'BREACHED' THEN 1
              WHEN t.sla_status = 'WARNING' THEN 2
              WHEN t.priority = 'HIGH' THEN 3
              ELSE 4 END ASC,
         t.created_at ASC
       LIMIT 10`,
      scopeParams
    );

    const v = volumeRows[0] || {};
    const s = slaRows[0] || {};
    const cs = csatRows[0] || {};
    const totalSlaEvaluated = Number(s.evaluated_count || 0);
    const metCount = Number(s.met_count || 0);
    const breachCount = Number(s.breach_count || 0);
    const complianceRate = totalSlaEvaluated > 0 ? Math.round((metCount / totalSlaEvaluated) * 100) : 100;

    return {
      volume: {
        total: Number(v.total_tickets || 0),
        open: Number(v.open_count || 0),
        inProgress: Number(v.in_progress_count || 0),
        managerReview: Number(v.review_count || 0),
        customerFeedback: Number(v.feedback_count || 0),
        resolved: Number(v.resolved_count || 0),
        closed: Number(v.closed_count || 0),
      },
      sla: {
        totalEvaluated: totalSlaEvaluated,
        breached: breachCount,
        met: metCount,
        warning: Number(s.warning_count || 0),
        onTrack: Number(s.on_track_count || 0),
        complianceRate,
      },
      priorities: priorityRows,
      totalEscalations: Number(escalationCountRows[0]?.total_escalations || 0),
      avgResolutionSeconds: Math.round(Number(avgResRows[0]?.avg_resolution_seconds || 0)),
      csat: {
        totalRatings: Number(cs.feedback_count || 0),
        averageScore: Number(cs.avg_rating || 0).toFixed(1),
        distribution: {
          5: Number(cs.five_star || 0),
          4: Number(cs.four_star || 0),
          3: Number(cs.three_star || 0),
          2: Number(cs.two_star || 0),
          1: Number(cs.one_star || 0),
        },
      },
      attentionTickets,
    };
  }

  /**
   * Detailed Operational Resolution Time breakdown by support level (L1, L2, L3).
   */
  public static async getResolutionTimeByLevel(): Promise<any[]> {
    const rows = await db.query<any>(
      `SELECT 
         s.level,
         COUNT(DISTINCT s.ticket_id) as tickets_handled,
         COUNT(s.id) as session_count,
         AVG(s.duration_seconds) as avg_session_seconds,
         SUM(s.duration_seconds) as total_seconds
       FROM ticket_resolution_sessions s
       WHERE s.ended_at IS NOT NULL
       GROUP BY s.level
       ORDER BY s.level ASC`
    );
    return rows;
  }

  /**
   * Employee workload and resolution performance metrics.
   */
  public static async getEmployeeWorkloadReport(): Promise<any[]> {
    const rows = await db.query<any>(
      `SELECT 
         e.id, e.name, e.department, e.designation, e.level, e.availability, e.status,
         (SELECT COUNT(*) FROM tickets t WHERE t.assigned_employee_id = e.id AND t.status IN ('OPEN', 'IN_PROGRESS')) as active_tickets,
         (SELECT COUNT(*) FROM tickets t WHERE t.assigned_employee_id = e.id AND t.status IN ('RESOLVED', 'CLOSED')) as completed_tickets,
         (SELECT AVG(total_resolution_seconds) FROM tickets t WHERE t.assigned_employee_id = e.id AND t.total_resolution_seconds > 0) as avg_resolution_seconds
       FROM employees e
       WHERE e.status = 'ACTIVE'
       ORDER BY active_tickets DESC, e.level ASC`
    );
    return rows;
  }

  /**
   * Escalation flow report (shows transfer volumes between tiers).
   */
  public static async getEscalationReport(): Promise<any> {
    const matrix = await db.query<any>(
      `SELECT from_level, to_level, COUNT(*) as count 
       FROM ticket_escalations 
       GROUP BY from_level, to_level`
    );

    const reasons = await db.query<any>(
      `SELECT reason, COUNT(*) as count 
       FROM ticket_escalations 
       GROUP BY reason 
       ORDER BY count DESC 
       LIMIT 10`
    );

    return {
      transitionMatrix: matrix,
      topReasons: reasons,
    };
  }
}
