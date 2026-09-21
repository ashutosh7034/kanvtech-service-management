import React, { useState, useEffect } from 'react';
import { Play, Square, Clock } from 'lucide-react';

interface Props {
  initialSeconds: number;
  isRunning: boolean;
  sessions?: any[];
  canControl?: boolean;
  onStart?: () => void;
}

export const ResolutionTimerWidget: React.FC<Props> = ({
  initialSeconds,
  isRunning,
  sessions = [],
  canControl = false,
  onStart,
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="card" style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: isRunning ? '#e0f2fe' : '#f1f5f9',
              color: isRunning ? '#0284c7' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Resolution Timer {isRunning ? '(Live Active Session)' : '(Paused)'}
            </div>
            <div className={`timer-digits ${isRunning ? 'running' : ''}`} style={{ fontSize: 20 }}>
              {formatTime(seconds)}
            </div>
          </div>
        </div>

        {canControl && !isRunning && onStart && (
          <button className="btn btn-primary btn-sm" onClick={onStart}>
            <Play size={14} /> Start Work
          </button>
        )}
      </div>

      {sessions.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>Work Session History:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sessions.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>
                  <strong>{s.level}</strong> — {s.employee_name || 'Specialist'}{' '}
                  {s.ended_at ? '' : '(Currently Active)'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatTime(s.duration_seconds || Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
