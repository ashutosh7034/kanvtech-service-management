import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Employee, Department } from '../../types';
import { Users, Search, Plus, ShieldAlert, CheckCircle2, Clock, Layers, KeyRound, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department_id: '',
    designation: 'L1 Support Specialist',
    level: 'L1' as 'MANAGER' | 'L1' | 'L2' | 'L3',
    manager_id: '',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Admin Reset Password Modal State
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);

  const handlePromote = async (emp: Employee) => {
    const nextTier = emp.level === 'L1' ? 'L2' : 'L3';
    if (!window.confirm(`Promote ${emp.name} from ${emp.level} to ${nextTier} in ${emp.department}?`)) return;
    try {
      await api.promoteEmployee(emp.id);
      loadEmployees();
    } catch (err: any) {
      alert(`Promotion failed: ${err.message}`);
    }
  };

  const handleDemote = async (emp: Employee) => {
    const prevTier = emp.level === 'L3' ? 'L2' : 'L1';
    if (!window.confirm(`Demote ${emp.name} from ${emp.level} to ${prevTier} in ${emp.department}?`)) return;
    try {
      await api.demoteEmployee(emp.id);
      loadEmployees();
    } catch (err: any) {
      alert(`Demotion failed: ${err.message}`);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [levelFilter, departmentFilter, availFilter, search]);

  const loadDepartments = async () => {
    try {
      const res = await api.getDepartments();
      const depts: Department[] = res.departments || res.data || [];
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.createEmployee(formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        department_id: departments[0]?.id || '',
        designation: 'L1 Support Specialist',
        level: 'L1',
        manager_id: '',
        password: '',
      });
      loadEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create employee profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Specialist Employee Directory & Support Tiers</h2>
          <div className="page-subtitle">Product-specialized roster across Manager, L1, L2, and L3 tiers with live workload allocation</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} /> Add Specialist Employee
        </button>
      </div>

      {/* Real Roster Summary Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12, fontSize: 12, color: '#64748b' }}>
        <span>Total Staff: <strong>{employees.length}</strong></span>
        <span>•</span>
        <span>Managers: <strong>{employees.filter((e) => e.level === ('MANAGER' as any)).length}</strong></span>
        <span>•</span>
        <span>L1 Specialists: <strong>{employees.filter((e) => e.level === 'L1').length}</strong></span>
        <span>•</span>
        <span>L2 Senior: <strong>{employees.filter((e) => e.level === 'L2').length}</strong></span>
        <span>•</span>
        <span>L3 Principal: <strong>{employees.filter((e) => e.level === 'L3').length}</strong></span>
        <span>•</span>
        <span>Checked In: <strong style={{ color: '#16a34a' }}>{employees.filter((e) => e.current_attendance_status === 'CHECKED_IN').length}</strong></span>
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
              <th>Name</th>
              <th>Tier Level</th>
              <th>Department Specialization</th>
              <th>Designation</th>
              <th>Email & Phone</th>
              <th>Active Workload</th>
              <th>Availability</th>
              {isAdmin && <th style={{ textAlign: 'right' }}>Tier Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading employees...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No specialist employees found matching criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{emp.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                  </td>
                  <td>
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
                    <div style={{ fontSize: 11, color: '#64748b' }}>{emp.phone}</div>
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
                  {isAdmin && (
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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

                        {emp.level === 'L1' && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ borderColor: '#0284c7', color: '#0284c7', fontWeight: 600 }}
                            onClick={() => handlePromote(emp)}
                          >
                            Promote to L2
                          </button>
                        )}
                        {emp.level === 'L2' && (
                          <>
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }}
                              onClick={() => handlePromote(emp)}
                            >
                              Promote to L3
                            </button>
                            <button
                              className="btn btn-outline btn-xs"
                              style={{ borderColor: '#b45309', color: '#b45309', fontWeight: 600 }}
                              onClick={() => handleDemote(emp)}
                            >
                              Demote to L1
                            </button>
                          </>
                        )}
                        {emp.level === 'L3' && (
                          <button
                            className="btn btn-outline btn-xs"
                            style={{ borderColor: '#b45309', color: '#b45309', fontWeight: 600 }}
                            onClick={() => handleDemote(emp)}
                          >
                            Demote to L2
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={20} color="#0b3b60" />
                <div className="modal-title">Add Specialist Employee</div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: 10,
                      borderRadius: 6,
                      marginBottom: 12,
                      fontSize: 13,
                    }}
                  >
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Full Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Gaurav Sharma"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Email Address <span className="required">*</span></label>
                    <input
                      type="email"
                      className="form-control"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="gaurav@kanvtech.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 11001"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Department Specialization <span className="required">*</span></label>
                    <select
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

                  <div className="form-group">
                    <label className="form-label">Support Tier Level <span className="required">*</span></label>
                    <select
                      className="form-control"
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          level: e.target.value as any,
                          designation:
                            e.target.value === 'MANAGER'
                              ? 'Department Operations Manager'
                              : `${e.target.value} Support Specialist`,
                        })
                      }
                    >
                      <option value="L1">Level 1 (Triage & Workload Auto-Routing)</option>
                      <option value="L2">Level 2 (Senior Technical Diagnostic)</option>
                      <option value="L3">Level 3 (Principal Architecture & Patches)</option>
                      <option value="MANAGER">Manager (Department Review & Escalations)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Designation <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Password (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Auto-generated secure password if left empty"
                    />
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                      If blank, a cryptographically secure temporary password will be created.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Registering...' : 'Register Specialist'}
                </button>
              </div>
            </form>
          </div>
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
    </div>
  );
};
