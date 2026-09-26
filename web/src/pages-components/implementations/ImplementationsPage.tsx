'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Rocket,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  X,
  AlertCircle,
  Building2,
  Package,
  User,
  Users,
  TrendingUp,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  ListTodo,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

interface ImplementationTask {
  id: string;
  implementation_id: string;
  task_name: string;
  description?: string | null;
  priority?: string | null;
  status: 'PENDING' | 'COMPLETED';
  order_index: number;
  completed_by?: number | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
  created_at: string;
}

interface Implementation {
  id: string;
  company_id: string;
  company_name: string | null;
  company_email: string | null;
  product_id: string;
  product_name: string | null;
  product_code: string | null;
  subscription_id: string | null;
  subscription_plan: string | null;
  owner_employee_id: string | null;
  owner_employee_name: string | null;
  owner_employee_designation: string | null;
  team_members: string[];
  start_date: string;
  target_go_live_date: string;
  actual_go_live_date: string | null;
  status: 'NEW' | 'PLANNING' | 'IN_PROGRESS' | 'CONFIGURATION' | 'TESTING' | 'READY_FOR_GO_LIVE' | 'LIVE' | 'COMPLETED' | 'BLOCKED';
  progress_percentage: number;
  pending_activities: string | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  tasks?: ImplementationTask[];
}

export const ImplementationsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [implementations, setImplementations] = useState<Implementation[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Add Project Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    companyId: '',
    productId: '',
    ownerEmployeeId: '',
    teamMembers: '',
    startDate: new Date().toISOString().split('T')[0],
    targetGoLiveDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'PLANNING',
    pendingActivities: '',
    notes: '',
  });

  // Manage / Update Modal
  const [selectedImp, setSelectedImp] = useState<Implementation | null>(null);
  const [tasks, setTasks] = useState<ImplementationTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<any>('IN_PROGRESS');
  const [updatePending, setUpdatePending] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');

  // Add Task inside modal
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [addingTask, setAddingTask] = useState(false);

  // Editing Task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const statuses = [
    { value: 'NEW', label: 'New Onboarding' },
    { value: 'PLANNING', label: 'Planning & Scope' },
    { value: 'CONFIGURATION', label: 'Configuration & Customization' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'TESTING', label: 'Testing & Validation' },
    { value: 'READY_FOR_GO_LIVE', label: 'Ready for Go-Live' },
    { value: 'LIVE', label: 'Live in Production' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'BLOCKED', label: 'Blocked' },
  ];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (companyFilter !== 'ALL') params.companyId = companyFilter;

      const [impRes, compRes, prodRes, empRes, statsRes] = await Promise.all([
        api.getImplementations(params),
        api.getCompanies({ limit: 100 }),
        api.getProducts({ limit: 100 }),
        api.getEmployees({ limit: 100 }),
        api.getImplementationStats().catch(() => ({ stats: null })),
      ]);

      setImplementations(impRes.data || []);
      setCompanies(compRes.companies || []);
      setProducts(prodRes.data || []);
      setEmployees(empRes.employees || []);
      if (statsRes.stats) setStats(statsRes.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch implementations');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyId || !formData.productId || !formData.startDate || !formData.targetGoLiveDate) {
      alert('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.createImplementation(formData);
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      alert(`Error creating implementation project: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openManageModal = async (imp: Implementation) => {
    setSelectedImp(imp);
    setUpdateStatus(imp.status);
    setUpdatePending(imp.pending_activities || '');
    setUpdateNotes(imp.notes || '');
    setNewTaskName('');
    setNewTaskDesc('');
    setEditingTaskId(null);

    setLoadingTasks(true);
    try {
      const res = await api.getImplementationTasks(imp.id);
      setTasks(res.tasks || res.data || []);
    } catch (err) {
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleToggleTask = async (task: ImplementationTask) => {
    const isCompleted = task.status !== 'COMPLETED';
    try {
      const res = await api.toggleImplementationTask(task.id, isCompleted);
      // Update local task state
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: isCompleted ? 'COMPLETED' : 'PENDING' } : t))
      );
      if (selectedImp && res.progressPercentage !== undefined) {
        setSelectedImp({ ...selectedImp, progress_percentage: res.progressPercentage });
        setImplementations((prev) =>
          prev.map((i) => (i.id === selectedImp.id ? { ...i, progress_percentage: res.progressPercentage } : i))
        );
      }
    } catch (err: any) {
      alert(`Failed to update task: ${err.message}`);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImp || !newTaskName.trim()) return;
    setAddingTask(true);
    try {
      const res = await api.addImplementationTask(selectedImp.id, {
        taskName: newTaskName.trim(),
        description: newTaskDesc.trim() || undefined,
        priority: newTaskPriority,
      });
      setTasks((prev) => [...prev, res.task]);
      setNewTaskName('');
      setNewTaskDesc('');
      if (res.progressPercentage !== undefined) {
        setSelectedImp({ ...selectedImp, progress_percentage: res.progressPercentage });
        setImplementations((prev) =>
          prev.map((i) => (i.id === selectedImp.id ? { ...i, progress_percentage: res.progressPercentage } : i))
        );
      }
    } catch (err: any) {
      alert(`Failed to add task: ${err.message}`);
    } finally {
      setAddingTask(false);
    }
  };

  const handleRemoveTask = async (task: ImplementationTask) => {
    if (task.status === 'COMPLETED') {
      const ok = window.confirm(
        'This task is already completed. Removing it will change the implementation progress calculation and historical record. Are you sure you want to delete it?'
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(`Remove task "${task.task_name}"?`);
      if (!ok) return;
    }

    try {
      const res = await api.removeImplementationTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (selectedImp && res.progressPercentage !== undefined) {
        setSelectedImp({ ...selectedImp, progress_percentage: res.progressPercentage });
        setImplementations((prev) =>
          prev.map((i) => (i.id === selectedImp.id ? { ...i, progress_percentage: res.progressPercentage } : i))
        );
      }
    } catch (err: any) {
      alert(`Failed to remove task: ${err.message}`);
    }
  };

  const handleSaveEditTask = async (taskId: string) => {
    if (!editTaskName.trim()) return;
    try {
      await api.updateImplementationTask(taskId, {
        taskName: editTaskName.trim(),
        description: editTaskDesc.trim() || undefined,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, task_name: editTaskName.trim(), description: editTaskDesc.trim() || null } : t
        )
      );
      setEditingTaskId(null);
    } catch (err: any) {
      alert(`Failed to edit task: ${err.message}`);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImp) return;
    setSubmitting(true);
    try {
      await api.updateImplementation(selectedImp.id, {
        status: updateStatus,
        pendingActivities: updatePending,
        notes: updateNotes,
      });
      setSelectedImp(null);
      fetchData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const totalCount = tasks.length;
  const computedProgress = totalCount === 0 ? (selectedImp?.progress_percentage || 0) : Math.round((completedCount / totalCount) * 100);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
      case 'COMPLETED':
        return <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>{status}</span>;
      case 'READY_FOR_GO_LIVE':
        return <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>READY FOR GO-LIVE</span>;
      case 'CONFIGURATION':
      case 'IN_PROGRESS':
        return <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>{status}</span>;
      case 'PLANNING':
      case 'NEW':
        return <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>{status}</span>;
      case 'BLOCKED':
        return <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>BLOCKED</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Rocket className="text-primary" size={24} />
            New Customer Implementations
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Track client onboarding, architecture configuration, task milestones, and automatic go-live readiness
          </p>
        </div>
        {isAdminOrManager && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setFormData({
                companyId: companies[0]?.id || '',
                productId: products[0]?.id || '',
                ownerEmployeeId: employees[0]?.id || '',
                teamMembers: '',
                startDate: new Date().toISOString().split('T')[0],
                targetGoLiveDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'PLANNING',
                pendingActivities: '',
                notes: '',
              });
              setShowAddModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            New Implementation
          </button>
        )}
      </div>

      {/* Metrics Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #0284c7' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7' }}>ACTIVE ONBOARDING</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0b3b60', marginTop: 4 }}>{stats.activeProjects}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6' }}>READY FOR GO-LIVE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#6d28d9', marginTop: 4 }}>{stats.readyForGoLive}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #16a34a' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>LIVE / COMPLETED</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d', marginTop: 4 }}>{stats.live + stats.completed}</div>
          </div>
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #ef4444' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>BLOCKED</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>{stats.blocked}</div>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by ID, customer name, product, or pending activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="#64748b" />
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 170 }}
            >
              <option value="ALL">All Lifecycle Stages</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <select
            className="form-control"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="ALL">All Customer Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>

          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Implementations Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            Loading implementation projects...
          </div>
        ) : error ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#b91c1c' }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            {error}
          </div>
        ) : implementations.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Rocket size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#334155' }}>No Implementation Projects Found</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Click "New Implementation" to onboard a new customer company onto KANVTECH.
            </div>
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 12, color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>PROJECT ID</th>
                <th style={{ padding: '12px 16px' }}>CUSTOMER COMPANY</th>
                <th style={{ padding: '12px 16px' }}>PRODUCT</th>
                <th style={{ padding: '12px 16px' }}>LEAD & TEAM</th>
                <th style={{ padding: '12px 16px' }}>AUTO PROGRESS</th>
                <th style={{ padding: '12px 16px' }}>TARGET GO-LIVE</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {implementations.map((imp) => (
                <tr key={imp.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0b3b60' }}>
                    <code>{imp.id}</code>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{imp.company_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{imp.company_email}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{imp.product_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}><code>{imp.product_code}</code></div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <User size={13} color="#0284c7" />
                      {imp.owner_employee_name || 'Unassigned'}
                    </div>
                    {imp.team_members.length > 0 && (
                      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={11} />
                        {imp.team_members.join(', ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', width: 140 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      <span>{imp.progress_percentage}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${imp.progress_percentage}%`,
                          height: '100%',
                          background: imp.progress_percentage === 100 ? '#16a34a' : (imp.status === 'BLOCKED' ? '#ef4444' : '#0284c7'),
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>
                    {formatDate(imp.target_go_live_date)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {getStatusBadge(imp.status)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => openManageModal(imp)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ListTodo size={13} />
                      Tasks & Progress
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Implementation Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Create New Customer Implementation</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Customer Company *</label>
                  <select
                    className="form-control"
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Product Suite *</label>
                  <select
                    className="form-control"
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Implementation Lead</label>
                  <select
                    className="form-control"
                    value={formData.ownerEmployeeId}
                    onChange={(e) => setFormData({ ...formData, ownerEmployeeId: e.target.value })}
                  >
                    <option value="">-- Choose Lead --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.level})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Initial Status</label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Team Members (Comma separated)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Amit Sharma, Vikram Malhotra, Priya Nair"
                  value={formData.teamMembers}
                  onChange={(e) => setFormData({ ...formData, teamMembers: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Start Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Target Go-Live Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.targetGoLiveDate}
                    onChange={(e) => setFormData({ ...formData, targetGoLiveDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Pending Activities & Scope Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Database schema mapping, custom plugin configuration..."
                  value={formData.pendingActivities}
                  onChange={(e) => setFormData({ ...formData, pendingActivities: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Checklist & Management Modal (Updates #4 & #7) */}
      {selectedImp && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  Implementation Checklist & Progress • {selectedImp.id}
                </h3>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  {selectedImp.company_name} • <strong>{selectedImp.product_name}</strong>
                </div>
              </div>
              <button onClick={() => setSelectedImp(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Dynamic Progress Indicator */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  AUTOMATIC TASK-BASED PROGRESS
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: computedProgress === 100 ? '#16a34a' : '#0284c7' }}>
                  {totalCount > 0 ? `${completedCount} / ${totalCount} Tasks (${computedProgress}%)` : `${computedProgress}% (No Tasks)`}
                </div>
              </div>
              <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${computedProgress}%`,
                    height: '100%',
                    background: computedProgress === 100 ? '#16a34a' : (updateStatus === 'BLOCKED' ? '#ef4444' : '#0284c7'),
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* Interactive Task Checklist */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ListTodo size={16} color="#0284c7" />
                  Implementation Tasks
                </h4>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Check off tasks as completed to update progress
                </span>
              </div>

              {loadingTasks ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 6px auto', display: 'block' }} />
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: 20, background: '#f8fafc', borderRadius: 6, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>No tasks assigned yet. Add tasks below to start tracking.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '10px 14px',
                        background: task.status === 'COMPLETED' ? '#f0fdf4' : '#ffffff',
                        border: `1px solid ${task.status === 'COMPLETED' ? '#bbf7d0' : '#e2e8f0'}`,
                        borderRadius: 6,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Checkbox Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          marginTop: 2,
                          color: task.status === 'COMPLETED' ? '#16a34a' : '#94a3b8',
                        }}
                      >
                        {task.status === 'COMPLETED' ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>

                      {/* Task Content / Inline Edit */}
                      <div style={{ flex: 1 }}>
                        {editingTaskId === task.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <input
                              type="text"
                              className="form-control"
                              value={editTaskName}
                              onChange={(e) => setEditTaskName(e.target.value)}
                              style={{ fontSize: 13, padding: '4px 8px' }}
                            />
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Description (optional)"
                              value={editTaskDesc}
                              onChange={(e) => setEditTaskDesc(e.target.value)}
                              style={{ fontSize: 12, padding: '4px 8px' }}
                            />
                            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() => handleSaveEditTask(task.id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => setEditingTaskId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: task.status === 'COMPLETED' ? '#166534' : '#1e293b',
                                textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                              }}
                            >
                              {task.task_name}
                            </div>
                            {task.description && (
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{task.description}</div>
                            )}
                            {task.completed_by_name && (
                              <div style={{ fontSize: 10, color: '#15803d', marginTop: 3 }}>
                                Completed by: {task.completed_by_name}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Admin Task Actions */}
                      {isAdminOrManager && editingTaskId !== task.id && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setEditTaskName(task.task_name);
                              setEditTaskDesc(task.description || '');
                            }}
                            title="Edit Task"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTask(task)}
                            title="Remove Task"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Admin Add Task Form */}
              {isAdminOrManager && (
                <form
                  onSubmit={handleAddTask}
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+ Task Name (e.g. Configure Client Firewall)"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    style={{ flex: 2, minWidth: 200, fontSize: 13 }}
                    required
                  />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Description (Optional)"
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    style={{ flex: 2, minWidth: 160, fontSize: 13 }}
                  />
                  <select
                    className="form-control"
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    style={{ width: 100, fontSize: 12 }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addingTask}>
                    {addingTask ? 'Adding...' : '+ Add Task'}
                  </button>
                </form>
              )}
            </div>

            {/* Lifecycle Details & Notes */}
            <form onSubmit={handleSaveDetails}>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Lifecycle Status</label>
                  <select
                    className="form-control"
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Pending Activities / Next Deliverables</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={updatePending}
                    onChange={(e) => setUpdatePending(e.target.value)}
                    placeholder="e.g. UAT sign-off scheduled for Friday."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12 }}>Progress Notes & Status Updates</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={updateNotes}
                    onChange={(e) => setUpdateNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedImp(null)}>
                    Close
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Project Updates'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

