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
} from 'lucide-react';

interface Props {
  onNavigate: (view: string, id?: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [bizStats, setBizStats] = useState<{
    products?: any;
    subscriptions?: any;
    implementations?: any;
    allotment?: any;
  }>({});
  const [loading, setLoading] = useState(true);

  const isManagement = user?.role === 'ADMIN' || user?.role === 'MANAGER';

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
            <Ticket size={18} color="#0b3b60" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: '#0f172a' }}>
            {volume.open + volume.inProgress}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {volume.open} unassigned • {volume.inProgress} in progress
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '16px 20px', marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onClick={() => onNavigate('tickets')}
          title="Click to inspect tickets at SLA risk"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              SLA Breaches
            </span>
            <AlertOctagon size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: sla.breached > 0 ? '#dc2626' : '#0f172a' }}>
            {sla.breached}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {sla.warning} tickets at warning threshold (75%)
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '16px 20px', marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onClick={() => onNavigate('approvals')}
          title="Click to review pending resolutions"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Pending Approvals
            </span>
            <CheckSquare size={18} color="#a21caf" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: '#a21caf' }}>
            {volume.managerReview}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Awaiting Manager Review
          </div>
        </div>

        <div
          className="card"
          style={{ padding: '16px 20px', marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
          onClick={() => onNavigate('reports')}
          title="Click to view SLA analytics"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              SLA Compliance
            </span>
            <TrendingUp size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: '#16a34a' }}>
            {sla.complianceRate}%
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {sla.met} met within resolution threshold
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              CSAT Score
            </span>
            <CheckCircle2 size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, color: '#0f172a' }}>
            {csat.averageScore} / 5.0
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Based on {csat.totalRatings} customer ratings
          </div>
        </div>
      </div>

      {/* Management Quick Stats (Business, AMC, Implementations) */}
      {isManagement && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div
            className="card"
            style={{ marginBottom: 0, cursor: 'pointer', background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', border: '1px solid #bbf7d0' }}
            onClick={() => onNavigate('products')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>
                  Product Catalog
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#14532d', marginTop: 4 }}>
                  {bizStats.products?.active || 0} <span style={{ fontSize: 13, fontWeight: 400, color: '#4ade80' }}>/ {bizStats.products?.total || 0} Total</span>
                </div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                  Active software & hardware modules
                </div>
              </div>
              <div style={{ background: '#dcfce7', padding: 10, borderRadius: 8 }}>
                <Package size={22} color="#16a34a" />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#15803d' }}>
              Manage Products <ArrowRight size={13} />
            </div>
          </div>

          <div
            className="card"
            style={{ marginBottom: 0, cursor: 'pointer', background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)', border: '1px solid #bfdbfe' }}
            onClick={() => onNavigate('maintenance')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', textTransform: 'uppercase' }}>
                  AMC & Subscriptions
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a', marginTop: 4 }}>
                  {bizStats.subscriptions?.active || 0} Active
                </div>
                <div style={{ fontSize: 12, color: '#1e40af', marginTop: 4 }}>
                  {bizStats.subscriptions?.expiringSoon || 0} expiring soon • {bizStats.subscriptions?.expired || 0} expired
                </div>
              </div>
              <div style={{ background: '#dbeafe', padding: 10, borderRadius: 8 }}>
                <ShieldCheck size={22} color="#2563eb" />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>
              View Contracts <ArrowRight size={13} />
            </div>
          </div>

          <div
            className="card"
            style={{ marginBottom: 0, cursor: 'pointer', background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)', border: '1px solid #e9d5ff' }}
            onClick={() => onNavigate('implementations')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b21a8', textTransform: 'uppercase' }}>
                  Client Implementations
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#581c87', marginTop: 4 }}>
                  {bizStats.implementations?.active || 0} Ongoing
                </div>
                <div style={{ fontSize: 12, color: '#6b21a8', marginTop: 4 }}>
                  {bizStats.implementations?.avgProgress || 0}% average progress ({bizStats.implementations?.live || 0} Live)
                </div>
              </div>
              <div style={{ background: '#f3e8ff', padding: 10, borderRadius: 8 }}>
                <Rocket size={22} color="#9333ea" />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#7e22ce' }}>
              Track Onboarding <ArrowRight size={13} />
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
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{sla.onTrack}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>On Track</div>
            </div>
            <div style={{ background: '#fffbeb', padding: 14, borderRadius: 6, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{sla.warning}</div>
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>Warning Risk</div>
            </div>
            <div style={{ background: '#fef2f2', padding: 14, borderRadius: 6, border: '1px solid #fecaca' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{sla.breached}</div>
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Breached</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 6, border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>{sla.met}</div>
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
            View All ({volume.total})
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
