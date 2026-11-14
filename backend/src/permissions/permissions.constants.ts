export interface PermissionDefinition {
  permissionCode: string;
  module: string;
  action: string;
  description: string;
  moduleLabel: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Employee Management
  {
    permissionCode: 'employee.view',
    module: 'employee',
    action: 'view',
    description: 'View employee directory and employee details',
    moduleLabel: 'Employee Management',
  },
  {
    permissionCode: 'employee.create',
    module: 'employee',
    action: 'create',
    description: 'Add new employees to the workspace',
    moduleLabel: 'Employee Management',
  },
  {
    permissionCode: 'employee.update',
    module: 'employee',
    action: 'update',
    description: 'Edit employee profiles, designations, and levels',
    moduleLabel: 'Employee Management',
  },
  {
    permissionCode: 'employee.delete',
    module: 'employee',
    action: 'delete',
    description: 'Remove or deactivate employee accounts permanently',
    moduleLabel: 'Employee Management',
  },
  {
    permissionCode: 'employee.activate',
    module: 'employee',
    action: 'activate',
    description: 'Activate suspended or inactive employee profiles',
    moduleLabel: 'Employee Management',
  },
  {
    permissionCode: 'employee.deactivate',
    module: 'employee',
    action: 'deactivate',
    description: 'Deactivate active employee accounts',
    moduleLabel: 'Employee Management',
  },
  {
    permissionCode: 'employee.assign_permissions',
    module: 'employee',
    action: 'assign_permissions',
    description: 'Grant and revoke granular permissions for other employees',
    moduleLabel: 'Employee Management',
  },

  // Department Management
  {
    permissionCode: 'department.view',
    module: 'department',
    action: 'view',
    description: 'View company departments and head assignments',
    moduleLabel: 'Department Management',
  },
  {
    permissionCode: 'department.create',
    module: 'department',
    action: 'create',
    description: 'Create new organizational departments',
    moduleLabel: 'Department Management',
  },
  {
    permissionCode: 'department.update',
    module: 'department',
    action: 'update',
    description: 'Edit department information and leadership',
    moduleLabel: 'Department Management',
  },
  {
    permissionCode: 'department.delete',
    module: 'department',
    action: 'delete',
    description: 'Delete organizational departments',
    moduleLabel: 'Department Management',
  },

  // Product Management
  {
    permissionCode: 'product.view',
    module: 'product',
    action: 'view',
    description: 'View products, modules, and sub-module catalogs',
    moduleLabel: 'Product Management',
  },
  {
    permissionCode: 'product.create',
    module: 'product',
    action: 'create',
    description: 'Add new products and product suites',
    moduleLabel: 'Product Management',
  },
  {
    permissionCode: 'product.update',
    module: 'product',
    action: 'update',
    description: 'Modify product specifications and module trees',
    moduleLabel: 'Product Management',
  },
  {
    permissionCode: 'product.delete',
    module: 'product',
    action: 'delete',
    description: 'Remove products from the product catalog',
    moduleLabel: 'Product Management',
  },
  {
    permissionCode: 'product.assign',
    module: 'product',
    action: 'assign',
    description: 'Assign product entitlements to customer companies',
    moduleLabel: 'Product Management',
  },

  // Customer / Company Management
  {
    permissionCode: 'company.view',
    module: 'company',
    action: 'view',
    description: 'View customer accounts and company directories',
    moduleLabel: 'Customer Management',
  },
  {
    permissionCode: 'company.create',
    module: 'company',
    action: 'create',
    description: 'Create new customer company profiles',
    moduleLabel: 'Customer Management',
  },
  {
    permissionCode: 'company.update',
    module: 'company',
    action: 'update',
    description: 'Update customer details, tax IDs, and addresses',
    moduleLabel: 'Customer Management',
  },
  {
    permissionCode: 'company.delete',
    module: 'company',
    action: 'delete',
    description: 'Archive or delete customer company accounts',
    moduleLabel: 'Customer Management',
  },
  {
    permissionCode: 'company.manage_contacts',
    module: 'company',
    action: 'manage_contacts',
    description: 'Add, update, or remove customer contact persons',
    moduleLabel: 'Customer Management',
  },

  // Ticket Management
  {
    permissionCode: 'ticket.view',
    module: 'ticket',
    action: 'view',
    description: 'View support tickets across the company',
    moduleLabel: 'Ticket Management',
  },
  {
    permissionCode: 'ticket.create',
    module: 'ticket',
    action: 'create',
    description: 'Create new tickets on behalf of customers or internal staff',
    moduleLabel: 'Ticket Management',
  },
  {
    permissionCode: 'ticket.update',
    module: 'ticket',
    action: 'update',
    description: 'Update ticket details, internal notes, and progress',
    moduleLabel: 'Ticket Management',
  },
  {
    permissionCode: 'ticket.assign',
    module: 'ticket',
    action: 'assign',
    description: 'Assign or reassign tickets to specific agents and tiers',
    moduleLabel: 'Ticket Management',
  },
  {
    permissionCode: 'ticket.close',
    module: 'ticket',
    action: 'close',
    description: 'Resolve and mark tickets as closed',
    moduleLabel: 'Ticket Management',
  },
  {
    permissionCode: 'ticket.reopen',
    module: 'ticket',
    action: 'reopen',
    description: 'Reopen closed or resolved tickets',
    moduleLabel: 'Ticket Management',
  },
  {
    permissionCode: 'ticket.delete',
    module: 'ticket',
    action: 'delete',
    description: 'Delete tickets from the system',
    moduleLabel: 'Ticket Management',
  },

  // Reports & SLA
  {
    permissionCode: 'reports.view',
    module: 'reports',
    action: 'view',
    description: 'Access business intelligence reports and analytics dashboards',
    moduleLabel: 'Reports & SLA',
  },
  {
    permissionCode: 'reports.export',
    module: 'reports',
    action: 'export',
    description: 'Export business reports and ticket metrics to Excel or PDF',
    moduleLabel: 'Reports & SLA',
  },
  {
    permissionCode: 'sla.view',
    module: 'sla',
    action: 'view',
    description: 'View SLA policies, response deadlines, and breach rules',
    moduleLabel: 'Reports & SLA',
  },
  {
    permissionCode: 'sla.manage',
    module: 'sla',
    action: 'manage',
    description: 'Configure and update SLA priorities, response and resolution targets',
    moduleLabel: 'Reports & SLA',
  },

  // Implementation Management
  {
    permissionCode: 'implementation.view',
    module: 'implementation',
    action: 'view',
    description: 'View ongoing customer implementations and milestone progress',
    moduleLabel: 'Implementation Management',
  },
  {
    permissionCode: 'implementation.create',
    module: 'implementation',
    action: 'create',
    description: 'Create new client implementation projects and milestones',
    moduleLabel: 'Implementation Management',
  },
  {
    permissionCode: 'implementation.update',
    module: 'implementation',
    action: 'update',
    description: 'Update project stages, milestones, and implementation progress',
    moduleLabel: 'Implementation Management',
  },
  {
    permissionCode: 'implementation.assign',
    module: 'implementation',
    action: 'assign',
    description: 'Assign implementation tasks and project ownership',
    moduleLabel: 'Implementation Management',
  },
  {
    permissionCode: 'implementation.delete',
    module: 'implementation',
    action: 'delete',
    description: 'Delete implementation projects and stage templates',
    moduleLabel: 'Implementation Management',
  },

  // Annual Maintenance Contracts (AMC)
  {
    permissionCode: 'amc.view',
    module: 'amc',
    action: 'view',
    description: 'View customer AMC contracts, warranties, and expiration dates',
    moduleLabel: 'Annual Maintenance (AMC)',
  },
  {
    permissionCode: 'amc.create',
    module: 'amc',
    action: 'create',
    description: 'Generate and initiate new AMC contracts for customers',
    moduleLabel: 'Annual Maintenance (AMC)',
  },
  {
    permissionCode: 'amc.update',
    module: 'amc',
    action: 'update',
    description: 'Renew, amend, and update customer AMC contracts',
    moduleLabel: 'Annual Maintenance (AMC)',
  },
  {
    permissionCode: 'amc.delete',
    module: 'amc',
    action: 'delete',
    description: 'Cancel or delete AMC contracts',
    moduleLabel: 'Annual Maintenance (AMC)',
  },
  {
    permissionCode: 'amc.renew',
    module: 'amc',
    action: 'renew',
    description: 'Renew customer AMC contracts and extend SLA coverage terms',
    moduleLabel: 'Annual Maintenance (AMC)',
  },
  {
    permissionCode: 'amc.manage_plans',
    module: 'amc',
    action: 'manage_plans',
    description: 'Create, modify, duplicate, and configure standardized AMC policy templates',
    moduleLabel: 'Annual Maintenance (AMC)',
  },

  // Task & Assignment Management
  {
    permissionCode: 'task.view_assigned',
    module: 'task',
    action: 'view_assigned',
    description: 'View tasks assigned to the employee',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.view_sent',
    module: 'task',
    action: 'view_sent',
    description: 'View tasks created and assigned by the employee',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.assign',
    module: 'task',
    action: 'assign',
    description: 'Assign tasks to eligible team members within tenant',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.update_progress',
    module: 'task',
    action: 'update_progress',
    description: 'Update task progress and add progress comments',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.complete',
    module: 'task',
    action: 'complete',
    description: 'Confirm and mark assigned task as completed',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.send_reminder',
    module: 'task',
    action: 'send_reminder',
    description: 'Send follow-up reminders to assignee',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.edit',
    module: 'task',
    action: 'edit',
    description: 'Modify task details and reschedule deadlines',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.cancel',
    module: 'task',
    action: 'cancel',
    description: 'Cancel an assigned task with documented reason',
    moduleLabel: 'Task Management',
  },
  {
    permissionCode: 'task.view_team',
    module: 'task',
    action: 'view_team',
    description: 'View team-wide task dashboard and workload overview',
    moduleLabel: 'Task Management',
  },

  // Configuration Management
  {
    permissionCode: 'configuration.view',
    module: 'configuration',
    action: 'view',
    description: 'View system settings, integrations, and email gateways',
    moduleLabel: 'Configuration Management',
  },
  {
    permissionCode: 'configuration.manage',
    module: 'configuration',
    action: 'manage',
    description: 'Modify workspace system configurations and operational preferences',
    moduleLabel: 'Configuration Management',
  },

  // Audit Logs
  {
    permissionCode: 'audit_logs.view',
    module: 'audit_logs',
    action: 'view',
    description: 'Access the system audit trails and compliance activity log',
    moduleLabel: 'Audit Logs',
  },
  {
    permissionCode: 'audit_logs.export',
    module: 'audit_logs',
    action: 'export',
    description: 'Download and export audit log events',
    moduleLabel: 'Audit Logs',
  },

  // Commercial Entitlements & Licences
  {
    permissionCode: 'entitlement.view',
    module: 'entitlement',
    action: 'view',
    description: 'View commercial licence allocations, usage, and validity',
    moduleLabel: 'Commercial Entitlements',
  },
  {
    permissionCode: 'entitlement.view_history',
    module: 'entitlement',
    action: 'view_history',
    description: 'View audit trail of licence allocations and modifications',
    moduleLabel: 'Commercial Entitlements',
  },
  {
    permissionCode: 'entitlement.request_renewal',
    module: 'entitlement',
    action: 'request_renewal',
    description: 'Initiate subscription renewal and licence expansion',
    moduleLabel: 'Commercial Entitlements',
  },
  {
    permissionCode: 'entitlement.manage',
    module: 'entitlement',
    action: 'manage',
    description: 'Modify commercial entitlements and allocate licences',
    moduleLabel: 'Commercial Entitlements',
  },
  {
    permissionCode: 'entitlement.add_licences',
    module: 'entitlement',
    action: 'add_licences',
    description: 'Expand User Licences and Company Licences before expiry',
    moduleLabel: 'Commercial Entitlements',
  },
  {
    permissionCode: 'subscription.renew',
    module: 'subscription',
    action: 'renew',
    description: 'Approve renewal and extend subscription validity',
    moduleLabel: 'Commercial Entitlements',
  },
];

