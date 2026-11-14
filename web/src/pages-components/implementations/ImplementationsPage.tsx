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
  Layers,
  ChevronDown,
  ChevronRight,
  Clock,
  Check,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

interface ImplementationTask {
  id: string;
  implementation_id: string;
  module_id?: string | null;
  module_name?: string | null;
  task_name: string;
  description?: string | null;
  priority?: string | null;
  status: 'PENDING' | 'COMPLETED';
  order_index: number;
  assigned_employee_id?: string | null;
  assigned_employee_name?: string | null;
  assigned_employee_level?: string | null;
  assigned_employee_designation?: string | null;
  due_date?: string | null;
  completed_by?: number | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
  created_at: string;
}

interface ModuleProgress {
  id: string;
  name: string;
  description?: string | null;
  tasks: ImplementationTask[];
  totalCount: number;
  completedCount: number;
  progressPercentage: number;
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
  generalTasks?: ImplementationTask[];
  modules?: ModuleProgress[];
  entitledModules?: Array<{ id: string; name: string; description?: string; submodules?: any[] }>;
  metrics?: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    progressPercentage: number;
  };
}

export const ImplementationsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission('implementation.create');
  const isAdminOrManager =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'PLATFORM_INCHARGE' ||
    user?.role === 'MANAGER' ||
    hasPermission('implementation.update') ||
    hasPermission('implementation.assign');

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

  // Add Project Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addCompanyId, setAddCompanyId] = useState('');
  const [companyProducts, setCompanyProducts] = useState<any[]>([]);
  const [loadingCompanyProducts, setLoadingCompanyProducts] = useState(false);
  const [addProductId, setAddProductId] = useState('');
  const [addOwnerEmployeeId, setAddOwnerEmployeeId] = useState('');
  const [selectedTeamEmployeeIds, setSelectedTeamEmployeeIds] = useState<string[]>([]);
  const [addStartDate, setAddStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [addTargetGoLiveDate, setAddTargetGoLiveDate] = useState(
    new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [addPriority, setAddPriority] = useState('MEDIUM');
  const [addStatus, setAddStatus] = useState('PLANNING');
  const [addDescription, setAddDescription] = useState('');
  const [addPendingActivities, setAddPendingActivities] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Entitled Modules for Add Modal
  const [entitledModules, setEntitledModules] = useState<any[]>([]);
  const [loadingEntitledModules, setLoadingEntitledModules] = useState(false);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [initialModuleTasks, setInitialModuleTasks] = useState<Record<string, Array<{ taskName: string; assignedEmployeeId?: string; priority: string; dueDate?: string }>>>({});

  // Manage / Detail Modal State
  const [selectedImp, setSelectedImp] = useState<Implementation | null>(null);
  const [impDetail, setImpDetail] = useState<Implementation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<any>('IN_PROGRESS');
  const [updatePending, setUpdatePending] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');

  // Add Task inside detail modal
  const [taskModuleId, setTaskModuleId] = useState<string>('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showAddTaskFormForModule, setShowAddTaskFormForModule] = useState<string | null>(null);

  // Editing Task State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskAssignee, setEditTaskAssignee] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState('MEDIUM');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskModuleId, setEditTaskModuleId] = useState('');

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
      setCompanies(compRes.data || []);
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

  const handleOpenAddModal = () => {
    const defaultComp = companies[0]?.id || '';
    setAddCompanyId(defaultComp);
    setAddProductId('');
    setCompanyProducts([]);
    setAddOwnerEmployeeId(employees[0]?.id || '');
    setSelectedTeamEmployeeIds([]);
    setAddStartDate(new Date().toISOString().split('T')[0]);
    setAddTargetGoLiveDate(new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setAddPriority('MEDIUM');
    setAddStatus('PLANNING');
    setAddDescription('');
    setAddPendingActivities('');
    setAddError(null);
    setShowAddModal(true);
  };

  // Dynamic Dependency 1: When Customer changes, fetch mapped products for that customer
  useEffect(() => {
    if (!addCompanyId) {
      setCompanyProducts([]);
      setAddProductId('');
      return;
    }

    setLoadingCompanyProducts(true);
    api.getCustomerImplementationProducts(addCompanyId)
      .then((res: any) => {
        const prods = res.products || res.data || [];
        setCompanyProducts(prods);
        if (prods.length > 0) {
          setAddProductId(prods[0].productId);
        } else {
          setAddProductId('');
        }
      })
      .catch((err) => {
        console.error('Failed to load customer products:', err);
        setCompanyProducts([]);
        setAddProductId('');
      })
      .finally(() => {
        setLoadingCompanyProducts(false);
      });
  }, [addCompanyId]);

  // Dynamic Dependency 2: When Customer & Product change, load that customer's entitled modules & submodules
  useEffect(() => {
    if (!addCompanyId || !addProductId) {
      setEntitledModules([]);
      setSelectedModuleIds([]);
      setInitialModuleTasks({});
      return;
    }

    setLoadingEntitledModules(true);
    api.getEntitledImplementationModules(addCompanyId, addProductId)
      .then((res) => {
        const mods = res.modules || res.data || [];
        setEntitledModules(mods);
        setSelectedModuleIds(mods.map((m: any) => m.id));
        const initTasks: Record<string, any[]> = {};
        for (const m of mods) {
          if (m.submodules && m.submodules.length > 0) {
            initTasks[m.id] = m.submodules.map((s: any) => ({
              taskName: `${s.name} Configuration`,
              priority: addPriority || 'MEDIUM',
              assignedEmployeeId: addOwnerEmployeeId || '',
            }));
          } else {
            initTasks[m.id] = [
              {
                taskName: `${m.name} Rollout & Setup`,
                priority: addPriority || 'MEDIUM',
                assignedEmployeeId: addOwnerEmployeeId || '',
              },
            ];
          }
        }
        setInitialModuleTasks(initTasks);
      })
      .catch(() => {
        setEntitledModules([]);
        setSelectedModuleIds([]);
        setInitialModuleTasks({});
      })
      .finally(() => {
        setLoadingEntitledModules(false);
      });
  }, [addCompanyId, addProductId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleToggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleAddInitialTaskItem = (moduleId: string, taskName: string) => {
    if (!taskName.trim()) return;
    setInitialModuleTasks((prev) => ({
      ...prev,
      [moduleId]: [
        ...(prev[moduleId] || []),
        {
          taskName: taskName.trim(),
          priority: addPriority || 'MEDIUM',
          assignedEmployeeId: addOwnerEmployeeId || '',
        },
      ],
    }));
  };

  const handleRemoveInitialTaskItem = (moduleId: string, index: number) => {
    setInitialModuleTasks((prev) => ({
      ...prev,
      [moduleId]: (prev[moduleId] || []).filter((_, i) => i !== index),
    }));
  };

  const handleToggleTeamEmployee = (empId: string) => {
    setSelectedTeamEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addCompanyId) {
      setAddError('Please select a Customer Company.');
      return;
    }
    if (!addProductId) {
      setAddError('Please select a Product Suite mapped to this customer.');
      return;
    }
    if (!addStartDate || !addTargetGoLiveDate) {
      setAddError('Start Date and Target Go-Live Date are required.');
      return;
    }
    if (new Date(addTargetGoLiveDate) < new Date(addStartDate)) {
      setAddError('Target Go-Live Date cannot be earlier than the Start Date.');
      return;
    }

    setSubmitting(true);
    try {
      const tasksToCreate: any[] = [];
      for (const modId of selectedModuleIds) {
        const modTasks = initialModuleTasks[modId] || [];
        for (const t of modTasks) {
          tasksToCreate.push({
            moduleId: modId,
            taskName: t.taskName,
            assignedEmployeeId: t.assignedEmployeeId || addOwnerEmployeeId || undefined,
            priority: t.priority || addPriority || 'MEDIUM',
            dueDate: t.dueDate || addTargetGoLiveDate || undefined,
          });
        }
      }

      // Convert selected team employee IDs to employee names/IDs
      const teamMemberNames = selectedTeamEmployeeIds
        .map((id) => {
          const emp = employees.find((e) => e.id === id);
          return emp ? `${emp.name} (${emp.id})` : id;
        });

      await api.createImplementation({
        companyId: addCompanyId,
        productId: addProductId,
        ownerEmployeeId: addOwnerEmployeeId || undefined,
        teamMembers: teamMemberNames.length > 0 ? teamMemberNames : undefined,
        startDate: addStartDate,
        targetGoLiveDate: addTargetGoLiveDate,
        status: addStatus,
        priority: addPriority,
        description: addDescription || undefined,
        pendingActivities: addPendingActivities || undefined,
        notes: addDescription || addPendingActivities || undefined,
        tasks: tasksToCreate,
      });

      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      setAddError(err.message || 'Error creating implementation project.');
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
    setNewTaskAssignee('');
    setNewTaskDueDate('');
    setNewTaskPriority('MEDIUM');
    setTaskModuleId('');
    setEditingTaskId(null);
    setShowAddTaskFormForModule(null);

    setLoadingDetail(true);
    try {
      const res = await api.getImplementation(imp.id);
      if (res.implementation) {
        setImpDetail(res.implementation);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshDetail = async (impId: string) => {
    try {
      const res = await api.getImplementation(impId);
      if (res.implementation) {
        setImpDetail(res.implementation);
        // Sync table progress
        setImplementations((prev) =>
          prev.map((i) =>
            i.id === impId
              ? { ...i, progress_percentage: res.implementation.progress_percentage, status: res.implementation.status }
              : i
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (task: ImplementationTask) => {
    const isCompleted = task.status !== 'COMPLETED';
    try {
      await api.toggleImplementationTask(task.id, isCompleted);
      if (selectedImp) {
        await refreshDetail(selectedImp.id);
      }
    } catch (err: any) {
      alert(`Failed to update task: ${err.message}`);
    }
  };

  const handleAddTask = async (e: React.FormEvent, forcedModuleId?: string | null) => {
    e.preventDefault();
    if (!selectedImp || !newTaskName.trim()) return;
    setAddingTask(true);
    try {
      const modId = forcedModuleId !== undefined ? forcedModuleId : (taskModuleId || undefined);
      await api.addImplementationTask(selectedImp.id, {
        moduleId: modId || undefined,
        taskName: newTaskName.trim(),
        description: newTaskDesc.trim() || undefined,
        assignedEmployeeId: newTaskAssignee || undefined,
        priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined,
      });

      setNewTaskName('');
      setNewTaskDesc('');
      setNewTaskAssignee('');
      setNewTaskDueDate('');
      setShowAddTaskFormForModule(null);
      await refreshDetail(selectedImp.id);
    } catch (err: any) {
      alert(`Failed to add task: ${err.message}`);
    } finally {
      setAddingTask(false);
    }
  };

  const handleRemoveTask = async (task: ImplementationTask) => {
    if (task.status === 'COMPLETED') {
      const ok = window.confirm(
        'This task is completed. Removing it will update the progress metrics. Delete this checklist item?'
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(`Remove task "${task.task_name}"?`);
      if (!ok) return;
    }

    try {
      await api.removeImplementationTask(task.id);
      if (selectedImp) {
        await refreshDetail(selectedImp.id);
      }
    } catch (err: any) {
      alert(`Failed to remove task: ${err.message}`);
    }
  };

  const handleStartEditTask = (task: ImplementationTask) => {
    setEditingTaskId(task.id);
    setEditTaskName(task.task_name);
    setEditTaskDesc(task.description || '');
    setEditTaskAssignee(task.assigned_employee_id || '');
    setEditTaskPriority(task.priority || 'MEDIUM');
    setEditTaskDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    setEditTaskModuleId(task.module_id || '');
  };

  const handleSaveEditTask = async (taskId: string) => {
    if (!editTaskName.trim()) return;
    try {
      await api.updateImplementationTask(taskId, {
        taskName: editTaskName.trim(),
        description: editTaskDesc.trim() || undefined,
        assignedEmployeeId: editTaskAssignee || undefined,
        priority: editTaskPriority,
        dueDate: editTaskDueDate || undefined,
        moduleId: editTaskModuleId || undefined,
      });
      setEditingTaskId(null);
      if (selectedImp) {
        await refreshDetail(selectedImp.id);
      }
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
      setImpDetail(null);
      fetchData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

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

  const getPriorityBadge = (priority?: string | null) => {
    const p = (priority || 'MEDIUM').toUpperCase();
    switch (p) {
      case 'URGENT':
      case 'CRITICAL':
      case 'HIGH':
        return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#b91c1c' }}>{p}</span>;
      case 'MEDIUM':
        return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>MED</span>;
      case 'LOW':
        return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>LOW</span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Rocket className="text-primary" size={24} />
            Customer Implementations & Module Rollout
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Module-wise onboarding checklists, task allocations, progress tracking, and go-live milestone governance
          </p>
        </div>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 6,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Create New Implementation
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
              <option key={c.id} value={c.id}>{c.company_name || c.companyName}</option>
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
                <th style={{ padding: '12px 16px' }}>CHECKLIST PROGRESS</th>
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
                    {imp.team_members && imp.team_members.length > 0 && (
                      <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={11} />
                        {imp.team_members.join(', ')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', width: 150 }}>
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
                      Modules & Tasks
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. ADD IMPLEMENTATION MODAL WITH DYNAMIC DEPENDENCIES     */}
      {/* ========================================================= */}
      {showAddModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 740, maxHeight: '92vh', overflowY: 'auto', padding: 24, background: 'white', borderRadius: 8, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Rocket size={20} className="text-primary" />
                  Create New Client Implementation
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  Initialize client rollout project, configure module scope, assign project lead & team, and generate onboarding checklists
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {addError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreate}>
              {/* Row 1: Customer Company & Product Suite (Dynamic Dependency) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Customer Company *
                  </label>
                  <select
                    className="form-control"
                    value={addCompanyId}
                    onChange={(e) => setAddCompanyId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Customer Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name || c.companyName} ({c.id})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Product Suite (Customer Mapped) *
                  </label>
                  <select
                    className="form-control"
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    required
                    disabled={!addCompanyId || loadingCompanyProducts}
                  >
                    {!addCompanyId ? (
                      <option value="">-- Select Customer First --</option>
                    ) : loadingCompanyProducts ? (
                      <option value="">Loading customer mapped products...</option>
                    ) : companyProducts.length === 0 ? (
                      <option value="">-- No products mapped to this customer --</option>
                    ) : (
                      <>
                        <option value="">-- Select Mapped Product --</option>
                        {companyProducts.map((cp) => (
                          <option key={cp.productId} value={cp.productId}>
                            {cp.product?.name || cp.productId} ({cp.product?.code || 'Product'})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <div style={{ fontSize: 11, color: companyProducts.length === 0 && addCompanyId && !loadingCompanyProducts ? '#dc2626' : '#64748b', marginTop: 4 }}>
                    {loadingCompanyProducts ? (
                      'Checking client product assignments...'
                    ) : addCompanyId && companyProducts.length === 0 ? (
                      '⚠ This customer has no active assigned products. Please map products in Company Management first.'
                    ) : addCompanyId && companyProducts.length > 0 ? (
                      `✓ ${companyProducts.length} product(s) entitled to this customer`
                    ) : (
                      'Select a customer to display only their purchased products'
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Project Lead & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Project Lead (Eligible Employee)
                  </label>
                  <select
                    className="form-control"
                    value={addOwnerEmployeeId}
                    onChange={(e) => setAddOwnerEmployeeId(e.target.value)}
                  >
                    <option value="">-- Choose Project Lead Specialist --</option>
                    {employees
                      .filter((emp) => !emp.status || emp.status === 'ACTIVE')
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.designation || emp.level || emp.id})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Priority
                  </label>
                  <select
                    className="form-control"
                    value={addPriority}
                    onChange={(e) => setAddPriority(e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Initial Status, Start Date & Target Go-Live Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Initial Status
                  </label>
                  <select
                    className="form-control"
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                  >
                    <option value="PLANNING">Planning & Scope</option>
                    <option value="NEW">New Onboarding</option>
                    <option value="CONFIGURATION">Configuration & Customization</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="TESTING">Testing & Validation</option>
                    <option value="READY_FOR_GO_LIVE">Ready for Go-Live</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={addStartDate}
                    onChange={(e) => setAddStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Target Go-Live Date *
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={addTargetGoLiveDate}
                    min={addStartDate}
                    onChange={(e) => setAddTargetGoLiveDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Row 4: Implementation Team (Multi-select active employees) */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Implementation Team (Multi-Select Eligible Employees)</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{selectedTeamEmployeeIds.length} employee(s) selected</span>
                </label>
                
                {/* Selected Team Members Badges */}
                {selectedTeamEmployeeIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    {selectedTeamEmployeeIds.map((id) => {
                      const emp = employees.find((e) => e.id === id);
                      return (
                        <span
                          key={id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <User size={12} />
                          {emp ? emp.name : id}
                          <button
                            type="button"
                            onClick={() => handleToggleTeamEmployee(id)}
                            style={{ background: 'transparent', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0, display: 'flex' }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <select
                  className="form-control"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleToggleTeamEmployee(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Add Team Member to Implementation Project...</option>
                  {employees
                    .filter((emp) => (!emp.status || emp.status === 'ACTIVE') && !selectedTeamEmployeeIds.includes(emp.id) && emp.id !== addOwnerEmployeeId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.designation || emp.level || emp.id})
                      </option>
                    ))}
                </select>
              </div>

              {/* Row 5: Implementation Description & Scope Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Implementation Description
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Full-scale client deployment, initial environment configuration..."
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                    Pending Activities & Scope Notes
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Pending Active Directory integration, biometric device mapping..."
                    value={addPendingActivities}
                    onChange={(e) => setAddPendingActivities(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 6: Module and Task Initialization (Dynamic Dependency & Checklist) */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={16} color="#0284c7" />
                    Product Modules & Auto-Generated Onboarding Tasks
                  </div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedModuleIds.length} module(s) selected
                  </span>
                </div>

                {loadingEntitledModules ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    <RefreshCw size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
                    Loading entitled modules and generating checklist tasks...
                  </div>
                ) : !addCompanyId || !addProductId ? (
                  <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    Please select a Customer Company and Product Suite to preview modules and checklist tasks.
                  </div>
                ) : entitledModules.length === 0 ? (
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#b45309', fontSize: 12 }}>
                    No entitled modules found for this customer and product. A baseline setup task will be created automatically.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {entitledModules.map((mod: any) => {
                      const isChecked = selectedModuleIds.includes(mod.id);
                      const modTasks = initialModuleTasks[mod.id] || [];
                      return (
                        <div
                          key={mod.id}
                          style={{
                            background: isChecked ? '#ffffff' : '#f1f5f9',
                            border: `1px solid ${isChecked ? '#cbd5e1' : '#e2e8f0'}`,
                            borderRadius: 6,
                            padding: 10,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: 13, color: isChecked ? '#0f172a' : '#64748b' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleModuleSelection(mod.id)}
                              />
                              {mod.name}
                            </label>
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {modTasks.length} checklist item(s)
                            </span>
                          </div>

                          {isChecked && (
                            <div style={{ marginTop: 8, paddingLeft: 24, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                              {modTasks.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                                  {modTasks.map((t, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                                      <span>☐ {t.taskName}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveInitialTaskItem(mod.id, idx)}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                  type="text"
                                  placeholder={`+ Add checklist task for ${mod.name} (e.g. Master Data Migration)`}
                                  className="form-control"
                                  style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddInitialTaskItem(mod.id, (e.target as HTMLInputElement).value);
                                      (e.target as HTMLInputElement).value = '';
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !addCompanyId || !addProductId || (companyProducts.length === 0 && !loadingCompanyProducts)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Creating Implementation...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Implementation Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MANAGE / DETAIL MODAL WITH MODULE-WISE TASKS & ROLLS  */}
      {/* ========================================================= */}
      {selectedImp && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 840, maxHeight: '92vh', overflowY: 'auto', padding: 24, background: 'white', borderRadius: 8 }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Rocket size={20} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {selectedImp.company_name} • {selectedImp.product_name}
                  </h3>
                  <code>{selectedImp.id}</code>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Lead: <strong>{selectedImp.owner_employee_name || 'Unassigned'}</strong> • Start: {formatDate(selectedImp.start_date)} • Target Go-Live: {formatDate(selectedImp.target_go_live_date)}
                </div>
              </div>
              <button onClick={() => { setSelectedImp(null); setImpDetail(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#64748b" />
              </button>
            </div>

            {loadingDetail ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                Loading implementation modules & tasks...
              </div>
            ) : (
              <div>
                {/* Overall Dynamic Progress Banner */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Overall Implementation Progress
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: (impDetail?.metrics?.progressPercentage || selectedImp.progress_percentage) === 100 ? '#16a34a' : '#0284c7' }}>
                      {impDetail?.metrics?.totalTasks
                        ? `${impDetail.metrics.completedTasks} / ${impDetail.metrics.totalTasks} Tasks Completed (${impDetail.metrics.progressPercentage}%)`
                        : `${selectedImp.progress_percentage}% (Checklist Active)`}
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${impDetail?.metrics?.progressPercentage !== undefined ? impDetail.metrics.progressPercentage : selectedImp.progress_percentage}%`,
                        height: '100%',
                        background: (impDetail?.metrics?.progressPercentage || selectedImp.progress_percentage) === 100 ? '#16a34a' : (updateStatus === 'BLOCKED' ? '#ef4444' : '#0284c7'),
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Module-wise Sections */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Layers size={16} color="#0284c7" />
                      Implementation Modules & Checklists
                    </h4>
                    {isAdminOrManager && (
                      <button
                        className="btn btn-secondary btn-xs"
                        onClick={() => {
                          setTaskModuleId(impDetail?.modules?.[0]?.id || '');
                          setShowAddTaskFormForModule('CUSTOM_NEW');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Plus size={12} /> Add Task
                      </button>
                    )}
                  </div>

                  {(!impDetail?.modules || impDetail.modules.length === 0) && (!impDetail?.generalTasks || impDetail.generalTasks.length === 0) ? (
                    <div style={{ padding: 20, background: '#f8fafc', borderRadius: 6, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: 13, color: '#64748b' }}>No modules or tasks configured. Click "+ Add Task" to create checklist items.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {impDetail?.modules?.map((mod) => (
                        <div
                          key={mod.id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: '#ffffff',
                          }}
                        >
                          {/* Module Header with Progress */}
                          <div
                            style={{
                              background: '#f8fafc',
                              borderBottom: '1px solid #e2e8f0',
                              padding: '10px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{mod.name}</span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    background: mod.totalCount > 0 && mod.completedCount === mod.totalCount ? '#dcfce7' : '#e0f2fe',
                                    color: mod.totalCount > 0 && mod.completedCount === mod.totalCount ? '#15803d' : '#0369a1',
                                  }}
                                >
                                  {mod.completedCount} / {mod.totalCount} Completed ({mod.progressPercentage}%)
                                </span>
                              </div>
                              {mod.description && (
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{mod.description}</div>
                              )}
                            </div>

                            {isAdminOrManager && (
                              <button
                                className="btn btn-outline btn-xs"
                                onClick={() => {
                                  setTaskModuleId(mod.id);
                                  setShowAddTaskFormForModule(showAddTaskFormForModule === mod.id ? null : mod.id);
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Plus size={12} /> Add Checklist Item
                              </button>
                            )}
                          </div>

                          {/* Inline Add Task Form for this module */}
                          {showAddTaskFormForModule === mod.id && (
                            <form
                              onSubmit={(e) => handleAddTask(e, mod.id)}
                              style={{
                                background: '#f0fdf4',
                                borderBottom: '1px solid #bbf7d0',
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}
                            >
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder={`+ Checklist task for ${mod.name} (e.g. Data Migration, Device Setup)`}
                                  value={newTaskName}
                                  onChange={(e) => setNewTaskName(e.target.value)}
                                  style={{ flex: 3, minWidth: 220, fontSize: 13 }}
                                  required
                                  autoFocus
                                />
                                <select
                                  className="form-control"
                                  value={newTaskAssignee}
                                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                                  style={{ flex: 2, minWidth: 160, fontSize: 12 }}
                                >
                                  <option value="">-- Assign Employee --</option>
                                  {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.level})</option>
                                  ))}
                                </select>
                                <select
                                  className="form-control"
                                  value={newTaskPriority}
                                  onChange={(e) => setNewTaskPriority(e.target.value)}
                                  style={{ width: 100, fontSize: 12 }}
                                >
                                  <option value="LOW">Low</option>
                                  <option value="MEDIUM">Medium</option>
                                  <option value="HIGH">High</option>
                                  <option value="URGENT">Urgent</option>
                                </select>
                                <input
                                  type="date"
                                  className="form-control"
                                  value={newTaskDueDate}
                                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                                  style={{ width: 130, fontSize: 12 }}
                                />
                                <button type="submit" className="btn btn-primary btn-sm" disabled={addingTask}>
                                  {addingTask ? 'Saving...' : 'Add'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setShowAddTaskFormForModule(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Description / scope notes for this checklist item (optional)"
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                style={{ fontSize: 12 }}
                              />
                            </form>
                          )}

                          {/* Task Checklist Items */}
                          {mod.tasks.length === 0 ? (
                            <div style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>
                              No checklist tasks added for {mod.name} yet.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {mod.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 14px',
                                    borderBottom: '1px solid #f1f5f9',
                                    background: task.status === 'COMPLETED' ? '#f0fdf4' : '#ffffff',
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
                                      color: task.status === 'COMPLETED' ? '#16a34a' : '#94a3b8',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    {task.status === 'COMPLETED' ? <CheckSquare size={18} /> : <Square size={18} />}
                                  </button>

                                  {/* Task Info / Inline Edit */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {editingTaskId === task.id ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                          <input
                                            type="text"
                                            className="form-control"
                                            value={editTaskName}
                                            onChange={(e) => setEditTaskName(e.target.value)}
                                            style={{ flex: 2, fontSize: 13 }}
                                            placeholder="Task Name"
                                          />
                                          <select
                                            className="form-control"
                                            value={editTaskAssignee}
                                            onChange={(e) => setEditTaskAssignee(e.target.value)}
                                            style={{ flex: 1, fontSize: 12 }}
                                          >
                                            <option value="">-- Assign Employee --</option>
                                            {employees.map((emp) => (
                                              <option key={emp.id} value={emp.id}>{emp.name} ({emp.level})</option>
                                            ))}
                                          </select>
                                          <select
                                            className="form-control"
                                            value={editTaskPriority}
                                            onChange={(e) => setEditTaskPriority(e.target.value)}
                                            style={{ width: 90, fontSize: 12 }}
                                          >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                            <option value="URGENT">Urgent</option>
                                          </select>
                                          <input
                                            type="date"
                                            className="form-control"
                                            value={editTaskDueDate}
                                            onChange={(e) => setEditTaskDueDate(e.target.value)}
                                            style={{ width: 130, fontSize: 12 }}
                                          />
                                        </div>
                                        <input
                                          type="text"
                                          className="form-control"
                                          placeholder="Description (optional)"
                                          value={editTaskDesc}
                                          onChange={(e) => setEditTaskDesc(e.target.value)}
                                          style={{ fontSize: 12 }}
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span
                                            style={{
                                              fontSize: 13,
                                              fontWeight: 600,
                                              color: task.status === 'COMPLETED' ? '#166534' : '#1e293b',
                                              textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                                            }}
                                          >
                                            {task.task_name}
                                          </span>
                                          {getPriorityBadge(task.priority)}
                                        </div>
                                        {task.description && (
                                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{task.description}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Assignee Badge & Due Date */}
                                  {editingTaskId !== task.id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      {task.assigned_employee_name ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: '2px 8px',
                                            borderRadius: 12,
                                            background: '#f1f5f9',
                                            color: '#0f172a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                          }}
                                        >
                                          <User size={11} color="#0284c7" />
                                          {task.assigned_employee_name}
                                          {task.assigned_employee_level && (
                                            <span style={{ fontSize: 10, color: '#64748b' }}>({task.assigned_employee_level})</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Unassigned</span>
                                      )}

                                      {task.due_date && (
                                        <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                                          <Calendar size={11} /> {formatDate(task.due_date)}
                                        </span>
                                      )}

                                      {isAdminOrManager && (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditTask(task)}
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
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* General / Unassigned Tasks if any */}
                      {impDetail?.generalTasks && impDetail.generalTasks.length > 0 && (
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
                          <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', fontWeight: 700, fontSize: 13, color: '#475569' }}>
                            General Project Checklists
                          </div>
                          {impDetail.generalTasks.map((task) => (
                            <div
                              key={task.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '10px 14px',
                                borderBottom: '1px solid #f1f5f9',
                                background: task.status === 'COMPLETED' ? '#f0fdf4' : '#ffffff',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleTask(task)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: task.status === 'COMPLETED' ? '#16a34a' : '#94a3b8' }}
                              >
                                {task.status === 'COMPLETED' ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                                  {task.task_name}
                                </span>
                              </div>
                              {task.assigned_employee_name && (
                                <span style={{ fontSize: 11, color: '#0f172a' }}>{task.assigned_employee_name}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* General Add Task Form when "+ Add Task" button clicked */}
                  {showAddTaskFormForModule === 'CUSTOM_NEW' && (
                    <form
                      onSubmit={(e) => handleAddTask(e, taskModuleId)}
                      style={{
                        marginTop: 12,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>+ Add Implementation Checklist Task</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                        <select
                          className="form-control"
                          value={taskModuleId}
                          onChange={(e) => setTaskModuleId(e.target.value)}
                          style={{ fontSize: 12 }}
                        >
                          <option value="">General (No specific module)</option>
                          {impDetail?.modules?.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Task Name (e.g. Custom Validation Rules)"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          style={{ fontSize: 13 }}
                          required
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                        <select
                          className="form-control"
                          value={newTaskAssignee}
                          onChange={(e) => setNewTaskAssignee(e.target.value)}
                          style={{ fontSize: 12 }}
                        >
                          <option value="">-- Assign Employee --</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.level})</option>
                          ))}
                        </select>
                        <select
                          className="form-control"
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value)}
                          style={{ fontSize: 12 }}
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                        <input
                          type="date"
                          className="form-control"
                          value={newTaskDueDate}
                          onChange={(e) => setNewTaskDueDate(e.target.value)}
                          style={{ fontSize: 12 }}
                        />
                      </div>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Task description / specific configuration deliverables (optional)"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowAddTaskFormForModule(null)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={addingTask}>
                          {addingTask ? 'Saving Task...' : 'Save Task Item'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Lifecycle Details & Notes Form */}
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
                      <button type="button" className="btn btn-secondary" onClick={() => { setSelectedImp(null); setImpDetail(null); }}>
                        Close
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Save Project Updates'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
