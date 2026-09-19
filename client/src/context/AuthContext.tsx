import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, passwordPlain: string) => Promise<void>;
  logout: () => void;
  switchDemoRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; label: string; desc: string }> = {
  ADMIN: { email: 'admin@kanvtech.com', label: 'Admin', desc: 'Full System Control' },
  MANAGER: { email: 'manager@kanvtech.com', label: 'Manager', desc: 'Approvals & Workload' },
  L1_EMPLOYEE: { email: 'l1.amit@kanvtech.com', label: 'L1 Specialist', desc: 'Triage & Resolution' },
  L2_EMPLOYEE: { email: 'l2.vikram@kanvtech.com', label: 'L2 Specialist', desc: 'Technical Escalations' },
  L3_EMPLOYEE: { email: 'l3.priya@kanvtech.com', label: 'L3 Specialist', desc: 'Core Engineering' },
  CUSTOMER: { email: 'rajesh@acme.com', label: 'Customer', desc: 'Acme Technologies' },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('kanvtech_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('kanvtech_token');
      if (savedToken) {
        try {
          const res = await api.me();
          if (res.user) {
            setUser({
              id: res.user.id,
              email: res.user.email,
              role: res.user.role,
              displayName: res.user.employee_name || res.user.email.split('@')[0],
              employeeId: res.user.employee_id,
              companyId: res.user.company_id,
              contactId: res.user.contact_id,
            });
          }
        } catch (err) {
          localStorage.removeItem('kanvtech_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth_unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, passwordPlain: string) => {
    const res = await api.login({ email, password: passwordPlain });
    localStorage.setItem('kanvtech_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('kanvtech_token');
    setToken(null);
    setUser(null);
  };

  const switchDemoRole = async (role: UserRole) => {
    const cred = DEMO_CREDENTIALS[role];
    if (cred) {
      await login(cred.email, 'Password@123');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
