import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Company } from '../../types';
import { Building2, Search, Plus, Eye, CheckCircle, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';

export const CompaniesPage: React.FC<{ onNavigateTicket: (id: string) => void }> = ({ onNavigateTicket }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    company_name: '',
    address: '',
    gstn: '',
    primary_email: '',
    contact_person: '',
    contact_phone: '',
    alternate_contact: '',
    alternate_contact_phone: '',
    alternate_contact_email: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, [page, search, statusFilter]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanies({ page, limit: 15, search, isActive: statusFilter });
      setCompanies(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (id: string) => {
    try {
      const res = await api.getCompany(id);
      setSelectedCompany(res.company);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: number) => {
    try {
      await api.toggleCompanyStatus(id, currentStatus === 0);
      loadCompanies();
      if (selectedCompany && selectedCompany.id === id) {
        setSelectedCompany({ ...selectedCompany, is_active: currentStatus === 0 ? 1 : 0 });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.createCompany(formData);
      setShowCreateModal(false);
      setFormData({
        company_name: '',
        address: '',
        gstn: '',
        primary_email: '',
        contact_person: '',
        contact_phone: '',
        alternate_contact: '',
        alternate_contact_phone: '',
        alternate_contact_email: '',
      });
      loadCompanies();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Company Master</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
              {total} companies
            </span>
          </h2>
          <div className="page-subtitle">Manage customer organizations, contract contacts, and SLA affiliations</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} /> Add New Company
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search company name, ID, GSTN, contact person..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="1">Active Only</option>
          <option value="0">Inactive Only</option>
        </select>

        {(search || statusFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company ID</th>
              <th>Company Name</th>
              <th>Primary Contact</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Active Tickets</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading companies...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No companies found matching search filters.
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{c.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.company_name}</div>
                    {c.gstn && <div style={{ fontSize: 11, color: '#64748b' }}>GSTN: {c.gstn}</div>}
                  </td>
                  <td>{c.contact_person}</td>
                  <td>{c.contact_phone}</td>
                  <td>{c.primary_email}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {c.open_ticket_count || 0} Open
                    </span>
                  </td>
                  <td>
                    {c.is_active ? (
                      <span className="badge badge-resolved">Active</span>
                    ) : (
                      <span className="badge badge-closed">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenDetail(c.id)}>
                        <Eye size={13} /> View
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleStatus(c.id, c.is_active)}
                        title={c.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={20} color="#0b3b60" />
                <div>
                  <div className="modal-title">{selectedCompany.company_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedCompany.id} • Registered Account</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Ticket Summary Section */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 18, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                  Support Ticket Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
                  <div style={{ background: 'white', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>
                      {selectedCompany.ticketSummary?.open || 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Open</div>
                  </div>
                  <div style={{ background: 'white', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>
                      {selectedCompany.ticketSummary?.inProgress || 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>In Progress</div>
                  </div>
                  <div style={{ background: 'white', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                      {selectedCompany.ticketSummary?.resolved || 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Resolved</div>
                  </div>
                  <div style={{ background: 'white', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>
                      {selectedCompany.ticketSummary?.closed || 0}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Closed</div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Primary Contact
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{selectedCompany.contact_person}</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{selectedCompany.contact_phone}</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{selectedCompany.primary_email}</div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Alternate Contact
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>
                    {selectedCompany.alternate_contact || 'None registered'}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{selectedCompany.alternate_contact_phone || '—'}</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>{selectedCompany.alternate_contact_email || '—'}</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Registered Address
                </div>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>{selectedCompany.address}</div>
                {selectedCompany.gstn && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    GSTN: <strong>{selectedCompany.gstn}</strong>
                  </div>
                )}
              </div>

              {/* Recent Tickets List */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                  Recent Tickets
                </div>
                {selectedCompany.recentTickets && selectedCompany.recentTickets.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedCompany.recentTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedCompany(null);
                          onNavigateTicket(t.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#0b3b60' }}>{t.id}</span>
                        <span style={{ fontSize: 13, color: '#334155' }}>{t.problem_type}</span>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>No recent tickets recorded.</div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCompany(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <div className="modal-title">Register New Customer Company</div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: 10,
                      borderRadius: 6,
                      marginBottom: 12,
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Company Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="e.g. Acme Technologies Pvt Ltd"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Address <span className="required">*</span></label>
                  <textarea
                    className="form-control"
                    required
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street address, city, pin code..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">GSTN Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.gstn}
                      onChange={(e) => setFormData({ ...formData, gstn: e.target.value })}
                      placeholder="e.g. 29AABCA1234F1Z5"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Primary Corporate Email <span className="required">*</span></label>
                    <input
                      type="email"
                      className="form-control"
                      required
                      value={formData.primary_email}
                      onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                      placeholder="contact@company.com"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Primary Contact Person <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="+91 98000 00000"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Alternate Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.alternate_contact}
                      onChange={(e) => setFormData({ ...formData, alternate_contact: e.target.value })}
                      placeholder="Optional backup person"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alternate Contact Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.alternate_contact_phone}
                      onChange={(e) => setFormData({ ...formData, alternate_contact_phone: e.target.value })}
                      placeholder="+91 98000 00000"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Register Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
