'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, passwordPlain: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { NotificationProvider } from './NotificationContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    const isRemembered = typeof window !== 'undefined' && localStorage.getItem('kanvtech_remember_me') === 'true';
    const savedToken =
      typeof window !== 'undefined'
        ? (isRemembered ? localStorage.getItem('kanvtech_token') : sessionStorage.getItem('kanvtech_token')) ||
          localStorage.getItem('kanvtech_token') ||
          sessionStorage.getItem('kanvtech_token')
        : null;

    if (savedToken) {
      setToken(savedToken);
    }

    // Restore cached user from storage for instant offline/reconnect resiliency
    if (typeof window !== 'undefined') {
      const cachedUserStr = isRemembered
        ? localStorage.getItem('kanvtech_user') || sessionStorage.getItem('kanvtech_user')
        : sessionStorage.getItem('kanvtech_user');
      if (cachedUserStr) {
        try {
          const parsed = JSON.parse(cachedUserStr);
          if (parsed && (parsed.email || parsed.id)) {
            setUser(parsed);
          }
        } catch {}
      }
    }

    try {
      // api.me() sends credentials: 'include' (cookies) and Bearer header (if savedToken exists)
      const res = await api.me();
      if (res && res.user) {
        const validatedToken = res.token || savedToken;
        if (validatedToken) {
          setToken(validatedToken);
          if (typeof window !== 'undefined') {
            if (isRemembered) {
              localStorage.setItem('kanvtech_token', validatedToken);
            } else {
              sessionStorage.setItem('kanvtech_token', validatedToken);
            }
          }
        }
        const userData: User = {
          id: res.user.id || res.user.userId,
          email: res.user.email,
          role: res.user.role,
          displayName:
            res.user.name ||
            res.user.displayName ||
            res.user.employee?.name ||
            res.user.companyContact?.name ||
            res.user.email.split('@')[0],
          employeeId: res.user.employeeId || res.user.employee?.id,
          companyId: res.user.companyId || res.user.companyContact?.companyId,
          contactId: res.user.contactId || res.user.companyContact?.id,
        };
        setUser(userData);
        if (typeof window !== 'undefined') {
          if (isRemembered) {
            localStorage.setItem('kanvtech_user', JSON.stringify(userData));
          } else {
            sessionStorage.setItem('kanvtech_user', JSON.stringify(userData));
          }
        }
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err: any) {
      const isAuthError =
        err?.status === 401 ||
        err?.status === 403 ||
        err?.message?.includes('401') ||
        err?.message?.includes('Unauthorized') ||
        err?.message?.includes('SESSION_TERMINATED');

      if (isAuthError) {
        // Session definitively invalid, expired, or terminated
        if (typeof window !== 'undefined') {
          localStorage.removeItem('kanvtech_token');
          sessionStorage.removeItem('kanvtech_token');
          localStorage.removeItem('kanvtech_user');
          sessionStorage.removeItem('kanvtech_user');
        }
        setUser(null);
        setToken(null);
      } else {
        // Transient network error or server offline: DO NOT wipe saved token or cached user!
        // Preserves session so user is not logged out while offline.
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    const handleSessionTerminated = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth_unauthorized', handleUnauthorized);
    window.addEventListener('auth_session_terminated', handleSessionTerminated);

    // Lightweight session-validity check on window focus / tab visibility change
    let lastCheckTime = 0;
    const checkActiveSession = async () => {
      const now = Date.now();
      if (now - lastCheckTime < 20000) return; // at most once every 20s
      lastCheckTime = now;

      const currentToken =
        localStorage.getItem('kanvtech_token') || sessionStorage.getItem('kanvtech_token');
      if (!currentToken) return;

      try {
        await api.me();
      } catch {
        // api.me() will trigger 401 handler in client.ts if session is terminated
      }
    };

    window.addEventListener('focus', checkActiveSession);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkActiveSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
      window.removeEventListener('auth_session_terminated', handleSessionTerminated);
      window.removeEventListener('focus', checkActiveSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email: string, passwordPlain: string, rememberMe = false) => {
    const res = await api.login({ email, password: passwordPlain, rememberMe });
    if (res.token && res.user) {
      const userData: User = {
        id: res.user.id || res.user.userId,
        email: res.user.email,
        role: res.user.role,
        displayName:
          res.user.name ||
          res.user.displayName ||
          res.user.employeeName ||
          res.user.contactName ||
          res.user.email.split('@')[0],
        employeeId: res.user.employeeId,
        companyId: res.user.companyId,
        contactId: res.user.contactId,
      };

      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('kanvtech_token', res.token);
          localStorage.setItem('kanvtech_remember_me', 'true');
          localStorage.setItem('kanvtech_user', JSON.stringify(userData));
          sessionStorage.removeItem('kanvtech_token');
          sessionStorage.removeItem('kanvtech_user');
        } else {
          sessionStorage.setItem('kanvtech_token', res.token);
          sessionStorage.setItem('kanvtech_user', JSON.stringify(userData));
          localStorage.removeItem('kanvtech_token');
          localStorage.removeItem('kanvtech_remember_me');
          localStorage.removeItem('kanvtech_user');
        }
      }
      setToken(res.token);
      setUser(userData);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kanvtech_token');
        sessionStorage.removeItem('kanvtech_token');
        localStorage.removeItem('kanvtech_user');
        sessionStorage.removeItem('kanvtech_user');
        window.location.href = '/login';
      }
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
