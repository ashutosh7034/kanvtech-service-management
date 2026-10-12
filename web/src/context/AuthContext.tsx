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
    const savedToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('kanvtech_token') || sessionStorage.getItem('kanvtech_token')
        : null;

    if (savedToken) {
      setToken(savedToken);
    }

    try {
      // api.me() sends credentials: 'include' (cookies) and Bearer header (if savedToken exists)
      const res = await api.me();
      if (res && res.user) {
        if (res.token && !savedToken) {
          setToken(res.token);
          if (typeof window !== 'undefined') {
            const isRemembered = localStorage.getItem('kanvtech_remember_me') === 'true';
            if (isRemembered) {
              localStorage.setItem('kanvtech_token', res.token);
            }
          }
        }
        setUser({
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
        });
      } else {
        setUser(null);
        setToken(null);
      }
    } catch {
      // Session invalid, expired, or unauthenticated
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kanvtech_token');
        sessionStorage.removeItem('kanvtech_token');
        localStorage.removeItem('kanvtech_user');
        sessionStorage.removeItem('kanvtech_user');
      }
      setUser(null);
      setToken(null);
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

    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email: string, passwordPlain: string, rememberMe = false) => {
    const res = await api.login({ email, password: passwordPlain, rememberMe });
    if (res.token && res.user) {
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('kanvtech_token', res.token);
          sessionStorage.removeItem('kanvtech_token');
        } else {
          sessionStorage.setItem('kanvtech_token', res.token);
          localStorage.removeItem('kanvtech_token');
        }
      }
      setToken(res.token);
      setUser({
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
      });
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
