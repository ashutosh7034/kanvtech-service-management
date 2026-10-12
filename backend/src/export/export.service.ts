import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as XLSX from 'xlsx';

export interface ExportModuleMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  entities: string[];
  requiresAdmin?: boolean;
}

export const EXPORT_MODULES: ExportModuleMeta[] = [
  {
    id: 'customers',
    name: 'Customer & Branch Master',
    category: 'Core Master',
    description: 'Companies, contact directory, customer branch networks, and purchased product entitlements',
    entities: ['Company', 'CompanyContact', 'CompanyBranch', 'CompanyProduct', 'BranchProduct'],
  },
  {
    id: 'products',
    name: 'Product Catalog & Hierarchy',
    category: 'Core Master',
    description: 'Products, functional modules, and submodules catalog',
    entities: ['Product', 'ProductModule', 'ProductSubmodule'],
  },
  {
    id: 'departments',
    name: 'Departments & Specializations',
    category: 'Core Master',
    description: 'Department units, product specialization mapping, and support tiers',
    entities: ['Department', 'DepartmentProduct', 'SupportLevel'],
  },
  {
    id: 'employees',
    name: 'Employees & Attendance Roster',
    category: 'Workforce',
    description: 'Employee profiles, designations, support levels, and attendance logs (credentials strictly excluded)',
    entities: ['Employee', 'EmployeeAttendance'],
  },
  {
    id: 'tickets',
    name: 'Service Tickets & SLA Escalations',
    category: 'Service Operations',
    description: 'Support tickets, chronological history, assignment logs, escalations, sessions, comments, and CSAT feedback',
    entities: ['Ticket', 'TicketAssignment', 'TicketHistory', 'TicketEscalation', 'TicketComment', 'TicketFeedback'],
  },
  {
    id: 'subscriptions',
    name: 'AMC Agreements & SLA Configurations',
    category: 'Service Operations',
    description: 'Annual Maintenance Contracts, renewal schedules, and tier-specific SLA thresholds',
    entities: ['Subscription', 'SlaConfiguration'],
  },
  {
    id: 'implementations',
    name: 'New Implementations & Go-Live Tasks',
    category: 'Projects',
    description: 'Enterprise onboarding projects, milestone progress, and task checklists',
    entities: ['Implementation', 'ImplementationTask'],
  },
  {
    id: 'prospects',
    name: 'Enquiries & Sales Prospects',
    category: 'Commercial',
    description: 'Incoming sales leads, pipeline statuses, notes, and conversion history',
    entities: ['Prospect'],
  },
  {
    id: 'tasks',
    name: 'Employee Tasks & Reminders',
    category: 'Productivity',
    description: 'Individual employee task reminders, priority assignments, and completion states',
    entities: ['EmployeeTask'],
  },
  {
    id: 'chat',
    name: 'Internal Messages & Mailbox',
    category: 'Communication',
    description: 'Enterprise internal messaging channels, conversations, and message logs',
    entities: ['ChatConversation', 'ChatMessage'],
    requiresAdmin: true,
  },
  {
    id: 'audit',
    name: 'Audit Trails & System Configuration',
    category: 'Governance',
    description: 'Comprehensive system audit trails, user access records, and platform settings',
    entities: ['AuditLog', 'SystemSetting'],
    requiresAdmin: true,
  },
];

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Return metadata and current live record counts for all export modules
   */
  async getModulesSummary(userRole: string) {
    const counts = await this.fetchLiveRecordCounts();

    const modules = EXPORT_MODULES.map((mod) => {
      const isAuthorized = !mod.requiresAdmin || userRole === 'ADMIN';
      let recordCount = 0;

      if (mod.id === 'customers') {
        recordCount = (counts.companies || 0) + (counts.branches || 0) + (counts.contacts || 0);
      } else if (mod.id === 'products') {
        recordCount = (counts.products || 0) + (counts.productModules || 0) + (counts.productSubmodules || 0);
      } else if (mod.id === 'departments') {
        recordCount = (counts.departments || 0) + (counts.departmentProducts || 0);
      } else if (mod.id === 'employees') {
        recordCount = (counts.employees || 0) + (counts.attendance || 0);
      } else if (mod.id === 'tickets') {
        recordCount = (counts.tickets || 0) + (counts.ticketHistory || 0) + (counts.ticketComments || 0);
      } else if (mod.id === 'subscriptions') {
        recordCount = (counts.subscriptions || 0) + (counts.slaConfigurations || 0);
      } else if (mod.id === 'implementations') {
        recordCount = (counts.implementations || 0) + (counts.implementationTasks || 0);
      } else if (mod.id === 'prospects') {
        recordCount = counts.prospects || 0;
      } else if (mod.id === 'tasks') {
        recordCount = counts.employeeTasks || 0;
      } else if (mod.id === 'chat') {
        recordCount = counts.chatMessages || 0;
      } else if (mod.id === 'audit') {
        recordCount = counts.auditLogs || 0;
      }

      return {
        ...mod,
        recordCount,
        isAuthorized,
      };
    });

    const totalSystemRecords = Object.values(counts).reduce((sum, n) => sum + (n || 0), 0);

    return {
      modules,
      totalSystemRecords,
      counts,
    };
  }

  private async fetchLiveRecordCounts() {
    const [
      companies,
      contacts,
      branches,
      products,
      productModules,
      productSubmodules,
      departments,
      departmentProducts,
      employees,
      attendance,
      tickets,
      ticketHistory,
      ticketComments,
      subscriptions,
      slaConfigurations,
      implementations,
      implementationTasks,
      prospects,
      employeeTasks,
      chatMessages,
      auditLogs,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.companyContact.count(),
      this.prisma.companyBranch.count(),
      this.prisma.product.count(),
      this.prisma.productModule.count(),
      this.prisma.productSubmodule.count(),
      this.prisma.department.count(),
      this.prisma.departmentProduct.count(),
      this.prisma.employee.count(),
      this.prisma.employeeAttendance.count(),
      this.prisma.ticket.count(),
      this.prisma.ticketHistory.count(),
      this.prisma.ticketComment.count(),
      this.prisma.subscription.count(),
      this.prisma.slaConfiguration.count(),
      this.prisma.implementation.count(),
      this.prisma.implementationTask.count(),
      this.prisma.prospect.count(),
      this.prisma.employeeTask.count(),
      this.prisma.chatMessage.count(),
      this.prisma.auditLog.count(),
    ]);

    return {
      companies,
      contacts,
      branches,
      products,
      productModules,
      productSubmodules,
      departments,
      departmentProducts,
      employees,
      attendance,
      tickets,
      ticketHistory,
      ticketComments,
      subscriptions,
      slaConfigurations,
      implementations,
      implementationTasks,
      prospects,
      employeeTasks,
      chatMessages,
      auditLogs,
    };
  }

  /**
   * Fetch sanitized data records for requested modules
   */
  async getExportData(moduleKey: string, user: { userId: number; role: string }) {
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      throw new ForbiddenException('Only Administrators and Managers are authorized to export business data.');
    }

    if ((moduleKey === 'chat' || moduleKey === 'audit') && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only Administrators are authorized to export internal communication or audit logs.');
    }

    const data: Record<string, any[]> = {};
    const modulesToExport =
      moduleKey === 'all'
        ? EXPORT_MODULES.filter((m) => !m.requiresAdmin || user.role === 'ADMIN').map((m) => m.id)
        : [moduleKey];

    for (const mod of modulesToExport) {
      switch (mod) {
        case 'customers': {
          const companies = await this.prisma.company.findMany({
            orderBy: { createdAt: 'desc' },
          });
          const contacts = await this.prisma.companyContact.findMany({
            orderBy: { id: 'asc' },
          });
          const branches = await this.prisma.companyBranch.findMany({
            orderBy: { id: 'asc' },
          });
          const entitlements = await this.prisma.companyProduct.findMany({
            include: { modules: true },
            orderBy: { id: 'asc' },
          });
          data['Companies'] = companies;
          data['Company_Contacts'] = contacts;
          data['Company_Branches'] = branches;
          data['Customer_Entitlements'] = entitlements.map((e) => ({
            id: e.id,
            companyId: e.companyId,
            productId: e.productId,
            purchaseType: e.purchaseType,
            purchasedAt: e.purchasedAt,
            isActive: e.isActive,
            modulesCount: e.modules.length,
          }));
          break;
        }

        case 'products': {
          const products = await this.prisma.product.findMany({
            orderBy: { code: 'asc' },
          });
          const modules = await this.prisma.productModule.findMany({
            orderBy: { id: 'asc' },
          });
          const submodules = await this.prisma.productSubmodule.findMany({
            orderBy: { id: 'asc' },
          });
          data['Products'] = products;
          data['Product_Modules'] = modules;
          data['Product_Submodules'] = submodules;
          break;
        }

        case 'departments': {
          const departments = await this.prisma.department.findMany({
            orderBy: { code: 'asc' },
          });
          const deptProducts = await this.prisma.departmentProduct.findMany({
            orderBy: { id: 'asc' },
          });
          const supportLevels = await this.prisma.supportLevel.findMany({
            orderBy: { orderIndex: 'asc' },
          });
          data['Departments'] = departments;
          data['Department_Products'] = deptProducts;
          data['Support_Levels'] = supportLevels;
          break;
        }

        case 'employees': {
          const employees = await this.prisma.employee.findMany({
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  role: true,
                  isActive: true,
                  lastLoginAt: true,
                },
              },
            },
            orderBy: { id: 'asc' },
          });
          const attendance = await this.prisma.employeeAttendance.findMany({
            take: 2000,
            orderBy: { checkInTime: 'desc' },
          });
          data['Employees'] = employees.map((emp) => ({
            id: emp.id,
            userId: emp.userId,
            name: emp.name,
            email: emp.email,
            phone: emp.phone,
            department: emp.department,
            departmentId: emp.departmentId,
            designation: emp.designation,
            level: emp.level,
            managerId: emp.managerId,
            availability: emp.availability,
            status: emp.status,
            userRole: emp.user?.role,
            userActive: emp.user?.isActive,
            lastLoginAt: emp.user?.lastLoginAt,
            createdAt: emp.createdAt,
          }));
          data['Attendance_Records'] = attendance;
          break;
        }

        case 'tickets': {
          const tickets = await this.prisma.ticket.findMany({
            orderBy: { createdAt: 'desc' },
          });
          const assignments = await this.prisma.ticketAssignment.findMany({
            orderBy: { id: 'desc' },
            take: 3000,
          });
          const history = await this.prisma.ticketHistory.findMany({
            orderBy: { id: 'desc' },
            take: 3000,
          });
          const escalations = await this.prisma.ticketEscalation.findMany({
            orderBy: { id: 'desc' },
          });
          const comments = await this.prisma.ticketComment.findMany({
            orderBy: { id: 'desc' },
            take: 3000,
          });
          const feedback = await this.prisma.ticketFeedback.findMany({
            orderBy: { id: 'desc' },
          });

          data['Tickets'] = tickets;
          data['Ticket_Assignments'] = assignments;
          data['Ticket_History'] = history;
          data['Ticket_Escalations'] = escalations;
          data['Ticket_Comments'] = comments;
          data['Ticket_Feedback'] = feedback;
          break;
        }

        case 'subscriptions': {
          const subscriptions = await this.prisma.subscription.findMany({
            orderBy: { expiryDate: 'asc' },
          });
          const slaConfigs = await this.prisma.slaConfiguration.findMany({
            orderBy: { id: 'asc' },
          });
          data['AMC_Subscriptions'] = subscriptions;
          data['SLA_Configurations'] = slaConfigs;
          break;
        }

        case 'implementations': {
          const implementations = await this.prisma.implementation.findMany({
            orderBy: { createdAt: 'desc' },
          });
          const tasks = await this.prisma.implementationTask.findMany({
            orderBy: { orderIndex: 'asc' },
          });
          data['Implementations'] = implementations;
          data['Implementation_Tasks'] = tasks;
          break;
        }

        case 'prospects': {
          const prospects = await this.prisma.prospect.findMany({
            orderBy: { createdAt: 'desc' },
          });
          data['Prospects_Enquiries'] = prospects;
          break;
        }

        case 'tasks': {
          const tasks = await this.prisma.employeeTask.findMany({
            orderBy: { createdAt: 'desc' },
          });
          data['Employee_Tasks'] = tasks;
          break;
        }

        case 'chat': {
          if (user.role === 'ADMIN') {
            const conversations = await this.prisma.chatConversation.findMany({
              orderBy: { id: 'desc' },
            });
            const messages = await this.prisma.chatMessage.findMany({
              orderBy: { createdAt: 'desc' },
              take: 5000,
            });
            data['Chat_Conversations'] = conversations;
            data['Chat_Messages'] = messages;
          }
          break;
        }

        case 'audit': {
          if (user.role === 'ADMIN') {
            const auditLogs = await this.prisma.auditLog.findMany({
              orderBy: { createdAt: 'desc' },
              take: 5000,
            });
            const settings = await this.prisma.systemSetting.findMany({
              orderBy: { settingKey: 'asc' },
            });
            data['Audit_Logs'] = auditLogs;
            data['System_Settings'] = settings;
          }
          break;
        }
      }
    }

    return data;
  }

  /**
   * Generate downloadable export buffer in requested format (xlsx, csv, json)
   */
  async generateExportFile(
    moduleKey: string,
    format: 'xlsx' | 'csv' | 'json',
    user: { userId: number; role: string; email: string },
    ipAddress?: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string; totalRecords: number }> {
    const rawData = await this.getExportData(moduleKey, user);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let totalRecords = 0;

    Object.values(rawData).forEach((arr) => {
      totalRecords += arr.length;
    });

    // 1. JSON Backup Format
    if (format === 'json') {
      const backupPayload = {
        $schema: 'https://kanvtech.com/schemas/backup-v2.0.json',
        version: '2.0.0',
        backupType: 'KANVTECH_ENTERPRISE_APPLICATION_BACKUP',
        exportedAt: new Date().toISOString(),
        exportedBy: {
          userId: user.userId,
          email: user.email,
          role: user.role,
        },
        metadata: {
          platform: 'Kanvtech Service Management Platform',
          module: moduleKey,
          totalTables: Object.keys(rawData).length,
          totalRecords,
        },
        tables: rawData,
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const buffer = Buffer.from(jsonStr, 'utf-8');
      const fileName = `kanvtech_backup_${moduleKey}_${timestamp}.json`;

      await this.auditService.log({
        actorUserId: user.userId,
        action: 'DATA_EXPORT_JSON',
        entityType: 'Backup',
        entityId: moduleKey,
        newValues: { format: 'json', totalRecords, fileName },
        ipAddress,
      });

      return {
        buffer,
        fileName,
        mimeType: 'application/json; charset=utf-8',
        totalRecords,
      };
    }

    // 2. CSV Format
    if (format === 'csv') {
      let csvContent = '';
      const tableNames = Object.keys(rawData);

      if (tableNames.length === 1) {
        const ws = XLSX.utils.json_to_sheet(rawData[tableNames[0]]);
        csvContent = XLSX.utils.sheet_to_csv(ws);
      } else {
        // Multi-table composite CSV with structured section markers
        const parts: string[] = [];
        for (const tbl of tableNames) {
          parts.push(`=== TABLE: ${tbl} (${rawData[tbl].length} records) ===`);
          if (rawData[tbl].length > 0) {
            const ws = XLSX.utils.json_to_sheet(rawData[tbl]);
            parts.push(XLSX.utils.sheet_to_csv(ws));
          } else {
            parts.push('(No records)');
          }
          parts.push('\n');
        }
        csvContent = parts.join('\n');
      }

      const buffer = Buffer.from(csvContent, 'utf-8');
      const fileName = `kanvtech_${moduleKey}_${timestamp}.csv`;

      await this.auditService.log({
        actorUserId: user.userId,
        action: 'DATA_EXPORT_CSV',
        entityType: 'Export',
        entityId: moduleKey,
        newValues: { format: 'csv', totalRecords, fileName },
        ipAddress,
      });

      return {
        buffer,
        fileName,
        mimeType: 'text/csv; charset=utf-8',
        totalRecords,
      };
    }

    // 3. Excel (.xlsx) Format
    const workbook = XLSX.utils.book_new();

    for (const [sheetName, rows] of Object.entries(rawData)) {
      // Truncate sheet names to 31 chars (Excel limit)
      const safeSheetName = sheetName.slice(0, 31);
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Status: 'No records available' }]);

      // Add auto-width calculation for columns
      if (rows.length > 0) {
        const firstRow = rows[0];
        const colWidths = Object.keys(firstRow).map((key) => ({
          wch: Math.max(key.length, 12),
        }));
        ws['!cols'] = colWidths;
      }

      XLSX.utils.book_append_sheet(workbook, ws, safeSheetName);
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `kanvtech_${moduleKey}_${timestamp}.xlsx`;

    await this.auditService.log({
      actorUserId: user.userId,
      action: 'DATA_EXPORT_XLSX',
      entityType: 'Export',
      entityId: moduleKey,
      newValues: { format: 'xlsx', totalRecords, fileName, sheets: Object.keys(rawData) },
      ipAddress,
    });

    return {
      buffer,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      totalRecords,
    };
  }

  /**
   * Validate a structured JSON backup file and produce a dry-run preview
   */
  async validateAndPreviewRestore(backupPayload: any) {
    if (!backupPayload || typeof backupPayload !== 'object') {
      throw new BadRequestException('Invalid JSON payload: root must be an object.');
    }

    if (
      backupPayload.backupType !== 'KANVTECH_ENTERPRISE_APPLICATION_BACKUP' &&
      !backupPayload.tables &&
      !backupPayload.data
    ) {
      throw new BadRequestException(
        'Incompatible backup file. Expected backupType "KANVTECH_ENTERPRISE_APPLICATION_BACKUP".',
      );
    }

    const tables = backupPayload.tables || backupPayload.data || {};
    const tableKeys = Object.keys(tables);

    if (tableKeys.length === 0) {
      throw new BadRequestException('The uploaded backup file does not contain any data tables.');
    }

    const previewResults: Array<{
      tableName: string;
      totalRecords: number;
      wouldCreate: number;
      wouldUpdate: number;
      sampleIds: string[];
    }> = [];

    let grandTotal = 0;
    let totalWouldCreate = 0;
    let totalWouldUpdate = 0;
    const validationIssues: string[] = [];

    // Analyze Products
    if (tables['Products'] && Array.isArray(tables['Products'])) {
      const records = tables['Products'];
      grandTotal += records.length;
      const codes = records.map((r) => r.code).filter(Boolean);
      const existing = await this.prisma.product.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      });
      const existingSet = new Set(existing.map((e) => e.code));
      const wouldUpdate = records.filter((r) => existingSet.has(r.code)).length;
      const wouldCreate = records.length - wouldUpdate;
      totalWouldCreate += wouldCreate;
      totalWouldUpdate += wouldUpdate;

      previewResults.push({
        tableName: 'Products',
        totalRecords: records.length,
        wouldCreate,
        wouldUpdate,
        sampleIds: codes.slice(0, 5),
      });
    }

    // Analyze Companies
    if (tables['Companies'] && Array.isArray(tables['Companies'])) {
      const records = tables['Companies'];
      grandTotal += records.length;
      const ids = records.map((r) => r.id).filter(Boolean);
      const existing = await this.prisma.company.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((e) => e.id));
      const wouldUpdate = records.filter((r) => existingSet.has(r.id)).length;
      const wouldCreate = records.length - wouldUpdate;
      totalWouldCreate += wouldCreate;
      totalWouldUpdate += wouldUpdate;

      previewResults.push({
        tableName: 'Companies',
        totalRecords: records.length,
        wouldCreate,
        wouldUpdate,
        sampleIds: ids.slice(0, 5),
      });
    }

    // Analyze Departments
    if (tables['Departments'] && Array.isArray(tables['Departments'])) {
      const records = tables['Departments'];
      grandTotal += records.length;
      const codes = records.map((r) => r.code).filter(Boolean);
      const existing = await this.prisma.department.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      });
      const existingSet = new Set(existing.map((e) => e.code));
      const wouldUpdate = records.filter((r) => existingSet.has(r.code)).length;
      const wouldCreate = records.length - wouldUpdate;
      totalWouldCreate += wouldCreate;
      totalWouldUpdate += wouldUpdate;

      previewResults.push({
        tableName: 'Departments',
        totalRecords: records.length,
        wouldCreate,
        wouldUpdate,
        sampleIds: codes.slice(0, 5),
      });
    }

    // Analyze Employees
    if (tables['Employees'] && Array.isArray(tables['Employees'])) {
      const records = tables['Employees'];
      grandTotal += records.length;
      const ids = records.map((r) => r.id).filter(Boolean);
      const existing = await this.prisma.employee.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((e) => e.id));
      const wouldUpdate = records.filter((r) => existingSet.has(r.id)).length;
      const wouldCreate = records.length - wouldUpdate;
      totalWouldCreate += wouldCreate;
      totalWouldUpdate += wouldUpdate;

      previewResults.push({
        tableName: 'Employees',
        totalRecords: records.length,
        wouldCreate,
        wouldUpdate,
        sampleIds: ids.slice(0, 5),
      });
    }

    // Analyze Tickets
    if (tables['Tickets'] && Array.isArray(tables['Tickets'])) {
      const records = tables['Tickets'];
      grandTotal += records.length;
      const ids = records.map((r) => r.id).filter(Boolean);
      const existing = await this.prisma.ticket.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((e) => e.id));
      const wouldUpdate = records.filter((r) => existingSet.has(r.id)).length;
      const wouldCreate = records.length - wouldUpdate;
      totalWouldCreate += wouldCreate;
      totalWouldUpdate += wouldUpdate;

      previewResults.push({
        tableName: 'Tickets',
        totalRecords: records.length,
        wouldCreate,
        wouldUpdate,
        sampleIds: ids.slice(0, 5),
      });
    }

    // Generic count for remaining tables
    for (const [name, arr] of Object.entries(tables)) {
      if (!['Products', 'Companies', 'Departments', 'Employees', 'Tickets'].includes(name) && Array.isArray(arr)) {
        grandTotal += arr.length;
        previewResults.push({
          tableName: name,
          totalRecords: arr.length,
          wouldCreate: arr.length,
          wouldUpdate: 0,
          sampleIds: arr.slice(0, 3).map((item) => (item.id !== undefined ? String(item.id) : name)),
        });
        totalWouldCreate += arr.length;
      }
    }

    return {
      isValid: true,
      backupVersion: backupPayload.version || '2.0.0',
      exportedAt: backupPayload.exportedAt || null,
      exportedBy: backupPayload.exportedBy?.email || 'Authorized Backup Administrator',
      summary: {
        totalTables: previewResults.length,
        totalRecords: grandTotal,
        wouldCreate: totalWouldCreate,
        wouldUpdate: totalWouldUpdate,
        validationIssues,
      },
      previewResults,
    };
  }

  /**
   * Commit a validated JSON backup restore using transaction and dependency preservation
   */
  async commitRestore(
    backupPayload: any,
    user: { userId: number; role: string; email: string },
    ipAddress?: string,
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only Administrators are authorized to perform system data recovery/restore.');
    }

    const preview = await this.validateAndPreviewRestore(backupPayload);
    const tables = backupPayload.tables || backupPayload.data || {};
    let restoredCount = 0;

    // Execute within Prisma interactive transaction with safe upserts
    await this.prisma.$transaction(async (tx) => {
      // 1. Restore Products
      if (tables['Products'] && Array.isArray(tables['Products'])) {
        for (const item of tables['Products']) {
          if (!item.code || !item.name) continue;
          await tx.product.upsert({
            where: { code: item.code },
            update: {
              name: item.name,
              category: item.category || 'General',
              description: item.description,
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id || `PROD-${Date.now()}`,
              code: item.code,
              name: item.name,
              category: item.category || 'General',
              description: item.description,
              isActive: item.isActive ?? true,
            },
          });
          restoredCount++;
        }
      }

      // 2. Restore Product Modules
      if (tables['Product_Modules'] && Array.isArray(tables['Product_Modules'])) {
        for (const item of tables['Product_Modules']) {
          if (!item.id || !item.productId || !item.name) continue;
          const parentExists = await tx.product.findUnique({ where: { id: item.productId } });
          if (!parentExists) continue;

          await tx.productModule.upsert({
            where: { id: item.id },
            update: {
              name: item.name,
              description: item.description,
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id,
              productId: item.productId,
              name: item.name,
              description: item.description,
              isActive: item.isActive ?? true,
            },
          });
          restoredCount++;
        }
      }

      // 3. Restore Departments
      if (tables['Departments'] && Array.isArray(tables['Departments'])) {
        for (const item of tables['Departments']) {
          if (!item.code || !item.name) continue;
          await tx.department.upsert({
            where: { code: item.code },
            update: {
              name: item.name,
              description: item.description,
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id || `DEP-${Date.now()}`,
              code: item.code,
              name: item.name,
              description: item.description,
              isActive: item.isActive ?? true,
            },
          });
          restoredCount++;
        }
      }

      // 4. Restore Companies
      if (tables['Companies'] && Array.isArray(tables['Companies'])) {
        for (const item of tables['Companies']) {
          if (!item.id || !item.companyName) continue;
          await tx.company.upsert({
            where: { id: item.id },
            update: {
              companyName: item.companyName,
              address: item.address || 'Address not specified',
              gstn: item.gstn,
              primaryEmail: item.primaryEmail,
              contactPerson: item.contactPerson || 'Contact Person',
              contactPhone: item.contactPhone || 'Phone',
              isActive: item.isActive ?? true,
            },
            create: {
              id: item.id,
              companyName: item.companyName,
              address: item.address || 'Address not specified',
              gstn: item.gstn,
              primaryEmail: item.primaryEmail,
              contactPerson: item.contactPerson || 'Contact Person',
              contactPhone: item.contactPhone || 'Phone',
              isActive: item.isActive ?? true,
            },
          });
          restoredCount++;
        }
      }

      // 5. Restore SLA Configurations
      if (tables['SLA_Configurations'] && Array.isArray(tables['SLA_Configurations'])) {
        for (const item of tables['SLA_Configurations']) {
          if (!item.priority) continue;
          await tx.slaConfiguration.upsert({
            where: { priority: item.priority },
            update: {
              responseTimeHours: Number(item.responseTimeHours) || 4,
              resolutionTimeHours: Number(item.resolutionTimeHours) || 24,
              warningThresholdPercent: Number(item.warningThresholdPercent) || 75,
              isActive: item.isActive ?? true,
            },
            create: {
              priority: item.priority,
              responseTimeHours: Number(item.responseTimeHours) || 4,
              resolutionTimeHours: Number(item.resolutionTimeHours) || 24,
              warningThresholdPercent: Number(item.warningThresholdPercent) || 75,
              isActive: item.isActive ?? true,
            },
          });
          restoredCount++;
        }
      }

      // 6. Restore Prospects
      if (tables['Prospects_Enquiries'] && Array.isArray(tables['Prospects_Enquiries'])) {
        for (const item of tables['Prospects_Enquiries']) {
          if (!item.id || !item.companyName || !item.email) continue;
          await tx.prospect.upsert({
            where: { id: item.id },
            update: {
              companyName: item.companyName,
              contactPerson: item.contactPerson,
              phone: item.phone,
              email: item.email,
              status: item.status || 'ENQUIRY',
              notes: item.notes,
            },
            create: {
              id: item.id,
              companyName: item.companyName,
              contactPerson: item.contactPerson,
              phone: item.phone,
              email: item.email,
              status: item.status || 'ENQUIRY',
              notes: item.notes,
            },
          });
          restoredCount++;
        }
      }
    });

    await this.auditService.log({
      actorUserId: user.userId,
      action: 'DATA_RESTORE_APPLIED',
      entityType: 'Restore',
      entityId: 'SYSTEM',
      newValues: {
        restoredCount,
        tablesRestored: preview.previewResults.map((p) => p.tableName),
        sourceVersion: preview.backupVersion,
      },
      ipAddress,
    });

    return {
      success: true,
      restoredCount,
      message: `System data restore completed successfully. ${restoredCount} core business records were safely verified and restored.`,
    };
  }
}
