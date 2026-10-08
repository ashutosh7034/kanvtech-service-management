import React, { useState, useEffect } from 'react';
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
  Trash2,
  Edit2,
  Layers,
  CheckSquare,
  Square,
  AlertCircle,
  Save,
  Sliders,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { isValidEmail, isValidPhone, isValidGSTN, validatePhoneDetailed } from '../../utils/validation';
import { PhoneInput } from '../../components/common/PhoneInput';

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
  });
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
    loadProducts();
  }, [page, search, statusFilter]);

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
      company_name: rawCompany.company_name || '',
      address: rawCompany.address || '',
      gstn: rawCompany.gstn || '',
      primary_email: rawCompany.primary_email || '',
      contact_person: rawCompany.contact_person || '',
      contact_phone: rawCompany.contact_phone || '',
      alternate_contact: rawCompany.alternate_contact || '',
      alternate_contact_phone: rawCompany.alternate_contact_phone || '',
      alternate_contact_email: rawCompany.alternate_contact_email || '',
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

    // Must have at least 1 product
    if (editFormData.product_ids.length === 0) {
      setEditFormError('A customer must have at least one product entitlement.');
      return;
    }

    setSavingEdit(true);
    try {
      await api.updateCompany(editingCompany.id, {
        company_name: editFormData.company_name,
        address: editFormData.address,
        gstn: editFormData.gstn,
        primary_email: editFormData.primary_email,
        contact_person: editFormData.contact_person,
        contact_phone: editFormData.contact_phone,
        alternate_contact: editFormData.alternate_contact,
        alternate_contact_phone: editFormData.alternate_contact_phone,
        alternate_contact_email: editFormData.alternate_contact_email,
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
      gstn: branch.gstn || '',
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
                            {/* Fix: use p.name (list API) or p.product_name (detail API) */}
                            {p.name || p.product_name || p.product?.name || p.code || 'Product'}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSelectedCompany(null); handleOpenEdit(selectedCompany); }}
                  style={{ color: '#2563eb' }}
                >
                  <Edit2 size={13} /> Edit Customer
                </button>
                <button
                  onClick={() => setSelectedCompany(null)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
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
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCompany(null)}>
                Close
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
                  <div>
                    <div className="form-group">
                      <label className="form-label">Company / Organization Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={editFormData.company_name}
                        onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Primary Corporate Email *</label>
                        <input
                          type="email"
                          className="form-control"
                          required
                          value={editFormData.primary_email}
                          onChange={(e) => setEditFormData({ ...editFormData, primary_email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">GST Number (Optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={editFormData.gstn}
                          onChange={(e) => setEditFormData({ ...editFormData, gstn: e.target.value.toUpperCase() })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Full Corporate Address *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Primary Contact Person *</label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          value={editFormData.contact_person}
                          onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Contact Phone *</label>
                        <PhoneInput
                          required
                          value={editFormData.contact_phone}
                          onChange={(val) => setEditFormData({ ...editFormData, contact_phone: val })}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
                        ALTERNATE CONTACT (Optional)
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Alternate Contact Name</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editFormData.alternate_contact}
                            onChange={(e) => setEditFormData({ ...editFormData, alternate_contact: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Alternate Contact Phone</label>
                          <PhoneInput
                            value={editFormData.alternate_contact_phone}
                            onChange={(val) => setEditFormData({ ...editFormData, alternate_contact_phone: val })}
                          />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label className="form-label">Alternate Contact Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={editFormData.alternate_contact_email}
                            onChange={(e) => setEditFormData({ ...editFormData, alternate_contact_email: e.target.value })}
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
                  <label className="form-label">GST Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter GST Number (Optional)"
                    value={branchForm.gstn}
                    onChange={(e) => setBranchForm({ ...branchForm, gstn: e.target.value.toUpperCase() })}
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
                    <PhoneInput
                      required
                      value={branchForm.contact_phone}
                      onChange={(val) => setBranchForm({ ...branchForm, contact_phone: val })}
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
                      const pName = cp.name || cp.product_name || cp.product?.name;
                      const pCode = cp.code || cp.product_code || cp.product?.code;
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
                          {selected ? '✓ ' : '+ '} {pName} {pCode ? `(${pCode})` : ''}
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
