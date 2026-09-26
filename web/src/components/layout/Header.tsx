import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, LogOut, ChevronDown, KeyRound, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { formatTime } from '../../utils/date';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

interface Props {
  pageTitle: string;
}

export const Header: React.FC<Props> = ({ pageTitle }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, showToast } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const notifMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
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

  const handleLogout = () => {
    setShowProfileMenu(false);
    logout();
  };

  const userInitial = user?.displayName ? user.displayName[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : 'U');

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
              setShowProfileMenu(false);
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

        {/* User Identity Chip & Interactive Profile Menu */}
        <div style={{ position: 'relative' }} ref={profileMenuRef}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifMenu(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 10px 4px 8px',
              borderLeft: '1px solid var(--border-subtle)',
              background: showProfileMenu ? '#f1f5f9' : 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#0b3b60',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{user?.displayName || 'User'}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{user?.email || ''}</div>
            </div>
            <ChevronDown size={14} color="#64748b" style={{ marginLeft: 2 }} />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '115%',
                width: 260,
                background: 'white',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              {/* Menu User Header */}
              <div
                style={{
                  padding: '14px 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#0b3b60',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {userInitial}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.displayName || 'Authenticated User'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                    {user?.email || ''}
                  </div>
                </div>
              </div>

              {/* Menu Actions */}
              <div style={{ padding: '6px' }}>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowChangePassword(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <KeyRound size={15} color="#0284c7" />
                  <span>Change Password</span>
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: '#b91c1c',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={15} color="#b91c1c" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </header>
  );
};

