import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { Ticket, Company, Product, Branch } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SLABadge } from '../../components/common/SLABadge';
import {
  Search,
  Plus,
  Eye,
  Play,
  AlertCircle,
  Package,
  MapPin,
  Layers,
  Building,
  User,
  CheckCircle2,
  X,
  ChevronDown,
  RefreshCw,
  Edit3,
  Phone,
  Mail,
  Check,
} from 'lucide-react';

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

  // Create Modal & Customer Search States
  const [showCreateModal, setShowCreateModal] = useState(openCreateImmediately);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Company[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);

  // Contact Person Searchable States
  const [selectedContactId, setSelectedContactId] = useState<number | ''>('');
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [companyContacts, setCompanyContacts] = useState<any[]>([]);

  // Branches & Products
  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [companyProducts, setCompanyProducts] = useState<any[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [selectedSubmoduleId, setSelectedSubmoduleId] = useState<string>('');
  const [productModules, setProductModules] = useState<any[]>([]);
  const [moduleSubmodules, setModuleSubmodules] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [derivedDepartmentName, setDerivedDepartmentName] = useState<string>('Auto-derived from product');

  const [formProblem, setFormProblem] = useState('');
  const [formPriority, setFormPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [formCategory, setFormCategory] = useState('Hardware / Infrastructure');
  const [formDescription, setFormDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTickets();
  }, [page, statusFilter, priorityFilter, levelFilter, slaFilter, search]);

  useEffect(() => {
    loadDepartmentsForModal();
  }, []);

  // Search customers with debounce
  useEffect(() => {
    if (!showCreateModal) return;
    const timer = setTimeout(() => {
      searchCustomers(customerSearchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearchQuery, showCreateModal]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(event.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const searchCustomers = async (query: string) => {
    setIsSearchingCustomers(true);
    try {
      const res = await api.getCompanies({
        search: query.trim() || undefined,
        limit: 20,
        isActive: '1',
      });
      setCustomerSearchResults(res.data || []);
    } catch (err) {
      console.error('Failed to search customers', err);
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  const handleSelectCompany = async (company: Company) => {
    setSelectedCompany(company);
    setSelectedCompanyId(company.id);
    setCustomerSearchQuery('');
    setShowCustomerDropdown(false);
    setLoadingCustomerDetails(true);
    setCreateError(null);

    // 9. CLEARING CUSTOMER: Clear all stale dependent selections immediately
    setSelectedContactId('');
    setContactSearchQuery('');
    setSelectedBranchId('');
    setSelectedProductId('');
    setSelectedModuleId('');
    setSelectedSubmoduleId('');
    setProductModules([]);
    setModuleSubmodules([]);
    setCompanyContacts([]);
    setCompanyBranches([]);
    setCompanyProducts([]);
    setDerivedDepartmentName('Auto-derived from product');

    try {
      const [compRes, branchRes] = await Promise.all([
        api.getCompany(company.id),
        api.getCustomerBranches(company.id),
      ]);

      const comp = compRes.company || compRes.data || compRes;

      // 3. CONTACT PERSON: Load contacts and auto-select primary if present
      const contacts = comp?.contacts || [];
      setCompanyContacts(contacts);
      if (contacts.length > 0) {
        const primary = contacts.find((ct: any) => ct.is_primary === 1 || ct.isPrimary === true);
        setSelectedContactId(primary ? primary.id : contacts[0].id);
      }

      // 4. BRANCH: Load branches
      const branches = branchRes.branches || comp?.branches || [];
      setCompanyBranches(branches);

      // 5. PURCHASED PRODUCT: Load only purchased products
      const prods = comp?.products || [];
      setCompanyProducts(prods);

      if (prods.length === 1) {
        const firstProdId = prods[0].product_id || prods[0].productId || prods[0].id;
        setSelectedProductId(firstProdId);
        updateDerivedDepartment(firstProdId);
        if (Array.isArray(prods[0].modules)) {
          setProductModules(prods[0].modules);
        }
      }
    } catch (err) {
      console.error('Error fetching customer details:', err);
    } finally {
      setLoadingCustomerDetails(false);
    }
  };

  const handleClearCompany = () => {
    setSelectedCompany(null);
    setSelectedCompanyId('');
    setCustomerSearchQuery('');
    setCreateError(null);
    setSelectedContactId('');
    setContactSearchQuery('');
    setSelectedBranchId('');
    setSelectedProductId('');
    setSelectedModuleId('');
    setSelectedSubmoduleId('');
    setProductModules([]);
    setModuleSubmodules([]);
    setCompanyContacts([]);
    setCompanyBranches([]);
    setCompanyProducts([]);
    setDerivedDepartmentName('Auto-derived from product');
    setShowCustomerDropdown(true);
  };

  // Get selectable products based on branch (Empty branchId = Headquarters / Main Organization)
  const getSelectableProducts = (branchId: string = selectedBranchId) => {
    if (!selectedCompany) return [];

    // Falsy or empty string branchId means "Headquarters / Main Organization" -> all customer-owned products
    if (!branchId || branchId === '') {
      return (companyProducts || []).map((cp: any) => {
        const pId = cp.productId || cp.product_id || cp.id;
        const pName = cp.name || cp.product_name || cp.product?.name || '';
        const pCode = cp.code || cp.product_code || cp.product?.code || '';
        const rawModules = cp.modules || [];
        const mappedModules = rawModules.map((m: any) => {
          const modId = m.id || m.moduleId || m.module?.id;
          const modObj = m.module || m;
          const rawSubs = m.submodules || modObj.submodules || [];
          return {
            id: modId,
            moduleId: modId,
            name: modObj.name || modObj.moduleName || m.name || '',
            submodules: rawSubs.map((s: any) => ({
              id: s.id || s.submoduleId,
              submoduleId: s.id || s.submoduleId,
              name: s.name || s.submoduleName || s.name || '',
            })),
          };
        });
        return {
          id: pId,
          productId: pId,
          product_id: pId,
          name: pName,
          product_name: pName,
          code: pCode,
          product_code: pCode,
          modules: mappedModules,
        };
      });
    }

    // Specific branch selected: strictly use branch-assigned products
    const branch = companyBranches.find((b) => b.id === branchId);
    if (!branch) return [];

    const branchProds = branch.branchProducts || (branch as any).products || [];
    if (!branchProds || branchProds.length === 0) return [];

    return branchProds
      .filter((bp: any) => bp.isActive !== false && bp.is_active !== 0)
      .map((bp: any) => {
        const prodId = bp.productId || bp.product_id || bp.id;
        const parentCustProd = (companyProducts || []).find(
          (cp: any) => (cp.productId || cp.product_id || cp.id) === prodId
        );

        const pName = bp.name || bp.product_name || bp.product?.name || parentCustProd?.name || parentCustProd?.product_name || '';
        const pCode = bp.code || bp.product_code || bp.product?.code || parentCustProd?.code || parentCustProd?.product_code || '';

        const rawModules = (bp.modules && bp.modules.length > 0) ? bp.modules : (parentCustProd?.modules || []);
        const mappedModules = rawModules.map((m: any) => {
          const modId = m.id || m.moduleId || m.module?.id;
          const modObj = m.module || m;
          const parentCustMod = parentCustProd?.modules?.find((pcm: any) => (pcm.id || pcm.moduleId) === modId);
          const rawSubs = m.submodules || modObj.submodules || parentCustMod?.submodules || [];
          return {
            id: modId,
            moduleId: modId,
            name: modObj.name || modObj.moduleName || parentCustMod?.name || m.name || '',
            submodules: rawSubs.map((s: any) => ({
              id: s.id || s.submoduleId,
              submoduleId: s.id || s.submoduleId,
              name: s.name || s.submoduleName || s.name || '',
            })),
          };
        });

        return {
          id: prodId,
          productId: prodId,
          product_id: prodId,
          name: pName,
          product_name: pName,
          code: pCode,
          product_code: pCode,
          modules: mappedModules,
        };
      });
  };

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    setCreateError(null); // Clear previous branch/product validation errors immediately

    const selectable = getSelectableProducts(newBranchId);

    // Check if the currently selected product is valid in the newly selected branch context
    const validCurrentProduct = selectable.find(
      (p: any) => (p.productId || p.product_id || p.id) === selectedProductId
    );

    if (validCurrentProduct) {
      // Product remains valid; refresh its modules hierarchy for this branch
      const validModules = validCurrentProduct.modules || [];
      setProductModules(validModules);

      const validCurrentModule = validModules.find(
        (m: any) => (m.id || m.moduleId) === selectedModuleId
      );

      if (validCurrentModule) {
        const validSubs = validCurrentModule.submodules || [];
        setModuleSubmodules(validSubs);
        const validCurrentSub = validSubs.find(
          (s: any) => (s.id || s.submoduleId) === selectedSubmoduleId
        );
        if (!validCurrentSub) {
          setSelectedSubmoduleId('');
        }
      } else {
        setSelectedModuleId('');
        setSelectedSubmoduleId('');
        setModuleSubmodules([]);
      }
      updateDerivedDepartment(selectedProductId);
    } else {
      // Product is invalid under the new branch; clear product/module/submodule or auto-select if exactly 1
      if (selectable.length === 1) {
        const firstProd = selectable[0];
        const pId = firstProd.productId || firstProd.product_id || firstProd.id;
        setSelectedProductId(pId);
        setSelectedModuleId('');
        setSelectedSubmoduleId('');
        setProductModules(firstProd.modules || []);
        setModuleSubmodules([]);
        updateDerivedDepartment(pId);
      } else {
        setSelectedProductId('');
        setSelectedModuleId('');
        setSelectedSubmoduleId('');
        setProductModules([]);
        setModuleSubmodules([]);
        setDerivedDepartmentName('No product selected');
      }
    }
  };

  const handleProductChange = (productId: string, branchId: string = selectedBranchId) => {
    setSelectedProductId(productId);
    setCreateError(null); // Clear any stale validation error
    setSelectedModuleId('');
    setSelectedSubmoduleId('');
    setProductModules([]);
    setModuleSubmodules([]);
    updateDerivedDepartment(productId);

    if (productId) {
      const selectable = getSelectableProducts(branchId);
      const ownedProduct = selectable.find(
        (p: any) => (p.productId || p.product_id || p.id) === productId
      );

      if (ownedProduct && Array.isArray(ownedProduct.modules)) {
        setProductModules(ownedProduct.modules);
      }
    }
  };

  const handleModuleChange = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setCreateError(null); // Clear any stale validation error
    setSelectedSubmoduleId('');
    setModuleSubmodules([]);
    if (moduleId) {
      const mod = productModules.find((m: any) => (m.id || m.moduleId) === moduleId);
      if (mod && mod.submodules && mod.submodules.length > 0) {
        setModuleSubmodules(mod.submodules);
      }
    }
  };

  const handleSubmoduleChange = (submoduleId: string) => {
    setSelectedSubmoduleId(submoduleId);
    setCreateError(null); // Clear any stale validation error
  };

  const loadDepartmentsForModal = async () => {
    try {
      const res = await api.getDepartments({ isActive: 'true' });
      const depts = Array.isArray(res) ? res : res.departments || res.data || [];
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const updateDerivedDepartment = (productId: string, currentDepts: any[] = departments) => {
    if (!productId) {
      setDerivedDepartmentName('No product selected');
      return;
    }
    const deptsToSearch = currentDepts.length > 0 ? currentDepts : departments;
    const matchedDept = deptsToSearch.find((d: any) => {
      const inProducts = d.products?.some((p: any) => (p.id || p.productId) === productId);
      const inSpecs = d.specializations?.some((s: any) => s.productId === productId);
      return inProducts || inSpecs;
    });

    if (matchedDept) {
      setDerivedDepartmentName(`${matchedDept.name} (${matchedDept.code})`);
    } else {
      setDerivedDepartmentName('Support Operations (General Support)');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!selectedCompanyId) {
      setCreateError('Please select a customer organization.');
      return;
    }

    if (!selectedContactId) {
      setCreateError('Please select a valid customer contact person.');
      return;
    }

    if (!selectedProductId) {
      setCreateError('Please select a purchased product for this ticket.');
      return;
    }

    setCreating(true);

    try {
      const res = await api.createTicket({
        companyId: selectedCompanyId,
        customerContactId: selectedContactId,
        branchId: selectedBranchId || undefined,
        productId: selectedProductId,
        moduleId: selectedModuleId || undefined,
        submoduleId: selectedSubmoduleId || undefined,
        problemType: formProblem,
        priority: formPriority,
        category: formCategory,
        description: formDescription,
      });

      setShowCreateModal(false);
      setFormProblem('');
      setFormDescription('');
      handleClearCompany();
      loadTickets();
      onNavigateDetail(res.ticket.id);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  // Filtered contacts for contact searchable combobox
  const filteredContacts = companyContacts.filter((ct) => {
    const q = contactSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      ct.name?.toLowerCase().includes(q) ||
      ct.email?.toLowerCase().includes(q) ||
      ct.phone?.toLowerCase().includes(q) ||
      ct.designation?.toLowerCase().includes(q)
    );
  });

  const selectedContactObj = companyContacts.find((ct) => ct.id === selectedContactId);

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
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowCreateModal(true);
            if (!selectedCompany) setShowCustomerDropdown(true);
          }}
          style={{ background: '#0b3b60', borderColor: '#0b3b60' }}
        >
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

      {/* Log Ticket Modal with Searchable Customer Selector & Auto Routing */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={18} color="#0b3b60" />
                <span>Log New Support Ticket</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '18px 24px' }}>
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

                {/* 1 & 10. SEARCHABLE CUSTOMER SELECTOR */}
                <div className="form-group" style={{ marginBottom: 16, position: 'relative' }} ref={customerDropdownRef}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
                    Customer Organization <span className="required">*</span>
                  </label>

                  {selectedCompany ? (
                    /* 10. Selected Customer Badge/Card */
                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1.5px solid #0b3b60',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 6,
                            background: '#e6f0f8',
                            color: '#0b3b60',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 14,
                          }}
                        >
                          <Building size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                              {selectedCompany.company_name}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#0b3b60',
                                color: '#ffffff',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {selectedCompany.id}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#dcfce7',
                                color: '#15803d',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}
                            >
                              Active
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {selectedCompany.primary_email ? `✉ ${selectedCompany.primary_email}` : ''}
                            {selectedCompany.contact_person ? ` • 👤 ${selectedCompany.contact_person}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleClearCompany}
                        style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Edit3 size={12} /> Change Customer
                      </button>
                    </div>
                  ) : (
                    /* 1. Searchable Combobox Input */
                    <div>
                      <div style={{ position: 'relative' }}>
                        <Search
                          size={15}
                          color="#94a3b8"
                          style={{ position: 'absolute', left: 12, top: 11 }}
                        />
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search customer by name (e.g. Zenith), ID (CMP-0002), or email..."
                          value={customerSearchQuery}
                          onChange={(e) => {
                            setCustomerSearchQuery(e.target.value);
                            setShowCustomerDropdown(true);
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          style={{ paddingLeft: 36, height: 38, fontSize: 13 }}
                          autoFocus
                        />
                        {isSearchingCustomers && (
                          <RefreshCw
                            size={14}
                            className="animate-spin"
                            style={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8' }}
                          />
                        )}
                      </div>

                      {/* Dropdown Results */}
                      {showCustomerDropdown && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: 4,
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: 8,
                            boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.15)',
                            zIndex: 1060,
                            maxHeight: 240,
                            overflowY: 'auto',
                          }}
                        >
                          <div style={{ padding: '6px 12px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                            {customerSearchResults.length > 0 ? `Matching Customers (${customerSearchResults.length})` : 'Customers'}
                          </div>

                          {customerSearchResults.length === 0 ? (
                            <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                              {isSearchingCustomers ? 'Searching...' : `No customer found matching "${customerSearchQuery}"`}
                            </div>
                          ) : (
                            customerSearchResults.map((comp) => (
                              <div
                                key={comp.id}
                                onClick={() => handleSelectCompany(comp)}
                                style={{
                                  padding: '10px 14px',
                                  borderBottom: '1px solid #f1f5f9',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                                      {comp.company_name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        background: '#e6f0f8',
                                        color: '#0b3b60',
                                        padding: '1px 5px',
                                        borderRadius: 3,
                                        fontFamily: 'var(--font-mono)',
                                      }}
                                    >
                                      {comp.id}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                    {comp.primary_email ? `✉ ${comp.primary_email}` : ''}
                                    {comp.contact_person ? ` • 👤 ${comp.contact_person}` : ''}
                                    {comp.address ? ` • 📍 ${comp.address}` : ''}
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Active</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2 & 7. DEPENDENT SECTIONS: Only enabled/loaded when customer is selected */}
                {loadingCustomerDetails ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading customer data, branches & purchased entitlements...
                  </div>
                ) : selectedCompany ? (
                  <>
                    {/* 3 & 4. Contact Person and Branch Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* 3. SEARCHABLE CONTACT PERSON SELECTOR */}
                      <div className="form-group" style={{ position: 'relative' }} ref={contactDropdownRef}>
                        <label className="form-label">
                          Contact Person <span className="required">*</span>
                        </label>

                        {companyContacts.length === 0 ? (
                          <div
                            style={{
                              height: 38,
                              padding: '8px 12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              fontSize: 12,
                              color: '#94a3b8',
                            }}
                          >
                            No contacts registered
                          </div>
                        ) : companyContacts.length === 1 ? (
                          /* Single contact view */
                          <div
                            style={{
                              height: 38,
                              padding: '6px 12px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 13,
                              color: '#0f172a',
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              {companyContacts[0].name} {companyContacts[0].phone ? `(${companyContacts[0].phone})` : ''}
                            </span>
                            <span style={{ fontSize: 10, background: '#e6f0f8', color: '#0b3b60', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              Primary
                            </span>
                          </div>
                        ) : (
                          /* Multiple contacts searchable selector */
                          <div>
                            <div
                              style={{
                                height: 38,
                                padding: '6px 12px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                              onClick={() => setShowContactDropdown((prev) => !prev)}
                            >
                              {selectedContactObj ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                    {selectedContactObj.name}
                                  </span>
                                  <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {selectedContactObj.phone || selectedContactObj.email || ''}
                                  </span>
                                  {(selectedContactObj.is_primary || selectedContactObj.isPrimary) && (
                                    <span style={{ fontSize: 10, background: '#e6f0f8', color: '#0b3b60', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                                      ★ Primary
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 13 }}>Select contact person...</span>
                              )}
                              <ChevronDown size={14} color="#94a3b8" />
                            </div>

                            {/* Contact Dropdown */}
                            {showContactDropdown && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  marginTop: 4,
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 6,
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                  zIndex: 1070,
                                  maxHeight: 200,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  overflow: 'hidden',
                                }}
                              >
                                <div style={{ padding: 6, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                  <input
                                    type="text"
                                    placeholder="Search contact..."
                                    value={contactSearchQuery}
                                    onChange={(e) => setContactSearchQuery(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ width: '100%', padding: '4px 8px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }}
                                    autoFocus
                                  />
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                                  {filteredContacts.length === 0 ? (
                                    <div style={{ padding: 8, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                      No contacts found
                                    </div>
                                  ) : (
                                    filteredContacts.map((ct) => {
                                      const isSelected = selectedContactId === ct.id;
                                      return (
                                        <div
                                          key={ct.id}
                                          onClick={() => {
                                            setSelectedContactId(ct.id);
                                            setShowContactDropdown(false);
                                            setContactSearchQuery('');
                                          }}
                                          style={{
                                            padding: '7px 12px',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            background: isSelected ? '#f0f9ff' : 'transparent',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                                          }}
                                        >
                                          <div>
                                            <div style={{ fontWeight: isSelected ? 700 : 500, color: '#0f172a' }}>
                                              {ct.name}
                                              {(ct.is_primary || ct.isPrimary) && (
                                                <span style={{ marginLeft: 6, fontSize: 10, color: '#0b3b60', fontWeight: 700 }}>
                                                  ★ Primary
                                                </span>
                                              )}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#64748b' }}>
                                              {ct.phone || ct.email || ''} {ct.designation ? `• ${ct.designation}` : ''}
                                            </div>
                                          </div>
                                          {isSelected && <Check size={14} color="#0284c7" />}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 4. BRANCH */}
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
                    </div>

                    {/* 5. PURCHASED PRODUCT */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">
                          Purchased Product <span className="required">*</span>
                        </label>
                        <select
                          className="form-control"
                          required
                          value={selectedProductId}
                          onChange={(e) => handleProductChange(e.target.value)}
                        >
                          <option value="">
                            {getSelectableProducts().length === 0
                              ? 'No purchased products found'
                              : `Select Purchased Product (${getSelectableProducts().length} available)...`}
                          </option>
                          {getSelectableProducts().map((p: any) => (
                            <option key={p.product_id || p.productId || p.id} value={p.product_id || p.productId || p.id}>
                              {p.product_name || p.name} ({p.product_code || p.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 8. Auto-derived Department Display */}
                      <div className="form-group">
                        <label className="form-label">Automated Routing Department</label>
                        <div
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            color: '#1e40af',
                            height: 38,
                          }}
                        >
                          <Layers size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <strong>{derivedDepartmentName}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 6. MODULE & SUBMODULE SELECTION (Only Customer-Owned Entitlements) */}
                    {productModules.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Purchased Module (Optional)</label>
                          <select
                            className="form-control"
                            value={selectedModuleId}
                            onChange={(e) => handleModuleChange(e.target.value)}
                          >
                            <option value="">All Modules / General Product Support</option>
                            {productModules.map((m: any) => (
                              <option key={m.id || m.moduleId} value={m.id || m.moduleId}>
                                {m.name || m.moduleName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {moduleSubmodules.length > 0 && (
                          <div className="form-group">
                            <label className="form-label">Purchased Submodule (Optional)</label>
                            <select
                              className="form-control"
                              value={selectedSubmoduleId}
                              onChange={(e) => handleSubmoduleChange(e.target.value)}
                            >
                              <option value="">All Submodules</option>
                              {moduleSubmodules.map((sm: any) => (
                                <option key={sm.id || sm.submoduleId} value={sm.id || sm.submoduleId}>
                                  {sm.name || sm.submoduleName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      padding: 16,
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      borderRadius: 6,
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    Please search and select a customer organization above to load contacts, branches, and purchased products.
                  </div>
                )}

                {/* Ticket Details Form Fields */}
                <div className="form-group">
                  <label className="form-label">
                    Problem Title / Issue Summary <span className="required">*</span>
                  </label>
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
                    <label className="form-label">
                      Priority / SLA Class <span className="required">*</span>
                    </label>
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
                    <label className="form-label">
                      Problem Category <span className="required">*</span>
                    </label>
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
                  <label className="form-label">
                    Detailed Description of Symptoms <span className="required">*</span>
                  </label>
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !selectedCompanyId || !selectedProductId}
                  style={{ background: '#0b3b60', borderColor: '#0b3b60' }}
                >
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
