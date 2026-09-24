import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { formatTime } from '../../utils/date';

interface Props {
  pageTitle: string;
}

export const Header: React.FC<Props> = ({ pageTitle }) => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, showToast } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const handleAttendanceToggle = async () => {
    if (!user?.employeeId) return;
    try {
      if (isCheckedIn) {
        await api.checkOut({ employeeId: user.employeeId });
        setIsCheckedIn(false);
        showToast('Checked out successfully. Status set to OFFLINE.', 'info');
      } else {
        await api.checkIn({ employeeId: user.employeeId, address: 'HQ Service Center' });
        setIsCheckedIn(true);
        showToast('Checked in successfully. Status set to AVAILABLE.', 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{pageTitle}</h1>
      </div>

      <div className="header-right">
        {/* Employee Check-in Quick Control */}
        {user?.employeeId && (
          <button
            className={`btn btn-sm ${isCheckedIn ? 'btn-success' : 'btn-secondary'}`}
            onClick={handleAttendanceToggle}
            title="Toggle Daily Attendance"
            style={{ fontSize: 12, padding: '5px 10px' }}
          >
            <CheckCircle2 size={13} />
            <span>{isCheckedIn ? '● Checked In' : '○ Check In'}</span>
          </button>
        )}

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }} ref={notifMenuRef}>
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
            }}
            style={{
              position: 'relative',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: '#475569',
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#dc2626',
                }}
              />
            )}
          </button>

          {showNotifMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '110%',
                width: 320,
                background: 'white',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1000,
                maxHeight: 380,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>Notifications ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: n.is_read ? 'white' : '#f8fafc',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                        {formatTime(n.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Identity Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeft: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#0b3b60',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.displayName}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
