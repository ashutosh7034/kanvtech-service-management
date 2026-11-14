/**
 * Centralized Audit Log Human-Readable Formatter & Security Sanitizer
 * Transforms technical database audit records into customer-ready, professional business activity records.
 */

// Sensitive keys that must NEVER be returned in any audit response or displayed in UI
export const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'credentials',
  'privatedata',
  'salt',
  'sessionsecret',
  'session_secret',
]);

// Internal keys that should be filtered out from business attribute views
export const INTERNAL_TECHNICAL_KEYS = new Set([
  'id',
  'actoruserid',
  'actor_user_id',
  'tenantid',
  'tenant_id',
  'userid',
  'user_id',
  'creatorid',
  'creator_id',
  'creatoruserid',
  'creator_user_id',
  'submoduleseq',
  'moduleseq',
  'taskseq',
  'passwordhash',
  'password_hash',
  'deletedat',
  'deleted_at',
]);

export const ROLE_MAP: Record<string, string> = {
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

export const ENTITY_MAP: Record<string, string> = {
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

export const EVENT_MAP: Record<
  string,
  {
    label: string;
    module: string;
    getDescription: (meta: {
      entityName?: string;
      ref?: string;
      actorName?: string;
      newValues?: any;
      oldValues?: any;
    }) => string;
  }
> = {
  PRODUCT_CREATED: {
    label: 'Product Created',
    module: 'Product Master',
    getDescription: ({ entityName, ref }) =>
      `${entityName || 'Product'} ${ref ? `(${ref})` : ''} was registered into the product catalog.`,
  },
  PRODUCT_UPDATED: {
    label: 'Product Updated',
    module: 'Product Master',
    getDescription: ({ entityName }) =>
      `Specifications and details for ${entityName || 'product'} were updated.`,
  },
  PRODUCT_DEACTIVATED: {
    label: 'Product Deactivated',
    module: 'Product Master',
    getDescription: ({ entityName }) =>
      `${entityName || 'Product'} was deactivated from catalog availability.`,
  },
  PRODUCT_ACTIVATED: {
    label: 'Product Activated',
    module: 'Product Master',
    getDescription: ({ entityName }) =>
      `${entityName || 'Product'} was activated for customer subscription and deployment.`,
  },
  PRODUCT_STATUS_CHANGED: {
    label: 'Product Status Changed',
    module: 'Product Master',
    getDescription: ({ entityName, newValues }) =>
      `Status for ${entityName || 'product'} changed to ${newValues?.isActive ? 'Active' : 'Inactive'}.`,
  },
  PRODUCT_DELETED: {
    label: 'Product Deleted',
    module: 'Product Master',
    getDescription: ({ entityName }) =>
      `${entityName || 'Product'} was permanently removed from the catalog.`,
  },
  PRODUCT_MODULE_CREATED: {
    label: 'Product Module Created',
    module: 'Product Master',
    getDescription: ({ newValues }) =>
      `New functional module "${newValues?.name || 'Module'}" added to product suite.`,
  },
  PRODUCT_MODULE_UPDATED: {
    label: 'Product Module Updated',
    module: 'Product Master',
    getDescription: ({ newValues }) =>
      `Functional module "${newValues?.name || 'Module'}" was updated.`,
  },
  PRODUCT_MODULE_DELETED: {
    label: 'Product Module Removed',
    module: 'Product Master',
    getDescription: ({ oldValues }) =>
      `Functional module "${oldValues?.name || 'Module'}" was removed.`,
  },
  PRODUCT_SUBMODULE_CREATED: {
    label: 'Product Sub-Module Created',
    module: 'Product Master',
    getDescription: ({ newValues }) =>
      `New sub-feature "${newValues?.name || 'Sub-Module'}" added.`,
  },
  PRODUCT_SUBMODULE_UPDATED: {
    label: 'Product Sub-Module Updated',
    module: 'Product Master',
    getDescription: ({ newValues }) =>
      `Sub-feature "${newValues?.name || 'Sub-Module'}" was updated.`,
  },
  PRODUCT_SUBMODULE_DELETED: {
    label: 'Product Sub-Module Removed',
    module: 'Product Master',
    getDescription: ({ oldValues }) =>
      `Sub-feature "${oldValues?.name || 'Sub-Module'}" was removed.`,
  },
  COMPANY_CREATED: {
    label: 'Customer Company Created',
    module: 'Customer Master',
    getDescription: ({ entityName, ref }) =>
      `Customer company "${entityName || 'Client'}" ${ref ? `(${ref})` : ''} was onboarded into the directory.`,
  },
  COMPANY_UPDATED: {
    label: 'Customer Company Updated',
    module: 'Customer Master',
    getDescription: ({ entityName }) =>
      `Corporate profile details updated for "${entityName || 'Client'}".`,
  },
  COMPANY_ACTIVATED: {
    label: 'Customer Company Activated',
    module: 'Customer Master',
    getDescription: ({ entityName }) =>
      `Customer company "${entityName || 'Client'}" account was set to Active status.`,
  },
  COMPANY_DEACTIVATED: {
    label: 'Customer Company Deactivated',
    module: 'Customer Master',
    getDescription: ({ entityName }) =>
      `Customer company "${entityName || 'Client'}" account was deactivated.`,
  },
  COMPANY_LICENCE_EXPANDED: {
    label: 'Company Licence Allocation Increased',
    module: 'Licence & Entitlements',
    getDescription: ({ entityName, newValues }) =>
      `Company licence allocation increased to ${newValues?.companyLicences ?? newValues?.totalQuantity ?? 'new allocation'}${entityName ? ` for ${entityName}` : ''}.`,
  },
  USER_LICENCE_EXPANDED: {
    label: 'User Licence Allocation Increased',
    module: 'Licence & Entitlements',
    getDescription: ({ entityName, newValues }) =>
      `User licence seat quota increased to ${newValues?.userLicences ?? newValues?.totalQuantity ?? 'new limit'}${entityName ? ` for ${entityName}` : ''}.`,
  },
  ENTITLEMENT_RENEWED: {
    label: 'Customer Entitlement Renewed',
    module: 'Licence & Entitlements',
    getDescription: ({ entityName }) =>
      `Product subscription entitlement was renewed${entityName ? ` for ${entityName}` : ''}.`,
  },
  CUSTOMER_ENTITLEMENT_MASS_UPDATE: {
    label: 'Customer Entitlements Bulk Updated',
    module: 'Licence & Entitlements',
    getDescription: () => `Bulk update of customer product licence allocations applied.`,
  },
  CUSTOMER_PRODUCT_ADDED: {
    label: 'Product Assigned to Customer',
    module: 'Customer Master',
    getDescription: ({ newValues }) =>
      `Product "${newValues?.productName || 'Suite'}" entitlement assigned to customer account.`,
  },
  CUSTOMER_PRODUCT_UPDATED: {
    label: 'Customer Product Entitlement Updated',
    module: 'Customer Master',
    getDescription: () => `Customer product licence and module entitlements updated.`,
  },
  CUSTOMER_PRODUCT_REMOVED: {
    label: 'Product Removed from Customer',
    module: 'Customer Master',
    getDescription: () => `Product entitlement unassigned from customer profile.`,
  },
  BRANCH_CREATED: {
    label: 'Customer Branch Added',
    module: 'Customer Master',
    getDescription: ({ newValues }) =>
      `Branch office "${newValues?.branchName || newValues?.name || 'Branch'}" registered.`,
  },
  BRANCH_UPDATED: {
    label: 'Customer Branch Updated',
    module: 'Customer Master',
    getDescription: ({ newValues }) =>
      `Branch details updated for "${newValues?.branchName || newValues?.name || 'Branch'}".`,
  },
  EMPLOYEE_CREATED: {
    label: 'Employee Added',
    module: 'Employee Management',
    getDescription: ({ entityName, newValues }) =>
      `New team member "${newValues?.name || entityName || 'Employee'}" added to staff roster.`,
  },
  EMPLOYEE_UPDATED: {
    label: 'Employee Details Updated',
    module: 'Employee Management',
    getDescription: ({ entityName, newValues }) =>
      `Employee records updated for "${newValues?.name || entityName || 'Staff member'}".`,
  },
  EMPLOYEE_STATUS_TOGGLED: {
    label: 'Employee Status Changed',
    module: 'Employee Management',
    getDescription: ({ entityName, newValues }) =>
      `Status for "${entityName || 'Employee'}" changed to ${newValues?.status || 'updated'}.`,
  },
  EMPLOYEE_DEACTIVATED: {
    label: 'Employee Deactivated',
    module: 'Employee Management',
    getDescription: ({ entityName }) =>
      `Employee profile for "${entityName || 'Staff member'}" was deactivated.`,
  },
  EMPLOYEE_PERMISSIONS_UPDATED: {
    label: 'Employee Permissions Updated',
    module: 'Employee Management',
    getDescription: ({ entityName }) =>
      `Security permissions and operational access updated for "${entityName || 'Employee'}".`,
  },
  SUPER_ADMIN_CREATED: {
    label: 'Administrator Account Created',
    module: 'System Administration',
    getDescription: ({ newValues }) =>
      `System Administrator profile created for "${newValues?.name || 'Admin'}".`,
  },
  SUPER_ADMIN_ROLE_GRANTED: {
    label: 'Administrator Role Granted',
    module: 'System Administration',
    getDescription: ({ entityName }) =>
      `Platform administrative privileges granted to ${entityName || 'User'}.`,
  },
  TASK_CREATED: {
    label: 'Task Created',
    module: 'Tasks & Reminders',
    getDescription: ({ newValues, ref }) =>
      `Task ${ref ? `[${ref}] ` : ''}"${newValues?.title || 'Assignment'}" created.`,
  },
  TASK_ASSIGNED: {
    label: 'Task Assigned',
    module: 'Tasks & Reminders',
    getDescription: ({ newValues, ref }) =>
      `Task ${ref ? `[${ref}] ` : ''}"${newValues?.title || 'Assignment'}" assigned to team specialist.`,
  },
  TASK_PROGRESS_UPDATED: {
    label: 'Task Progress Updated',
    module: 'Tasks & Reminders',
    getDescription: ({ newValues, ref }) =>
      `Progress on task ${ref ? `[${ref}] ` : ''}advanced to ${newValues?.progress != null ? newValues.progress + '%' : 'updated value'}.`,
  },
  TASK_COMPLETED: {
    label: 'Task Completed',
    module: 'Tasks & Reminders',
    getDescription: ({ ref, newValues }) =>
      `Task ${ref ? `[${ref}] ` : ''}"${newValues?.title || 'Assignment'}" marked completed.`,
  },
  TASK_REMINDER_SENT: {
    label: 'Task Reminder Sent',
    module: 'Tasks & Reminders',
    getDescription: ({ ref }) =>
      `Task reminder dispatched for deadline compliance ${ref ? `[${ref}]` : ''}.`,
  },
  TASK_EXTENSION_REQUESTED: {
    label: 'Task Extension Requested',
    module: 'Tasks & Reminders',
    getDescription: ({ ref }) =>
      `Deadline extension requested for task ${ref ? `[${ref}]` : ''}.`,
  },
  TASK_CANCELLED: {
    label: 'Task Cancelled',
    module: 'Tasks & Reminders',
    getDescription: ({ ref }) => `Task ${ref ? `[${ref}]` : ''} was cancelled.`,
  },
  TASK_DELETED: {
    label: 'Task Deleted',
    module: 'Tasks & Reminders',
    getDescription: ({ oldValues }) =>
      `Task "${oldValues?.title || 'Assignment'}" was removed.`,
  },
  TICKET_CREATED: {
    label: 'Support Ticket Created',
    module: 'Support Tickets',
    getDescription: ({ ref, newValues }) =>
      `Support ticket #${ref || ''} "${newValues?.subject || 'Inquiry'}" logged.`,
  },
  TICKET_ASSIGNED: {
    label: 'Support Ticket Assigned',
    module: 'Support Tickets',
    getDescription: ({ ref }) =>
      `Ticket #${ref || ''} assigned to specialist for resolution.`,
  },
  TICKET_RESOLVED: {
    label: 'Support Ticket Resolved',
    module: 'Support Tickets',
    getDescription: ({ ref }) =>
      `Resolution documented and verified for ticket #${ref || ''}.`,
  },
  TICKET_CLOSED: {
    label: 'Support Ticket Closed',
    module: 'Support Tickets',
    getDescription: ({ ref }) =>
      `Ticket #${ref || ''} closed with customer sign-off.`,
  },
  DEPARTMENT_CREATED: {
    label: 'Department Created',
    module: 'Departments',
    getDescription: ({ newValues }) =>
      `Department "${newValues?.name || 'Department'}" established.`,
  },
  DEPARTMENT_UPDATED: {
    label: 'Department Updated',
    module: 'Departments',
    getDescription: ({ newValues }) =>
      `Department "${newValues?.name || 'Department'}" details updated.`,
  },
  AMC_PLAN_CREATED: {
    label: 'AMC Plan Created',
    module: 'AMC & Subscriptions',
    getDescription: ({ newValues }) =>
      `AMC service plan "${newValues?.planName || newValues?.name || 'Plan'}" published.`,
  },
  SUBSCRIPTION_CREATED: {
    label: 'AMC Contract Created',
    module: 'AMC & Subscriptions',
    getDescription: ({ entityName, ref }) =>
      `Annual maintenance agreement initiated ${ref ? `(${ref})` : ''}${entityName ? ` for ${entityName}` : ''}.`,
  },
  SUBSCRIPTION_RENEWED: {
    label: 'AMC Contract Renewed',
    module: 'AMC & Subscriptions',
    getDescription: ({ entityName, ref }) =>
      `Annual maintenance contract ${ref ? `(${ref})` : ''} renewed${entityName ? ` for ${entityName}` : ''}.`,
  },
  IMPLEMENTATION_CREATED: {
    label: 'Customer Implementation Created',
    module: 'New Implementations',
    getDescription: ({ ref, entityName }) =>
      `Implementation onboarding project ${ref ? `[${ref}] ` : ''}started${entityName ? ` for ${entityName}` : ''}.`,
  },
  SYSTEM_SETTINGS_UPDATED: {
    label: 'System Settings Updated',
    module: 'System Administration',
    getDescription: () => `Platform configurations and service parameters updated.`,
  },
  SETTINGS_UPDATED: {
    label: 'Configuration Updated',
    module: 'System Administration',
    getDescription: () => `System operational settings updated.`,
  },
  PASSWORD_CHANGED: {
    label: 'Account Password Updated',
    module: 'System Administration',
    getDescription: () => `Account login credentials updated securely.`,
  },
  PASSWORD_RESET_BY_ADMIN: {
    label: 'Account Password Reset',
    module: 'System Administration',
    getDescription: () => `Password reset initiated by authorized administrator.`,
  },
  DATA_EXPORT_JSON: {
    label: 'Data Exported (JSON)',
    module: 'System Administration',
    getDescription: () => `Operational dataset exported in JSON format.`,
  },
  DATA_EXPORT_CSV: {
    label: 'Data Exported (CSV)',
    module: 'System Administration',
    getDescription: () => `Operational dataset exported in CSV format.`,
  },
  DATA_EXPORT_XLSX: {
    label: 'Data Exported (Excel)',
    module: 'System Administration',
    getDescription: () => `Operational dataset exported in Microsoft Excel format.`,
  },
  DATA_IMPORT_COMMIT: {
    label: 'Data Import Completed',
    module: 'System Administration',
    getDescription: () => `Data records imported successfully into master directory.`,
  },
  MASS_UPDATE_EXECUTE: {
    label: 'Bulk Records Updated',
    module: 'System Administration',
    getDescription: () => `Mass update execution completed across selected records.`,
  },
};

/**
 * Format any action string into a clean, human-readable label without exposing raw screaming snake case.
 */
export function formatActionLabel(rawAction: string): { label: string; module: string } {
  if (!rawAction) {
    return { label: 'General Activity', module: 'Operational Activity' };
  }
  if (EVENT_MAP[rawAction]) {
    return {
      label: EVENT_MAP[rawAction].label,
      module: EVENT_MAP[rawAction].module,
    };
  }

  // Graceful fallback for unmapped events: convert SCREAMING_SNAKE_CASE to Title Case
  // E.g. TICKET_PRIORITY_ESCALATED -> Ticket Priority Escalated
  const readable = rawAction
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Infer module
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
    label: readable || 'Activity Recorded',
    module: inferredModule,
  };
}

/**
 * Format internal user role to human-readable designation.
 */
export function formatRole(role?: string): string {
  if (!role) return 'Automated System';
  if (ROLE_MAP[role]) return ROLE_MAP[role];
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Format internal entity type to human-readable label.
 */
export function formatEntityType(entityType?: string): string {
  if (!entityType) return 'Business Record';
  if (ENTITY_MAP[entityType]) return ENTITY_MAP[entityType];
  return entityType
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Recursively remove passwords, password hashes, secrets, and auth tokens.
 */
export function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SENSITIVE_KEYS.has(norm)) {
      continue; // completely strip sensitive data
    }
    if (v && typeof v === 'object') {
      clean[k] = sanitizeData(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Safely parse JSON or return object.
 */
export function safeParseJson(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object') return sanitizeData(raw);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return sanitizeData(parsed);
      }
    } catch {
      // not json
    }
  }
  return null;
}

/**
 * Format attribute key to human-readable display label.
 */
export function formatAttributeKey(key: string): string {
  const map: Record<string, string> = {
    companyName: 'Company Name',
    productName: 'Product Name',
    productCode: 'Product Code',
    category: 'Category',
    name: 'Name',
    code: 'Business Code',
    status: 'Status',
    isActive: 'Active Status',
    priority: 'Priority',
    designation: 'Designation',
    department: 'Department',
    level: 'Tier / Level',
    phone: 'Phone Number',
    email: 'Email Address',
    companyLicences: 'Company Licences',
    userLicences: 'User Licences',
    totalQuantity: 'Total Allocation',
    added: 'Licences Added',
    released: 'Licences Released',
    dueDate: 'Due Date',
    dueTime: 'Due Time',
    reminderTime: 'Reminder Schedule',
    progress: 'Progress',
    checklistProgress: 'Checklist Progress',
    assignedTo: 'Assigned Specialist',
    targetGoLive: 'Target Go-Live Date',
    description: 'Description',
    notes: 'Operational Notes',
    planName: 'Plan Name',
    annualCost: 'Annual Price',
    ticketNumber: 'Ticket Number',
    subject: 'Subject',
    reason: 'Reason',
  };

  if (map[key]) return map[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/**
 * Format attribute value to human-readable string.
 */
export function formatAttributeValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Active / Yes' : 'Inactive / No';
  if (typeof val === 'object') {
    if (val.name) return String(val.name);
    if (val.code) return String(val.code);
    return JSON.stringify(val);
  }
  return String(val);
}

/**
 * Extract human-readable business attributes and change diffs.
 */
export function extractBusinessAttributes(
  oldValues: any,
  newValues: any,
): Array<{ label: string; value?: string; oldValue?: string; newValue?: string }> {
  const attributes: Array<{ label: string; value?: string; oldValue?: string; newValue?: string }> = [];

  const oldClean = oldValues ? sanitizeData(oldValues) : null;
  const newClean = newValues ? sanitizeData(newValues) : null;

  // Case 1: Both old and new exist (Update / Status change / Expansion)
  if (oldClean && newClean) {
    const allKeys = new Set([...Object.keys(oldClean), ...Object.keys(newClean)]);
    for (const key of allKeys) {
      const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (INTERNAL_TECHNICAL_KEYS.has(norm) || SENSITIVE_KEYS.has(norm)) continue;

      const oldVal = oldClean[key];
      const newVal = newClean[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        attributes.push({
          label: formatAttributeKey(key),
          oldValue: formatAttributeValue(oldVal),
          newValue: formatAttributeValue(newVal),
        });
      } else if (newVal !== undefined && newVal !== null) {
        // Unchanged key but useful context
        attributes.push({
          label: formatAttributeKey(key),
          value: formatAttributeValue(newVal),
        });
      }
    }
  } else {
    // Case 2: Creation or deletion (single snapshot)
    const target = newClean || oldClean || {};
    for (const [key, val] of Object.entries(target)) {
      const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (INTERNAL_TECHNICAL_KEYS.has(norm) || SENSITIVE_KEYS.has(norm)) continue;
      if (val === undefined || val === null) continue;

      attributes.push({
        label: formatAttributeKey(key),
        value: formatAttributeValue(val),
      });
    }
  }

  return attributes;
}

/**
 * Master transformation of a raw database audit record into a clean, human-readable record.
 */
export function formatAuditRecord(
  log: any,
  options: { allowRawJson?: boolean } = {},
): any {
  const oldValues = safeParseJson(log.oldValuesJson);
  const newValues = safeParseJson(log.newValuesJson);

  const actionMeta = formatActionLabel(log.action);
  const eventConfig = EVENT_MAP[log.action];

  // Resolve actor readable name and role
  let actorName = 'System';
  if (log.actor?.employee?.name) {
    actorName = log.actor.employee.name;
  } else if (log.actor?.role === 'SUPER_ADMIN' || log.actor?.isSuperAdmin) {
    actorName = 'System Administrator';
  } else if (log.actor?.email) {
    const namePart = log.actor.email.split('@')[0];
    actorName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }

  const actorRole = formatRole(log.actor?.role);
  const actorEmail = log.actor?.email || 'system@kanvtech.com';

  // Resolve business entity name and reference
  const snapshot = newValues || oldValues || {};
  const entityName =
    snapshot.name ||
    snapshot.companyName ||
    snapshot.productName ||
    snapshot.title ||
    snapshot.subject ||
    snapshot.branchName ||
    null;

  // Resolve business reference (e.g. PRD-0001, CMP-0001, ETSK-0001, TKT-1001)
  let businessReference: string | null = null;
  const rawId = String(log.entityId || '');
  if (
    rawId.startsWith('PRD-') ||
    rawId.startsWith('CMP-') ||
    rawId.startsWith('ETSK-') ||
    rawId.startsWith('TKT-') ||
    rawId.startsWith('IMP-') ||
    rawId.startsWith('AMC-') ||
    rawId.startsWith('SUB-') ||
    rawId.startsWith('EMP-')
  ) {
    businessReference = rawId;
  } else if (snapshot.code) {
    businessReference = String(snapshot.code);
  } else if (snapshot.ticketNumber) {
    businessReference = String(snapshot.ticketNumber);
  }

  // Generate description
  let description = '';
  if (eventConfig?.getDescription) {
    description = eventConfig.getDescription({
      entityName: entityName || undefined,
      ref: businessReference || undefined,
      actorName,
      newValues,
      oldValues,
    });
  } else {
    description = `${actionMeta.label} on ${formatEntityType(log.entityType)}${
      entityName ? ` "${entityName}"` : ''
    }.`;
  }

  // Extract human-readable business attributes
  const businessAttributes = extractBusinessAttributes(oldValues, newValues);

  const formatted: any = {
    id: log.id,
    created_at: log.createdAt,
    action: actionMeta.label, // "Product Created"
    action_code: log.action,
    module: actionMeta.module, // "Product Master"
    description,
    status: 'Completed',
    actor_name: actorName,
    actor_role: actorRole,
    actor_email: actorEmail,
    entity_type: formatEntityType(log.entityType), // "Product"
    entity_name: entityName || '—',
    business_reference: businessReference || '—',
    attributes: businessAttributes,
  };

  // Only authorized platform security administrators with explicit flag receive sanitized raw payload
  if (options.allowRawJson && newValues) {
    formatted.raw_payload = JSON.stringify(newValues, null, 2);
  }

  return formatted;
}

