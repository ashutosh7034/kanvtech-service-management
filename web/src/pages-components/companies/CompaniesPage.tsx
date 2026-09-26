import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Company, Product, Branch } from '../../types';
import {
  Building2,
  Search,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  Phone,
  Mail,
  User,
  Trash2,
  Edit2,
  Layers,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';

export const CompaniesPage: React.FC<{ onNavigateTicket: (id: string) => void }> = ({ onNavigateTicket }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected customer for detailed view
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Registration Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
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
    product_ids: [] as string[],
    branches: [] as Array<{
      branch_name: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      contact_person: string;
      contact_phone: string;
      contact_email: string;
      product_ids: string[];
    }>,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add Product to existing Customer Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedNewProductId, setSelectedNewProductId] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  // Branch Modal State (Add / Edit)
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    branch_name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    product_ids: [] as string[],
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
    loadProducts();
  }, [page, search, statusFilter]);

  const loadProducts = async () => {
    try {
      const res = await api.getProducts({ isActive: 'true' });
      setProducts(res.products || res.data || []);
    } catch (err) {
      console.error('Failed to load product catalog', err);
    }
  };

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
      loadBranchesForCompany(id);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBranchesForCompany = async (companyId: string) => {
    setLoadingBranches(true);
    try {
      const res = await api.getCustomerBranches(companyId);
      setCompanyBranches(res.branches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBranches(false);
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

  // Toggle product selection in customer registration form
  const toggleProductSelection = (prodId: string) => {
    const exists = formData.product_ids.includes(prodId);
    if (exists) {
      setFormData({ ...formData, product_ids: formData.product_ids.filter((id) => id !== prodId) });
    } else {
      setFormData({ ...formData, product_ids: [...formData.product_ids, prodId] });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Business Rule 2: At least ONE product required
    if (formData.product_ids.length === 0) {
      setFormError('At least one product must be selected before registering a customer.');
      setCreateStep(2);
      return;
    }

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
        product_ids: [],
        branches: [],
      });
      setCreateStep(1);
      loadCompanies();
    } catch (err: any) {
      setFormError(err.message || 'Customer registration failed');
    } finally {
      setSaving(false);
    }
  };

  // Add Product to existing Customer
  const handleAddProduct = async () => {
    if (!selectedCompany || !selectedNewProductId) return;
    setAddingProduct(true);
    setProductError(null);
    try {
      await api.addCustomerProduct(selectedCompany.id, selectedNewProductId);
      setShowAddProductModal(false);
      setSelectedNewProductId('');
      // Refresh company detail
      handleOpenDetail(selectedCompany.id);
      loadCompanies();
    } catch (err: any) {
      setProductError(err.message || 'Failed to add product');
    } finally {
      setAddingProduct(false);
    }
  };

  // Remove Product from existing Customer
  const handleRemoveProduct = async (productId: string, productName: string) => {
    if (!selectedCompany) return;
    if (selectedCompany.products && selectedCompany.products.length <= 1) {
      alert('A customer must have at least one active product. Cannot remove the only remaining product.');
      return;
    }
    if (!confirm(`Are you sure you want to remove product "${productName}" from this customer?`)) return;

    try {
      await api.removeCustomerProduct(selectedCompany.id, productId);
      handleOpenDetail(selectedCompany.id);
      loadCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to remove product');
    }
  };

  // Open Branch Create / Edit Modal
  const handleOpenAddBranch = () => {
    setEditingBranch(null);
    setBranchForm({
      branch_name: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      product_ids: selectedCompany?.products?.map((p: any) => p.product_id || p.productId) || [],
    });
    setBranchError(null);
    setShowBranchModal(true);
  };

  const handleOpenEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    const assignedIds = (branch.branchProducts || branch.products || []).map((bp: any) => bp.productId || bp.product_id);
    setBranchForm({
      branch_name: branch.branch_name || (branch as any).branchName || '',
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      contact_person: branch.contact_person || (branch as any).contactPerson || '',
      contact_phone: branch.contact_phone || (branch as any).contactPhone || '',
      contact_email: branch.contact_email || (branch as any).contactEmail || '',
      product_ids: assignedIds,
    });
    setBranchError(null);
    setShowBranchModal(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setSavingBranch(true);
    setBranchError(null);
    try {
      if (editingBranch) {
        await api.updateBranch(selectedCompany.id, editingBranch.id, branchForm);
        if (branchForm.product_ids) {
          await api.assignBranchProducts(selectedCompany.id, editingBranch.id, branchForm.product_ids);
        }
      } else {
        await api.createBranch(selectedCompany.id, branchForm);
      }
      setShowBranchModal(false);
      loadBranchesForCompany(selectedCompany.id);
      loadCompanies();
    } catch (err: any) {
      setBranchError(err.message || 'Failed to save branch information');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleToggleBranchStatus = async (branch: Branch) => {
    if (!selectedCompany) return;
    const newStatus = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.toggleBranchStatus(selectedCompany.id, branch.id, newStatus);
      loadBranchesForCompany(selectedCompany.id);
    } catch (err) {
      console.error('Failed to toggle branch status', err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Customer Master</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
              {total} registered customers
            </span>
          </h2>
          <div className="page-subtitle">Manage customer organizations, purchased products, branches, and support history</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setCreateStep(1); setShowCreateModal(true); }}>
          <Plus size={15} /> Add New Customer
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search customer name, ID, GSTN, contact person, product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Customer Statuses</option>
          <option value="1">Active Customers Only</option>
          <option value="0">Inactive Customers Only</option>
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
              <th>Customer ID</th>
              <th>Customer Name</th>
              <th>Purchased Products</th>
              <th>Branches</th>
              <th>Primary Contact</th>
              <th>Phone</th>
              <th>Active Tickets</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading customer records...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No customer records found matching search filters.
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
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                      {c.products && c.products.length > 0 ? (
                        c.products.map((p: any) => (
                          <span
                            key={p.id || p.product_id}
                            style={{
                              padding: '2px 6px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            {p.product_name || p.product?.name || p.product_code || 'Product'}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: '#f8fafc',
                        color: '#475569',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {c.branches?.length || 0} Branches
                    </span>
                  </td>
                  <td>{c.contact_person}</td>
                  <td>{c.contact_phone}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: (c.open_ticket_count || 0) > 0 ? '#eff6ff' : '#f8fafc',
                        color: (c.open_ticket_count || 0) > 0 ? '#1d4ed8' : '#64748b',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      {c.open_ticket_count || 0} Active
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

      {/* Customer Detail Modal / View */}
      {selectedCompany && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 850, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={22} color="#0b3b60" />
                <div>
                  <div className="modal-title">{selectedCompany.company_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Customer ID: {selectedCompany.id} • {selectedCompany.is_active ? 'Active Account' : 'Inactive Account'}
                  </div>
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
              {/* Company Information */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 18, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 10 }}>
                  Company Information
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontSize: 13 }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>PRIMARY CORPORATE EMAIL</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{selectedCompany.primary_email}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>GST NUMBER</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{selectedCompany.gstn || 'Not Provided'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>PRIMARY CONTACT</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{selectedCompany.contact_person} ({selectedCompany.contact_phone})</div>
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>FULL ADDRESS</div>
                    <div style={{ marginTop: 2, color: '#334155' }}>{selectedCompany.address}</div>
                  </div>
                </div>
              </div>

              {/* PRODUCTS SECTION */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={15} color="#2563eb" />
                    <span>PURCHASED PRODUCTS ({selectedCompany.products?.length || 0})</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setProductError(null); setShowAddProductModal(true); }}>
                    <Plus size={13} /> Add Product
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {selectedCompany.products && selectedCompany.products.length > 0 ? (
                    selectedCompany.products.map((p: any) => (
                      <div
                        key={p.id || p.product_id}
                        style={{
                          background: 'white',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          padding: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#0b3b60' }}>{p.product_name || p.product?.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Code: {p.product_code || p.product?.code}</div>
                          {p.category && <div style={{ fontSize: 11, color: '#2563eb' }}>{p.category}</div>}
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 6px', color: '#b91c1c' }}
                          title="Remove Product"
                          onClick={() => handleRemoveProduct(p.product_id || p.productId, p.product_name || p.product?.name)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#b91c1c', fontSize: 12, padding: 8 }}>
                      No active products found. (Customer must own at least 1 product)
                    </div>
                  )}
                </div>
              </div>

              {/* BRANCHES SECTION */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={15} color="#059669" />
                    <span>BRANCHES ({companyBranches.length})</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleOpenAddBranch}>
                    <Plus size={13} /> Add Branch
                  </button>
                </div>

                {loadingBranches ? (
                  <div style={{ fontSize: 12, color: '#94a3b8', padding: 10 }}>Loading customer branches...</div>
                ) : companyBranches.length === 0 ? (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>
                    No separate branches registered for this customer. Support tickets are routed directly through company headquarters.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                    {companyBranches.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          background: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>{b.branch_name || (b as any).branchName}</span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>({b.id})</span>
                              {b.status === 'ACTIVE' ? (
                                <span className="badge badge-resolved" style={{ fontSize: 10, padding: '1px 6px' }}>Active</span>
                              ) : (
                                <span className="badge badge-closed" style={{ fontSize: 10, padding: '1px 6px' }}>Inactive</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                              {b.address}, {b.city}, {b.state} - {b.pincode}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              Contact: {b.contact_person || (b as any).contactPerson} • {b.contact_phone || (b as any).contactPhone} • {b.contact_email || (b as any).contactEmail}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditBranch(b)}>
                              <Edit2 size={12} /> Edit
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleToggleBranchStatus(b)}>
                              {b.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>

                        {/* Branch Products */}
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Assigned Branch Products:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {b.branchProducts && b.branchProducts.length > 0 ? (
                              b.branchProducts.map((bp: any) => (
                                <span
                                  key={bp.id || bp.productId}
                                  style={{
                                    padding: '1px 6px',
                                    background: '#f0fdf4',
                                    color: '#15803d',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    border: '1px solid #bbf7d0',
                                  }}
                                >
                                  {bp.productName || bp.product?.name || bp.productId}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>No products assigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TICKET SUMMARY */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
                  Support Ticket Statistics
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
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCompany(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CUSTOMER MODAL (Workflow with Mandatory Product Selection) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={20} color="#0b3b60" />
                <div className="modal-title">Register New Customer</div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: createStep === 1 ? '#2563eb' : '#64748b',
                  borderBottom: createStep === 1 ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setCreateStep(1)}
              >
                1. Company Details
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: createStep === 2 ? '#2563eb' : '#64748b',
                  borderBottom: createStep === 2 ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setCreateStep(2)}
              >
                2. Products Purchased *
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: createStep === 3 ? '#2563eb' : '#64748b',
                  borderBottom: createStep === 3 ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setCreateStep(3)}
              >
                3. Review & Register
              </div>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {formError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      borderRadius: 6,
                      marginBottom: 14,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* STEP 1: COMPANY DETAILS */}
                {createStep === 1 && (
                  <div>
                    <div className="form-group">
                      <label className="form-label">Company / Organization Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="e.g. Apex Technologies Corp"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Primary Corporate Email *</label>
                        <input
                          type="email"
                          className="form-control"
                          required
                          placeholder="billing@company.com"
                          value={formData.primary_email}
                          onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">GST Number (Optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="27AABCU9603R1ZM"
                          value={formData.gstn}
                          onChange={(e) => setFormData({ ...formData, gstn: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Full Corporate Address *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="Office No, Commercial Tower, Street, City, State, PIN"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Primary Contact Person *</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Full Name"
                          value={formData.contact_person}
                          onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Contact Phone *</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="+91 98765 43210"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: PRODUCTS PURCHASED (Mandatory) */}
                {createStep === 2 && (
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                        Select Products Purchased by Customer *
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        A customer organization must own at least ONE KANVTECH product to register.
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {products.map((p) => {
                        const selected = formData.product_ids.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleProductSelection(p.id)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 6,
                              border: selected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                              background: selected ? '#eff6ff' : 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {}}
                              style={{ marginTop: 2, cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#0b3b60' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>Code: {p.code} • {p.category}</div>
                              <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{p.description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {formData.product_ids.length === 0 && (
                      <div style={{ marginTop: 12, fontSize: 12, color: '#b91c1c', fontWeight: 500 }}>
                        ⚠️ You must select at least 1 product.
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: REVIEW & CONFIRM */}
                {createStep === 3 && (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: '#0b3b60', fontSize: 14, marginBottom: 8 }}>
                        {formData.company_name}
                      </div>
                      <div style={{ color: '#475569', marginBottom: 4 }}>📍 {formData.address}</div>
                      <div style={{ color: '#475569', marginBottom: 4 }}>✉️ {formData.primary_email}</div>
                      <div style={{ color: '#475569' }}>👤 {formData.contact_person} ({formData.contact_phone})</div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>Purchased Products:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {formData.product_ids.map((pid) => {
                          const prod = products.find((p) => p.id === pid);
                          return (
                            <span
                              key={pid}
                              style={{
                                padding: '4px 10px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                borderRadius: 6,
                                fontWeight: 600,
                                fontSize: 12,
                                border: '1px solid #bfdbfe',
                              }}
                            >
                              {prod ? prod.name : pid}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  {createStep > 1 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCreateStep((prev) => (prev - 1) as any)}
                    >
                      Back
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>

                  {createStep < 3 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (createStep === 1 && !formData.company_name) {
                          setFormError('Company name is required');
                          return;
                        }
                        if (createStep === 2 && formData.product_ids.length === 0) {
                          setFormError('At least one product must be selected before registering a customer.');
                          return;
                        }
                        setFormError(null);
                        setCreateStep((prev) => (prev + 1) as any);
                      }}
                    >
                      Next Step
                    </button>
                  ) : (
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Registering Customer...' : 'Register Customer'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title">Purchase Additional Product</div>
              <button
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {productError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                  {productError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Select Product to Add *</label>
                <select
                  className="form-control"
                  value={selectedNewProductId}
                  onChange={(e) => setSelectedNewProductId(e.target.value)}
                >
                  <option value="">Choose a product from Product Master</option>
                  {products
                    .filter((p) => !selectedCompany?.products?.some((cp: any) => (cp.product_id || cp.productId) === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddProductModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddProduct}
                disabled={!selectedNewProductId || addingProduct}
              >
                {addingProduct ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANCH CREATE / EDIT MODAL */}
      {showBranchModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={20} color="#059669" />
                <div className="modal-title">{editingBranch ? 'Edit Customer Branch' : 'Add New Branch'}</div>
              </div>
              <button
                onClick={() => setShowBranchModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBranch}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {branchError && (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                    {branchError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Branch Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Dahisar Branch, Kandivali Plant, Vapi Unit"
                    value={branchForm.branch_name}
                    onChange={(e) => setBranchForm({ ...branchForm, branch_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Address *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Full street / building address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="Mumbai"
                      value={branchForm.city}
                      onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="Maharashtra"
                      value={branchForm.state}
                      onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">PIN / Postal Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="400068"
                      value={branchForm.pincode}
                      onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Contact Person *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="Branch Manager Name"
                      value={branchForm.contact_person}
                      onChange={(e) => setBranchForm({ ...branchForm, contact_person: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Phone *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="+91 98200 XXXXX"
                      value={branchForm.contact_phone}
                      onChange={(e) => setBranchForm({ ...branchForm, contact_phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      required
                      placeholder="branch@company.com"
                      value={branchForm.contact_email}
                      onChange={(e) => setBranchForm({ ...branchForm, contact_email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Branch Product Assignment (Must subset of customer-owned products) */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Branch Products (Subset of Customer Products)
                  </label>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                    A branch can only be assigned products already owned by the parent customer organization.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedCompany?.products?.map((cp: any) => {
                      const pId = cp.product_id || cp.productId;
                      const pName = cp.product_name || cp.product?.name;
                      const selected = branchForm.product_ids.includes(pId);
                      return (
                        <button
                          type="button"
                          key={pId}
                          onClick={() => {
                            if (selected) {
                              setBranchForm({
                                ...branchForm,
                                product_ids: branchForm.product_ids.filter((id) => id !== pId),
                              });
                            } else {
                              setBranchForm({
                                ...branchForm,
                                product_ids: [...branchForm.product_ids, pId],
                              });
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            border: selected ? '2px solid #059669' : '1px solid #cbd5e1',
                            background: selected ? '#ecfdf5' : 'white',
                            color: selected ? '#065f46' : '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          {selected ? '✓ ' : '+ '} {pName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBranchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingBranch}>
                  {savingBranch ? 'Saving...' : editingBranch ? 'Save Branch Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
