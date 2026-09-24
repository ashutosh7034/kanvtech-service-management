import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { SLAConfig } from '../../types';
import { useNotifications } from '../../context/NotificationContext';
import { Settings, Save, Clock } from 'lucide-react';

export const SLASettingsPage: React.FC = () => {
  const { showToast } = useNotifications();
  const [configs, setConfigs] = useState<SLAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPriority, setSavingPriority] = useState<string | null>(null);

  useEffect(() => {
    loadSLASettings();
  }, []);

  const loadSLASettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSLASettings();
      const list = res?.configs || res?.configurations || (Array.isArray(res) ? res : []);
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
          <h2 className="page-title">SLA Configurations & Response Targets</h2>
          <div className="page-subtitle">Configure operational SLA resolution deadlines and warning thresholds per priority tier</div>
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
