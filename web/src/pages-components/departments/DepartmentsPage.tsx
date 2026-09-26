import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Department, Product, Employee } from '../../types';
import { Layers, Plus, Search, CheckCircle, XCircle, Users, Package, Shield, Edit2 } from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    productId: '',
    managerId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, prodRes, empRes] = await Promise.all([
        api.getDepartments({ search, isActive: statusFilter }),
        api.getProducts(),
        api.getEmployees(),
      ]);
      setDepartments(deptRes.departments || deptRes.data || []);
      setProducts(prodRes.products || prodRes.data || []);
      const allEmps: Employee[] = empRes.employees || empRes.data || [];
      setManagers(allEmps.filter((e) => e.level === 'MANAGER' || (e as any).level === 'MANAGER' || e.designation?.toLowerCase().includes('manager')));
    } catch (err) {
      console.error('Failed to load department master data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingDept(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      productId: products.length > 0 ? products[0].id : '',
      managerId: managers.length > 0 ? managers[0].id : '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      productId: dept.productId || dept.product_id || '',
      managerId: dept.managerId || dept.manager_id || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingDept) {
        await api.updateDepartment(editingDept.id, formData);
      } else {
        await api.createDepartment(formData);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save department configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (dept: Department) => {
    try {
      await api.toggleDepartmentStatus(dept.id, !dept.isActive);
      loadData();
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Department Master</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 12 }}>
              {departments.length} product departments
            </span>
          </h2>
          <div className="page-subtitle">Product-specialized operational teams, department managers, and employee tier allocations</div>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={15} /> Add Support Department
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input">
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search department name, code, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="true">Active Departments</option>
          <option value="false">Inactive Departments</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dept ID</th>
              <th>Department Name</th>
              <th>Product Specialization</th>
              <th>Assigned Manager</th>
              <th>Specialist Team</th>
              <th>Active Tickets</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  Loading departments...
                </td>
              </tr>
            ) : departments.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                  No support departments found matching filters.
                </td>
              </tr>
            ) : (
              departments.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{d.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Code: {d.code}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Package size={13} color="#2563eb" />
                      <span style={{ fontWeight: 500 }}>{d.product_name || 'General Product'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>
                      {d.manager_name || d.manager?.name || 'Unassigned'}
                    </div>
                    {d.manager?.email && <div style={{ fontSize: 11, color: '#64748b' }}>{d.manager.email}</div>}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Users size={12} /> {d.specialist_count || (d.employees?.length || 0)} Specialists
                    </span>
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
                      {d.active_ticket_count || 0} Open
                    </span>
                  </td>
                  <td>
                    {d.isActive !== false ? (
                      <span className="badge badge-resolved">Active</span>
                    ) : (
                      <span className="badge badge-closed">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(d)}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleStatus(d)}
                      >
                        {d.isActive !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Layers size={20} color="#0b3b60" />
                <div className="modal-title">
                  {editingDept ? `Edit Department • ${editingDept.name}` : 'Create Support Department'}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {error && (
                  <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Department Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Tally Support, Spine HRMS Support"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Department Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. TALLY, SPINE, BIOS360"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Product Specialization *</label>
                    <select
                      className="form-control"
                      value={formData.productId}
                      onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    >
                      <option value="">Select Associated Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department Manager</label>
                  <select
                    className="form-control"
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  >
                    <option value="">Select Department Manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Describe technical support scope, SLA focus, and tier boundaries..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
