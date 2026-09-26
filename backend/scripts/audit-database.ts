import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function auditDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log('=============================================================');
  console.log(' KANVTECH SERVICE MANAGEMENT - DATABASE AUDIT REPORT');
  console.log('=============================================================');
  console.log(`DATABASE TARGET: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`DATABASE HOST:   localhost:5433`);
  console.log(`DATABASE NAME:   kanvtech_sm_staging`);
  console.log(`ENVIRONMENT:     ${nodeEnv}`);
  console.log('=============================================================\n');

  if (nodeEnv === 'production' || dbUrl.includes('railway.app') || dbUrl.includes('rlwy.net')) {
    console.error('SAFETY ERROR: Refusing to audit against production/Railway target.');
    process.exit(1);
  }

  const auditData: Array<{
    model: string;
    table: string;
    count: number;
    relatedTables: string;
    category: string;
    resetRequired: 'YES' | 'NO' | 'PARTIAL';
    reason: string;
  }> = [];

  const safeCount = async (fn: () => Promise<number>) => {
    try {
      return await fn();
    } catch (e: any) {
      return -1;
    }
  };

  const models = [
    {
      model: 'Role',
      table: 'roles',
      count: await safeCount(() => prisma.role.count()),
      relatedTables: 'users',
      category: 'System / RBAC Master',
      resetRequired: 'NO' as const,
      reason: 'Platform RBAC foundation with permissions definition',
    },
    {
      model: 'User',
      table: 'users',
      count: await safeCount(() => prisma.user.count()),
      relatedTables: 'roles, employees, company_contacts, tickets, audit_logs',
      category: 'Authentication / System & Business Accounts',
      resetRequired: 'PARTIAL' as const,
      reason: 'Keep System Admin (admin@kanvtech.com), remove all demo employees & customer users',
    },
    {
      model: 'Product',
      table: 'products',
      count: await safeCount(() => prisma.product.count()),
      relatedTables: 'departments, company_products, branch_products, subscriptions, implementations, tickets',
      category: 'Business / Product Master',
      resetRequired: 'YES' as const,
      reason: 'Clear all demo products (Tally, Spine, BIOS360, CyberShield, etc.)',
    },
    {
      model: 'Department',
      table: 'departments',
      count: await safeCount(() => prisma.department.count()),
      relatedTables: 'products, employees, tickets',
      category: 'Business / Department Master',
      resetRequired: 'YES' as const,
      reason: 'Clear all demo departments (Tally Support, Spine Support, etc.)',
    },
    {
      model: 'Employee',
      table: 'employees',
      count: await safeCount(() => prisma.employee.count()),
      relatedTables: 'users, departments, attendance, tickets, assignments, escalations, subscriptions, implementations',
      category: 'Business / Employee Master',
      resetRequired: 'YES' as const,
      reason: 'Clear all demo employees (Manager, Amit, Neha, Vikram, Priya, Suresh, Manish, etc.)',
    },
    {
      model: 'EmployeeAttendance',
      table: 'employee_attendance',
      count: await safeCount(() => prisma.employeeAttendance.count()),
      relatedTables: 'employees',
      category: 'Business / Operational Data',
      resetRequired: 'YES' as const,
      reason: 'Clear demo employee attendance records',
    },
    {
      model: 'Company',
      table: 'companies',
      count: await safeCount(() => prisma.company.count()),
      relatedTables: 'company_contacts, company_products, company_branches, tickets, subscriptions, implementations',
      category: 'Business / Customer Master',
      resetRequired: 'YES' as const,
      reason: 'Clear all demo companies (Acme, Zenith, etc.)',
    },
    {
      model: 'CompanyContact',
      table: 'company_contacts',
      count: await safeCount(() => prisma.companyContact.count()),
      relatedTables: 'companies, users, tickets',
      category: 'Business / Customer Contacts',
      resetRequired: 'YES' as const,
      reason: 'Clear demo customer contact persons',
    },
    {
      model: 'CompanyProduct',
      table: 'company_products',
      count: await safeCount(() => prisma.companyProduct.count()),
      relatedTables: 'companies, products',
      category: 'Business / Customer Products',
      resetRequired: 'YES' as const,
      reason: 'Clear demo company product purchases',
    },
    {
      model: 'CompanyBranch',
      table: 'company_branches',
      count: await safeCount(() => prisma.companyBranch.count()),
      relatedTables: 'companies, branch_products, tickets',
      category: 'Business / Branch Master',
      resetRequired: 'YES' as const,
      reason: 'Clear demo customer branch offices',
    },
    {
      model: 'BranchProduct',
      table: 'branch_products',
      count: await safeCount(() => prisma.branchProduct.count()),
      relatedTables: 'company_branches, products',
      category: 'Business / Branch Products',
      resetRequired: 'YES' as const,
      reason: 'Clear demo branch product assignments',
    },
    {
      model: 'Ticket',
      table: 'tickets',
      count: await safeCount(() => prisma.ticket.count()),
      relatedTables: 'companies, contacts, products, branches, departments, users, employees, assignments, history, escalations, sessions, comments, attachments, feedback, reopen_history',
      category: 'Business / Support Tickets',
      resetRequired: 'YES' as const,
      reason: 'Clear all demo tickets (KT-2026-000001, KT-2026-000002, etc.)',
    },
    {
      model: 'TicketAssignment',
      table: 'ticket_assignments',
      count: await safeCount(() => prisma.ticketAssignment.count()),
      relatedTables: 'tickets, employees, users',
      category: 'Business / Ticket Operations',
      resetRequired: 'YES' as const,
      reason: 'Clear demo ticket assignment history',
    },
    {
      model: 'TicketHistory',
      table: 'ticket_history',
      count: await safeCount(() => prisma.ticketHistory.count()),
      relatedTables: 'tickets, users',
      category: 'Business / Ticket Audit History',
      resetRequired: 'YES' as const,
      reason: 'Clear demo ticket chronological event logs',
    },
    {
      model: 'TicketEscalation',
      table: 'ticket_escalations',
      count: await safeCount(() => prisma.ticketEscalation.count()),
      relatedTables: 'tickets, employees',
      category: 'Business / Ticket Escalations',
      resetRequired: 'YES' as const,
      reason: 'Clear demo ticket L1->L2->L3 escalation records',
    },
    {
      model: 'TicketResolutionSession',
      table: 'ticket_resolution_sessions',
      count: await safeCount(() => prisma.ticketResolutionSession.count()),
      relatedTables: 'tickets, employees',
      category: 'Business / Multi-Tier Timer',
      resetRequired: 'YES' as const,
      reason: 'Clear demo resolution session active & historical timers',
    },
    {
      model: 'TicketComment',
      table: 'ticket_comments',
      count: await safeCount(() => prisma.ticketComment.count()),
      relatedTables: 'tickets, users',
      category: 'Business / Ticket Communication',
      resetRequired: 'YES' as const,
      reason: 'Clear demo internal notes and customer comments',
    },
    {
      model: 'TicketAttachment',
      table: 'ticket_attachments',
      count: await safeCount(() => prisma.ticketAttachment.count()),
      relatedTables: 'tickets, users',
      category: 'Business / Ticket Attachments',
      resetRequired: 'YES' as const,
      reason: 'Clear demo ticket file attachments metadata',
    },
    {
      model: 'TicketFeedback',
      table: 'ticket_feedback',
      count: await safeCount(() => prisma.ticketFeedback.count()),
      relatedTables: 'tickets, users',
      category: 'Business / CSAT Feedback',
      resetRequired: 'YES' as const,
      reason: 'Clear demo CSAT ratings and customer feedback',
    },
    {
      model: 'TicketReopenHistory',
      table: 'ticket_reopen_history',
      count: await safeCount(() => prisma.ticketReopenHistory.count()),
      relatedTables: 'tickets, users',
      category: 'Business / Ticket Reopens',
      resetRequired: 'YES' as const,
      reason: 'Clear demo reopen reason logs',
    },
    {
      model: 'Subscription',
      table: 'subscriptions',
      count: await safeCount(() => prisma.subscription.count()),
      relatedTables: 'companies, products, employees, implementations',
      category: 'Business / Annual Maintenance',
      resetRequired: 'YES' as const,
      reason: 'Clear demo AMC & subscription contracts',
    },
    {
      model: 'Implementation',
      table: 'implementations',
      count: await safeCount(() => prisma.implementation.count()),
      relatedTables: 'companies, products, subscriptions, employees, implementation_tasks',
      category: 'Business / New Implementations',
      resetRequired: 'YES' as const,
      reason: 'Clear demo implementation projects',
    },
    {
      model: 'ImplementationTask',
      table: 'implementation_tasks',
      count: await safeCount(() => prisma.implementationTask.count()),
      relatedTables: 'implementations, users',
      category: 'Business / Implementation Tasks',
      resetRequired: 'YES' as const,
      reason: 'Clear demo checklist tasks and deliverables',
    },
    {
      model: 'Notification',
      table: 'notifications',
      count: await safeCount(() => prisma.notification.count()),
      relatedTables: 'users',
      category: 'Business / In-App Notifications',
      resetRequired: 'YES' as const,
      reason: 'Clear demo user notifications',
    },
    {
      model: 'NotificationLog',
      table: 'notification_logs',
      count: await safeCount(() => prisma.notificationLog.count()),
      relatedTables: 'none',
      category: 'Business / Notification Dispatch Logs',
      resetRequired: 'YES' as const,
      reason: 'Clear demo multi-channel dispatch logs',
    },
    {
      model: 'AuditLog',
      table: 'audit_logs',
      count: await safeCount(() => prisma.auditLog.count()),
      relatedTables: 'users',
      category: 'System / Business Activity Logs',
      resetRequired: 'PARTIAL' as const,
      reason: 'Clear demo business action logs, preserve baseline system audits',
    },
    {
      model: 'SlaConfiguration',
      table: 'sla_configurations',
      count: await safeCount(() => prisma.slaConfiguration.count()),
      relatedTables: 'none',
      category: 'System / SLA Rules Master',
      resetRequired: 'NO' as const,
      reason: 'Keep global SLA thresholds (HIGH 4h, MEDIUM 12h, LOW 24h)',
    },
    {
      model: 'SystemSetting',
      table: 'system_settings',
      count: await safeCount(() => prisma.systemSetting.count()),
      relatedTables: 'none',
      category: 'System / Platform Configuration',
      resetRequired: 'NO' as const,
      reason: 'Keep global application settings (Auto-assignment, Two-ticket rule, etc.)',
    },
    {
      model: 'SequenceTracker',
      table: 'sequence_trackers',
      count: await safeCount(() => prisma.sequenceTracker.count()),
      relatedTables: 'none',
      category: 'System / Monotonic Counters',
      resetRequired: 'PARTIAL' as const,
      reason: 'Reset sequence counters to 0 for fresh business ID generation',
    },
  ];

  console.table(
    models.map((m) => ({
      'Model/Table': `${m.model} (${m.table})`,
      'Record Count': m.count,
      'Category': m.category,
      'Reset Required?': m.resetRequired,
      'Reason': m.reason,
    }))
  );

  console.log('\nAudit complete. Proceeding to verify foreign key relationships.');
  await prisma.$disconnect();
}

auditDatabase().catch(async (e) => {
  console.error('Audit failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
