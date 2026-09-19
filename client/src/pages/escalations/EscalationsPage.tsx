import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Ticket } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import { ArrowUpRight, Eye } from 'lucide-react';

export const EscalationsPage: React.FC<{ onNavigateDetail: (id: string) => void }> = ({ onNavigateDetail }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEscalations();
  }, [levelFilter]);

  const loadEscalations = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets({
        level: levelFilter || undefined,
        status: 'IN_PROGRESS',
        limit: 50,
      });
      // Filter for tickets that have escalated to L2, L3, or PARENT_COMPANY
      const escalatedList = res.data.filter((t: Ticket) => ['L2', 'L3', 'PARENT_COMPANY'].includes(t.assigned_level));
      setTickets(escalatedList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Escalations Queue</h2>
          <div className="page-subtitle">Prioritized technical queue for Level 2 and Level 3 senior engineering interventions</div>
        </div>
      </div>

      <div className="filter-bar">
        <select className="select-filter" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">All Escalated Tiers (L2, L3, Parent)</option>
          <option value="L2">Level 2 (Senior Diagnostic)</option>
          <option value="L3">Level 3 (Core Engineering)</option>
          <option value="PARENT_COMPANY">Parent Company / Vendor</option>
        </select>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Company</th>
              <th>Problem Summary</th>
              <th>Priority</th>
              <th>Escalated Tier</th>
              <th>Escalation Reason & Handoff</th>
              <th>Assigned Specialist</th>
              <th>SLA Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                  Loading escalations...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                  No active escalations currently in the queue.
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
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 700,
                        fontSize: 12,
                        background: t.assigned_level === 'L2' ? '#fef3c7' : '#faf5ff',
                        color: t.assigned_level === 'L2' ? '#92400e' : '#6b21a8',
                        border: '1px solid currentColor',
                      }}
                    >
                      {t.assigned_level}
                    </span>
                  </td>
                  <td>
                    {t.latest_escalation_reason ? (
                      <div style={{ maxWidth: 220 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: 4, border: '1px solid #fde68a' }}>
                          "{t.latest_escalation_reason}"
                        </div>
                        {t.escalated_by_name && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            By {t.escalated_by_name} {t.escalated_at ? `(${new Date(t.escalated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Tier assignment</span>
                    )}
                  </td>
                  <td>{t.assigned_employee_name || <span style={{ color: '#dc2626', fontSize: 12 }}>Awaiting Triage</span>}</td>
                  <td>
                    <SLABadge status={t.liveSlaStatus || t.sla_status} remainingSeconds={t.slaRemainingSeconds} />
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => onNavigateDetail(t.id)}>
                      <Eye size={12} /> Work Screen
                    </button>
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
