import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { Company, Product, Branch, CustomerProductEntitlement } from '../../types';
import { CustomerProductEntitlementSelector } from '../../components/companies/CustomerProductEntitlementSelector';
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
  Users,
  Trash2,
  Edit2,
  Layers,
  CheckSquare,
  Square,
  AlertCircle,
  Save,
  Sliders,
  Clock,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  FileText,
  Check,
  Activity,
  Info,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { isValidEmail, isValidPhone, isValidGSTN, validatePhoneDetailed } from '../../utils/validation';
import { PhoneInput } from '../../components/common/PhoneInput';

export const CompaniesPage: React.FC<{ onNavigateTicket: (id: string) => void }> = ({ onNavigateTicket }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected customer for detailed view
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [companyBranches, setCompanyBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Customer Profile 7-Tabs State
  const [customerModalTab, setCustomerModalTab] = useState<
    'overview' | 'user_licences' | 'company_licences' | 'subscription' | 'entitlement_history' | 'licence_usage' | 'audit_history'
  >('overview');
  const [entitlementSummary, setEntitlementSummary] = useState<any | null>(null);
  const [loadingEntitlement, setLoadingEntitlement] = useState(false);
  const [entitlementHistoryList, setEntitlementHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Licence Expansion Modal State
  const [showExpansionModal, setShowExpansionModal] = useState<null | 'USER' | 'COMPANY'>(null);
  const [expansionQuantity, setExpansionQuantity] = useState<number>(50);
  const [expansionReason, setExpansionReason] = useState<string>('');
  const [savingExpansion, setSavingExpansion] = useState(false);
  const [expansionError, setExpansionError] = useState<string | null>(null);

  // Subscription Renewal Modal State
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [renewalMonths, setRenewalMonths] = useState<number>(12);
  const [renewalUserQty, setRenewalUserQty] = useState<number>(50);
  const [renewalCompQty, setRenewalCompQty] = useState<number>(3);
  const [renewalRef, setRenewalRef] = useState<string>('');
  const [renewalNotes, setRenewalNotes] = useState<string>('');
  const [savingRenewal, setSavingRenewal] = useState(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);

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
    productEntitlements: [] as CustomerProductEntitlement[],
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

  // Inline Email Verification State for Customer Registration
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);

  // Edit Customer Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editActiveTab, setEditActiveTab] = useState<'details' | 'entitlements'>('details');
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    id: '',
    company_name: '',
    address: '',
    gstn: '',
    primary_email: '',
    alternate_emails: '',
    contact_person: '',
    contact_phone: '',
    contact_address: '',
    contact_status: 'ACTIVE',
    alternate_contact: '',
    alternate_contact_phone: '',
    alternate_contact_email: '',
    alternate_contact_address: '',
    is_active: 1,
    product_ids: [] as string[],
    productEntitlements: [] as CustomerProductEntitlement[],
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Product to existing Customer Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedNewProductId, setSelectedNewProductId] = useState('');
  const [newProductEntitlements, setNewProductEntitlements] = useState<CustomerProductEntitlement[]>([]);
  const [addingProduct, setAddingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  // Branch Modal State (Add / Edit)
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    branch_name: '',
    gstn: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    product_ids: [] as string[],
    productEntitlements: [] as CustomerProductEntitlement[],
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Maximum allowed branch entitlements: only the active products, modules, and submodules owned by the parent customer
  const parentCustomerProducts = useMemo<Product[]>(() => {
    if (!selectedCompany || !selectedCompany.products) return [];
    return (selectedCompany.products || [])
      .filter((cp: any) => cp.isActive !== false && cp.is_active !== 0 && cp.is_active !== false)
      .map((cp: any) => {
        const prodId = cp.productId || cp.product_id || cp.id;
        const masterProd = products.find((p) => p.id === prodId);
        return {
          id: prodId,
          code: cp.code || cp.product_code || masterProd?.code || prodId,
          name: cp.name || cp.product_name || masterProd?.name || 'Product',
          category: cp.category || masterProd?.category || 'Enterprise Software',
          description: cp.description || masterProd?.description,
          isActive: true,
          modules: (cp.modules || []).map((m: any) => ({
            id: m.id || m.moduleId,
            productId: prodId,
            name: m.name || m.module_name || m.id,
            code: m.code || m.id,
            description: m.description,
            isActive: true,
            submodules: (m.submodules || []).map((s: any) => ({
              id: s.id || s.submoduleId,
              moduleId: m.id || m.moduleId,
              name: s.name || s.submodule_name || s.id,
              code: s.code || s.id,
              description: s.description,
              isActive: true,
            })),
          })),
        } as Product;
      });
  }, [selectedCompany, products]);

  useEffect(() => {
    loadCompanies();
    loadProducts();
  }, [page, limit, search, statusFilter]);

  const loadProducts = async () => {
    try {
      const res = await api.getProducts({ limit: 200, isActive: 'true' });
      setProducts(res.products || res.data || []);
    } catch (err) {
      console.error('Failed to load product catalog', err);
    }
  };

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanies({ page, limit, search, isActive: statusFilter });
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
      setCustomerModalTab('overview');
      loadBranchesForCompany(id);
      loadEntitlementsForCustomer(id);
      loadHistoryForCustomer(id);
    } catch (err) {
      console.error(err);
    }
  };

  const loadEntitlementsForCustomer = async (compId: string) => {
    setLoadingEntitlement(true);
    try {
      const res = await api.getCustomerEntitlement(compId);
      if (res?.entitlement) {
        setEntitlementSummary(res.entitlement);
        setExpansionQuantity(res.entitlement.userLicences.purchased);
        setRenewalUserQty(res.entitlement.userLicences.purchased);
        setRenewalCompQty(res.entitlement.companyLicences.purchased);
      }
    } catch (err) {
      console.warn('Failed to load entitlement summary:', err);
    } finally {
      setLoadingEntitlement(false);
    }
  };

  const loadHistoryForCustomer = async (compId: string) => {
    setLoadingHistory(true);
    try {
      const res = await api.getEntitlementHistory({ customerId: compId });
      setEntitlementHistoryList(res?.history || []);
    } catch (err) {
      console.warn('Failed to load entitlement history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExecuteExpansion = async () => {
    if (!selectedCompany || !showExpansionModal) return;
    setSavingExpansion(true);
    setExpansionError(null);
    try {
      if (showExpansionModal === 'USER') {
        const res = await api.increaseUserLicences(selectedCompany.id, expansionQuantity, expansionReason);
        if (res?.entitlement) setEntitlementSummary(res.entitlement);
      } else {
        const res = await api.increaseCompanyLicences(selectedCompany.id, expansionQuantity, expansionReason);
        if (res?.entitlement) setEntitlementSummary(res.entitlement);
      }
      await loadHistoryForCustomer(selectedCompany.id);
      setShowExpansionModal(null);
      setExpansionReason('');
    } catch (err: any) {
      setExpansionError(err.message || 'Failed to update licences');
    } finally {
      setSavingExpansion(false);
    }
  };

  const handleExecuteRenewal = async () => {
    if (!selectedCompany) return;
    setSavingRenewal(true);
    setRenewalError(null);
    try {
      const res = await api.directRenewSubscription(selectedCompany.id, {
        renewalMonths,
        userLicences: renewalUserQty,
        companyLicences: renewalCompQty,
        paymentReference: renewalRef,
        notes: renewalNotes,
      });
      if (res?.entitlement) setEntitlementSummary(res.entitlement);
      await loadHistoryForCustomer(selectedCompany.id);
      setShowRenewalModal(false);
      setRenewalRef('');
      setRenewalNotes('');
    } catch (err: any) {
      setRenewalError(err.message || 'Failed to renew subscription');
    } finally {
      setSavingRenewal(false);
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

  // Open Edit Customer Modal
  const handleOpenEdit = async (company: any) => {
    setEditingCompany(company);
    setEditFormError(null);
    setEditActiveTab('details');

    let rawCompany = company;
    try {
      const res = await api.getCompany(company.id);
      if (res.company) rawCompany = res.company;
    } catch (e) {
      console.error('Failed to load full company for edit', e);
    }

    const initialEntitlements: CustomerProductEntitlement[] = (rawCompany.products || [])
      .filter((p: any) => p.is_active !== 0 && p.is_active !== false)
      .map((p: any) => ({
        productId: p.productId || p.product_id || p.id,
        purchaseType: p.purchase_type || p.purchaseType || 'SELECTED_MODULES',
        modules: (p.modules || []).map((m: any) => ({
          moduleId: m.id || m.moduleId,
          submoduleIds: (m.submodules || []).map((s: any) => s.id || s.submoduleId || s) || [],
        })),
      }));

    const initialProductIds = initialEntitlements.map((e) => e.productId);

    setEditFormData({
      id: rawCompany.id || '',
      company_name: rawCompany.company_name || rawCompany.companyName || '',
      address: rawCompany.address || '',
      gstn: rawCompany.gstn || '',
      primary_email: rawCompany.primary_email || rawCompany.primaryEmail || '',
      alternate_emails: rawCompany.alternate_emails || rawCompany.alternateEmails || '',
      contact_person: rawCompany.contact_person || rawCompany.contactPerson || '',
      contact_phone: rawCompany.contact_phone || rawCompany.contactPhone || '',
      contact_address: rawCompany.contact_address || rawCompany.contactAddress || '',
      contact_status: (rawCompany.contact_status || rawCompany.contactStatus || 'ACTIVE').toUpperCase(),
      alternate_contact: rawCompany.alternate_contact || rawCompany.alternateContact || '',
      alternate_contact_phone: rawCompany.alternate_contact_phone || rawCompany.alternateContactPhone || '',
      alternate_contact_email: rawCompany.alternate_contact_email || rawCompany.alternateContactEmail || '',
      alternate_contact_address: rawCompany.alternate_contact_address || rawCompany.alternateContactAddress || '',
      is_active: rawCompany.is_active !== undefined ? (rawCompany.is_active ? 1 : 0) : (rawCompany.isActive !== false ? 1 : 0),
      product_ids: initialProductIds,
      productEntitlements: initialEntitlements,
    });
    setShowEditModal(true);
  };

  const handleVerifyEmail = async () => {
    setEmailVerifyError(null);
    const email = formData.primary_email?.trim();
    if (!email) {
      setEmailVerifyError('Please enter an email address.');
      return;
    }
    if (!isValidEmail(email)) {
      setEmailVerifyError('Please enter a valid email address.');
      return;
    }

    setVerifyingEmail(true);
    try {
      const res = await api.verifyCustomerEmail(email);
      if (res && res.verified) {
        setEmailVerified(true);
        setVerifiedEmail(email);
        setEmailVerifyError(null);
      } else {
        setEmailVerified(false);
        setEmailVerifyError(res?.message || 'Unable to send verification email. Please try again.');
      }
    } catch (err: any) {
      setEmailVerified(false);
      setEmailVerifyError(err.message || 'Unable to send verification email. Please try again.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const validateCompanyStep1 = (data: typeof formData): string | null => {
    if (!data.company_name || !data.company_name.trim()) return 'Company / Organization name is required.';
    if (!data.primary_email || !data.primary_email.trim()) return 'Primary corporate email is required.';
    if (!isValidEmail(data.primary_email)) return 'Please enter a valid primary corporate email (e.g. name@company.com).';
    if (data.gstn && !isValidGSTN(data.gstn)) return 'Please enter a valid 15-character GSTIN (e.g. 27AABCU9603R1ZM).';
    if (!data.address || !data.address.trim()) return 'Full corporate address is required.';
    if (!data.contact_person || !data.contact_person.trim()) return 'Primary contact person name is required.';
    if (!data.contact_phone || !data.contact_phone.trim()) return 'Contact phone is required.';
    const phoneVal = validatePhoneDetailed(data.contact_phone);
    if (!phoneVal.valid) return phoneVal.error || 'Please enter a valid contact phone number.';
    if (data.alternate_contact_phone && data.alternate_contact_phone.trim()) {
      const altVal = validatePhoneDetailed(data.alternate_contact_phone);
      if (!altVal.valid) return `Alternate Phone: ${altVal.error}`;
    }
    if (data.alternate_contact_email && !isValidEmail(data.alternate_contact_email)) {
      return 'Please enter a valid alternate contact email.';
    }
    return null;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setEditFormError(null);

    if (!editFormData.company_name.trim()) {
      setEditFormError('Company name is required.');
      return;
    }
    if (!editFormData.primary_email.trim()) {
      setEditFormError('Primary email is required.');
      return;
    }
    if (!isValidEmail(editFormData.primary_email)) {
      setEditFormError('Please enter a valid primary corporate email (e.g. name@company.com).');
      return;
    }
    if (editFormData.gstn && !isValidGSTN(editFormData.gstn)) {
      setEditFormError('Please enter a valid 15-character GSTIN (e.g. 27AABCU9603R1ZM).');
      return;
    }
    if (!editFormData.address.trim()) {
      setEditFormError('Full corporate address is required.');
      return;
    }
    if (!editFormData.contact_person.trim()) {
      setEditFormError('Primary contact person is required.');
      return;
    }
    if (!editFormData.contact_phone.trim()) {
      setEditFormError('Contact phone is required.');
      return;
    }
    if (!isValidPhone(editFormData.contact_phone)) {
      setEditFormError('Please enter a valid 10 to 15 digit contact phone number.');
      return;
    }
    if (editFormData.alternate_contact_phone && !isValidPhone(editFormData.alternate_contact_phone)) {
      setEditFormError('Please enter a valid 10 to 15 digit alternate contact phone number.');
      return;
    }
    if (editFormData.alternate_contact_email && !isValidEmail(editFormData.alternate_contact_email)) {
      setEditFormError('Please enter a valid alternate contact email.');
      return;
    }

    if (editFormData.alternate_emails && editFormData.alternate_emails.trim()) {
      const emailList = editFormData.alternate_emails
        .split(/[;,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const em of emailList) {
        if (!isValidEmail(em)) {
          setEditFormError(`Invalid alternate email format: '${em}'. Please provide valid comma-separated emails.`);
          return;
        }
      }
    }

    // Must have at least 1 product
    if (editFormData.product_ids.length === 0) {
      setEditFormError('A customer must have at least one product entitlement.');
      return;
    }

    setSavingEdit(true);
    try {
      await api.updateCompany(editingCompany.id, {
        company_name: editFormData.company_name.trim(),
        address: editFormData.address.trim(),
        gstn: editFormData.gstn.trim() || null,
        primary_email: editFormData.primary_email.trim(),
        alternate_emails: editFormData.alternate_emails.trim() || null,
        contact_person: editFormData.contact_person.trim(),
        contact_phone: editFormData.contact_phone.trim(),
        contact_address: editFormData.contact_address.trim() || null,
        contact_status: editFormData.contact_status || 'ACTIVE',
        alternate_contact: editFormData.alternate_contact.trim() || null,
        alternate_contact_phone: editFormData.alternate_contact_phone.trim() || null,
        alternate_contact_email: editFormData.alternate_contact_email.trim() || null,
        alternate_contact_address: editFormData.alternate_contact_address.trim() || null,
        is_active: editFormData.is_active === 1,
        isActive: editFormData.is_active === 1,
        products: editFormData.productEntitlements,
        product_ids: editFormData.product_ids,
      });
      setShowEditModal(false);
      setEditingCompany(null);
      loadCompanies();
      // Refresh detail view if open
      if (selectedCompany && selectedCompany.id === editingCompany.id) {
        handleOpenDetail(editingCompany.id);
      }
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to update customer');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const step1Err = validateCompanyStep1(formData);
    if (step1Err) {
      setFormError(step1Err);
      setCreateStep(1);
      return;
    }

    // Business Rule 2: At least ONE product required
    if (formData.product_ids.length === 0) {
      setFormError('At least one product must be selected before registering a customer.');
      setCreateStep(2);
      return;
    }

    setSaving(true);
    try {
      await api.createCompany({
        ...formData,
        products: formData.productEntitlements,
      });
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
        productEntitlements: [],
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
      const ent = newProductEntitlements.find((e) => e.productId === selectedNewProductId) || {
        productId: selectedNewProductId,
        purchaseType: 'SELECTED_MODULES',
        modules: [],
      };
      await api.addCustomerProduct(selectedCompany.id, ent);
      setShowAddProductModal(false);
      setSelectedNewProductId('');
      setNewProductEntitlements([]);
      // Refresh company detail
      handleOpenDetail(selectedCompany.id);
      loadCompanies();
    } catch (err: any) {
      setProductError(err.message || 'Failed to add product');
    } finally {
      setAddingProduct(false);
    }
  };

  // Remove Product from existing Customer (soft-deactivate - preserves history)
  const handleRemoveProduct = async (productId: string, productName: string) => {
    if (!selectedCompany || !productId) return;
    const activeProducts = (selectedCompany.products || []).filter(
      (p: any) => p.is_active !== 0 && p.is_active !== false && p.isActive !== false
    );
    if (activeProducts.length <= 1) {
      alert('A customer must have at least one active product. Cannot remove the only remaining product.');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to remove product "${productName}" from this customer?\n\nThis will NOT delete historical tickets, AMC records, or implementation data associated with this product.`
    );
    if (!confirmed) return;

    try {
      await api.removeCustomerProduct(selectedCompany.id, productId);
      // Immediately remove from current selectedCompany state so UI reflects deletion instantly
      setSelectedCompany((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          products: (prev.products || []).filter((prod: any) => {
            const pId = prod.productId || prod.product_id || prod.id;
            return pId !== productId && String(prod.id) !== String(productId) && prod.productId !== productId && prod.product_id !== productId;
          }),
        };
      });
      await handleOpenDetail(selectedCompany.id);
      await loadCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to remove product');
    }
  };

  // Open Branch Create / Edit Modal
  const handleOpenAddBranch = () => {
    setEditingBranch(null);
    setBranchForm({
      branch_name: '',
      gstn: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      product_ids: [],
      productEntitlements: [],
    });
    setBranchError(null);
    setShowBranchModal(true);
  };

  const handleOpenEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    const existingEntitlements: CustomerProductEntitlement[] = (branch.products || (branch as any).branchProducts || []).map((bp: any) => {
      const pId = bp.productId || bp.product_id || bp.id;
      const modules = (bp.modules || []).map((m: any) => {
        const mId = m.moduleId || m.module_id || m.id;
        const subIds = m.selectedSubmoduleIds || (m.submodules || []).map((s: any) => s.id || s.submoduleId || s.submodule_id) || [];
        return {
          moduleId: mId,
          submoduleIds: subIds,
        };
      });
      return {
        productId: pId,
        purchaseType: 'SELECTED_MODULES',
        modules,
      };
    });
    const assignedIds = existingEntitlements.map((e) => e.productId);

    setBranchForm({
      branch_name: branch.branch_name || (branch as any).branchName || '',
      gstn: branch.gstn || '',
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      contact_person: branch.contact_person || (branch as any).contactPerson || '',
      contact_phone: branch.contact_phone || (branch as any).contactPhone || '',
      contact_email: branch.contact_email || (branch as any).contactEmail || '',
      product_ids: assignedIds,
      productEntitlements: existingEntitlements,
    });
    setBranchError(null);
    setShowBranchModal(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setBranchError(null);

    if (!branchForm.branch_name.trim()) {
      setBranchError('Branch name is required.');
      return;
    }
    if (branchForm.gstn && !isValidGSTN(branchForm.gstn)) {
      setBranchError('Please enter a valid 15-character GSTIN (e.g. 27AABCU9603R1ZM).');
      return;
    }
    if (!branchForm.address.trim()) {
      setBranchError('Branch address is required.');
      return;
    }
    if (!branchForm.city.trim()) {
      setBranchError('City is required.');
      return;
    }
    if (!branchForm.state.trim()) {
      setBranchError('State is required.');
      return;
    }
    if (!branchForm.pincode.trim()) {
      setBranchError('PIN / Postal Code is required.');
      return;
    }
    if (!branchForm.contact_person.trim()) {
      setBranchError('Contact person is required.');
      return;
    }
    if (!branchForm.contact_phone.trim()) {
      setBranchError('Contact phone is required.');
      return;
    }
    const branchPhoneVal = validatePhoneDetailed(branchForm.contact_phone);
    if (!branchPhoneVal.valid) {
      setBranchError(branchPhoneVal.error || 'Please enter a valid contact phone number.');
      return;
    }
    if (branchForm.contact_email && !isValidEmail(branchForm.contact_email)) {
      setBranchError('Please enter a valid contact email address.');
      return;
    }

    setSavingBranch(true);
    try {
      const branchPayload = {
        branch_name: branchForm.branch_name.trim(),
        gstn: branchForm.gstn.trim() || undefined,
        address: branchForm.address.trim(),
        city: branchForm.city.trim(),
        state: branchForm.state.trim(),
        pincode: branchForm.pincode.trim(),
        contact_person: branchForm.contact_person.trim(),
        contact_phone: branchForm.contact_phone.trim(),
        contact_email: branchForm.contact_email.trim() || undefined,
        products: branchForm.productEntitlements,
        product_ids: branchForm.product_ids,
      };

      if (editingBranch) {
        await api.updateBranch(selectedCompany.id, editingBranch.id, branchPayload);
        await api.assignBranchProducts(selectedCompany.id, editingBranch.id, branchForm.productEntitlements);
      } else {
        await api.createBranch(selectedCompany.id, branchPayload);
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
              <th style={{ whiteSpace: 'nowrap' }}>Phone</th>
              <th style={{ whiteSpace: 'nowrap' }}>Active Tickets</th>
              <th>Status</th>
              <th style={{ minWidth: 230, whiteSpace: 'nowrap' }}>Actions</th>
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
                  <td style={{ fontWeight: 600, color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>{c.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.company_name}</div>
                    {c.gstn && <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>GSTN: {c.gstn}</div>}
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
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {/* Fix: use p.name (list API) or p.product_name (detail API) */}
                            {p.name || p.product_name || p.product?.name || p.code || 'Product'}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: '#f8fafc',
                        color: '#475569',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                        border: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.branches?.length || 0} Branches
                    </span>
                  </td>
                  <td>{c.contact_person}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.contact_phone}</td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: (c.open_ticket_count || 0) > 0 ? '#eff6ff' : '#f8fafc',
                        color: (c.open_ticket_count || 0) > 0 ? '#1d4ed8' : '#64748b',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                        whiteSpace: 'nowrap',
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
                  <td style={{ minWidth: 230, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenDetail(c.id)}>
                        <Eye size={13} /> View
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(c)}
                        title="Edit Customer"
                        style={{ color: '#2563eb' }}
                      >
                        <Edit2 size={13} /> Edit
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

      {/* Pagination Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          padding: '10px 16px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: '#475569' }}>
          Showing <strong>{companies.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
          <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> customers
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', padding: '0 6px' }}>
              Page {page} of {Math.max(1, Math.ceil(total / limit))}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= Math.ceil(total / limit) || total === 0}
              onClick={() => setPage((p) => p + 1)}
              style={{
                opacity: page >= Math.ceil(total / limit) || total === 0 ? 0.5 : 1,
                cursor: page >= Math.ceil(total / limit) || total === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Customer Detail Modal / View */}
      {selectedCompany && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={22} color="#0b3b60" />
                <div>
                  <div className="modal-title">{selectedCompany.company_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Customer ID: {selectedCompany.id} • {selectedCompany.is_active ? 'Active Account' : 'Inactive Account'} • Tenant: {selectedCompany.tenant_id || selectedCompany.tenantId || 'KANVTECH'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSelectedCompany(null); handleOpenEdit(selectedCompany); }}
                  style={{ color: '#2563eb' }}
                >
                  <Edit2 size={13} /> Edit Customer
                </button>
                <button
                  onClick={() => setSelectedCompany(null)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 7 Interactive Sections / Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 8px', gap: 2, overflowX: 'auto', flexShrink: 0 }}>
              {[
                { id: 'overview', label: '1. Overview', icon: Building2 },
                { id: 'user_licences', label: `2. User Licences (${entitlementSummary?.userLicences?.available ?? '—'})`, icon: Users },
                { id: 'company_licences', label: `3. Company Licences (${entitlementSummary?.companyLicences?.available ?? '—'})`, icon: Layers },
                { id: 'subscription', label: '4. Subscription & Validity', icon: Calendar },
                { id: 'entitlement_history', label: '5. Entitlement History', icon: Clock },
                { id: 'licence_usage', label: '6. Licence Usage', icon: TrendingUp },
                { id: 'audit_history', label: '7. Audit History', icon: FileText },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCustomerModalTab(t.id as any)}
                  style={{
                    padding: '10px 12px',
                    border: 'none',
                    background: 'none',
                    borderBottom: customerModalTab === t.id ? '2px solid #2563eb' : '2px solid transparent',
                    color: customerModalTab === t.id ? '#1d4ed8' : '#64748b',
                    fontWeight: customerModalTab === t.id ? 700 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <t.icon size={13} color={customerModalTab === t.id ? '#2563eb' : '#64748b'} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: 18 }}>
              {/* TAB 1: OVERVIEW */}
              {customerModalTab === 'overview' && (
                <>
                  {/* Commercial Entitlement Overview Cards */}
                  {entitlementSummary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
                      {/* Subscription Status Card */}
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                          Subscription
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: entitlementSummary.subscription.isExpired
                                ? '#fee2e2'
                                : entitlementSummary.subscription.status === 'EXPIRING_SOON'
                                ? '#fef3c7'
                                : '#dcfce7',
                              color: entitlementSummary.subscription.isExpired
                                ? '#991b1b'
                                : entitlementSummary.subscription.status === 'EXPIRING_SOON'
                                ? '#92400e'
                                : '#166534',
                            }}
                          >
                            {entitlementSummary.subscription.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#475569' }}>
                          Expires: {new Date(entitlementSummary.subscription.expiryDate).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          {entitlementSummary.subscription.daysRemaining} days remaining
                        </div>
                      </div>

                      {/* User Licences Card */}
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>User Licences</span>
                          <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 600 }}>{entitlementSummary.userLicences.usagePercentage}%</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                          {entitlementSummary.userLicences.used} / {entitlementSummary.userLicences.purchased}
                        </div>
                        <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, margin: '6px 0', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, entitlementSummary.userLicences.usagePercentage)}%`,
                              background: entitlementSummary.userLicences.available === 0 ? '#ef4444' : '#2563eb',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: entitlementSummary.userLicences.available > 0 ? '#166534' : '#b91c1c', fontWeight: 600 }}>
                          {entitlementSummary.userLicences.available} Available
                        </div>
                      </div>

                      {/* Company Licences Card */}
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Company Licences</span>
                          <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 600 }}>{entitlementSummary.companyLicences.usagePercentage}%</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                          {entitlementSummary.companyLicences.used} / {entitlementSummary.companyLicences.purchased}
                        </div>
                        <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, margin: '6px 0', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, entitlementSummary.companyLicences.usagePercentage)}%`,
                              background: entitlementSummary.companyLicences.available === 0 ? '#ef4444' : '#0284c7',
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: entitlementSummary.companyLicences.available > 0 ? '#166534' : '#b91c1c', fontWeight: 600 }}>
                          {entitlementSummary.companyLicences.available} Available
                        </div>
                      </div>

                      {/* Renewal & Actions Card */}
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                            Renewal Status
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                            {entitlementSummary.subscription.renewalStatus}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            Modified: {new Date(entitlementSummary.lastModified).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setShowRenewalModal(true)}
                          style={{ marginTop: 6, fontSize: 11, padding: '3px 8px' }}
                        >
                          <RotateCcw size={12} /> Renew / Expand
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Warnings Alert Banner */}
                  {entitlementSummary?.warnings && entitlementSummary.warnings.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, marginBottom: 16 }}>
                      {entitlementSummary.warnings.map((w: string, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#92400e', marginBottom: idx < entitlementSummary.warnings.length - 1 ? 4 : 0 }}>
                          <AlertTriangle size={14} color="#d97706" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

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
                    <span>PURCHASED PRODUCTS ({selectedCompany.products?.filter((p: any) => p.is_active !== 0 && p.is_active !== false).length || 0})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        handleOpenEdit(selectedCompany);
                        setEditActiveTab('entitlements');
                      }}
                      style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Sliders size={13} /> Manage Entitlements
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setProductError(null);
                        setSelectedNewProductId('');
                        setNewProductEntitlements([]);
                        setShowAddProductModal(true);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={13} /> Add Product
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {selectedCompany.products && selectedCompany.products.filter((p: any) => p.is_active !== 0 && p.is_active !== false).length > 0 ? (
                    selectedCompany.products
                      .filter((p: any) => p.is_active !== 0 && p.is_active !== false)
                      .map((p: any) => {
                        const isComplete = p.purchase_type === 'COMPLETE';
                        const modulesList = p.modules || [];
                        const totalSubmods = modulesList.reduce((acc: number, m: any) => acc + (m.submodules?.length || 0), 0);

                        return (
                          <div
                            key={p.id || p.product_id}
                            style={{
                              background: 'white',
                              border: '1px solid #cbd5e1',
                              borderRadius: 8,
                              padding: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0b3b60' }}>
                                  {p.name || p.product_name || p.product?.name || '—'}
                                </div>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: isComplete ? '#f0fdf4' : '#eff6ff',
                                    color: isComplete ? '#15803d' : '#1d4ed8',
                                    border: `1px solid ${isComplete ? '#bbf7d0' : '#bfdbfe'}`,
                                  }}
                                >
                                  {isComplete ? 'Complete Suite' : 'Selective Modules'}
                                </span>
                              </div>

                              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                                Product Code: <span style={{ fontWeight: 600, color: '#475569' }}>{p.code || p.product_code || p.product?.code || '—'}</span>
                                {(p.category || p.product?.category) && ` • ${p.category || p.product?.category}`}
                              </div>

                              {/* Entitlement details */}
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                                {isComplete ? (
                                  <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle size={13} /> All product modules & submodules included
                                  </div>
                                ) : modulesList.length > 0 ? (
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                                      <span>Purchased Modules ({modulesList.length})</span>
                                      {totalSubmods > 0 && <span style={{ color: '#0284c7' }}>{totalSubmods} Submodules</span>}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {modulesList.map((m: any) => (
                                        <div key={m.id || m.moduleId} style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                          <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> {m.name || m.moduleName || m.code}
                                            {m.code && <span style={{ fontSize: 9, color: '#64748b' }}>({m.code})</span>}
                                          </div>
                                          {m.submodules && m.submodules.length > 0 && (
                                            <div style={{ paddingLeft: 14, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                              {m.submodules.map((sm: any) => (
                                                <span
                                                  key={sm.id || sm.submoduleId}
                                                  style={{
                                                    fontSize: 10,
                                                    background: '#e0f2fe',
                                                    color: '#0369a1',
                                                    padding: '1px 5px',
                                                    borderRadius: 3,
                                                    border: '1px solid #bae6fd',
                                                  }}
                                                >
                                                  • {sm.name || sm.submoduleName || sm.code}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '6px 8px', borderRadius: 4 }}>
                                    Product-level entitlement (No specific module restrictions)
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: 11, color: '#2563eb' }}
                                title="Edit Entitlement for this customer"
                                onClick={() => {
                                  handleOpenEdit(selectedCompany);
                                  setEditActiveTab('entitlements');
                                }}
                              >
                                <Edit2 size={11} /> Edit Entitlements
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 6px', color: '#b91c1c' }}
                                title="Remove Product Entitlement (preserves historical data)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const prodId = p.product_id || p.productId || p.id;
                                  const prodName = p.name || p.product_name || p.product?.name || p.code || 'this product';
                                  handleRemoveProduct(prodId, prodName);
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
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
                              {b.gstn && (
                                <span style={{ fontSize: 11, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                  GST: {b.gstn}
                                </span>
                              )}
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
                                  {bp.productName || bp.name || bp.product?.name || bp.productId}
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
            </>
          )}

          {/* TAB 2: USER LICENCES */}
          {customerModalTab === 'user_licences' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    User Licences &amp; Employee Account Capacity
                  </h4>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    User Licences determine the maximum number of active employee/user accounts allowed under this customer subscription.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setExpansionQuantity(entitlementSummary?.userLicences?.purchased || 50);
                    setExpansionError(null);
                    setShowExpansionModal('USER');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Increase User Licences
                </button>
              </div>

              {entitlementSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>PURCHASED USER LICENCES</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                      {entitlementSummary.userLicences.purchased}
                    </div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ACTIVE LICENSED USERS</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
                      {entitlementSummary.userLicences.used}
                    </div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>AVAILABLE USER LICENCES</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: entitlementSummary.userLicences.available > 0 ? '#166534' : '#dc2626', marginTop: 4 }}>
                      {entitlementSummary.userLicences.available}
                    </div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CAPACITY UTILIZATION</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                      {entitlementSummary.userLicences.usagePercentage}%
                    </div>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {entitlementSummary && (
                <div style={{ background: 'white', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      Active Users: {entitlementSummary.userLicences.used} of {entitlementSummary.userLicences.purchased} licences used
                    </span>
                    <span style={{ fontWeight: 700, color: entitlementSummary.userLicences.available > 0 ? '#166534' : '#dc2626' }}>
                      {entitlementSummary.userLicences.available} Available
                    </span>
                  </div>
                  <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, entitlementSummary.userLicences.usagePercentage)}%`,
                        background: entitlementSummary.userLicences.available === 0 ? '#ef4444' : '#2563eb',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Governance Rules Alert */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#2563eb" /> Commercial Licensing &amp; Deactivation Rules
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  <li><strong>Employee Capacity:</strong> Determined strictly by purchased User Licences. Creation of new active employees is blocked when available capacity reaches 0.</li>
                  <li><strong>Expansion Before Expiry:</strong> User Licence quantity can increase before expiry, but cannot decrease.</li>
                  <li><strong>Deactivation &amp; Licence Release:</strong> Only the Tenant Super Admin can deactivate employees and release their User Licence for immediate reuse. Ordinary employees cannot deactivate users.</li>
                  <li><strong>Data Preservation:</strong> Deactivated employee records are permanently preserved and never deleted to release capacity.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: COMPANY LICENCES */}
          {customerModalTab === 'company_licences' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Company Licences &amp; Organization Capacity
                  </h4>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Company Licences control how many registered customer companies are allowed under this tenant workspace.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setExpansionQuantity(entitlementSummary?.companyLicences?.purchased || 3);
                    setExpansionError(null);
                    setShowExpansionModal('COMPANY');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Increase Company Licences
                </button>
              </div>

              {entitlementSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>PURCHASED COMPANY LICENCES</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                      {entitlementSummary.companyLicences.purchased}
                    </div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>REGISTERED COMPANIES</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                      {entitlementSummary.companyLicences.used}
                    </div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>AVAILABLE COMPANY LICENCES</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: entitlementSummary.companyLicences.available > 0 ? '#166534' : '#dc2626', marginTop: 4 }}>
                      {entitlementSummary.companyLicences.available}
                    </div>
                  </div>
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CAPACITY UTILIZATION</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                      {entitlementSummary.companyLicences.usagePercentage}%
                    </div>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {entitlementSummary && (
                <div style={{ background: 'white', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      Registered Companies: {entitlementSummary.companyLicences.used} of {entitlementSummary.companyLicences.purchased} licences used
                    </span>
                    <span style={{ fontWeight: 700, color: entitlementSummary.companyLicences.available > 0 ? '#166534' : '#dc2626' }}>
                      {entitlementSummary.companyLicences.available} Available
                    </span>
                  </div>
                  <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, entitlementSummary.companyLicences.usagePercentage)}%`,
                        background: entitlementSummary.companyLicences.available === 0 ? '#ef4444' : '#0284c7',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Rules Alert */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#0284c7" /> Company Licensing Governance
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  <li><strong>Company Registration Limit:</strong> When available Company Licences reach 0, creating or registering additional customer companies is blocked.</li>
                  <li><strong>No Reductions Before Expiry:</strong> Company Licence quantity can increase before expiry, but cannot decrease.</li>
                  <li><strong>Branch Isolation:</strong> Branches are separately managed entities and do not consume Company Licence capacity.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: SUBSCRIPTION & VALIDITY */}
          {customerModalTab === 'subscription' && entitlementSummary && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Subscription &amp; Entitlement Validity
                  </h4>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Centralized subscription governance, renewal workflows, and access boundaries.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowRenewalModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RotateCcw size={14} /> Renew Subscription
                </button>
              </div>

              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>SUBSCRIPTION STATUS</div>
                    <div style={{ marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: entitlementSummary.subscription.isExpired
                            ? '#fee2e2'
                            : entitlementSummary.subscription.status === 'EXPIRING_SOON'
                            ? '#fef3c7'
                            : '#dcfce7',
                          color: entitlementSummary.subscription.isExpired
                            ? '#991b1b'
                            : entitlementSummary.subscription.status === 'EXPIRING_SOON'
                            ? '#92400e'
                            : '#166534',
                        }}
                      >
                        {entitlementSummary.subscription.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>START DATE</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      {new Date(entitlementSummary.subscription.startDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>EXPIRY DATE</div>
                    <div style={{ fontWeight: 600, marginTop: 4, color: entitlementSummary.subscription.isExpired ? '#dc2626' : '#0f172a' }}>
                      {new Date(entitlementSummary.subscription.expiryDate).toLocaleDateString()} ({entitlementSummary.subscription.daysRemaining} days left)
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>RENEWAL STATUS</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{entitlementSummary.subscription.renewalStatus}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>PURCHASE REFERENCE</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{entitlementSummary.purchaseReference || 'PO-DIRECT-ALLOCATION'}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>LAST ENTITLEMENT MODIFIED</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{new Date(entitlementSummary.lastModified).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Expiry Governance Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={16} color="#d97706" /> Subscription Expiry &amp; Restricted Access Policy
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                  <li><strong>Employee Access:</strong> When the subscription expires, normal employee access is blocked. Ordinary employees cannot perform operations or create tickets.</li>
                  <li><strong>Tenant Super Admin Access:</strong> The Tenant Super Admin retains restricted access solely to the renewal workspace to renew the subscription and purchase additional licences.</li>
                  <li><strong>Zero Data Loss:</strong> Historical tickets, companies, employee profiles, and audit records are never deleted upon expiry.</li>
                  <li><strong>Renewal Restoration:</strong> Upon successful renewal, normal employee access is immediately restored. Manually deactivated employees remain inactive.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: ENTITLEMENT HISTORY */}
          {customerModalTab === 'entitlement_history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    Permanent Append-Only Entitlement History
                  </h4>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Immutable audit ledger of all commercial licence allocations, renewals, activations, and releases.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadHistoryForCustomer(selectedCompany.id)}
                  disabled={loadingHistory}
                >
                  <RotateCcw size={12} /> Refresh
                </button>
              </div>

              {loadingHistory ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>Loading history...</div>
              ) : entitlementHistoryList.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  No historical entitlement events found for this customer.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                    <thead style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                      <tr>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Action</th>
                        <th style={{ padding: '8px 10px' }}>Category</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Change</th>
                        <th style={{ padding: '8px 10px' }}>Period</th>
                        <th style={{ padding: '8px 10px' }}>Reason / Notes</th>
                        <th style={{ padding: '8px 10px' }}>Performed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entitlementHistoryList.map((h, i) => (
                        <tr key={h.id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(h.createdAt).toLocaleDateString()} {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: h.actionType?.includes('ADDITIONAL') || h.actionType?.includes('RENEWAL')
                                  ? '#dbeafe'
                                  : h.actionType?.includes('RELEASE') || h.actionType?.includes('DEACTIVATION')
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                                color: h.actionType?.includes('ADDITIONAL') || h.actionType?.includes('RENEWAL')
                                  ? '#1d4ed8'
                                  : h.actionType?.includes('RELEASE') || h.actionType?.includes('DEACTIVATION')
                                  ? '#b45309'
                                  : '#475569',
                              }}
                            >
                              {h.actionType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#334155' }}>{h.licenceCategory}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                            {h.quantityDifference !== undefined && h.quantityDifference !== null ? (
                              <span style={{ color: h.quantityDifference > 0 ? '#166534' : h.quantityDifference < 0 ? '#d97706' : '#64748b' }}>
                                {h.quantityDifference > 0 ? `+${h.quantityDifference}` : h.quantityDifference}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{h.newPeriod || 'Current'}</td>
                          <td style={{ padding: '8px 10px', color: '#334155', maxWidth: 220 }}>{h.reason || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            {h.performedBy || 'System Admin'} ({h.performedByRole || 'SUPER_ADMIN'})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: LICENCE USAGE DASHBOARD */}
          {customerModalTab === 'licence_usage' && entitlementSummary && (
            <div>
              <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Authoritative Licence Usage Dashboard
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* User Licence Gauge */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={18} color="#2563eb" />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>User Licences Gauge</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                      {entitlementSummary.userLicences.usagePercentage}%
                    </span>
                  </div>
                  <div style={{ height: 14, background: '#f1f5f9', borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, entitlementSummary.userLicences.usagePercentage)}%`,
                        background: entitlementSummary.userLicences.available === 0 ? '#ef4444' : '#2563eb',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span>Used: <strong>{entitlementSummary.userLicences.used}</strong> active users</span>
                    <span>Purchased: <strong>{entitlementSummary.userLicences.purchased}</strong></span>
                    <span style={{ color: entitlementSummary.userLicences.available > 0 ? '#166534' : '#dc2626', fontWeight: 700 }}>
                      {entitlementSummary.userLicences.available} Available
                    </span>
                  </div>
                </div>

                {/* Company Licence Gauge */}
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={18} color="#0284c7" />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>Company Licences Gauge</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>
                      {entitlementSummary.companyLicences.usagePercentage}%
                    </span>
                  </div>
                  <div style={{ height: 14, background: '#f1f5f9', borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, entitlementSummary.companyLicences.usagePercentage)}%`,
                        background: entitlementSummary.companyLicences.available === 0 ? '#ef4444' : '#0284c7',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span>Used: <strong>{entitlementSummary.companyLicences.used}</strong> companies</span>
                    <span>Purchased: <strong>{entitlementSummary.companyLicences.purchased}</strong></span>
                    <span style={{ color: entitlementSummary.companyLicences.available > 0 ? '#166534' : '#dc2626', fontWeight: 700 }}>
                      {entitlementSummary.companyLicences.available} Available
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: AUDIT HISTORY */}
          {customerModalTab === 'audit_history' && (
            <div>
              <h4 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Customer Administrative Audit Stream
              </h4>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  All administrative changes, licence expansions, deactivations, and renewals are tracked with permanent server-side timestamps and actor user IDs.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={() => setSelectedCompany(null)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )}

  {/* LICENCE EXPANSION MODAL */}
  {showExpansionModal && entitlementSummary && (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">
            Increase {showExpansionModal === 'USER' ? 'User Licences' : 'Company Licences'}
          </div>
          <button onClick={() => setShowExpansionModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          {expansionError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 10, color: '#991b1b', fontSize: 12, marginBottom: 12 }}>
              {expansionError}
            </div>
          )}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: 10, fontSize: 12, color: '#1e40af', marginBottom: 14 }}>
            <strong>Current Allocation:</strong> {showExpansionModal === 'USER' ? entitlementSummary.userLicences.purchased : entitlementSummary.companyLicences.purchased} licences.
            <div style={{ marginTop: 4 }}>Notice: Before expiry, licences can increase, but cannot decrease.</div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              New Total Quantity *
            </label>
            <input
              type="number"
              className="form-control"
              value={expansionQuantity}
              min={showExpansionModal === 'USER' ? entitlementSummary.userLicences.purchased : entitlementSummary.companyLicences.purchased}
              onChange={(e) => setExpansionQuantity(Number(e.target.value))}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Reason / PO Reference (Optional)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Q4 Team Expansion, PO-9921"
              value={expansionReason}
              onChange={(e) => setExpansionReason(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowExpansionModal(null)} disabled={savingExpansion}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleExecuteExpansion} disabled={savingExpansion}>
            {savingExpansion ? 'Expanding...' : 'Confirm Expansion'}
          </button>
        </div>
      </div>
    </div>
  )}

  {/* SUBSCRIPTION RENEWAL MODAL */}
  {showRenewalModal && entitlementSummary && (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Renew Customer Subscription</div>
          <button onClick={() => setShowRenewalModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          {renewalError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: 10, color: '#991b1b', fontSize: 12, marginBottom: 12 }}>
              {renewalError}
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Renewal Validity Period *
            </label>
            <select
              className="form-control"
              value={renewalMonths}
              onChange={(e) => setRenewalMonths(Number(e.target.value))}
            >
              <option value={12}>12 Months (1 Year Standard)</option>
              <option value={24}>24 Months (2 Years Enterprise)</option>
              <option value={36}>36 Months (3 Years Long Term)</option>
              <option value={6}>6 Months (Semi-Annual)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                User Licences Quantity
              </label>
              <input
                type="number"
                className="form-control"
                value={renewalUserQty}
                min={entitlementSummary.userLicences.purchased}
                onChange={(e) => setRenewalUserQty(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                Company Licences Quantity
              </label>
              <input
                type="number"
                className="form-control"
                value={renewalCompQty}
                min={entitlementSummary.companyLicences.purchased}
                onChange={(e) => setRenewalCompQty(Number(e.target.value))}
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Payment / Invoice Reference
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. INV-2027-0091"
              value={renewalRef}
              onChange={(e) => setRenewalRef(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Renewal Notes
            </label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Annual SLA and software entitlement renewal"
              value={renewalNotes}
              onChange={(e) => setRenewalNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowRenewalModal(false)} disabled={savingRenewal}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleExecuteRenewal} disabled={savingRenewal}>
            {savingRenewal ? 'Executing Renewal...' : 'Execute Renewal'}
          </button>
        </div>
      </div>
    </div>
  )}

      {/* EDIT CUSTOMER MODAL */}
      {showEditModal && editingCompany && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Edit2 size={20} color="#2563eb" />
                <div>
                  <div className="modal-title">Edit Customer — {editFormData.company_name || editingCompany.id}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>ID: {editingCompany.id} • Configure company details and product/module entitlements</div>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setEditActiveTab('details')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: editActiveTab === 'details' ? '2px solid #2563eb' : 'none',
                  color: editActiveTab === 'details' ? '#2563eb' : '#64748b',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                1. Company Details
              </button>
              <button
                type="button"
                onClick={() => setEditActiveTab('entitlements')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: editActiveTab === 'entitlements' ? '2px solid #2563eb' : 'none',
                  color: editActiveTab === 'entitlements' ? '#2563eb' : '#64748b',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Package size={14} />
                2. Product & Module Entitlements ({editFormData.product_ids.length})
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {editFormError && (
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
                    <span>{editFormError}</span>
                  </div>
                )}

                {editActiveTab === 'details' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* SECTION 1: CUSTOMER IDENTIFICATION & CORPORATE PROFILE */}
                    <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          1. Customer Identification & Corporate Profile
                        </div>
                        <span style={{ fontSize: 11, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                          ID: {editFormData.id || editingCompany.id}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Customer ID (Read-Only)</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editFormData.id || editingCompany.id}
                            disabled
                            readOnly
                            style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b', fontWeight: 600 }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Company / Organization Name *</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            placeholder="Enter company or legal corporate name"
                            value={editFormData.company_name}
                            onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Office Address *</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          placeholder="Registered corporate / office address"
                          value={editFormData.address}
                          onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>GSTN / Tax ID (Optional)</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="15-character GSTIN (e.g. 27AABCU9603R1ZM)"
                            maxLength={15}
                            value={editFormData.gstn}
                            onChange={(e) => setEditFormData({ ...editFormData, gstn: e.target.value.toUpperCase() })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Customer Account Status (Is Active) *</label>
                          <select
                            className="form-control"
                            value={editFormData.is_active}
                            onChange={(e) => setEditFormData({ ...editFormData, is_active: Number(e.target.value) })}
                            style={{ fontWeight: 600, color: editFormData.is_active === 1 ? '#15803d' : '#b91c1c' }}
                          >
                            <option value={1}>Active — Operational & Enabled</option>
                            <option value={0}>Inactive — Suspended / Disabled</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Primary Corporate Email *</label>
                          <input
                            type="email"
                            className="form-control"
                            required
                            placeholder="e.g. contact@company.com"
                            value={editFormData.primary_email}
                            onChange={(e) => setEditFormData({ ...editFormData, primary_email: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Alternate Emails (Optional)</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. billing@company.com, alerts@company.com"
                            value={editFormData.alternate_emails}
                            onChange={(e) => setEditFormData({ ...editFormData, alternate_emails: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: PRIMARY CONTACT DETAILS */}
                    <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        2. Primary Contact Details
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Primary Contact Person *</label>
                          <input
                            type="text"
                            className="form-control"
                            required
                            placeholder="Full name of primary coordinator"
                            value={editFormData.contact_person}
                            onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Primary Contact Phone *</label>
                          <PhoneInput
                            required
                            value={editFormData.contact_phone}
                            onChange={(val) => setEditFormData({ ...editFormData, contact_phone: val })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Contact Location (Optional)</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Head Office 4th Floor / Mumbai Branch"
                            value={editFormData.contact_address}
                            onChange={(e) => setEditFormData({ ...editFormData, contact_address: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Contact Status *</label>
                          <select
                            className="form-control"
                            value={editFormData.contact_status}
                            onChange={(e) => setEditFormData({ ...editFormData, contact_status: e.target.value })}
                            style={{ fontWeight: 600 }}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="VERIFIED">VERIFIED</option>
                            <option value="PENDING">PENDING</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: ALTERNATE CONTACT (OPTIONAL) */}
                    <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        3. Alternate Contact Details (Optional)
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Alternate Contact Person</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Secondary contact or escalation person"
                            value={editFormData.alternate_contact}
                            onChange={(e) => setEditFormData({ ...editFormData, alternate_contact: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Alternate Contact Phone</label>
                          <PhoneInput
                            value={editFormData.alternate_contact_phone}
                            onChange={(val) => setEditFormData({ ...editFormData, alternate_contact_phone: val })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Alternate Contact Email</label>
                          <input
                            type="email"
                            className="form-control"
                            placeholder="e.g. escalation@company.com"
                            value={editFormData.alternate_contact_email}
                            onChange={(e) => setEditFormData({ ...editFormData, alternate_contact_email: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Alternate Contact Location / Address</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Pune Regional Hub"
                            value={editFormData.alternate_contact_address}
                            onChange={(e) => setEditFormData({ ...editFormData, alternate_contact_address: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <CustomerProductEntitlementSelector
                      products={products}
                      value={editFormData.productEntitlements}
                      onChange={(ents, pIds) =>
                        setEditFormData({ ...editFormData, productEntitlements: ents, product_ids: pIds })
                      }
                      title="Purchased Products & Modules"
                      subtitle="Select products and optional modules for this customer. Module selection is completely optional."
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  {editActiveTab === 'entitlements' && (
                    <button type="button" className="btn btn-secondary" onClick={() => setEditActiveTab('details')}>
                      ← Back to Details
                    </button>
                  )}
                  {editActiveTab === 'details' && (
                    <button type="button" className="btn btn-secondary" onClick={() => setEditActiveTab('entitlements')}>
                      Configure Entitlements →
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                    <Save size={14} />
                    {savingEdit ? 'Saving Changes...' : 'Save Customer Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CUSTOMER MODAL (Workflow with Mandatory Product Selection) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 840, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
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
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
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
                2. Products &amp; Modules Purchased *
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
                3. Review &amp; Register
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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
                        <PhoneInput
                          required
                          value={formData.contact_phone}
                          onChange={(val) => setFormData({ ...formData, contact_phone: val })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: PRODUCTS PURCHASED (Mandatory) */}
                {createStep === 2 && (
                  <div>
                    <CustomerProductEntitlementSelector
                      products={products}
                      value={formData.productEntitlements}
                      onChange={(ents, pIds) =>
                        setFormData({
                          ...formData,
                          productEntitlements: ents,
                          product_ids: pIds,
                        })
                      }
                      title="Select Purchased Products & Modules"
                      subtitle="Choose products purchased by the customer. Selecting a product does NOT automatically include all modules or submodules."
                      error={formData.product_ids.length === 0 ? 'At least one product must be selected.' : null}
                    />
                  </div>
                )}

                {/* STEP 3: REVIEW & REGISTER */}
                {createStep === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Top Section: REVIEW CUSTOMER DETAILS */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Review Customer Details
                        </span>
                        <button
                          type="button"
                          onClick={() => setCreateStep(1)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        >
                          Edit Details
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        {/* Company Card */}
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Company</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                            {formData.company_name || '—'}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginTop: 6, textTransform: 'uppercase' }}>Customer ID</div>
                          <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Generated after registration</div>
                        </div>

                        {/* Contact Card */}
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Contact</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                            {formData.contact_person || '—'}
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                            📞 {formData.contact_phone || '—'}
                          </div>
                        </div>

                        {/* Email & GST Card */}
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Email</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginTop: 2, wordBreak: 'break-all' }}>
                            {formData.primary_email || '—'}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginTop: 6, textTransform: 'uppercase' }}>GST Number</div>
                          <div style={{ fontSize: 11, color: formData.gstn ? '#0284c7' : '#64748b', fontWeight: formData.gstn ? 600 : 400 }}>
                            {formData.gstn || 'Not Provided'}
                          </div>
                        </div>

                        {/* Address Card */}
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #e2e8f0', gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Corporate Address</div>
                          <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>
                            📍 {formData.address || '—'}
                          </div>
                          {(formData.alternate_contact || formData.alternate_contact_phone || formData.alternate_contact_email) && (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, paddingTop: 4, borderTop: '1px dashed #e2e8f0' }}>
                              <span style={{ fontWeight: 600 }}>Alternate Contact: </span>
                              {formData.alternate_contact && <span>{formData.alternate_contact} </span>}
                              {formData.alternate_contact_phone && <span>• {formData.alternate_contact_phone} </span>}
                              {formData.alternate_contact_email && <span>• {formData.alternate_contact_email}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: PRODUCT ENTITLEMENTS */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Selected Product Entitlements
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '1px 7px', borderRadius: 10 }}>
                            {formData.product_ids.length} Product{formData.product_ids.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCreateStep(2)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                        >
                          Modify Products
                        </button>
                      </div>

                      {/* Empty State */}
                      {formData.product_ids.length === 0 ? (
                        <div
                          style={{
                            background: '#fffbeb',
                            border: '1px dashed #f59e0b',
                            borderRadius: 8,
                            padding: '20px 16px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                            No Products Selected
                          </div>
                          <div style={{ fontSize: 12, color: '#b45309', marginBottom: 12 }}>
                            Please go back to Products &amp; Modules and select at least one product before registering this customer.
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setCreateStep(2)}
                            style={{ color: '#92400e', borderColor: '#fcd34d' }}
                          >
                            ← Back to Products &amp; Modules
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {formData.productEntitlements.map((ent) => {
                            const prod = products.find((p) => p.id === ent.productId);
                            const isComplete = ent.purchaseType === 'COMPLETE';
                            const modulesList = ent.modules || [];
                            const totalModulesInMaster = prod?.modules?.length || 0;

                            return (
                              <div
                                key={ent.productId}
                                style={{
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                                    <span style={{ fontWeight: 700, color: '#0b3b60', fontSize: 13 }}>
                                      {prod ? prod.name : ent.productId}
                                    </span>
                                    {prod?.code && (
                                      <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>
                                        {prod.code}
                                      </span>
                                    )}
                                    {prod?.category && (
                                      <span style={{ fontSize: 11, color: '#64748b' }}>• {prod.category}</span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      background: isComplete ? '#f0fdf4' : '#eff6ff',
                                      color: isComplete ? '#15803d' : '#1d4ed8',
                                      border: `1px solid ${isComplete ? '#bbf7d0' : '#bfdbfe'}`,
                                    }}
                                  >
                                    {isComplete ? 'Complete Suite' : `${modulesList.length}/${totalModulesInMaster} modules`}
                                  </span>
                                </div>

                                {isComplete ? (
                                  <div style={{ fontSize: 11, color: '#15803d', marginTop: 6, fontWeight: 500 }}>
                                    ✓ All product modules and submodules included
                                  </div>
                                ) : modulesList.length > 0 ? (
                                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                                      Selected Modules ({modulesList.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {modulesList.map((m) => {
                                        const modObj = prod?.modules?.find((mod) => mod.id === m.moduleId);
                                        const subList = m.submoduleIds || [];
                                        return (
                                          <div key={m.moduleId} style={{ fontSize: 11, color: '#334155' }}>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                              <span style={{ color: '#16a34a' }}>•</span>
                                              <span>{modObj?.name || m.moduleId}</span>
                                              {subList.length > 0 && (
                                                <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 500 }}>
                                                  ({subList.length} submodules)
                                                </span>
                                              )}
                                            </div>
                                            {subList.length > 0 && (
                                              <div style={{ paddingLeft: 14, display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                                {subList.map((sId) => {
                                                  const subObj = modObj?.submodules?.find((s) => s.id === sId);
                                                  return (
                                                    <span
                                                      key={sId}
                                                      style={{
                                                        fontSize: 10,
                                                        background: '#f1f5f9',
                                                        color: '#475569',
                                                        padding: '1px 5px',
                                                        borderRadius: 3,
                                                        border: '1px solid #e2e8f0',
                                                      }}
                                                    >
                                                      {subObj?.name || sId}
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 6 }}>
                                    Product-level entitlement (No specific module restrictions)
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Bottom Section: FINAL CONFIRMATION */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        padding: '10px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#15803d', fontWeight: 600, flexWrap: 'wrap' }}>
                        <span>✓ Customer details are ready</span>
                        <span>✓ Product entitlements are configured</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Please review the information above before creating the customer.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  {createStep > 1 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCreateStep((prev) => (prev - 1) as any)}
                    >
                      ← Back
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
                        if (createStep === 1) {
                          const step1Err = validateCompanyStep1(formData);
                          if (step1Err) {
                            setFormError(step1Err);
                            return;
                          }
                        }
                        if (createStep === 2 && formData.product_ids.length === 0) {
                          setFormError('At least one product must be selected before registering a customer.');
                          return;
                        }
                        setFormError(null);
                        setCreateStep((prev) => (prev + 1) as any);
                      }}
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || formData.product_ids.length === 0}
                    >
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
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={20} color="#2563eb" />
                <div className="modal-title">Purchase Additional Product</div>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {productError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
                  {productError}
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Select Product to Add *</label>
                <select
                  className="form-control"
                  value={selectedNewProductId}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setSelectedNewProductId(pId);
                    if (pId) {
                      setNewProductEntitlements([
                        {
                          productId: pId,
                          purchaseType: 'SELECTED_MODULES',
                          modules: [],
                        },
                      ]);
                    } else {
                      setNewProductEntitlements([]);
                    }
                  }}
                >
                  <option value="">Choose a product from Product Master</option>
                  {products
                    .filter((p) => {
                      const owned = selectedCompany?.products?.some(
                        (cp: any) => (cp.product_id || cp.productId || cp.id) === p.id && cp.is_active !== 0
                      );
                      return !owned;
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Code: {p.code} ({p.category})
                      </option>
                    ))}
                </select>
              </div>

              {selectedNewProductId && (
                <div style={{ marginTop: 14 }}>
                  <CustomerProductEntitlementSelector
                    products={products.filter((p) => p.id === selectedNewProductId)}
                    value={newProductEntitlements}
                    onChange={(ents) => setNewProductEntitlements(ents)}
                    title="Configure Purchased Modules & Submodules"
                    subtitle="Select which modules and submodules under this product are purchased by the customer. All are unselected by default."
                  />
                </div>
              )}

              <div style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>
                Previously removed products can be re-added. Historical tickets and AMC records are always preserved.
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
        <div className="modal-backdrop" style={{ zIndex: 1100 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: 780,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 12,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Fixed Header */}
            <div
              className="modal-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 22px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: '#ecfdf5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={20} color="#059669" />
                </div>
                <div>
                  <div className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    {editingBranch ? 'Edit Customer Branch' : 'Add New Customer Branch'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <Building2 size={13} color="#64748b" />
                    <span>Parent Customer: <strong>{selectedCompany?.company_name || selectedCompany?.companyName}</strong></span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 16,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={handleSaveBranch}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              <div
                className="modal-body"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                {branchError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      borderRadius: 8,
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={16} color="#dc2626" />
                    <span>{branchError}</span>
                  </div>
                )}

                {/* Section 1: Branch Identification & Location */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={15} color="#0284c7" />
                    <span>Branch Identification & Location</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        Branch Name *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="e.g. Dahisar Branch, Kandivali Plant, Vapi Unit"
                        value={branchForm.branch_name}
                        onChange={(e) => setBranchForm({ ...branchForm, branch_name: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        GST Number
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="15-character GSTIN (Optional)"
                        value={branchForm.gstn}
                        onChange={(e) => setBranchForm({ ...branchForm, gstn: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                      Branch Address *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      style={{ height: 38, fontSize: 13 }}
                      placeholder="Full street / building / premises address"
                      value={branchForm.address}
                      onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        City *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="e.g. Mumbai"
                        value={branchForm.city}
                        onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        State *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="e.g. Maharashtra"
                        value={branchForm.state}
                        onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        PIN / Postal Code *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="e.g. 400068"
                        value={branchForm.pincode}
                        onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Contact Person */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={15} color="#059669" />
                    <span>Branch Contact Person</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        Contact Person *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="Branch Manager / Lead Name"
                        value={branchForm.contact_person}
                        onChange={(e) => setBranchForm({ ...branchForm, contact_person: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        Contact Phone *
                      </label>
                      <PhoneInput
                        required
                        value={branchForm.contact_phone}
                        onChange={(val) => setBranchForm({ ...branchForm, contact_phone: val })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                        Contact Email *
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        style={{ height: 38, fontSize: 13 }}
                        placeholder="branch@company.com"
                        value={branchForm.contact_email}
                        onChange={(e) => setBranchForm({ ...branchForm, contact_email: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Branch Product -> Module -> Submodule Entitlements */}
                <div>
                  <CustomerProductEntitlementSelector
                    products={parentCustomerProducts}
                    value={branchForm.productEntitlements}
                    onChange={(ents, pIds) =>
                      setBranchForm({
                        ...branchForm,
                        productEntitlements: ents,
                        product_ids: pIds,
                      })
                    }
                    title="Branch Product, Module & Submodule Entitlements"
                    subtitle="Select specific products, modules, and submodules enabled for this branch location (subset of parent customer)."
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div
                className="modal-footer"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  padding: '14px 24px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#ffffff',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBranchModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingBranch}
                >
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
