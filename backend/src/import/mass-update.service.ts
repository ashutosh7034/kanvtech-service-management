import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateUnifiedCustomerWorkbook } from './customer-template.generator';
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
  EntitlementAction,
  EntitlementUpdateMode,
  EntitlementRowPreview,
  EntitlementPreviewSummary,
  EntitlementPreviewResult,
  EntitlementCommitPayload,
  EntitlementExecutionResult,
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
          { key: 'address', label: 'Office Address', type: 'string', isRequired: false, description: 'Full business address', exampleValue: 'Plot 42, MIDC Industrial Area, Pune 411018' },
          { key: 'gstn', label: 'GSTN / Tax ID', type: 'string', isRequired: false, description: '15-character GST identification', exampleValue: '27AABCA1234F1Z5' },
          { key: 'primaryEmail', label: 'Primary Email', type: 'email', isRequired: false, description: 'Corporate contact email', exampleValue: 'accounts@acme.com' },
          { key: 'alternateEmails', label: 'Alternate Emails', type: 'string', isRequired: false, description: 'Secondary billing or escalation emails', exampleValue: 'ops@acme.com, billing@acme.com' },
          { key: 'contactPerson', label: 'Primary Contact Person', type: 'string', isRequired: false, description: 'Key relationship manager', exampleValue: 'Suresh Patil' },
          { key: 'contactPhone', label: 'Primary Contact Phone', type: 'phone', isRequired: false, description: 'Direct contact phone', exampleValue: '+919822012345' },
          { key: 'contactAddress', label: 'Contact Location', type: 'string', isRequired: false, description: 'Branch or desk location', exampleValue: 'Floor 3, Building B, Pune Hub' },
          { key: 'contactStatus', label: 'Contact Status', type: 'enum', enumValues: ['ACTIVE', 'VERIFIED', 'PENDING', 'INACTIVE'], isRequired: false, description: 'Contact verification status', exampleValue: 'VERIFIED' },
          { key: 'alternateContact', label: 'Alternate Contact Person', type: 'string', isRequired: false, description: 'Backup contact name', exampleValue: 'Pooja Mehta' },
          { key: 'alternateContactPhone', label: 'Alternate Contact Phone', type: 'phone', isRequired: false, description: 'Backup phone', exampleValue: '+919822099999' },
          { key: 'alternateContactEmail', label: 'Alternate Contact Email', type: 'email', isRequired: false, description: 'Backup email', exampleValue: 'pooja@acme.com' },
          { key: 'alternateContactAddress', label: 'Alternate Contact Location / Address', type: 'string', isRequired: false, description: 'Location or branch office address of alternate contact', exampleValue: 'Pune Regional Operations Centre, Hinjewadi Phase 1' },
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
      {
        id: 'customer_entitlements',
        label: 'Product & Module Entitlements',
        modelName: 'CompanyProduct',
        templateName: 'Product Entitlements',
        recordIdentifierField: 'customerId',
        recordIdentifierLabel: 'Customer ID',
        alternateIdentifiers: ['companyName'],
        displayNameField: 'customerName',
        fields: [
          { key: 'companyName', label: 'Company Name', type: 'string', isRequired: false, description: 'Customer company name for reference', exampleValue: 'Acme Technologies Ltd' },
          { key: 'branchId', label: 'Branch ID', type: 'string', isRequired: false, description: 'Branch ID (e.g. BR-0001). Leave blank for Head Office / Company level.', exampleValue: 'BR-0001' },
          { key: 'branchName', label: 'Branch Name', type: 'string', isRequired: false, description: 'Branch name for reference', exampleValue: 'Pune Branch' },
          { key: 'productId', label: 'Product ID', type: 'string', isRequired: true, description: 'Product ID or Product Code (e.g. PROD-0001 or TALLY)', exampleValue: 'PROD-0001' },
          { key: 'productName', label: 'Product Name', type: 'string', isRequired: false, description: 'Product name for reference', exampleValue: 'Tally ERP' },
          { key: 'moduleId', label: 'Module ID', type: 'string', isRequired: false, description: 'Module ID (e.g. MOD-TALLY-ACC). Leave blank for product-level.', exampleValue: 'MOD-TALLY-ACC' },
          { key: 'moduleName', label: 'Module Name', type: 'string', isRequired: false, description: 'Module name for reference', exampleValue: 'Accounting' },
          { key: 'submoduleId', label: 'Sub-Module ID', type: 'string', isRequired: false, description: 'Submodule ID (e.g. SUB-TALLY-LED). Leave blank if not applicable.', exampleValue: 'SUB-TALLY-LED' },
          { key: 'submoduleName', label: 'Sub-Module Name', type: 'string', isRequired: false, description: 'Submodule name for reference', exampleValue: 'Ledger' },
          { key: 'action', label: 'Action', type: 'enum', enumValues: ['ADD', 'UPDATE', 'REMOVE', 'ENABLE', 'DISABLE'], isRequired: true, description: 'Operation: ADD, UPDATE, REMOVE, ENABLE, DISABLE', exampleValue: 'ADD' },
          { key: 'status', label: 'Status', type: 'enum', enumValues: ['ENABLED', 'DISABLED', 'ACTIVE', 'INACTIVE'], isRequired: true, description: 'Status: ENABLED or DISABLED', exampleValue: 'ENABLED' },
        ],
      },
    ];
  }

  getModuleConfig(type: string): SupportedModuleConfig {
    const normalized = type.toLowerCase().trim();
    const config = this.getSupportedModules().find(
      (m) =>
        m.id === normalized ||
        (normalized === 'companies' && m.id === 'customers') ||
        (normalized === 'entitlements' && m.id === 'customer_entitlements') ||
        (normalized === 'product_entitlements' && m.id === 'customer_entitlements'),
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
    if (config.id === 'customers' || config.id === 'customer_entitlements') {
      return generateUnifiedCustomerWorkbook();
    }
    const wb = XLSX.utils.book_new();

    if (config.id === 'customers' || config.id === 'customer_entitlements') {
      // 1. Customers Update sheet
      const customerHeaders = [
        'Customer ID',
        'Company Name',
        'Office Address',
        'GSTN / Tax ID',
        'Primary Email',
        'Alternate Emails',
        'Primary Contact Person',
        'Primary Contact Phone',
        'Contact Location',
        'Contact Status',
        'Alternate Contact Person',
        'Alternate Contact Phone',
        'Alternate Contact Email',
        'Alternate Contact Location / Address',
        'Is Active',
      ];
      const customerSampleRow = [
        'CMP-0001',
        'Acme Technologies Pvt Ltd',
        'Plot 42, MIDC Industrial Area, Pune 411018',
        '27AABCA1234F1Z5',
        'accounts@acme.com',
        'ops@acme.com',
        'Suresh Patel',
        '9822012345',
        'Floor 3, Block B',
        'VERIFIED',
        'Pooja Mehta',
        '9822099999',
        'pooja@acme.com',
        'Floor 2, Block A',
        'true',
      ];
      const wsCustomers = XLSX.utils.aoa_to_sheet([customerHeaders, customerSampleRow]);
      wsCustomers['!cols'] = [
        { wch: 18 }, // Customer ID
        { wch: 32 }, // Company Name
        { wch: 45 }, // Office Address
        { wch: 22 }, // GSTN / Tax ID
        { wch: 30 }, // Primary Email
        { wch: 30 }, // Alternate Emails
        { wch: 26 }, // Primary Contact Person
        { wch: 24 }, // Primary Contact Phone
        { wch: 22 }, // Contact Location
        { wch: 20 }, // Contact Status
        { wch: 26 }, // Alternate Contact Person
        { wch: 24 }, // Alternate Contact Phone
        { wch: 30 }, // Alternate Contact Email
        { wch: 38 }, // Alternate Contact Location / Address
        { wch: 14 }, // Is Active
      ];
      wsCustomers['!rows'] = [{ hpt: 28 }, { hpt: 20 }];
      wsCustomers['!autofilter'] = { ref: 'A1:O2' };
      wsCustomers['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2', showGridLines: true }];
      (wsCustomers as any)['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
      XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customers Update');

      // 2. Product Entitlements sheet
      const entitlementHeaders = [
        'Customer ID',
        'Company Name',
        'Branch ID',
        'Branch Name',
        'Product ID',
        'Product Name',
        'Module ID',
        'Module Name',
        'Sub-Module ID',
        'Sub-Module Name',
        'Action',
        'Status',
      ];
      const entitlementSampleRows = [
        ['CMP-0001', 'Acme Technologies Pvt Ltd', '', '', 'PROD-0001', 'Tally Prime ERP', 'MOD-TALLY-ACC', 'Accounting & Finance', 'SUB-TALLY-LED', 'Ledger Management', 'ADD', 'ACTIVE'],
        ['CMP-0001', 'Acme Technologies Pvt Ltd', '', '', 'PROD-0001', 'Tally Prime ERP', 'MOD-TALLY-ACC', 'Accounting & Finance', 'SUB-TALLY-VOU', 'Voucher Management', 'ADD', 'ACTIVE'],
        ['CMP-0001', 'Acme Technologies Pvt Ltd', '', '', 'PROD-0001', 'Tally Prime ERP', 'MOD-TALLY-INV', 'Inventory Management', '', '', 'ADD', 'ACTIVE'],
        ['CMP-0001', 'Acme Technologies Pvt Ltd', 'BR-0001', 'Mumbai Branch', 'PROD-0001', 'Tally Prime ERP', 'MOD-TALLY-ACC', 'Accounting & Finance', 'SUB-TALLY-LED', 'Ledger Management', 'ADD', 'ACTIVE'],
        ['CMP-0001', 'Acme Technologies Pvt Ltd', '', '', 'PROD-0002', 'Spine HRMS', 'MOD-SPINE-PAY', 'Payroll Processing', '', '', 'UPDATE', 'INACTIVE'],
        ['CMP-0001', 'Acme Technologies Pvt Ltd', '', '', 'PROD-0003', 'BioStar Attendance', '', '', '', '', 'REMOVE', ''],
      ];
      const wsEntitlements = XLSX.utils.aoa_to_sheet([entitlementHeaders, ...entitlementSampleRows]);
      wsEntitlements['!cols'] = [
        { wch: 18 }, // Customer ID
        { wch: 32 }, // Company Name
        { wch: 18 }, // Branch ID
        { wch: 25 }, // Branch Name
        { wch: 18 }, // Product ID
        { wch: 28 }, // Product Name
        { wch: 22 }, // Module ID
        { wch: 28 }, // Module Name
        { wch: 22 }, // Sub-Module ID
        { wch: 28 }, // Sub-Module Name
        { wch: 16 }, // Action
        { wch: 16 }, // Status
      ];
      wsEntitlements['!rows'] = [
        { hpt: 28 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 20 },
        { hpt: 20 },
      ];
      wsEntitlements['!autofilter'] = { ref: 'A1:L7' };
      wsEntitlements['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2', showGridLines: true }];
      (wsEntitlements as any)['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
      XLSX.utils.book_append_sheet(wb, wsEntitlements, 'Product Entitlements');

      // 3. Instructions sheet
      const customerInstructions: any[][] = [
        ['KANVTECH SERVICE MANAGEMENT — CUSTOMER PROFILE & PRODUCT ENTITLEMENT MASS UPDATE GUIDE'],
        [''],
        ['OVERVIEW'],
        ['This workbook contains two primary update sheets:'],
        ['1. "Customers Update": Use this sheet to update core customer master profile fields (addresses, contacts, GSTN, status).'],
        ['2. "Product Entitlements": Use this sheet to map, update, or remove Product, Module, and Sub-Module assignments for customers and branches.'],
        [''],
        ['-----------------------------------------------------------------------------------------------------------------'],
        ['SHEET 2: PRODUCT ENTITLEMENTS SPECIFICATIONS & RULES'],
        ['-----------------------------------------------------------------------------------------------------------------'],
        ['Column Name', 'Required / Optional', 'Allowed Values / Examples', 'Description'],
        ['Customer ID', 'REQUIRED', 'CMP-0001 (or numeric 1)', 'Customer unique identifier in Kanvtech Platform'],
        ['Company Name', 'OPTIONAL', 'Acme Technologies Pvt Ltd', 'Company name for human reference / readability'],
        ['Branch ID', 'OPTIONAL', 'BR-0001 (Leave empty for Head Office)', 'Branch identifier. If blank or "Head Office", applies to company-level product.'],
        ['Branch Name', 'OPTIONAL', 'Mumbai Branch', 'Branch name for human reference'],
        ['Product ID', 'REQUIRED', 'PROD-0001 or Product Code (e.g. TALLY)', 'Master Product identifier or code'],
        ['Product Name', 'OPTIONAL', 'Tally Prime ERP', 'Product name for human reference'],
        ['Module ID', 'OPTIONAL', 'MOD-TALLY-ACC', 'Module ID. If omitted, applies to entire product.'],
        ['Module Name', 'OPTIONAL', 'Accounting & Finance', 'Module name for human reference'],
        ['Sub-Module ID', 'OPTIONAL', 'SUB-TALLY-LED', 'Sub-Module ID. Must belong to the specified Module.'],
        ['Sub-Module Name', 'OPTIONAL', 'Ledger Management', 'Sub-module name for human reference'],
        ['Action', 'REQUIRED', 'ADD, UPDATE, REMOVE, ENABLE, DISABLE', 'ADD: Assign new entitlement; UPDATE: Update status; REMOVE: Delete entitlement; ENABLE/DISABLE: Quick status toggle.'],
        ['Status', 'CONDITIONAL', 'ACTIVE, INACTIVE', 'Required for ADD/UPDATE. ACTIVE or INACTIVE.'],
        [''],
        ['HIERARCHY & VALIDATION RULES:'],
        ['1. Product Existence:', 'Product ID must exist in Kanvtech Product Master.'],
        ['2. Module Hierarchy:', 'Module ID must belong to the specified Product ID.'],
        ['3. Sub-Module Hierarchy:', 'Sub-Module ID must belong to the specified Module ID.'],
        ['4. Branch Prerequisite:', 'A Branch can ONLY be assigned products/modules if the parent Customer already has the product active.'],
        ['5. Tenant Isolation:', 'You can only update customers and branches belonging to your assigned tenant.'],
        [''],
        ['TWO UPDATE MODES:'],
        ['Mode A: Selective Entitlement Update', 'Only processes the explicit rows listed in the uploaded spreadsheet. Unlisted customer products and modules remain unchanged.'],
        ['Mode B: Full Entitlement Synchronization', 'Synchronizes customer entitlements to match the spreadsheet. Any active product/module on affected customers not listed in the sheet is flagged for deactivation.'],
      ];
      const wsInstructions = XLSX.utils.aoa_to_sheet(customerInstructions);
      wsInstructions['!cols'] = [
        { wch: 28 },
        { wch: 22 },
        { wch: 38 },
        { wch: 65 },
      ];
      wsInstructions['!views'] = [{ state: 'frozen', ySplit: 10, xSplit: 0, showGridLines: true }];
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    // Data worksheet for other entity types
    const headers = [config.recordIdentifierLabel, ...config.fields.map((f) => f.label)];
    const sampleRow1 = [
      'EMP-001',
      ...config.fields.map((f) => f.exampleValue || ''),
    ];
    if (config.id === 'products') sampleRow1[0] = 'PROD-0001';
    if (config.id === 'departments') sampleRow1[0] = 'DEP-0001';
    if (config.id === 'tickets') sampleRow1[0] = 'KT-2026-000001';
    if (config.id === 'branches') sampleRow1[0] = 'BR-0001';
    if (config.id === 'prospects') sampleRow1[0] = 'PROS-0001';
    if (config.id === 'subscriptions') sampleRow1[0] = 'SUB-0001';
    if (config.id === 'implementations') sampleRow1[0] = 'IMP-0001';

    const wsData = [headers, sampleRow1];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply appropriate, non-truncating column widths
    const colWidths = headers.map((h, idx) => {
      const sampleVal = String(sampleRow1[idx] || '');
      const maxLen = Math.max(h.length, sampleVal.length);
      return { wch: Math.max(maxLen + 4, 18) };
    });
    ws['!cols'] = colWidths;

    // Header row height with breathing room
    ws['!rows'] = [{ hpt: 28 }, { hpt: 20 }];

    // Auto-filter covering all columns
    const endColLetter = XLSX.utils.encode_col(headers.length - 1);
    ws['!autofilter'] = { ref: `A1:${endColLetter}2` };

    // Freeze header row so column names stay visible on vertical scroll
    ws['!views'] = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2', showGridLines: true }];
    (ws as any)['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

    XLSX.utils.book_append_sheet(wb, ws, `${config.templateName} Update`);

    // Instructions worksheet
    const instructionRows: any[][] = [
      ['KANVTECH SERVICE MANAGEMENT — MASS UPDATE & DATA COMPLETION GUIDE'],
      ['Module:', config.label],
      ['Identifier Field:', `${config.recordIdentifierLabel} (${config.recordIdentifierField})`],
      ['Total Supported Columns:', headers.length],
      [''],
      ['SECTION 1: MASS UPDATE RULES & BEST PRACTICES'],
      ['1. Purpose', 'Use this template to supplement missing fields or selectively overwrite existing customer/master records.'],
      ['2. Mandatory Identifier', `The first column (${config.recordIdentifierLabel}) MUST contain the unique identifier of the existing record (e.g. CMP-0001).`],
      ['3. No Duplicate Creation', 'This tool strictly updates existing records. Unmatched rows will be flagged and safely skipped.'],
      ['4. Two Update Modes', 'When uploading, choose your execution mode:'],
      ['   Mode A: Fill Missing Fields Only', 'Updates only blank/null database fields. Existing populated values are preserved.'],
      ['   Mode B: Selective Overwrite', 'Only the fields you explicitly check will be updated. Unchecked fields are left untouched.'],
      ['5. Blank Cells', 'Blank cells in your file will NOT overwrite existing database values unless "Allow clearing values" is enabled in Selective Overwrite.'],
      ['6. Supported File Types', '.xlsx, .xls, and .csv files are supported.'],
      [''],
      ['SECTION 2: FIELD SPECIFICATIONS & ALLOWED VALUES'],
      ['Column Name', 'Property Key', 'Data Type', 'Required for Matching', 'Allowed Values / Format', 'Description'],
      [config.recordIdentifierLabel, config.recordIdentifierField, 'string', 'YES (Unique Identifier)', 'e.g. CMP-0001', 'Unique record identifier for database matching'],
      ...config.fields.map((f) => [
        f.label,
        f.key,
        f.type,
        f.isRequired ? 'YES' : 'OPTIONAL',
        f.enumValues ? f.enumValues.join(', ') : (f.exampleValue || ''),
        f.description || '',
      ]),
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows);
    wsInstructions['!cols'] = [
      { wch: 32 },
      { wch: 28 },
      { wch: 16 },
      { wch: 22 },
      { wch: 38 },
      { wch: 55 },
    ];
    wsInstructions['!views'] = [{ state: 'frozen', ySplit: 5, xSplit: 0, showGridLines: true }];

    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ---------------------------------------------------------------------------
  // 3. Parse Uploaded Document (Excel or CSV)
  // ---------------------------------------------------------------------------
  parseUploadedFile(fileBuffer: Buffer, originalName = '', requestedSheetName?: string): {
    columns: string[];
    sampleRows: any[];
    totalRows: number;
    rawRows: any[];
    sheets?: Array<{
      name: string;
      totalRows: number;
      columns: string[];
      isEntitlementsSheet?: boolean;
    }>;
    activeSheet?: string;
    isEntitlementsSheet?: boolean;
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

    const sheetsSummary: Array<{
      name: string;
      totalRows: number;
      columns: string[];
      isEntitlementsSheet?: boolean;
    }> = [];
    const sheetDataMap = new Map<string, { rows: any[]; cols: string[]; isEntitlements: boolean }>();

    for (const sName of wb.SheetNames) {
      const lower = sName.trim().toLowerCase();
      if (lower === 'instructions' || lower.includes('guide') || lower.includes('readme')) {
        continue;
      }
      const ws = wb.Sheets[sName];
      if (!ws) continue;
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const cleaned = raw.filter((row) =>
        Object.values(row).some((val) => val !== null && val !== undefined && String(val).trim() !== '')
      );
      const colSet = new Set<string>();
      cleaned.forEach((r) => Object.keys(r).forEach((k) => colSet.add(k.trim())));
      const cols = Array.from(colSet).filter(Boolean);

      const isEnt = lower.includes('entitlement') ||
        (lower !== 'update customers' && lower !== 'customers' && cols.some((c) => /action|sub-?module|branch\s*id/i.test(c)));

      sheetsSummary.push({
        name: sName,
        totalRows: cleaned.length,
        columns: cols,
        isEntitlementsSheet: isEnt,
      });

      sheetDataMap.set(sName, { rows: cleaned, cols, isEntitlements: isEnt });
    }

    if (sheetsSummary.length === 0) {
      throw new BadRequestException('No data worksheets found in uploaded file.');
    }

    let targetSheetName = requestedSheetName && sheetDataMap.has(requestedSheetName)
      ? requestedSheetName
      : undefined;

    if (!targetSheetName) {
      const updateCustSheet = sheetsSummary.find((s) => s.name.trim().toLowerCase() === 'update customers' && s.totalRows > 0);
      if (updateCustSheet) {
        targetSheetName = updateCustSheet.name;
      } else {
        const entSheet = sheetsSummary.find((s) => s.isEntitlementsSheet && s.totalRows > 0);
        if (originalName.toLowerCase().includes('entitlement') && entSheet) {
          targetSheetName = entSheet.name;
        } else {
          const firstWithRows = sheetsSummary.find((s) => s.totalRows > 0) || sheetsSummary[0];
          targetSheetName = firstWithRows.name;
        }
      }
    }

    const selected = sheetDataMap.get(targetSheetName);
    if (!selected || selected.rows.length === 0) {
      throw new BadRequestException(`Sheet '${targetSheetName}' contains no data rows.`);
    }

    return {
      columns: selected.cols,
      sampleRows: selected.rows.slice(0, 10),
      totalRows: selected.rows.length,
      rawRows: selected.rows,
      sheets: sheetsSummary,
      activeSheet: targetSheetName,
      isEntitlementsSheet: selected.isEntitlements,
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
          const normalizedIdLower = idLower.replace(/^cmp\s+(\d+)$/i, 'cmp-$1');
          if (primaryMap.has(idLower)) {
            existingRecord = primaryMap.get(idLower);
            matchStatus = 'MATCHED';
          } else if (primaryMap.has(normalizedIdLower)) {
            existingRecord = primaryMap.get(normalizedIdLower);
            matchStatus = 'MATCHED';
            warnings.push(`Matched by normalized ID (${existingRecord.id}).`);
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
      if (fieldDef.key === 'gstn') {
        const gstnStr = String(uploadedVal).trim().toUpperCase();
        if (gstnStr.length !== 15) {
          validationError = `Invalid 15-character GSTIN format ('${uploadedVal}').`;
        } else {
          formattedVal = gstnStr;
        }
      } else if (fieldDef.key === 'alternateEmails') {
        const emailList = String(uploadedVal)
          .split(/[;,]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const invalid = emailList.find((em) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
        if (invalid) {
          validationError = `Invalid email in alternate emails ('${invalid}').`;
        } else {
          formattedVal = emailList.join(', ');
        }
      } else if (fieldDef.type === 'email') {
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
      } else if (fieldDef.type === 'string' && typeof uploadedVal === 'string') {
        formattedVal = uploadedVal.trim();
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
        const normalizedId = identifier.trim().replace(/^CMP\s+(\d+)$/i, 'CMP-$1');
        const existing = await tx.company.findFirst({
          where: {
            tenantId,
            OR: [
              { id: { equals: identifier, mode: 'insensitive' } },
              { id: { equals: normalizedId, mode: 'insensitive' } },
              { primaryEmail: { equals: identifier, mode: 'insensitive' } },
            ],
          },
        });
        if (!existing) throw new Error(`Customer '${identifier}' not found in tenant.`);

        // Duplicate checks
        if (data.companyName && data.companyName.trim().toLowerCase() !== existing.companyName.toLowerCase()) {
          const dupName = await tx.company.findFirst({
            where: {
              id: { not: existing.id },
              companyName: { equals: data.companyName.trim(), mode: 'insensitive' },
              tenantId,
            },
          });
          if (dupName) throw new Error(`Company name '${data.companyName.trim()}' is already used by customer '${dupName.id}'.`);
        }

        if (data.primaryEmail && data.primaryEmail.trim().toLowerCase() !== existing.primaryEmail.toLowerCase()) {
          const dupEmail = await tx.company.findFirst({
            where: {
              id: { not: existing.id },
              primaryEmail: { equals: data.primaryEmail.trim(), mode: 'insensitive' },
              tenantId,
            },
          });
          if (dupEmail) throw new Error(`Primary email '${data.primaryEmail.trim()}' is already used by customer '${dupEmail.id}'.`);
        }

        if (data.gstn && data.gstn !== existing.gstn) {
          const dupGstn = await tx.company.findFirst({
            where: {
              id: { not: existing.id },
              gstn: { equals: data.gstn, mode: 'insensitive' },
              tenantId,
            },
          });
          if (dupGstn) throw new Error(`GSTN '${data.gstn}' is already used by customer '${dupGstn.id}'.`);
        }

        const updatedComp = await tx.company.update({ where: { id: existing.id }, data });

        // Synchronize primary CompanyContact if primary contact fields were updated
        if (data.contactPerson !== undefined || data.primaryEmail !== undefined || data.contactPhone !== undefined) {
          const primaryContact = await tx.companyContact.findFirst({
            where: { companyId: existing.id, isPrimary: true },
          });
          if (primaryContact) {
            await tx.companyContact.update({
              where: { id: primaryContact.id },
              data: {
                name: data.contactPerson !== undefined ? data.contactPerson : undefined,
                email: data.primaryEmail !== undefined ? data.primaryEmail : undefined,
                phone: data.contactPhone !== undefined ? data.contactPhone : undefined,
              },
            });
          }
        }

        return updatedComp;
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

  // ---------------------------------------------------------------------------
  // 11. Preview Customer Product & Module Entitlements Update
  // ---------------------------------------------------------------------------
  async previewEntitlementsUpdate(
    payload: {
      rows: any[];
      mode?: EntitlementUpdateMode;
      fileName?: string;
    },
    userTenantId?: string,
  ): Promise<EntitlementPreviewResult> {
    const rawRows = payload.rows || [];
    const mode: EntitlementUpdateMode = payload.mode || 'selective';

    // Fetch tenant-scoped companies and their branches & products
    const companyWhere: any = {};
    if (userTenantId) companyWhere.tenantId = userTenantId;
    const companies = await this.prisma.company.findMany({
      where: companyWhere,
      include: {
        products: {
          include: {
            modules: true,
          },
        },
        branches: {
          include: {
            branchProducts: {
              include: {
                modules: true,
              },
            },
          },
        },
      },
    });

    // Fetch product master hierarchy
    const products = await this.prisma.product.findMany({
      where: userTenantId ? { tenantId: userTenantId } : {},
      include: {
        modules: {
          include: {
            submodules: true,
          },
        },
      },
    });

    // Helper lookup caches
    const companyById = new Map<string, any>();
    const companyByCode = new Map<string, any>();
    const companyByName = new Map<string, any>();

    for (const c of companies) {
      companyById.set(String(c.id), c);
      companyByCode.set(c.id.toLowerCase().replace(/[^a-z0-9]/g, ''), c);
      if (c.companyName) {
        companyByName.set(c.companyName.trim().toLowerCase(), c);
      }
    }

    const productById = new Map<string, any>();
    const productByCode = new Map<string, any>();
    const productByName = new Map<string, any>();

    for (const p of products) {
      productById.set(String(p.id), p);
      if (p.code) {
        productByCode.set(p.code.toLowerCase().trim(), p);
        productByCode.set(p.code.toLowerCase().replace(/[^a-z0-9]/g, ''), p);
      }
      productByCode.set(p.id.toLowerCase().replace(/[^a-z0-9]/g, ''), p);
      if (p.name) productByName.set(p.name.trim().toLowerCase(), p);
    }

    const previewRows: EntitlementRowPreview[] = [];
    const validationErrors: Array<{ rowNumber: number; customerId: string; field: string; message: string }> = [];

    // Helper to extract fields from row object regardless of casing / spaces
    const getVal = (row: any, ...keys: string[]): string => {
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        const direct = row[k];
        if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
          return String(direct).trim();
        }
        const cleanedTarget = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedKey = rowKeys.find(
          (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanedTarget,
        );
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
          return String(row[matchedKey]).trim();
        }
      }
      return '';
    };

    let newCount = 0;
    let updateCount = 0;
    let removeCount = 0;
    let unchangedCount = 0;
    let invalidCount = 0;

    const affectedCustomers = new Set<string>();
    const affectedBranches = new Set<string>();

    // Support compact string syntax in UPDATE CUSTOMERS (e.g. Product Codes: "TALLY, SPINE")
    const normalizedRows: any[] = [];
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const origRowNumber = i + 2;
      const rawProds = getVal(row, 'Product Codes', 'Product Code', 'Product ID', 'ProductID', 'Product', 'productId');
      const rawMods = getVal(row, 'Product Modules', 'Product Module', 'Module ID', 'ModuleID', 'Module Code', 'Module', 'moduleId');
      const rawSubs = getVal(row, 'Product Submodules', 'Product Submodule', 'Sub-Module ID', 'SubModuleID', 'Sub-Module', 'submoduleId');
      const action = getVal(row, 'Entitlement Action', 'Action', 'Operation', 'action') || 'UPDATE';
      const status = getVal(row, 'Entitlement Status', 'Status', 'Is Active', 'State', 'status') || 'ACTIVE';

      // Parse modules map: PROD -> [mod1, mod2]
      const prodModulesMap = new Map<string, string[]>();
      if (rawMods && (rawMods.includes(':') || rawMods.includes('|') || rawMods.includes(';'))) {
        const parts = rawMods.split(';').map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          if (p.includes(':')) {
            const [pCode, modsStr] = p.split(':');
            const mList = modsStr.split('|').map((s) => s.trim()).filter(Boolean);
            prodModulesMap.set(pCode.trim().toUpperCase(), mList);
          }
        }
      }

      // Parse submodules map: PROD:MOD -> [sub1, sub2]
      const submodulesMap = new Map<string, string[]>();
      if (rawSubs && (rawSubs.includes(':') || rawSubs.includes('=') || rawSubs.includes(';'))) {
        const parts = rawSubs.split(';').map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          if (p.includes(':') && p.includes('=')) {
            const [pCode, rest] = p.split(':');
            const [mCode, subsStr] = rest.split('=');
            const sList = subsStr.split('|').map((s) => s.trim()).filter(Boolean);
            submodulesMap.set(`${pCode.trim().toUpperCase()}:${mCode.trim().toUpperCase()}`, sList);
          }
        }
      }

      const pCodes = rawProds.split(',').map((s) => s.trim()).filter(Boolean);
      if (pCodes.length <= 1 && prodModulesMap.size === 0 && submodulesMap.size === 0) {
        normalizedRows.push({ ...row, _origRowNumber: origRowNumber });
      } else {
        for (const pc of pCodes) {
          const pcUpper = pc.toUpperCase();
          const mods = prodModulesMap.get(pcUpper) || [];
          if (mods.length === 0) {
            normalizedRows.push({
              ...row,
              'Product ID': pc,
              Action: action,
              Status: status,
              _origRowNumber: origRowNumber,
            });
          } else {
            for (const m of mods) {
              const mUpper = m.toUpperCase();
              const subs = submodulesMap.get(`${pcUpper}:${mUpper}`) || [];
              if (subs.length === 0) {
                normalizedRows.push({
                  ...row,
                  'Product ID': pc,
                  'Module ID': m,
                  Action: action,
                  Status: status,
                  _origRowNumber: origRowNumber,
                });
              } else {
                for (const s of subs) {
                  normalizedRows.push({
                    ...row,
                    'Product ID': pc,
                    'Module ID': m,
                    'Sub-Module ID': s,
                    Action: action,
                    Status: status,
                    _origRowNumber: origRowNumber,
                  });
                }
              }
            }
          }
        }
      }
    }

    for (let i = 0; i < normalizedRows.length; i++) {
      const r = normalizedRows[i];
      const rowNumber = r._origRowNumber || (i + 2); // spreadsheet row 1 is header
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      const rawCustId = getVal(r, 'Customer ID', 'CustomerID', 'Customer', 'Company ID', 'companyId');
      const rawCompName = getVal(r, 'Company Name', 'CompanyName', 'Company');
      const rawBranchId = getVal(r, 'Branch ID', 'BranchID', 'Branch', 'branchId');
      const rawBranchName = getVal(r, 'Branch Name', 'BranchName', 'branchName');
      const rawProdId = getVal(r, 'Product ID', 'ProductID', 'Product Code', 'Product Codes', 'Product', 'productId');
      const rawProdName = getVal(r, 'Product Name', 'ProductName', 'productName');
      const rawModId = getVal(r, 'Module ID', 'ModuleID', 'Module Code', 'Product Modules', 'Module', 'moduleId');
      const rawModName = getVal(r, 'Module Name', 'ModuleName', 'moduleName');
      const rawSubmodId = getVal(r, 'Sub-Module ID', 'SubModuleID', 'SubModule Code', 'Product Submodules', 'Sub-Module', 'SubModule', 'submoduleId');
      const rawSubmodName = getVal(r, 'Sub-Module Name', 'SubModuleName', 'submoduleName');
      const rawAction = getVal(r, 'Entitlement Action', 'Action', 'Operation', 'action');
      const rawStatus = getVal(r, 'Entitlement Status', 'Status', 'Is Active', 'State', 'status');

      // 1. Resolve Company
      let matchedCompany: any = null;
      if (rawCustId) {
        const sanitizedCustId = rawCustId.toLowerCase().replace(/[^a-z0-9]/g, '');
        matchedCompany = companyById.get(rawCustId) || companyByCode.get(sanitizedCustId);
        if (!matchedCompany && /^\d+$/.test(rawCustId)) {
          const padded = `CMP-${rawCustId.padStart(4, '0')}`;
          matchedCompany = companyById.get(padded) || companyByCode.get(padded.toLowerCase().replace(/[^a-z0-9]/g, ''));
        }
      }
      if (!matchedCompany && rawCompName) {
        matchedCompany = companyByName.get(rawCompName.toLowerCase());
      }

      if (!matchedCompany) {
        rowErrors.push(`Customer ID '${rawCustId || rawCompName}' not found or belongs to another tenant.`);
        validationErrors.push({
          rowNumber,
          customerId: rawCustId || 'UNKNOWN',
          field: 'Customer ID',
          message: `Customer '${rawCustId || rawCompName}' could not be resolved.`,
        });
      } else {
        affectedCustomers.add(matchedCompany.id);
      }

      // 2. Resolve Branch if provided
      let matchedBranch: any = null;
      const isHO = !rawBranchId || rawBranchId.toLowerCase() === 'head office' || rawBranchId.toLowerCase() === 'ho';
      if (matchedCompany && !isHO) {
        const branches = matchedCompany.branches || [];
        const sanitizedBranch = rawBranchId.toLowerCase().replace(/[^a-z0-9]/g, '');
        matchedBranch = branches.find(
          (b: any) =>
            b.id.toLowerCase() === rawBranchId.toLowerCase() ||
            b.id.toLowerCase().replace(/[^a-z0-9]/g, '') === sanitizedBranch ||
            (b.branchName && b.branchName.trim().toLowerCase() === rawBranchId.toLowerCase()) ||
            (rawBranchName && b.branchName && b.branchName.trim().toLowerCase() === rawBranchName.toLowerCase()),
        );
        if (!matchedBranch) {
          rowErrors.push(`Branch '${rawBranchId}' does not belong to Customer '${matchedCompany.id}'.`);
          validationErrors.push({
            rowNumber,
            customerId: matchedCompany.id,
            field: 'Branch ID',
            message: `Branch '${rawBranchId}' not found under customer.`,
          });
        } else {
          affectedBranches.add(matchedBranch.id);
        }
      }

      // 3. Resolve Product
      let matchedProduct: any = null;
      if (rawProdId) {
        const sanitizedProd = rawProdId.toLowerCase().replace(/[^a-z0-9]/g, '');
        matchedProduct = productById.get(rawProdId) || productByCode.get(rawProdId.toLowerCase()) || productByCode.get(sanitizedProd);
      }
      if (!matchedProduct && rawProdName) {
        matchedProduct = productByName.get(rawProdName.toLowerCase());
      }
      if (!matchedProduct) {
        rowErrors.push(`Product '${rawProdId || rawProdName}' does not exist in Product Master.`);
        validationErrors.push({
          rowNumber,
          customerId: matchedCompany?.id || rawCustId || 'UNKNOWN',
          field: 'Product ID',
          message: `Product '${rawProdId || rawProdName}' not found.`,
        });
      }

      // 4. Resolve Module if provided
      let matchedModule: any = null;
      if (matchedProduct && rawModId) {
        const sanitizedMod = rawModId.toLowerCase().replace(/[^a-z0-9]/g, '');
        matchedModule = (matchedProduct.modules || []).find(
          (m: any) =>
            m.id.toLowerCase() === rawModId.toLowerCase() ||
            m.id.toLowerCase().replace(/[^a-z0-9]/g, '') === sanitizedMod ||
            (m.name && m.name.trim().toLowerCase() === rawModId.toLowerCase()) ||
            (rawModName && m.name && m.name.trim().toLowerCase() === rawModName.toLowerCase()),
        );
        if (!matchedModule) {
          rowErrors.push(`Module '${rawModId}' does not belong to Product '${matchedProduct.name}'.`);
          validationErrors.push({
            rowNumber,
            customerId: matchedCompany?.id || rawCustId || 'UNKNOWN',
            field: 'Module ID',
            message: `Module '${rawModId}' does not belong to product '${matchedProduct.name}'.`,
          });
        }
      }

      // 5. Resolve Sub-Module if provided
      let matchedSubmodule: any = null;
      if (rawSubmodId) {
        if (!matchedModule) {
          rowErrors.push(`Sub-Module '${rawSubmodId}' specified without a valid Module.`);
          validationErrors.push({
            rowNumber,
            customerId: matchedCompany?.id || rawCustId || 'UNKNOWN',
            field: 'Sub-Module ID',
            message: `Sub-Module specified without valid module.`,
          });
        } else {
          const sanitizedSubmod = rawSubmodId.toLowerCase().replace(/[^a-z0-9]/g, '');
          matchedSubmodule = (matchedModule.submodules || []).find(
            (sm: any) =>
              sm.id.toLowerCase() === rawSubmodId.toLowerCase() ||
              sm.id.toLowerCase().replace(/[^a-z0-9]/g, '') === sanitizedSubmod ||
              (sm.name && sm.name.trim().toLowerCase() === rawSubmodId.toLowerCase()) ||
              (rawSubmodName && sm.name && sm.name.trim().toLowerCase() === rawSubmodName.toLowerCase()),
          );
          if (!matchedSubmodule) {
            rowErrors.push(`Sub-Module '${rawSubmodId}' does not belong to Module '${matchedModule.name}'.`);
            validationErrors.push({
              rowNumber,
              customerId: matchedCompany?.id || rawCustId || 'UNKNOWN',
              field: 'Sub-Module ID',
              message: `Sub-Module '${rawSubmodId}' does not belong to module '${matchedModule.name}'.`,
            });
          }
        }
      }

      // 6. Action Normalization
      let action: EntitlementAction = 'ADD';
      const cleanAction = rawAction.toUpperCase();
      if (cleanAction === 'REMOVE' || cleanAction === 'DELETE') action = 'REMOVE';
      else if (cleanAction === 'UPDATE') action = 'UPDATE';
      else if (cleanAction === 'ENABLE') action = 'ENABLE';
      else if (cleanAction === 'DISABLE') action = 'DISABLE';
      else action = 'ADD';

      // 7. Status Normalization
      let requestedStatus: 'ENABLED' | 'DISABLED' = 'ENABLED';
      if (action === 'DISABLE') {
        requestedStatus = 'DISABLED';
      } else if (rawStatus) {
        const cleanStatus = rawStatus.toUpperCase();
        if (cleanStatus === 'INACTIVE' || cleanStatus === 'DISABLED' || cleanStatus === 'FALSE' || cleanStatus === '0') {
          requestedStatus = 'DISABLED';
        } else {
          requestedStatus = 'ENABLED';
        }
      }

      // 8. Determine Current Status in Database
      let currentStatus: 'ENABLED' | 'DISABLED' | 'NOT_ASSIGNED' = 'NOT_ASSIGNED';
      if (matchedCompany && matchedProduct) {
        if (!matchedBranch) {
          // Company level entitlement
          const cp = (matchedCompany.products || []).find((p: any) => p.productId === matchedProduct.id);
          if (cp) {
            if (!matchedModule) {
              currentStatus = cp.isActive ? 'ENABLED' : 'DISABLED';
            } else {
              const cpm = (cp.modules || []).find((m: any) => m.moduleId === matchedModule.id);
              if (cpm) {
                if (!matchedSubmodule) {
                  currentStatus = cp.isActive ? 'ENABLED' : 'DISABLED';
                } else {
                  let subList: string[] = [];
                  try {
                    subList = JSON.parse(cpm.submoduleIds || '[]');
                  } catch {
                    subList = (cpm.submoduleIds || '').split(',').map((s: string) => s.trim());
                  }
                  if (subList.includes(matchedSubmodule.id)) {
                    currentStatus = cp.isActive ? 'ENABLED' : 'DISABLED';
                  } else {
                    currentStatus = 'NOT_ASSIGNED';
                  }
                }
              } else {
                currentStatus = 'NOT_ASSIGNED';
              }
            }
          } else {
            currentStatus = 'NOT_ASSIGNED';
          }
        } else {
          // Branch level entitlement
          // First check company prerequisite: Customer must have this product active
          const companyCp = (matchedCompany.products || []).find(
            (p: any) => p.productId === matchedProduct.id && p.isActive,
          );
          if (!companyCp) {
            rowErrors.push(
              `Prerequisite missing: Parent customer '${matchedCompany.companyName || matchedCompany.id}' does not have Product '${matchedProduct.name}' active.`,
            );
          }

          const bp = (matchedBranch.branchProducts || []).find((p: any) => p.productId === matchedProduct.id);
          if (bp) {
            if (!matchedModule) {
              currentStatus = bp.isActive ? 'ENABLED' : 'DISABLED';
            } else {
              const bpm = (bp.modules || []).find((m: any) => m.moduleId === matchedModule.id);
              if (bpm) {
                if (!matchedSubmodule) {
                  currentStatus = bp.isActive ? 'ENABLED' : 'DISABLED';
                } else {
                  let subList: string[] = [];
                  try {
                    subList = JSON.parse(bpm.submoduleIds || '[]');
                  } catch {
                    subList = (bpm.submoduleIds || '').split(',').map((s: string) => s.trim());
                  }
                  if (subList.includes(matchedSubmodule.id)) {
                    currentStatus = bp.isActive ? 'ENABLED' : 'DISABLED';
                  } else {
                    currentStatus = 'NOT_ASSIGNED';
                  }
                }
              } else {
                currentStatus = 'NOT_ASSIGNED';
              }
            }
          } else {
            currentStatus = 'NOT_ASSIGNED';
          }
        }
      }

      // 9. Determine Action Category
      let actionCategory: 'NEW' | 'UPDATE' | 'REMOVE' | 'UNCHANGED' | 'INVALID' = 'NEW';
      const isValid = rowErrors.length === 0;

      if (!isValid) {
        actionCategory = 'INVALID';
        invalidCount++;
      } else if (action === 'REMOVE') {
        if (currentStatus === 'NOT_ASSIGNED') {
          actionCategory = 'UNCHANGED';
          unchangedCount++;
          rowWarnings.push('Entitlement is not assigned; removal has no effect.');
        } else {
          actionCategory = 'REMOVE';
          removeCount++;
        }
      } else {
        if (currentStatus === 'NOT_ASSIGNED') {
          if (action === 'UPDATE') {
            action = 'ADD';
            actionCategory = 'NEW';
            newCount++;
            rowWarnings.push('Entitlement was not previously assigned; creating new assignment.');
          } else {
            actionCategory = 'NEW';
            newCount++;
          }
        } else {
          if (currentStatus === requestedStatus) {
            actionCategory = 'UNCHANGED';
            unchangedCount++;
          } else {
            actionCategory = 'UPDATE';
            updateCount++;
          }
        }
      }

      previewRows.push({
        rowNumber,
        customerId: matchedCompany ? matchedCompany.id : (rawCustId || 'UNKNOWN'),
        customerName: matchedCompany ? matchedCompany.companyName : (rawCompName || null),
        companyName: matchedCompany ? matchedCompany.companyName : (rawCompName || null),
        branchId: matchedBranch ? matchedBranch.id : (isHO ? null : (rawBranchId || null)),
        branchName: matchedBranch ? matchedBranch.branchName : (isHO ? 'Head Office' : (rawBranchName || null)),
        productId: matchedProduct ? matchedProduct.id : (rawProdId || 'UNKNOWN'),
        productName: matchedProduct ? matchedProduct.name : (rawProdName || null),
        moduleId: matchedModule ? matchedModule.id : (rawModId || null),
        moduleName: matchedModule ? matchedModule.name : (rawModName || null),
        submoduleId: matchedSubmodule ? matchedSubmodule.id : (rawSubmodId || null),
        submoduleName: matchedSubmodule ? matchedSubmodule.name : (rawSubmodName || null),
        action,
        requestedStatus,
        currentStatus,
        actionCategory,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
        warnings: rowWarnings,
      });
    }

    // Mode B: Full Synchronization - detect unlisted active entitlements on affected customers
    if (mode === 'full_sync') {
      for (const compId of affectedCustomers) {
        const comp = companies.find((c) => c.id === compId);
        if (!comp) continue;

        // Check company products
        for (const cp of comp.products || []) {
          if (!cp.isActive) continue;
          const listedInFile = previewRows.some(
            (pr) => pr.isValid && pr.customerId === comp.id && !pr.branchId && pr.productId === cp.productId && pr.action !== 'REMOVE',
          );
          if (!listedInFile) {
            const prod = products.find((p) => p.id === cp.productId);
            previewRows.push({
              rowNumber: previewRows.length + 2,
              customerId: comp.id,
              customerName: comp.companyName,
              companyName: comp.companyName,
              branchId: null,
              branchName: 'Head Office',
              productId: cp.productId,
              productName: prod ? prod.name : cp.productId,
              moduleId: null,
              moduleName: null,
              submoduleId: null,
              submoduleName: null,
              action: 'REMOVE',
              requestedStatus: 'DISABLED',
              currentStatus: 'ENABLED',
              actionCategory: 'REMOVE',
              isValid: true,
              errors: [],
              warnings: ['Full Sync: Unlisted active product flagged for removal.'],
            });
            removeCount++;
          }
        }
      }
    }

    const readyCount = newCount + updateCount + removeCount;

    return {
      mode,
      summary: {
        totalRows: rawRows.length,
        newCount,
        updateCount,
        removeCount,
        unchangedCount,
        invalidCount,
        readyCount,
        affectedCustomerCount: affectedCustomers.size,
        affectedBranchCount: affectedBranches.size,
      },
      rows: previewRows,
      validationErrors,
    };
  }

  // ---------------------------------------------------------------------------
  // 12. Commit Customer Product & Module Entitlements Update
  // ---------------------------------------------------------------------------
  async commitEntitlementsUpdate(
    payload: EntitlementCommitPayload,
    actorUserId: number,
    userTenantId?: string,
  ): Promise<EntitlementExecutionResult> {
    const rawRows = payload.rows || [];
    const mode = payload.mode || 'selective';
    const operationId = `ENT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // First run preview to obtain validated and categorized rows
    const preview = await this.previewEntitlementsUpdate(payload, userTenantId);
    const validRows = preview.rows.filter((r) => r.isValid && r.actionCategory !== 'INVALID' && r.actionCategory !== 'UNCHANGED');

    let appliedCount = 0;
    let skippedCount = preview.rows.filter((r) => r.actionCategory === 'UNCHANGED').length;
    let failedCount = preview.rows.filter((r) => !r.isValid || r.actionCategory === 'INVALID').length;
    const executionDetails: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Update any customer profile fields provided in UPDATE CUSTOMERS rows
      const updatedCompanyIds = new Set<string>();
      for (const raw of (payload.rows || [])) {
        const rawCustId = String(raw['Customer ID'] || raw['CustomerID'] || raw['customer_id'] || '').trim();
        const matchedComp = preview.rows.find((r) => r.customerId && (r.customerId === rawCustId || r.customerId.endsWith(rawCustId)))?.customerId || rawCustId;
        if (matchedComp && !updatedCompanyIds.has(matchedComp)) {
          const updateData: any = {};
          const compName = raw['Company Name'] || raw['companyName'];
          const addr = raw['Address'] || raw['Office Address'] || raw['address'];
          const gst = raw['GSTN'] || raw['GSTN / Tax ID'] || raw['gstn'];
          const pEmail = raw['Primary Email'] || raw['primaryEmail'];
          const altEmails = raw['Alternate Emails'] || raw['alternateEmails'];
          const cp = raw['Contact Person'] || raw['Primary Contact Person'] || raw['contactPerson'];
          const phone = raw['Contact Phone'] || raw['Primary Contact Phone'] || raw['contactPhone'];
          const loc = raw['Contact Location'] || raw['contactAddress'];
          const stat = raw['Contact Status'] || raw['contactStatus'];
          const altCp = raw['Alternate Contact'] || raw['Alternate Contact Person'] || raw['alternateContact'];
          const altPhone = raw['Alternate Contact Phone'] || raw['alternateContactPhone'];
          const altEmail = raw['Alternate Contact Email'] || raw['alternateContactEmail'];
          const altLoc = raw['Alternate Contact Location / Address'] || raw['alternateContactAddress'];
          const isAct = raw['Is Active'] ?? raw['isActive'];

          if (compName && String(compName).trim()) updateData.companyName = String(compName).trim();
          if (addr && String(addr).trim()) updateData.address = String(addr).trim();
          if (gst && String(gst).trim()) updateData.gstn = String(gst).trim();
          if (pEmail && String(pEmail).trim()) updateData.primaryEmail = String(pEmail).trim().toLowerCase();
          if (altEmails !== undefined) updateData.alternateEmails = String(altEmails).trim() || null;
          if (cp && String(cp).trim()) updateData.contactPerson = String(cp).trim();
          if (phone && String(phone).trim()) updateData.contactPhone = String(phone).trim();
          if (loc !== undefined) updateData.contactAddress = String(loc).trim() || null;
          if (stat && String(stat).trim()) updateData.contactStatus = String(stat).trim().toUpperCase();
          if (altCp !== undefined) updateData.alternateContact = String(altCp).trim() || null;
          if (altPhone !== undefined) updateData.alternateContactPhone = String(altPhone).trim() || null;
          if (altEmail !== undefined) updateData.alternateContactEmail = String(altEmail).trim() || null;
          if (altLoc !== undefined) updateData.alternateContactAddress = String(altLoc).trim() || null;
          if (isAct !== undefined && String(isAct).trim() !== '') {
            updateData.isActive = String(isAct).trim().toLowerCase() === 'true' || String(isAct).trim() === '1';
          }

          if (Object.keys(updateData).length > 0) {
            try {
              await tx.company.update({
                where: { id: matchedComp },
                data: updateData,
              });
              updatedCompanyIds.add(matchedComp);
            } catch (err: any) {
              this.logger.warn(`Failed to update company profile for ${matchedComp}: ${err.message}`);
            }
          }
        }
      }

      for (const row of validRows) {
        try {
          if (!row.branchId) {
            // COMPANY-LEVEL ENTITLEMENT
            if (row.action === 'REMOVE') {
              if (row.submoduleId && row.moduleId) {
                // Remove specific submodule
                const cp = await tx.companyProduct.findUnique({
                  where: { uq_company_product: { companyId: row.customerId, productId: row.productId } },
                  include: { modules: true },
                });
                if (cp) {
                  const cpm = cp.modules.find((m) => m.moduleId === row.moduleId);
                  if (cpm) {
                    let subs: string[] = [];
                    try {
                      subs = JSON.parse(cpm.submoduleIds || '[]');
                    } catch {
                      subs = (cpm.submoduleIds || '').split(',').map((s) => s.trim());
                    }
                    const filtered = subs.filter((s) => s !== row.submoduleId);
                    await tx.companyProductModule.update({
                      where: { id: cpm.id },
                      data: { submoduleIds: filtered.length > 0 ? JSON.stringify(filtered) : null },
                    });
                  }
                }
              } else if (row.moduleId) {
                // Remove specific module
                const cp = await tx.companyProduct.findUnique({
                  where: { uq_company_product: { companyId: row.customerId, productId: row.productId } },
                });
                if (cp) {
                  await tx.companyProductModule.deleteMany({
                    where: { companyProductId: cp.id, moduleId: row.moduleId },
                  });
                }
              } else {
                // Remove product: soft-deactivate product
                await tx.companyProduct.updateMany({
                  where: { companyId: row.customerId, productId: row.productId },
                  data: { isActive: false },
                });
                // Deactivate branches product too
                const branches = await tx.companyBranch.findMany({
                  where: { companyId: row.customerId },
                  select: { id: true },
                });
                if (branches.length > 0) {
                  await tx.branchProduct.updateMany({
                    where: { branchId: { in: branches.map((b) => b.id) }, productId: row.productId },
                    data: { isActive: false },
                  });
                }
              }
            } else {
              // ADD / UPDATE / ENABLE / DISABLE
              const cp = await tx.companyProduct.upsert({
                where: { uq_company_product: { companyId: row.customerId, productId: row.productId } },
                create: {
                  companyId: row.customerId,
                  productId: row.productId,
                  purchaseType: 'SELECTED_MODULES',
                  isActive: row.requestedStatus === 'ENABLED',
                },
                update: {
                  isActive: row.requestedStatus === 'ENABLED',
                },
              });

              if (row.moduleId) {
                const cpm = await tx.companyProductModule.findUnique({
                  where: { uq_company_product_module: { companyProductId: cp.id, moduleId: row.moduleId } },
                });

                let subs: string[] = [];
                if (cpm && cpm.submoduleIds) {
                  try {
                    subs = JSON.parse(cpm.submoduleIds || '[]');
                  } catch {
                    subs = (cpm.submoduleIds || '').split(',').map((s) => s.trim());
                  }
                }
                if (row.submoduleId && !subs.includes(row.submoduleId)) {
                  subs.push(row.submoduleId);
                }

                if (cpm) {
                  await tx.companyProductModule.update({
                    where: { id: cpm.id },
                    data: { submoduleIds: subs.length > 0 ? JSON.stringify(subs) : cpm.submoduleIds },
                  });
                } else {
                  await tx.companyProductModule.create({
                    data: {
                      companyProductId: cp.id,
                      moduleId: row.moduleId,
                      submoduleIds: subs.length > 0 ? JSON.stringify(subs) : null,
                    },
                  });
                }
              }
            }
          } else {
            // BRANCH-LEVEL ENTITLEMENT
            if (row.action === 'REMOVE') {
              if (row.submoduleId && row.moduleId) {
                const bp = await tx.branchProduct.findUnique({
                  where: { uq_branch_product: { branchId: row.branchId, productId: row.productId } },
                  include: { modules: true },
                });
                if (bp) {
                  const bpm = bp.modules.find((m) => m.moduleId === row.moduleId);
                  if (bpm) {
                    let subs: string[] = [];
                    try {
                      subs = JSON.parse(bpm.submoduleIds || '[]');
                    } catch {
                      subs = (bpm.submoduleIds || '').split(',').map((s) => s.trim());
                    }
                    const filtered = subs.filter((s) => s !== row.submoduleId);
                    await tx.branchProductModule.update({
                      where: { id: bpm.id },
                      data: { submoduleIds: filtered.length > 0 ? JSON.stringify(filtered) : null },
                    });
                  }
                }
              } else if (row.moduleId) {
                const bp = await tx.branchProduct.findUnique({
                  where: { uq_branch_product: { branchId: row.branchId, productId: row.productId } },
                });
                if (bp) {
                  await tx.branchProductModule.deleteMany({
                    where: { branchProductId: bp.id, moduleId: row.moduleId },
                  });
                }
              } else {
                await tx.branchProduct.updateMany({
                  where: { branchId: row.branchId, productId: row.productId },
                  data: { isActive: false },
                });
              }
            } else {
              // ADD / UPDATE / ENABLE / DISABLE on Branch
              const bp = await tx.branchProduct.upsert({
                where: { uq_branch_product: { branchId: row.branchId, productId: row.productId } },
                create: {
                  branchId: row.branchId,
                  productId: row.productId,
                  isActive: row.requestedStatus === 'ENABLED',
                },
                update: {
                  isActive: row.requestedStatus === 'ENABLED',
                },
              });

              if (row.moduleId) {
                const bpm = await tx.branchProductModule.findUnique({
                  where: { uq_branch_product_module: { branchProductId: bp.id, moduleId: row.moduleId } },
                });

                let subs: string[] = [];
                if (bpm && bpm.submoduleIds) {
                  try {
                    subs = JSON.parse(bpm.submoduleIds || '[]');
                  } catch {
                    subs = (bpm.submoduleIds || '').split(',').map((s) => s.trim());
                  }
                }
                if (row.submoduleId && !subs.includes(row.submoduleId)) {
                  subs.push(row.submoduleId);
                }

                if (bpm) {
                  await tx.branchProductModule.update({
                    where: { id: bpm.id },
                    data: { submoduleIds: subs.length > 0 ? JSON.stringify(subs) : bpm.submoduleIds },
                  });
                } else {
                  await tx.branchProductModule.create({
                    data: {
                      branchProductId: bp.id,
                      moduleId: row.moduleId,
                      submoduleIds: subs.length > 0 ? JSON.stringify(subs) : null,
                    },
                  });
                }
              }
            }
          }

          appliedCount++;
          executionDetails.push({
            rowNumber: row.rowNumber,
            customerId: row.customerId,
            branchId: row.branchId,
            productId: row.productId,
            moduleId: row.moduleId,
            submoduleId: row.submoduleId,
            action: row.action,
            status: 'APPLIED',
          });
        } catch (err: any) {
          failedCount++;
          executionDetails.push({
            rowNumber: row.rowNumber,
            customerId: row.customerId,
            branchId: row.branchId,
            productId: row.productId,
            moduleId: row.moduleId,
            submoduleId: row.submoduleId,
            action: row.action,
            status: 'FAILED',
            errorReason: err.message || 'Database execution error',
          });
        }
      }

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          action: 'CUSTOMER_ENTITLEMENT_MASS_UPDATE',
          actorUserId: actorUserId || 1,
          entityType: 'MASS_UPDATE',
          entityId: operationId,
          newValuesJson: JSON.stringify({
            operationId,
            module: 'customer_entitlements',
            mode,
            fileName: payload.fileName || 'Spreadsheet',
            totalRows: rawRows.length,
            appliedCount,
            skippedCount,
            failedCount,
          }),
          ipAddress: '127.0.0.1',
          tenantId: userTenantId || 'KANVTECH',
        },
      });
    });

    const result: EntitlementExecutionResult = {
      operationId,
      mode,
      totalRows: rawRows.length,
      appliedCount,
      skippedCount,
      failedCount,
      timestamp: new Date().toISOString(),
      message: `Mass update completed: ${appliedCount} applied, ${skippedCount} skipped, ${failedCount} failed.`,
      details: executionDetails,
    };

    return result;
  }
}

