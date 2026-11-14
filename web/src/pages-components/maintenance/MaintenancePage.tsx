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
  CheckCircle2,
  Clock,
  FileText,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  DollarSign,
  Check,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

interface Subscription {
  id: string;
  agreement_id?: string;
  agreementId?: string;
  company_id: string;
  companyId?: string;
  company_name: string | null;
  companyName?: string | null;
  company_email: string | null;
  companyEmail?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  product_id: string;
  productId?: string;
  product_name: string | null;
  productName?: string | null;
  product_category: string | null;
  productCategory?: string | null;
  plan_name: string;
  planName?: string;
  start_date: string;
  startDate?: string;
  expiry_date: string;
  expiryDate?: string;
  renewal_date: string | null;
  renewalDate?: string | null;
  days_remaining: number;
  daysRemaining?: number;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED' | 'DRAFT' | 'SUSPENDED' | 'CANCELLED';
  owner_employee_id?: string | null;
  owner_employee_name: string | null;
  ownerEmployeeName?: string | null;
  notes: string | null;
  rawNotes?: string | null;
  last_warning_sent_at: string | null;
  lastWarningSentAt?: string | null;
  warning_count: number;
  warningCount?: number;
  created_at: string;
  createdAt?: string;
  contractAmount?: number | null;
  currency?: string;
  taxRate?: number;
  totalAmount?: number | null;
  billingFrequency?: string;
  paymentTerms?: string;
  renewalType?: string;
  coverageType?: string;
  preventiveVisits?: number;
  supportTeam?: string;
  contractMeta?: any;
}

interface AmcPlan {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string;
  coverageType: string;
  supportAvailability: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  preventiveMaintenanceFrequency: string;
  includedVisits: number;
  remoteSupport: boolean;
  onsiteSupport: boolean;
  partsCoverage: boolean;
  exclusions: string;
  pricingModel: string;
  price: number;
  billingFrequency: string;
  defaultDurationMonths: number;
  applicableProducts: string[];
  inclusions: string[];
  slaRules: any[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const MaintenancePage: React.FC = () => {
  const { user, hasPermission } = useAuth();

  const isPlatformSuper =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'PLATFORM_INCHARGE' ||
    Boolean(user?.isPlatformIncharge) ||
    Boolean(user?.isSuperAdmin);

  const canCreate = isPlatformSuper || hasPermission('amc.create');
  const canManagePlans = isPlatformSuper || hasPermission('amc.manage_plans') || canCreate;
  const canRenew = isPlatformSuper || hasPermission('amc.renew') || hasPermission('amc.update') || canCreate;
  const canDelete = isPlatformSuper || hasPermission('amc.delete');

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [amcPlans, setAmcPlans] = useState<AmcPlan[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // --- Modal States ---
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [detailTarget, setDetailTarget] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [warningTarget, setWarningTarget] = useState<Subscription | null>(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);
  const [renewExpiryDate, setRenewExpiryDate] = useState('');
  const [renewPlanName, setRenewPlanName] = useState('');
  const [renewAmount, setRenewAmount] = useState<number | ''>('');
  const [renewPoNumber, setRenewPoNumber] = useState('');
  const [renewNotes, setRenewNotes] = useState('');

  // --- AMC Plan Creator / Editor Modal State ---
  const [showPlanEditModal, setShowPlanEditModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AmcPlan | null>(null);
  const [planForm, setPlanForm] = useState<{
    name: string;
    code: string;
    description: string;
    coverageType: string;
    supportAvailability: string;
    responseTimeHours: number;
    resolutionTimeHours: number;
    preventiveMaintenanceFrequency: string;
    includedVisits: number;
    remoteSupport: boolean;
    onsiteSupport: boolean;
    partsCoverage: boolean;
    exclusions: string;
    pricingModel: string;
    price: number;
    billingFrequency: string;
    defaultDurationMonths: number;
    isActive: boolean;
  }>({
    name: '',
    code: '',
    description: '',
    coverageType: 'COMPREHENSIVE',
    supportAvailability: 'BUSINESS_HOURS',
    responseTimeHours: 4,
    resolutionTimeHours: 24,
    preventiveMaintenanceFrequency: 'QUARTERLY',
    includedVisits: 4,
    remoteSupport: true,
    onsiteSupport: true,
    partsCoverage: false,
    exclusions: '',
    pricingModel: 'FIXED',
    price: 50000,
    billingFrequency: 'ANNUAL',
    defaultDurationMonths: 12,
    isActive: true,
  });

  // --- Create Contract Wizard State (5 Steps) ---
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCustomer, setWizardCustomer] = useState<any | null>(null);
  const [customerProducts, setCustomerProducts] = useState<any[]>([]);
  const [loadingCustomerProducts, setLoadingCustomerProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [contractStartDate, setContractStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractDurationMonths, setContractDurationMonths] = useState(12);
  const [contractExpiryDate, setContractExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [contractPlanName, setContractPlanName] = useState('Enterprise SLA Plan');
  const [contractAmount, setContractAmount] = useState<number>(75000);
  const [contractCurrency, setContractCurrency] = useState('INR');
  const [contractTaxRate, setContractTaxRate] = useState<number>(18);
  const [contractBillingFrequency, setContractBillingFrequency] = useState('ANNUAL');
  const [contractPaymentTerms, setContractPaymentTerms] = useState('Net 30');
  const [contractRenewalType, setContractRenewalType] = useState('MANUAL');
  const [contractOwnerEmployeeId, setContractOwnerEmployeeId] = useState('');
  const [contractSupportTeam, setContractSupportTeam] = useState('L2 Support Team');
  const [contractCoverageType, setContractCoverageType] = useState('COMPREHENSIVE');
  const [contractPmVisits, setContractPmVisits] = useState(4);
  const [contractPmFrequency, setContractPmFrequency] = useState('QUARTERLY');
  const [contractRemoteSupport, setContractRemoteSupport] = useState(true);
  const [contractOnsiteSupport, setContractOnsiteSupport] = useState(true);
  const [contractBreakdownSupport, setContractBreakdownSupport] = useState(true);
  const [contractSoftwareUpdates, setContractSoftwareUpdates] = useState(true);
  const [contractPartsCoverage, setContractPartsCoverage] = useState(false);
  const [contractExclusions, setContractExclusions] = useState('Hardware physical damage and third-party tampering.');
  const [contractNotes, setContractNotes] = useState('');
  const [contractStatus, setContractStatus] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');

  const [submitting, setSubmitting] = useState(false);

  // Fetch all maintenance data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (companyFilter !== 'ALL') params.companyId = companyFilter;

      const [subRes, plansRes, compRes, empRes, statsRes] = await Promise.all([
        api.getSubscriptions(params),
        api.getAmcPlans().catch(() => ({ data: [] })),
        api.getCompanies({ limit: 150 }).catch(() => ({ data: [] })),
        api.getEmployees({ limit: 100 }).catch(() => ({ data: [] })),
        api.getSubscriptionStats().catch(() => ({ stats: null })),
      ]);

      setSubscriptions(subRes.data || []);
      setAmcPlans(plansRes.data || []);
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

  // --- Dynamic calculation of expiry date based on start date & duration ---
  const updateExpiryFromDuration = (startDateStr: string, durationMonths: number) => {
    if (!startDateStr) return;
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return;
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + Number(durationMonths));
    setContractExpiryDate(expiry.toISOString().split('T')[0]);
  };

  // --- Handle Customer Selection in Create Wizard ---
  const handleWizardCustomerSelect = async (companyId: string) => {
    const found = companies.find((c) => c.id === companyId);
    setWizardCustomer(found || null);
    setSelectedProductId('');
    setCustomerProducts([]);
    if (!companyId) return;

    setLoadingCustomerProducts(true);
    try {
      const res = await api.getCustomerImplementationProducts(companyId);
      const prods = res.products || res.data || [];
      setCustomerProducts(prods);
      if (prods.length > 0) {
        setSelectedProductId(prods[0].id);
      }
    } catch (err: any) {
      console.warn('Could not fetch customer-mapped products:', err);
    } finally {
      setLoadingCustomerProducts(false);
    }
  };

  // --- Handle Plan Selection in Create Wizard ---
  const handleWizardPlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = amcPlans.find((p) => p.id === planId);
    if (!plan) return;

    setContractPlanName(plan.name);
    setContractAmount(plan.price);
    setContractBillingFrequency(plan.billingFrequency || 'ANNUAL');
    setContractCoverageType(plan.coverageType || 'COMPREHENSIVE');
    setContractDurationMonths(plan.defaultDurationMonths || 12);
    setContractPmVisits(plan.includedVisits || 4);
    setContractPmFrequency(plan.preventiveMaintenanceFrequency || 'QUARTERLY');
    setContractRemoteSupport(plan.remoteSupport);
    setContractOnsiteSupport(plan.onsiteSupport);
    setContractPartsCoverage(plan.partsCoverage);
    setContractExclusions(plan.exclusions || '');
    updateExpiryFromDuration(contractStartDate, plan.defaultDurationMonths || 12);
  };

  // --- Open Create Contract Wizard ---
  const handleOpenCreateWizard = () => {
    setWizardStep(1);
    setWizardCustomer(null);
    setCustomerProducts([]);
    setSelectedProductId('');
    setSelectedPlanId('');
    setContractPlanName('Enterprise SLA Plan 2026');
    setContractStartDate(new Date().toISOString().split('T')[0]);
    setContractDurationMonths(12);
    updateExpiryFromDuration(new Date().toISOString().split('T')[0], 12);
    setContractAmount(75000);
    setContractCurrency('INR');
    setContractTaxRate(18);
    setContractBillingFrequency('ANNUAL');
    setContractPaymentTerms('Net 30');
    setContractRenewalType('MANUAL');
    setContractOwnerEmployeeId('');
    setContractSupportTeam('L2 Support Team');
    setContractCoverageType('COMPREHENSIVE');
    setContractPmVisits(4);
    setContractPmFrequency('QUARTERLY');
    setContractRemoteSupport(true);
    setContractOnsiteSupport(true);
    setContractBreakdownSupport(true);
    setContractSoftwareUpdates(true);
    setContractPartsCoverage(false);
    setContractExclusions('Hardware physical damage, flood/fire damage, uncertified third-party interventions.');
    setContractNotes('');
    setContractStatus('ACTIVE');
    setShowCreateWizard(true);
  };

  // --- Submit Create Contract Wizard ---
  const handleCreateContractSubmit = async () => {
    if (!wizardCustomer) {
      alert('Please select a customer company.');
      return;
    }
    if (!selectedProductId) {
      alert('Please select an applicable product.');
      return;
    }
    if (!contractStartDate || !contractExpiryDate) {
      alert('Start date and expiry date are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyId: wizardCustomer.id,
        productId: selectedProductId,
        planName: contractPlanName.trim(),
        planId: selectedPlanId || null,
        startDate: contractStartDate,
        expiryDate: contractExpiryDate,
        contractAmount: Number(contractAmount),
        currency: contractCurrency,
        taxRate: Number(contractTaxRate),
        billingFrequency: contractBillingFrequency,
        paymentTerms: contractPaymentTerms,
        renewalType: contractRenewalType,
        ownerEmployeeId: contractOwnerEmployeeId || null,
        supportTeam: contractSupportTeam,
        coverageType: contractCoverageType,
        preventiveVisits: Number(contractPmVisits),
        pmFrequency: contractPmFrequency,
        remoteSupport: contractRemoteSupport,
        onsiteSupport: contractOnsiteSupport,
        breakdownSupport: contractBreakdownSupport,
        softwareUpdates: contractSoftwareUpdates,
        partsCoverage: contractPartsCoverage,
        exclusions: contractExclusions,
        notes: contractNotes,
        status: contractStatus,
      };

      const res = await api.createSubscription(payload);
      if (res.success || res.subscription) {
        setShowCreateWizard(false);
        await fetchData();
      } else {
        alert(res.error || 'Failed to create AMC contract');
      }
    } catch (err: any) {
      alert(`Error creating AMC Contract: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- View Contract Details ---
  const handleOpenDetailModal = async (sub: Subscription) => {
    setDetailLoading(true);
    setDetailTarget(sub);
    try {
      const res = await api.getSubscription(sub.id);
      if (res.subscription) {
        setDetailTarget(res.subscription);
      }
    } catch (err: any) {
      console.warn('Failed to load full subscription details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Send Warning ---
  const openWarningModal = (sub: Subscription) => {
    setWarningTarget(sub);
    setWarningMessage(
      `Your AMC subscription for ${sub.product_name} (${sub.plan_name}) expires on ${formatDate(
        sub.expiry_date
      )}. Please contact your account representative to renew and avoid service interruptions.`
    );
  };

  const handleSendWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningTarget) return;
    setSubmitting(true);
    try {
      const res = await api.sendSubscriptionWarning(warningTarget.id, warningMessage);
      if (res.success) {
        setWarningTarget(null);
        fetchData();
      } else {
        alert(res.error || 'Failed to dispatch renewal reminder');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Renew Modal ---
  const openRenewModal = (sub: Subscription) => {
    setRenewTarget(sub);
    const currExpiry = new Date(sub.expiry_date);
    const nextYear = new Date(currExpiry);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setRenewExpiryDate(nextYear.toISOString().split('T')[0]);
    setRenewPlanName(sub.plan_name);
    setRenewAmount(sub.contractAmount || 75000);
    setRenewPoNumber('');
    setRenewNotes('');
  };

  const handleApplyRenewShortcut = (months: number) => {
    if (!renewTarget) return;
    const currExpiry = new Date(renewTarget.expiry_date);
    const updated = new Date(currExpiry);
    updated.setMonth(updated.getMonth() + months);
    setRenewExpiryDate(updated.toISOString().split('T')[0]);
  };

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget) return;
    setSubmitting(true);
    try {
      const res = await api.renewSubscription(renewTarget.id, {
        newExpiryDate: renewExpiryDate,
        planName: renewPlanName.trim(),
        amount: renewAmount !== '' ? Number(renewAmount) : undefined,
        poNumber: renewPoNumber.trim() || undefined,
        notes: renewNotes.trim(),
      });
      if (res.success || res.subscription) {
        setRenewTarget(null);
        if (detailTarget?.id === renewTarget.id) {
          setDetailTarget(res.subscription);
        }
        fetchData();
      } else {
        alert(res.error || 'Failed to renew subscription');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- Plan Management Handlers ---
  const openNewPlanModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      code: '',
      description: '',
      coverageType: 'COMPREHENSIVE',
      supportAvailability: 'BUSINESS_HOURS',
      responseTimeHours: 4,
      resolutionTimeHours: 24,
      preventiveMaintenanceFrequency: 'QUARTERLY',
      includedVisits: 4,
      remoteSupport: true,
      onsiteSupport: true,
      partsCoverage: false,
      exclusions: '',
      pricingModel: 'FIXED',
      price: 60000,
      billingFrequency: 'ANNUAL',
      defaultDurationMonths: 12,
      isActive: true,
    });
    setShowPlanEditModal(true);
  };

  const openEditPlanModal = (plan: AmcPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      code: plan.code,
      description: plan.description,
      coverageType: plan.coverageType,
      supportAvailability: plan.supportAvailability,
      responseTimeHours: plan.responseTimeHours,
      resolutionTimeHours: plan.resolutionTimeHours,
      preventiveMaintenanceFrequency: plan.preventiveMaintenanceFrequency,
      includedVisits: plan.includedVisits,
      remoteSupport: plan.remoteSupport,
      onsiteSupport: plan.onsiteSupport,
      partsCoverage: plan.partsCoverage,
      exclusions: plan.exclusions,
      pricingModel: plan.pricingModel,
      price: plan.price,
      billingFrequency: plan.billingFrequency,
      defaultDurationMonths: plan.defaultDurationMonths,
      isActive: plan.isActive,
    });
    setShowPlanEditModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name || !planForm.code) {
      alert('Plan name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingPlan) {
        await api.updateAmcPlan(editingPlan.id, planForm);
      } else {
        await api.createAmcPlan(planForm);
      }
      setShowPlanEditModal(false);
      const updated = await api.getAmcPlans();
      setAmcPlans(updated.data || []);
    } catch (err: any) {
      alert(`Error saving AMC plan: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicatePlan = async (planId: string) => {
    try {
      await api.duplicateAmcPlan(planId);
      const updated = await api.getAmcPlans();
      setAmcPlans(updated.data || []);
    } catch (err: any) {
      alert(`Error duplicating plan: ${err.message}`);
    }
  };

  const handleTogglePlan = async (planId: string) => {
    try {
      await api.toggleAmcPlan(planId);
      const updated = await api.getAmcPlans();
      setAmcPlans(updated.data || []);
    } catch (err: any) {
      alert(`Error updating plan status: ${err.message}`);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this AMC policy plan?')) return;
    try {
      await api.deleteAmcPlan(planId);
      const updated = await api.getAmcPlans();
      setAmcPlans(updated.data || []);
    } catch (err: any) {
      alert(`Error deleting plan: ${err.message}`);
    }
  };

  // --- Status Badge Helper ---
  const getStatusBadge = (sub: Subscription) => {
    const st = String(sub.status || '').toUpperCase();
    switch (st) {
      case 'ACTIVE':
        return (
          <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
            ACTIVE
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
            EXPIRING SOON ({sub.days_remaining ?? sub.daysRemaining}d)
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
      case 'DRAFT':
        return (
          <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
            DRAFT
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="badge" style={{ background: '#ffedd5', color: '#c2410c', fontWeight: 600 }}>
            SUSPENDED
          </span>
        );
      default:
        return <span className="badge badge-secondary">{sub.status}</span>;
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 32px' }}>
      {/* ========================================================================= */}
      {/* PAGE HEADER                                                               */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <ShieldCheck color="#0284c7" size={24} />
            Annual Maintenance & Subscriptions (AMC)
          </h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Customer-centric maintenance contracts, SLA rules, expiry tracking, and renewal workflows
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canManagePlans && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowPlansModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
                padding: '9px 16px',
                borderRadius: 8,
              }}
            >
              <Layers size={16} />
              AMC Plans
            </button>
          )}

          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateWizard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
                padding: '9px 18px',
                borderRadius: 8,
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
              }}
            >
              <Plus size={16} />
              Create AMC Contract
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STAT CARDS                                                                */}
      {/* ========================================================================= */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Total Contracts
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{stats.total}</div>
          </div>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Active Covered
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 6 }}>{stats.active}</div>
          </div>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #d97706' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Expiring ≤ 30 Days
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706', marginTop: 6 }}>{stats.expiringSoon}</div>
          </div>
          <div className="card" style={{ padding: 18, borderLeft: '4px solid #dc2626' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Expired / Lapsed
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', marginTop: 6 }}>{stats.expired}</div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FILTER & SEARCH BAR                                                       */}
      {/* ========================================================================= */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 34 }}
              placeholder="Search contract ID, customer, product or plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: 160 }}>
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Covered</option>
              <option value="EXPIRING_SOON">Expiring Soon (≤30d)</option>
              <option value="RENEWED">Renewed</option>
              <option value="EXPIRED">Expired / Lapsed</option>
              <option value="DRAFT">Draft</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <select className="form-control" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
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
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setCompanyFilter('ALL');
            }}
            title="Reset Filters"
          >
            <RefreshCw size={14} />
          </button>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* CONTRACTS TABLE                                                           */}
      {/* ========================================================================= */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: 8, display: 'inline-block' }} />
            <div>Loading maintenance contracts...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
            <AlertCircle size={28} style={{ marginBottom: 8 }} />
            <div>{error}</div>
          </div>
        ) : subscriptions.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <h4 style={{ margin: 0, fontSize: 16, color: '#475569' }}>No AMC Contracts Found</h4>
            <p style={{ margin: '6px 0 16px', fontSize: 13 }}>
              {search || statusFilter !== 'ALL' || companyFilter !== 'ALL'
                ? 'Try adjusting your search filters'
                : 'Create a new customer AMC contract to track coverage, SLA response times, and renewal lifecycles.'}
            </p>
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={handleOpenCreateWizard}>
                <Plus size={14} style={{ marginRight: 4 }} />
                Create AMC Contract
              </button>
            )}
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#475569',
                }}
              >
                <th style={{ padding: '12px 16px' }}>Agreement ID</th>
                <th style={{ padding: '12px 16px' }}>Customer Company</th>
                <th style={{ padding: '12px 16px' }}>Product Suite</th>
                <th style={{ padding: '12px 16px' }}>SLA / Plan Tier</th>
                <th style={{ padding: '12px 16px' }}>Coverage Dates</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Warnings</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    <button
                      onClick={() => handleOpenDetailModal(sub)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0284c7',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 13,
                        textDecoration: 'underline',
                      }}
                      title="View Contract Details"
                    >
                      {sub.id}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{sub.company_name || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{sub.company_id}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{sub.product_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {sub.product_category || 'Enterprise Application'}
                    </div>
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
                      <strong
                        style={{
                          color:
                            sub.status === 'EXPIRED'
                              ? '#dc2626'
                              : sub.status === 'EXPIRING_SOON'
                              ? '#d97706'
                              : '#0f172a',
                        }}
                      >
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
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => handleOpenDetailModal(sub)}
                        title="View Full Contract Details"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={12} color="#0284c7" />
                        Details
                      </button>

                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => openWarningModal(sub)}
                        title="Send Renewal Reminder Warning"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Send size={11} color="#d97706" />
                        Warn
                      </button>

                      {canRenew && (
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => openRenewModal(sub)}
                          title="Renew Maintenance Contract"
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <RotateCw size={11} />
                          Renew
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: AMC PLANS MANAGEMENT MODAL                                       */}
      {/* ========================================================================= */}
      {showPlansModal && (
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
              maxWidth: 960,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers color="#0284c7" size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    AMC Plans & SLA Policies
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Standardized contract templates, coverage matrices, response SLAs, and maintenance frequencies
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openNewPlanModal}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} />
                  Create New Plan
                </button>
                <button
                  onClick={() => setShowPlansModal(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Plans List */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {amcPlans.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <Layers size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <div>No AMC Plans configured yet. Click "+ Create New Plan" to configure a template.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {amcPlans.map((plan) => (
                    <div
                      key={plan.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: 18,
                        background: plan.isActive ? '#ffffff' : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        opacity: plan.isActive ? 1 : 0.7,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span
                            className="badge"
                            style={{
                              background: plan.isActive ? '#dcfce7' : '#e2e8f0',
                              color: plan.isActive ? '#15803d' : '#64748b',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{plan.code}</span>
                        </div>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                          {plan.name}
                        </h4>
                        <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                          {plan.description || 'Standard SLA maintenance policy template.'}
                        </p>

                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Coverage Type:</span>
                            <strong style={{ color: '#334155' }}>{plan.coverageType}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Response SLA:</span>
                            <strong style={{ color: '#0284c7' }}>{plan.responseTimeHours}h Response</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Resolution SLA:</span>
                            <strong style={{ color: '#0284c7' }}>{plan.resolutionTimeHours}h Resolution</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>PM Visits:</span>
                            <strong style={{ color: '#334155' }}>{plan.includedVisits} / yr ({plan.preventiveMaintenanceFrequency})</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Price:</span>
                            <strong style={{ color: '#16a34a' }}>₹{plan.price.toLocaleString()} / {plan.billingFrequency}</strong>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: 12,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleTogglePlan(plan.id)}
                          title="Toggle Active/Inactive"
                        >
                          {plan.isActive ? 'Deactivate' : 'Activate'}
                        </button>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => handleDuplicatePlan(plan.id)}
                            title="Duplicate Plan"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => openEditPlanModal(plan)}
                            title="Edit Plan"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => handleDeletePlan(plan.id)}
                            title="Delete Plan"
                            style={{ color: '#dc2626' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={() => setShowPlansModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1B: CREATE / EDIT PLAN SUB-MODAL                                    */}
      {/* ========================================================================= */}
      {showPlanEditModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
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
              maxWidth: 720,
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              background: '#ffffff',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New AMC Plan'}
              </h3>
              <button
                onClick={() => setShowPlanEditModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Plan Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      placeholder="e.g. Standard Support AMC"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Plan Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={planForm.code}
                      onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. AMC-STD"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    placeholder="Brief description of coverage and support scope..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Coverage Type
                    </label>
                    <select
                      className="form-control"
                      value={planForm.coverageType}
                      onChange={(e) => setPlanForm({ ...planForm, coverageType: e.target.value })}
                    >
                      <option value="COMPREHENSIVE">Comprehensive (Labor + Parts)</option>
                      <option value="NON_COMPREHENSIVE">Non-Comprehensive (Labor Only)</option>
                      <option value="LABOUR_ONLY">Labour Only</option>
                      <option value="PARTS_ONLY">Parts Only</option>
                      <option value="CUSTOM">Custom Scope</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Support Availability
                    </label>
                    <select
                      className="form-control"
                      value={planForm.supportAvailability}
                      onChange={(e) => setPlanForm({ ...planForm, supportAvailability: e.target.value })}
                    >
                      <option value="BUSINESS_HOURS">Standard Business Hours (8x5)</option>
                      <option value="EXTENDED_HOURS">Extended Support (12x6)</option>
                      <option value="24X7">24x7 Round-the-Clock Critical</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Response SLA (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="form-control"
                      value={planForm.responseTimeHours}
                      onChange={(e) => setPlanForm({ ...planForm, responseTimeHours: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Resolution SLA (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      className="form-control"
                      value={planForm.resolutionTimeHours}
                      onChange={(e) => setPlanForm({ ...planForm, resolutionTimeHours: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Preventive Maintenance Frequency
                    </label>
                    <select
                      className="form-control"
                      value={planForm.preventiveMaintenanceFrequency}
                      onChange={(e) => setPlanForm({ ...planForm, preventiveMaintenanceFrequency: e.target.value })}
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="HALF_YEARLY">Half-Yearly</option>
                      <option value="ANNUALLY">Annually</option>
                      <option value="AS_NEEDED">On Demand / As Needed</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Included PM Visits / Year
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={planForm.includedVisits}
                      onChange={(e) => setPlanForm({ ...planForm, includedVisits: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Standard Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={planForm.price}
                      onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Billing Frequency
                    </label>
                    <select
                      className="form-control"
                      value={planForm.billingFrequency}
                      onChange={(e) => setPlanForm({ ...planForm, billingFrequency: e.target.value })}
                    >
                      <option value="ANNUAL">Annual</option>
                      <option value="HALF_YEARLY">Half-Yearly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Duration (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={planForm.defaultDurationMonths}
                      onChange={(e) => setPlanForm({ ...planForm, defaultDurationMonths: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, padding: '8px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={planForm.remoteSupport}
                      onChange={(e) => setPlanForm({ ...planForm, remoteSupport: e.target.checked })}
                    />
                    Remote Support
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={planForm.onsiteSupport}
                      onChange={(e) => setPlanForm({ ...planForm, onsiteSupport: e.target.checked })}
                    />
                    On-Site Support
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={planForm.partsCoverage}
                      onChange={(e) => setPlanForm({ ...planForm, partsCoverage: e.target.checked })}
                    />
                    Parts Coverage
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                    Exclusions
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={planForm.exclusions}
                    onChange={(e) => setPlanForm({ ...planForm, exclusions: e.target.value })}
                    placeholder="List standard exclusions (e.g. physical damage, unauthorized repairs)..."
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  background: '#f8fafc',
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setShowPlanEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving Plan...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE AMC CONTRACT WIZARD (5 STEPS)                             */}
      {/* ========================================================================= */}
      {showCreateWizard && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
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
              maxWidth: 880,
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
            {/* Wizard Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Create Customer AMC Contract
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Step {wizardStep} of 5 •{' '}
                  {wizardStep === 1
                    ? 'Customer & Product Selection'
                    : wizardStep === 2
                    ? 'AMC Plan & SLA Tier'
                    : wizardStep === 3
                    ? 'Commercial & Governance Terms'
                    : wizardStep === 4
                    ? 'Service Coverage Configuration'
                    : 'Review & Activation'}
                </div>
              </div>
              <button
                onClick={() => setShowCreateWizard(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Step Indicators */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #e2e8f0',
                background: '#f1f5f9',
                padding: '10px 24px',
                gap: 8,
              }}
            >
              {[
                { step: 1, label: '1. Customer & Product' },
                { step: 2, label: '2. AMC Plan' },
                { step: 3, label: '3. Contract Terms' },
                { step: 4, label: '4. Service Coverage' },
                { step: 5, label: '5. Review & Create' },
              ].map((s) => (
                <div
                  key={s.step}
                  onClick={() => {
                    if (s.step < wizardStep) setWizardStep(s.step);
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: wizardStep === s.step ? 700 : 500,
                    color: wizardStep === s.step ? '#0284c7' : s.step < wizardStep ? '#16a34a' : '#64748b',
                    background: wizardStep === s.step ? '#e0f2fe' : s.step < wizardStep ? '#dcfce7' : 'transparent',
                    cursor: s.step < wizardStep ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {s.step < wizardStep && <Check size={14} color="#16a34a" />}
                  {s.label}
                </div>
              ))}
            </div>

            {/* Step Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {/* STEP 1: Customer & Product Selection */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                      Customer Company *
                    </label>
                    <select
                      className="form-control"
                      value={wizardCustomer?.id || ''}
                      onChange={(e) => handleWizardCustomerSelect(e.target.value)}
                    >
                      <option value="">-- Select Active Customer Company --</option>
                      {companies.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.company_name || comp.companyName} ({comp.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {wizardCustomer && (
                    <div
                      style={{
                        padding: 14,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                        {wizardCustomer.company_name || wizardCustomer.companyName}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: '#475569' }}>
                        <div>Primary Contact: {wizardCustomer.contactPerson || wizardCustomer.contact_person || 'N/A'}</div>
                        <div>Email: {wizardCustomer.primaryEmail || wizardCustomer.primary_email || 'N/A'}</div>
                        <div>Phone: {wizardCustomer.contactPhone || wizardCustomer.contact_phone || 'N/A'}</div>
                        <div>GSTN: {wizardCustomer.gstn || 'N/A'}</div>
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                      Applicable Product *
                    </label>
                    {loadingCustomerProducts ? (
                      <div style={{ fontSize: 12, color: '#64748b', padding: '8px 0' }}>
                        <RefreshCw size={14} className="spin" style={{ marginRight: 6, display: 'inline-block' }} />
                        Loading products entitled to this customer...
                      </div>
                    ) : customerProducts.length > 0 ? (
                      <select
                        className="form-control"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                      >
                        <option value="">-- Select Product Suite --</option>
                        {customerProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code || p.id}) - {p.category || 'Software Suite'}
                          </option>
                        ))}
                      </select>
                    ) : wizardCustomer ? (
                      <div style={{ padding: 12, background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#b45309' }}>
                        No products are mapped to this company. Please ensure products are configured in customer
                        entitlements.
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Select a customer company first to view mapped products.</div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: AMC Plan Selection */}
              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                      Choose AMC Plan Template
                    </label>
                    <select
                      className="form-control"
                      value={selectedPlanId}
                      onChange={(e) => handleWizardPlanSelect(e.target.value)}
                    >
                      <option value="">-- Custom Terms / Manual Specification --</option>
                      {amcPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code}) — ₹{p.price.toLocaleString()} / {p.billingFrequency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                      Agreement / Plan Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={contractPlanName}
                      onChange={(e) => setContractPlanName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Coverage Scope
                      </label>
                      <select
                        className="form-control"
                        value={contractCoverageType}
                        onChange={(e) => setContractCoverageType(e.target.value)}
                      >
                        <option value="COMPREHENSIVE">Comprehensive (Labor + Parts)</option>
                        <option value="NON_COMPREHENSIVE">Non-Comprehensive (Labor Only)</option>
                        <option value="LABOUR_ONLY">Labour Only</option>
                        <option value="PARTS_ONLY">Parts Only</option>
                        <option value="CUSTOM">Custom Tailored SLA</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Support Team / Escalation Level
                      </label>
                      <select
                        className="form-control"
                        value={contractSupportTeam}
                        onChange={(e) => setContractSupportTeam(e.target.value)}
                      >
                        <option value="L1 Support Desk">L1 Support Desk</option>
                        <option value="L2 Support Team">L2 Support Team</option>
                        <option value="L3 Technical Specialists">L3 Technical Specialists</option>
                        <option value="Dedicated Resident Engineer">Dedicated Resident Engineer</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Contract Terms & Commercials */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Start Date *
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={contractStartDate}
                        onChange={(e) => {
                          setContractStartDate(e.target.value);
                          updateExpiryFromDuration(e.target.value, contractDurationMonths);
                        }}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Duration (Months) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        value={contractDurationMonths}
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          setContractDurationMonths(m);
                          updateExpiryFromDuration(contractStartDate, m);
                        }}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Expiry Date *
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={contractExpiryDate}
                        onChange={(e) => setContractExpiryDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Base Contract Amount ({contractCurrency}) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={contractAmount}
                        onChange={(e) => setContractAmount(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={contractTaxRate}
                        onChange={(e) => setContractTaxRate(Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Total Value (Inc. Tax)
                      </label>
                      <div
                        style={{
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: 6,
                          fontWeight: 700,
                          color: '#16a34a',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        ₹{(contractAmount + (contractAmount * contractTaxRate) / 100).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Billing Frequency
                      </label>
                      <select
                        className="form-control"
                        value={contractBillingFrequency}
                        onChange={(e) => setContractBillingFrequency(e.target.value)}
                      >
                        <option value="ANNUAL">Annual Advance</option>
                        <option value="HALF_YEARLY">Half-Yearly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Payment Terms
                      </label>
                      <select
                        className="form-control"
                        value={contractPaymentTerms}
                        onChange={(e) => setContractPaymentTerms(e.target.value)}
                      >
                        <option value="Net 30">Net 30 Days</option>
                        <option value="100% Advance">100% Advance</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="50% Advance, 50% Post-Audit">50% Advance, 50% Post-Audit</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Assigned Account Manager
                      </label>
                      <select
                        className="form-control"
                        value={contractOwnerEmployeeId}
                        onChange={(e) => setContractOwnerEmployeeId(e.target.value)}
                      >
                        <option value="">-- Unassigned (Company Default) --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.designation || emp.department})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Renewal Type
                      </label>
                      <select
                        className="form-control"
                        value={contractRenewalType}
                        onChange={(e) => setContractRenewalType(e.target.value)}
                      >
                        <option value="MANUAL">Manual Review & Renewal</option>
                        <option value="AUTO_RENEW">Auto-Renew on Expiry</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Service Coverage Configuration */}
              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Preventive Maintenance Frequency
                      </label>
                      <select
                        className="form-control"
                        value={contractPmFrequency}
                        onChange={(e) => setContractPmFrequency(e.target.value)}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="HALF_YEARLY">Half-Yearly</option>
                        <option value="ANNUALLY">Annually</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                        Included Maintenance Visits / Year
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={contractPmVisits}
                        onChange={(e) => setContractPmVisits(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label
                      style={{
                        padding: 12,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contractRemoteSupport}
                        onChange={(e) => setContractRemoteSupport(e.target.checked)}
                      />
                      <div>
                        <strong>Remote Support Assistance</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Diagnostic and hotline assistance</div>
                      </div>
                    </label>

                    <label
                      style={{
                        padding: 12,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contractOnsiteSupport}
                        onChange={(e) => setContractOnsiteSupport(e.target.checked)}
                      />
                      <div>
                        <strong>On-Site Technical Visits</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Engineer physical visits on customer premises</div>
                      </div>
                    </label>

                    <label
                      style={{
                        padding: 12,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contractBreakdownSupport}
                        onChange={(e) => setContractBreakdownSupport(e.target.checked)}
                      />
                      <div>
                        <strong>Breakdown & Emergency Calls</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Unscheduled breakdown response coverage</div>
                      </div>
                    </label>

                    <label
                      style={{
                        padding: 12,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={contractPartsCoverage}
                        onChange={(e) => setContractPartsCoverage(e.target.checked)}
                      />
                      <div>
                        <strong>Parts & Spares Replacement</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Included hardware components & parts</div>
                      </div>
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Specific Exclusions
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={contractExclusions}
                      onChange={(e) => setContractExclusions(e.target.value)}
                      placeholder="List non-covered items, out-of-scope services..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                      Contract Notes / Special Instructions
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={contractNotes}
                      onChange={(e) => setContractNotes(e.target.value)}
                      placeholder="Optional remarks, customer PO reference, special instructions..."
                    />
                  </div>
                </div>
              )}

              {/* STEP 5: Review & Confirm */}
              {wizardStep === 5 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      padding: 16,
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Customer Company</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                          {wizardCustomer?.company_name || wizardCustomer?.companyName}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Product Suite</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0284c7' }}>
                          {customerProducts.find((p) => p.id === selectedProductId)?.name || selectedProductId}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Plan Tier:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{contractPlanName}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Coverage Type:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{contractCoverageType}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Support Team:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{contractSupportTeam}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Period:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {formatDate(contractStartDate)} → {formatDate(contractExpiryDate)}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Total Value:</span>
                        <div style={{ fontWeight: 700, color: '#16a34a' }}>
                          ₹{(contractAmount + (contractAmount * contractTaxRate) / 100).toLocaleString()} ({contractBillingFrequency})
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>PM Visits:</span>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {contractPmVisits} visits / yr ({contractPmFrequency})
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>
                      Initial Contract Status
                    </label>
                    <select
                      className="form-control"
                      value={contractStatus}
                      onChange={(e) => setContractStatus(e.target.value as any)}
                    >
                      <option value="ACTIVE">ACTIVE (Enforce live SLA & coverage immediately)</option>
                      <option value="DRAFT">DRAFT (Save as pending contract review)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                {wizardStep > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateWizard(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>

                {wizardStep < 5 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (wizardStep === 1) {
                        if (!wizardCustomer) {
                          alert('Please select a customer company.');
                          return;
                        }
                        if (!selectedProductId) {
                          alert('Please select an entitled product.');
                          return;
                        }
                      }
                      setWizardStep(wizardStep + 1);
                    }}
                  >
                    Next Step <ChevronRight size={14} style={{ marginLeft: 4 }} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateContractSubmit}
                    disabled={submitting}
                    style={{ fontWeight: 700 }}
                  >
                    {submitting ? 'Creating AMC Contract...' : 'Confirm & Create AMC Contract'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONTRACT DETAILS MODAL                                           */}
      {/* ========================================================================= */}
      {detailTarget && (
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
              maxHeight: '90vh',
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
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText color="#0284c7" size={22} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                      AMC Contract • {detailTarget.id}
                    </h3>
                    {getStatusBadge(detailTarget)}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {detailTarget.company_name || detailTarget.companyName} •{' '}
                    {detailTarget.product_name || detailTarget.productName}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {detailLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ display: 'inline-block', marginBottom: 8 }} />
                  <div>Loading detailed contract record...</div>
                </div>
              ) : (
                <>
                  {/* Summary Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Coverage Validity
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                        {formatDate(detailTarget.start_date || detailTarget.startDate)} →{' '}
                        {formatDate(detailTarget.expiry_date || detailTarget.expiryDate)}
                      </div>
                      <div style={{ fontSize: 11, color: '#0284c7', marginTop: 2 }}>
                        {detailTarget.days_remaining ?? detailTarget.daysRemaining} days remaining
                      </div>
                    </div>

                    <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Financial Value
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                        {detailTarget.contractAmount ? `₹${detailTarget.contractAmount.toLocaleString()}` : 'Custom Contract'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {detailTarget.billingFrequency || 'ANNUAL'} • {detailTarget.paymentTerms || 'Net 30'}
                      </div>
                    </div>

                    <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        SLA Response Level
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                        {detailTarget.responseTimeHours ? `${detailTarget.responseTimeHours}h Response` : 'Standard SLA'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {detailTarget.resolutionTimeHours ? `${detailTarget.resolutionTimeHours}h Resolution` : 'Business Hours'}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Product Information */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      Customer & Product Information
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Customer: </span>
                        <strong>{detailTarget.company_name || detailTarget.companyName}</strong> (
                        {detailTarget.company_id || detailTarget.companyId})
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Product: </span>
                        <strong>{detailTarget.product_name || detailTarget.productName}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Account Manager: </span>
                        <strong>{detailTarget.owner_employee_name || detailTarget.ownerEmployeeName || 'Unassigned'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Support Team: </span>
                        <strong>{detailTarget.supportTeam || 'L2 Support Team'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Service Coverage Details */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      Service Coverage Scope
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Coverage Type: </span>
                        <strong>{detailTarget.coverageType || 'COMPREHENSIVE'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Preventive Maintenance: </span>
                        <strong>
                          {detailTarget.preventiveVisits || 4} Visits / yr ({detailTarget.pmFrequency || 'QUARTERLY'})
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Remote Support: </span>
                        <strong>{detailTarget.remoteSupport !== false ? 'Included (Yes)' : 'Excluded'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>On-Site Support: </span>
                        <strong>{detailTarget.onsiteSupport !== false ? 'Included (Yes)' : 'Excluded'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Parts & Spares: </span>
                        <strong>{detailTarget.partsCoverage ? 'Included' : 'Chargeable Extra'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Renewal Type: </span>
                        <strong>{detailTarget.renewalType || 'MANUAL'}</strong>
                      </div>
                    </div>

                    {detailTarget.exclusions && (
                      <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', borderRadius: 6, fontSize: 12 }}>
                        <strong style={{ color: '#991b1b' }}>Exclusions: </strong>
                        <span style={{ color: '#7f1d1d' }}>{detailTarget.exclusions}</span>
                      </div>
                    )}
                  </div>

                  {/* Renewal History Log */}
                  {detailTarget.renewalHistory && detailTarget.renewalHistory.length > 0 && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        Renewal Audit History
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detailTarget.renewalHistory.map((rh: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              padding: 10,
                              background: '#f8fafc',
                              borderRadius: 6,
                              fontSize: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <strong>Renewed on {formatDate(rh.renewedAt)}</strong>
                              <div style={{ color: '#64748b' }}>
                                New Expiry: {formatDate(rh.newExpiryDate)} • {rh.notes || 'No remarks'}
                              </div>
                            </div>
                            {rh.amount && <strong style={{ color: '#16a34a' }}>₹{rh.amount.toLocaleString()}</strong>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Associated Tickets */}
                  {detailTarget.relatedTickets && detailTarget.relatedTickets.length > 0 && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        Associated Support Tickets
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {detailTarget.relatedTickets.map((t: any) => (
                          <div
                            key={t.id}
                            style={{
                              padding: '8px 12px',
                              background: '#f8fafc',
                              borderRadius: 6,
                              fontSize: 12,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong>{t.id}</strong> — {t.problemType}
                            </div>
                            <span className="badge badge-secondary" style={{ fontSize: 10 }}>
                              {t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes / Logs */}
                  {detailTarget.notes && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        Contract Notes
                      </h4>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#475569',
                          whiteSpace: 'pre-wrap',
                          background: '#f8fafc',
                          padding: 10,
                          borderRadius: 6,
                        }}
                      >
                        {detailTarget.notes}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                {canRenew && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const t = detailTarget;
                      setDetailTarget(null);
                      openRenewModal(t);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RotateCw size={14} />
                    Renew Contract
                  </button>
                )}
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setDetailTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RENEWAL MODAL                                                    */}
      {/* ========================================================================= */}
      {renewTarget && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 20,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 580,
              padding: 24,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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
                  <RotateCw color="#0284c7" size={20} />
                  Renew AMC Contract • {renewTarget.id}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {renewTarget.company_name} ({renewTarget.product_name})
                </div>
              </div>
              <button
                onClick={() => setRenewTarget(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleRenewSubscription}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Current Expiry Date
                </label>
                <input
                  type="text"
                  className="form-control"
                  disabled
                  value={formatDate(renewTarget.expiry_date)}
                  style={{ background: '#f1f5f9' }}
                />
              </div>

              {/* Extension Duration Shortcuts */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Quick Extension Period
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleApplyRenewShortcut(12)}
                    style={{ flex: 1 }}
                  >
                    + 1 Year
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleApplyRenewShortcut(6)}
                    style={{ flex: 1 }}
                  >
                    + 6 Months
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleApplyRenewShortcut(24)}
                    style={{ flex: 1 }}
                  >
                    + 2 Years
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  New Expiry Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={renewExpiryDate}
                  onChange={(e) => setRenewExpiryDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Plan / SLA Tier (Optional Upgrade)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={renewPlanName}
                  onChange={(e) => setRenewPlanName(e.target.value)}
                  placeholder="e.g. Enterprise SLA Plan 2027 (Renewed)"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                    Renewal Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 75000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                    PO / Approval Reference
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={renewPoNumber}
                    onChange={(e) => setRenewPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-9988"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Renewal Remarks / Approval Notes
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  placeholder="e.g. PO approved and renewed for 1 year."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRenewTarget(null)}
                  disabled={submitting}
                >
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

      {/* ========================================================================= */}
      {/* MODAL 5: RENEWAL WARNING MODAL                                            */}
      {/* ========================================================================= */}
      {warningTarget && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertTriangle color="#d97706" size={18} />
                  Send Renewal Warning • {warningTarget.id}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {warningTarget.company_name} ({warningTarget.product_name})
                </div>
              </div>
              <button
                onClick={() => setWarningTarget(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSendWarning}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>
                  Reminder Message
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  required
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  This notification will be dispatched to primary contact ({warningTarget.company_email}) and logged in
                  audit history.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setWarningTarget(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ background: '#d97706', borderColor: '#d97706' }}
                >
                  {submitting ? 'Dispatching...' : 'Dispatch Warning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
