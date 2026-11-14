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
  RefreshCw,
  Search,
  Tag,
  Paperclip,
  User,
  Users,
  Check,
  FileText,
  AlertTriangle,
  ChevronDown,
  Send,
  RotateCcw,
  MessageSquare,
  Sliders,
  ArrowRight,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

export interface TaskAttachment {
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorEmployeeId?: string;
  actorUserId?: number;
  actorName?: string;
  activityType: string;
  comment?: string;
  oldProgress?: number;
  newProgress?: number;
  oldStatus?: string;
  newStatus?: string;
  metadata?: any;
  createdAt: string;
}

export interface EmployeeTask {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  due_time?: string | null;
  dueTime?: string | null;
  task_type?: string;
  taskType?: string;
  priority: string;
  reminder_time?: string | null;
  reminderTime?: string | null;
  reminder_offset_minutes?: number;
  reminderOffsetMinutes?: number;
  reminder_status?: string;
  reminderStatus?: string;
  reminder_delivery_timestamp?: string | null;
  reminderDeliveryTimestamp?: string | null;
  reminder_triggered_at?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  progress: number;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  last_reminder_sent_at?: string | null;
  reminder_count?: number;
  extension_requested_at?: string | null;
  extension_requested_date?: string | null;
  extension_reason?: string | null;
  created_by: string;
  createdBy?: string;
  assigned_to: string;
  assignedTo?: string;
  creator_name?: string;
  creatorName?: string;
  creator_email?: string;
  creator_designation?: string;
  creator_level?: string;
  assignee_name?: string;
  assigneeName?: string;
  assignee_email?: string;
  assignee_designation?: string;
  assignee_level?: string;
  attachments?: TaskAttachment[];
  activities?: TaskActivity[];
  created_at: string;
  createdAt?: string;
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
};

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Helper: compute reminder time string for UI with dynamic offset and cross-date support
const computeReminderDisplay = (
  dueDateStr: string,
  dueTimeStr: string,
  offsetMinutes: number = 20,
): { text: string; isDifferentDate: boolean } => {
  if (!dueDateStr) return { text: '', isDifferentDate: false };
  const timePart = dueTimeStr ? dueTimeStr.trim() : '06:00 PM';
  let hours = 18;
  let minutes = 0;

  const ampmMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = parseInt(ampmMatch[2], 10);
    const ampm = (ampmMatch[3] || '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  let year: number;
  let month: number;
  let day: number;
  const ymdMatch = dueDateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmyMatch = dueDateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);

  if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10) - 1;
    day = parseInt(ymdMatch[3], 10);
  } else if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10) - 1;
    year = parseInt(dmyMatch[3], 10);
  } else {
    const parsed = new Date(dueDateStr);
    if (isNaN(parsed.getTime())) return { text: '', isDifferentDate: false };
    year = parsed.getFullYear();
    month = parsed.getMonth();
    day = parsed.getDate();
  }

  const dueD = new Date(year, month, day, hours, minutes, 0, 0);
  if (isNaN(dueD.getTime())) return { text: '', isDifferentDate: false };

  const reminderD = new Date(dueD.getTime() - offsetMinutes * 60 * 1000);
  const isDifferentDate =
    reminderD.getFullYear() !== dueD.getFullYear() ||
    reminderD.getMonth() !== dueD.getMonth() ||
    reminderD.getDate() !== dueD.getDate();

  const timeFormatted = reminderD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isDifferentDate) {
    const dateFormatted = reminderD.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return { text: `${dateFormatted}, ${timeFormatted}`, isDifferentDate: true };
  }
  return { text: timeFormatted, isDifferentDate: false };
};

export const TaskRemindersPage: React.FC<Props> = ({ initialTaskId }) => {
  const { user, hasPermission } = useAuth();

  const isManagerOrAdmin =
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'MANAGER' ||
    hasPermission('task.view_team');

  // Top-Level View: 'my_tasks' | 'sent_tasks' | 'team_tasks'
  const [activeView, setActiveView] = useState<'my_tasks' | 'sent_tasks' | 'team_tasks'>('my_tasks');
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Eligible employees list for assignment (filtered to tenant)
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Modal State & Mode ('PERSONAL' | 'ASSIGNED')
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'PERSONAL' | 'ASSIGNED'>('ASSIGNED');
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDueTime, setFormDueTime] = useState('06:00 PM'); // Default EOD 6:00 PM
  const [formReminderOffset, setFormReminderOffset] = useState<number>(20); // Default 20 mins before
  const [formPriority, setFormPriority] = useState('MEDIUM');
  const [formAssignedToIds, setFormAssignedToIds] = useState<string[]>([]);
  const [formAttachments, setFormAttachments] = useState<TaskAttachment[]>([]);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Detail Modal / Drawer
  const [viewingTask, setViewingTask] = useState<EmployeeTask | null>(null);
  const [viewingActivities, setViewingActivities] = useState<TaskActivity[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Progress Update Widget inside Detail Modal
  const [progressVal, setProgressVal] = useState<number>(0);
  const [progressComment, setProgressComment] = useState('');
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // New Comment box
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Manual Reminder modal
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  // Extension Request modal
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [proposedExtensionDate, setProposedExtensionDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [submittingExtension, setSubmittingExtension] = useState(false);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Load Tasks based on active view and filters
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { view: activeView };
      if (activeTab !== 'all') {
        params.filter = activeTab;
      }
      if (priorityFilter !== 'ALL') {
        params.priority = priorityFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const [res, sumRes] = await Promise.all([
        api.getTasks(params),
        api.getMyTaskSummary().catch(() => null),
      ]);

      setTasks(res.data || []);
      if (sumRes) {
        setSummary(sumRes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load task records');
    } finally {
      setLoading(false);
    }
  }, [activeView, activeTab, priorityFilter, searchQuery]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load eligible employees in tenant
  const loadEligibleEmployees = useCallback(() => {
    setLoadingEmployees(true);
    api
      .getEligibleTaskAssignees()
      .then((res) => {
        const list = res.employees || res.data || [];
        setEmployees(list.filter((e: any) => e.status === 'ACTIVE'));
      })
      .catch(() => {
        setEmployees([]);
      })
      .finally(() => setLoadingEmployees(false));
  }, []);

  useEffect(() => {
    loadEligibleEmployees();
  }, [loadEligibleEmployees]);

  // Open Task Details Modal and load activities
  const handleOpenTaskDetail = async (taskId: string) => {
    setDetailLoading(true);
    setShowReminderPrompt(false);
    setShowExtensionModal(false);
    setShowCancelModal(false);
    setCommentText('');
    setProgressComment('');
    try {
      const res = await api.getTaskById(taskId);
      if (res.task) {
        setViewingTask(res.task);
        setProgressVal(res.task.progress || 0);
        setViewingActivities(res.task.activities || []);
      }
    } catch (err: any) {
      alert(`Could not load task details: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (initialTaskId) {
      handleOpenTaskDetail(initialTaskId);
    }
  }, [initialTaskId]);

  // Close assignee dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open Create Task Modal
  const openCreateModal = (mode: 'PERSONAL' | 'ASSIGNED') => {
    const todayStr = new Date().toISOString().split('T')[0];
    setEditingTask(null);
    setModalMode(mode);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('');
    setFormDueDate(todayStr);
    setFormDueTime('06:00 PM'); // Default EOD
    setFormReminderOffset(20); // Default 20 mins before
    setFormPriority('MEDIUM');
    setFormAssignedToIds(mode === 'PERSONAL' ? ['MYSELF'] : []);
    setFormAttachments([]);
    setFormError(null);
    setAssigneeSearch('');
    loadEligibleEmployees();
    setShowModal(true);
  };

  const openEditModal = (task: EmployeeTask) => {
    const isSelf = task.assigned_to === task.created_by;
    setEditingTask(task);
    setModalMode(isSelf ? 'PERSONAL' : 'ASSIGNED');
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormCategory(task.category || '');
    setFormDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    setFormDueTime(task.due_time || '06:00 PM');
    setFormReminderOffset(task.reminder_offset_minutes ?? (task as any).reminderOffsetMinutes ?? 20);
    setFormPriority(task.priority || 'MEDIUM');
    setFormAssignedToIds([task.assigned_to]);
    setFormAttachments(task.attachments || []);
    setFormError(null);
    setShowModal(true);
  };

  const toggleAssignee = (id: string) => {
    if (formAssignedToIds.includes(id)) {
      setFormAssignedToIds(formAssignedToIds.filter((item) => item !== id));
    } else {
      setFormAssignedToIds([...formAssignedToIds, id]);
    }
  };

  const removeAssigneeChip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormAssignedToIds(formAssignedToIds.filter((item) => item !== id));
  };

  // Handle Save / Submit Task
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!formDueDate) {
      setFormError('Due date is required.');
      return;
    }
    if (modalMode === 'ASSIGNED' && formAssignedToIds.length === 0) {
      setFormError('Please select at least one team member to assign the task to.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingTask) {
        await api.updateTask(editingTask.id, {
          title: formTitle,
          description: formDescription,
          category: formCategory,
          dueDate: formDueDate,
          dueTime: formDueTime,
          reminder_offset_minutes: formReminderOffset,
          reminderOffsetMinutes: formReminderOffset,
          priority: formPriority,
        });
      } else {
        await api.createTask({
          title: formTitle,
          description: formDescription,
          category: formCategory,
          dueDate: formDueDate,
          dueTime: formDueTime,
          reminder_offset_minutes: formReminderOffset,
          reminderOffsetMinutes: formReminderOffset,
          priority: formPriority,
          taskType: modalMode === 'PERSONAL' ? 'Personal' : 'Assigned Task',
          assignedToIds: modalMode === 'PERSONAL' ? ['MYSELF'] : formAssignedToIds,
          attachments: formAttachments,
        });
      }

      setShowModal(false);
      await loadTasks();
      if (viewingTask && editingTask && viewingTask.id === editingTask.id) {
        handleOpenTaskDetail(editingTask.id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  // Upload attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingAttachment(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const res = await api.uploadTaskAttachment(formDataUpload);
        if (res.file) {
          setFormAttachments((prev) => [
            ...prev,
            {
              fileName: res.file.fileName || file.name,
              filePath: res.file.filePath || res.file.url,
              fileSize: res.file.fileSize || file.size,
              mimeType: res.file.mimeType || file.type,
            },
          ]);
        }
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Progress submission (Assignee action)
  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTask) return;
    setSubmittingProgress(true);
    try {
      const res = await api.updateTaskProgress(viewingTask.id, {
        progress: Number(progressVal),
        comment: progressComment.trim() || undefined,
      });
      if (res.task) {
        setViewingTask(res.task);
        setViewingActivities(res.task.activities || []);
        setProgressComment('');
        loadTasks();
      }
    } catch (err: any) {
      alert(`Failed to update progress: ${err.message}`);
    } finally {
      setSubmittingProgress(false);
    }
  };

  // Mark Completed
  const handleMarkCompleted = async (task: EmployeeTask) => {
    if (!confirm(`Are you sure you want to mark task "${task.title}" as Completed?`)) return;
    try {
      const res = await api.completeTask(task.id);
      if (res.task) {
        if (viewingTask?.id === task.id) {
          setViewingTask(res.task);
          setViewingActivities(res.task.activities || []);
        }
        loadTasks();
      }
    } catch (err: any) {
      alert(`Error completing task: ${err.message}`);
    }
  };

  // Accept Task
  const handleAcceptTask = async (task: EmployeeTask) => {
    try {
      const res = await api.acceptTask(task.id);
      if (res.task) {
        if (viewingTask?.id === task.id) {
          setViewingTask(res.task);
          setViewingActivities(res.task.activities || []);
        }
        loadTasks();
      }
    } catch (err: any) {
      alert(`Error accepting task: ${err.message}`);
    }
  };

  // Reopen Task
  const handleReopenTask = async (task: EmployeeTask) => {
    const reason = prompt('Please enter reason for reopening task:', 'Needs further revision');
    if (!reason) return;
    try {
      const res = await api.reopenTask(task.id, reason);
      if (res.task) {
        if (viewingTask?.id === task.id) {
          setViewingTask(res.task);
          setViewingActivities(res.task.activities || []);
        }
        loadTasks();
      }
    } catch (err: any) {
      alert(`Error reopening task: ${err.message}`);
    }
  };

  // Send Manual Reminder
  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTask) return;
    setSendingReminder(true);
    try {
      const res = await api.sendTaskReminder(viewingTask.id, reminderMessage.trim() || undefined);
      if (res.success) {
        setShowReminderPrompt(false);
        setReminderMessage('');
        handleOpenTaskDetail(viewingTask.id);
        alert(res.message || 'Reminder sent successfully!');
      }
    } catch (err: any) {
      alert(`Reminder failed: ${err.message}`);
    } finally {
      setSendingReminder(false);
    }
  };

  // Request Extension
  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTask) return;
    if (!proposedExtensionDate || !extensionReason.trim()) {
      alert('Proposed date and reason are required.');
      return;
    }
    setSubmittingExtension(true);
    try {
      const res = await api.requestTaskExtension(viewingTask.id, {
        proposedDate: proposedExtensionDate,
        reason: extensionReason.trim(),
      });
      if (res.task) {
        setViewingTask(res.task);
        setViewingActivities(res.task.activities || []);
        setShowExtensionModal(false);
        setExtensionReason('');
        loadTasks();
      }
    } catch (err: any) {
      alert(`Extension request failed: ${err.message}`);
    } finally {
      setSubmittingExtension(false);
    }
  };

  // Cancel Task
  const handleCancelTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTask) return;
    setSubmittingCancel(true);
    try {
      const res = await api.cancelTask(viewingTask.id, cancelReason.trim());
      if (res.task) {
        setViewingTask(res.task);
        setViewingActivities(res.task.activities || []);
        setShowCancelModal(false);
        setCancelReason('');
        loadTasks();
      }
    } catch (err: any) {
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTask || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.addTaskComment(viewingTask.id, commentText.trim());
      if (res.activities) {
        setViewingActivities(res.activities);
        setCommentText('');
      }
    } catch (err: any) {
      alert(`Failed to add comment: ${err.message}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Filtered employees for dropdown
  const filteredEmployees = employees.filter((e) => {
    if (!assigneeSearch.trim()) return true;
    const q = assigneeSearch.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.department_name && e.department_name.toLowerCase().includes(q))
    );
  });

  const getAssigneeLabel = (id: string) => {
    if (id === 'MYSELF') return 'Myself (Personal)';
    const found = employees.find((e) => e.id === id);
    return found ? `${found.name} (${found.level || found.role || 'L1'})` : id;
  };

  // Status Badge
  const getStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'PENDING':
        return <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>PENDING</span>;
      case 'ACCEPTED':
        return <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>ACCEPTED</span>;
      case 'IN_PROGRESS':
        return <span className="badge" style={{ background: '#f0f9ff', color: '#0284c7', fontWeight: 600 }}>IN PROGRESS</span>;
      case 'ON_HOLD':
        return <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>ON HOLD</span>;
      case 'COMPLETED':
        return <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>COMPLETED</span>;
      case 'CANCELLED':
        return <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>CANCELLED</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
      {/* ========================================================= */}
      {/* HEADER SECTION                                            */}
      {/* ========================================================= */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckSquare color="#0284c7" size={24} />
            Two-Way Task Assignment & Reminders
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Collaborative task assignment between team members, automated EOD deadlines & 20-minute reminders
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadTasks} title="Refresh Tasks">
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => openCreateModal('PERSONAL')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <User size={15} /> + Personal Task
          </button>

          <button
            className="btn btn-primary"
            onClick={() => openCreateModal('ASSIGNED')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
            }}
          >
            <Users size={16} /> + Assign Task
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TOP-LEVEL VIEW TABS (MY TASKS, SENT TASKS, TEAM TASKS)   */}
      {/* ========================================================= */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setActiveView('my_tasks')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'my_tasks' ? 700 : 500,
            fontSize: 14,
            color: activeView === 'my_tasks' ? '#0284c7' : '#64748b',
            borderBottom: activeView === 'my_tasks' ? '3px solid #0284c7' : '3px solid transparent',
            marginBottom: -2,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <User size={16} />
          My Tasks
          {summary?.myTasks?.pending > 0 && (
            <span
              style={{
                background: '#0284c7',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {summary.myTasks.pending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveView('sent_tasks')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeView === 'sent_tasks' ? 700 : 500,
            fontSize: 14,
            color: activeView === 'sent_tasks' ? '#0284c7' : '#64748b',
            borderBottom: activeView === 'sent_tasks' ? '3px solid #0284c7' : '3px solid transparent',
            marginBottom: -2,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Send size={15} />
          Sent Tasks
          {summary?.sentTasks?.pending > 0 && (
            <span
              style={{
                background: '#64748b',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {summary.sentTasks.pending}
            </span>
          )}
        </button>

        {isManagerOrAdmin && (
          <button
            onClick={() => setActiveView('team_tasks')}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: activeView === 'team_tasks' ? 700 : 500,
              fontSize: 14,
              color: activeView === 'team_tasks' ? '#0284c7' : '#64748b',
              borderBottom: activeView === 'team_tasks' ? '3px solid #0284c7' : '3px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Users size={16} />
            Team Tasks
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* QUICK METRICS BAR                                         */}
      {/* ========================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div
          className="card"
          style={{
            padding: '14px 18px',
            borderLeft: '4px solid #0284c7',
            cursor: 'pointer',
            background: activeTab === 'all' ? '#f0f9ff' : '#ffffff',
          }}
          onClick={() => setActiveTab('all')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
            {activeView === 'sent_tasks' ? 'Total Sent' : 'Total Tasks'}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{tasks.length}</div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            borderLeft: '4px solid #d97706',
            cursor: 'pointer',
            background: activeTab === 'today' ? '#fffbeb' : '#ffffff',
          }}
          onClick={() => setActiveTab('today')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>Due Today</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            {
              tasks.filter(
                (t) =>
                  t.status !== 'COMPLETED' &&
                  t.status !== 'CANCELLED' &&
                  t.due_date &&
                  new Date(t.due_date).toDateString() === new Date().toDateString()
              ).length
            }
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            borderLeft: '4px solid #ef4444',
            cursor: 'pointer',
            background: activeTab === 'overdue' ? '#fef2f2' : '#ffffff',
          }}
          onClick={() => setActiveTab('overdue')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>Overdue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', marginTop: 2 }}>
            {
              tasks.filter(
                (t) =>
                  t.status !== 'COMPLETED' &&
                  t.status !== 'CANCELLED' &&
                  t.due_date &&
                  new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0))
              ).length
            }
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '14px 18px',
            borderLeft: '4px solid #16a34a',
            cursor: 'pointer',
            background: activeTab === 'completed' ? '#f0fdf4' : '#ffffff',
          }}
          onClick={() => setActiveTab('completed')}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
            {tasks.filter((t) => t.status === 'COMPLETED').length}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTER TABS & SEARCH BAR                                  */}
      {/* ========================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
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
                borderRadius: 20,
                border: '1px solid',
                borderColor: activeTab === tab.id ? '#0284c7' : '#e2e8f0',
                background: activeTab === tab.id ? '#0284c7' : '#ffffff',
                color: activeTab === tab.id ? '#ffffff' : '#64748b',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: 30, fontSize: 12, height: 34 }}
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="form-control"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ width: 130, fontSize: 12, height: 34 }}
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TASK LIST / CARDS                                         */}
      {/* ========================================================= */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ display: 'inline-block', marginBottom: 8 }} />
          <div>Loading tasks...</div>
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
          <AlertCircle size={28} style={{ marginBottom: 8 }} />
          <div>{error}</div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          <CheckSquare size={44} style={{ opacity: 0.4, marginBottom: 12 }} />
          <h4 style={{ margin: 0, fontSize: 16, color: '#475569' }}>
            {activeView === 'sent_tasks' ? 'No Sent Tasks' : 'No Tasks Found'}
          </h4>
          <p style={{ margin: '6px 0 16px', fontSize: 13 }}>
            {activeView === 'sent_tasks'
              ? 'You have not assigned any tasks to other team members yet.'
              : 'You have no assigned tasks matching current filters.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => openCreateModal('ASSIGNED')}>
            <Plus size={14} style={{ marginRight: 4 }} />
            Assign a Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            const isCancelled = task.status === 'CANCELLED';
            const isOverdue =
              !isCompleted &&
              !isCancelled &&
              task.due_date &&
              new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <div
                key={task.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  borderRadius: 8,
                  border: isOverdue ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  borderLeft: `4px solid ${
                    isCompleted
                      ? '#16a34a'
                      : isOverdue
                      ? '#dc2626'
                      : priorityColorMap[task.priority]?.color || '#0284c7'
                  }`,
                  background: isCompleted ? '#fbfdfc' : '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
                onClick={() => handleOpenTaskDetail(task.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  {/* Left Column: Title & Metadata */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{task.id}</span>
                      {getStatusBadge(isOverdue ? 'OVERDUE' : task.status)}
                      <span
                        className="badge"
                        style={{
                          background: priorityColorMap[task.priority]?.bg || '#f1f5f9',
                          color: priorityColorMap[task.priority]?.color || '#475569',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {task.priority}
                      </span>
                      {task.category && (
                        <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: 10 }}>
                          {task.category}
                        </span>
                      )}
                    </div>

                    <h4
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: 15,
                        fontWeight: 700,
                        color: isCompleted ? '#64748b' : '#0f172a',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                      }}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginBottom: 8,
                          maxHeight: 36,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {task.description}
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, maxWidth: 280 }}>
                      <div style={{ flex: 1, background: '#e2e8f0', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${task.progress || 0}%`,
                            background: isCompleted ? '#16a34a' : '#0284c7',
                            height: '100%',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                        {task.progress || 0}%
                      </span>
                    </div>

                    {/* Footer Details: Dates & People */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
                      {activeView === 'sent_tasks' ? (
                        <span>
                          <strong>Assigned to:</strong> {task.assignee_name || task.assigned_to}
                        </span>
                      ) : (
                        <span>
                          <strong>Assigned by:</strong> {task.creator_name || task.created_by}
                        </span>
                      )}

                      {task.due_date && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: isOverdue ? '#dc2626' : '#475569',
                            fontWeight: isOverdue ? 700 : 500,
                          }}
                        >
                          <Calendar size={12} /> Due: {formatDate(task.due_date)} at {task.due_time || '06:00 PM'}
                          {isOverdue && <span style={{ color: '#dc2626', fontWeight: 800 }}>● OVERDUE</span>}
                        </span>
                      )}

                      {task.reminder_time && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#0284c7' }}>
                          <Bell size={12} /> Auto-Reminder:{' '}
                          {new Date(task.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {task.reminder_offset_minutes && task.reminder_offset_minutes !== 20 && (
                            <span style={{ fontSize: 10, background: '#e0f2fe', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                              {task.reminder_offset_minutes}m offset
                            </span>
                          )}
                          {task.reminder_status && task.reminder_status !== 'SCHEDULED' && (
                            <span
                              style={{
                                fontSize: 10,
                                background: task.reminder_status === 'TRIGGERED' ? '#dcfce7' : '#f1f5f9',
                                color: task.reminder_status === 'TRIGGERED' ? '#15803d' : '#64748b',
                                padding: '1px 5px',
                                borderRadius: 3,
                                fontWeight: 700,
                              }}
                            >
                              {task.reminder_status}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* For Assignee */}
                      {activeView === 'my_tasks' && task.status === 'PENDING' && (
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => handleAcceptTask(task)}
                          title="Accept Task"
                          style={{ background: '#0284c7', borderColor: '#0284c7' }}
                        >
                          Accept
                        </button>
                      )}

                      {activeView === 'my_tasks' && !isCompleted && !isCancelled && (
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleMarkCompleted(task)}
                          title="Mark Completed"
                          style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
                        >
                          <Check size={12} style={{ marginRight: 2 }} /> Complete
                        </button>
                      )}

                      {/* For Assignor in Sent Tasks */}
                      {activeView === 'sent_tasks' && !isCompleted && !isCancelled && (
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => {
                            setViewingTask(task);
                            setShowReminderPrompt(true);
                          }}
                          title="Send Follow-up Reminder"
                          style={{ color: '#d97706', borderColor: '#fde68a' }}
                        >
                          <Bell size={12} style={{ marginRight: 2 }} /> Remind
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => handleReopenTask(task)}
                          title="Reopen Task"
                        >
                          <RotateCcw size={12} /> Reopen
                        </button>
                      )}

                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => handleOpenTaskDetail(task.id)}
                        title="View Full Task Details & Timeline"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ASSIGN TASK MODAL                                */}
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
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent Line */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #0b3b60 0%, #0284c7 50%, #38bdf8 100%)' }} />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#ffffff',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0b3b60', textTransform: 'uppercase' }}>
                {editingTask ? 'Edit Task' : modalMode === 'ASSIGNED' ? 'Assign Task to Team Member' : 'Add Personal Task'}
              </span>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Two Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px 24px' }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 5 }}>
                      Task Title <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Call ABC customer regarding AMC agreement"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
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
                      <input
                        type="date"
                        className="form-control"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        required
                        style={{ fontSize: 13, height: 38 }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Due Time (Default EOD)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="06:00 PM"
                        value={formDueTime}
                        onChange={(e) => setFormDueTime(e.target.value)}
                        style={{ fontSize: 13, height: 38 }}
                      />
                    </div>
                  </div>

                  {/* Automatic Reminder Display Banner */}
                  {(() => {
                    const reminderInfo = computeReminderDisplay(formDueDate, formDueTime, formReminderOffset);
                    return (
                      <div
                        style={{
                          padding: '8px 12px',
                          background: '#f0f9ff',
                          borderRadius: 6,
                          border: '1px solid #bae6fd',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: 12,
                          color: '#0369a1',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                          <Bell size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>Auto-Reminder: </strong>
                            {reminderInfo.text ? (
                              <span>
                                {reminderInfo.text} ({formReminderOffset} minutes before deadline)
                              </span>
                            ) : (
                              <span>Calculated automatically {formReminderOffset} mins before deadline</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <label
                            htmlFor="reminder-offset-select"
                            style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, margin: 0 }}
                          >
                            Offset:
                          </label>
                          <select
                            id="reminder-offset-select"
                            value={formReminderOffset}
                            onChange={(e) => setFormReminderOffset(Number(e.target.value))}
                            style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid #7dd3fc',
                              background: '#ffffff',
                              color: '#0369a1',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <option value={10}>10m</option>
                            <option value={15}>15m</option>
                            <option value={20}>20m (Default)</option>
                            <option value={30}>30m</option>
                            <option value={45}>45m</option>
                            <option value={60}>60m</option>
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Priority Selector */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      Priority
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {PRIORITIES.map((p) => {
                        const isSelected = formPriority === p.id;
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
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="radio"
                              name="priority"
                              value={p.id}
                              checked={isSelected}
                              onChange={() => setFormPriority(p.id)}
                              style={{ display: 'none' }}
                            />
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                            {p.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Assign To Dropdown (Multi-select) */}
                  <div className="form-group" style={{ margin: 0, position: 'relative' }} ref={assigneeDropdownRef}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 5 }}>
                      Assign To {modalMode === 'ASSIGNED' && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>

                    {modalMode === 'ASSIGNED' ? (
                      <div>
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
                          {formAssignedToIds.filter((id) => id !== 'MYSELF').length === 0 && (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Select eligible team members...</span>
                          )}

                          {formAssignedToIds
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
                                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}

                          <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
                        </div>

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
                            <div style={{ padding: 8, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                              <input
                                type="text"
                                placeholder="Search eligible employee..."
                                value={assigneeSearch}
                                onChange={(e) => setAssigneeSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }}
                                autoFocus
                              />
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                              {loadingEmployees ? (
                                <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                  Loading eligible employees...
                                </div>
                              ) : filteredEmployees.length === 0 ? (
                                <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                                  No eligible employees found in tenant
                                </div>
                              ) : (
                                filteredEmployees.map((emp) => {
                                  const isChecked = formAssignedToIds.includes(emp.id);
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
                                      <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: isChecked ? 700 : 500, color: '#0f172a' }}>
                                          {emp.name} <span style={{ fontWeight: 700, color: '#0284c7' }}>({emp.level || 'L1'})</span>
                                        </span>
                                        <span style={{ fontSize: 10, color: '#64748b' }}>
                                          {emp.email} {emp.designation ? `• ${emp.designation}` : ''}
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
                      <div style={{ height: 38, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                        <span style={{ padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: 4, fontWeight: 600 }}>Myself</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>(Personal task for your own list)</span>
                      </div>
                    )}
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
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      style={{ fontSize: 13, height: 38 }}
                    />
                  </div>
                </div>
              </div>

              {/* Description & Attachments */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: 0 }}>
                    Description
                  </label>
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
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple style={{ display: 'none' }} />
                </div>

                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Add detailed task instructions, customer contact info, ticket numbers or notes..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{ fontSize: 13, resize: 'vertical' }}
                />

                {formAttachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {formAttachments.map((att, idx) => (
                      <span
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: 4,
                          fontSize: 11,
                          color: '#0b3b60',
                        }}
                      >
                        <Paperclip size={12} />
                        <span>{att.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setFormAttachments(formAttachments.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ background: '#0b3b60', borderColor: '#0b3b60', minWidth: 90 }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: TASK DETAILS DRAWER / FULL VIEW                  */}
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
            padding: 16,
          }}
          onClick={() => setViewingTask(null)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 820,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>{viewingTask.id}</span>
                  {getStatusBadge(viewingTask.status)}
                  <span
                    className="badge"
                    style={{
                      background: priorityColorMap[viewingTask.priority]?.bg || '#f1f5f9',
                      color: priorityColorMap[viewingTask.priority]?.color || '#475569',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {viewingTask.priority}
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {viewingTask.title}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setViewingTask(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Assignor & Assignee Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Assigned By</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {viewingTask.creator_name || viewingTask.creatorName || viewingTask.created_by}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {viewingTask.creator_designation || viewingTask.creator_level || 'Team Member'}
                  </div>
                </div>

                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Assigned To</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {viewingTask.assignee_name || viewingTask.assigneeName || viewingTask.assigned_to}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {viewingTask.assignee_designation || viewingTask.assignee_level || 'Team Member'}
                  </div>
                </div>
              </div>

              {/* Deadline & Reminder Timestamps */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={13} /> Due Date & Time
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {formatDate(viewingTask.due_date || viewingTask.dueDate)} at {viewingTask.due_time || viewingTask.dueTime || '06:00 PM'}
                  </div>
                </div>

                <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: 11, color: '#0369a1', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bell size={13} color="#0284c7" /> Automatic Reminder ({viewingTask.reminder_offset_minutes || 20}m before)
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0284c7', marginTop: 2 }}>
                    {viewingTask.reminder_time
                      ? `${formatDate(viewingTask.reminder_time)} at ${new Date(viewingTask.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${
                          viewingTask.reminder_status ? ` • ${viewingTask.reminder_status}` : ''
                        }`
                      : 'Scheduled automatically'}
                  </div>
                </div>
              </div>

              {/* Description */}
              {viewingTask.description && (
                <div style={{ padding: 14, background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Task Description</div>
                  <div style={{ fontSize: 13, color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {viewingTask.description}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {viewingTask.attachments && viewingTask.attachments.length > 0 && (
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Attachments</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {viewingTask.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#0284c7',
                          textDecoration: 'none',
                        }}
                      >
                        <Paperclip size={13} />
                        <span>{att.fileName}</span>
                        {att.fileSize && <span style={{ color: '#94a3b8' }}>({formatFileSize(att.fileSize)})</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress Update Widget */}
              {viewingTask.status !== 'COMPLETED' && viewingTask.status !== 'CANCELLED' && (
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrendingUp size={16} color="#0284c7" /> Update Task Progress
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>{progressVal}%</span>
                  </div>

                  <form onSubmit={handleUpdateProgress} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progressVal}
                      onChange={(e) => setProgressVal(Number(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />

                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Progress comment (e.g. Customer contacted. Awaiting confirmation)..."
                        value={progressComment}
                        onChange={(e) => setProgressComment(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={submittingProgress}>
                        {submittingProgress ? 'Updating...' : 'Update Progress'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Activity Timeline & Discussion Comments */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={16} color="#0284c7" /> Activity Timeline & Discussion
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
                  {viewingActivities.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 12 }}>
                      No activity history recorded yet.
                    </div>
                  ) : (
                    viewingActivities.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          padding: '8px 12px',
                          background: act.activityType === 'COMMENT' ? '#ffffff' : '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 11, marginBottom: 2 }}>
                          <strong>{act.actorName || 'System'}</strong>
                          <span>{new Date(act.createdAt).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#1e293b' }}>{act.comment}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Write a comment or reply..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={submittingComment || !commentText.trim()}>
                    {submittingComment ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </div>

            {/* Footer with Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                {viewingTask.status !== 'COMPLETED' && viewingTask.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleMarkCompleted(viewingTask)}
                    style={{ background: '#16a34a', borderColor: '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Check size={14} /> Mark Completed
                  </button>
                )}

                {/* Assignor: Send Follow-up Reminder */}
                {viewingTask.status !== 'COMPLETED' && viewingTask.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowReminderPrompt(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Bell size={14} color="#d97706" /> Send Reminder
                  </button>
                )}

                {/* Assignee: Request Extension */}
                {viewingTask.status !== 'COMPLETED' && viewingTask.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowExtensionModal(true)}
                  >
                    Request Extension
                  </button>
                )}

                {/* Reopen if completed */}
                {viewingTask.status === 'COMPLETED' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleReopenTask(viewingTask)}
                  >
                    <RotateCcw size={14} style={{ marginRight: 4 }} /> Reopen Task
                  </button>
                )}

                {/* Cancel Task */}
                {viewingTask.status !== 'COMPLETED' && viewingTask.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowCancelModal(true)}
                    style={{ color: '#dc2626' }}
                  >
                    Cancel Task
                  </button>
                )}
              </div>

              <button type="button" className="btn btn-secondary" onClick={() => setViewingTask(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-MODAL 1: SEND MANUAL REMINDER PROMPT                  */}
      {/* ========================================================= */}
      {showReminderPrompt && viewingTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, background: '#ffffff', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Send Follow-up Reminder to {viewingTask.assignee_name || viewingTask.assigned_to}
            </h4>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px' }}>
              This will send an instant in-app notification reminder and increment the follow-up count.
            </p>

            <form onSubmit={handleSendReminder}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                  Reminder Message (Optional)
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={`Reminder: Please check progress on "${viewingTask.title}".`}
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReminderPrompt(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={sendingReminder}>
                  {sendingReminder ? 'Sending...' : 'Send Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-MODAL 2: REQUEST DEADLINE EXTENSION                   */}
      {/* ========================================================= */}
      {showExtensionModal && viewingTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, background: '#ffffff', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Request Deadline Extension
            </h4>

            <form onSubmit={handleRequestExtension}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                  Proposed New Deadline *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={proposedExtensionDate}
                  onChange={(e) => setProposedExtensionDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                  Reason for Extension *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Explain why extra time is needed (e.g. Awaiting client confirmation)..."
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowExtensionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submittingExtension}>
                  {submittingExtension ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-MODAL 3: CANCEL TASK MODAL                            */}
      {/* ========================================================= */}
      {showCancelModal && viewingTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, background: '#ffffff', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
              Cancel Task: {viewingTask.title}
            </h4>

            <form onSubmit={handleCancelTask}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>
                  Cancellation Reason
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCancelModal(false)}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#dc2626', borderColor: '#dc2626' }} disabled={submittingCancel}>
                  {submittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
