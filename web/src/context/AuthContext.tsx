'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, passwordPlain: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { NotificationProvider } from './NotificationContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('kanvtech_token') || sessionStorage.getItem('kanvtech_token')
        : null;
    if (savedToken) {
      setToken(savedToken);
      api
        .me()
        .then((res) => {
          if (res.user) {
            setUser({
              id: res.user.id || res.user.userId,
              email: res.user.email,
              role: res.user.role,
              displayName: res.user.name || res.user.displayName || res.user.employee?.name || res.user.companyContact?.name || res.user.email.split('@')[0],
              employeeId: res.user.employeeId || res.user.employee?.id,
              companyId: res.user.companyId || res.user.companyContact?.companyId,
              contactId: res.user.contactId || res.user.companyContact?.id,
            });
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, passwordPlain: string, rememberMe = false) => {
    const res = await api.login({ email, password: passwordPlain });
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
        displayName: res.user.name || res.user.displayName || res.user.employeeName || res.user.contactName || res.user.email.split('@')[0],
        employeeId: res.user.employeeId,
        companyId: res.user.companyId,
        contactId: res.user.contactId,
      });
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kanvtech_token');
      sessionStorage.removeItem('kanvtech_token');
      localStorage.removeItem('kanvtech_user');
      sessionStorage.removeItem('kanvtech_user');
    }
    setToken(null);
    setUser(null);
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
