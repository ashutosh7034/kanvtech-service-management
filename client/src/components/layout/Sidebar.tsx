import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Ticket,
  ArrowUpRight,
  CheckSquare,
  BarChart3,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  Smartphone,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<Props> = ({ currentView, onNavigate }) => {
  const { user, logout } = useAuth();
  const role = user?.role || 'CUSTOMER';

  const isAccessible = (allowed: string[]) => {
    if (role === 'ADMIN') return true;
    return allowed.includes(role);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">K</div>
        <div>
          <div>KANVTECH</div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>SERVICE PLATFORM</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-title">Core Operations</div>

        <button
          className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </button>

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'companies' ? 'active' : ''}`}
            onClick={() => onNavigate('companies')}
          >
            <Building2 size={16} />
            <span>Company Master</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'employees' ? 'active' : ''}`}
            onClick={() => onNavigate('employees')}
          >
            <Users size={16} />
            <span>Employees</span>
          </button>
        )}

        <button
          className={`nav-item ${currentView === 'tickets' ? 'active' : ''}`}
          onClick={() => onNavigate('tickets')}
        >
          <Ticket size={16} />
          <span>Support Tickets</span>
        </button>

        {isAccessible(['MANAGER', 'L2_EMPLOYEE', 'L3_EMPLOYEE']) && (
          <button
            className={`nav-item ${currentView === 'escalations' ? 'active' : ''}`}
            onClick={() => onNavigate('escalations')}
          >
            <ArrowUpRight size={16} />
            <span>Escalations Queue</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'approvals' ? 'active' : ''}`}
            onClick={() => onNavigate('approvals')}
          >
            <CheckSquare size={16} />
            <span>Manager Reviews</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => onNavigate('reports')}
          >
            <BarChart3 size={16} />
            <span>Reports & SLA</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <>
            <div className="nav-section-title" style={{ marginTop: 10 }}>Administration</div>

            <button
              className={`nav-item ${currentView === 'import' ? 'active' : ''}`}
              onClick={() => onNavigate('import')}
            >
              <FileSpreadsheet size={16} />
              <span>Import Data</span>
            </button>
          </>
        )}

        {role === 'ADMIN' && (
          <>
            <button
              className={`nav-item ${currentView === 'sla_settings' ? 'active' : ''}`}
              onClick={() => onNavigate('sla_settings')}
            >
              <Settings size={16} />
              <span>SLA Settings</span>
            </button>

            <button
              className={`nav-item ${currentView === 'audit_logs' ? 'active' : ''}`}
              onClick={() => onNavigate('audit_logs')}
            >
              <ShieldAlert size={16} />
              <span>Audit Logs</span>
            </button>
          </>
        )}

        <div className="nav-section-title" style={{ marginTop: 10 }}>Mobile Interfaces</div>

        <button
          className={`nav-item ${currentView === 'customer_mobile' ? 'active' : ''}`}
          onClick={() => onNavigate('customer_mobile')}
        >
          <Smartphone size={16} />
          <span>Customer Mobile App</span>
        </button>

        <button
          className={`nav-item ${currentView === 'employee_mobile' ? 'active' : ''}`}
          onClick={() => onNavigate('employee_mobile')}
        >
          <Smartphone size={16} />
          <span>Employee Mobile App</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{user?.displayName}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{role.replace('_', ' ')}</div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
