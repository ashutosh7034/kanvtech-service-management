'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, passwordPlain: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { NotificationProvider } from './NotificationContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('kanvtech_token') : null;
    if (savedToken) {
      setToken(savedToken);
      api
        .me()
        .then((res) => {
          if (res.user) {
            setUser({
              id: res.user.id,
              email: res.user.email,
              role: res.user.role,
              displayName: res.user.employee?.name || res.user.companyContact?.name || res.user.email.split('@')[0],
              employeeId: res.user.employee?.id,
              companyId: res.user.companyContact?.companyId,
              contactId: res.user.companyContact?.id,
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

  const login = async (email: string, passwordPlain: string) => {
    setLoading(true);
    try {
      const res = await api.login({ email, password: passwordPlain });
      if (res.token && res.user) {
        localStorage.setItem('kanvtech_token', res.token);
        setToken(res.token);
        setUser({
          id: res.user.id,
          email: res.user.email,
          role: res.user.role,
          displayName: res.user.employeeName || res.user.contactName || res.user.email.split('@')[0],
          employeeId: res.user.employeeId,
          companyId: res.user.companyId,
          contactId: res.user.contactId,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') localStorage.removeItem('kanvtech_token');
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
