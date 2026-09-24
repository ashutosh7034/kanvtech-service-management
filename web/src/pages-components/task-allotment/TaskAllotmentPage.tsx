'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  X,
  History,
  Shield,
  User,
} from 'lucide-react';
import { formatDateTime, formatDate } from '../../utils/date';

interface TicketQueueItem {
  id: string;
  company_id: string;
  company_name: string | null;
  contact_name: string | null;
  problem_type: string;
  priority: string;
  category: string;
  description: string;
  status: string;
  assigned_level: string;
  assigned_employee_id: string | null;
  assigned_employee_name: string | null;
  assigned_employee_level: string | null;
  assigned_employee_department: string | null;
  sla_deadline: string | null;
  sla_status: string;
  created_at: string;
  recent_assignments: Array<{
    id: number;
    employee_name: string;
    employee_level: string;
    assigned_by: string;
    assigned_at: string;
    type: string;
  }>;
}

interface EligibleEmployee {
  id: string;
  userId: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  level: string;
  availability: string;
  status: string;
  activeWorkload: number;
}

export const TaskAllotmentPage: React.FC<{ onNavigateDetail?: (ticketId: string) => void }> = ({
  onNavigateDetail,
}) => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<TicketQueueItem[]>([]);
  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Allotment Modal
  const [selectedTicket, setSelectedTicket] = useState<TicketQueueItem | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [allotmentNotes, setAllotmentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History Drawer
  const [historyTicket, setHistoryTicket] = useState<TicketQueueItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (assignedFilter !== 'ALL') params.assignedStatus = assignedFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;

      const [queueRes, empRes, statsRes] = await Promise.all([
        api.getTaskAllotmentQueue(params),
        api.getEligibleEmployees(),
        api.getAllotmentStats().catch(() => ({ stats: null })),
      ]);

      setQueue(queueRes.data || []);
      setEmployees(empRes.employees || []);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch task allotment queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [assignedFilter, priorityFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const openAllotModal = (ticket: TicketQueueItem) => {
    setSelectedTicket(ticket);
    setSelectedEmployeeId(ticket.assigned_employee_id || (employees[0]?.id || ''));
    setAllotmentNotes('');
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !selectedEmployeeId) return;
    setSubmitting(true);
    try {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      await api.directAssignTicket({
        ticketId: selectedTicket.id,
        employeeId: selectedEmployeeId,
        level: emp?.level,
        notes: allotmentNotes.trim() || undefined,
      });

      setSelectedTicket(null);
      fetchData();
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'badge-error';
      case 'MEDIUM':
        return 'badge-warning';
      case 'LOW':
        return 'badge-info';
      default:
        return 'badge';
    }
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserCheck className="text-primary" size={24} />
            Task Allotment & Direct Assignment
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Authority-based task dispatching: Directly assign or reassign tickets to any active technical specialist
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} />
          Refresh Queue
        </button>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>UNASSIGNED TICKETS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>{stats.unassigned}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7' }}>ASSIGNED & ACTIVE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0b3b60', marginTop: 4 }}>{stats.assigned}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>ELIGIBLE SPECIALISTS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{employees.length}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6' }}>TOTAL ACTIVE WORKFLOW</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#6d28d9', marginTop: 4 }}>{stats.totalOpen}</div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by ticket ID, problem summary, customer company, or assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="#64748b" />
            <select
              className="form-control"
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value as any)}
              style={{ width: 170 }}
            >
              <option value="ALL">All Assignment Statuses</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              <option value="ASSIGNED">Assigned Only</option>
            </select>
          </div>

          <select
            className="form-control"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ width: 140 }}
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          <button type="submit" className="btn btn-secondary">
            Filter
          </button>
        </form>
      </div>

      {/* Main Task Queue Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            Loading task allotment queue...
          </div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#b91c1c' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            {error}
          </div>
        ) : queue.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <CheckCircle2 size={36} color="#16a34a" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#334155' }}>Queue All Caught Up</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              No pending tickets matching the selected allotment filters.
            </div>
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>TICKET ID</th>
                <th style={{ padding: '12px 16px' }}>COMPANY & CONTACT</th>
                <th style={{ padding: '12px 16px' }}>PROBLEM SUMMARY</th>
                <th style={{ padding: '12px 16px' }}>PRIORITY</th>
                <th style={{ padding: '12px 16px' }}>CURRENT ASSIGNEE</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((t) => {
                const isAssigned = !!t.assigned_employee_id;
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0b3b60' }}>
                      <button
                        onClick={() => onNavigateDetail && onNavigateDetail(t.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        {t.id}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.company_name || 'N/A'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t.contact_name || t.company_id}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{t.problem_type}</div>
                      <div style={{ fontSize: 11, color: '#64748b', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${getPriorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isAssigned ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User size={13} color="#0284c7" />
                            {t.assigned_employee_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Tier {t.assigned_employee_level} • {t.assigned_employee_department || 'Support Desk'}
                          </div>
                        </div>
                      ) : (
                        <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                          UNASSIGNED
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => openAllotModal(t)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <ArrowRightLeft size={12} />
                          {isAssigned ? 'Reassign' : 'Assign'}
                        </button>
                        {t.recent_assignments.length > 0 && (
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => setHistoryTicket(t)}
                            title="View Assignment History"
                          >
                            <History size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Assignment Modal */}
      {selectedTicket && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  {selectedTicket.assigned_employee_id ? 'Reassign Ticket' : 'Assign Ticket'} • {selectedTicket.id}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {selectedTicket.company_name} • {selectedTicket.problem_type}
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Select Eligible Specialist *
                </label>
                <select
                  className="form-control"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.level}) — {emp.department} [Active Workload: {emp.activeWorkload} tickets]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Assignment Reason / Instructions (Optional)
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Priority resolution requested by management, direct domain expertise..."
                  value={allotmentNotes}
                  onChange={(e) => setAllotmentNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedTicket(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment History Drawer / Modal */}
      {historyTicket && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Assignment History • {historyTicket.id}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>{historyTicket.company_name}</div>
              </div>
              <button onClick={() => setHistoryTicket(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 350, overflowY: 'auto' }}>
              {historyTicket.recent_assignments.map((a, idx) => (
                <div key={a.id || idx} style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#0b3b60' }}>
                      Assigned to: {a.employee_name} ({a.employee_level})
                    </span>
                    <span className="badge" style={{ fontSize: 10, background: '#e2e8f0' }}>{a.type}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    By: {a.assigned_by} • {formatDateTime(a.assigned_at)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setHistoryTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
