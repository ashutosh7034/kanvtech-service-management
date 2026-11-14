import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Employee, Department } from '../../types';
import { Users, Search, Plus, ShieldAlert, CheckCircle2, Clock, Layers, KeyRound, ShieldCheck, Eye, EyeOff, AlertCircle, Edit2, Trash2, Power, UserCheck, UserX, History, Check, X, Loader2, Sparkles, Mail, Phone, Briefcase } from 'lucide-react';
import { isValidEmail, isValidPhone, validatePhoneDetailed } from '../../utils/validation';
import { PhoneInput } from '../../components/common/PhoneInput';

export const EmployeesPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canCreateEmployee = isAdmin || hasPermission('employee.create');
  const canUpdateEmployee = isAdmin || hasPermission('employee.update');
  const canDeleteEmployee = isAdmin || hasPermission('employee.delete');
  const canActivateEmployee = isAdmin || hasPermission('employee.activate');
  const canViewUserId = isAdmin || hasPermission('employee.user_id.view');
  const canCreateUserId = isAdmin || hasPermission('employee.user_id.create');
  const canUpdateUserId = isAdmin || hasPermission('employee.user_id.update');
  const canCheckAvailability = isAdmin || hasPermission('employee.user_id.availability_check');
  const hasAnyEmployeeAction = isAdmin || canUpdateEmployee || canDeleteEmployee || canActivateEmployee;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Custom User ID Availability & History State
  const [createUserIdStatus, setCreateUserIdStatus] = useState<{ checking: boolean; available: boolean | null; message: string | null }>({ checking: false, available: null, message: null });
  const [editUserIdStatus, setEditUserIdStatus] = useState<{ checking: boolean; available: boolean | null; message: string | null }>({ checking: false, available: null, message: null });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [historyTarget, setHistoryTarget] = useState<Employee | null>(null);

  const checkAvailability = async (val: string, currentEmpId?: string, isEdit = false) => {
    const trimmed = val.trim().toLowerCase();
    const setStatus = isEdit ? setEditUserIdStatus : setCreateUserIdStatus;
    if (!trimmed) {
      setStatus({ checking: false, available: null, message: null });
      return;
    }
    const regex = /^[a-zA-Z0-9._-]+$/;
    if (trimmed.length < 3 || trimmed.length > 30 || !regex.test(trimmed)) {
      setStatus({ checking: false, available: false, message: 'Must be 3-30 chars (letters, numbers, dot, dash, underscore)' });
      return;
    }
    setStatus({ checking: true, available: null, message: null });
    try {
      const res = await api.checkUserIdAvailability(trimmed, currentEmpId);
      if (res && res.available) {
        setStatus({ checking: false, available: true, message: 'Available' });
      } else {
        setStatus({ checking: false, available: false, message: res?.message || 'User ID is unavailable' });
      }
    } catch (err: any) {
      setStatus({ checking: false, available: false, message: err.message || 'Error checking availability' });
    }
  };

  const handleOpenHistory = async (emp: Employee) => {
    setHistoryTarget(emp);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await api.getEmployeeUserIdHistory(emp.id);
      setHistoryRecords(res.history || []);
    } catch (err: any) {
      console.error('Failed to load user ID history:', err);
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    custom_user_id: '',
    email: '',
    phone: '',
    alternate_emails: [] as string[],
    alternate_phones: [] as string[],
    department_id: '',
    designation: 'L1 Support Specialist',
    level: 'L1' as 'MANAGER' | 'L1' | 'L2' | 'L3',
    role: 'L1_EMPLOYEE' as string,
    manager_id: '',
    password: '',
    availability: 'AVAILABLE',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Field refs for smooth scroll-to-error in modal
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const emailInputRef = React.useRef<HTMLInputElement>(null);
  const customUserIdInputRef = React.useRef<HTMLInputElement>(null);
  const phoneContainerRef = React.useRef<HTMLDivElement>(null);
  const departmentSelectRef = React.useRef<HTMLSelectElement>(null);
  const roleSelectRef = React.useRef<HTMLSelectElement>(null);
  const designationInputRef = React.useRef<HTMLInputElement>(null);
  const passwordInputRef = React.useRef<HTMLInputElement>(null);
  const modalBodyRef = React.useRef<HTMLDivElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if ('focus' in ref.current && typeof (ref.current as any).focus === 'function') {
        (ref.current as any).focus();
      }
    }
  };

  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*_-';
    const all = upper + lower + digits + special;
    const parts = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      special[Math.floor(Math.random() * special.length)],
    ];
    for (let i = 0; i < 8; i++) {
      parts.push(all[Math.floor(Math.random() * all.length)]);
    }
    const generated = parts.sort(() => Math.random() - 0.5).join('');
    setFormData((prev) => ({ ...prev, password: generated }));
    setShowCreatePassword(true);
  };

  // Admin Reset Password Modal State
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);

  const [levelMgmtEnabled, setLevelMgmtEnabled] = useState(true);
  const [tenantEntitlement, setTenantEntitlement] = useState<any | null>(null);

  const loadTenantEntitlement = async () => {
    try {
      const res = await api.getTenantEntitlement();
      if (res?.entitlement) {
        setTenantEntitlement(res.entitlement);
      }
    } catch (err) {
      console.warn('Failed to load tenant entitlement:', err);
    }
  };

  useEffect(() => {
    loadTenantEntitlement();
  }, []);

  const handleToggleLevelMgmt = async () => {
    try {
      const newState = !levelMgmtEnabled;
      await api.toggleLevelManagement(newState);
      setLevelMgmtEnabled(newState);
    } catch (err: any) {
      alert(`Failed to toggle: ${err.message}`);
    }
  };

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setErrorMessage(null);
    }
    setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4000);
  };

  // Edit Employee Modal State
  const [showEditModal, setShowEditModal] = useState(false);

  // Prevent background page scrolling when modal is open
  useEffect(() => {
    if (showCreateModal || showEditModal || showHistoryModal || showResetPassword) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showCreateModal, showEditModal, showHistoryModal, showResetPassword]);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    custom_user_id: '',
    change_reason: '',
    email: '',
    phone: '',
    alternate_emails: [] as string[],
    alternate_phones: [] as string[],
    department_id: '',
    designation: 'L1 Support Specialist',
    level: 'L1' as 'MANAGER' | 'L1' | 'L2' | 'L3',
    manager_id: '',
    availability: 'AVAILABLE',
    status: 'ACTIVE',
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    const altEmails = emp.alternate_emails || (emp as any).alternateEmails;
    const altPhones = emp.alternate_phones || (emp as any).alternatePhones;
    setEditUserIdStatus({ checking: false, available: null, message: null });
    setEditFormData({
      name: emp.name || '',
      custom_user_id: emp.custom_user_id || (emp as any).customUserId || '',
      change_reason: '',
      email: emp.email || '',
      phone: emp.phone || '',
      alternate_emails: altEmails ? altEmails.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      alternate_phones: altPhones ? altPhones.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      department_id: emp.department_id || (emp as any).departmentId || '',
      designation: emp.designation || 'L1 Support Specialist',
      level: (emp.level || 'L1') as any,
      manager_id: emp.manager_id || (emp as any).managerId || '',
      availability: emp.availability || 'AVAILABLE',
      status: emp.status || 'ACTIVE',
    });
    setEditFormError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!editFormData.name.trim()) {
      setEditFormError('Employee name is required.');
      return;
    }
    if (!editFormData.phone.trim()) {
      setEditFormError('Contact phone is required.');
      return;
    }
    const phoneVal = validatePhoneDetailed(editFormData.phone);
    if (!phoneVal.valid) {
      setEditFormError(phoneVal.error || 'Please enter a valid contact phone number.');
      return;
    }

    for (const ph of editFormData.alternate_phones) {
      if (ph.trim()) {
        const altPhoneVal = validatePhoneDetailed(ph);
        if (!altPhoneVal.valid) {
          setEditFormError(`Invalid alternate phone: ${altPhoneVal.error}`);
          return;
        }
      }
    }

    const currentCustomId = (editingEmployee.custom_user_id || (editingEmployee as any).customUserId || '').trim().toLowerCase();
    const newCustomId = (editFormData.custom_user_id || '').trim().toLowerCase();
    if (newCustomId && newCustomId !== currentCustomId) {
      const confirmChange = window.confirm(
        `Are you sure you want to change this employee's Login User ID from "${currentCustomId || 'None'}" to "${newCustomId}"? The previous identifier will be permanently retired and cannot be reassigned.`
      );
      if (!confirmChange) return;
    }

    setEditSaving(true);
    try {
      const payload = {
        ...editFormData,
        custom_user_id: editFormData.custom_user_id ? editFormData.custom_user_id.trim() : undefined,
        change_reason: editFormData.change_reason ? editFormData.change_reason.trim() : undefined,
        manager_id: editFormData.manager_id ? editFormData.manager_id.trim() : null,
        alternate_emails: editFormData.alternate_emails.filter(e => e.trim() !== '').join(','),
        alternate_phones: editFormData.alternate_phones.filter(p => p.trim() !== '').join(','),
      };
      await api.updateEmployee(editingEmployee.id, payload);
      setShowEditModal(false);
      await loadEmployees();
      showFeedback(`Employee "${editFormData.name}" updated successfully.`);
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to update employee');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    const isActivating = emp.status !== 'ACTIVE';
    if (!isActivating && !isAdmin) {
      showFeedback('Only Tenant Super Admin can deactivate employees and release User Licences.', true);
      return;
    }
    const confirmMsg = isActivating
      ? `Activate employee "${emp.name}" (${emp.id})? This will consume 1 User Licence.`
      : `Deactivate employee "${emp.name}" (${emp.id})? This will immediately release 1 User Licence for reuse.`;
    if (!window.confirm(confirmMsg)) return;
    setActionLoadingId(emp.id);
    try {
      await api.toggleEmployeeStatus(emp.id);
      await loadEmployees();
      await loadTenantEntitlement();
      showFeedback(`Employee "${emp.name}" ${isActivating ? 'activated' : 'deactivated (1 User Licence released for reuse)'} successfully.`);
    } catch (err: any) {
      showFeedback(`Failed to ${isActivating ? 'activate' : 'deactivate'} employee: ${err.message}`, true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePromote = async (emp: Employee) => {
    // Correct 4-Tier Ladder: L1 -> L2 -> L3 -> MANAGER
    const nextTier = emp.level === 'L1' ? 'L2' : emp.level === 'L2' ? 'L3' : emp.level === 'L3' ? 'MANAGER' : null;
    if (!nextTier) {
      showFeedback(`Cannot promote employee at level ${emp.level}.`, true);
      return;
    }
    if (!window.confirm(`Promote ${emp.name} from ${emp.level} to ${nextTier} in ${emp.department}?`)) return;
    setActionLoadingId(emp.id);
    try {
      await api.promoteEmployee(emp.id);
      await loadEmployees();
      showFeedback(`Employee "${emp.name}" promoted to ${nextTier} successfully.`);
    } catch (err: any) {
      showFeedback(`Unable to promote employee. ${err.message || 'Please try again.'}`, true);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDemote = async (emp: Employee) => {
    // Correct 4-Tier Ladder: MANAGER -> L3 -> L2 -> L1
    const prevTier = emp.level === 'MANAGER' ? 'L3' : emp.level === 'L3' ? 'L2' : emp.level === 'L2' ? 'L1' : null;
    if (!prevTier) {
      showFeedback(`Cannot demote employee at level ${emp.level}.`, true);
      return;
    }
    if (!window.confirm(`Demote ${emp.name} from ${emp.level} to ${prevTier} in ${emp.department}?`)) return;
    setActionLoadingId(emp.id);
    try {
      await api.demoteEmployee(emp.id);
      await loadEmployees();
      showFeedback(`Employee "${emp.name}" demoted to ${prevTier} successfully.`);
    } catch (err: any) {
      showFeedback(`Unable to demote employee. ${err.message || 'Please try again.'}`, true);
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    loadDepartments();
    api.getLevelManagementStatus().then(res => {
      if (res.success) setLevelMgmtEnabled(res.enabled);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [levelFilter, departmentFilter, availFilter, search]);

  const loadDepartments = async () => {
    try {
      const res = await api.getDepartments();
      const depts: Department[] = Array.isArray(res) ? res : res.departments || res.data || [];
      setDepartments(depts);
      if (depts.length > 0 && !formData.department_id) {
        setFormData((prev) => ({ ...prev, department_id: depts[0].id }));
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.getEmployees({
        level: levelFilter,
        departmentId: departmentFilter,
        availability: availFilter,
        search,
      });
      setEmployees(res.data || res.employees || []);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
    // Explicitly return to allow callers to await
  };

  const handleOpenCreateModal = async () => {
    setFormError(null);
    setCreateUserIdStatus({ checking: false, available: null, message: null });
    setShowCreatePassword(false);
    setFormData({
      name: '',
      custom_user_id: '',
      email: '',
      phone: '',
      alternate_emails: [],
      alternate_phones: [],
      department_id: departments[0]?.id || '',
      designation: 'L1 Support Specialist',
      level: 'L1',
      role: 'L1_EMPLOYEE',
      manager_id: '',
      password: '',
      availability: 'AVAILABLE',
    });
    await loadTenantEntitlement();
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    if (saving) return;
    setShowCreateModal(false);
    setFormError(null);
    setCreateUserIdStatus({ checking: false, available: null, message: null });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Check Licence Capacity & Subscription
    if (tenantEntitlement) {
      if (tenantEntitlement.subscription?.isExpired) {
        setFormError('Tenant subscription has expired. Employee creation is blocked. Please renew subscription in Customer Master.');
        if (modalBodyRef.current) modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (tenantEntitlement.available_user_licences <= 0) {
        setFormError(`User Licence capacity reached (${tenantEntitlement.active_licensed_users} of ${tenantEntitlement.user_licences_purchased} in use). Please purchase additional licences or deactivate an existing employee.`);
        if (modalBodyRef.current) modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // 2. Validate Full Name
    if (!formData.name.trim()) {
      setFormError('Employee full name is required.');
      scrollToRef(nameInputRef);
      return;
    }

    // 3. Validate Corporate Email
    if (!formData.email.trim()) {
      setFormError('Email address is required.');
      scrollToRef(emailInputRef);
      return;
    }
    if (!isValidEmail(formData.email)) {
      setFormError('Please enter a valid corporate email address (e.g. employee@kanvtech.com).');
      scrollToRef(emailInputRef);
      return;
    }

    // 4. Validate Custom Login User ID if entered
    if (formData.custom_user_id.trim()) {
      const customIdVal = formData.custom_user_id.trim().toLowerCase();
      const regex = /^[a-zA-Z0-9._-]+$/;
      if (customIdVal.length < 3 || customIdVal.length > 40 || !regex.test(customIdVal)) {
        setFormError('Custom Login User ID must be 3-40 characters (letters, numbers, dot, dash, underscore).');
        scrollToRef(customUserIdInputRef);
        return;
      }
      if (createUserIdStatus.available === false) {
        setFormError(createUserIdStatus.message || 'The specified Custom User ID is unavailable or already in use.');
        scrollToRef(customUserIdInputRef);
        return;
      }
    }

    // 5. Validate Primary Contact Phone
    if (!formData.phone.trim()) {
      setFormError('Contact phone is required.');
      scrollToRef(phoneContainerRef);
      return;
    }
    const phoneVal = validatePhoneDetailed(formData.phone);
    if (!phoneVal.valid) {
      setFormError(phoneVal.error || 'Please enter a valid contact phone number.');
      scrollToRef(phoneContainerRef);
      return;
    }

    // 6. Validate Additional Emails
    for (let i = 0; i < formData.alternate_emails.length; i++) {
      const altEm = formData.alternate_emails[i];
      if (altEm.trim() && !isValidEmail(altEm)) {
        setFormError(`Additional email #${i + 1} ("${altEm}") is invalid. Please enter a valid email format.`);
        return;
      }
    }

    // 7. Validate Additional Phones
    for (let i = 0; i < formData.alternate_phones.length; i++) {
      const altPh = formData.alternate_phones[i];
      if (altPh.trim()) {
        const altPhoneVal = validatePhoneDetailed(altPh);
        if (!altPhoneVal.valid) {
          setFormError(`Additional phone #${i + 1} is invalid: ${altPhoneVal.error}`);
          return;
        }
      }
    }

    // 8. Validate Department
    if (!formData.department_id) {
      setFormError('Department specialization is required.');
      scrollToRef(departmentSelectRef);
      return;
    }

    // 9. Validate Job Designation
    if (!formData.designation.trim()) {
      setFormError('Job designation is required.');
      scrollToRef(designationInputRef);
      return;
    }

    // 10. Validate Password if entered
    if (formData.password.trim()) {
      const pwd = formData.password.trim();
      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasDigit = /[0-9]/.test(pwd);
      const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
      if (pwd.length < 8 || !hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        setFormError('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.');
        scrollToRef(passwordInputRef);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        custom_user_id: formData.custom_user_id.trim() ? formData.custom_user_id.trim() : undefined,
        manager_id: formData.manager_id ? formData.manager_id.trim() : null,
        alternate_emails: formData.alternate_emails.filter((e) => e.trim() !== '').join(','),
        alternate_phones: formData.alternate_phones.filter((p) => p.trim() !== '').join(','),
        password: formData.password.trim() ? formData.password.trim() : undefined,
      };
      await api.createEmployee(payload);
      setShowCreateModal(false);
      setCreateUserIdStatus({ checking: false, available: null, message: null });
      setFormData({
        name: '',
        custom_user_id: '',
        email: '',
        phone: '',
        alternate_emails: [],
        alternate_phones: [],
        department_id: departments[0]?.id || '',
        designation: 'L1 Support Specialist',
        level: 'L1',
        role: 'L1_EMPLOYEE',
        manager_id: '',
        password: '',
        availability: 'AVAILABLE',
      });
      await loadEmployees();
      await loadTenantEntitlement();
      showFeedback(`Specialist employee "${formData.name.trim()}" registered successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee profile');
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Promotion/Demotion feedback banner */}
      {successMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 8,
          padding: '12px 20px', color: '#15803d', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 420,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>✓</span>
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 8,
          padding: '12px 20px', color: '#dc2626', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 420,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>✕</span>
          {errorMessage}
        </div>
      )}
      <div className="page-header">
        <div>
          <h2 className="page-title">Specialist Employee Directory & Support Tiers</h2>
          <div className="page-subtitle">Product-specialized roster across Manager, L1, and L2 tiers with live workload allocation</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {tenantEntitlement && (
            <div style={{
              background: tenantEntitlement.available_user_licences > 0 ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${tenantEntitlement.available_user_licences > 0 ? '#86efac' : '#fca5a5'}`,
              borderRadius: 8,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: tenantEntitlement.available_user_licences > 0 ? '#15803d' : '#b91c1c'
            }}>
              <Users size={14} />
              <span>User Licences: {tenantEntitlement.active_licensed_users} / {tenantEntitlement.user_licences_purchased} ({tenantEntitlement.available_user_licences} available)</span>
            </div>
          )}
          {isAdmin && (
            <button 
              className={`btn btn-sm ${levelMgmtEnabled ? 'btn-outline' : ''}`}
              style={{ backgroundColor: levelMgmtEnabled ? 'transparent' : '#fee2e2', borderColor: levelMgmtEnabled ? '#94a3b8' : '#ef4444', color: levelMgmtEnabled ? '#475569' : '#b91c1c' }}
              onClick={handleToggleLevelMgmt}
            >
              {levelMgmtEnabled ? 'Disable Promotions' : 'Enable Promotions'}
            </button>
          )}
          {canCreateEmployee && (
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={15} /> Add Specialist Employee
            </button>
          )}
        </div>
      </div>

      {tenantEntitlement && tenantEntitlement.available_user_licences <= 0 && (
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#9f1239',
          fontSize: 13,
          fontWeight: 600
        }}>
          <AlertCircle size={18} />
          <span>User Licence capacity reached. You have used all {tenantEntitlement.user_licences_purchased} active user licences. To add new team members, either deactivate an inactive employee or expand user licences in Customer Master.</span>
        </div>
      )}

      {/* Real Roster Summary Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12, fontSize: 12, color: '#64748b' }}>
        <span>Total Staff: <strong>{employees.length}</strong></span>
        <span>•</span>
        <span>Super Admins: <strong style={{ color: '#7c3aed' }}>{employees.filter((e) => e.role === 'ADMIN' || e.is_super_admin).length}</strong></span>
        <span>•</span>
        <span>Managers: <strong>{employees.filter((e) => e.level === ('MANAGER' as any) && e.role !== 'ADMIN').length}</strong></span>
        <span>•</span>
        <span>L1 Specialists: <strong>{employees.filter((e) => e.level === 'L1').length}</strong></span>
        <span>•</span>
        <span>L2 Senior: <strong>{employees.filter((e) => e.level === 'L2').length}</strong></span>
        <span>•</span>
        <span>L3 Principal: <strong>{employees.filter((e) => e.level === 'L3').length}</strong></span>
        <span>•</span>
        <span>Checked In: <strong style={{ color: '#16a34a' }}>{employees.filter((e) => e.role !== 'ADMIN' && e.current_attendance_status === 'CHECKED_IN').length}</strong></span>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search employee name, ID, email, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select className="select-filter" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">All Tiers (Manager/L1/L2/L3)</option>
          <option value="MANAGER">Department Operations Manager</option>
          <option value="L1">L1 Triage Specialist</option>
          <option value="L2">L2 Senior Specialist</option>
          <option value="L3">L3 Principal Architect</option>
        </select>

        <select className="select-filter" value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}>
          <option value="">All Availabilities</option>
          <option value="AVAILABLE">Available</option>
          <option value="BUSY">Busy</option>
          <option value="OFFLINE">Offline</option>
        </select>

        {(search || levelFilter || departmentFilter || availFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setLevelFilter(''); setDepartmentFilter(''); setAvailFilter(''); }}
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
              <th>Employee ID</th>
              <th>Login User ID</th>
              <th>Name</th>
              <th>Tier Level</th>
              <th>Department Specialization</th>
              <th>Designation</th>
              <th>Email & Phone</th>
              <th>Active Workload</th>
              <th>Availability</th>
              {hasAnyEmployeeAction && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={hasAnyEmployeeAction ? 10 : 9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading employees...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No specialist employees found matching criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} style={{ opacity: emp.status === 'INACTIVE' ? 0.7 : 1 }}>
                  <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{emp.id}</td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        fontSize: 12,
                        color: '#0369a1',
                        background: '#f0f9ff',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid #bae6fd',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Custom Login User ID"
                    >
                      {emp.custom_user_id || (emp as any).customUserId || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      {emp.status === 'INACTIVE' && (
                        <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
                          INACTIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {emp.role === 'ADMIN' || emp.is_super_admin ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          background: '#ede9fe',
                          color: '#6d28d9',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 11,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <ShieldCheck size={12} />
                        Super Admin
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '2px 8px',
                          background:
                            emp.level === ('MANAGER' as any)
                              ? '#fef3c7'
                              : emp.level === 'L3'
                              ? '#fee2e2'
                              : emp.level === 'L2'
                              ? '#fef9c3'
                              : '#eff6ff',
                          color:
                            emp.level === ('MANAGER' as any)
                              ? '#b45309'
                              : emp.level === 'L3'
                              ? '#b91c1c'
                              : emp.level === 'L2'
                              ? '#854d0e'
                              : '#1d4ed8',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {emp.level === ('MANAGER' as any) ? 'Manager' : `Tier ${emp.level}`}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={13} color="#2563eb" />
                      <span style={{ fontWeight: 500 }}>{emp.department}</span>
                    </div>
                  </td>
                  <td>{emp.designation}</td>
                  <td>
                    <div>{emp.email}</div>
                    {emp.alternate_emails && <div style={{ fontSize: 11, color: '#64748b' }}>+ {emp.alternate_emails.split(',').length} email(s)</div>}
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{emp.phone}</div>
                    {emp.alternate_phones && <div style={{ fontSize: 11, color: '#64748b' }}>+ {emp.alternate_phones.split(',').length} phone(s)</div>}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: (emp.active_ticket_count || 0) > 0 ? '#eff6ff' : '#f8fafc',
                        color: (emp.active_ticket_count || 0) > 0 ? '#1d4ed8' : '#64748b',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {emp.active_ticket_count || 0} Tickets
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          emp.availability === 'AVAILABLE'
                            ? '#f0fdf4'
                            : emp.availability === 'BUSY'
                            ? '#fffbeb'
                            : '#f8fafc',
                        color:
                          emp.availability === 'AVAILABLE'
                            ? '#15803d'
                            : emp.availability === 'BUSY'
                            ? '#b45309'
                            : '#64748b',
                      }}
                    >
                      {emp.availability}
                    </span>
                  </td>
                  {hasAnyEmployeeAction && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {/* Edit Employee Button */}
                        {canUpdateEmployee && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ borderColor: '#3b82f6', color: '#1d4ed8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleOpenEdit(emp)}
                            title={`Edit ${emp.name}'s profile`}
                          >
                            <Edit2 size={12} color="#2563eb" />
                            <span>Edit</span>
                          </button>
                        )}

                        {/* User ID History Button (Authorized Viewers) */}
                        {canViewUserId && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ borderColor: '#0284c7', color: '#0369a1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleOpenHistory(emp)}
                            title={`View User ID change history for ${emp.name}`}
                          >
                            <History size={12} color="#0284c7" />
                            <span>ID History</span>
                          </button>
                        )}

                        {/* Reset Password Button */}
                        <button
                          className="btn btn-outline btn-xs"
                          style={{ borderColor: '#64748b', color: '#334155', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => {
                            setResetTarget(emp);
                            setResetNewPassword('');
                            setResetError(null);
                            setResetSuccessMessage(null);
                            setGeneratedTempPassword(null);
                            setShowResetPassword(true);
                          }}
                          title={`Reset password for ${emp.name}`}
                        >
                          <KeyRound size={12} color="#0284c7" />
                          <span>Reset Password</span>
                        </button>

                        {/* Promote/Demote buttons – 4-Tier Ladder: L1 <-> L2 <-> L3 <-> MANAGER */}
                        {levelMgmtEnabled && emp.level === 'L1' && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ borderColor: '#0284c7', color: '#0284c7', fontWeight: 600 }}
                            onClick={() => handlePromote(emp)}
                            disabled={actionLoadingId === emp.id}
                            title="Promote this employee to L2"
                          >
                            {actionLoadingId === emp.id ? '...' : 'Promote to L2'}
                          </button>
                        )}
                        {levelMgmtEnabled && emp.level === 'L2' && (
                          <>
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }}
                              onClick={() => handlePromote(emp)}
                              disabled={actionLoadingId === emp.id}
                              title="Promote this employee to L3"
                            >
                              {actionLoadingId === emp.id ? '...' : 'Promote to L3'}
                            </button>
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ borderColor: '#b45309', color: '#b45309', fontWeight: 600 }}
                              onClick={() => handleDemote(emp)}
                              disabled={actionLoadingId === emp.id}
                              title="Demote this employee to L1"
                            >
                              {actionLoadingId === emp.id ? '...' : 'Demote to L1'}
                            </button>
                          </>
                        )}
                        {levelMgmtEnabled && emp.level === 'L3' && (
                          <>
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }}
                              onClick={() => handlePromote(emp)}
                              disabled={actionLoadingId === emp.id}
                              title="Promote this L3 employee to Manager"
                            >
                              {actionLoadingId === emp.id ? '...' : 'Promote to MANAGER'}
                            </button>
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ borderColor: '#b45309', color: '#b45309', fontWeight: 600 }}
                              onClick={() => handleDemote(emp)}
                              disabled={actionLoadingId === emp.id}
                              title="Demote this L3 employee to L2"
                            >
                              {actionLoadingId === emp.id ? '...' : 'Demote to L2'}
                            </button>
                          </>
                        )}
                        {levelMgmtEnabled && emp.level === 'MANAGER' && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ borderColor: '#b45309', color: '#b45309', fontWeight: 600 }}
                            onClick={() => handleDemote(emp)}
                            disabled={actionLoadingId === emp.id}
                            title="Demote this Manager to L3"
                          >
                            {actionLoadingId === emp.id ? '...' : 'Demote to L3'}
                          </button>
                        )}

                        {/* Status Toggle (Deactivate / Activate) */}
                        {canActivateEmployee && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{
                              borderColor: emp.status === 'ACTIVE' ? '#f87171' : '#4ade80',
                              color: emp.status === 'ACTIVE' ? '#b91c1c' : '#15803d',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                            onClick={() => handleToggleStatus(emp)}
                            disabled={actionLoadingId === emp.id}
                            title={emp.status === 'ACTIVE' ? 'Deactivate Employee' : 'Activate Employee'}
                          >
                            <Power size={11} />
                            <span>{emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal - High-Reliability Constrained 3-Part Layout */}
      {showCreateModal && (
        <div
          className="employee-modal-overlay"
          onClick={handleCloseCreateModal}
        >
          <form
            className="employee-modal"
            onSubmit={handleCreateSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Modal Header (Fixed) */}
            <div className="employee-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: 'rgba(11, 59, 96, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Users size={20} color="#0b3b60" />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Add Specialist Employee
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                    Provision specialist employee profile, role tier, credentials and login identifiers
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: 16,
                  color: '#64748b',
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* 2. Modal Body (Independently Scrollable) */}
            <div
              className="employee-modal-body"
              ref={modalBodyRef}
              tabIndex={0}
            >
              {/* User Licence Quota Banner */}
              {tenantEntitlement && (
                <div style={{
                  background: tenantEntitlement.available_user_licences > 0 ? '#f0fdf4' : '#fff1f2',
                  border: `1px solid ${tenantEntitlement.available_user_licences > 0 ? '#86efac' : '#fecdd3'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: tenantEntitlement.available_user_licences > 0 ? '#15803d' : '#9f1239',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} />
                    <span>
                      <strong>User Licence Quota:</strong> {tenantEntitlement.active_licensed_users} / {tenantEntitlement.user_licences_purchased} active
                    </span>
                  </div>
                  <span style={{ fontWeight: 700 }}>
                    {tenantEntitlement.available_user_licences} licences available
                  </span>
                </div>
              )}

              {/* Form Validation Error Alert */}
              {formError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#b91c1c',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontWeight: 500,
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section A: Employee Information */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={15} color="#0b3b60" />
                  <span>Employee Information</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      className="form-control"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Gaurav Sharma"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Corporate Email Address <span className="required">*</span></label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      className="form-control"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. gaurav@kanvtech.com"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label className="form-label" style={{ margin: 0 }}>Custom Login User ID (Optional)</label>
                      {createUserIdStatus.checking && (
                        <span style={{ fontSize: 11, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Loader2 size={12} className="spin" /> Checking...
                        </span>
                      )}
                      {!createUserIdStatus.checking && createUserIdStatus.available === true && (
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={12} /> Available
                        </span>
                      )}
                      {!createUserIdStatus.checking && createUserIdStatus.available === false && (
                        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <X size={12} /> {createUserIdStatus.message}
                        </span>
                      )}
                    </div>
                    <input
                      ref={customUserIdInputRef}
                      type="text"
                      className="form-control"
                      value={formData.custom_user_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, custom_user_id: val });
                        checkAvailability(val, undefined, false);
                      }}
                      onBlur={(e) => checkAvailability(e.target.value, undefined, false)}
                      placeholder="e.g. gaurav.s (defaults from email prefix if blank)"
                    />
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      3-30 lowercase characters (a-z, 0-9, dot, dash, underscore). Globally unique.
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Primary Phone Number <span className="required">*</span></label>
                    <div ref={phoneContainerRef}>
                      <PhoneInput
                        required
                        value={formData.phone}
                        onChange={(val) => setFormData({ ...formData, phone: val })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section B: Additional Contact Channels */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={15} color="#0b3b60" />
                  <span>Additional Contact Channels</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Alternate Emails</label>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setFormData({ ...formData, alternate_emails: [...formData.alternate_emails, ''] })}
                      >
                        + Add Email
                      </button>
                    </div>
                    {formData.alternate_emails.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                        No alternate emails configured.
                      </div>
                    ) : (
                      formData.alternate_emails.map((email, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => {
                              const newEmails = [...formData.alternate_emails];
                              newEmails[idx] = e.target.value;
                              setFormData({ ...formData, alternate_emails: newEmails });
                            }}
                            placeholder="alternate.email@company.com"
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => {
                              const newEmails = formData.alternate_emails.filter((_, i) => i !== idx);
                              setFormData({ ...formData, alternate_emails: newEmails });
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Alternate Phones</label>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setFormData({ ...formData, alternate_phones: [...formData.alternate_phones, ''] })}
                      >
                        + Add Phone
                      </button>
                    </div>
                    {formData.alternate_phones.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                        No alternate phones configured.
                      </div>
                    ) : (
                      formData.alternate_phones.map((phone, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            type="text"
                            className="form-control"
                            value={phone}
                            onChange={(e) => {
                              const newPhones = [...formData.alternate_phones];
                              newPhones[idx] = e.target.value;
                              setFormData({ ...formData, alternate_phones: newPhones });
                            }}
                            placeholder="+91 98765 00000"
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => {
                              const newPhones = formData.alternate_phones.filter((_, i) => i !== idx);
                              setFormData({ ...formData, alternate_phones: newPhones });
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Section C: Department & Role Specialization */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={15} color="#0b3b60" />
                  <span>Department & Role Specialization</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Department Specialization <span className="required">*</span></label>
                    <select
                      ref={departmentSelectRef}
                      className="form-control"
                      required
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    >
                      <option value="">Select Support Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Rule: 1 Employee belongs to exactly 1 Department.
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{isAdmin ? 'Support Tier / System Role' : 'Support Tier Level'} <span className="required">*</span></label>
                    <select
                      ref={roleSelectRef}
                      className="form-control"
                      value={formData.role === 'ADMIN' ? 'ADMIN' : formData.level}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'ADMIN') {
                          setFormData({
                            ...formData,
                            role: 'ADMIN',
                            level: 'MANAGER',
                            designation: 'System Administrator',
                          });
                        } else if (val === 'MANAGER') {
                          setFormData({
                            ...formData,
                            role: 'MANAGER',
                            level: 'MANAGER',
                            designation: 'Department Operations Manager',
                          });
                        } else {
                          setFormData({
                            ...formData,
                            role: val === 'L3' ? 'L3_EMPLOYEE' : val === 'L2' ? 'L2_EMPLOYEE' : 'L1_EMPLOYEE',
                            level: val as any,
                            designation: `${val} Support Specialist`,
                          });
                        }
                      }}
                    >
                      <option value="L1">Level 1 (Triage & Workload Auto-Routing)</option>
                      <option value="L2">Level 2 (Senior Technical Diagnostic)</option>
                      <option value="L3">Level 3 (Principal Architecture & Patches)</option>
                      {isAdmin && <option value="MANAGER">Manager (Department Review & Escalations)</option>}
                      {isAdmin && <option value="ADMIN">★ Super Admin (Full Platform Administrator)</option>}
                    </select>
                    {!isAdmin && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Rule: Managers may provision Level 1, 2, or 3 Specialist tiers. Manager & Admin roles are restricted.
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Designation <span className="required">*</span></label>
                    <input
                      ref={designationInputRef}
                      type="text"
                      className="form-control"
                      required
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section D: Authentication Credentials */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyRound size={15} color="#0b3b60" />
                    <span>Authentication Credentials</span>
                  </div>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="btn btn-outline btn-xs"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0284c7' }}
                  >
                    <Sparkles size={13} />
                    <span>Generate Strong Password</span>
                  </button>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Initial Password (Optional)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      ref={passwordInputRef}
                      type={showCreatePassword ? 'text' : 'password'}
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Auto-generated secure password if left empty"
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                      title={showCreatePassword ? 'Hide password' : 'Show password'}
                    >
                      {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    If left empty, a 12-character cryptographically secure password will be automatically generated.
                  </div>

                  {formData.password && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      fontSize: 11,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}>
                      <span style={{ color: formData.password.length >= 8 ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {formData.password.length >= 8 ? '✓' : '○'} Min 8 chars
                      </span>
                      <span style={{ color: /[A-Z]/.test(formData.password) ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/[A-Z]/.test(formData.password) ? '✓' : '○'} Uppercase
                      </span>
                      <span style={{ color: /[a-z]/.test(formData.password) ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/[a-z]/.test(formData.password) ? '✓' : '○'} Lowercase
                      </span>
                      <span style={{ color: /[0-9]/.test(formData.password) ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/[0-9]/.test(formData.password) ? '✓' : '○'} Number
                      </span>
                      <span style={{ color: /[^A-Za-z0-9]/.test(formData.password) ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/[^A-Za-z0-9]/.test(formData.password) ? '✓' : '○'} Special char
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section E: Operational & Reporting Settings */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={15} color="#0b3b60" />
                  <span>Operational & Reporting Settings</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Reporting Manager (Optional)</label>
                    <select
                      className="form-control"
                      value={formData.manager_id}
                      onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                    >
                      <option value="">No Direct Manager / Top Level</option>
                      {employees
                        .filter((emp) => emp.status === 'ACTIVE')
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.id} · {emp.level})
                          </option>
                        ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Sets supervisor for operational reviews and task escalations.
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Initial Availability Status</label>
                    <select
                      className="form-control"
                      value={formData.availability}
                      onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                    >
                      <option value="AVAILABLE">AVAILABLE (Eligible for Auto-Routing)</option>
                      <option value="BUSY">BUSY (High Workload Buffer)</option>
                      <option value="ON_LEAVE">ON LEAVE (Queue Bypassed)</option>
                    </select>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      Controls automated ticket triage allotment immediately upon registration.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Modal Footer (Fixed at Bottom) */}
            <div className="employee-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseCreateModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || (tenantEntitlement && (tenantEntitlement.available_user_licences <= 0 || tenantEntitlement.subscription?.isExpired))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {saving && <Loader2 size={15} className="spin" />}
                <span>{saving ? 'Registering Specialist...' : 'Add Specialist Employee'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {showResetPassword && resetTarget && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-container" style={{ maxWidth: 440 }}>
            <div className="modal-header" style={{ background: '#0b3b60', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Reset Employee Password</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Administrator Security Override</div>
                </div>
              </div>
              <button
                onClick={() => setShowResetPassword(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setResetError(null);
                setResetSuccessMessage(null);
                setGeneratedTempPassword(null);
                setResetSaving(true);
                try {
                  const res = await api.adminResetPassword({
                    userId: resetTarget.user_id,
                    newPassword: resetNewPassword.trim() || undefined,
                  });
                  setResetSuccessMessage(res.message || 'Password reset successfully.');
                  if (res.temporaryPassword) {
                    setGeneratedTempPassword(res.temporaryPassword);
                  }
                  setTimeout(() => {
                    if (!res.temporaryPassword) {
                      setShowResetPassword(false);
                    }
                  }, 1500);
                } catch (err: any) {
                  setResetError(err.message || 'Failed to reset password.');
                } finally {
                  setResetSaving(false);
                }
              }}
            >
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{resetTarget.name}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{resetTarget.email}</div>
                  <div style={{ color: '#0284c7', fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                    {resetTarget.department} • Tier {resetTarget.level}
                  </div>
                </div>

                {resetError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '10px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                      marginBottom: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={15} />
                    <span>{resetError}</span>
                  </div>
                )}

                {resetSuccessMessage && (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '10px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{resetSuccessMessage}</div>
                    {generatedTempPassword && (
                      <div style={{ marginTop: 8, padding: 8, background: 'white', borderRadius: 4, border: '1px solid #86efac' }}>
                        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Generated Temporary Password:</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.05em', marginTop: 2 }}>
                          {generatedTempPassword}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                    New Password (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      className="form-control"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Leave blank to generate temporary password"
                    />
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    If left empty, a secure 12-character temporary password will be automatically generated.
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResetPassword(false)}
                >
                  {generatedTempPassword ? 'Close' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resetSaving}
                >
                  {resetSaving ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 760, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* FIXED HEADER */}
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e6f0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b3b60' }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <div className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                    Edit Specialist Employee
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{editingEmployee.name}</span> • ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{editingEmployee.id}</span> • {editingEmployee.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* FORM WITH SCROLLABLE BODY AND FIXED FOOTER */}
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {editFormError && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 13, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} />
                    <span>{editFormError}</span>
                  </div>
                )}

                {/* SECTION A: BASIC INFORMATION */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 14, background: '#0b3b60', borderRadius: 2 }}></span>
                    A. Basic Information
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Full Name <span className="required" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        style={{ height: 38 }}
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Primary Corporate Email
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        disabled
                        value={editFormData.email}
                        style={{ height: 38, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                        title="Primary corporate email is managed via authentication master"
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', margin: 0 }}>
                          Custom Login User ID
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {editUserIdStatus.checking && (
                            <span style={{ fontSize: 11, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Loader2 size={12} className="spin" /> Checking...
                            </span>
                          )}
                          {!editUserIdStatus.checking && editUserIdStatus.available === true && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Check size={12} /> Available
                            </span>
                          )}
                          {!editUserIdStatus.checking && editUserIdStatus.available === false && (
                            <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <X size={12} /> {editUserIdStatus.message}
                            </span>
                          )}
                          {canViewUserId && (
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              style={{ padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => handleOpenHistory(editingEmployee)}
                            >
                              <History size={11} /> ID History
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        className="form-control"
                        disabled={!canUpdateUserId || editingEmployee.role === 'PLATFORM_INCHARGE' || editingEmployee.role === 'SUPER_ADMIN'}
                        value={editFormData.custom_user_id}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFormData({ ...editFormData, custom_user_id: val });
                          if (val.trim() !== (editingEmployee.custom_user_id || (editingEmployee as any).customUserId)) {
                            checkAvailability(val, editingEmployee.id, true);
                          } else {
                            setEditUserIdStatus({ checking: false, available: null, message: null });
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val.trim() !== (editingEmployee.custom_user_id || (editingEmployee as any).customUserId)) {
                            checkAvailability(val, editingEmployee.id, true);
                          }
                        }}
                        style={{ height: 38 }}
                        placeholder="e.g. rahul.sharma"
                      />
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                        Only Tenant Super Admins may modify User IDs. Platform accounts remain protected.
                      </div>
                    </div>

                    {editFormData.custom_user_id.trim() !== (editingEmployee.custom_user_id || (editingEmployee as any).customUserId || '') && (
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                          Reason for User ID Change (Recommended)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: 38 }}
                          value={editFormData.change_reason}
                          onChange={(e) => setEditFormData({ ...editFormData, change_reason: e.target.value })}
                          placeholder="e.g. Username standardization / corporate name change"
                        />
                      </div>
                    )}

                    <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Contact Phone <span className="required" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <PhoneInput
                        required
                        value={editFormData.phone}
                        onChange={(val) => setEditFormData({ ...editFormData, phone: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION B: ROLE & ORGANIZATION */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 14, background: '#0b3b60', borderRadius: 2 }}></span>
                    B. Role & Organization
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Department Specialization <span className="required" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        className="form-control"
                        required
                        style={{ height: 38, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        value={editFormData.department_id}
                        onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Support Tier Level <span className="required" style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        className="form-control"
                        required
                        style={{ height: 38 }}
                        value={editFormData.level}
                        disabled={editingEmployee.role === 'ADMIN' || (!isAdmin && editingEmployee.level === 'MANAGER')}
                        onChange={(e) => {
                          const lvl = e.target.value as any;
                          setEditFormData({
                            ...editFormData,
                            level: lvl,
                            designation: lvl === 'MANAGER' ? 'Support Manager' : `${lvl} Support Specialist`,
                          });
                        }}
                      >
                        <option value="L1">Tier L1 (Frontline Support)</option>
                        <option value="L2">Tier L2 (Senior Specialist)</option>
                        <option value="L3">Tier L3 (Principal Specialist)</option>
                        {isAdmin && <option value="MANAGER">Manager (Operations & Reassignment)</option>}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Designation Title
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        style={{ height: 38 }}
                        value={editFormData.designation}
                        onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                        placeholder="e.g. L1 Support Specialist"
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Reporting Manager
                      </label>
                      <select
                        className="form-control"
                        style={{ height: 38, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        value={editFormData.manager_id}
                        onChange={(e) => setEditFormData({ ...editFormData, manager_id: e.target.value })}
                      >
                        <option value="">No Direct Manager</option>
                        {employees
                          .filter((emp) => emp.level === 'MANAGER' && emp.id !== editingEmployee.id)
                          .map((mgr) => (
                            <option key={mgr.id} value={mgr.id}>
                              {mgr.name} ({mgr.department || 'General'})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION C: WORK STATUS */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 14, background: '#0b3b60', borderRadius: 2 }}></span>
                    C. Work Status
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Availability Status
                      </label>
                      <select
                        className="form-control"
                        style={{ height: 38 }}
                        value={editFormData.availability}
                        onChange={(e) => setEditFormData({ ...editFormData, availability: e.target.value as any })}
                      >
                        <option value="AVAILABLE">AVAILABLE (Accepting tickets & tasks)</option>
                        <option value="BUSY">BUSY (Active ticket workload)</option>
                        <option value="OFFLINE">OFFLINE (Not on active shift)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                        Account Status
                      </label>
                      <select
                        className="form-control"
                        style={{ height: 38 }}
                        value={editFormData.status}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                      >
                        <option value="ACTIVE">ACTIVE (Account enabled)</option>
                        <option value="INACTIVE">INACTIVE (Account disabled)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION D: CONTACT DETAILS */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b60', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 4, height: 14, background: '#0b3b60', borderRadius: 2 }}></span>
                    D. Contact Details
                  </div>

                  {/* Additional Emails */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#334155' }}>
                        Additional Emails
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setEditFormData({ ...editFormData, alternate_emails: [...editFormData.alternate_emails, ''] })}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                      >
                        + Add Email
                      </button>
                    </div>
                    {editFormData.alternate_emails.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                        No additional emails configured.
                      </div>
                    ) : (
                      editFormData.alternate_emails.map((email, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            type="email"
                            className="form-control"
                            style={{ height: 38 }}
                            value={email}
                            onChange={(e) => {
                              const newEmails = [...editFormData.alternate_emails];
                              newEmails[idx] = e.target.value;
                              setEditFormData({ ...editFormData, alternate_emails: newEmails });
                            }}
                            placeholder="alternate.email@kanvtech.com"
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            style={{ padding: '0 12px', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                              const newEmails = editFormData.alternate_emails.filter((_, i) => i !== idx);
                              setEditFormData({ ...editFormData, alternate_emails: newEmails });
                            }}
                            title="Remove Email"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Additional Phones */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#334155' }}>
                        Additional Phones
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setEditFormData({ ...editFormData, alternate_phones: [...editFormData.alternate_phones, ''] })}
                        style={{ fontSize: 11, padding: '3px 8px' }}
                      >
                        + Add Phone
                      </button>
                    </div>
                    {editFormData.alternate_phones.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                        No additional phones configured.
                      </div>
                    ) : (
                      editFormData.alternate_phones.map((phone, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <PhoneInput
                              value={phone}
                              onChange={(val) => {
                                const newPhones = [...editFormData.alternate_phones];
                                newPhones[idx] = val;
                                setEditFormData({ ...editFormData, alternate_phones: newPhones });
                              }}
                              placeholder="Alternate phone number"
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            style={{ padding: '0 12px', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => {
                              const newPhones = editFormData.alternate_phones.filter((_, i) => i !== idx);
                              setEditFormData({ ...editFormData, alternate_phones: newPhones });
                            }}
                            title="Remove Phone"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* FIXED FOOTER */}
              <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSaving} style={{ minWidth: 160 }}>
                  {editSaving ? 'Saving Changes...' : 'Save Employee Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User ID Change History Modal */}
      {showHistoryModal && historyTarget && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: 640, width: '90%' }}>
            <div className="modal-header" style={{ background: '#0b3b60', color: 'white', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <History size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>User ID Change History</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {historyTarget.name} ({historyTarget.id}) • {historyTarget.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: 20 }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: '#64748b' }}>
                  <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                  Loading historical ID records...
                </div>
              ) : historyRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 13 }}>
                  No historical User ID modifications recorded for this employee.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: 12, width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Previous ID</th>
                        <th>New ID</th>
                        <th>Changed By</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRecords.map((rec) => (
                        <tr key={rec.id}>
                          <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                            {new Date(rec.createdAt).toLocaleString()}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', color: rec.previousUserId ? '#b91c1c' : '#94a3b8' }}>
                              {rec.previousUserId || 'None (Initial)'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>
                              {rec.newUserId}
                            </span>
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {rec.changedByName || rec.changedByUserId || 'System'}
                          </td>
                          <td style={{ color: '#475569' }}>
                            {rec.changeReason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
