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
  Calendar,
  X,
  AlertCircle,
  Building2,
  Package,
  Layers,
  Sliders,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

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

interface SLARule {
  id: string;
  targetType: 'PRODUCT' | 'MODULE' | 'SUBMODULE' | 'GLOBAL';
  targetId?: string;
  targetName: string;
  productId?: string;
  productName?: string;
  moduleId?: string;
  moduleName?: string;
  submoduleId?: string;
  submoduleName?: string;
  slaTier: string;
  priority: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  notes?: string;
}

export const MaintenancePage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Customer-Centric Add AMC Agreement Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [loadingCustomerHierarchy, setLoadingCustomerHierarchy] = useState(false);
  const [customerPurchasedProducts, setCustomerPurchasedProducts] = useState<any[]>([]);

  // Agreement Header State
  const [agreementName, setAgreementName] = useState('Enterprise Support AMC 2026');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [agreementNotes, setAgreementNotes] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [slaRules, setSlaRules] = useState<SLARule[]>([]);

  // SLA Configurator Modal State
  const [activeSlaTarget, setActiveSlaTarget] = useState<{
    targetType: 'PRODUCT' | 'MODULE' | 'SUBMODULE' | 'GLOBAL';
    targetId?: string;
    targetName: string;
    productId?: string;
    productName?: string;
    moduleId?: string;
    moduleName?: string;
    submoduleId?: string;
    submoduleName?: string;
  } | null>(null);

  const [slaTierOption, setSlaTierOption] = useState('24x7 Critical (1h / 4h)');
  const [slaPriority, setSlaPriority] = useState('ALL');
  const [slaResponseHours, setSlaResponseHours] = useState(1);
  const [slaResolutionHours, setSlaResolutionHours] = useState(4);
  const [slaRuleNotes, setSlaRuleNotes] = useState('');

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

      const [subRes, compRes, empRes, statsRes] = await Promise.all([
        api.getSubscriptions(params),
        api.getCompanies({ limit: 150 }),
        api.getEmployees({ limit: 100 }).catch(() => ({ data: [] })),
        api.getSubscriptionStats().catch(() => ({ stats: null })),
      ]);

      setSubscriptions(subRes.data || []);
      setCompanies(compRes.data || []);
      setEmployees(empRes.data || []);
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

  // Open Add AMC Modal and reset state
  const handleOpenAddModal = () => {
    setSelectedCustomer(null);
    setCustomerSearchQuery('');
    setIsCustomerSearchOpen(false);
    setCustomerPurchasedProducts([]);
    setSelectedProductIds([]);
    setSlaRules([]);
    setAgreementName('Enterprise Support AMC 2026');
    setStartDate(new Date().toISOString().split('T')[0]);
    setExpiryDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setOwnerEmployeeId('');
    setAgreementNotes('');
    setShowAddModal(true);
  };

  // Handle selecting customer
  const handleSelectCustomer = async (company: any) => {
    setSelectedCustomer(company);
    setCustomerSearchQuery('');
    setIsCustomerSearchOpen(false);
    setLoadingCustomerHierarchy(true);
    try {
      const detailRes = await api.getCompany(company.id);
      const companyData = detailRes.company || detailRes;
      const prods = companyData.products || [];
      setCustomerPurchasedProducts(prods);
      // Auto-select all purchased product IDs by default
      const pIds = prods.map((p: any) => p.product_id || p.productId || p.id).filter(Boolean);
      setSelectedProductIds(pIds);
      setSlaRules([]);
    } catch (err: any) {
      alert(`Could not load customer product entitlements: ${err.message}`);
    } finally {
      setLoadingCustomerHierarchy(false);
    }
  };

  // Toggle product selection in AMC agreement
  const toggleProductSelection = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
  };

  // Open SLA Configurator for a specific node (Product, Module, Submodule, or Global)
  const openSlaConfigurator = (target: {
    targetType: 'PRODUCT' | 'MODULE' | 'SUBMODULE' | 'GLOBAL';
    targetId?: string;
    targetName: string;
    productId?: string;
    productName?: string;
    moduleId?: string;
    moduleName?: string;
    submoduleId?: string;
    submoduleName?: string;
  }) => {
    setActiveSlaTarget(target);
    const existing = slaRules.find(
      (r) =>
        r.targetType === target.targetType &&
        ((target.submoduleId && r.submoduleId === target.submoduleId) ||
          (target.moduleId && r.moduleId === target.moduleId) ||
          (target.productId && r.productId === target.productId))
    );

    if (existing) {
      setSlaTierOption(existing.slaTier);
      setSlaPriority(existing.priority);
      setSlaResponseHours(existing.responseTimeHours);
      setSlaResolutionHours(existing.resolutionTimeHours);
      setSlaRuleNotes(existing.notes || '');
    } else {
      setSlaTierOption('24x7 Critical (1h / 4h)');
      setSlaPriority('ALL');
      setSlaResponseHours(1);
      setSlaResolutionHours(4);
      setSlaRuleNotes('');
    }
  };

  // Handle SLA tier preset selection
  const handleTierPresetChange = (tier: string) => {
    setSlaTierOption(tier);
    if (tier.includes('24x7 Critical')) {
      setSlaResponseHours(1);
      setSlaResolutionHours(4);
    } else if (tier.includes('8x5 Business')) {
      setSlaResponseHours(2);
      setSlaResolutionHours(8);
    } else if (tier.includes('Standard Support')) {
      setSlaResponseHours(4);
      setSlaResolutionHours(24);
    } else if (tier.includes('Basic Coverage')) {
      setSlaResponseHours(8);
      setSlaResolutionHours(48);
    }
  };

  // Save configured SLA Rule
  const handleSaveSlaRule = () => {
    if (!activeSlaTarget) return;

    const newRule: SLARule = {
      id: `${activeSlaTarget.targetType}_${activeSlaTarget.targetId || Date.now()}`,
      targetType: activeSlaTarget.targetType,
      targetId: activeSlaTarget.targetId,
      targetName: activeSlaTarget.targetName,
      productId: activeSlaTarget.productId,
      productName: activeSlaTarget.productName,
      moduleId: activeSlaTarget.moduleId,
      moduleName: activeSlaTarget.moduleName,
      submoduleId: activeSlaTarget.submoduleId,
      submoduleName: activeSlaTarget.submoduleName,
      slaTier: slaTierOption,
      priority: slaPriority,
      responseTimeHours: Number(slaResponseHours) || 1,
      resolutionTimeHours: Number(slaResolutionHours) || 4,
      notes: slaRuleNotes.trim() || undefined,
    };

    const filtered = slaRules.filter(
      (r) =>
        !(
          r.targetType === activeSlaTarget.targetType &&
          ((activeSlaTarget.submoduleId && r.submoduleId === activeSlaTarget.submoduleId) ||
            (activeSlaTarget.moduleId && r.moduleId === activeSlaTarget.moduleId) ||
            (activeSlaTarget.productId && r.productId === activeSlaTarget.productId))
        )
    );

    setSlaRules([...filtered, newRule]);
    setActiveSlaTarget(null);
  };

  // Delete an SLA rule
  const handleDeleteSlaRule = (ruleId: string) => {
    setSlaRules(slaRules.filter((r) => r.id !== ruleId));
  };

  // Find active SLA rule for a node
  const getRuleForNode = (
    type: 'PRODUCT' | 'MODULE' | 'SUBMODULE',
    id: string | undefined,
    pId?: string
  ) => {
    return slaRules.find((r) => {
      if (type === 'SUBMODULE' && r.submoduleId === id) return true;
      if (type === 'MODULE' && r.moduleId === id) return true;
      if (type === 'PRODUCT' && (r.productId === id || r.productId === pId)) return true;
      return false;
    });
  };

  // Submit complete AMC agreement registration
  const handleCreateAMC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a customer company first');
      return;
    }
    if (selectedProductIds.length === 0) {
      alert('Please select at least one customer purchased product to cover under this AMC');
      return;
    }
    if (!agreementName.trim() || !startDate || !expiryDate) {
      alert('Please fill in agreement name, start date, and expiry date');
      return;
    }

    setSubmitting(true);
    try {
      await api.createSubscription({
        companyId: selectedCustomer.id,
        agreementName: agreementName.trim(),
        startDate,
        expiryDate,
        ownerEmployeeId: ownerEmployeeId || undefined,
        notes: agreementNotes.trim() || undefined,
        productIds: selectedProductIds,
        products: selectedProductIds.map((pId) => {
          const prod = customerPurchasedProducts.find(
            (p) => (p.product_id || p.productId || p.id) === pId
          );
          return {
            productId: pId,
            planName: agreementName.trim(),
            startDate,
            expiryDate,
            notes: agreementNotes.trim() || undefined,
          };
        }),
        slaRules: slaRules.map((r) => ({
          targetType: r.targetType,
          targetId: r.targetId,
          targetName: r.targetName,
          productName: r.productName,
          moduleName: r.moduleName,
          submoduleName: r.submoduleName,
          slaTier: r.slaTier,
          priority: r.priority,
          responseTimeHours: r.responseTimeHours,
          resolutionTimeHours: r.resolutionTimeHours,
          notes: r.notes,
        })),
      });

      alert(`AMC Agreement "${agreementName}" successfully registered for ${selectedCustomer.company_name || selectedCustomer.companyName}!`);
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      alert(`Error creating AMC Agreement: ${err.message}`);
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
          <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
            RENEWED
          </span>
        );
      default:
        return <span className="badge">{sub.status}</span>;
    }
  };

  // Filtered customer list for search dropdown
  const filteredCustomers = companies.filter((c) => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.toLowerCase();
    const name = (c.company_name || c.companyName || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    const email = (c.primary_email || c.primaryEmail || '').toLowerCase();
    const contact = (c.contact_person || c.contactPerson || '').toLowerCase();
    return name.includes(q) || id.includes(q) || email.includes(q) || contact.includes(q);
  });

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck color="#0284c7" size={24} />
            Annual Maintenance & Subscriptions (AMC)
          </h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Customer-centric maintenance contracts, SLA rules, expiry tracking, and renewal workflows
          </div>
        </div>

        {isAdminOrManager && (
          <button
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            Register AMC Agreement
          </button>
        )}
      </div>

      {/* Metric Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Contracts</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{stats.total}</div>
          </div>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Covered</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 6 }}>{stats.active}</div>
          </div>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #d97706' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Expiring ≤ 30 Days</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706', marginTop: 6 }}>{stats.expiringSoon}</div>
          </div>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Expired / Lapsed</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', marginTop: 6 }}>{stats.expired}</div>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 34 }}
              placeholder="Search contract, customer, product code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: 160 }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring Soon (≤30d)</option>
              <option value="EXPIRED">Expired</option>
              <option value="RENEWED">Renewed</option>
            </select>
          </div>

          <div style={{ minWidth: 200 }}>
            <select
              className="form-control"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="ALL">All Customer Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.companyName} ({c.id})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} />
            Filter
          </button>
          <button type="button" className="btn btn-outline" onClick={() => { setSearch(''); setStatusFilter('ALL'); setCompanyFilter('ALL'); }} title="Reset Filters">
            <RefreshCw size={14} />
          </button>
        </form>
      </div>

      {/* Subscriptions Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: 8, display: 'inline-block' }} />
            <div>Loading maintenance plans...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
            <AlertCircle size={28} style={{ marginBottom: 8 }} />
            <div>{error}</div>
          </div>
        ) : subscriptions.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <h4 style={{ margin: 0, fontSize: 16, color: '#475569' }}>No Maintenance Subscriptions Found</h4>
            <p style={{ margin: '6px 0 16px', fontSize: 13 }}>
              {search || statusFilter !== 'ALL' || companyFilter !== 'ALL'
                ? 'Try adjusting your filters'
                : 'Register a new customer AMC agreement to start tracking SLA compliance and renewals.'}
            </p>
            {isAdminOrManager && (
              <button className="btn btn-primary btn-sm" onClick={handleOpenAddModal}>
                <Plus size={14} style={{ marginRight: 4 }} />
                Register AMC Agreement
              </button>
            )}
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Agreement ID</th>
                <th style={{ padding: '12px 16px' }}>Customer Company</th>
                <th style={{ padding: '12px 16px' }}>Product Suite</th>
                <th style={{ padding: '12px 16px' }}>SLA / Plan Tier</th>
                <th style={{ padding: '12px 16px' }}>Coverage Dates</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Warnings</th>
                {isAdminOrManager && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0284c7' }}>
                    {sub.id}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{sub.company_name || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub.company_id}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{sub.product_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub.product_category || 'Enterprise Application'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{sub.plan_name}</span>
                    {sub.owner_employee_name && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>Owner: {sub.owner_employee_name}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11 }}>Start: </span>
                      {formatDate(sub.start_date)}
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: 11 }}>Expires: </span>
                      <strong style={{ color: sub.status === 'EXPIRED' ? '#dc2626' : sub.status === 'EXPIRING_SOON' ? '#d97706' : '#0f172a' }}>
                        {formatDate(sub.expiry_date)}
                      </strong>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{getStatusBadge(sub)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {sub.warning_count > 0 ? (
                      <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: 11 }}>
                        {sub.warning_count} Dispatched
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
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

      {/* ========================================================================= */}
      {/* CUSTOMER-CENTRIC REGISTER AMC AGREEMENT MODAL                             */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 860,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div>
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
                  <ShieldCheck size={20} color="#0284c7" />
                  Customer-Centric AMC Agreement & SLA Registration
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Select a customer to load entitled product hierarchy and customize multi-tier SLA rules
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleCreateAMC} style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* SECTION 1: SEARCHABLE CUSTOMER SELECTOR */}
              <div style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8, display: 'block' }}>
                  1. Customer Company *
                </label>

                {!selectedCustomer ? (
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ paddingLeft: 38, height: 42, fontSize: 14 }}
                        placeholder="Type company name, CMP customer ID (e.g. Test Horizon / CMP-0033)..."
                        value={customerSearchQuery}
                        onFocus={() => setIsCustomerSearchOpen(true)}
                        onChange={(e) => {
                          setCustomerSearchQuery(e.target.value);
                          setIsCustomerSearchOpen(true);
                        }}
                      />
                    </div>

                    {isCustomerSearchOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          marginTop: 4,
                          maxHeight: 250,
                          overflowY: 'auto',
                          zIndex: 50,
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {filteredCustomers.length === 0 ? (
                          <div style={{ padding: 14, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                            No matching customer found for "{customerSearchQuery}"
                          </div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              style={{
                                padding: '10px 14px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#f8fafc')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#ffffff')}
                            >
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                                  {c.company_name || c.companyName}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                  {c.primary_email || c.primaryEmail} • {c.contact_person || c.contactPerson || 'Contact'}
                                </div>
                              </div>
                              <span
                                className="badge"
                                style={{
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {c.id}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      borderRadius: 8,
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Building2 color="#16a34a" size={24} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#14532d', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {selectedCustomer.company_name || selectedCustomer.companyName}
                          <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: 11 }}>
                            {selectedCustomer.id}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                          Primary Contact: {selectedCustomer.contact_person || selectedCustomer.contactPerson || 'Account SPOC'} • {selectedCustomer.primary_email || selectedCustomer.primaryEmail}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerPurchasedProducts([]);
                        setSelectedProductIds([]);
                      }}
                      style={{ fontSize: 12 }}
                    >
                      Change Customer
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 2: AGREEMENT GENERAL DETAILS */}
              {selectedCustomer && (
                <div style={{ marginBottom: 24, background: '#f8fafc', padding: 18, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sliders size={15} color="#0284c7" />
                    2. Agreement & Contract Parameters
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 11 }}>Agreement / Plan Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={agreementName}
                        onChange={(e) => setAgreementName(e.target.value)}
                        placeholder="e.g. Enterprise Support AMC 2026"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 11 }}>Start Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 11 }}>Expiry Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 11 }}>Account Manager / Owner</label>
                      <select
                        className="form-control"
                        value={ownerEmployeeId}
                        onChange={(e) => setOwnerEmployeeId(e.target.value)}
                      >
                        <option value="">-- Unassigned / Support Desk --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.level || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 11 }}>Agreement Notes / Terms</label>
                      <input
                        type="text"
                        className="form-control"
                        value={agreementNotes}
                        onChange={(e) => setAgreementNotes(e.target.value)}
                        placeholder="e.g. 24x7 support for core ERP, Standard support for HRMS..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: PURCHASED PRODUCTS & SLA CONFIGURATION HIERARCHY */}
              {selectedCustomer && (
                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Customer Products & SLA Configuration
                      </h4>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Only purchased & entitled modules are visible. Click [ Configure SLA ] on any product, module, or submodule.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() =>
                        openSlaConfigurator({
                          targetType: 'GLOBAL',
                          targetName: `${selectedCustomer.company_name || selectedCustomer.companyName} (All Products)`,
                        })
                      }
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={12} />
                      + Add Global SLA Rule
                    </button>
                  </div>

                  {loadingCustomerHierarchy ? (
                    <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw size={20} className="spin" style={{ marginBottom: 8, display: 'inline-block' }} />
                      <div>Loading customer purchased product hierarchy...</div>
                    </div>
                  ) : customerPurchasedProducts.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        textAlign: 'center',
                      }}
                    >
                      <AlertTriangle color="#dc2626" size={24} style={{ marginBottom: 6 }} />
                      <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>
                        No Purchased Products Found for this Customer
                      </div>
                      <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 4 }}>
                        This customer does not have any active purchased products assigned in Customer Master yet.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {customerPurchasedProducts.map((prod) => {
                        const prodId = prod.product_id || prod.productId || prod.id;
                        const isSelected = selectedProductIds.includes(prodId);
                        const prodRule = getRuleForNode('PRODUCT', prodId);

                        return (
                          <div
                            key={prodId}
                            style={{
                              border: isSelected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                              borderRadius: 8,
                              background: isSelected ? '#ffffff' : '#f8fafc',
                              overflow: 'hidden',
                              boxShadow: isSelected ? '0 2px 4px rgba(0,0,0,0.04)' : 'none',
                            }}
                          >
                            {/* Product Header */}
                            <div
                              style={{
                                padding: '12px 16px',
                                background: isSelected ? '#eff6ff' : '#f1f5f9',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                  type="checkbox"
                                  id={`prod_chk_${prodId}`}
                                  checked={isSelected}
                                  onChange={() => toggleProductSelection(prodId)}
                                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                                />
                                <label
                                  htmlFor={`prod_chk_${prodId}`}
                                  style={{
                                    margin: 0,
                                    fontWeight: 700,
                                    fontSize: 14,
                                    color: '#0f172a',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <Package size={16} color="#0284c7" />
                                  {prod.name || prod.code}
                                  <span
                                    className="badge"
                                    style={{
                                      background: '#dbeafe',
                                      color: '#1e40af',
                                      fontSize: 11,
                                    }}
                                  >
                                    {prod.code || prodId}
                                  </span>
                                  {prod.purchase_type === 'SELECTED_MODULES' && (
                                    <span
                                      className="badge"
                                      style={{
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        fontSize: 10,
                                      }}
                                    >
                                      Custom Module Entitlement
                                    </span>
                                  )}
                                </label>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {prodRule && (
                                  <span
                                    className="badge"
                                    style={{
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    SLA: {prodRule.slaTier} ({prodRule.responseTimeHours}h/{prodRule.resolutionTimeHours}h)
                                  </span>
                                )}

                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  disabled={!isSelected}
                                  onClick={() =>
                                    openSlaConfigurator({
                                      targetType: 'PRODUCT',
                                      targetId: prodId,
                                      targetName: prod.name,
                                      productId: prodId,
                                      productName: prod.name,
                                    })
                                  }
                                  style={{ fontSize: 11, fontWeight: 600 }}
                                >
                                  Configure Product SLA
                                </button>
                              </div>
                            </div>

                            {/* Product Modules & Submodules Tree */}
                            {isSelected && (
                              <div style={{ padding: '14px 16px' }}>
                                {(!prod.modules || prod.modules.length === 0) ? (
                                  <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                                    Standard full product coverage (no custom submodules defined).
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {prod.modules.map((mod: any) => {
                                      const modRule = getRuleForNode('MODULE', mod.id);

                                      return (
                                        <div
                                          key={mod.id}
                                          style={{
                                            paddingLeft: 12,
                                            borderLeft: '2px solid #cbd5e1',
                                          }}
                                        >
                                          {/* Module Line */}
                                          <div
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '4px 0',
                                            }}
                                          >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <Layers size={14} color="#64748b" />
                                              <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                                                {mod.name}
                                              </span>
                                              {mod.description && (
                                                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                                  — {mod.description}
                                                </span>
                                              )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              {modRule && (
                                                <span
                                                  className="badge"
                                                  style={{
                                                    background: '#e0f2fe',
                                                    color: '#0369a1',
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  SLA: {modRule.slaTier}
                                                </span>
                                              )}
                                              <button
                                                type="button"
                                                className="btn btn-outline btn-xs"
                                                onClick={() =>
                                                  openSlaConfigurator({
                                                    targetType: 'MODULE',
                                                    targetId: mod.id,
                                                    targetName: `${prod.name} → ${mod.name}`,
                                                    productId: prodId,
                                                    productName: prod.name,
                                                    moduleId: mod.id,
                                                    moduleName: mod.name,
                                                  })
                                                }
                                                style={{ fontSize: 10, padding: '2px 8px' }}
                                              >
                                                Configure SLA
                                              </button>
                                            </div>
                                          </div>

                                          {/* Submodules List */}
                                          {mod.submodules && mod.submodules.length > 0 && (
                                            <div style={{ paddingLeft: 20, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                              {mod.submodules.map((submod: any) => {
                                                const subRule = getRuleForNode('SUBMODULE', submod.id);

                                                return (
                                                  <div
                                                    key={submod.id}
                                                    style={{
                                                      display: 'flex',
                                                      justifyContent: 'space-between',
                                                      alignItems: 'center',
                                                      padding: '2px 0',
                                                      fontSize: 12,
                                                    }}
                                                  >
                                                    <div style={{ color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                      <span style={{ color: '#94a3b8' }}>↳</span>
                                                      <span>{submod.name}</span>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                      {subRule && (
                                                        <span
                                                          className="badge"
                                                          style={{
                                                            background: '#fef3c7',
                                                            color: '#92400e',
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                          }}
                                                        >
                                                          SLA: {subRule.slaTier}
                                                        </span>
                                                      )}
                                                      <button
                                                        type="button"
                                                        className="btn btn-outline btn-xs"
                                                        onClick={() =>
                                                          openSlaConfigurator({
                                                            targetType: 'SUBMODULE',
                                                            targetId: submod.id,
                                                            targetName: `${prod.name} → ${mod.name} → ${submod.name}`,
                                                            productId: prodId,
                                                            productName: prod.name,
                                                            moduleId: mod.id,
                                                            moduleName: mod.name,
                                                            submoduleId: submod.id,
                                                            submoduleName: submod.name,
                                                          })
                                                        }
                                                        style={{ fontSize: 10, padding: '1px 6px' }}
                                                      >
                                                        Configure SLA
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 4: CONFIGURED SLA RULES SUMMARY */}
              {selectedCustomer && slaRules.length > 0 && (
                <div style={{ marginBottom: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={15} color="#16a34a" />
                    Configured Agreement SLA Rules ({slaRules.length})
                  </div>

                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Target Scope</th>
                        <th style={{ padding: '6px 8px' }}>SLA Tier</th>
                        <th style={{ padding: '6px 8px' }}>Priority</th>
                        <th style={{ padding: '6px 8px' }}>Response / Resolution</th>
                        <th style={{ padding: '6px 8px' }}>Notes</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaRules.map((rule) => (
                        <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e293b' }}>
                            {rule.targetName}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: 11 }}>
                              {rule.slaTier}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', color: '#475569' }}>{rule.priority}</td>
                          <td style={{ padding: '6px 8px', color: '#0f172a' }}>
                            {rule.responseTimeHours}h resp / {rule.resolutionTimeHours}h res
                          </td>
                          <td style={{ padding: '6px 8px', color: '#64748b', fontSize: 11 }}>
                            {rule.notes || '—'}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteSlaRule(rule.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Submit Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !selectedCustomer || selectedProductIds.length === 0}
                  style={{ minWidth: 150 }}
                >
                  {submitting ? 'Registering...' : 'Register AMC Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SLA CONFIGURATOR MODAL / DRAWER                                           */}
      {/* ========================================================================= */}
      {activeSlaTarget && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 480,
              padding: 22,
              background: '#ffffff',
              borderRadius: 10,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sliders size={18} color="#0284c7" />
                  Configure SLA Rule
                </h4>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Target: <strong>{activeSlaTarget.targetName}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlaTarget(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  SLA Tier Preset
                </label>
                <select
                  className="form-control"
                  value={slaTierOption}
                  onChange={(e) => handleTierPresetChange(e.target.value)}
                >
                  <option value="24x7 Critical (1h / 4h)">24x7 Critical (Response: 1h, Resolution: 4h)</option>
                  <option value="8x5 Business (2h / 8h)">8x5 Business (Response: 2h, Resolution: 8h)</option>
                  <option value="Standard Support (4h / 24h)">Standard Support (Response: 4h, Resolution: 24h)</option>
                  <option value="Basic Coverage (8h / 48h)">Basic Coverage (Response: 8h, Resolution: 48h)</option>
                  <option value="Custom SLA">Custom SLA Definition</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                    Response Time (Hours)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    className="form-control"
                    value={slaResponseHours}
                    onChange={(e) => setSlaResponseHours(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                    Resolution Time (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    className="form-control"
                    value={slaResolutionHours}
                    onChange={(e) => setSlaResolutionHours(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Applicable Ticket Priority
                </label>
                <select
                  className="form-control"
                  value={slaPriority}
                  onChange={(e) => setSlaPriority(e.target.value)}
                >
                  <option value="ALL">All Priorities (Default)</option>
                  <option value="HIGH">High / Critical Priority Only</option>
                  <option value="MEDIUM">Medium Priority Only</option>
                  <option value="LOW">Low Priority Only</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  SLA Scope Remarks
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Includes weekend coverage and dedicated escalation engineer"
                  value={slaRuleNotes}
                  onChange={(e) => setSlaRuleNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveSlaTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSlaRule}
                >
                  Apply Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WARNING MODAL                                                             */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* RENEWAL MODAL                                                             */}
      {/* ========================================================================= */}
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
