import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Ticket } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import {
  Briefcase,
  Play,
  ArrowUpRight,
  CheckCircle,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronRight,
  User,
  LogOut,
} from 'lucide-react';

export const EmployeeMobileView: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'assigned' | 'detail' | 'attendance'>('assigned');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);

  // Attendance state
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [locationText, setLocationText] = useState('Bangalore Technology Center - Floor 4');

  // Work note state
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadAssignedTickets();
  }, [user]);

  const loadAssignedTickets = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets({ employeeId: user?.employeeId, limit: 20 });
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (id: string) => {
    try {
      const res = await api.getTicket(id);
      setSelectedTicket(res.ticket);
      setActiveTab('detail');
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleStartWork = async () => {
    if (!selectedTicket) return;
    try {
      await api.startWork(selectedTicket.id);
      showToast('Work started. Timer running.', 'success');
      const res = await api.getTicket(selectedTicket.id);
      setSelectedTicket(res.ticket);
      loadAssignedTickets();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Modal states replacing browser window.prompt
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const confirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !resolveNotes.trim()) return;
    setSubmittingAction(true);
    try {
      await api.resolveTicket(selectedTicket.id, { resolutionNotes: resolveNotes.trim() });
      showToast('Ticket marked resolved. Forwarded for Manager Review.', 'success');
      setShowResolveModal(false);
      setResolveNotes('');
      const res = await api.getTicket(selectedTicket.id);
      setSelectedTicket(res.ticket);
      loadAssignedTickets();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setSubmittingAction(false);
    }
  };

  const confirmEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !escalateReason.trim()) return;
    let toLevel: 'L2' | 'L3' | 'PARENT_COMPANY' = 'L2';
    if (selectedTicket.assigned_level === 'L2') toLevel = 'L3';
    if (selectedTicket.assigned_level === 'L3') toLevel = 'PARENT_COMPANY';

    setSubmittingAction(true);
    try {
      await api.escalateTicket(selectedTicket.id, {
        fromLevel: selectedTicket.assigned_level,
        toLevel,
        reason: escalateReason.trim(),
      });
      showToast(`Escalated to ${toLevel}. Session transferred.`, 'success');
      setShowEscalateModal(false);
      setEscalateReason('');
      const res = await api.getTicket(selectedTicket.id);
      setSelectedTicket(res.ticket);
      loadAssignedTickets();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAttendance = async () => {
    if (!user?.employeeId) return;
    try {
      if (isCheckedIn) {
        await api.checkOut({ employeeId: user.employeeId, address: locationText });
        setIsCheckedIn(false);
        showToast('Checked out. Availability set to Offline.', 'info');
      } else {
        await api.checkIn({ employeeId: user.employeeId, address: locationText });
        setIsCheckedIn(true);
        showToast('Checked in. Availability set to Available.', 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div className="mobile-simulator-wrapper">
      <div className="mobile-device-frame">
        {/* Notch */}
        <div className="mobile-notch" />

        {/* Mobile Header */}
        <div
          style={{
            background: '#0b3b60',
            color: 'white',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>FIELD & DESK APP</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>
              {user?.displayName} • {user?.role.replace('_', ' ')}
            </div>
          </div>
          <button
            onClick={handleAttendance}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 6,
              background: isCheckedIn ? '#16a34a' : '#d97706',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isCheckedIn ? 'Checked In' : 'Check In'}
          </button>
        </div>

        {/* Content Area */}
        <div className="mobile-content" style={{ padding: 14 }}>
          {/* TAB: ASSIGNED TICKETS */}
          {activeTab === 'assigned' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  My Assigned Workload ({tickets.length})
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {tickets.filter((t) => t.status === 'IN_PROGRESS').length} In Progress
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickets.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    No assigned tickets right now. Check queue or mark available.
                  </div>
                ) : (
                  tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleOpenDetail(t.id)}
                      style={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#0b3b60', fontFamily: 'var(--font-mono)' }}>
                          {t.id}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                        {t.problem_type}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {t.company_name} • {t.priority} Priority
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: TICKET DETAIL & WORK SCREEN */}
          {activeTab === 'detail' && selectedTicket && (
            <div>
              <button
                onClick={() => setActiveTab('assigned')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
              >
                ← Back to Queue
              </button>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0b3b60', fontFamily: 'var(--font-mono)' }}>
                    {selectedTicket.id}
                  </span>
                  <StatusBadge status={selectedTicket.status} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{selectedTicket.problem_type}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Tier: <strong>{selectedTicket.assigned_level}</strong> • Priority: {selectedTicket.priority}
                </div>

                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#334155' }}>
                  {selectedTicket.description}
                </div>
              </div>

              {/* Timer & Work Actions */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Session Timer: {selectedTicket.timer?.isRunning ? 'Running' : 'Paused'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {Math.floor((selectedTicket.total_resolution_seconds || 0) / 60)} mins elapsed
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {selectedTicket.status === 'OPEN' && (
                    <button
                      onClick={handleStartWork}
                      style={{
                        flex: 1,
                        background: '#0b3b60',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: 8,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={12} style={{ display: 'inline', marginRight: 4 }} /> Start Work
                    </button>
                  )}

                  {selectedTicket.status === 'IN_PROGRESS' && (
                    <>
                      {selectedTicket.assigned_level !== 'PARENT_COMPANY' && (
                        <button
                          onClick={() => setShowEscalateModal(true)}
                          style={{
                            flex: 1,
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: 8,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <ArrowUpRight size={12} style={{ display: 'inline', marginRight: 4 }} /> Escalate
                        </button>
                      )}

                      <button
                        onClick={() => setShowResolveModal(true)}
                        style={{
                          flex: 1,
                          background: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: 8,
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} /> Resolve
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile Escalate Modal Sheet */}
              {showEscalateModal && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.6)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      background: 'white',
                      width: '100%',
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      padding: 16,
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        Escalate to {selectedTicket.assigned_level === 'L1' ? 'L2' : selectedTicket.assigned_level === 'L2' ? 'L3' : 'Parent Company'}
                      </div>
                      <button
                        onClick={() => setShowEscalateModal(false)}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={confirmEscalate}>
                      <div style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', padding: 8, borderRadius: 6, marginBottom: 10 }}>
                        Session timer will be transferred continuously without reset.
                      </div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Reason for Escalation *
                      </label>
                      <textarea
                        className="form-control"
                        rows={3}
                        style={{ fontSize: 12, marginBottom: 12 }}
                        required
                        placeholder="Specify why higher tier diagnostic authority is required..."
                        value={escalateReason}
                        onChange={(e) => setEscalateReason(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => setShowEscalateModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          disabled={submittingAction || !escalateReason.trim()}
                        >
                          {submittingAction ? 'Escalating...' : 'Confirm Escalation'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Mobile Resolve Modal Sheet */}
              {showResolveModal && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.6)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      background: 'white',
                      width: '100%',
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      padding: 16,
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>Resolve Service Ticket</div>
                      <button
                        onClick={() => setShowResolveModal(false)}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={confirmResolve}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                        Timer will pause and resolution will be submitted for Manager Review.
                      </div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Root Cause & Resolution Notes *
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        style={{ fontSize: 12, marginBottom: 12 }}
                        required
                        placeholder="Describe what corrective actions were executed..."
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => setShowResolveModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-success btn-sm"
                          style={{ flex: 1 }}
                          disabled={submittingAction || !resolveNotes.trim()}
                        >
                          {submittingAction ? 'Submitting...' : 'Submit Resolution'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ATTENDANCE & LOCATION */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Attendance & Geo Check-in</div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                Record daily check-in and GPS workplace verification
              </div>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <MapPin size={18} color="#0284c7" />
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Current Location</div>
                </div>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: 12, padding: 6 }}
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                />
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                  Lat: 12.9716° N, Lng: 77.5946° E (Verified HQ geofence)
                </div>
              </div>

              <button
                onClick={handleAttendance}
                style={{
                  width: '100%',
                  background: isCheckedIn ? '#dc2626' : '#16a34a',
                  color: 'white',
                  padding: 12,
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Clock size={16} />
                {isCheckedIn ? 'Record End of Shift Check-out' : 'Record Shift Check-in'}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div className="mobile-bottom-nav">
          <button
            className={`mobile-nav-btn ${activeTab === 'assigned' ? 'active' : ''}`}
            onClick={() => setActiveTab('assigned')}
          >
            <Briefcase size={18} />
            <span>Assigned</span>
          </button>
          <button
            className={`mobile-nav-btn ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <MapPin size={18} />
            <span>Attendance</span>
          </button>
        </div>
      </div>
    </div>
  );
};
