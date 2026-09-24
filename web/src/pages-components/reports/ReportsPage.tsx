import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { BarChart3, TrendingUp, Users, Clock, Star, ArrowUpRight } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [resolutionByLevel, setResolutionByLevel] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [resLevel, resWorkload, resEsc] = await Promise.all([
        api.getResolutionByLevel(),
        api.getWorkloadReport(),
        api.getEscalationsReport(),
      ]);
      setResolutionByLevel(resLevel?.data || resLevel || []);
      setWorkload(resWorkload?.data || resWorkload || []);
      setEscalations(resEsc?.data || resEsc || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatSeconds = (sec?: number) => {
    if (!sec || sec <= 0) return '0m';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.round((sec % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Operations & SLA Analytics</h2>
          <div className="page-subtitle">Real performance telemetry, resolution times by support tier, and specialist workload</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Calculating real database metrics...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Resolution Time by Support Level */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                Resolution Time by Support Level (L1, L2, L3)
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tier Level</th>
                    <th>Tickets Handled</th>
                    <th>Total Work Sessions</th>
                    <th>Average Session Duration</th>
                    <th>Cumulative Time Invested</th>
                  </tr>
                </thead>
                <tbody>
                  {resolutionByLevel.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 18, color: '#94a3b8' }}>
                        No completed work sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    resolutionByLevel.map((row) => (
                      <tr key={row.level}>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 700,
                              fontSize: 12,
                              background: row.level === 'L1' ? '#eff6ff' : row.level === 'L2' ? '#fef3c7' : '#faf5ff',
                              color: row.level === 'L1' ? '#1e40af' : row.level === 'L2' ? '#92400e' : '#6b21a8',
                              border: '1px solid currentColor',
                            }}
                          >
                            {row.level} Specialist
                          </span>
                        </td>
                        <td><strong>{row.tickets_handled}</strong> tickets</td>
                        <td>{row.session_count} sessions</td>
                        <td style={{ fontWeight: 600, color: '#0b3b60' }}>
                          {formatSeconds(Math.round(row.avg_session_seconds))}
                        </td>
                        <td>{formatSeconds(row.total_seconds)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee Workload & Performance Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Users size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                Specialist Workload & Performance Ranking
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Tier Level</th>
                    <th>Department</th>
                    <th>Currently Active Tickets</th>
                    <th>Completed Tickets</th>
                    <th>Average Resolution Time</th>
                    <th>Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{emp.id}</div>
                      </td>
                      <td>
                        <strong>{emp.level}</strong>
                      </td>
                      <td>{emp.department}</td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontWeight: 600,
                            fontSize: 12,
                            background: emp.active_tickets > 0 ? '#fffbeb' : '#f0fdf4',
                            color: emp.active_tickets > 0 ? '#b45309' : '#16a34a',
                          }}
                        >
                          {emp.active_tickets || 0} active
                        </span>
                      </td>
                      <td>
                        <strong>{emp.completed_tickets || 0}</strong> resolved
                      </td>
                      <td style={{ color: '#475569' }}>
                        {formatSeconds(Math.round(emp.avg_resolution_seconds || 0))}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            emp.availability === 'AVAILABLE'
                              ? 'badge-resolved'
                              : emp.availability === 'BUSY'
                              ? 'badge-in_progress'
                              : 'badge-closed'
                          }`}
                        >
                          {emp.availability}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Escalations Flow Matrix */}
          {escalations && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <ArrowUpRight size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                  Escalation Flow Telemetry
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    Tier Transfer Volumes:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {escalations.transitionMatrix?.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>No escalation transitions recorded yet.</div>
                    ) : (
                      escalations.transitionMatrix?.map((m: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#f8fafc',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            fontSize: 13,
                          }}
                        >
                          <span>
                            <strong>{m.from_level}</strong> ➔ <strong>{m.to_level}</strong>
                          </span>
                          <span style={{ fontWeight: 700, color: '#0b3b60' }}>{m.count} transfers</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    Leading Escalation Triggers / Reasons:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {escalations.topReasons?.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>No escalation reasons logged yet.</div>
                    ) : (
                      escalations.topReasons?.map((r: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#f8fafc',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: '#334155' }}>"{r.reason}"</span>
                          <span style={{ fontWeight: 600, color: '#64748b' }}>{r.count}x</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
