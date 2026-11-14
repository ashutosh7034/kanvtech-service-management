/**
 * Frontend Centralized Audit Log Labels and Event Mappings
 * Formats raw action codes, entity types, and roles into professional human-readable business labels.
 */

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Super Admin',
  PLATFORM_INCHARGE: 'Platform Incharge',
  ADMIN: 'Tenant Super Admin',
  TENANT_SUPER_ADMIN: 'Tenant Super Admin',
  MANAGER: 'Operations Manager',
  EMPLOYEE: 'Employee',
  SPECIALIST: 'Support Specialist',
  CUSTOMER: 'Customer Representative',
  SYSTEM: 'Automated System',
};

export const ENTITY_LABELS: Record<string, string> = {
  PRODUCT: 'Product',
  PRODUCT_MODULE: 'Product Module',
  PRODUCT_SUBMODULE: 'Product Sub-Module',
  CUSTOMER_ENTITLEMENT: 'Customer Licence Entitlement',
  COMPANY: 'Customer Company',
  EMPLOYEE: 'Employee',
  EMPLOYEE_TASK: 'Task Assignment',
  TASK: 'Task Assignment',
  TICKET: 'Support Ticket',
  DEPARTMENT: 'Department',
  SLA_CONFIG: 'SLA Configuration',
  SUBSCRIPTION: 'AMC & Subscription Contract',
  AMC_CONTRACT: 'AMC & Subscription Contract',
  AMC_PLAN: 'AMC Service Plan',
  IMPLEMENTATION: 'Customer Implementation',
  IMPLEMENTATION_TASK: 'Implementation Milestone',
  TENANT: 'Tenant Workspace',
  USER: 'User Account',
  BRANCH: 'Customer Branch',
  PERMISSION: 'Security Permission',
  PROSPECT: 'Prospective Client',
  SYSTEM_SETTING: 'System Configuration',
};

export const EVENT_LABELS: Record<string, { label: string; module: string }> = {
  PRODUCT_CREATED: { label: 'Product Created', module: 'Product Master' },
  PRODUCT_UPDATED: { label: 'Product Updated', module: 'Product Master' },
  PRODUCT_DEACTIVATED: { label: 'Product Deactivated', module: 'Product Master' },
  PRODUCT_ACTIVATED: { label: 'Product Activated', module: 'Product Master' },
  PRODUCT_STATUS_CHANGED: { label: 'Product Status Changed', module: 'Product Master' },
  PRODUCT_DELETED: { label: 'Product Deleted', module: 'Product Master' },
  PRODUCT_MODULE_CREATED: { label: 'Product Module Created', module: 'Product Master' },
  PRODUCT_MODULE_UPDATED: { label: 'Product Module Updated', module: 'Product Master' },
  PRODUCT_MODULE_DELETED: { label: 'Product Module Removed', module: 'Product Master' },
  PRODUCT_SUBMODULE_CREATED: { label: 'Product Sub-Module Created', module: 'Product Master' },
  PRODUCT_SUBMODULE_UPDATED: { label: 'Product Sub-Module Updated', module: 'Product Master' },
  PRODUCT_SUBMODULE_DELETED: { label: 'Product Sub-Module Removed', module: 'Product Master' },

  COMPANY_CREATED: { label: 'Customer Company Created', module: 'Customer Master' },
  COMPANY_UPDATED: { label: 'Customer Company Updated', module: 'Customer Master' },
  COMPANY_ACTIVATED: { label: 'Customer Company Activated', module: 'Customer Master' },
  COMPANY_DEACTIVATED: { label: 'Customer Company Deactivated', module: 'Customer Master' },
  COMPANY_LICENCE_EXPANDED: { label: 'Company Licence Allocation Increased', module: 'Licence & Entitlements' },
  USER_LICENCE_EXPANDED: { label: 'User Licence Allocation Increased', module: 'Licence & Entitlements' },
  ENTITLEMENT_RENEWED: { label: 'Customer Entitlement Renewed', module: 'Licence & Entitlements' },
  CUSTOMER_ENTITLEMENT_MASS_UPDATE: { label: 'Customer Entitlements Bulk Updated', module: 'Licence & Entitlements' },
  CUSTOMER_PRODUCT_ADDED: { label: 'Product Assigned to Customer', module: 'Customer Master' },
  CUSTOMER_PRODUCT_UPDATED: { label: 'Customer Product Entitlement Updated', module: 'Customer Master' },
  CUSTOMER_PRODUCT_REMOVED: { label: 'Product Removed from Customer', module: 'Customer Master' },
  BRANCH_CREATED: { label: 'Customer Branch Added', module: 'Customer Master' },
  BRANCH_UPDATED: { label: 'Customer Branch Updated', module: 'Customer Master' },

  EMPLOYEE_CREATED: { label: 'Employee Added', module: 'Employee Management' },
  EMPLOYEE_UPDATED: { label: 'Employee Details Updated', module: 'Employee Management' },
  EMPLOYEE_STATUS_TOGGLED: { label: 'Employee Status Changed', module: 'Employee Management' },
  EMPLOYEE_DEACTIVATED: { label: 'Employee Deactivated', module: 'Employee Management' },
  EMPLOYEE_PERMISSIONS_UPDATED: { label: 'Employee Permissions Updated', module: 'Employee Management' },
  USER_ID_CREATED: { label: 'User ID Assigned', module: 'Employee Management' },
  USER_ID_CHANGED: { label: 'User ID Modified', module: 'Employee Management' },
  SUPER_ADMIN_CREATED: { label: 'Administrator Account Created', module: 'System Administration' },
  SUPER_ADMIN_ROLE_GRANTED: { label: 'Administrator Role Granted', module: 'System Administration' },

  TASK_CREATED: { label: 'Task Created', module: 'Tasks & Reminders' },
  TASK_ASSIGNED: { label: 'Task Assigned', module: 'Tasks & Reminders' },
  TASK_PROGRESS_UPDATED: { label: 'Task Progress Updated', module: 'Tasks & Reminders' },
  TASK_COMPLETED: { label: 'Task Completed', module: 'Tasks & Reminders' },
  TASK_REMINDER_SENT: { label: 'Task Reminder Sent', module: 'Tasks & Reminders' },
  TASK_EXTENSION_REQUESTED: { label: 'Task Extension Requested', module: 'Tasks & Reminders' },
  TASK_CANCELLED: { label: 'Task Cancelled', module: 'Tasks & Reminders' },
  TASK_DELETED: { label: 'Task Deleted', module: 'Tasks & Reminders' },

  TICKET_CREATED: { label: 'Support Ticket Created', module: 'Support Tickets' },
  TICKET_ASSIGNED: { label: 'Support Ticket Assigned', module: 'Support Tickets' },
  TICKET_RESOLVED: { label: 'Support Ticket Resolved', module: 'Support Tickets' },
  TICKET_CLOSED: { label: 'Support Ticket Closed', module: 'Support Tickets' },

  DEPARTMENT_CREATED: { label: 'Department Created', module: 'Departments' },
  DEPARTMENT_UPDATED: { label: 'Department Updated', module: 'Departments' },

  AMC_PLAN_CREATED: { label: 'AMC Plan Created', module: 'AMC & Subscriptions' },
  SUBSCRIPTION_CREATED: { label: 'AMC Contract Created', module: 'AMC & Subscriptions' },
  SUBSCRIPTION_RENEWED: { label: 'AMC Contract Renewed', module: 'AMC & Subscriptions' },

  IMPLEMENTATION_CREATED: { label: 'Customer Implementation Created', module: 'New Implementations' },
  SYSTEM_SETTINGS_UPDATED: { label: 'System Settings Updated', module: 'System Administration' },
  SETTINGS_UPDATED: { label: 'Configuration Updated', module: 'System Administration' },
  PASSWORD_CHANGED: { label: 'Account Password Updated', module: 'System Administration' },
  PASSWORD_RESET_BY_ADMIN: { label: 'Account Password Reset', module: 'System Administration' },
  DATA_EXPORT_JSON: { label: 'Data Exported (JSON)', module: 'System Administration' },
  DATA_EXPORT_CSV: { label: 'Data Exported (CSV)', module: 'System Administration' },
  DATA_EXPORT_XLSX: { label: 'Data Exported (Excel)', module: 'System Administration' },
  DATA_IMPORT_COMMIT: { label: 'Data Import Completed', module: 'System Administration' },
  MASS_UPDATE_EXECUTE: { label: 'Bulk Records Updated', module: 'System Administration' },
};

/**
 * Human-readable event formatter with graceful fallback.
 * "Do not expose the original event code as the fallback."
 */
export function formatAuditEvent(rawAction: string): { label: string; module: string } {
  if (!rawAction) {
    return { label: 'General Activity', module: 'Operational Activity' };
  }
  if (EVENT_LABELS[rawAction]) {
    return EVENT_LABELS[rawAction];
  }

  // Gracefully convert SNAKE_CASE to Title Case
  const words = rawAction
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));

  const readable = words.join(' ') || 'System Activity';

  let inferredModule = 'Operational Activity';
  const upper = rawAction.toUpperCase();
  if (upper.includes('PRODUCT')) inferredModule = 'Product Master';
  else if (upper.includes('COMPANY') || upper.includes('CUSTOMER') || upper.includes('BRANCH'))
    inferredModule = 'Customer Master';
  else if (upper.includes('EMPLOYEE') || upper.includes('PERMISSION') || upper.includes('STAFF'))
    inferredModule = 'Employee Management';
  else if (upper.includes('TASK')) inferredModule = 'Tasks & Reminders';
  else if (upper.includes('LICENCE') || upper.includes('ENTITLEMENT'))
    inferredModule = 'Licence & Entitlements';
  else if (upper.includes('TICKET')) inferredModule = 'Support Tickets';
  else if (upper.includes('AMC') || upper.includes('SUBSCRIPTION'))
    inferredModule = 'AMC & Subscriptions';
  else if (upper.includes('IMPLEMENTATION')) inferredModule = 'New Implementations';
  else if (upper.includes('DEPARTMENT')) inferredModule = 'Departments';

  return {
    label: readable,
    module: inferredModule,
  };
}

export function formatAuditRole(role?: string): string {
  if (!role) return 'Automated System';
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatAuditEntity(entityType?: string): string {
  if (!entityType) return 'Business Record';
  if (ENTITY_LABELS[entityType]) return ENTITY_LABELS[entityType];
  return entityType
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

