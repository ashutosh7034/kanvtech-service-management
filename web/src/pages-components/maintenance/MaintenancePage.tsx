'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Send,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  XCircle,
  X,
  AlertCircle,
  Building2,
  Package,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../../utils/date';

interface Subscription {
  id: string;
  company_id: string;
  company_name: string | null;
  company_email: string | null;
  product_id: string;
  product_name: string | null;
  product_category: string | null;
  plan_name: string;
  start_date: string;
  expiry_date: string;
  renewal_date: string | null;
  days_remaining: number;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED';
  owner_employee_name: string | null;
  notes: string | null;
  last_warning_sent_at: string | null;
  warning_count: number;
  created_at: string;
}

export const MaintenancePage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Add Subscription Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    companyId: '',
    productId: '',
    planName: 'Enterprise SLA Annual (24x7)',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });

  // Warning Modal
  const [warningTarget, setWarningTarget] = useState<Subscription | null>(null);
  const [warningMessage, setWarningMessage] = useState('');

  // Renewal Modal
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);
  const [renewExpiryDate, setRenewExpiryDate] = useState('');
  const [renewPlanName, setRenewPlanName] = useState('');
  const [renewNotes, setRenewNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (companyFilter !== 'ALL') params.companyId = companyFilter;

      const [subRes, compRes, prodRes, statsRes] = await Promise.all([
        api.getSubscriptions(params),
        api.getCompanies({ limit: 100 }),
        api.getProducts({ limit: 100 }),
        api.getSubscriptionStats().catch(() => ({ stats: null })),
      ]);

      setSubscriptions(subRes.data || []);
      setCompanies(compRes.companies || []);
      setProducts(prodRes.data || []);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subscription records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, companyFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyId || !formData.productId || !formData.startDate || !formData.expiryDate) {
      alert('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.createSubscription(formData);
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      alert(`Error creating subscription: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningTarget) return;
    setSubmitting(true);
    try {
      await api.sendSubscriptionWarning(warningTarget.id, warningMessage.trim() || undefined);
      alert(`Renewal reminder dispatched successfully to ${warningTarget.company_name}`);
      setWarningTarget(null);
      fetchData();
    } catch (err: any) {
      alert(`Warning dispatch failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget || !renewExpiryDate) return;
    setSubmitting(true);
    try {
      await api.renewSubscription(renewTarget.id, {
        newExpiryDate: renewExpiryDate,
        planName: renewPlanName || renewTarget.plan_name,
        notes: renewNotes,
      });
      alert(`Subscription renewed successfully for ${renewTarget.company_name}`);
      setRenewTarget(null);
      fetchData();
    } catch (err: any) {
      alert(`Renewal failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openWarningModal = (sub: Subscription) => {
    setWarningTarget(sub);
    setWarningMessage(
      `Your subscription for ${sub.product_name} (${sub.plan_name}) approaches expiry on ${formatDate(sub.expiry_date)}. Please confirm renewal with your dedicated account manager to maintain active SLA support.`
    );
  };

  const openRenewModal = (sub: Subscription) => {
    setRenewTarget(sub);
    const currExp = new Date(sub.expiry_date);
    const oneYearFromExpiry = new Date(currExp.getTime() + 365 * 24 * 60 * 60 * 1000);
    setRenewExpiryDate(oneYearFromExpiry.toISOString().split('T')[0]);
    setRenewPlanName(sub.plan_name);
    setRenewNotes('');
  };

  const getStatusBadge = (sub: Subscription) => {
    switch (sub.status) {
      case 'ACTIVE':
        return (
          <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
            ACTIVE
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
            EXPIRING ({sub.days_remaining}d)
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
            EXPIRED
          </span>
        );
      case 'RENEWED':
        return (
          <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>
            RENEWED
          </span>
        );
      default:
        return <span className="badge">{sub.status}</span>;
    }
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck className="text-primary" size={24} />
            Annual Maintenance & Subscription Management
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Multi-client SLA contracts, renewal warning dispatch, and maintenance lifecycle tracking
          </p>
        </div>
        {isAdminOrManager && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormData({
                companyId: companies[0]?.id || '',
                productId: products[0]?.id || '',
                planName: 'Enterprise SLA Annual (24x7)',
                startDate: new Date().toISOString().split('T')[0],
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: '',
              });
              setShowAddModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            New Maintenance Plan
          </button>
        )}
      </div>

      {/* Metrics Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>ACTIVE PLANS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{stats.active}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>EXPIRING SOON / WARNINGS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#b45309', marginTop: 4 }}>{stats.expiringSoon}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>EXPIRED PLANS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>{stats.expired}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #6366f1' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>RENEWALS LOGGED</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#4338ca', marginTop: 4 }}>{stats.renewed}</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by plan name, customer company, product, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="#64748b" />
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 170 }}
            >
              <option value="ALL">All Maintenance States</option>
              <option value="ACTIVE">Active Plans</option>
              <option value="EXPIRING_SOON">Expiring Soon (≤30d)</option>
              <option value="EXPIRED">Expired Plans</option>
              <option value="RENEWED">Renewed Plans</option>
            </select>
          </div>

          <select
            className="form-control"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="ALL">All Customer Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>

          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Subscriptions Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            Loading maintenance subscriptions...
          </div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#b91c1c' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            {error}
          </div>
        ) : subscriptions.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <ShieldCheck size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#334155' }}>No Maintenance Contracts Found</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Click "New Maintenance Plan" to register customer AMC contracts.
            </div>
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>PLAN ID</th>
                <th style={{ padding: '12px 16px' }}>CUSTOMER COMPANY</th>
                <th style={{ padding: '12px 16px' }}>PRODUCT & PLAN</th>
                <th style={{ padding: '12px 16px' }}>START DATE</th>
                <th style={{ padding: '12px 16px' }}>EXPIRY DATE</th>
                <th style={{ padding: '12px 16px' }}>DAYS LEFT</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px' }}>WARNINGS</th>
                {isAdminOrManager && <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0b3b60' }}>
                    <code>{sub.id}</code>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{sub.company_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub.company_email}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{sub.product_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub.plan_name}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    {formatDate(sub.start_date)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: sub.days_remaining <= 30 ? '#b91c1c' : '#334155' }}>
                    {formatDate(sub.expiry_date)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 700, color: sub.days_remaining < 0 ? '#b91c1c' : (sub.days_remaining <= 30 ? '#d97706' : '#15803d') }}>
                      {sub.days_remaining < 0 ? `${Math.abs(sub.days_remaining)}d overdue` : `${sub.days_remaining} days`}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(sub)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    {sub.warning_count > 0 ? (
                      <span title={`Last sent: ${formatDateTime(sub.last_warning_sent_at)}`} style={{ color: '#d97706', fontWeight: 600 }}>
                        {sub.warning_count} sent
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>None</span>
                    )}
                  </td>
                  {isAdminOrManager && (
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => openWarningModal(sub)}
                          title="Send Renewal Reminder Warning"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Send size={11} color="#d97706" />
                          Warn
                        </button>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => openRenewModal(sub)}
                          title="Renew Maintenance Contract"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <RotateCw size={11} />
                          Renew
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Subscription Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Register New Maintenance / AMC Plan</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Customer Company *</label>
                <select
                  className="form-control"
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName} ({c.id})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Suite *</label>
                <select
                  className="form-control"
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Plan / SLA Tier *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.planName}
                  onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                  placeholder="e.g. Platinum 24x7 SLA Support Tier"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Contract Start Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Expiry Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Contract Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Billing terms, customer escalation SPOC, special terms..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Create Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      {warningTarget && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle color="#d97706" size={18} />
                  Send Renewal Warning • {warningTarget.id}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {warningTarget.company_name} ({warningTarget.product_name})
                </div>
              </div>
              <button onClick={() => setWarningTarget(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSendWarning}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Reminder Message</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  required
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  This notification will be dispatched to primary contact ({warningTarget.company_email}) and logged in audit history.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setWarningTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Dispatching...' : 'Dispatch Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {renewTarget && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RotateCw color="#0284c7" size={18} />
                  Renew Maintenance Contract • {renewTarget.id}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {renewTarget.company_name} ({renewTarget.product_name})
                </div>
              </div>
              <button onClick={() => setRenewTarget(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleRenew}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>New Expiry Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={renewExpiryDate}
                  onChange={(e) => setRenewExpiryDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Plan / Tier Description</label>
                <input
                  type="text"
                  className="form-control"
                  value={renewPlanName}
                  onChange={(e) => setRenewPlanName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Renewal Remarks & PO Reference</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. PO-2026-992 signed for 12 months renewal with 24x7 SLA."
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRenewTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Renewing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
