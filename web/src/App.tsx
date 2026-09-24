'use client';

import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './pages-components/auth/LoginPage';
import { DashboardPage } from './pages-components/dashboard/DashboardPage';
import { CompaniesPage } from './pages-components/companies/CompaniesPage';
import { EmployeesPage } from './pages-components/employees/EmployeesPage';
import { TicketsPage } from './pages-components/tickets/TicketsPage';
import { TicketDetailPage } from './pages-components/tickets/TicketDetailPage';
import { EscalationsPage } from './pages-components/escalations/EscalationsPage';
import { ApprovalsPage } from './pages-components/approvals/ApprovalsPage';
import { ReportsPage } from './pages-components/reports/ReportsPage';
import { ImportPage } from './pages-components/import/ImportPage';
import { SLASettingsPage } from './pages-components/settings/SLASettingsPage';
import { AuditLogsPage } from './pages-components/settings/AuditLogsPage';
import { CustomerMobileView } from './pages-components/mobile/CustomerMobileView';
import { EmployeeMobileView } from './pages-components/mobile/EmployeeMobileView';
import { ProductsPage } from './pages-components/products/ProductsPage';
import { TaskAllotmentPage } from './pages-components/task-allotment/TaskAllotmentPage';
import { MaintenancePage } from './pages-components/maintenance/MaintenancePage';
import { ImplementationsPage } from './pages-components/implementations/ImplementationsPage';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#0b3b60', fontWeight: 600 }}>
        Initializing Kanvtech Enterprise Session...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const navigateTo = (view: string, id?: string) => {
    if (id) setActiveTicketId(id);
    setCurrentView(view);
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Operations Dashboard';
      case 'companies':
        return 'Company Master Directory';
      case 'employees':
        return 'Specialist Employee Directory';
      case 'tickets':
      case 'tickets_create':
        return 'Customer Support Tickets';
      case 'ticket_detail':
        return `Work Screen • ${activeTicketId || 'Ticket'}`;
      case 'task_allotment':
        return 'Task Allotment & Workload Queue';
      case 'escalations':
        return 'Senior Tier Escalation Queue';
      case 'approvals':
        return 'Manager Resolution Approvals';
      case 'products':
        return 'Product Master Catalog';
      case 'implementations':
        return 'New Client Implementations';
      case 'maintenance':
        return 'Annual Maintenance & Subscriptions';
      case 'reports':
        return 'Operational Analytics & Reports';
      case 'import':
        return 'Data Import Engine';
      case 'sla_settings':
        return 'SLA Configuration';
      case 'audit_logs':
        return 'Security & Audit Logs';
      case 'customer_mobile':
        return 'Customer Mobile Experience';
      case 'employee_mobile':
        return 'Employee Mobile Experience';
      default:
        return 'Kanvtech Service Management';
    }
  };

  const userRole = user?.role || 'CUSTOMER';

  const isViewAuthorized = (view: string): boolean => {
    if (userRole === 'ADMIN') return true;
    switch (view) {
      case 'dashboard':
      case 'tickets':
      case 'tickets_create':
      case 'ticket_detail':
        return true;
      case 'companies':
      case 'employees':
      case 'approvals':
      case 'reports':
      case 'import':
      case 'task_allotment':
      case 'products':
      case 'implementations':
      case 'maintenance':
        return userRole === 'MANAGER';
      case 'escalations':
        return ['MANAGER', 'L2_EMPLOYEE', 'L3_EMPLOYEE'].includes(userRole);
      case 'sla_settings':
      case 'audit_logs':
        return false;
      case 'customer_mobile':
        return true;
      case 'employee_mobile':
        return userRole !== 'CUSTOMER';
      default:
        return true;
    }
  };

  const authorized = isViewAuthorized(currentView);

  return (
    <Layout currentView={currentView} onNavigate={navigateTo} pageTitle={getPageTitle()}>
      {!authorized ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>
            Access Restricted
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            Your account role ({userRole.replace('_', ' ')}) is not authorized to access this operational view.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigateTo('dashboard')}>
            Return to Dashboard
          </button>
        </div>
      ) : (
        <>
          {currentView === 'dashboard' && <DashboardPage onNavigate={navigateTo} />}
          {currentView === 'companies' && <CompaniesPage onNavigateTicket={(id) => navigateTo('ticket_detail', id)} />}
          {currentView === 'employees' && <EmployeesPage />}
          {currentView === 'tickets' && <TicketsPage onNavigateDetail={(id) => navigateTo('ticket_detail', id)} />}
          {currentView === 'tickets_create' && (
            <TicketsPage onNavigateDetail={(id) => navigateTo('ticket_detail', id)} openCreateImmediately={true} />
          )}
          {currentView === 'ticket_detail' && activeTicketId && (
            <TicketDetailPage ticketId={activeTicketId} onBack={() => navigateTo('tickets')} />
          )}
          {currentView === 'task_allotment' && <TaskAllotmentPage onNavigateDetail={(id) => navigateTo('ticket_detail', id)} />}
          {currentView === 'escalations' && <EscalationsPage onNavigateDetail={(id) => navigateTo('ticket_detail', id)} />}
          {currentView === 'approvals' && <ApprovalsPage onNavigateDetail={(id) => navigateTo('ticket_detail', id)} />}
          {currentView === 'products' && <ProductsPage />}
          {currentView === 'implementations' && <ImplementationsPage />}
          {currentView === 'maintenance' && <MaintenancePage />}
          {currentView === 'reports' && <ReportsPage />}
          {currentView === 'import' && <ImportPage />}
          {currentView === 'sla_settings' && <SLASettingsPage />}
          {currentView === 'audit_logs' && <AuditLogsPage />}
          {currentView === 'customer_mobile' && <CustomerMobileView />}
          {currentView === 'employee_mobile' && <EmployeeMobileView />}
        </>
      )}
    </Layout>
  );
};
