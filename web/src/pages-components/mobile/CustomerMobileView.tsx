import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Ticket } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import {
  Ticket as TicketIcon,
  PlusCircle,
  Home,
  Star,
  ChevronRight,
  Clock,
  Building,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

export const CustomerMobileView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'home' | 'create' | 'tickets' | 'detail'>('home');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);

  // Customer Products & Branches State
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [myBranches, setMyBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Form State
  const [problemType, setProblemType] = useState('');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [category, setCategory] = useState('Hardware / Infrastructure');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Feedback State
  const [rating, setRating] = useState(5);
  const [remarks, setRemarks] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    loadMyTickets();
    loadCustomerData();
  }, [user]);

  const loadCustomerData = async () => {
    const compId = user?.companyId || 'CMP-0001';
    try {
      const [compRes, branchRes] = await Promise.all([
        api.getCompany(compId),
        api.getCustomerBranches(compId),
      ]);
      const prods = compRes.company?.products || [];
      setMyProducts(prods);
      setMyBranches(branchRes.branches || []);
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].product_id || prods[0].productId);
      }
    } catch (err) {
      console.error('Failed to load customer products/branches', err);
    }
  };

  const loadMyTickets = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets({ limit: 20 });
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!selectedProductId) {
      setCreateError('Please select a purchased product for this ticket.');
      return;
    }
    setCreating(true);

    try {
      const res = await api.createTicket({
        companyId: user?.companyId || 'CMP-0001',
        customerContactId: user?.contactId || 1,
        branchId: selectedBranchId || undefined,
        productId: selectedProductId,
        problemType,
        priority,
        category,
        description,
      });

      setProblemType('');
      setDescription('');
      showToast(`Ticket ${res.ticket.id} created!`, 'success');
      loadMyTickets();
      setSelectedTicket(res.ticket);
      setActiveTab('detail');
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
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

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSubmittingFeedback(true);
    try {
      await api.submitFeedback(selectedTicket.id, { rating, remarks });
      showToast('Thank you for your rating! Ticket is now closed.', 'success');
      const res = await api.getTicket(selectedTicket.id);
      setSelectedTicket(res.ticket);
      loadMyTickets();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleMobileReopen = async () => {
    if (!selectedTicket) return;
    const reason = window.prompt('Please enter the reason for reopening this ticket:');
    if (!reason || !reason.trim()) return;
    try {
      await api.reopenTicket(selectedTicket.id, { reason: reason.trim() });
      showToast('Ticket reopened and returned to active support.', 'info');
      const res = await api.getTicket(selectedTicket.id);
      setSelectedTicket(res.ticket);
      loadMyTickets();
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const activeCount = tickets.filter((t) =>
    ['OPEN', 'IN_PROGRESS', 'REOPENED', 'RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK'].includes(t.status),
  ).length;

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
            <div style={{ fontWeight: 700, fontSize: 14 }}>KANVTECH SERVICE</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Client Self-Service Portal</div>
          </div>
          <div style={{ fontSize: 11, background: '#0284c7', padding: '2px 8px', borderRadius: 10 }}>
            {user?.displayName || 'Customer'}
          </div>
        </div>

        {/* Main Body */}
        <div className="mobile-content" style={{ padding: 14 }}>
          {/* TAB: HOME */}
          {activeTab === 'home' && (
            <div>
              {/* Account Overview Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Connected Organization</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{user?.companyId || 'Acme Technologies Pvt Ltd'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                  <span>Active Open Tickets:</span>
                  <span style={{ fontWeight: 700, color: activeCount >= 2 ? '#dc2626' : '#16a34a' }}>
                    {activeCount} / 2 Allowed
                  </span>
                </div>
              </div>

              {/* Quick Action Button */}
              <button
                onClick={() => setActiveTab('create')}
                style={{
                  width: '100%',
                  background: '#0b3b60',
                  color: 'white',
                  padding: 12,
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                  cursor: 'pointer',
                }}
              >
                <PlusCircle size={16} /> Open Support Ticket
              </button>

              {/* Recent Tickets List */}
              <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 8 }}>
                My Support Tickets ({tickets.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickets.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleOpenDetail(t.id)}
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#0b3b60', fontFamily: 'var(--font-mono)' }}>
                        {t.id}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', marginTop: 2 }}>
                        {t.problem_type}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: CREATE TICKET */}
          {activeTab === 'create' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Log Support Ticket</div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                Report an issue to Kanvtech engineering. Maximum 2 active tickets allowed per client.
              </div>

              {activeCount >= 2 ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: 12, borderRadius: 6, fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>
                  <strong>Two-Ticket Quota Reached:</strong> Your company currently has {activeCount} open tickets (the maximum allowed under the Kanvtech SLA policy). Please await resolution or close an existing ticket before submitting a new one.
                </div>
              ) : null}

              {createError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 8, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit}>
                {myBranches.length > 0 && (
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Branch Location</label>
                    <select
                      className="form-control"
                      style={{ padding: '6px 8px', fontSize: 12 }}
                      value={selectedBranchId}
                      disabled={activeCount >= 2}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                      <option value="">Headquarters / Main Organization</option>
                      {myBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branch_name || b.branchName} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Purchased Product <span className="required">*</span></label>
                  <select
                    className="form-control"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                    required
                    value={selectedProductId}
                    disabled={activeCount >= 2}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">Select Product</option>
                    {(selectedBranchId
                      ? (myBranches.find((b) => b.id === selectedBranchId)?.branchProducts || myBranches.find((b) => b.id === selectedBranchId)?.products || myProducts)
                      : myProducts
                    ).map((p: any) => (
                      <option key={p.product_id || p.productId || p.id} value={p.product_id || p.productId || p.id}>
                        {p.product_name || p.product?.name || p.productCode || p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Problem Summary <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                    placeholder="Brief headline of the issue..."
                    required
                    disabled={activeCount >= 2}
                    value={problemType}
                    onChange={(e) => setProblemType(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Urgency / Priority <span className="required">*</span></label>
                  <select
                    className="form-control"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                    value={priority}
                    disabled={activeCount >= 2}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="HIGH">High (Critical SLA - 4h)</option>
                    <option value="MEDIUM">Medium (Standard - 12h)</option>
                    <option value="LOW">Low (Routine - 24h)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Category</label>
                  <select
                    className="form-control"
                    style={{ padding: '6px 8px', fontSize: 12 }}
                    value={category}
                    disabled={activeCount >= 2}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Hardware / Infrastructure">Hardware / Infrastructure</option>
                    <option value="Network & Connectivity">Network & Connectivity</option>
                    <option value="Database Services">Database Services</option>
                    <option value="Enterprise Applications">Enterprise Applications</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Description & Error Codes <span className="required">*</span></label>
                  <textarea
                    className="form-control"
                    rows={3}
                    style={{ padding: '6px 8px', fontSize: 12 }}
                    placeholder="Please provide details to expedite technical triage..."
                    required
                    disabled={activeCount >= 2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating || activeCount >= 2}
                  style={{
                    width: '100%',
                    background: activeCount >= 2 ? '#94a3b8' : '#0b3b60',
                    color: 'white',
                    padding: 10,
                    borderRadius: 6,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: activeCount >= 2 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creating ? 'Submitting...' : activeCount >= 2 ? 'Ticket Limit Reached (2 Active)' : 'Submit Service Ticket'}
                </button>
              </form>
            </div>
          )}

          {/* TAB: TICKETS LIST */}
          {activeTab === 'tickets' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>All Organization Tickets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tickets.map((t) => (
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: '#0b3b60', fontFamily: 'var(--font-mono)' }}>
                        {t.id}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                      {t.problem_type}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {formatDate(t.created_at)} • {t.assigned_level} Tier
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: TICKET DETAIL & FEEDBACK */}
          {activeTab === 'detail' && selectedTicket && (
            <div>
              <button
                onClick={() => setActiveTab('tickets')}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
              >
                ← Back to List
              </button>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0b3b60', fontFamily: 'var(--font-mono)' }}>
                    {selectedTicket.id}
                  </span>
                  <StatusBadge status={selectedTicket.status} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{selectedTicket.problem_type}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Specialist Assigned: <strong>{selectedTicket.assigned_employee_name || 'Triage in progress'}</strong> ({selectedTicket.assigned_level})
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginTop: 8, lineHeight: 1.4 }}>
                  {selectedTicket.description}
                </div>
              </div>

              {/* Feedback Prompt if in CUSTOMER_FEEDBACK status */}
              {selectedTicket.status === 'CUSTOMER_FEEDBACK' && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#9a3412', marginBottom: 4 }}>
                    Rate Your Support Experience
                  </div>
                  <div style={{ fontSize: 11, color: '#7c2d12', marginBottom: 8 }}>
                    Your ticket was resolved and verified. Please rate the service quality:
                  </div>

                  <form onSubmit={handleFeedback}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRating(s)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: s <= rating ? '#ea580c' : '#cbd5e1' }}
                        >
                          <Star size={20} fill={s <= rating ? '#ea580c' : 'none'} />
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: 11, padding: 6, marginBottom: 8 }}
                      placeholder="Remarks..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={submittingFeedback}
                      style={{
                        width: '100%',
                        background: '#ea580c',
                        color: 'white',
                        padding: 6,
                        border: 'none',
                        borderRadius: 4,
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: 'pointer',
                        marginBottom: 6,
                      }}
                    >
                      {submittingFeedback ? 'Submitting...' : 'Submit & Close Ticket'}
                    </button>
                    <button
                      type="button"
                      onClick={handleMobileReopen}
                      style={{
                        width: '100%',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        padding: 6,
                        border: '1px solid #fecaca',
                        borderRadius: 4,
                        fontWeight: 600,
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <RotateCcw size={12} /> Not Solved? Reopen Ticket
                    </button>
                  </form>
                </div>
              )}

              {/* Closed state with Reopen action */}
              {selectedTicket.status === 'CLOSED' && (
                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, fontSize: 11, color: '#64748b', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: 6 }}>✓ This ticket has been closed. Thank you for partnering with Kanvtech.</div>
                  <button
                    type="button"
                    onClick={handleMobileReopen}
                    style={{
                      background: 'white',
                      color: '#b91c1c',
                      padding: '4px 8px',
                      border: '1px solid #fecaca',
                      borderRadius: 4,
                      fontWeight: 600,
                      fontSize: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <RotateCcw size={11} /> Reopen Ticket
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div className="mobile-bottom-nav">
          <button
            className={`mobile-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <Home size={18} />
            <span>Home</span>
          </button>
          <button
            className={`mobile-nav-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            <PlusCircle size={18} />
            <span>New Ticket</span>
          </button>
          <button
            className={`mobile-nav-btn ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => setActiveTab('tickets')}
          >
            <TicketIcon size={18} />
            <span>My Tickets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
