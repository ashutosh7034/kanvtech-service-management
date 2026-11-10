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
];

