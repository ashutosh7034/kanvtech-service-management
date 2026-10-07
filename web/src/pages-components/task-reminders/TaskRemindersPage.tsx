'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
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
  AlertTriangle,
} from 'lucide-react';
import { formatDate } from '../../utils/date';

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
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

interface Props {
  initialTaskId?: string | null;
}

const PRIORITIES = [
  { id: 'LOW', label: 'Low', color: '#64748b', bg: '#f1f5f9' },
  { id: 'MEDIUM', label: 'Medium', color: '#2563eb', bg: '#eff6ff' },
  { id: 'HIGH', label: 'High', color: '#d97706', bg: '#fffbeb' },
  { id: 'URGENT', label: 'Urgent', color: '#dc2626', bg: '#fef2f2' },
];

const priorityColorMap: Record<string, { color: string; bg: string }> = {
  LOW: { color: '#64748b', bg: '#f1f5f9' },
  MEDIUM: { color: '#0284c7', bg: '#e0f2fe' },
  HIGH: { color: '#d97706', bg: '#fef3c7' },
  URGENT: { color: '#dc2626', bg: '#fee2e2' },
  CRITICAL: { color: '#dc2626', bg: '#fee2e2' },
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
};

export const TaskRemindersPage: React.FC<Props> = ({ initialTaskId }) => {
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Detail Modal
  const [viewingTask, setViewingTask] = useState<EmployeeTask | null>(null);

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

  // Handle initial task from URL / notification click
  useEffect(() => {
    if (initialTaskId) {
      api.getTaskById(initialTaskId)
        .then((res) => {
          if (res.task) {
            setViewingTask(res.task);
          }
        })
        .catch(() => {
          // Ignore if task not accessible
        });
    }
  }, [initialTaskId]);

  const openCreateModal = () => {
    const now = new Date();
    const futureReminder = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour in future
    const todayStr = now.toISOString().split('T')[0];
    const futureTimeStr = futureReminder.toTimeString().substring(0, 5);

    setEditingTask(null);
    setFormData({
      ...emptyForm,
      due_date: todayStr,
      due_time: '23:59',
      reminder_date: todayStr,
      reminder_time: futureTimeStr,
    });
    setFormError(null);
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

    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      category: task.category || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      due_time: task.due_time || '',
      task_type: task.task_type || 'SELF TASK',
      priority: task.priority || 'MEDIUM',
      reminder_date: reminderD,
      reminder_time: reminderT,
    });
    setFormError(null);
    setShowModal(true);
    setViewingTask(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Please enter a task title.');
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
        task_type: formData.task_type,
      };

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
    if (!window.confirm(`Delete personal task "${task.title}"?`)) return;
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

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            My Tasks & Reminders
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Self-created personal tasks and internal in-app reminders
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadTasks}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add Task
          </button>
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
                borderColor: activeTab === tab.id ? '#0284c7' : '#e2e8f0',
                background: activeTab === tab.id ? '#e0f2fe' : '#ffffff',
                color: activeTab === tab.id ? '#0369a1' : '#475569',
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
          <AlertCircle size={14} style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
          Loading personal tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <CheckSquare size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#94a3b8' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>No tasks found</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            {activeTab === 'all'
              ? 'You have not created any personal tasks yet.'
              : `No tasks found in "${activeTab}" filter.`}
          </div>
          <button className="btn btn-primary" onClick={openCreateModal} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => {
            const isOverdue =
              task.status === 'PENDING' &&
              task.due_date &&
              new Date(task.due_date) < startOfToday;
            const pStyle = priorityColorMap[task.priority] || priorityColorMap.MEDIUM;

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
                      </div>

                      {task.description && (
                        <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                          {task.description}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                        {task.due_date && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isOverdue ? '#b91c1c' : '#475569', fontWeight: isOverdue ? 700 : 500 }}>
                            <Calendar size={13} /> Due: {formatDate(task.due_date)}{task.due_time ? ` at ${task.due_time}` : ''}
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
      {/* ADD / EDIT TASK MODAL                                     */}
      {/* ========================================================= */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: 20,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 540, padding: 0, background: '#ffffff', borderRadius: 8, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {editingTask ? 'Edit Personal Task' : 'New Personal Task & Reminder'}
              </h3>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748b' }}
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} style={{ padding: 20 }}>
              {formError && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                  {formError}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>Task Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Call ABC customer regarding AMC agreement"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Description (Optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Add specific notes, ticket numbers, or context..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Priority</label>
                  <select
                    className="form-control"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Category (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. AMC, Follow-up, Report"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
              </div>

              {/* Due Date & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Due Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formData.due_time}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Reminder Date & Time */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#0284c7', marginBottom: 8 }}>
                  <Bell size={14} /> In-App Reminder
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Reminder Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.reminder_date}
                      onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Reminder Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.reminder_time}
                      onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  ℹ️ When the reminder time arrives, an in-app notification badge will alert you.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
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
            background: 'rgba(15, 23, 42, 0.6)',
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
            style={{ width: '100%', maxWidth: 500, padding: 0, background: '#ffffff', borderRadius: 8, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Personal Task Details</h3>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: '#475569', marginBottom: 16 }}>
                <div>
                  <strong>Due Date:</strong> {viewingTask.due_date ? formatDate(viewingTask.due_date) : 'None'}
                </div>
                <div>
                  <strong>Due Time:</strong> {viewingTask.due_time || 'None'}
                </div>
                <div>
                  <strong>Reminder:</strong> {viewingTask.reminder_time ? new Date(viewingTask.reminder_time).toLocaleString() : 'None'}
                </div>
                <div>
                  <strong>Category:</strong> {viewingTask.category || 'General'}
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
