'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  AlertCircle,
  Clock,
  Calendar,
  X,
  Flag,
  RefreshCw,
  CheckSquare,
  Search,
  Tag,
  Paperclip,
  Upload,
  User,
  Users,
  Check,
  FileText,
  Download,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

export interface TaskAttachment {
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

export interface EmployeeTask {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  task_type?: string;
  priority: string;
  reminder_time?: string | null;
  reminder_triggered_at?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  created_by: string;
  assigned_to: string;
  creator_name?: string;
  creator_email?: string;
  assignee_name?: string;
  assignee_email?: string;
  attachments?: TaskAttachment[];
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

interface Props {
  initialTaskId?: string | null;
}

const PRIORITIES = [
  { id: 'LOW', label: 'Low', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { id: 'MEDIUM', label: 'Medium', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  { id: 'HIGH', label: 'High', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'URGENT', label: 'Urgent', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

const priorityColorMap: Record<string, { color: string; bg: string }> = {
  LOW: { color: '#16a34a', bg: '#f0fdf4' },
  MEDIUM: { color: '#0284c7', bg: '#f0f9ff' },
  HIGH: { color: '#d97706', bg: '#fffbeb' },
  URGENT: { color: '#dc2626', bg: '#fef2f2' },
  CRITICAL: { color: '#dc2626', bg: '#fef2f2' },
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const emptyForm = {
  title: '',
  description: '',
  category: '',
  due_date: '',
  due_time: '',
  task_type: 'SELF TASK',
  priority: 'MEDIUM',
  reminder_date: '',
  reminder_time: '',
  assigned_to_ids: ['MYSELF'] as string[],
  attachments: [] as TaskAttachment[],
};

export const TaskRemindersPage: React.FC<Props> = ({ initialTaskId }) => {
  const { user } = useAuth();
  const isAdminOrManager =
    user?.role === 'ADMIN' ||
    user?.role === 'MANAGER' ||
    (user?.role as string) === 'SUPER_ADMIN';

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Eligible employees list for assignment (filtered by authority hierarchy)
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Modal State & Mode ('PERSONAL' | 'ASSIGNED')
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'PERSONAL' | 'ASSIGNED'>('PERSONAL');
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Detail Modal
  const [viewingTask, setViewingTask] = useState<EmployeeTask | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (activeTab !== 'all') {
        params.filter = activeTab;
      }
      if (priorityFilter !== 'ALL') {
        params.priority = priorityFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.getMyTasks(params);
      setTasks(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load personal tasks');
    } finally {
      setLoading(false);
    }
  }, [activeTab, priorityFilter, searchQuery]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load authorized eligible assignees from backend according to hierarchy
  const loadEligibleEmployees = useCallback(() => {
    setLoadingEmployees(true);
    api
      .getEligibleTaskAssignees()
      .then((res) => {
        const list = res.employees || res.data || [];
        setEmployees(list.filter((e: any) => e.status !== 'INACTIVE' && e.status !== 'SUSPENDED'));
      })
      .catch(() => {
        setEmployees([]);
      })
      .finally(() => setLoadingEmployees(false));
  }, []);

  useEffect(() => {
    loadEligibleEmployees();
  }, [loadEligibleEmployees]);

  const canAssign = isAdminOrManager || employees.length > 0;

  // Close assignee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle initial task from URL / notification click
  useEffect(() => {
    if (initialTaskId) {
      api
        .getTaskById(initialTaskId)
        .then((res) => {
          if (res.task) {
            setViewingTask(res.task);
          }
        })
        .catch(() => {});
    }
  }, [initialTaskId]);

  const openCreatePersonalModal = () => {
    const now = new Date();
    const futureReminder = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const futureTimeStr = futureReminder.toTimeString().substring(0, 5);

    setEditingTask(null);
    setModalMode('PERSONAL');
    setFormData({
      ...emptyForm,
      task_type: 'Personal',
      due_date: todayStr,
      due_time: '18:00',
      reminder_date: todayStr,
      reminder_time: futureTimeStr,
      assigned_to_ids: ['MYSELF'],
      attachments: [],
    });
    setFormError(null);
    setAttachmentError(null);
    setAssigneeSearch('');
    setShowModal(true);
  };

  const openCreateAssignedModal = () => {
    const now = new Date();
    const futureReminder = new Date(now.getTime() + 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const futureTimeStr = futureReminder.toTimeString().substring(0, 5);

    setEditingTask(null);
    setModalMode('ASSIGNED');
    setFormData({
      ...emptyForm,
      task_type: 'Assigned Task',
      due_date: todayStr,
      due_time: '18:00',
      reminder_date: todayStr,
      reminder_time: futureTimeStr,
      assigned_to_ids: [],
      attachments: [],
    });
    setFormError(null);
    setAttachmentError(null);
    setAssigneeSearch('');
    loadEligibleEmployees();
    setShowModal(true);
  };

  const openEditModal = (task: EmployeeTask) => {
    let reminderD = '';
    let reminderT = '';
    if (task.reminder_time) {
      const rDate = new Date(task.reminder_time);
      reminderD = rDate.toISOString().split('T')[0];
      reminderT = rDate.toTimeString().substring(0, 5);
    }

    const isSelf = task.assigned_to === task.created_by;
    setEditingTask(task);
    setModalMode(isSelf ? 'PERSONAL' : 'ASSIGNED');
    setFormData({
      title: task.title,
      description: task.description || '',
      category: task.category || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      due_time: task.due_time || '',
      task_type: isSelf ? 'Personal' : 'Assigned Task',
      priority: task.priority || 'MEDIUM',
      reminder_date: reminderD,
      reminder_time: reminderT,
      assigned_to_ids: [task.assigned_to],
      attachments: task.attachments || [],
    });
    setFormError(null);
    setAttachmentError(null);
    setAssigneeSearch('');
    setShowModal(true);
    setViewingTask(null);
  };

  const toggleAssignee = (id: string) => {
    setFormData((prev) => {
      const exists = prev.assigned_to_ids.includes(id);
      let next: string[];
      if (exists) {
        next = prev.assigned_to_ids.filter((item) => item !== id);
        if (next.length === 0) {
          next = ['MYSELF']; // ensure at least one
        }
      } else {
        next = [...prev.assigned_to_ids, id];
      }
      return { ...prev, assigned_to_ids: next };
    });
  };

  const removeAssigneeChip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData((prev) => {
      const next = prev.assigned_to_ids.filter((item) => item !== id);
      return { ...prev, assigned_to_ids: next.length > 0 ? next : ['MYSELF'] };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachmentError(null);
    setUploadingAttachment(true);

    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.docx', '.csv', '.txt'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    try {
      const uploadedList: TaskAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!allowedExtensions.includes(ext)) {
          throw new Error(`File "${file.name}" has an unsupported format. Allowed: PDF, PNG, JPG, DOCX, XLSX, TXT, CSV.`);
        }

        if (file.size > maxSizeBytes) {
          throw new Error(`File "${file.name}" exceeds the maximum permitted limit of 10MB.`);
        }

        const fd = new FormData();
        fd.append('file', file);

        const res = await api.uploadTaskAttachment(fd);
        if (res.data) {
          uploadedList.push({
            fileName: res.data.fileName || file.name,
            filePath: res.data.filePath,
            fileSize: res.data.fileSize || file.size,
            mimeType: res.data.mimeType || file.type,
          });
        }
      }

      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedList],
      }));
    } catch (err: any) {
      setAttachmentError(err.message || 'File upload failed');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachmentChip = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== index),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Please enter a task title.');
      return;
    }

    if (!formData.due_date) {
      setFormError('Please select a due date.');
      return;
    }

    let combinedReminderIso: string | undefined = undefined;
    if (formData.reminder_date && formData.reminder_time) {
      const rDate = new Date(`${formData.reminder_date}T${formData.reminder_time}:00`);
      if (isNaN(rDate.getTime())) {
        setFormError('Invalid reminder date/time.');
        return;
      }
      combinedReminderIso = rDate.toISOString();
    } else if (formData.reminder_date) {
      combinedReminderIso = new Date(`${formData.reminder_date}T09:00:00`).toISOString();
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category.trim() || undefined,
        due_date: formData.due_date || undefined,
        due_time: formData.due_time || undefined,
        priority: formData.priority,
        reminder_time: combinedReminderIso,
        task_type: modalMode === 'PERSONAL' ? 'Personal' : 'Assigned Task',
        assigned_to_ids: modalMode === 'PERSONAL' ? ['MYSELF'] : formData.assigned_to_ids.filter((id) => id !== 'MYSELF'),
        attachments: formData.attachments,
      };

      if (modalMode === 'ASSIGNED' && (!payload.assigned_to_ids || payload.assigned_to_ids.length === 0)) {
        setFormError('Please select at least one employee to assign this task to.');
        setSaving(false);
        return;
      }

      if (editingTask) {
        await api.updateTask(editingTask.id, payload);
      } else {
        await api.createTask(payload);
      }
      setShowModal(false);
      loadTasks();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (task: EmployeeTask) => {
    try {
      await api.completeTask(task.id);
      loadTasks();
      if (viewingTask?.id === task.id) {
        setViewingTask({ ...viewingTask, status: 'COMPLETED' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete task.');
    }
  };

  const handleReopen = async (task: EmployeeTask) => {
    try {
      await api.updateTask(task.id, { status: 'PENDING' });
      loadTasks();
      if (viewingTask?.id === task.id) {
        setViewingTask({ ...viewingTask, status: 'PENDING' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reopen task.');
    }
  };

  const handleDelete = async (task: EmployeeTask) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.deleteTask(task.id);
      loadTasks();
      setViewingTask(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete task.');
    }
  };

  // Quick stats calculation
  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;
  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdueCount = tasks.filter(
    (t) => t.status === 'PENDING' && t.due_date && new Date(t.due_date) < startOfToday
  ).length;

  // Filtered employees for multi-select
  const filteredEmployees = employees.filter((emp) => {
    const q = assigneeSearch.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.level?.toLowerCase().includes(q) ||
      emp.department_name?.toLowerCase().includes(q)
    );
  });

  // Helper to render assignee name with level
  const getAssigneeLabel = (id: string) => {
    if (id === 'MYSELF') return 'Myself (Personal)';
    const found = employees.find((e) => e.id === id);
    return found ? `${found.name} (${found.level || found.role || 'L1'})` : id;
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            My Tasks & Reminders
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {canAssign
              ? 'Manage personal tasks and assign actionable tasks to lower-level team members'
              : 'Self-created personal tasks and in-app reminders'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadTasks}>
            <RefreshCw size={14} /> Refresh
          </button>
          {canAssign ? (
            <>
              <button
                className="btn btn-primary"
                onClick={openCreatePersonalModal}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0b3b60', borderColor: '#0b3b60' }}
              >
                <Plus size={16} /> Personal Task
              </button>
              <button
                className="btn btn-primary"
                onClick={openCreateAssignedModal}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0284c7', borderColor: '#0284c7' }}
              >
                <Users size={16} /> Assign Task
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={openCreatePersonalModal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0b3b60', borderColor: '#0b3b60' }}
            >
              <Plus size={16} /> Add Task
            </button>
          )}
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div
          className="card"
          style={{ padding: '12px 16px', borderLeft: '4px solid #0284c7', cursor: 'pointer' }}
          onClick={() => setActiveTab('all')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>All Tasks</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{tasks.length}</div>
        </div>
        <div
          className="card"
          style={{ padding: '12px 16px', borderLeft: '4px solid #ef4444', cursor: 'pointer' }}
          onClick={() => setActiveTab('overdue')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>Overdue</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{overdueCount}</div>
        </div>
        <div
          className="card"
          style={{ padding: '12px 16px', borderLeft: '4px solid #d97706', cursor: 'pointer' }}
          onClick={() => setActiveTab('today')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>Due Today</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            {tasks.filter((t) => t.status === 'PENDING' && t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString()).length}
          </div>
        </div>
        <div
          className="card"
          style={{ padding: '12px 16px', borderLeft: '4px solid #16a34a', cursor: 'pointer' }}
          onClick={() => setActiveTab('completed')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{completedCount}</div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'today', label: 'Due Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                borderColor: activeTab === tab.id ? '#0b3b60' : '#e2e8f0',
                background: activeTab === tab.id ? '#e6f0f8' : '#ffffff',
                color: activeTab === tab.id ? '#0b3b60' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Priority Filter */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search tasks..."
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 30, height: 32, fontSize: 12, width: 180 }}
            />
          </div>

          <select
            className="form-control"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ height: 32, fontSize: 12, width: 120 }}
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
          <AlertCircle size={14} style={{ marginRight: 6 }} />
          {error}
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <CheckSquare size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#94a3b8' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>No tasks found</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            {activeTab === 'all' ? 'You do not have any tasks in this view.' : `No tasks found in "${activeTab}" filter.`}
          </div>
          <button
            className="btn btn-primary"
            onClick={openCreatePersonalModal}
            style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0b3b60', borderColor: '#0b3b60' }}
          >
            <Plus size={14} /> Add Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => {
            const isOverdue = task.status === 'PENDING' && task.due_date && new Date(task.due_date) < startOfToday;
            const pStyle = priorityColorMap[task.priority] || priorityColorMap.MEDIUM;
            const hasAttachments = task.attachments && task.attachments.length > 0;
            const isAssignedToOther = task.assignee_name && task.assignee_name !== 'Myself';

            return (
              <div
                key={task.id}
                className="card"
                style={{
                  padding: '14px 18px',
                  borderLeft: `4px solid ${task.status === 'COMPLETED' ? '#16a34a' : isOverdue ? '#ef4444' : pStyle.color}`,
                  background: task.status === 'COMPLETED' ? '#fafafa' : '#ffffff',
                  opacity: task.status === 'COMPLETED' ? 0.8 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                    <button
                      onClick={() => (task.status === 'PENDING' ? handleComplete(task) : handleReopen(task))}
                      title={task.status === 'PENDING' ? 'Mark as Completed' : 'Reopen Task'}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
                    >
                      {task.status === 'COMPLETED' ? (
                        <CheckCircle2 size={20} color="#16a34a" />
                      ) : (
                        <Circle size={20} color="#94a3b8" />
                      )}
                    </button>

                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setViewingTask(task)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: '#0f172a',
                            textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
                          }}
                        >
                          {task.title}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: pStyle.color,
                            background: pStyle.bg,
                            padding: '1px 7px',
                            borderRadius: 4,
                          }}
                        >
                          {task.priority}
                        </span>

                        {task.category && (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#6366f1',
                              background: '#e0e7ff',
                              padding: '1px 6px',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Tag size={10} /> {task.category}
                          </span>
                        )}

                        {/* Task Type Badge: Personal or Assigned */}
                        {task.assigned_to === task.created_by || task.task_type === 'Personal' || task.task_type === 'SELF TASK' ? (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#0369a1',
                              background: '#e0f2fe',
                              padding: '1px 6px',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              fontWeight: 600,
                            }}
                          >
                            <User size={10} /> Type: Personal
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#6b21a8',
                              background: '#faf5ff',
                              padding: '1px 6px',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              fontWeight: 600,
                              border: '1px solid #e9d5ff',
                            }}
                          >
                            <Users size={10} /> Type: Assigned Task
                          </span>
                        )}
                      </div>

                      {/* Assigned By & Assigned To Info */}
                      {task.assigned_to !== task.created_by && (
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span>
                            <strong style={{ color: '#334155' }}>Assigned to:</strong> {task.assignee_name || task.assigned_to}
                          </span>
                          <span>
                            <strong style={{ color: '#334155' }}>Assigned by:</strong> {task.creator_name || task.created_by}
                          </span>
                        </div>
                      )}

                      {task.description && (
                        <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                          {task.description}
                        </div>
                      )}

                      {/* Attachments list on card */}
                      {hasAttachments && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {task.attachments!.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.filePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                padding: '2px 8px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                color: '#0b3b60',
                                textDecoration: 'none',
                              }}
                            >
                              <Paperclip size={11} />
                              <span>{att.fileName}</span>
                              {att.fileSize && <span style={{ color: '#94a3b8' }}>({formatFileSize(att.fileSize)})</span>}
                            </a>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                        {task.due_date && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: isOverdue ? '#b91c1c' : '#475569',
                              fontWeight: isOverdue ? 700 : 500,
                            }}
                          >
                            <Calendar size={13} /> Due: {formatDate(task.due_date)}
                            {task.due_time ? ` at ${task.due_time}` : ''}
                            {isOverdue && <span style={{ color: '#dc2626', fontWeight: 800, marginLeft: 4 }}>● OVERDUE</span>}
                          </span>
                        )}

                        {task.reminder_time && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0284c7' }}>
                            <Bell size={13} /> Reminder: {new Date(task.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({formatDate(task.reminder_time)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(task)}
                      title="Edit Task"
                      style={{ padding: '5px 8px' }}
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDelete(task)}
                      title="Delete Task"
                      style={{ padding: '5px 8px', color: '#dc2626' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT TASK MODAL (Task Tracker Two-Column Style)     */}
      {/* ========================================================= */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 780,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              background: '#ffffff',
              borderRadius: 10,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Accent Stripe */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #0b3b60 0%, #0284c7 50%, #38bdf8 100%)' }} />

            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 22px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: '#0b3b60',
                    textTransform: 'uppercase',
                  }}
                >
                  {editingTask
                    ? 'Edit Task'
                    : modalMode === 'ASSIGNED'
                    ? 'Assign Task to Team Member'
                    : 'Add Personal Task'}
                </span>
              </div>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Scrollable Area */}
            <form
              onSubmit={handleSave}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {formError && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: 6,
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

              {/* Two Column Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px 24px',
                }}
              >
                {/* LEFT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Task Title */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 5 }}>
                      Task Title <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Call ABC customer regarding AMC agreement"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      autoFocus
                      style={{ fontSize: 13, height: 38 }}
                    />
                  </div>

                  {/* Due Date & Due Time Side by Side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Due Date <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.due_date}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          required
                          style={{ fontSize: 13, height: 38 }}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Due Time
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="time"
                          className="form-control"
                          value={formData.due_time}
                          onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                          style={{ fontSize: 13, height: 38 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Priority Selector (Radio Pills) */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      Priority
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {PRIORITIES.map((p) => {
                        const isSelected = formData.priority === p.id;
                        return (
                          <label
                            key={p.id}
                            style={{
                              flex: 1,
                              minWidth: 65,
                              padding: '7px 10px',
                              borderRadius: 6,
                              border: `1.5px solid ${isSelected ? p.color : '#e2e8f0'}`,
                              background: isSelected ? p.bg : '#ffffff',
                              color: isSelected ? p.color : '#475569',
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: 12,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              transition: 'all 0.15s ease',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="radio"
                              name="priority"
                              value={p.id}
                              checked={isSelected}
                              onChange={() => setFormData({ ...formData, priority: p.id })}
                              style={{ display: 'none' }}
                            />
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: p.color,
                                display: 'inline-block',
                              }}
                            />
                            {p.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Assign To (Multi-Select for Assigned Task mode, Locked for Personal Task mode) */}
                  <div className="form-group" style={{ margin: 0, position: 'relative' }} ref={assigneeDropdownRef}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 5 }}>
                      Assign To {modalMode === 'ASSIGNED' && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>

                    {modalMode === 'ASSIGNED' ? (
                      <div>
                        {/* Selected Assignees Chips */}
                        <div
                          style={{
                            minHeight: 38,
                            padding: '4px 8px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            background: '#ffffff',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 5,
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                          onClick={() => setShowAssigneeDropdown((prev) => !prev)}
                        >
                          {formData.assigned_to_ids.filter((id) => id !== 'MYSELF').length === 0 && (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Select eligible team members...</span>
                          )}

                          {formData.assigned_to_ids
                            .filter((id) => id !== 'MYSELF')
                            .map((id) => (
                              <span
                                key={id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  color: '#1e293b',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                <span>{getAssigneeLabel(id)}</span>
                                <button
                                  type="button"
                                  onClick={(e) => removeAssigneeChip(id, e)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}

                          <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
                        </div>

                        {/* Assignee Search & Dropdown List */}
                        {showAssigneeDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: 4,
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                              zIndex: 1100,
                              maxHeight: 220,
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Search input inside dropdown */}
                            <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                              <div style={{ position: 'relative' }}>
                                <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
                                <input
                                  type="text"
                                  placeholder="Search eligible employee..."
                                  value={assigneeSearch}
                                  onChange={(e) => setAssigneeSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '100%',
                                    padding: '5px 8px 5px 26px',
                                    fontSize: 12,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 4,
                                  }}
                                  autoFocus
                                />
                              </div>
                            </div>

                            {/* Dropdown Options */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                              {loadingEmployees ? (
                                <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                  Loading eligible employees...
                                </div>
                              ) : employees.length === 0 ? (
                                <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                                  No employees available for task assignment.
                                </div>
                              ) : filteredEmployees.length === 0 ? (
                                <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                  No matching employees found
                                </div>
                              ) : (
                                filteredEmployees.map((emp) => {
                                  const isChecked = formData.assigned_to_ids.includes(emp.id);
                                  return (
                                    <div
                                      key={emp.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '7px 12px',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        background: isChecked ? '#f0f9ff' : 'transparent',
                                      }}
                                      onClick={() => toggleAssignee(emp.id)}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        readOnly
                                        style={{ cursor: 'pointer' }}
                                      />
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: isChecked ? 700 : 500, color: '#0f172a' }}>
                                          {emp.name} <span style={{ fontWeight: 700, color: '#0284c7' }}>({emp.level || emp.role || 'L1'})</span>
                                        </span>
                                        <span style={{ fontSize: 10, color: '#64748b' }}>
                                          {emp.email} {emp.department_name ? `• ${emp.department_name}` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Personal Task Mode: Locked to Myself */
                      <div
                        style={{
                          height: 38,
                          padding: '6px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          color: '#475569',
                        }}
                      >
                        <span
                          style={{
                            padding: '2px 8px',
                            background: '#e6f0f8',
                            border: '1px solid #0b3b60',
                            color: '#0b3b60',
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          Myself
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>(Personal task for your own task list)</span>
                      </div>
                    )}
                  </div>

                  {/* Reminder / Notification Date & Time */}
                  <div>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Bell size={13} color="#0284c7" />
                      <span>Reminder Date & Time (Optional)</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.reminder_date}
                        onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                        style={{ fontSize: 13, height: 38 }}
                      />
                      <input
                        type="time"
                        className="form-control"
                        value={formData.reminder_time}
                        onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                        style={{ fontSize: 13, height: 38 }}
                      />
                    </div>
                  </div>

                  {/* Category / Tag */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Category / Tag (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AMC, Follow-up, Client Report"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{ fontSize: 13, height: 38 }}
                    />
                  </div>
                </div>
              </div>

              {/* FULL WIDTH: Description & Attachments Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: 0 }}>
                    Description
                  </label>

                  {/* Attach File Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0b3b60',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Paperclip size={13} />
                    <span>{uploadingAttachment ? 'Uploading...' : 'Attach File'}</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    style={{ display: 'none' }}
                  />
                </div>

                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Add detailed task instructions, customer contact info, ticket numbers or notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ fontSize: 13, resize: 'vertical', lineHeight: 1.5 }}
                />

                {/* Attachment Error */}
                {attachmentError && (
                  <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={13} />
                    <span>{attachmentError}</span>
                  </div>
                )}

                {/* Selected Attachments List (Preview Chips) */}
                {formData.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {formData.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#1e293b',
                        }}
                      >
                        <Paperclip size={13} color="#0284c7" />
                        <span style={{ fontWeight: 500 }}>{att.fileName}</span>
                        {att.fileSize && <span style={{ color: '#64748b', fontSize: 11 }}>({formatFileSize(att.fileSize)})</span>}
                        <button
                          type="button"
                          onClick={() => removeAttachmentChip(idx)}
                          title="Remove attachment"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: 4,
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 10,
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  style={{ fontSize: 13, padding: '7px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || uploadingAttachment}
                  style={{
                    fontSize: 13,
                    padding: '7px 24px',
                    background: '#0b3b60',
                    borderColor: '#0b3b60',
                    fontWeight: 600,
                  }}
                >
                  {saving ? 'Saving...' : editingTask ? 'Save Changes' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TASK DETAIL MODAL                                         */}
      {/* ========================================================= */}
      {viewingTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 20,
          }}
          onClick={() => setViewingTask(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 540, padding: 0, background: '#ffffff', borderRadius: 8, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={18} color="#0b3b60" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Task Details</h3>
              </div>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b' }}
                onClick={() => setViewingTask(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: priorityColorMap[viewingTask.priority]?.bg || '#f1f5f9',
                    color: priorityColorMap[viewingTask.priority]?.color || '#475569',
                  }}
                >
                  {viewingTask.priority} PRIORITY
                </span>

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: viewingTask.status === 'COMPLETED' ? '#dcfce7' : '#e0f2fe',
                    color: viewingTask.status === 'COMPLETED' ? '#15803d' : '#0369a1',
                  }}
                >
                  {viewingTask.status}
                </span>
              </div>

              <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {viewingTask.title}
              </h4>

              {viewingTask.description && (
                <div style={{ fontSize: 13, color: '#334155', background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 14, lineHeight: 1.5 }}>
                  {viewingTask.description}
                </div>
              )}

              {/* Attachments in Detail Modal */}
              {viewingTask.attachments && viewingTask.attachments.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Attachments ({viewingTask.attachments.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {viewingTask.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          padding: '4px 10px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          color: '#0b3b60',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        <Download size={12} />
                        <span>{att.fileName}</span>
                        {att.fileSize && <span style={{ color: '#94a3b8' }}>({formatFileSize(att.fileSize)})</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: '#475569', marginBottom: 16 }}>
                <div>
                  <strong>Type:</strong>{' '}
                  {viewingTask.assigned_to === viewingTask.created_by || viewingTask.task_type === 'Personal' || viewingTask.task_type === 'SELF TASK'
                    ? 'Personal'
                    : 'Assigned Task'}
                </div>
                <div>
                  <strong>Assigned To:</strong>{' '}
                  {viewingTask.assignee_name || (viewingTask.assigned_to === viewingTask.created_by ? 'Myself' : viewingTask.assigned_to)}
                </div>
                <div>
                  <strong>Assigned By:</strong> {viewingTask.creator_name || viewingTask.created_by}
                </div>
                <div>
                  <strong>Category:</strong> {viewingTask.category || 'General'}
                </div>
                <div>
                  <strong>Due Date:</strong> {viewingTask.due_date ? formatDate(viewingTask.due_date) : 'None'}
                </div>
                <div>
                  <strong>Due Time:</strong> {viewingTask.due_time || 'None'}
                </div>
                <div>
                  <strong>Reminder:</strong> {viewingTask.reminder_time ? new Date(viewingTask.reminder_time).toLocaleString() : 'None'}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDelete(viewingTask)}
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={13} /> Delete
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEditModal(viewingTask)}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  {viewingTask.status === 'PENDING' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleComplete(viewingTask)}
                      style={{ background: '#16a34a', borderColor: '#16a34a' }}
                    >
                      <CheckCircle2 size={13} /> Mark Complete
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleReopen(viewingTask)}
                    >
                      Reopen Task
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
