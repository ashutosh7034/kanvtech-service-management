import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketPriority, TicketStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(
    userRole: string,
    userId?: number,
    employeeId?: string,
    companyId?: string,
  ) {
    const where: any = {};

    if (userRole === 'CUSTOMER' && companyId) {
      where.companyId = companyId;
    } else if (['L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE'].includes(userRole) && employeeId) {
      where.assignedEmployeeId = employeeId;
    }

    const [allTickets, escalations, feedbackList] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        select: {
          id: true,
          status: true,
          priority: true,
          slaStatus: true,
          totalResolutionSeconds: true,
          createdAt: true,
          problemType: true,
          assignedLevel: true,
          company: { select: { companyName: true } },
          assignedEmployee: { select: { name: true } },
        },
      }),
      this.prisma.ticketEscalation.findMany({
        where: where.companyId || where.assignedEmployeeId ? { ticket: where } : undefined,
        select: { id: true, reason: true, fromLevel: true, toLevel: true },
      }),
      this.prisma.ticketFeedback.findMany({
        where: where.companyId || where.assignedEmployeeId ? { ticket: where } : undefined,
        select: { rating: true },
      }),
    ]);

    // 1. Volumes
    const total = allTickets.length;
    const open = allTickets.filter((t) => t.status === TicketStatus.OPEN).length;
    const inProgress = allTickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).length;
    const managerReview = allTickets.filter((t) => t.status === TicketStatus.MANAGER_REVIEW).length;
    const customerFeedback = allTickets.filter((t) => t.status === TicketStatus.CUSTOMER_FEEDBACK).length;
    const resolved = allTickets.filter((t) => t.status === TicketStatus.RESOLVED).length;
    const closed = allTickets.filter((t) => t.status === TicketStatus.CLOSED).length;

    // 2. SLA
    const breached = allTickets.filter((t) => t.slaStatus === 'BREACHED').length;
    const met = allTickets.filter((t) => t.slaStatus === 'MET').length;
    const warning = allTickets.filter((t) => t.slaStatus === 'WARNING').length;
    const onTrack = allTickets.filter((t) => t.slaStatus === 'ON_TRACK').length;
    const totalSlaEvaluated = breached + met + warning + onTrack;
    const complianceRate = totalSlaEvaluated > 0 ? Math.round((met / totalSlaEvaluated) * 100) : 100;

    // 3. Priorities
    const priorityMap: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const t of allTickets) {
      priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1;
    }
    const priorities = Object.keys(priorityMap).map((priority) => ({
      priority,
      count: priorityMap[priority],
    }));

    // 4. CSAT
    const totalRatings = feedbackList.length;
    const avgScore =
      totalRatings > 0
        ? (feedbackList.reduce((acc, curr) => acc + curr.rating, 0) / totalRatings).toFixed(1)
        : '0.0';
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const fb of feedbackList) {
      dist[fb.rating] = (dist[fb.rating] || 0) + 1;
    }

    // 5. Avg resolution seconds
    const ticketsWithTime = allTickets.filter((t) => t.totalResolutionSeconds > 0);
    const avgResSec =
      ticketsWithTime.length > 0
        ? Math.round(
            ticketsWithTime.reduce((a, b) => a + b.totalResolutionSeconds, 0) /
              ticketsWithTime.length,
          )
        : 0;

    // 6. Attention tickets
    const attentionTickets = allTickets
      .filter((t) => ['OPEN', 'IN_PROGRESS', 'MANAGER_REVIEW'].includes(t.status))
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        problem_type: t.problemType,
        priority: t.priority,
        status: t.status,
        assigned_level: t.assignedLevel,
        sla_status: t.slaStatus,
        created_at: t.createdAt,
        company_name: t.company?.companyName || null,
        assigned_employee_name: t.assignedEmployee?.name || null,
      }));

    return {
      volume: {
        total,
        open,
        inProgress,
        managerReview,
        customerFeedback,
        resolved,
        closed,
      },
      sla: {
        totalEvaluated: totalSlaEvaluated,
        breached,
        met,
        warning,
        onTrack,
        complianceRate,
      },
      priorities,
      totalEscalations: escalations.length,
      avgResolutionSeconds: avgResSec,
      csat: {
        totalRatings,
        averageScore: avgScore,
        distribution: dist,
      },
      attentionTickets,
    };
  }

  async getResolutionTimeByLevel() {
    const sessions = await this.prisma.ticketResolutionSession.findMany({
      where: { endedAt: { not: null } },
      select: {
        level: true,
        ticketId: true,
        durationSeconds: true,
      },
    });

    const byLevel: Record<string, { tickets: Set<string>; totalSec: number; count: number }> = {};

    for (const s of sessions) {
      if (!byLevel[s.level]) {
        byLevel[s.level] = { tickets: new Set(), totalSec: 0, count: 0 };
      }
      byLevel[s.level].tickets.add(s.ticketId);
      byLevel[s.level].totalSec += s.durationSeconds;
      byLevel[s.level].count += 1;
    }

    return Object.keys(byLevel).map((lvl) => ({
      level: lvl,
      tickets_handled: byLevel[lvl].tickets.size,
      session_count: byLevel[lvl].count,
      avg_session_seconds: Math.round(byLevel[lvl].totalSec / byLevel[lvl].count),
      total_seconds: byLevel[lvl].totalSec,
    }));
  }

  async getEmployeeWorkloadReport() {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        assignedTickets: {
          select: { status: true, totalResolutionSeconds: true },
        },
      },
      orderBy: { level: 'asc' },
    });

    return employees.map((e) => {
      const active = e.assignedTickets.filter((t) => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length;
      const completed = e.assignedTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
      const withSec = e.assignedTickets.filter((t) => t.totalResolutionSeconds > 0);
      const avgSec = withSec.length > 0 ? Math.round(withSec.reduce((a, b) => a + b.totalResolutionSeconds, 0) / withSec.length) : 0;

      return {
        id: e.id,
        name: e.name,
        department: e.department,
        designation: e.designation,
        level: e.level,
        availability: e.availability,
        status: e.status,
        active_tickets: active,
        completed_tickets: completed,
        avg_resolution_seconds: avgSec,
      };
    });
  }

  async getEscalationReport() {
    const escList = await this.prisma.ticketEscalation.findMany();

    const transitionMap: Record<string, number> = {};
    const reasonMap: Record<string, number> = {};

    for (const esc of escList) {
      const pair = `${esc.fromLevel} -> ${esc.toLevel}`;
      transitionMap[pair] = (transitionMap[pair] || 0) + 1;
      reasonMap[esc.reason] = (reasonMap[esc.reason] || 0) + 1;
    }

    const transitionMatrix = Object.keys(transitionMap).map((k) => {
      const [from_level, to_level] = k.split(' -> ');
      return { from_level, to_level, count: transitionMap[k] };
    });

    const topReasons = Object.keys(reasonMap)
      .map((r) => ({ reason: r, count: reasonMap[r] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      transitionMatrix,
      topReasons,
    };
  }
}
