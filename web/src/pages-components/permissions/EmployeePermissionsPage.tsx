import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Search,
  KeyRound,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Save,
  Check,
  UserCheck,
  UserX,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface EmployeeWithPerms {
  id: string;
  userId: number;
  name: string;
  email: string;
  phone?: string;
  department: string;
  departmentId?: string;
  designation: string;
  level: string;
  status: string;
  role: string;
  assignedPermissionsCount: number;
  assignedPermissions: string[];
}

interface PermissionItem {
  id: string;
  permissionCode: string;
  action: string;
  description: string;
}

interface ModuleCategory {
  module: string;
  moduleLabel: string;
  permissions: PermissionItem[];
}

export const EmployeePermissionsPage: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [employees, setEmployees] = useState<EmployeeWithPerms[]>([]);
  const [modules, setModules] = useState<ModuleCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [permFilter, setPermFilter] = useState('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected employee for permission management
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithPerms | null>(null);
  const [configuredPerms, setConfiguredPerms] = useState<Set<string>>(new Set());
  const [originalPerms, setOriginalPerms] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [permSearchTerm, setPermSearchTerm] = useState('');

  // Confirmation dialog state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [empRes, catalogRes] = await Promise.all([
        api.getEmployeesPermissions(),
        api.getPermissionCatalog(),
      ]);

      if (empRes && empRes.employees) {
        setEmployees(empRes.employees);
      }
      if (catalogRes && catalogRes.modules) {
        setModules(catalogRes.modules);
        // Expand all modules by default
        const exp: Record<string, boolean> = {};
        catalogRes.modules.forEach((m: ModuleCategory) => {
          exp[m.module] = true;
        });
        setExpandedModules(exp);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load employees and permissions catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedEmployee(null);
    setCurrentPage(1);
    setSearchTerm('');
    setDepartmentFilter('ALL');
    setStatusFilter('ALL');
    setPermFilter('ALL');
    loadData();
  }, [user?.tenantId]);

  // Compute distinct departments for filter dropdown
  const departments = useMemo(() => {
    const deps = new Set<string>();
    employees.forEach((e) => {
      if (e.department) deps.add(e.department);
    });
    return Array.from(deps).sort();
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Exclude platform administrative roles (defense in depth)
      if (emp.role === 'PLATFORM_INCHARGE' || emp.role === 'SUPER_ADMIN') {
        return false;
      }

      // Search by name or email
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = emp.name.toLowerCase().includes(query);
        const matchesEmail = emp.email.toLowerCase().includes(query);
        const matchesId = emp.id.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }
      // Department filter
      if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && emp.status !== statusFilter) {
        return false;
      }
      // Permission filter
      if (permFilter === 'HAS_PERMS' && emp.assignedPermissionsCount === 0) {
        return false;
      }
      if (permFilter === 'NO_PERMS' && emp.assignedPermissionsCount > 0) {
        return false;
      }
      return true;
    });
  }, [employees, searchTerm, departmentFilter, statusFilter, permFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredEmployees.length / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Stats calculation
  const totalEmployeesCount = employees.length;
  const employeesWithPermsCount = employees.filter((e) => e.assignedPermissionsCount > 0).length;
  const activeEmployeesCount = employees.filter((e) => e.status === 'ACTIVE').length;
  const totalCatalogPermsCount = useMemo(() => {
    return modules.reduce((sum, m) => sum + m.permissions.length, 0);
  }, [modules]);

  // Open Permission Drawer for an employee
  const handleOpenPermissions = (emp: EmployeeWithPerms) => {
    setSelectedEmployee(emp);
    const permSet = new Set(emp.assignedPermissions || []);
    setConfiguredPerms(new Set(permSet));
    setOriginalPerms(new Set(permSet));
    setPermSearchTerm('');
  };

  // Close Drawer
  const handleCloseDrawer = () => {
    setSelectedEmployee(null);
    setShowConfirmModal(false);
  };

  // Toggle individual permission checkbox
  const handleTogglePerm = (code: string) => {
    setConfiguredPerms((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Select all permissions in a module
  const handleSelectAllModule = (module: ModuleCategory) => {
    setConfiguredPerms((prev) => {
      const next = new Set(prev);
      module.permissions.forEach((p) => next.add(p.permissionCode));
      return next;
    });
  };

  // Clear all permissions in a module
  const handleClearAllModule = (module: ModuleCategory) => {
    setConfiguredPerms((prev) => {
      const next = new Set(prev);
      module.permissions.forEach((p) => next.delete(p.permissionCode));
      return next;
    });
  };

  // Select all across all modules
  const handleSelectAllGlobal = () => {
    const next = new Set<string>();
    modules.forEach((m) => {
      m.permissions.forEach((p) => next.add(p.permissionCode));
    });
    setConfiguredPerms(next);
  };

  // Clear all across all modules
  const handleClearAllGlobal = () => {
    setConfiguredPerms(new Set());
  };

  // Reset to original
  const handleReset = () => {
    setConfiguredPerms(new Set(originalPerms));
  };

  // Toggle module accordion expansion
  const toggleModuleAccordion = (moduleKey: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleKey]: !prev[moduleKey],
    }));
  };

  // Calculate diff for confirmation dialog
  const diffSummary = useMemo(() => {
    const added: string[] = [];
    const removed: string[] = [];

    configuredPerms.forEach((code) => {
      if (!originalPerms.has(code)) added.push(code);
    });

    originalPerms.forEach((code) => {
      if (!configuredPerms.has(code)) removed.push(code);
    });

    return { added, removed, totalChanges: added.length + removed.length };
  }, [configuredPerms, originalPerms]);

  // Execute Save
  const handleConfirmSave = async () => {
    if (!selectedEmployee) return;

    try {
      setSaving(true);
      const permArray = Array.from(configuredPerms);
      const res = await api.updateEmployeePermissions(selectedEmployee.id, permArray);

      // Update local state
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id === selectedEmployee.id) {
            return {
              ...e,
              assignedPermissionsCount: permArray.length,
              assignedPermissions: permArray,
            };
          }
          return e;
        }),
      );

      setToast({
        type: 'success',
        message: res.message || `Permissions updated successfully for ${selectedEmployee.name}.`,
      });

      handleCloseDrawer();
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to save employee permissions',
      });
      setShowConfirmModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#1e293b' }}>
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            background: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#ffffff',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'all 0.3s ease',
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', marginLeft: 8 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Employee Permission Management
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
          Workspace: <span style={{ fontWeight: 600, color: '#4f46e5' }}>{user?.tenantName || user?.tenantId || 'Active Workspace'}</span> • Manage individual employee access and delegate specific administrative capabilities across modules.
        </p>
      </div>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Total Employees
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {totalEmployeesCount}
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: 4 }}>
            {activeEmployeesCount} Active Staff
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Custom Permissions Delegated
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#4f46e5', marginTop: 4 }}>
            {employeesWithPermsCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
            Staff members with tailored access
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            System Permission Catalog
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
            {totalCatalogPermsCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
            Across {modules.length} Functional Modules
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Security Compliance
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Tenant Isolated</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
            Audit logged grants & revocations
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 260px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search employee by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div style={{ minWidth: '170px' }}>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
                color: '#334155',
              }}
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
                color: '#334155',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          {/* Permission Status Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={permFilter}
              onChange={(e) => {
                setPermFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                outline: 'none',
                color: '#334155',
              }}
            >
              <option value="ALL">All Permissions Status</option>
              <option value="HAS_PERMS">Has Custom Permissions</option>
              <option value="NO_PERMS">Default Role Only</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadData}
          style={{
            padding: '9px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Employee Table Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div
              style={{
                display: 'inline-block',
                width: '32px',
                height: '32px',
                border: '3px solid #cbd5e1',
                borderTopColor: '#4f46e5',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>
              Loading employee permission matrix...
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Error loading employees</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: 4 }}>{error}</div>
            <button
              onClick={loadData}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <Info size={36} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
              No employees matched your search criteria
            </div>
            <div style={{ fontSize: '13px', marginTop: 4 }}>
              Try adjusting your search filters or clear the active query.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Employee Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Department</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Base Role / Level</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Permissions</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((emp) => {
                  const isSelf = emp.userId === currentUserId;
                  const isInactive = emp.status !== 'ACTIVE';

                  return (
                    <tr
                      key={emp.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Name & ID */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              fontWeight: 700,
                              fontSize: '13px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {emp.name
                              ? emp.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()
                              : 'E'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{emp.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {emp.designation || 'Specialist'} • <span style={{ fontFamily: 'monospace' }}>{emp.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '14px 16px', color: '#475569' }}>
                        <div>{emp.email}</div>
                        {emp.phone && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{emp.phone}</div>
                        )}
                      </td>

                      {/* Department */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            color: '#334155',
                            fontWeight: 500,
                            fontSize: '12px',
                          }}
                        >
                          {emp.department || 'General'}
                        </span>
                      </td>

                      {/* Role & Level */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: emp.role === 'ADMIN' ? '#fef3c7' : '#e0e7ff',
                              color: emp.role === 'ADMIN' ? '#92400e' : '#3730a3',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {emp.role.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>({emp.level})</span>
                        </div>
                      </td>

                      {/* Assigned Permissions Count */}
                      <td style={{ padding: '14px 16px' }}>
                        {emp.assignedPermissionsCount > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                background: '#dcfce7',
                                color: '#166534',
                                fontWeight: 600,
                                fontSize: '12px',
                              }}
                            >
                              <KeyRound size={12} />
                              <span>{emp.assignedPermissionsCount} Granted</span>
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Default role access
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {emp.status === 'ACTIVE' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#ecfdf5',
                              color: '#059669',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                            Active
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {isSelf ? (
                          <span
                            title="Security Policy: You cannot modify your own permissions"
                            style={{
                              fontSize: '12px',
                              color: '#94a3b8',
                              cursor: 'not-allowed',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              display: 'inline-block',
                            }}
                          >
                            Current User
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenPermissions(emp)}
                            disabled={isInactive}
                            title={isInactive ? 'Activate employee to manage permissions' : 'Configure permissions'}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #4f46e5',
                              background: isInactive ? '#f1f5f9' : '#4f46e5',
                              borderColor: isInactive ? '#cbd5e1' : '#4f46e5',
                              color: isInactive ? '#94a3b8' : '#ffffff',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: isInactive ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <KeyRound size={13} />
                            <span>Manage Permissions</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredEmployees.length)} of {filteredEmployees.length} employees
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    color: currentPage === 1 ? '#cbd5e1' : '#334155',
                  }}
                >
                  Previous
                </button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600 }}>
                  {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    color: currentPage === totalPages ? '#cbd5e1' : '#334155',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Permission Configuration Drawer / Slide-Over */}
      {selectedEmployee && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              height: '100%',
              background: '#ffffff',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideInRight 0.25s ease-out',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Configure Permissions
                  </h2>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#e0e7ff',
                      color: '#4338ca',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {configuredPerms.size} Granted
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: 4 }}>
                  Employee:{' '}
                  <strong style={{ color: '#0f172a' }}>{selectedEmployee.name}</strong> •{' '}
                  <span>{selectedEmployee.email}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 2 }}>
                  Department: <span style={{ color: '#475569' }}>{selectedEmployee.department}</span> | Base Role:{' '}
                  <span style={{ color: '#475569' }}>{selectedEmployee.role}</span>
                </div>
              </div>

              <button
                onClick={handleCloseDrawer}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Actions & Search */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid #f1f5f9',
                background: '#ffffff',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSelectAllGlobal}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Grant All
                </button>
                <button
                  onClick={handleClearAllGlobal}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              </div>

              {/* Filter within Drawer */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Filter permissions..."
                  value={permSearchTerm}
                  onChange={(e) => setPermSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Permissions List (Scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {modules.map((mod) => {
                  const filteredPerms = mod.permissions.filter((p) => {
                    if (!permSearchTerm) return true;
                    const q = permSearchTerm.toLowerCase();
                    return (
                      p.permissionCode.toLowerCase().includes(q) ||
                      p.description.toLowerCase().includes(q) ||
                      p.action.toLowerCase().includes(q)
                    );
                  });

                  if (filteredPerms.length === 0) return null;

                  const grantedInModCount = mod.permissions.filter((p) =>
                    configuredPerms.has(p.permissionCode),
                  ).length;
                  const isExpanded = expandedModules[mod.module] ?? true;

                  return (
                    <div
                      key={mod.module}
                      style={{
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Module Header */}
                      <div
                        style={{
                          padding: '12px 16px',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => toggleModuleAccordion(mod.module)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isExpanded ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
                          <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                            {mod.moduleLabel}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: grantedInModCount > 0 ? '#dcfce7' : '#f1f5f9',
                              color: grantedInModCount > 0 ? '#15803d' : '#64748b',
                            }}
                          >
                            {grantedInModCount} of {mod.permissions.length} granted
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSelectAllModule(mod)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                              cursor: 'pointer',
                              color: '#334155',
                            }}
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => handleClearAllModule(mod)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              fontSize: '11px',
                              cursor: 'pointer',
                              color: '#64748b',
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Checkbox Items */}
                      {isExpanded && (
                        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {filteredPerms.map((p) => {
                            const isChecked = configuredPerms.has(p.permissionCode);
                            return (
                              <label
                                key={p.permissionCode}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '10px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  background: isChecked ? '#f5f3ff' : 'transparent',
                                  cursor: 'pointer',
                                  border: isChecked ? '1px solid #ddd6fe' : '1px solid transparent',
                                  transition: 'all 0.1s ease',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePerm(p.permissionCode)}
                                  style={{
                                    marginTop: '3px',
                                    accentColor: '#4f46e5',
                                    width: '15px',
                                    height: '15px',
                                    cursor: 'pointer',
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: isChecked ? '#4338ca' : '#1e293b' }}>
                                      {p.action.toUpperCase()}
                                    </span>
                                    <code
                                      style={{
                                        fontSize: '11px',
                                        background: isChecked ? '#ede9fe' : '#f1f5f9',
                                        color: isChecked ? '#5b21b6' : '#64748b',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      {p.permissionCode}
                                    </code>
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {diffSummary.totalChanges === 0 ? (
                  <span>No changes made</span>
                ) : (
                  <span style={{ fontWeight: 500, color: '#4f46e5' }}>
                    {diffSummary.added.length} to grant, {diffSummary.removed.length} to revoke
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleCloseDrawer}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={diffSummary.totalChanges === 0}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: diffSummary.totalChanges === 0 ? '#cbd5e1' : '#4f46e5',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: diffSummary.totalChanges === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Save size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {showConfirmModal && selectedEmployee && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Confirm Permission Updates
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Target: {selectedEmployee.name} ({selectedEmployee.email})
                </div>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '14px 0' }}>
              You are about to modify administrative and module permissions for this employee. These changes will take
              effect immediately across all active workspaces.
            </div>

            {/* Changes Summary Box */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '12px 14px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px',
                fontSize: '12px',
              }}
            >
              {diffSummary.added.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>+ Permissions to Grant ({diffSummary.added.length}):</span>
                  <div style={{ marginTop: 2, color: '#334155', fontFamily: 'monospace', fontSize: '11px' }}>
                    {diffSummary.added.join(', ')}
                  </div>
                </div>
              )}
              {diffSummary.removed.length > 0 && (
                <div>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>- Permissions to Revoke ({diffSummary.removed.length}):</span>
                  <div style={{ marginTop: 2, color: '#334155', fontFamily: 'monospace', fontSize: '11px' }}>
                    {diffSummary.removed.join(', ')}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

