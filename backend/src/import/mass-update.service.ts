import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  UpdateMode,
  MatchStatus,
  ValidationStatus,
  FieldChangeDetail,
  MassUpdateRowPreview,
  MassUpdateSummary,
  MassUpdatePreviewResult,
  MassUpdateCommitPayload,
  MassUpdateExecutionResult,
  MassUpdateHistoryItem,
  SupportedModuleConfig,
} from './mass-update.types';

function parseExcelDate(val: any): string | null {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    const utcDays = val - 25569;
    const date = new Date(Math.round(utcDays * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function sanitizeCellValue(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Guard against formula injection in spreadsheets
    if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
      return `'${trimmed}`;
    }
    return trimmed;
  }
  return val;
}

@Injectable()
export class MassUpdateService {
  private readonly logger = new Logger(MassUpdateService.name);
  private readonly reportsStore = new Map<string, MassUpdateExecutionResult>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Supported Modules Configuration
  // ---------------------------------------------------------------------------
  getSupportedModules(): SupportedModuleConfig[] {
    return [
      {
        id: 'employees',
        label: 'Specialist Employees',
        modelName: 'Employee',
        templateName: 'Employees',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Employee ID',
        alternateIdentifiers: ['email'],
        displayNameField: 'name',
        fields: [
          { key: 'name', label: 'Full Name', type: 'string', isRequired: false, description: 'Employee legal name', exampleValue: 'Rahul Sharma' },
          { key: 'phone', label: 'Phone Number', type: 'phone', isRequired: false, description: 'Direct contact phone', exampleValue: '9876543210' },
          { key: 'alternateEmails', label: 'Alternate Email(s)', type: 'string', isRequired: false, description: 'Comma-separated alternate emails', exampleValue: 'rahul.personal@gmail.com' },
          { key: 'alternatePhones', label: 'Alternate Phone(s)', type: 'string', isRequired: false, description: 'Emergency or alternate contact numbers', exampleValue: '9876500000' },
          { key: 'designation', label: 'Designation / Title', type: 'string', isRequired: false, description: 'Corporate job title', exampleValue: 'Senior Support Engineer' },
          { key: 'department', label: 'Department Name', type: 'string', isRequired: false, description: 'Assigned business department', exampleValue: 'Technical Support' },
          { key: 'level', label: 'Support Level', type: 'enum', enumValues: ['L1', 'L2', 'L3', 'MANAGER'], isRequired: false, description: 'Tier assignment level', exampleValue: 'L2' },
          { key: 'status', label: 'Employment Status', type: 'enum', enumValues: ['ACTIVE', 'INACTIVE'], isRequired: false, description: 'Account active flag', exampleValue: 'ACTIVE' },
        ],
      },
      {
        id: 'customers',
        label: 'Customer Master',
        modelName: 'Company',
        templateName: 'Customers',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Customer ID',
        alternateIdentifiers: ['primaryEmail'],
        displayNameField: 'companyName',
        fields: [
          { key: 'companyName', label: 'Company Name', type: 'string', isRequired: false, description: 'Registered business name', exampleValue: 'Acme Technologies Ltd' },
          { key: 'address', label: 'Office Address', type: 'string', isRequired: false, description: 'Full business address', exampleValue: 'Plot 42, MIDC Industrial Area, Pune' },
          { key: 'gstn', label: 'GSTN / Tax ID', type: 'string', isRequired: false, description: '15-character GST identification', exampleValue: '27AABCA1234F1Z5' },
          { key: 'primaryEmail', label: 'Primary Email', type: 'email', isRequired: false, description: 'Corporate contact email', exampleValue: 'accounts@acme.com' },
          { key: 'alternateEmails', label: 'Alternate Emails', type: 'string', isRequired: false, description: 'Secondary billing or escalation emails', exampleValue: 'ops@acme.com' },
          { key: 'contactPerson', label: 'Primary Contact Person', type: 'string', isRequired: false, description: 'Key relationship manager', exampleValue: 'Suresh Patil' },
          { key: 'contactPhone', label: 'Primary Contact Phone', type: 'phone', isRequired: false, description: 'Direct contact phone', exampleValue: '9822012345' },
          { key: 'contactAddress', label: 'Contact Location', type: 'string', isRequired: false, description: 'Branch or desk location', exampleValue: 'Floor 3, Building B' },
          { key: 'contactStatus', label: 'Contact Status', type: 'string', isRequired: false, description: 'Contract / KYC status', exampleValue: 'VERIFIED' },
          { key: 'alternateContact', label: 'Alternate Contact Person', type: 'string', isRequired: false, description: 'Backup contact name', exampleValue: 'Pooja Mehta' },
          { key: 'alternateContactPhone', label: 'Alternate Contact Phone', type: 'phone', isRequired: false, description: 'Backup phone', exampleValue: '9822099999' },
          { key: 'alternateContactEmail', label: 'Alternate Contact Email', type: 'email', isRequired: false, description: 'Backup email', exampleValue: 'pooja@acme.com' },
          { key: 'isActive', label: 'Is Active', type: 'boolean', isRequired: false, description: 'Active customer flag (true/false)', exampleValue: 'true' },
        ],
      },
      {
        id: 'products',
        label: 'Product Master',
        modelName: 'Product',
        templateName: 'Products',
        recordIdentifierField: 'code',
        recordIdentifierLabel: 'Product Code',
        alternateIdentifiers: ['id'],
        displayNameField: 'name',
        fields: [
          { key: 'name', label: 'Product Name', type: 'string', isRequired: false, description: 'Marketable product name', exampleValue: 'ERP Enterprise v2' },
          { key: 'category', label: 'Product Category', type: 'string', isRequired: false, description: 'Software or service category', exampleValue: 'Core SaaS' },
          { key: 'description', label: 'Description', type: 'string', isRequired: false, description: 'Module capabilities and overview', exampleValue: 'Full ERP system with inventory and billing' },
          { key: 'isActive', label: 'Is Active', type: 'boolean', isRequired: false, description: 'Product availability status', exampleValue: 'true' },
        ],
      },
      {
        id: 'departments',
        label: 'Department Master',
        modelName: 'Department',
        templateName: 'Departments',
        recordIdentifierField: 'code',
        recordIdentifierLabel: 'Department Code',
        alternateIdentifiers: ['id', 'name'],
        displayNameField: 'name',
        fields: [
          { key: 'name', label: 'Department Name', type: 'string', isRequired: false, description: 'Department descriptive name', exampleValue: 'Field Technical Support' },
          { key: 'description', label: 'Description', type: 'string', isRequired: false, description: 'Scope and responsibilities', exampleValue: 'Handles on-premise hardware and network integration' },
          { key: 'specializationJson', label: 'Specializations (JSON or text)', type: 'string', isRequired: false, description: 'Technical specializations covered', exampleValue: '["Hardware","Networking"]' },
          { key: 'isActive', label: 'Is Active', type: 'boolean', isRequired: false, description: 'Active status', exampleValue: 'true' },
        ],
      },
      {
        id: 'tickets',
        label: 'Support Tickets',
        modelName: 'Ticket',
        templateName: 'Tickets',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Ticket ID / Number',
        displayNameField: 'description',
        fields: [
          { key: 'category', label: 'Ticket Category', type: 'string', isRequired: false, description: 'Issue category', exampleValue: 'Billing Issue' },
          { key: 'description', label: 'Issue Description', type: 'string', isRequired: false, description: 'Detailed client issue text', exampleValue: 'Invoice generated with incorrect tax calculation' },
          { key: 'problemType', label: 'Problem Type', type: 'string', isRequired: false, description: 'Classification of problem', exampleValue: 'Financial Calculation' },
          { key: 'priority', label: 'Priority', type: 'enum', enumValues: ['HIGH', 'MEDIUM', 'LOW'], isRequired: false, description: 'SLA priority level', exampleValue: 'HIGH' },
          { key: 'status', label: 'Ticket Status', type: 'enum', enumValues: ['OPEN', 'IN_PROGRESS', 'PAUSED', 'REOPENED', 'RESOLVED', 'MANAGER_REVIEW', 'CUSTOMER_FEEDBACK', 'CLOSED'], isRequired: false, description: 'Workflow state', exampleValue: 'IN_PROGRESS' },
          { key: 'closureReason', label: 'Closure Reason', type: 'string', isRequired: false, description: 'Final closure or resolution remark', exampleValue: 'Re-issued amended invoice after client signoff' },
        ],
      },
      {
        id: 'branches',
        label: 'Customer Branches',
        modelName: 'CompanyBranch',
        templateName: 'Branches',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Branch ID',
        displayNameField: 'branchName',
        fields: [
          { key: 'branchName', label: 'Branch Name', type: 'string', isRequired: false, description: 'Branch operating location name', exampleValue: 'Pune Regional Hub' },
          { key: 'gstn', label: 'Branch GSTN', type: 'string', isRequired: false, description: 'State-specific GSTN', exampleValue: '27AABCA1234F1Z5' },
          { key: 'address', label: 'Branch Address', type: 'string', isRequired: false, description: 'Physical branch street address', exampleValue: 'Sector 5, Hinjewadi Phase 1' },
          { key: 'city', label: 'City', type: 'string', isRequired: false, description: 'Operating city', exampleValue: 'Pune' },
          { key: 'state', label: 'State', type: 'string', isRequired: false, description: 'Operating state', exampleValue: 'Maharashtra' },
          { key: 'pincode', label: 'Pincode', type: 'string', isRequired: false, description: 'Postal area code', exampleValue: '411057' },
          { key: 'contactPerson', label: 'Branch Contact Person', type: 'string', isRequired: false, description: 'Local branch incharge', exampleValue: 'Nitin Deshmukh' },
          { key: 'contactPhone', label: 'Branch Contact Phone', type: 'phone', isRequired: false, description: 'Branch direct line', exampleValue: '9823011111' },
          { key: 'contactEmail', label: 'Branch Contact Email', type: 'email', isRequired: false, description: 'Branch corporate inbox', exampleValue: 'pune.branch@acme.com' },
          { key: 'status', label: 'Branch Status', type: 'string', isRequired: false, description: 'Operational status', exampleValue: 'ACTIVE' },
        ],
      },
      {
        id: 'prospects',
        label: 'Enquiries & Prospects',
        modelName: 'Prospect',
        templateName: 'Prospects',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Prospect ID',
        alternateIdentifiers: ['email'],
        displayNameField: 'companyName',
        fields: [
          { key: 'companyName', label: 'Prospect Company Name', type: 'string', isRequired: false, description: 'Prospective company name', exampleValue: 'Zenith Logistics LLP' },
          { key: 'contactPerson', label: 'Contact Person', type: 'string', isRequired: false, description: 'Contact lead person', exampleValue: 'Anjali Sharma' },
          { key: 'phone', label: 'Contact Phone', type: 'phone', isRequired: false, description: 'Direct contact phone', exampleValue: '9811022222' },
          { key: 'email', label: 'Email', type: 'email', isRequired: false, description: 'Contact lead email', exampleValue: 'anjali@zenith.com' },
          { key: 'address', label: 'Address', type: 'string', isRequired: false, description: 'Lead office address', exampleValue: 'Bandra Kurla Complex, Mumbai' },
          { key: 'enquiry', label: 'Enquiry Notes', type: 'string', isRequired: false, description: 'Requested solution or quote details', exampleValue: 'Requires 50-user cloud ERP implementation' },
          { key: 'source', label: 'Lead Source', type: 'string', isRequired: false, description: 'Referral source or campaign', exampleValue: 'Website Form' },
          { key: 'status', label: 'Prospect Status', type: 'string', isRequired: false, description: 'Pipeline stage (e.g. NEW, QUALIFIED, CONVERTED)', exampleValue: 'QUALIFIED' },
          { key: 'notes', label: 'Internal Notes', type: 'string', isRequired: false, description: 'Sales rep follow-up notes', exampleValue: 'Scheduled demo for next Monday' },
        ],
      },
      {
        id: 'subscriptions',
        label: 'Annual Maintenance Agreements',
        modelName: 'Subscription',
        templateName: 'Subscriptions',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Subscription ID',
        displayNameField: 'planName',
        fields: [
          { key: 'planName', label: 'Agreement / Plan Name', type: 'string', isRequired: false, description: 'AMC contract tier or package', exampleValue: 'Platinum 24/7 SLA Support' },
          { key: 'startDate', label: 'Contract Start Date', type: 'date', isRequired: false, description: 'Effective start date (YYYY-MM-DD)', exampleValue: '2026-01-01' },
          { key: 'expiryDate', label: 'Contract Expiry Date', type: 'date', isRequired: false, description: 'Contract termination date (YYYY-MM-DD)', exampleValue: '2026-12-31' },
          { key: 'renewalDate', label: 'Renewal Date', type: 'date', isRequired: false, description: 'Target renewal window', exampleValue: '2026-11-30' },
          { key: 'status', label: 'Agreement Status', type: 'enum', enumValues: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'RENEWED'], isRequired: false, description: 'Current validity status', exampleValue: 'ACTIVE' },
          { key: 'notes', label: 'Terms & Notes', type: 'string', isRequired: false, description: 'Special contract terms or commercial notes', exampleValue: 'Quarterly payment cycle agreed' },
        ],
      },
      {
        id: 'implementations',
        label: 'Client Implementations',
        modelName: 'Implementation',
        templateName: 'Implementations',
        recordIdentifierField: 'id',
        recordIdentifierLabel: 'Implementation ID',
        displayNameField: 'id',
        fields: [
          { key: 'startDate', label: 'Kickoff Date', type: 'date', isRequired: false, description: 'Project kickoff date (YYYY-MM-DD)', exampleValue: '2026-02-01' },
          { key: 'targetGoLiveDate', label: 'Target Go-Live Date', type: 'date', isRequired: false, description: 'Planned launch date (YYYY-MM-DD)', exampleValue: '2026-06-30' },
          { key: 'actualGoLiveDate', label: 'Actual Go-Live Date', type: 'date', isRequired: false, description: 'Achieved launch date (YYYY-MM-DD)', exampleValue: '2026-06-25' },
          { key: 'status', label: 'Implementation Status', type: 'enum', enumValues: ['NEW', 'PLANNING', 'IN_PROGRESS', 'CONFIGURATION', 'TESTING', 'READY_FOR_GO_LIVE', 'LIVE', 'COMPLETED', 'BLOCKED'], isRequired: false, description: 'Milestone stage', exampleValue: 'TESTING' },
          { key: 'progressPercentage', label: 'Progress Percentage (0-100)', type: 'number', isRequired: false, description: 'Overall completion percentage', exampleValue: '85' },
          { key: 'pendingActivities', label: 'Pending Activities', type: 'string', isRequired: false, description: 'Outstanding deliverables or blockers', exampleValue: 'User acceptance testing signoff pending' },
          { key: 'notes', label: 'Implementation Notes', type: 'string', isRequired: false, description: 'Project manager notes', exampleValue: 'Data migration completed successfully' },
        ],
      },
    ];
  }

  getModuleConfig(type: string): SupportedModuleConfig {
    const normalized = type.toLowerCase().trim();
    const config = this.getSupportedModules().find(
      (m) => m.id === normalized || (normalized === 'companies' && m.id === 'customers'),
    );
    if (!config) {
      throw new BadRequestException(`Module '${type}' is not supported for Mass Update.`);
    }
    return config;
  }

  // ---------------------------------------------------------------------------
  // 2. Generate Mass Update Supplementary Template
  // ---------------------------------------------------------------------------
  generateUpdateTemplate(type: string): Buffer {
    const config = this.getModuleConfig(type);
    const wb = XLSX.utils.book_new();

    // Data worksheet
    const headers = [config.recordIdentifierLabel, ...config.fields.map((f) => f.label)];
    const sampleRow1 = [
      'EMP-001',
      ...config.fields.map((f) => f.exampleValue || ''),
    ];
    if (config.id === 'customers') sampleRow1[0] = 'CMP-0001';
    if (config.id === 'products') sampleRow1[0] = 'PROD-0001';
    if (config.id === 'departments') sampleRow1[0] = 'DEP-0001';
    if (config.id === 'tickets') sampleRow1[0] = 'KT-2026-000001';
    if (config.id === 'branches') sampleRow1[0] = 'BR-0001';
    if (config.id === 'prospects') sampleRow1[0] = 'PROS-0001';
    if (config.id === 'subscriptions') sampleRow1[0] = 'SUB-0001';
    if (config.id === 'implementations') sampleRow1[0] = 'IMP-0001';

    const wsData = [headers, sampleRow1];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, `${config.templateName} Update`);

    // Instructions worksheet
    const instructionRows = [
      ['KANVTECH SERVICE MANAGEMENT — MASS UPDATE & DATA COMPLETION GUIDE'],
      [''],
      ['1. Purpose', 'Use this template to supplement missing fields or selectively overwrite existing records.'],
      ['2. Mandatory Identifier', `The first column (${config.recordIdentifierLabel}) MUST contain the unique identifier of the existing record.`],
      ['3. No Duplicate Creation', 'This tool will NEVER create new records. Any unmatched rows will be flagged and skipped.'],
      ['4. Two Update Modes', 'When uploading, you can choose:'],
      ['   Mode A: Fill Missing Fields Only', 'Updates only blank/null database fields. Existing populated values are preserved.'],
      ['   Mode B: Update Selected Fields', 'Only the fields you explicitly check will be updated. Unchecked fields are untouched.'],
      ['5. Blank Cells', 'Blank cells in your file will NOT overwrite existing database values unless explicitly requested.'],
      ['6. Supported File Types', '.xlsx, .xls, .csv files are supported.'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ---------------------------------------------------------------------------
  // 3. Parse Uploaded Document (Excel or CSV)
  // ---------------------------------------------------------------------------
  parseUploadedFile(fileBuffer: Buffer, originalName = ''): {
    columns: string[];
    sampleRows: any[];
    totalRows: number;
    rawRows: any[];
  } {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(fileBuffer, { type: 'buffer', cellFormula: false });
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse file: ${err.message || 'Invalid spreadsheet structure'}`);
    }

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new BadRequestException('No worksheets found in uploaded file.');
    }

    // Pick first non-empty sheet
    let sheet = wb.Sheets[wb.SheetNames[0]];
    let rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0 && wb.SheetNames.length > 1) {
      sheet = wb.Sheets[wb.SheetNames[1]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    if (rawRows.length === 0) {
      throw new BadRequestException('The uploaded sheet contains no data rows.');
    }

    // Filter completely empty rows
    const cleanedRows = rawRows.filter((row) =>
      Object.values(row).some((val) => val !== null && val !== undefined && String(val).trim() !== ''),
    );

    if (cleanedRows.length === 0) {
      throw new BadRequestException('All rows in the spreadsheet are empty.');
    }

    // Extract all unique column headers across rows
    const columnSet = new Set<string>();
    cleanedRows.forEach((r) => Object.keys(r).forEach((k) => columnSet.add(k.trim())));
    const columns = Array.from(columnSet).filter(Boolean);

    return {
      columns,
      sampleRows: cleanedRows.slice(0, 5),
      totalRows: cleanedRows.length,
      rawRows: cleanedRows,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Preview Mass Update with Matching & Two Modes
  // ---------------------------------------------------------------------------
  async previewMassUpdate(
    type: string,
    payload: {
      rows: any[];
      identifierColumn: string;
      fieldMappings: Record<string, string>;
      updateMode: UpdateMode;
      selectedFields?: string[];
      allowClearValues?: boolean;
    },
    tenantId: string,
  ): Promise<MassUpdatePreviewResult> {
    const config = this.getModuleConfig(type);
    const { rows, identifierColumn, fieldMappings, updateMode } = payload;
    const selectedFields = payload.selectedFields || [];
    const allowClearValues = !!payload.allowClearValues;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No rows provided for preview.');
    }
    if (!identifierColumn) {
      throw new BadRequestException('Identifier column mapping is required for matching existing records.');
    }

    // Fetch existing records for this tenant
    const existingRecords = await this.fetchExistingRecords(config, tenantId);

    // Build lookup maps by primary identifier and alternate identifiers
    const primaryMap = new Map<string, any>();
    const altMaps: Map<string, Map<string, any>> = new Map();

    if (config.alternateIdentifiers) {
      for (const alt of config.alternateIdentifiers) {
        altMaps.set(alt, new Map<string, any>());
      }
    }

    for (const rec of existingRecords) {
      const primaryKey = String(rec[config.recordIdentifierField] || '').trim().toLowerCase();
      if (primaryKey) primaryMap.set(primaryKey, rec);

      if (config.alternateIdentifiers) {
        for (const alt of config.alternateIdentifiers) {
          const altVal = String(rec[alt] || '').trim().toLowerCase();
          if (altVal) altMaps.get(alt)?.set(altVal, rec);
        }
      }
    }

    const previewRows: MassUpdateRowPreview[] = [];
    const validationErrors: Array<{ rowNumber: number; identifier: string; field: string; message: string }> = [];
    const seenFileIdentifiers = new Set<string>();

    let matchedCount = 0;
    let unmatchedCount = 0;
    let duplicateCount = 0;
    let ambiguousCount = 0;
    let invalidCount = 0;
    let changedCount = 0;
    let noChangeCount = 0;
    let readyCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // 1-based, assuming header is row 1
      const rawId = sanitizeCellValue(row[identifierColumn]);
      const identifier = String(rawId || '').trim();

      const errors: string[] = [];
      const warnings: string[] = [];
      let matchStatus: MatchStatus = 'UNMATCHED';
      let existingRecord: any = null;

      if (!identifier) {
        matchStatus = 'UNMATCHED';
        errors.push(`Missing value in matching column '${identifierColumn}'.`);
      } else {
        const idLower = identifier.toLowerCase();

        // Duplicate check in file
        if (seenFileIdentifiers.has(idLower)) {
          matchStatus = 'DUPLICATE';
          errors.push(`Duplicate identifier '${identifier}' found in uploaded file.`);
          duplicateCount++;
        } else {
          seenFileIdentifiers.add(idLower);

          // Attempt match on primary identifier
          if (primaryMap.has(idLower)) {
            existingRecord = primaryMap.get(idLower);
            matchStatus = 'MATCHED';
          } else {
            // Attempt match on alternate identifiers if configured
            let altMatchFound = false;
            if (config.alternateIdentifiers) {
              for (const alt of config.alternateIdentifiers) {
                const map = altMaps.get(alt);
                if (map && map.has(idLower)) {
                  existingRecord = map.get(idLower);
                  matchStatus = 'MATCHED';
                  altMatchFound = true;
                  warnings.push(`Matched by alternate field (${alt}).`);
                  break;
                }
              }
            }
            if (!altMatchFound) {
              matchStatus = 'UNMATCHED';
              errors.push(`Record '${identifier}' not found in database for current tenant.`);
              unmatchedCount++;
            }
          }
        }
      }

      const changes: FieldChangeDetail[] = [];
      let rowHasInvalidField = false;

      // If matched, compute proposed changes and validate fields
      if (matchStatus === 'MATCHED' && existingRecord) {
        matchedCount++;

        for (const [colName, targetFieldKey] of Object.entries(fieldMappings)) {
          if (!targetFieldKey || targetFieldKey === '__SKIP__' || targetFieldKey === '__IDENTIFIER__') {
            continue;
          }

          const fieldDef = config.fields.find((f) => f.key === targetFieldKey);
          if (!fieldDef) continue;

          const rawUploadedVal = sanitizeCellValue(row[colName]);
          const currentDbVal = existingRecord[fieldDef.key];

          const { proposedVal, status, reason, validationError } = this.evaluateFieldChange(
            fieldDef,
            currentDbVal,
            rawUploadedVal,
            updateMode,
            selectedFields,
            allowClearValues,
          );

          if (validationError) {
            rowHasInvalidField = true;
            errors.push(`Field '${fieldDef.label}': ${validationError}`);
            validationErrors.push({
              rowNumber,
              identifier,
              field: fieldDef.label,
              message: validationError,
            });
          }

          changes.push({
            field: fieldDef.key,
            fieldLabel: fieldDef.label,
            oldValue: currentDbVal ?? null,
            newValue: rawUploadedVal !== '' ? rawUploadedVal : null,
            proposedValue: proposedVal,
            status,
            reason,
          });
        }
      }

      const validationStatus: ValidationStatus =
        matchStatus === 'MATCHED' && !rowHasInvalidField && errors.length === 0 ? 'VALID' : 'INVALID';

      if (matchStatus === 'MATCHED') {
        if (validationStatus === 'INVALID') {
          invalidCount++;
        } else {
          const willUpdateChanges = changes.filter((c) => c.status === 'WILL_UPDATE');
          if (willUpdateChanges.length > 0) {
            changedCount++;
            readyCount++;
          } else {
            noChangeCount++;
          }
        }
      }

      const recordName = existingRecord
        ? String(existingRecord[config.displayNameField] || existingRecord.id || identifier)
        : identifier;

      previewRows.push({
        rowNumber,
        identifier: identifier || `Row ${rowNumber}`,
        recordName,
        matchStatus,
        validationStatus,
        errors,
        warnings,
        changes,
        willUpdateCount: changes.filter((c) => c.status === 'WILL_UPDATE').length,
        skippedCount: changes.filter((c) => c.status !== 'WILL_UPDATE').length,
      });
    }

    const summary: MassUpdateSummary = {
      totalRows: rows.length,
      matchedCount,
      unmatchedCount,
      duplicateCount,
      ambiguousCount,
      invalidCount,
      changedCount,
      noChangeCount,
      readyCount,
    };

    return {
      module: config.id,
      updateMode,
      identifierColumn,
      summary,
      rows: previewRows,
      validationErrors,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Field Evaluation Logic (Modes A & B)
  // ---------------------------------------------------------------------------
  private evaluateFieldChange(
    fieldDef: { key: string; label: string; type: string; enumValues?: string[] },
    currentDbVal: any,
    uploadedVal: any,
    updateMode: UpdateMode,
    selectedFields: string[],
    allowClearValues: boolean,
  ): {
    proposedVal: any;
    status: import('./mass-update.types').FieldChangeStatus;
    reason?: string;
    validationError?: string;
  } {
    const isDbEmpty =
      currentDbVal === null ||
      currentDbVal === undefined ||
      (typeof currentDbVal === 'string' && currentDbVal.trim() === '');

    const isUploadedBlank =
      uploadedVal === null ||
      uploadedVal === undefined ||
      (typeof uploadedVal === 'string' && uploadedVal.trim() === '');

    // Format & validate uploaded value if present
    let formattedVal = uploadedVal;
    let validationError: string | undefined;

    if (!isUploadedBlank) {
      if (fieldDef.type === 'email') {
        const emailStr = String(uploadedVal).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
          validationError = `Invalid email address format ('${uploadedVal}').`;
        } else {
          formattedVal = emailStr;
        }
      } else if (fieldDef.type === 'phone') {
        const phoneStr = String(uploadedVal).replace(/[^\d+]/g, '');
        if (phoneStr.length < 7 || phoneStr.length > 16) {
          validationError = `Invalid phone number ('${uploadedVal}'). Must contain between 7 and 16 digits.`;
        } else {
          formattedVal = phoneStr;
        }
      } else if (fieldDef.type === 'date') {
        const parsedDate = parseExcelDate(uploadedVal);
        if (!parsedDate) {
          validationError = `Invalid date format ('${uploadedVal}'). Expected YYYY-MM-DD or valid spreadsheet date.`;
        } else {
          formattedVal = parsedDate;
        }
      } else if (fieldDef.type === 'number') {
        const num = Number(uploadedVal);
        if (isNaN(num)) {
          validationError = `Value must be a valid numeric value ('${uploadedVal}').`;
        } else {
          formattedVal = num;
        }
      } else if (fieldDef.type === 'boolean') {
        const lower = String(uploadedVal).toLowerCase().trim();
        if (['true', '1', 'yes', 'y'].includes(lower)) {
          formattedVal = true;
        } else if (['false', '0', 'no', 'n'].includes(lower)) {
          formattedVal = false;
        } else {
          validationError = `Boolean field requires true/false, yes/no, or 1/0.`;
        }
      } else if (fieldDef.type === 'enum' && fieldDef.enumValues) {
        const upper = String(uploadedVal).trim().toUpperCase();
        if (!fieldDef.enumValues.includes(upper)) {
          validationError = `Value '${uploadedVal}' is not valid. Allowed options: ${fieldDef.enumValues.join(', ')}.`;
        } else {
          formattedVal = upper;
        }
      }
    }

    // MODE A: Fill Missing Fields Only
    if (updateMode === 'fill_missing') {
      if (!isDbEmpty) {
        return {
          proposedVal: currentDbVal,
          status: 'SKIPPED_EXISTING',
          reason: 'Database field already contains a populated value.',
        };
      }
      if (isUploadedBlank) {
        return {
          proposedVal: currentDbVal,
          status: 'SKIPPED_BLANK',
          reason: 'Uploaded cell is blank.',
        };
      }
      return {
        proposedVal: formattedVal,
        status: 'WILL_UPDATE',
        reason: 'Missing database field will be populated.',
        validationError,
      };
    }

    // MODE B: Selective Overwrite
    if (updateMode === 'selective_overwrite') {
      const isSelected = selectedFields.includes(fieldDef.key);
      if (!isSelected) {
        return {
          proposedVal: currentDbVal,
          status: 'SKIPPED_NOT_SELECTED',
          reason: 'Field was not selected for update.',
        };
      }

      if (isUploadedBlank) {
        if (allowClearValues) {
          return {
            proposedVal: null,
            status: 'WILL_UPDATE',
            reason: 'Existing value will be cleared as requested.',
          };
        }
        return {
          proposedVal: currentDbVal,
          status: 'SKIPPED_BLANK',
          reason: 'Uploaded cell is blank (clear values is disabled).',
        };
      }

      // Check if values are identical
      const isSame =
        String(currentDbVal ?? '').trim().toLowerCase() === String(formattedVal ?? '').trim().toLowerCase();

      if (isSame) {
        return {
          proposedVal: currentDbVal,
          status: 'UNCHANGED',
          reason: 'Uploaded value is identical to current database value.',
        };
      }

      return {
        proposedVal: formattedVal,
        status: 'WILL_UPDATE',
        reason: 'Selected field will be overwritten with uploaded value.',
        validationError,
      };
    }

    return {
      proposedVal: currentDbVal,
      status: 'UNCHANGED',
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Execute Mass Update Commit (Prisma Transaction + Audit Logging)
  // ---------------------------------------------------------------------------
  async commitMassUpdate(
    type: string,
    payload: MassUpdateCommitPayload,
    actorUserId: number | undefined,
    tenantId: string,
  ): Promise<MassUpdateExecutionResult> {
    const config = this.getModuleConfig(type);
    const operationId = `MUP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // Re-run preview to obtain deterministic validated rows
    const previewRes = await this.previewMassUpdate(type, payload, tenantId);

    const validReadyRows = previewRes.rows.filter(
      (r) => r.matchStatus === 'MATCHED' && r.validationStatus === 'VALID' && r.willUpdateCount > 0,
    );

    if (validReadyRows.length === 0) {
      throw new BadRequestException('No valid records with pending changes to commit.');
    }

    const executionDetails: MassUpdateExecutionResult['details'] = [];
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = previewRes.rows.length - validReadyRows.length;

    // Collect non-ready rows for the execution report
    for (const row of previewRes.rows) {
      if (row.matchStatus !== 'MATCHED' || row.validationStatus !== 'VALID' || row.willUpdateCount === 0) {
        executionDetails.push({
          rowNumber: row.rowNumber,
          identifier: row.identifier,
          recordName: row.recordName,
          matchStatus: row.matchStatus,
          updateStatus: 'SKIPPED',
          fieldsUpdated: [],
          fieldsSkipped: row.changes.map((c) => c.fieldLabel),
          errorReason: row.errors.join('; ') || 'No fields eligible for update in selected mode.',
        });
      }
    }

    // Execute database updates inside a Prisma transaction
    await this.prisma.$transaction(
      async (tx) => {
        for (const row of validReadyRows) {
          try {
            const dataToUpdate: Record<string, any> = {};
            const oldValuesObj: Record<string, any> = {};
            const newValuesObj: Record<string, any> = {};
            const updatedFieldLabels: string[] = [];
            const skippedFieldLabels: string[] = [];

            for (const change of row.changes) {
              if (change.status === 'WILL_UPDATE') {
                let finalVal = change.proposedValue;
                // Convert date string back to Date object for Prisma DateTime fields
                const fieldConfig = config.fields.find((f) => f.key === change.field);
                if (fieldConfig?.type === 'date' && typeof finalVal === 'string' && finalVal) {
                  finalVal = new Date(finalVal);
                }
                dataToUpdate[change.field] = finalVal;
                oldValuesObj[change.field] = change.oldValue;
                newValuesObj[change.field] = change.proposedValue;
                updatedFieldLabels.push(change.fieldLabel);
              } else {
                skippedFieldLabels.push(change.fieldLabel);
              }
            }

            if (Object.keys(dataToUpdate).length > 0) {
              // Apply model-specific update
              await this.applyModelUpdate(tx, config, row.identifier, dataToUpdate, tenantId);

              // Log individual record audit
              await this.auditService.log({
                actorUserId: actorUserId || null,
                action: 'MASS_UPDATE_RECORD',
                entityType: config.modelName,
                entityId: row.identifier,
                oldValues: oldValuesObj,
                newValues: newValuesObj,
                tenantId,
              });

              updatedCount++;
              executionDetails.push({
                rowNumber: row.rowNumber,
                identifier: row.identifier,
                recordName: row.recordName,
                matchStatus: row.matchStatus,
                updateStatus: 'UPDATED',
                fieldsUpdated: updatedFieldLabels,
                fieldsSkipped: skippedFieldLabels,
              });
            }
          } catch (err: any) {
            failedCount++;
            skippedCount++;
            this.logger.error(`Failed to update record ${row.identifier}: ${err.message}`);
            executionDetails.push({
              rowNumber: row.rowNumber,
              identifier: row.identifier,
              recordName: row.recordName,
              matchStatus: row.matchStatus,
              updateStatus: 'FAILED',
              fieldsUpdated: [],
              fieldsSkipped: row.changes.map((c) => c.fieldLabel),
              errorReason: err.message || 'Database update error',
            });
          }
        }
      },
      { timeout: 30000 },
    );

    const timestamp = new Date().toISOString();
    const result: MassUpdateExecutionResult = {
      operationId,
      module: config.id,
      updateMode: payload.updateMode,
      totalRows: payload.rows.length,
      matchedCount: previewRes.summary.matchedCount,
      updatedCount,
      skippedCount,
      failedCount,
      timestamp,
      message: `Mass update completed: ${updatedCount} records updated, ${skippedCount} skipped, ${failedCount} failed.`,
      details: executionDetails.sort((a, b) => a.rowNumber - b.rowNumber),
    };

    // Save report in memory store
    this.reportsStore.set(operationId, result);

    // Save master batch audit record
    await this.auditService.log({
      actorUserId: actorUserId || null,
      action: 'MASS_UPDATE_EXECUTE',
      entityType: 'MASS_UPDATE_BATCH',
      entityId: operationId,
      newValues: {
        operationId,
        fileName: payload.fileName || 'unknown.xlsx',
        module: config.id,
        updateMode: payload.updateMode,
        totalRows: payload.rows.length,
        matchedCount: previewRes.summary.matchedCount,
        updatedCount,
        skippedCount,
        failedCount,
        timestamp,
      },
      tenantId,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // 7. Dynamic Model Updater with Tenant Scoping
  // ---------------------------------------------------------------------------
  private async applyModelUpdate(
    tx: any,
    config: SupportedModuleConfig,
    identifier: string,
    data: Record<string, any>,
    tenantId: string,
  ) {
    const idLower = identifier.trim().toLowerCase();

    switch (config.id) {
      case 'employees': {
        const existing = await tx.employee.findFirst({
          where: {
            tenantId,
            OR: [
              { id: { equals: identifier, mode: 'insensitive' } },
              { email: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) throw new Error(`Employee ${identifier} not found in tenant.`);
        return tx.employee.update({ where: { id: existing.id }, data });
      }

      case 'customers': {
        const existing = await tx.company.findFirst({
          where: {
            tenantId,
            OR: [
              { id: { equals: identifier, mode: 'insensitive' } },
              { primaryEmail: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) throw new Error(`Customer ${identifier} not found in tenant.`);
        return tx.company.update({ where: { id: existing.id }, data });
      }

      case 'products': {
        const existing = await tx.product.findFirst({
          where: {
            tenantId,
            OR: [
              { code: { equals: identifier, mode: 'insensitive' } },
              { id: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) throw new Error(`Product ${identifier} not found in tenant.`);
        return tx.product.update({ where: { id: existing.id }, data });
      }

      case 'departments': {
        const existing = await tx.department.findFirst({
          where: {
            tenantId,
            OR: [
              { code: { equals: identifier, mode: 'insensitive' } },
              { id: { equals: identifier, mode: 'insensitive' } },
              { name: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) throw new Error(`Department ${identifier} not found in tenant.`);
        return tx.department.update({ where: { id: existing.id }, data });
      }

      case 'tickets': {
        const existing = await tx.ticket.findFirst({
          where: {
            tenantId,
            id: { equals: identifier, mode: 'insensitive' },
          },
        });
        if (!existing) throw new Error(`Ticket ${identifier} not found in tenant.`);
        return tx.ticket.update({ where: { id: existing.id }, data });
      }

      case 'branches': {
        const existing = await tx.companyBranch.findFirst({
          where: {
            company: { tenantId },
            id: { equals: identifier, mode: 'insensitive' },
          },
        });
        if (!existing) throw new Error(`Branch ${identifier} not found in tenant.`);
        return tx.companyBranch.update({ where: { id: existing.id }, data });
      }

      case 'prospects': {
        const existing = await tx.prospect.findFirst({
          where: {
            tenantId,
            OR: [
              { id: { equals: identifier, mode: 'insensitive' } },
              { email: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) throw new Error(`Prospect ${identifier} not found in tenant.`);
        return tx.prospect.update({ where: { id: existing.id }, data });
      }

      case 'subscriptions': {
        const existing = await tx.subscription.findFirst({
          where: {
            tenantId,
            id: { equals: identifier, mode: 'insensitive' },
          },
        });
        if (!existing) throw new Error(`Subscription ${identifier} not found in tenant.`);
        return tx.subscription.update({ where: { id: existing.id }, data });
      }

      case 'implementations': {
        const existing = await tx.implementation.findFirst({
          where: {
            tenantId,
            id: { equals: identifier, mode: 'insensitive' },
          },
        });
        if (!existing) throw new Error(`Implementation ${identifier} not found in tenant.`);
        return tx.implementation.update({ where: { id: existing.id }, data });
      }

      default:
        throw new Error(`Unsupported module '${config.id}'.`);
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Fetch Tenant-Scoped Records for Matching
  // ---------------------------------------------------------------------------
  private async fetchExistingRecords(config: SupportedModuleConfig, tenantId: string): Promise<any[]> {
    switch (config.id) {
      case 'employees':
        return this.prisma.employee.findMany({ where: { tenantId } });
      case 'customers':
        return this.prisma.company.findMany({ where: { tenantId } });
      case 'products':
        return this.prisma.product.findMany({ where: { tenantId } });
      case 'departments':
        return this.prisma.department.findMany({ where: { tenantId } });
      case 'tickets':
        return this.prisma.ticket.findMany({ where: { tenantId } });
      case 'branches':
        return this.prisma.companyBranch.findMany({ where: { company: { tenantId } } });
      case 'prospects':
        return this.prisma.prospect.findMany({ where: { tenantId } });
      case 'subscriptions':
        return this.prisma.subscription.findMany({ where: { tenantId } });
      case 'implementations':
        return this.prisma.implementation.findMany({ where: { tenantId } });
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Mass Update History Retrieval
  // ---------------------------------------------------------------------------
  async getMassUpdateHistory(tenantId: string): Promise<MassUpdateHistoryItem[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: 'MASS_UPDATE_EXECUTE',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        actor: {
          select: { id: true, email: true },
        },
      },
    });

    return logs.map((log) => {
      let meta: any = {};
      try {
        meta = JSON.parse(log.newValuesJson || '{}');
      } catch {}

      const total = meta.totalRows || 0;
      const updated = meta.updatedCount || 0;
      const failed = meta.failedCount || 0;
      let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
      if (failed > 0 && updated > 0) status = 'PARTIAL';
      else if (failed > 0 && updated === 0) status = 'FAILED';

      return {
        operationId: log.entityId || meta.operationId || `OP-${log.id}`,
        fileName: meta.fileName || 'Spreadsheet',
        module: meta.module || 'records',
        updateMode: meta.updateMode || 'fill_missing',
        actorUserId: log.actorUserId,
        actorEmail: log.actor?.email,
        tenantId: log.tenantId,
        totalRows: total,
        updatedCount: updated,
        skippedCount: meta.skippedCount || 0,
        failedCount: failed,
        status,
        createdAt: log.createdAt.toISOString(),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Generate Downloadable Result Report (.xlsx)
  // ---------------------------------------------------------------------------
  generateResultReport(operationId: string): { buffer: Buffer; fileName: string } {
    const report = this.reportsStore.get(operationId);

    const wb = XLSX.utils.book_new();
    const rowsData: any[][] = [
      ['Row #', 'Identifier', 'Record Name', 'Match Status', 'Update Status', 'Fields Updated', 'Fields Skipped', 'Error / Reason'],
    ];

    if (report && report.details && report.details.length > 0) {
      for (const d of report.details) {
        rowsData.push([
          d.rowNumber,
          d.identifier,
          d.recordName,
          d.matchStatus,
          d.updateStatus,
          d.fieldsUpdated.join(', ') || 'None',
          d.fieldsSkipped.join(', ') || 'None',
          d.errorReason || '',
        ]);
      }
    } else {
      rowsData.push(['-', operationId, 'Mass Update Operation', 'COMPLETED', 'RECORDED', 'In Audit Log', 'None', 'Details archived in database audit log.']);
    }

    const ws = XLSX.utils.aoa_to_sheet(rowsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Mass Update Results');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer,
      fileName: `mass_update_report_${operationId}.xlsx`,
    };
  }
}

