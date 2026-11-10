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
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../common/BrandLogo';

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<Props> = ({ currentView, onNavigate, isOpenMobile = false, onCloseMobile }) => {
  const { user, hasPermission } = useAuth();
  const role = user?.role || 'CUSTOMER';

  const isAccessible = (allowed: string[]) => {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
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
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <BrandLogo
          variant="horizontal"
          height={30}
          style={{ cursor: 'pointer' }}
          onClick={() => handleNav('dashboard')}
        />
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
        {(user?.role === 'PLATFORM_INCHARGE' || user?.isPlatformIncharge) && (
          <div style={{ marginBottom: 12 }}>
            <div className="nav-section-title" style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={13} color="#818cf8" />
              <span>Platform Control</span>
            </div>
            <button
              className={`nav-item ${currentView === 'platform_admin' ? 'active' : ''}`}
              onClick={() => handleNav('platform_admin')}
              style={{
                background: currentView === 'platform_admin' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : undefined,
                color: currentView === 'platform_admin' ? '#ffffff' : undefined,
                fontWeight: 600,
              }}
            >
              <Layers size={16} />
              <span>Multi-Tenant Platform</span>
            </button>
          </div>
        )}

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

        {(isAccessible(['MANAGER']) || hasPermission('company.view')) && (
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

        {(isAccessible(['MANAGER']) || hasPermission('department.view')) && (
          <button
            className={`nav-item ${currentView === 'departments' ? 'active' : ''}`}
            onClick={() => handleNav('departments')}
          >
            <Layers size={16} />
            <span>Department Master</span>
          </button>
        )}

        {(isAccessible(['MANAGER']) || hasPermission('employee.view')) && (
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

        {(isAccessible(['MANAGER']) || hasPermission('reports.view')) && (
          <button
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => handleNav('reports')}
          >
            <BarChart3 size={16} />
            <span>Reports & SLA</span>
          </button>
        )}

        {(isAccessible(['MANAGER']) || hasPermission('product.view') || hasPermission('implementation.view') || hasPermission('amc.view')) && (
          <>
            <div className="nav-section-title" style={{ marginTop: 10 }}>Business Management</div>

            {(isAccessible(['MANAGER']) || hasPermission('product.view')) && (
              <button
                className={`nav-item ${currentView === 'products' ? 'active' : ''}`}
                onClick={() => handleNav('products')}
              >
                <Package size={16} />
                <span>Product Master</span>
              </button>
            )}

            {(isAccessible(['MANAGER']) || hasPermission('implementation.view')) && (
              <button
                className={`nav-item ${currentView === 'implementations' ? 'active' : ''}`}
                onClick={() => handleNav('implementations')}
              >
                <Rocket size={16} />
                <span>New Implementations</span>
              </button>
            )}

            {(isAccessible(['MANAGER']) || hasPermission('amc.view')) && (
              <button
                className={`nav-item ${currentView === 'maintenance' ? 'active' : ''}`}
                onClick={() => handleNav('maintenance')}
              >
                <ShieldCheck size={16} />
                <span>Annual Maintenance</span>
              </button>
            )}
          </>
        )}

        {(role === 'ADMIN' || role === 'SUPER_ADMIN' || isAccessible(['MANAGER']) || hasPermission('employee.assign_permissions')) && (
          <>
            <div className="nav-section-title" style={{ marginTop: 10 }}>Administration</div>

            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || hasPermission('employee.assign_permissions')) && (
              <button
                className={`nav-item ${currentView === 'employee_permissions' ? 'active' : ''}`}
                onClick={() => handleNav('employee_permissions')}
              >
                <KeyRound size={16} />
                <span>Employee Permissions</span>
              </button>
            )}

            {isAccessible(['MANAGER']) && (
              <button
                className={`nav-item ${currentView === 'import' ? 'active' : ''}`}
                onClick={() => handleNav('import')}
              >
                <FileSpreadsheet size={16} />
                <span>Import & Export Data</span>
              </button>
            )}
          </>
        )}

        {(role === 'ADMIN' || role === 'SUPER_ADMIN' || hasPermission('sla.view') || hasPermission('audit_logs.view')) && (
          <>
            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || hasPermission('sla.view')) && (
              <button
                className={`nav-item ${currentView === 'sla_settings' ? 'active' : ''}`}
                onClick={() => handleNav('sla_settings')}
              >
                <Settings size={16} />
                <span>System & SLA Settings</span>
              </button>
            )}

            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || hasPermission('audit_logs.view')) && (
              <button
                className={`nav-item ${currentView === 'audit_logs' ? 'active' : ''}`}
                onClick={() => handleNav('audit_logs')}
              >
                <ShieldAlert size={16} />
                <span>Audit Logs</span>
              </button>
            )}
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
          <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            🏢 {user?.tenantName || 'Kanvtech Technologies'}
          </div>
        </div>
      </div>
    </aside>
  );
};
