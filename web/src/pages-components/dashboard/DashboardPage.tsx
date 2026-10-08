import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import {
  Ticket,
  AlertOctagon,
  CheckCircle2,
  CheckSquare,
  TrendingUp,
  Package,
  Rocket,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Bell,
  Plus,
} from 'lucide-react';

interface Props {
  onNavigate: (view: string, id?: string) => void;
}

const priorityBadgeStyles: Record<string, { color: string; bg: string }> = {
  LOW: { color: '#64748b', bg: '#f1f5f9' },
  MEDIUM: { color: '#0284c7', bg: '#e0f2fe' },
  HIGH: { color: '#d97706', bg: '#fef3c7' },
  URGENT: { color: '#dc2626', bg: '#fee2e2' },
  CRITICAL: { color: '#dc2626', bg: '#fee2e2' },
};

export const DashboardPage: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [bizStats, setBizStats] = useState<{
    products?: any;
    subscriptions?: any;
    implementations?: any;
    allotment?: any;
  }>({});
  const [taskSummary, setTaskSummary] = useState<{
    metrics?: {
      dueTodayCount: number;
      upcomingCount: number;
      overdueCount: number;
      completedCount: number;
      totalPendingCount: number;
    };
    todayTasks?: any[];
    overdueTasks?: any[];
    upcomingTasks?: any[];
  }>({
    metrics: {
      dueTodayCount: 0,
      upcomingCount: 0,
      overdueCount: 0,
      completedCount: 0,
      totalPendingCount: 0,
    },
    todayTasks: [],
    overdueTasks: [],
    upcomingTasks: [],
  });
  const [loading, setLoading] = useState(true);

  const isManagement = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isEmployee = user?.role !== 'CUSTOMER';

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      if (res.metrics) {
        setData(res.metrics);
      }

      if (isEmployee) {
        api.getMyTaskSummary()
          .then((tRes) => {
            if (tRes.metrics) setTaskSummary(tRes);
          })
          .catch(() => {});
      }

      if (isManagement) {
        try {
          const [pStats, sStats, iStats, aStats] = await Promise.all([
            api.getProductStats().catch(() => ({ stats: null })),
            api.getSubscriptionStats().catch(() => ({ stats: null })),
            api.getImplementationStats().catch(() => ({ stats: null })),
            api.getAllotmentStats().catch(() => ({ stats: null })),
          ]);
          setBizStats({
            products: pStats.stats,
            subscriptions: sStats.stats,
            implementations: iStats.stats,
            allotment: aStats.stats,
          });
        } catch (e) {
          console.error('Failed to load business stats', e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading operational metrics...</div>;
  }

  const volume = data?.volume || {};
  const sla = data?.sla || {};
  const csat = data?.csat || {};
  const attentionTickets = data?.attentionTickets || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Service Operations Dashboard</h2>
          <div className="page-subtitle">
            Real-time service operations and enterprise support intelligence
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isManagement && (
            <button className="btn btn-secondary" onClick={() => onNavigate('task_allotment')}>
              <UserCheck size={16} /> Task Allotment ({bizStats.allotment?.totalUnassigned || 0})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => onNavigate('tickets_create')}>
            + Open New Ticket
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="card"
          style={{ padding: '16px 20px', marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onClick={() => onNavigate('tickets')}
          title="Click to view all active tickets"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Active Tickets
            </span>
            <Ticket size={18} color="var(--brand-primary)" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' }}>
            {volume.active || 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {volume.unassigned || 0} unassigned • {volume.inProgress || 0} in progress
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '16px 20px', marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onClick={() => onNavigate('escalations')}
          title="Click to view escalations queue"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              SLA Breaches
            </span>
            <AlertOctagon size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: sla.breached > 0 ? '#dc2626' : 'var(--text-primary)' }}>
            {sla.breached || 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {sla.warning || 0} tickets at warning threshold (75%)
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '16px 20px', marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onClick={() => onNavigate('approvals')}
          title="Click to view pending manager reviews"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Pending Approvals
            </span>
            <CheckSquare size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' }}>
            {volume.managerReview || 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Awaiting Manager Review
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              SLA Compliance
            </span>
            <TrendingUp size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: '#16a34a' }}>
            {sla.complianceRate !== undefined ? `${sla.complianceRate}%` : '100%'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {sla.met || 0} met within resolution threshold
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              CSAT Score
            </span>
            <CheckCircle2 size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' }}>
            {csat.avgRating ? `${csat.avgRating} / 5.0` : '0.0 / 5.0'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Based on {csat.totalRated || 0} customer ratings
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MY PERSONAL TASKS & REMINDERS WIDGET                     */}
      {/* ========================================================= */}
      {isEmployee && taskSummary && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  My Tasks & Reminders
                </h3>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Personal task list and scheduled in-app reminders
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate('task_reminders')}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={13} /> Add Task
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('task_reminders')}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View All ({taskSummary.metrics?.totalPendingCount || 0}) <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Metric Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div
              style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              onClick={() => onNavigate('task_reminders')}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Due Today</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', marginTop: 2 }}>
                {taskSummary.metrics?.dueTodayCount || 0}
              </div>
            </div>

            <div
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              onClick={() => onNavigate('task_reminders')}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Upcoming</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                {taskSummary.metrics?.upcomingCount || 0}
              </div>
            </div>

            <div
              style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              onClick={() => onNavigate('task_reminders')}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Overdue</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
                {taskSummary.metrics?.overdueCount || 0}
              </div>
            </div>

            <div
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: 6, cursor: 'pointer' }}
              onClick={() => onNavigate('task_reminders')}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Completed</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#334155', marginTop: 2 }}>
                {taskSummary.metrics?.completedCount || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Middle Section: SLA Breakdown & Priority Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Operational SLA Breakdown</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{sla.onTrack || 0}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>On Track</div>
            </div>
            <div style={{ background: '#fffbeb', padding: 14, borderRadius: 6, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{sla.warning || 0}</div>
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>Warning Risk</div>
            </div>
            <div style={{ background: '#fef2f2', padding: 14, borderRadius: 6, border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{sla.breached || 0}</div>
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Breached</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 6, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>{sla.met || 0}</div>
              <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>SLA Met</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">Priority Split</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data?.priorities?.map((p: any) => (
              <div key={p.priority} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`priority-${p.priority.toLowerCase()}`} style={{ fontSize: 13 }}>
                  ● {p.priority} Priority
                </span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Tickets Requiring Attention */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Tickets Requiring Immediate Attention</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Priority-sorted list of breached, warning, or unassigned service tickets
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('tickets')}>
            View All ({volume.total || 0})
          </button>
        </div>

        {attentionTickets.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
            No urgent tickets requiring attention. All operations within normal limits.
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Company</th>
                  <th>Problem Summary</th>
                  <th>Priority</th>
                  <th>Level</th>
                  <th>Assignee</th>
                  <th>SLA Status</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {attentionTickets.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{t.id}</td>
                    <td>{t.company_name}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.problem_type}
                    </td>
                    <td>
                      <span className={`priority-${t.priority.toLowerCase()}`}>{t.priority}</span>
                    </td>
                    <td><strong>{t.assigned_level}</strong></td>
                    <td>{t.assigned_employee_name || <span style={{ color: '#dc2626' }}>Unassigned</span>}</td>
                    <td><SLABadge status={t.sla_status} showCountdown={false} /></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onNavigate('ticket_detail', t.id)}
                      >
                        Open Work Screen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
