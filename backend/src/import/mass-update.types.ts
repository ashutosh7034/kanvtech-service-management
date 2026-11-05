export type UpdateMode = 'fill_missing' | 'selective_overwrite';

export type MatchStatus = 'MATCHED' | 'UNMATCHED' | 'DUPLICATE' | 'AMBIGUOUS';
export type ValidationStatus = 'VALID' | 'INVALID';

export type FieldChangeStatus =
  | 'WILL_UPDATE'
  | 'SKIPPED_EXISTING'
  | 'SKIPPED_NOT_SELECTED'
  | 'SKIPPED_BLANK'
  | 'UNCHANGED';

export interface ModuleFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'email' | 'phone' | 'date' | 'number' | 'boolean' | 'enum';
  enumValues?: string[];
  isRequired?: boolean;
  isImmutable?: boolean;
  description: string;
  exampleValue: string;
}

export interface SupportedModuleConfig {
  id: string;
  label: string;
  modelName: string;
  templateName: string;
  recordIdentifierField: string;
  recordIdentifierLabel: string;
  alternateIdentifiers?: string[];
  displayNameField: string;
  fields: ModuleFieldDefinition[];
}

export interface FieldChangeDetail {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  proposedValue: any;
  status: FieldChangeStatus;
  reason?: string;
}

export interface MassUpdateRowPreview {
  rowNumber: number;
  identifier: string;
  recordName: string;
  matchStatus: MatchStatus;
  validationStatus: ValidationStatus;
  errors: string[];
  warnings: string[];
  changes: FieldChangeDetail[];
  willUpdateCount: number;
  skippedCount: number;
}

export interface MassUpdateSummary {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  ambiguousCount: number;
  invalidCount: number;
  changedCount: number;
  noChangeCount: number;
  readyCount: number;
}

export interface MassUpdatePreviewResult {
  module: string;
  updateMode: UpdateMode;
  identifierColumn: string;
  summary: MassUpdateSummary;
  rows: MassUpdateRowPreview[];
  validationErrors: Array<{
    rowNumber: number;
    identifier: string;
    field: string;
    message: string;
  }>;
}

export interface MassUpdateCommitPayload {
  rows: any[];
  identifierColumn: string;
  fieldMappings: Record<string, string>;
  updateMode: UpdateMode;
  selectedFields: string[];
  allowClearValues?: boolean;
  fileName?: string;
}

export interface MassUpdateExecutionResult {
  operationId: string;
  module: string;
  updateMode: UpdateMode;
  totalRows: number;
  matchedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  timestamp: string;
  message: string;
  details: Array<{
    rowNumber: number;
    identifier: string;
    recordName: string;
    matchStatus: MatchStatus;
    updateStatus: 'UPDATED' | 'SKIPPED' | 'FAILED';
    fieldsUpdated: string[];
    fieldsSkipped: string[];
    errorReason?: string;
  }>;
}

export interface MassUpdateHistoryItem {
  operationId: string;
  fileName: string;
  module: string;
  updateMode: UpdateMode;
  actorUserId?: number | null;
  actorEmail?: string;
  tenantId: string;
  totalRows: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Product & Module Entitlements Mass Update Types
// -----------------------------------------------------------------------------

export type EntitlementAction = 'ADD' | 'UPDATE' | 'REMOVE' | 'ENABLE' | 'DISABLE';
export type EntitlementUpdateMode = 'selective' | 'full_sync';

export interface EntitlementRowPreview {
  rowNumber: number;
  customerId: string;
  customerName?: string | null;
  companyName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  productId: string;
  productName: string;
  moduleId?: string | null;
  moduleName?: string | null;
  submoduleId?: string | null;
  submoduleName?: string | null;
  action: EntitlementAction;
  requestedStatus: 'ENABLED' | 'DISABLED';
  currentStatus: 'ENABLED' | 'DISABLED' | 'NOT_ASSIGNED';
  actionCategory: 'NEW' | 'UPDATE' | 'REMOVE' | 'UNCHANGED' | 'INVALID';
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EntitlementPreviewSummary {
  totalRows: number;
  newCount: number;
  updateCount: number;
  removeCount: number;
  unchangedCount: number;
  invalidCount: number;
  readyCount: number;
  affectedCustomerCount: number;
  affectedBranchCount: number;
}

export interface EntitlementPreviewResult {
  mode: EntitlementUpdateMode;
  summary: EntitlementPreviewSummary;
  rows: EntitlementRowPreview[];
  validationErrors: Array<{
    rowNumber: number;
    customerId: string;
    field: string;
    message: string;
  }>;
}

export interface EntitlementCommitPayload {
  rows: any[];
  mode: EntitlementUpdateMode;
  fileName?: string;
}

export interface EntitlementExecutionResult {
  operationId: string;
  mode: EntitlementUpdateMode;
  totalRows: number;
  appliedCount: number;
  skippedCount: number;
  failedCount: number;
  timestamp: string;
  message: string;
  details: Array<{
    rowNumber: number;
    customerId: string;
    branchId?: string | null;
    productId: string;
    moduleId?: string | null;
    submoduleId?: string | null;
    action: string;
    status: 'APPLIED' | 'SKIPPED' | 'FAILED';
    errorReason?: string;
  }>;
}

