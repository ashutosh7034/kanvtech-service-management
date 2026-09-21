import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Employee } from '../../types';
import { Users, Search, Plus, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [availFilter, setAvailFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Service Desk',
    designation: 'L1 Support Engineer',
    level: 'L1' as 'L1' | 'L2' | 'L3',
    manager_id: 'EMP-001',
    password: 'Password@123',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, [levelFilter, availFilter, search]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.getEmployees({ level: levelFilter, availability: availFilter, search });
      setEmployees(res.data);
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
        department: 'Service Desk',
        designation: 'L1 Support Engineer',
        level: 'L1',
        manager_id: 'EMP-001',
        password: 'Password@123',
      });
      loadEmployees();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Employee Management & Support Tiers</h2>
          <div className="page-subtitle">Specialist roster across L1, L2, and L3 tiers with live workload allocation</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} /> Add Support Engineer
        </button>
      </div>

      {/* Real Roster Summary Pills */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12, color: '#64748b' }}>
        <span>Total Staff: <strong>{employees.length}</strong></span>
        <span>•</span>
        <span>L1 Triage: <strong>{employees.filter((e) => e.level === 'L1').length}</strong></span>
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

        <select className="select-filter" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">All Tiers (L1/L2/L3)</option>
          <option value="L1">L1 Triage Specialist</option>
          <option value="L2">L2 Senior Technical</option>
          <option value="L3">L3 Principal Engineer</option>
        </select>

        <select className="select-filter" value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}>
          <option value="">All Availabilities</option>
          <option value="AVAILABLE">Available</option>
          <option value="BUSY">Busy</option>
          <option value="OFFLINE">Offline</option>
        </select>

        {(search || levelFilter || availFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setSearch(''); setLevelFilter(''); setAvailFilter(''); }}
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
              <th>Department & Designation</th>
              <th>Email & Phone</th>
              <th>Active Workload</th>
              <th>Availability</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading employees...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No employees found matching criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{emp.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                    {emp.manager_name && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>Reports to: {emp.manager_name}</div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 700,
                        fontSize: 12,
                        background:
                          emp.level === 'L1' ? '#eff6ff' : emp.level === 'L2' ? '#fef3c7' : '#faf5ff',
                        color:
                          emp.level === 'L1' ? '#1e40af' : emp.level === 'L2' ? '#92400e' : '#6b21a8',
                        border: '1px solid currentColor',
                      }}
                    >
                      {emp.level}
                    </span>
                  </td>
                  <td>
                    <div>{emp.designation}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{emp.department}</div>
                  </td>
                  <td>
                    <div>{emp.email}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{emp.phone}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: emp.active_ticket_count && emp.active_ticket_count > 0 ? '#fffbeb' : '#f0fdf4',
                        color: emp.active_ticket_count && emp.active_ticket_count > 0 ? '#b45309' : '#15803d',
                        border: '1px solid currentColor',
                      }}
                    >
                      {emp.active_ticket_count || 0} Open Tickets
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        emp.availability === 'AVAILABLE'
                          ? 'badge-resolved'
                          : emp.availability === 'BUSY'
                          ? 'badge-in_progress'
                          : 'badge-closed'
                      }`}
                    >
                      {emp.availability}
                    </span>
                  </td>
                  <td>
                    {emp.current_attendance_status === 'CHECKED_IN' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 12, fontWeight: 600 }}>
                        <CheckCircle2 size={13} /> Checked In
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: 12 }}>
                        <Clock size={13} /> Checked Out
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">Register Support Engineer</div>
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
                    placeholder="e.g. Arun Kumar"
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
                      placeholder="arun@kanvtech.com"
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
                      placeholder="+91 98000 00000"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Support Tier Level <span className="required">*</span></label>
                    <select
                      className="form-control"
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          level: e.target.value as any,
                          designation: `${e.target.value} Support Engineer`,
                        })
                      }
                    >
                      <option value="L1">Level 1 (Triage & Standard Resolution)</option>
                      <option value="L2">Level 2 (Senior Technical Diagnostic)</option>
                      <option value="L3">Level 3 (Principal Architecture & Systems)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
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
                    <label className="form-label">Temporary Password</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
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
    </div>
  );
};
