import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Ticket } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { SLABadge } from '../../components/common/SLABadge';
import { CheckSquare, Eye, CheckCircle2, RotateCcw } from 'lucide-react';

export const ApprovalsPage: React.FC<{ onNavigateDetail: (id: string) => void }> = ({ onNavigateDetail }) => {
  const { showToast } = useNotifications();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets({ status: 'MANAGER_REVIEW', limit: 50 });
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickApprove = async (ticketId: string) => {
    try {
      await api.approveTicket(ticketId, { notes: 'Resolution approved via Manager Queue.' });
      showToast(`Ticket ${ticketId} approved. Forwarded for customer feedback.`, 'success');
      loadApprovals();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Manager Approvals Queue</h2>
          <div className="page-subtitle">Inspect completed technical resolutions and authorize handover to customers</div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Company</th>
              <th>Problem Summary</th>
              <th>Priority</th>
              <th>Resolved By Specialist</th>
              <th>Technician Resolution Notes</th>
              <th>SLA Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                  Loading approval items...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                  No tickets currently awaiting Manager Review. All resolutions processed.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>
                    {t.id}
                  </td>
                  <td>{t.company_name}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500 }}>{t.problem_type}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{t.category}</div>
                  </td>
                  <td>
                    <span className={`priority-${t.priority.toLowerCase()}`}>● {t.priority}</span>
                  </td>
                  <td>
                    <div>{t.assigned_employee_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tier {t.assigned_level}</div>
                  </td>
                  <td>
                    {t.latest_resolution_notes ? (
                      <div style={{ maxWidth: 240 }}>
                        <div style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', padding: '3px 8px', borderRadius: 4, border: '1px solid #bbf7d0', fontStyle: 'italic' }}>
                          "{t.latest_resolution_notes}"
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#64748b' }}>Technical resolution recorded</span>
                    )}
                  </td>
                  <td>
                    <SLABadge status={t.liveSlaStatus || t.sla_status} remainingSeconds={t.slaRemainingSeconds} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => onNavigateDetail(t.id)}>
                        <Eye size={12} /> Inspect
                      </button>
                      <button className="btn btn-success btn-sm" onClick={() => handleQuickApprove(t.id)}>
                        <CheckCircle2 size={12} /> Approve
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
