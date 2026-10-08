import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { SLAConfig } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { Settings, Save, Clock, UserCheck, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const SLASettingsPage: React.FC = () => {
  const { showToast } = useNotifications();
  const [configs, setConfigs] = useState<SLAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPriority, setSavingPriority] = useState<string | null>(null);

  // Automatic Ticket Assignment Level State
  const [autoAssignmentLevel, setAutoAssignmentLevel] = useState<'L1' | 'L2' | 'L3'>('L1');
  const [savedAssignmentLevel, setSavedAssignmentLevel] = useState<'L1' | 'L2' | 'L3'>('L1');
  const [savingLevel, setSavingLevel] = useState(false);
  const [levelSavedSuccess, setLevelSavedSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSLASettings();
    loadAutoAssignmentLevel();
  }, []);

  const loadAutoAssignmentLevel = async () => {
    try {
      const res = await api.getAutoAssignmentLevel();
      if (res.success && res.level) {
        setAutoAssignmentLevel(res.level);
        setSavedAssignmentLevel(res.level);
      }
    } catch (err: any) {
      console.error('Failed to load auto assignment level', err);
    }
  };

  const handleSaveAssignmentLevel = async () => {
    setSavingLevel(true);
    setLevelSavedSuccess(null);
    try {
      const res = await api.updateAutoAssignmentLevel(autoAssignmentLevel);
      setSavedAssignmentLevel(autoAssignmentLevel);
      setLevelSavedSuccess(`Automatic ticket assignment level updated to ${autoAssignmentLevel}.`);
      showToast(`Automatic ticket assignment level successfully set to ${autoAssignmentLevel}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update assignment level', 'danger');
    } finally {
      setSavingLevel(false);
    }
  };

  const loadSLASettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSLASettings();
      const list =
        res?.slas ||
        res?.configs ||
        res?.configurations ||
        res?.data ||
        (Array.isArray(res) ? res : []);
      setConfigs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (cfg: SLAConfig) => {
    setSavingPriority(cfg.priority);
    try {
      await api.updateSLASettings({
        priority: cfg.priority,
        response_time_hours: cfg.response_time_hours,
        resolution_time_hours: cfg.resolution_time_hours,
        warning_threshold_percent: cfg.warning_threshold_percent,
      });
      showToast(`SLA configuration for ${cfg.priority} updated.`, 'success');
      loadSLASettings();
    } catch (err: any) {
      showToast(err.message, 'danger');
    } finally {
      setSavingPriority(null);
    }
  };

  const handleFieldChange = (priority: string, field: string, val: number) => {
    setConfigs((prev) =>
      (prev || []).map((c) => (c.priority === priority ? { ...c, [field]: val } : c))
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">System Settings & Operational Configurations</h2>
          <div className="page-subtitle">Configure automatic ticket assignment levels, operational SLA deadlines, and warning thresholds</div>
        </div>
      </div>

      {/* Automatic Ticket Assignment Level Card */}
      <div className="card" style={{ maxWidth: 800, marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCheck size={18} color="#0284c7" />
            <span>Automatic Ticket Assignment Level</span>
          </div>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
          >
            Active: {savedAssignmentLevel} Routing
          </span>
        </div>

        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px 0' }}>
            Choose which support tier level receives incoming customer tickets automatically. The system will auto-route new tickets to active specialists with lowest workload in the assigned product department.
          </p>

          {levelSavedSuccess && (
            <div
              style={{
                padding: '10px 14px',
                background: '#f0fdf4',
                color: '#15803d',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #bbf7d0',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{levelSavedSuccess}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
            {[
              {
                level: 'L1' as const,
                title: 'L1 Specialist',
                badge: 'Default',
                desc: 'Standard frontline triage & resolution. Routes to active L1 engineers.',
              },
              {
                level: 'L2' as const,
                title: 'L2 Senior Specialist',
                badge: 'Direct Senior',
                desc: 'Direct dispatch to senior engineers for organizations without L1 triage.',
              },
              {
                level: 'L3' as const,
                title: 'L3 Principal / Dev',
                badge: 'Direct Core',
                desc: 'Direct dispatch to principal/core specialists for compact engineering teams.',
              },
            ].map((opt) => {
              const isSelected = autoAssignmentLevel === opt.level;
              return (
                <div
                  key={opt.level}
                  onClick={() => setAutoAssignmentLevel(opt.level)}
                  style={{
                    border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                    background: isSelected ? '#f0f9ff' : '#ffffff',
                    borderRadius: 8,
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name="autoAssignmentLevel"
                        value={opt.level}
                        checked={isSelected}
                        onChange={() => setAutoAssignmentLevel(opt.level)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#0369a1' : '#1e293b' }}>
                        {opt.level}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                      {opt.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    {opt.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                    {opt.desc}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 18, fontSize: 12, color: '#475569' }}>
            <strong>Current Behavior:</strong> New tickets are automatically assigned to eligible <strong>{autoAssignmentLevel}</strong> employees within the designated product department based on lowest active ticket workload.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleSaveAssignmentLevel}
              disabled={savingLevel || autoAssignmentLevel === savedAssignmentLevel}
            >
              <Save size={14} /> {savingLevel ? 'Saving Configuration...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 800 }}>
        <div className="card-header">
          <div className="card-title">Priority SLA Threshold Matrix</div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading configurations...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(configs || []).map((cfg) => (
              <div
                key={cfg.priority}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color:
                        cfg.priority === 'HIGH' ? '#dc2626' : cfg.priority === 'MEDIUM' ? '#d97706' : '#16a34a',
                    }}
                  >
                    ● {cfg.priority} PRIORITY
                  </span>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Initial response target & maximum elapsed resolution duration
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block' }}>
                      Response Target (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      className="form-control"
                      style={{ width: 90 }}
                      value={cfg.response_time_hours}
                      onChange={(e) => handleFieldChange(cfg.priority, 'response_time_hours', parseFloat(e.target.value))}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block' }}>
                      Resolution Deadline (Hours)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="form-control"
                      style={{ width: 100 }}
                      value={cfg.resolution_time_hours}
                      onChange={(e) => handleFieldChange(cfg.priority, 'resolution_time_hours', parseFloat(e.target.value))}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block' }}>
                      Warning Alert Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="95"
                      className="form-control"
                      style={{ width: 80 }}
                      value={cfg.warning_threshold_percent}
                      onChange={(e) =>
                        handleFieldChange(cfg.priority, 'warning_threshold_percent', parseInt(e.target.value, 10))
                      }
                    />
                    <div style={{ fontSize: 10, color: '#b45309', marginTop: 2, fontWeight: 500 }}>
                      Triggers at {(cfg.resolution_time_hours * (cfg.warning_threshold_percent / 100)).toFixed(1)}h
                    </div>
                  </div>

                  <div style={{ paddingTop: 16 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdate(cfg)}
                      disabled={savingPriority === cfg.priority}
                    >
                      <Save size={13} /> {savingPriority === cfg.priority ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
