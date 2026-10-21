import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Ticket,
  UserCheck,
  ArrowUpRight,
  CheckSquare,
  BarChart3,
  Package,
  Rocket,
  ShieldCheck,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  Smartphone,
  Layers,
  Briefcase,
  MessageSquare,
  Mail,
  Bell,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<Props> = ({ currentView, onNavigate, isOpenMobile = false, onCloseMobile }) => {
  const { user } = useAuth();
  const role = user?.role || 'CUSTOMER';

  const isAccessible = (allowed: string[]) => {
    if (role === 'ADMIN') return true;
    return allowed.includes(role);
  };

  const handleNav = (view: string) => {
    onNavigate(view);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand-icon">K</div>
        <div>
          <div>KANVTECH</div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>SERVICE PLATFORM</div>
        </div>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onCloseMobile}
          aria-label="Close navigation sidebar"
          title="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-title">Core Operations</div>

        <button
          className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNav('dashboard')}
        >
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </button>

        {role !== 'CUSTOMER' && (
          <button
            className={`nav-item ${currentView === 'task_reminders' ? 'active' : ''}`}
            onClick={() => handleNav('task_reminders')}
          >
            <Bell size={16} />
            <span>My Tasks & Reminders</span>
          </button>
        )}

        {role !== 'CUSTOMER' && (
          <button
            className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => handleNav('chat')}
          >
            <Mail size={16} />
            <span>Internal Messages</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'companies' ? 'active' : ''}`}
            onClick={() => handleNav('companies')}
          >
            <Building2 size={16} />
            <span>Customer Master</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'prospects' ? 'active' : ''}`}
            onClick={() => handleNav('prospects')}
          >
            <Briefcase size={16} />
            <span>Enquiries</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'departments' ? 'active' : ''}`}
            onClick={() => handleNav('departments')}
          >
            <Layers size={16} />
            <span>Department Master</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'employees' ? 'active' : ''}`}
            onClick={() => handleNav('employees')}
          >
            <Users size={16} />
            <span>Employees</span>
          </button>
        )}

        <button
          className={`nav-item ${currentView === 'tickets' ? 'active' : ''}`}
          onClick={() => handleNav('tickets')}
        >
          <Ticket size={16} />
          <span>Support Tickets</span>
        </button>

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'task_allotment' ? 'active' : ''}`}
            onClick={() => handleNav('task_allotment')}
          >
            <UserCheck size={16} />
            <span>Task Allotment</span>
          </button>
        )}

        {isAccessible(['MANAGER', 'L2_EMPLOYEE', 'L3_EMPLOYEE']) && (
          <button
            className={`nav-item ${currentView === 'escalations' ? 'active' : ''}`}
            onClick={() => handleNav('escalations')}
          >
            <ArrowUpRight size={16} />
            <span>Escalations Queue</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'approvals' ? 'active' : ''}`}
            onClick={() => handleNav('approvals')}
          >
            <CheckSquare size={16} />
            <span>Manager Reviews</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <button
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => handleNav('reports')}
          >
            <BarChart3 size={16} />
            <span>Reports & SLA</span>
          </button>
        )}

        {isAccessible(['MANAGER']) && (
          <>
            <div className="nav-section-title" style={{ marginTop: 10 }}>Business Management</div>

            <button
              className={`nav-item ${currentView === 'products' ? 'active' : ''}`}
              onClick={() => handleNav('products')}
            >
              <Package size={16} />
              <span>Product Master</span>
            </button>

            <button
              className={`nav-item ${currentView === 'implementations' ? 'active' : ''}`}
              onClick={() => handleNav('implementations')}
            >
              <Rocket size={16} />
              <span>New Implementations</span>
            </button>

            <button
              className={`nav-item ${currentView === 'maintenance' ? 'active' : ''}`}
              onClick={() => handleNav('maintenance')}
            >
              <ShieldCheck size={16} />
              <span>Annual Maintenance</span>
            </button>
          </>
        )}

        {isAccessible(['MANAGER']) && (
          <>
            <div className="nav-section-title" style={{ marginTop: 10 }}>Administration</div>

            <button
              className={`nav-item ${currentView === 'import' ? 'active' : ''}`}
              onClick={() => handleNav('import')}
            >
              <FileSpreadsheet size={16} />
              <span>Import & Export Data</span>
            </button>
          </>
        )}

        {role === 'ADMIN' && (
          <>
            <button
              className={`nav-item ${currentView === 'sla_settings' ? 'active' : ''}`}
              onClick={() => handleNav('sla_settings')}
            >
              <Settings size={16} />
              <span>System & SLA Settings</span>
            </button>

            <button
              className={`nav-item ${currentView === 'audit_logs' ? 'active' : ''}`}
              onClick={() => handleNav('audit_logs')}
            >
              <ShieldAlert size={16} />
              <span>Audit Logs</span>
            </button>
          </>
        )}

        <div className="nav-section-title" style={{ marginTop: 10 }}>Mobile Interfaces</div>

        <button
          className={`nav-item ${currentView === 'customer_mobile' ? 'active' : ''}`}
          onClick={() => handleNav('customer_mobile')}
        >
          <Smartphone size={16} />
          <span>Customer Mobile App</span>
        </button>

        <button
          className={`nav-item ${currentView === 'employee_mobile' ? 'active' : ''}`}
          onClick={() => handleNav('employee_mobile')}
        >
          <Smartphone size={16} />
          <span>Employee Mobile App</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.displayName || 'User'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {user?.email || ''}
          </div>
        </div>
      </div>
    </aside>
  );
};
