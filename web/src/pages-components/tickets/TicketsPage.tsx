import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Ticket, Company, Product, Branch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import { Search, Plus, Eye, Play, AlertCircle, Package, MapPin, Layers } from 'lucide-react';

interface Props {
  onNavigateDetail: (id: string) => void;
  openCreateImmediately?: boolean;
}

export const TicketsPage: React.FC<Props> = ({ onNavigateDetail, openCreateImmediately = false }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [search, setSearch] = useState('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(openCreateImmediately);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<number | ''>('');
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);
  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [companyProducts, setCompanyProducts] = useState<any[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [derivedDepartmentName, setDerivedDepartmentName] = useState<string>('Auto-derived from product');

  const [formProblem, setFormProblem] = useState('');
  const [formPriority, setFormPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [formCategory, setFormCategory] = useState('Hardware / Infrastructure');
  const [formDescription, setFormDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [page, statusFilter, priorityFilter, levelFilter, slaFilter, search]);

  useEffect(() => {
    loadCompaniesForModal();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await api.getTickets({
        page,
        limit: 20,
        status: statusFilter,
        priority: priorityFilter,
        level: levelFilter,
        slaStatus: slaFilter,
        search,
      });
      setTickets(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompaniesForModal = async () => {
    try {
      const res = await api.getCompanies({ limit: 100, isActive: '1' });
      setCompanies(res.data);
      if (res.data.length > 0 && !selectedCompanyId) {
        handleCompanyChange(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompanyChange = async (compId: string) => {
    setSelectedCompanyId(compId);
    setSelectedBranchId('');
    setSelectedProductId('');
    try {
      const [compRes, branchRes] = await Promise.all([
        api.getCompany(compId),
        api.getCustomerBranches(compId),
      ]);
      const comp = compRes.company;
      if (comp?.contacts) {
        setCompanyContacts(comp.contacts);
        if (comp.contacts.length > 0) {
          setSelectedContactId(comp.contacts[0].id);
        }
      }
      const prods = comp?.products || [];
      setCompanyProducts(prods);
      setCompanyBranches(branchRes.branches || []);
      if (prods.length > 0) {
        const firstProdId = prods[0].product_id || prods[0].productId;
        setSelectedProductId(firstProdId);
        updateDerivedDepartment(firstProdId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    if (!branchId) {
      // Revert to all company products
      if (companyProducts.length > 0) {
        const firstProdId = companyProducts[0].product_id || companyProducts[0].productId;
        setSelectedProductId(firstProdId);
        updateDerivedDepartment(firstProdId);
      }
    } else {
      // Filter products to branch-owned products
      const branch = companyBranches.find((b) => b.id === branchId);
      const branchProds = branch?.branchProducts || branch?.products || [];
      if (branchProds.length > 0) {
        const firstBranchProdId = (branchProds[0] as any).productId || (branchProds[0] as any).product_id;
        setSelectedProductId(firstBranchProdId);
        updateDerivedDepartment(firstBranchProdId);
      } else {
        setSelectedProductId('');
        setDerivedDepartmentName('No products assigned to this branch');
      }
    }
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    updateDerivedDepartment(productId);
  };

  const updateDerivedDepartment = (productId: string) => {
    const prod = companyProducts.find((p) => (p.product_id || p.productId) === productId);
    const prodName = prod?.product_name || prod?.product?.name || '';
    if (prodName.toLowerCase().includes('tally')) {
      setDerivedDepartmentName('Tally Support (DEP-0001)');
    } else if (prodName.toLowerCase().includes('spine')) {
      setDerivedDepartmentName('Spine Support (DEP-0002)');
    } else if (prodName.toLowerCase().includes('bios')) {
      setDerivedDepartmentName('BIOS 360 Support (DEP-0003)');
    } else if (prodName.toLowerCase().includes('cyber')) {
      setDerivedDepartmentName('CyberShield Support (DEP-0004)');
    } else {
      setDerivedDepartmentName('Dedicated Product Support Department');
    }
  };

  // Get selectable products based on branch
  const getSelectableProducts = () => {
    if (!selectedBranchId) {
      return companyProducts;
    }
    const branch = companyBranches.find((b) => b.id === selectedBranchId);
    if (!branch) return companyProducts;
    const branchProds = branch.branchProducts || branch.products || [];
    return branchProds.map((bp: any) => ({
      product_id: bp.productId || bp.product_id,
      product_name: bp.productName || bp.product?.name || bp.productId,
      product_code: bp.productCode || bp.product?.code || '',
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!selectedProductId) {
      setCreateError('Please select a valid purchased product for this ticket.');
      return;
    }

    setCreating(true);

    try {
      const res = await api.createTicket({
        companyId: selectedCompanyId,
        customerContactId: selectedContactId,
        branchId: selectedBranchId || undefined,
        productId: selectedProductId,
        problemType: formProblem,
        priority: formPriority,
        category: formCategory,
        description: formDescription,
      });

      setShowCreateModal(false);
      setFormProblem('');
      setFormDescription('');
      loadTickets();
      onNavigateDetail(res.ticket.id);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Support Tickets Directory</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
              {total} tickets
            </span>
          </h2>
          <div className="page-subtitle">Central queue with automatic product department routing and lowest-workload L1 assignment</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} /> Log Support Ticket
        </button>
      </div>

      {/* Contextual Filter Bar */}
      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search ticket ID (KT-2026-...), product, company, customer..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select className="select-filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open (Unworked)</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="MANAGER_REVIEW">Manager Review</option>
          <option value="CUSTOMER_FEEDBACK">Feedback Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select className="select-filter" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
          <option value="">All Priorities</option>
          <option value="HIGH">High Priority</option>
          <option value="MEDIUM">Medium Priority</option>
          <option value="LOW">Low Priority</option>
        </select>

        <select className="select-filter" value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}>
          <option value="">All Levels</option>
          <option value="L1">Level 1</option>
          <option value="L2">Level 2</option>
          <option value="L3">Level 3</option>
          <option value="PARENT_COMPANY">Parent Company</option>
        </select>

        <select className="select-filter" value={slaFilter} onChange={(e) => { setSlaFilter(e.target.value); setPage(1); }}>
          <option value="">All SLA States</option>
          <option value="ON_TRACK">SLA On Track</option>
          <option value="WARNING">SLA Warning (75%)</option>
          <option value="BREACHED">SLA Breached</option>
          <option value="MET">SLA Met</option>
        </select>

        {(statusFilter || priorityFilter || levelFilter || slaFilter || search) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
              setLevelFilter('');
              setSlaFilter('');
              setSearch('');
              setPage(1);
            }}
            title="Clear all active filters"
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
              <th>Ticket ID</th>
              <th>Customer Organization</th>
              <th>Product & Department</th>
              <th>Problem Summary</th>
              <th>Priority</th>
              <th>Tier</th>
              <th>Assigned Specialist</th>
              <th>SLA Status</th>
              <th>State</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                  Loading support tickets...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                  No tickets found matching your filter parameters.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>
                    {t.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.company_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {(t as any).branch_name ? `📍 ${(t as any).branch_name} • ` : ''}{t.contact_name}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Package size={13} color="#2563eb" />
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{(t as any).product_name || 'General Product'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Layers size={11} color="#475569" />
                      <span>{(t as any).department_name || 'Support Desk'}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{t.problem_type}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{t.category}</div>
                  </td>
                  <td>
                    <span className={`priority-${t.priority.toLowerCase()}`}>
                      ● {t.priority}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{t.assigned_level}</span>
                  </td>
                  <td>
                    {t.assigned_employee_name ? (
                      <div>
                        <div>{t.assigned_employee_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{t.assigned_employee_level}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 500, fontSize: 12 }}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    <SLABadge status={t.liveSlaStatus || t.sla_status} remainingSeconds={t.slaRemainingSeconds} />
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => onNavigateDetail(t.id)}>
                      <Eye size={12} /> Work Screen
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Log Ticket Modal with Branch, Product & Auto Department Routing */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div className="modal-title">Log New Support Ticket</div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {createError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 13,
                      marginBottom: 14,
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                    }}
                  >
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>{createError}</div>
                  </div>
                )}

                {/* Customer Organization Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Customer Organization <span className="required">*</span></label>
                    <select
                      className="form-control"
                      required
                      value={selectedCompanyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name} ({c.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Person <span className="required">*</span></label>
                    <select
                      className="form-control"
                      required
                      value={selectedContactId}
                      onChange={(e) => setSelectedContactId(Number(e.target.value))}
                    >
                      {companyContacts.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.name} ({ct.phone || ct.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Branch and Product Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Customer Branch (Optional)</label>
                    <select
                      className="form-control"
                      value={selectedBranchId}
                      onChange={(e) => handleBranchChange(e.target.value)}
                    >
                      <option value="">Headquarters / Main Organization</option>
                      {companyBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.branch_name || (b as any).branchName} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purchased Product <span className="required">*</span></label>
                    <select
                      className="form-control"
                      required
                      value={selectedProductId}
                      onChange={(e) => handleProductChange(e.target.value)}
                    >
                      <option value="">Select Owned Product</option>
                      {getSelectableProducts().map((p: any) => (
                        <option key={p.product_id || p.id} value={p.product_id || p.id}>
                          {p.product_name || p.name} ({p.product_code || p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-derived Department Display (Read-Only) */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    padding: '8px 12px',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: '#1e40af',
                  }}
                >
                  <Layers size={14} color="#2563eb" />
                  <span>
                    <strong>Automated Routing:</strong> {derivedDepartmentName} → Lowest Workload L1 Specialist
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Problem Title / Issue Summary <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={formProblem}
                    onChange={(e) => setFormProblem(e.target.value)}
                    placeholder="e.g. Tally GST e-invoice sync failure on gateway"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Priority / SLA Class <span className="required">*</span></label>
                    <select
                      className="form-control"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as any)}
                    >
                      <option value="HIGH">High (4 Hours Resolution SLA)</option>
                      <option value="MEDIUM">Medium (12 Hours Resolution SLA)</option>
                      <option value="LOW">Low (24 Hours Resolution SLA)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Problem Category <span className="required">*</span></label>
                    <select
                      className="form-control"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    >
                      <option value="Statutory & Compliance">Statutory & Compliance</option>
                      <option value="Hardware / Biometric Sync">Hardware / Biometric Sync</option>
                      <option value="Database Services">Database Services</option>
                      <option value="Network & Multi-User">Network & Multi-User</option>
                      <option value="Enterprise Applications">Enterprise Applications</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Description of Symptoms <span className="required">*</span></label>
                  <textarea
                    className="form-control"
                    required
                    rows={4}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Provide diagnostic symptoms, error codes, impact, and affected systems..."
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, fontSize: 12, color: '#64748b' }}>
                  Rule: Strict maximum 2 active tickets per customer contact. Ticket auto-assigned to lowest workload L1 specialist within the product department.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Validating & Routing...' : 'Submit Service Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
