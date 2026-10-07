import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import { Search, Plus, ArrowRight, X, Briefcase, Building2, Package, Check } from 'lucide-react';
import { formatDateTime } from '../../utils/date';
import { isValidEmail, isValidPhone, validatePhoneDetailed } from '../../utils/validation';
import { PhoneInput } from '../../components/common/PhoneInput';

export const ProspectsPage: React.FC = () => {
  const { showToast } = useNotifications();
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [showConvert, setShowConvert] = useState<any>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    enquiry: '',
    source: 'Website',
  });

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    loadProspects();
    loadProducts();
  }, [search]);

  // Close modals on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConvert) {
          setShowConvert(null);
          setSelectedProductIds([]);
        } else if (showCreate) {
          setShowCreate(false);
        } else if (showEdit) {
          setShowEdit(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConvert, showCreate, showEdit]);

  const loadProspects = async () => {
    setLoading(true);
    try {
      const res = await api.getProspects({ search });
      setProspects(res.data || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load enquiries', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.getProducts();
      setProducts(res.data || []);
    } catch (err: any) {
      console.error('Failed to load products', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      showToast('Company name is required.', 'danger');
      return;
    }
    if (!formData.contactPerson.trim()) {
      showToast('Contact person is required.', 'danger');
      return;
    }
    if (!formData.phone.trim()) {
      showToast('Phone number is required.', 'danger');
      return;
    }
    const phoneVal = validatePhoneDetailed(formData.phone);
    if (!phoneVal.valid) {
      showToast(phoneVal.error || 'Please enter a valid contact phone number.', 'danger');
      return;
    }
    if (!formData.email.trim() || !isValidEmail(formData.email)) {
      showToast('Please enter a valid email address (e.g. name@company.com).', 'danger');
      return;
    }

    try {
      await api.createProspect(formData);
      showToast('Enquiry created successfully', 'success');
      setShowCreate(false);
      setFormData({ companyName: '', contactPerson: '', phone: '', email: '', enquiry: '', source: 'Website' });
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Failed to create enquiry', 'danger');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    if (!formData.companyName.trim()) {
      showToast('Company name is required.', 'danger');
      return;
    }
    if (!formData.contactPerson.trim()) {
      showToast('Contact person is required.', 'danger');
      return;
    }
    if (!formData.phone.trim()) {
      showToast('Phone number is required.', 'danger');
      return;
    }
    const editPhoneVal = validatePhoneDetailed(formData.phone);
    if (!editPhoneVal.valid) {
      showToast(editPhoneVal.error || 'Please enter a valid contact phone number.', 'danger');
      return;
    }
    if (!formData.email.trim() || !isValidEmail(formData.email)) {
      showToast('Please enter a valid email address (e.g. name@company.com).', 'danger');
      return;
    }

    try {
      await api.updateProspect(showEdit.id, formData);
      showToast('Enquiry updated successfully', 'success');
      setShowEdit(null);
      setFormData({ companyName: '', contactPerson: '', phone: '', email: '', enquiry: '', source: 'Website' });
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Failed to update enquiry', 'danger');
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConvert) return;
    if (selectedProductIds.length === 0) {
      showToast('Please select at least one product for the customer.', 'danger');
      return;
    }

    try {
      const res = await api.convertProspect(showConvert.id, { productIds: selectedProductIds });
      showToast(`Converted to Customer Account: ${res.companyId || res.id}`, 'success');
      setShowConvert(null);
      setSelectedProductIds([]);
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Failed to convert enquiry', 'danger');
    }
  };

  const openConvertModal = (prospect: any) => {
    setShowConvert(prospect);
    // Auto-select first product if products exist and none selected
    if (products.length > 0) {
      setSelectedProductIds([products[0].id]);
    } else {
      setSelectedProductIds([]);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <Briefcase size={26} color="#0284c7" />
            Enquiries
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>
            Manage sales enquiries and convert enquiries to customers.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormData({ companyName: '', contactPerson: '', phone: '', email: '', enquiry: '', source: 'Website' });
            setShowCreate(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> New Enquiry
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search enquiries..."
            style={{ paddingLeft: 38, height: 40 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading enquiries...</div>
        ) : prospects.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            No enquiries found. Click "New Enquiry" to add one.
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Enquiry ID</th>
                <th style={{ padding: '12px 16px' }}>Organization</th>
                <th style={{ padding: '12px 16px' }}>Contact</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Created</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0284c7' }}>{p.id}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.companyName || p.company_name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.enquiry}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500 }}>{p.contactPerson || p.contact_person}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{p.phone} {p.email ? `• ${p.email}` : ''}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background: p.status === 'CONVERTED' ? '#dcfce7' : '#fef9c3',
                        color: p.status === 'CONVERTED' ? '#166534' : '#854d0e',
                      }}
                    >
                      {p.status}
                    </span>
                    {(p.convertedToCompanyId || p.converted_to_company_id) && (
                      <div style={{ fontSize: 11, color: '#166534', marginTop: 4, fontWeight: 600 }}>
                        → {p.convertedToCompanyId || p.converted_to_company_id}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{formatDateTime(p.createdAt || p.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {p.status !== 'CONVERTED' && (
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setFormData({
                              companyName: p.companyName || p.company_name || '',
                              contactPerson: p.contactPerson || p.contact_person || '',
                              phone: p.phone || '',
                              email: p.email || '',
                              enquiry: p.enquiry || '',
                              source: p.source || 'Website',
                            });
                            setShowEdit(p);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => openConvertModal(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <ArrowRight size={14} /> Convert to Customer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE ENQUIRY MODAL */}
      {showCreate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 500, padding: 24, background: '#ffffff', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Add New Enquiry</h3>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b',
                }}
                onClick={() => setShowCreate(false)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Company / Organization Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Contact Person *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Phone Number *</label>
                  <PhoneInput
                    required
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Enquiry Details *</label>
                <textarea
                  className="form-control"
                  required
                  rows={3}
                  value={formData.enquiry}
                  onChange={(e) => setFormData({ ...formData, enquiry: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ENQUIRY MODAL */}
      {showEdit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setShowEdit(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 500, padding: 24, background: '#ffffff', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Edit Enquiry</h3>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b',
                }}
                onClick={() => setShowEdit(null)}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Company / Organization Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Contact Person *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Phone Number *</label>
                  <PhoneInput
                    required
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Enquiry Details *</label>
                <textarea
                  className="form-control"
                  required
                  rows={3}
                  value={formData.enquiry}
                  onChange={(e) => setFormData({ ...formData, enquiry: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONVERT ENQUIRY TO CUSTOMER MODAL                                         */}
      {/* ========================================================================= */}
      {showConvert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => {
            setShowConvert(null);
            setSelectedProductIds([]);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: 24,
              background: '#ffffff',
              borderRadius: 10,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Prominent Close (X) button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Building2 size={20} color="#16a34a" />
                Convert Enquiry to Customer
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowConvert(null);
                  setSelectedProductIds([]);
                }}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#fee2e2';
                  (e.currentTarget as HTMLElement).style.color = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
                  (e.currentTarget as HTMLElement).style.color = '#475569';
                }}
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanatory Message */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 18,
              }}
            >
              <div style={{ fontWeight: 600, color: '#166534', fontSize: 13, marginBottom: 2 }}>
                This enquiry will become a Customer account.
              </div>
              <div style={{ color: '#15803d', fontSize: 12 }}>
                Converting this enquiry will create a Customer account (CMP-XXXX) and customer login. Customer ID will be generated automatically.
              </div>
            </div>

            <form onSubmit={handleConvert}>
              {/* Product Selection */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8, display: 'block' }}>
                  Select Initial Products *
                </label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 10,
                    background: '#f8fafc',
                  }}
                >
                  {products.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: 10 }}>
                      Loading product list...
                    </div>
                  ) : (
                    products.map((prod) => {
                      const isChecked = selectedProductIds.includes(prod.id);
                      return (
                        <label
                          key={prod.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            background: isChecked ? '#eff6ff' : '#ffffff',
                            border: isChecked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedProductIds([...selectedProductIds, prod.id]);
                              else setSelectedProductIds(selectedProductIds.filter((id) => id !== prod.id));
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Package size={14} color="#0284c7" />
                              {prod.name}
                              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 10 }}>
                                {prod.code}
                              </span>
                            </div>
                            {prod.category && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                                {prod.category}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowConvert(null);
                    setSelectedProductIds([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={selectedProductIds.length === 0}
                  style={{ minWidth: 140 }}
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
