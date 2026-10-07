import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, LogOut, ChevronDown, KeyRound, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { formatTime } from '../../utils/date';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

interface Props {
  pageTitle: string;
  onNavigate?: (view: string, id?: string) => void;
}

export const Header: React.FC<Props> = ({ pageTitle, onNavigate }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, showToast } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isRecentlyCheckedOut, setIsRecentlyCheckedOut] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const notifMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const checkOutTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      if (checkOutTimerRef.current) {
        clearTimeout(checkOutTimerRef.current);
      }
    };
  }, []);

  const handleAttendanceToggle = async () => {
    if (!user?.employeeId) return;
    try {
      if (isCheckedIn) {
        await api.checkOut({ employeeId: user.employeeId });
        setIsCheckedIn(false);
        setIsRecentlyCheckedOut(true);
        if (checkOutTimerRef.current) {
          clearTimeout(checkOutTimerRef.current);
        }
        checkOutTimerRef.current = setTimeout(() => {
          setIsRecentlyCheckedOut(false);
        }, 3500);
        showToast('Checked out successfully. Status set to OFFLINE.', 'info');
      } else {
        if (checkOutTimerRef.current) {
          clearTimeout(checkOutTimerRef.current);
        }
        setIsRecentlyCheckedOut(false);
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

  const handleNotificationClick = async (n: any) => {
    if (!n.is_read) {
      await markAsRead(n.id);
    }
    setShowNotifMenu(false);

    const link = n.link_url || n.linkUrl || '';
    if (link && onNavigate) {
      if (link.includes('/chat')) {
        const match = link.match(/[?&]id=(\d+)/) || link.match(/\/chat\/(\d+)/);
        const convId = match ? match[1] : undefined;
        onNavigate('chat', convId);
      } else if (link.includes('/task_reminders') || link.includes('/tasks') || link.includes('/my-tasks')) {
        const match = link.match(/[?&]id=([A-Za-z0-9-]+)/);
        const taskId = match ? match[1] : undefined;
        onNavigate('task_reminders', taskId);
      } else if (link.includes('/tickets/')) {
        const ticketId = link.split('/tickets/')[1];
        onNavigate('ticket_detail', ticketId);
      } else if (link.includes('/dashboard')) {
        onNavigate('dashboard');
      }
    }
  };

  const displayedNotifications = notifFilter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

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
            onClick={handleAttendanceToggle}
            title={isCheckedIn ? 'Click to Check Out' : 'Click to Check In'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: isCheckedIn
                ? '#16a34a'
                : isRecentlyCheckedOut
                ? '#dc2626'
                : '#ffffff',
              color: isCheckedIn || isRecentlyCheckedOut ? '#ffffff' : '#334155',
              border: isCheckedIn
                ? '1px solid #15803d'
                : isRecentlyCheckedOut
                ? '1px solid #b91c1c'
                : '1px solid #cbd5e1',
              boxShadow: isCheckedIn
                ? '0 1px 3px rgba(22, 163, 74, 0.3)'
                : isRecentlyCheckedOut
                ? '0 1px 3px rgba(220, 38, 38, 0.3)'
                : '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <CheckCircle2 size={13} color={isCheckedIn || isRecentlyCheckedOut ? '#ffffff' : '#64748b'} />
            <span>
              {isCheckedIn ? '● Checked In' : isRecentlyCheckedOut ? '● Checked Out' : '○ Check In'}
            </span>
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
              background: showNotifMenu ? '#f1f5f9' : 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '6px 10px',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            title="Notifications"
          >
            <Bell size={16} color={unreadCount > 0 ? '#0284c7' : '#64748b'} />
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: '1px 6px',
                  lineHeight: '14px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '120%',
                width: 360,
                background: 'white',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 1000,
                maxHeight: 460,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#0284c7', fontWeight: 600 }}>
                      ({unreadCount} unread)
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', padding: '4px 8px', gap: 4 }}>
                <button
                  onClick={() => setNotifFilter('all')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: notifFilter === 'all' ? '#ffffff' : 'transparent',
                    color: notifFilter === 'all' ? '#0f172a' : '#64748b',
                    boxShadow: notifFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setNotifFilter('unread')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: notifFilter === 'unread' ? '#ffffff' : 'transparent',
                    color: notifFilter === 'unread' ? '#0f172a' : '#64748b',
                    boxShadow: notifFilter === 'unread' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0', maxHeight: 340 }}>
                {displayedNotifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {notifFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </div>
                ) : (
                  displayedNotifications.map((n) => {
                    const isUnread = !n.is_read;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isUnread ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ marginTop: 3 }}>
                          {isUnread ? (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                          ) : (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: isUnread ? 700 : 500, fontSize: 13, color: '#0f172a' }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                            {formatTime(n.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
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

