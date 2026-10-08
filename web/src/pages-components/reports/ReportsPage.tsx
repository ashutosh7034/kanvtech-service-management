import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Star,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { exportReportToExcel, exportReportToPdf } from '../../utils/reportExporter';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [resolutionByLevel, setResolutionByLevel] = useState<any[]>([]);
  const [workload, setWorkload] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Export State
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [exportingType, setExportingType] = useState<'excel' | 'pdf' | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReports();
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const showFeedbackMessage = (message: string, isError = false) => {
    setExportFeedback({ message, isError });
    setTimeout(() => {
      setExportFeedback(null);
    }, 4000);
  };

  const handleDownloadExcel = async () => {
    setShowExportDropdown(false);
    setExportingType('excel');
    try {
      await exportReportToExcel({
        resolutionByLevel,
        workload,
        escalations,
        generatedBy: user?.displayName ? `${user.displayName} (${user.email})` : user?.email || 'System Administrator',
      });
      showFeedbackMessage('Operations & SLA Report exported successfully as Excel (.xlsx)');
    } catch (err: any) {
      console.error('Failed to export Excel report', err);
      showFeedbackMessage(`Failed to export Excel: ${err.message || 'Unknown error'}`, true);
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    setShowExportDropdown(false);
    setExportingType('pdf');
    try {
      await exportReportToPdf({
        resolutionByLevel,
        workload,
        escalations,
        generatedBy: user?.displayName ? `${user.displayName} (${user.email})` : user?.email || 'System Administrator',
      });
      showFeedbackMessage('Operations & SLA Report exported successfully as PDF (.pdf)');
    } catch (err: any) {
      console.error('Failed to export PDF report', err);
      showFeedbackMessage(`Failed to export PDF: ${err.message || 'Unknown error'}`, true);
    } finally {
      setExportingType(null);
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
      {/* PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Operations & SLA Analytics</h2>
          <div className="page-subtitle">Real performance telemetry, resolution times by support tier, and specialist workload</div>
        </div>

        {/* DOWNLOAD REPORT BUTTON & DROPDOWN */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13 }}
            disabled={loading || exportingType !== null}
            onClick={() => setShowExportDropdown((prev) => !prev)}
          >
            {exportingType ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>{exportingType ? 'Exporting Report...' : 'Download Report'}</span>
            <ChevronDown size={14} style={{ opacity: 0.8 }} />
          </button>

          {/* Export Options Dropdown */}
          {showExportDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                zIndex: 1000,
                minWidth: 220,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select Export Format
              </div>
              <button
                type="button"
                onClick={handleDownloadExcel}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#1e293b',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Download Excel (.xlsx)</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Multi-sheet spreadsheet tables</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'transparent',
                  border: 'none',
                  borderTop: '1px solid #f1f5f9',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#1e293b',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Download PDF (.pdf)</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Formatted enterprise document</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FEEDBACK TOAST / ALERT */}
      {exportFeedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: exportFeedback.isError ? '#fef2f2' : '#f0fdf4',
            color: exportFeedback.isError ? '#b91c1c' : '#15803d',
            border: `1px solid ${exportFeedback.isError ? '#fecaca' : '#bbf7d0'}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          }}
        >
          {exportFeedback.isError ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{exportFeedback.message}</span>
        </div>
      )}

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
                  {workload.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 18, color: '#94a3b8' }}>
                        No active specialist workload data available.
                      </td>
                    </tr>
                  ) : (
                    workload.map((emp) => (
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
                    ))
                  )}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                    Tier Transfer Volumes:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {!escalations.transitionMatrix || escalations.transitionMatrix.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>No escalation transitions recorded yet.</div>
                    ) : (
                      escalations.transitionMatrix.map((m: any, idx: number) => (
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
                    {!escalations.topReasons || escalations.topReasons.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>No escalation reasons logged yet.</div>
                    ) : (
                      escalations.topReasons.map((r: any, idx: number) => (
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
