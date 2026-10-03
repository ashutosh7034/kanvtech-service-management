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
} from 'lucide-react';
import { formatDate } from '../../utils/date';

interface EmployeeTask {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  priority: string;
  reminder_time?: string | null;
  status: 'PENDING' | 'COMPLETED';
  created_by: string;
  assigned_to: string;
  creator_name?: string;
  assignee_name?: string;
  created_at: string;
  completed_at?: string | null;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const priorityColor: Record<string, string> = {
  CRITICAL: '#b91c1c',
  HIGH: '#d97706',
  MEDIUM: '#2563eb',
  LOW: '#64748b',
};

const emptyForm = {
  title: '',
  description: '',
  due_date: '',
  due_time: '',
  priority: 'MEDIUM',
  reminder_time: '',
};

export const TaskRemindersPage: React.FC = () => {
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.getMyTasks(params);
      setTasks(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (task: EmployeeTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      due_time: task.due_time || '',
      priority: task.priority,
      reminder_time: task.reminder_time ? task.reminder_time.replace('Z', '').replace('T', 'T').substring(0, 16) : '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Task title is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingTask) {
        await api.updateTask(editingTask.id, formData);
      } else {
        await api.createTask(formData);
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
    } catch (err: any) {
      setError(err.message || 'Failed to complete task.');
    }
  };

  const handleReopen = async (task: EmployeeTask) => {
    try {
      await api.updateTask(task.id, { status: 'PENDING' });
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to reopen task.');
    }
  };

  const handleDelete = async (task: EmployeeTask) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await api.deleteTask(task.id);
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task.');
    }
  };

  const pending = tasks.filter(t => t.status === 'PENDING');
  const completed = tasks.filter(t => t.status === 'COMPLETED');
  const overdue = pending.filter(t => t.due_date && new Date(t.due_date) < new Date());

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            Task Reminders
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Personal task reminders and scheduled work items
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadTasks}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>Pending</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{pending.length}</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>Overdue</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{overdue.length}</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{completed.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['ALL', 'PENDING', 'COMPLETED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 14px',
              borderRadius: 4,
              border: '1px solid',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              borderColor: statusFilter === s ? '#2563eb' : '#e2e8f0',
              background: statusFilter === s ? '#eff6ff' : '#fff',
              color: statusFilter === s ? '#1d4ed8' : '#475569',
            }}
          >
            {s === 'ALL' ? 'All Tasks' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
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
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <CheckSquare size={36} style={{ margin: '0 auto 12px', display: 'block', color: '#94a3b8' }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>No task reminders</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            Create your first task reminder to stay organized.
          </div>
          <button className="btn btn-primary" onClick={openCreateModal} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Create Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(task => {
            const isOverdue = task.status === 'PENDING' && task.due_date && new Date(task.due_date) < new Date();
            return (
              <div
                key={task.id}
                className="card"
                style={{
                  padding: '12px 16px',
                  borderLeft: `4px solid ${task.status === 'COMPLETED' ? '#16a34a' : isOverdue ? '#ef4444' : priorityColor[task.priority] || '#e2e8f0'}`,
                  opacity: task.status === 'COMPLETED' ? 0.75 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                    <button
                      onClick={() => task.status === 'PENDING' ? handleComplete(task) : handleReopen(task)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
                    >
                      {task.status === 'COMPLETED'
                        ? <CheckCircle2 size={18} color="#16a34a" />
                        : <Circle size={18} color="#94a3b8" />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{task.description}</div>
                      )}
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: priorityColor[task.priority] || '#64748b', fontWeight: 600 }}>
                          <Flag size={11} /> {task.priority}
                        </span>
                        {task.due_date && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: isOverdue ? '#b91c1c' : '#64748b', fontWeight: isOverdue ? 600 : 400 }}>
                            <Calendar size={11} /> {formatDate(task.due_date)}{task.due_time ? ` at ${task.due_time}` : ''}
                            {isOverdue && <span style={{ color: '#b91c1c', fontWeight: 700 }}> — OVERDUE</span>}
                          </span>
                        )}
                        {task.reminder_time && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                            <Bell size={11} /> Reminder: {new Date(task.reminder_time).toLocaleString()}
                          </span>
                        )}
                        {task.completed_at && (
                          <span style={{ fontSize: 11, color: '#16a34a' }}>
                            ✓ Completed: {formatDate(task.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {task.status === 'PENDING' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(task)}
                        style={{ padding: '4px 8px' }}
                      >
                        <Edit3 size={12} />
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(task)}
                      style={{ padding: '4px 8px' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, background: 'white', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                {editingTask ? 'Edit Task Reminder' : 'New Task Reminder'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#64748b" />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Follow up with Rajesh on Tally implementation"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Optional task details..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formData.due_time}
                    onChange={e => setFormData({ ...formData, due_time: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-control"
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reminder At</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formData.reminder_time}
                    onChange={e => setFormData({ ...formData, reminder_time: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
