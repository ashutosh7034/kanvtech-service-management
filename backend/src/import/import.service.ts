import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { EmployeesService } from '../employees/employees.service';
import { UserRole, EmployeeLevel, ImplementationStatus } from '@prisma/client';

export interface ImportError {
  rowNumber: number;
  field: string;
  value: any;
  message: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errors: ImportError[];
  previewRows: any[];
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly employeesService: EmployeesService,
  ) {}

  generateTemplate(type: string): Buffer {
    let headers: string[] = [];
    let sampleData: any[] = [];
    let instructions: string[][] = [];

    switch (type.toLowerCase()) {
      case 'products':
        headers = ['Product Code', 'Product Name', 'Category', 'Description', 'Status'];
        sampleData = [
          ['TALLY', 'Tally Prime ERP', 'ERP & Accounting', 'Comprehensive enterprise accounting software', 'ACTIVE'],
          ['SPINE', 'Spine HR & Payroll', 'HR & Payroll', 'End-to-end human resources and payroll management', 'ACTIVE'],
          ['BIOS360', 'BIOS 360 Security', 'Security & Access', 'Biometric identity & access control platform', 'ACTIVE'],
        ];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Product Code', 'YES', 'Unique alphanumeric identifier for the product', 'TALLY, SPINE, BIOS360'],
          ['Product Name', 'YES', 'Full descriptive name of the software product', 'Tally Prime ERP, Spine HR & Payroll'],
          ['Category', 'NO', 'Functional product categorization', 'ERP & Accounting, HR & Payroll, Security'],
          ['Description', 'NO', 'Overview of product capabilities', 'Enterprise software overview'],
          ['Status', 'NO', 'Initial product availability status', 'ACTIVE, INACTIVE'],
        ];
        break;

      case 'departments':
        headers = ['Department Name', 'Department Code', 'Product Code', 'Description', 'Status'];
        sampleData = [
          ['Tally Support Department', 'DEP-TALLY', 'TALLY', 'Specialized L1-L3 technical team for Tally', 'ACTIVE'],
          ['Spine HR Department', 'DEP-SPINE', 'SPINE', 'Dedicated payroll & HR solutions support', 'ACTIVE'],
          ['BIOS 360 Department', 'DEP-BIOS360', 'BIOS360', 'Biometric & security devices support group', 'ACTIVE'],
        ];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Department Name', 'YES', 'Name of the operational support department', 'Tally Support Department'],
          ['Department Code', 'YES', 'Unique department identifier code', 'DEP-TALLY, DEP-SPINE'],
          ['Product Code', 'YES', 'Dedicated product specialization for this department', 'TALLY, SPINE, BIOS360'],
          ['Description', 'NO', 'Department scope & service description', 'Specialized L1-L3 technical support'],
          ['Status', 'NO', 'Department active status', 'ACTIVE, INACTIVE'],
        ];
        break;

      case 'employees':
        headers = ['Full Name', 'Email Address', 'Phone Number', 'Department Code', 'Designation', 'Support Level', 'Manager ID'];
        sampleData = [
          ['Devendra Rao', 'devendra.rao@kanvtech.com', '+91 98110 33445', 'DEP-TALLY', 'L1 Support Specialist', 'L1', ''],
          ['Vikram Malhotra', 'vikram.m@kanvtech.com', '+91 98220 33445', 'DEP-SPINE', 'L2 Senior Specialist', 'L2', ''],
          ['Priya Nair', 'priya.nair@kanvtech.com', '+91 98330 55667', 'DEP-BIOS360', 'L3 Escalation Lead', 'L3', ''],
        ];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Full Name', 'YES', 'Employee full name', 'Amit Sharma'],
          ['Email Address', 'YES', 'Unique corporate email used for login', 'amit.sharma@kanvtech.com'],
          ['Phone Number', 'YES', 'Contact phone number', '+91 98220 12345'],
          ['Department Code', 'YES', 'CRITICAL: One employee = exactly one department', 'DEP-TALLY, DEP-SPINE'],
          ['Designation', 'NO', 'Job role title', 'Support Specialist, Technical Lead'],
          ['Support Level', 'YES', 'Technical operational tier', 'L1, L2, L3, MANAGER'],
          ['Manager ID', 'NO', 'Optional ID of reporting manager', 'EMP-001'],
        ];
        break;

      case 'companies':
      case 'customers':
        headers = [
          'Company Name',
          'Address',
          'GSTN',
          'Primary Email',
          'Contact Person',
          'Contact Phone',
          'Product Codes (Comma-separated)',
          'Alternate Contact',
          'Alternate Contact Phone',
          'Alternate Contact Email',
        ];
        sampleData = [
          [
            'Apex Cloud Solutions Pvt Ltd',
            'Plot 45, Phase 1, Industrial Area, Mumbai 400068',
            '27AAACA9988G1Z1',
            'contact@apexcloud.com',
            'Suresh Kulkarni',
            '+91 98220 12345',
            'TALLY, SPINE',
            'Ramesh Deshmukh',
            '+91 98220 54321',
            'ramesh@apexcloud.com',
          ],
        ];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Company Name', 'YES', 'Full legal business / organization name', 'Apex Cloud Solutions Pvt Ltd'],
          ['Address', 'YES', 'Registered office address', 'Plot 45, Industrial Area, Mumbai'],
          ['GSTN', 'NO', '15-character Goods & Services Tax Number', '27AAACA9988G1Z1'],
          ['Primary Email', 'YES', 'Primary company email (Customer login account created automatically)', 'contact@apexcloud.com'],
          ['Contact Person', 'YES', 'Primary administrative contact name', 'Suresh Kulkarni'],
          ['Contact Phone', 'YES', 'Primary contact telephone number', '+91 98220 12345'],
          ['Product Codes (Comma-separated)', 'YES', 'CRITICAL: At least 1 product required. Multiple products comma-separated', 'TALLY, SPINE, BIOS360'],
          ['Alternate Contact', 'NO', 'Secondary contact person', 'Ramesh Deshmukh'],
          ['Alternate Contact Phone', 'NO', 'Secondary contact phone', '+91 98220 54321'],
          ['Alternate Contact Email', 'NO', 'Secondary contact email', 'ramesh@apexcloud.com'],
        ];
        break;

      case 'branches':
        headers = [
          'Customer ID / Email',
          'Branch Name',
          'Address',
          'City',
          'State',
          'PIN Code',
          'Contact Person',
          'Contact Phone',
          'Contact Email',
          'Branch Product Codes (Comma-separated)',
        ];
        sampleData = [
          [
            'contact@apexcloud.com',
            'Dahisar Branch',
            'Dahisar East, Mumbai, Maharashtra',
            'Mumbai',
            'Maharashtra',
            '400068',
            'Rahul Sharma',
            '+91 98220 11223',
            'rahul@apexcloud.com',
            'TALLY, SPINE',
          ],
          [
            'CMP-0001',
            'Kandivali Branch',
            'Kandivali West, Mumbai, Maharashtra',
            'Mumbai',
            'Maharashtra',
            '400067',
            'Pooja Jain',
            '+91 98220 44556',
            'pooja@apexcloud.com',
            'TALLY',
          ],
        ];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Customer ID / Email', 'YES', 'Parent customer identifier. Accepts either generated Customer ID (CMP-0001) or Primary Email (contact@apexcloud.com). Customer must already exist.', 'CMP-0001 OR contact@apexcloud.com'],
          ['Branch Name', 'YES', 'Descriptive name of branch location', 'Dahisar Branch, Kandivali Branch'],
          ['Address', 'YES', 'Physical branch address', 'Dahisar East, Mumbai, Maharashtra'],
          ['City', 'YES', 'Branch city name', 'Mumbai, Pune, Ahmedabad'],
          ['State', 'YES', 'Branch state name', 'Maharashtra, Gujarat'],
          ['PIN Code', 'NO', 'Postal area code', '400068'],
          ['Contact Person', 'YES', 'Branch point of contact', 'Rahul Sharma'],
          ['Contact Phone', 'YES', 'Branch contact phone', '+91 98220 11223'],
          ['Contact Email', 'NO', 'Branch contact email', 'rahul@apexcloud.com'],
          ['Branch Product Codes (Comma-separated)', 'NO', 'CRITICAL: Branch products must be a subset of customer-owned products. Products not owned by customer will be rejected.', 'TALLY, SPINE'],
        ];
        break;

      case 'customer_products':
        headers = ['Customer ID / Email', 'Product Code', 'Notes'];
        sampleData = [['contact@apexcloud.com', 'TALLY', 'Enterprise Subscription']];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Customer ID / Email', 'YES', 'Customer ID or Primary Email', 'CMP-0001, contact@apexcloud.com'],
          ['Product Code', 'YES', 'Product code from Product Master', 'TALLY, SPINE, BIOS360'],
          ['Notes', 'NO', 'Contract or license notes', 'Additional license'],
        ];
        break;

      case 'branch_products':
        headers = ['Branch ID', 'Product Code'];
        sampleData = [['BR-0001', 'TALLY']];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Branch ID', 'YES', 'Branch ID code', 'BR-0001'],
          ['Product Code', 'YES', 'Product code from Product Master', 'TALLY, SPINE'],
        ];
        break;

      case 'subscriptions':
        headers = ['Customer ID / Email', 'Product Code', 'Plan Name', 'Start Date (YYYY-MM-DD)', 'Expiry Date (YYYY-MM-DD)'];
        sampleData = [['contact@apexcloud.com', 'TALLY', 'Annual Maintenance Contract', '2026-01-01', '2026-12-31']];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Customer ID / Email', 'YES', 'Customer ID or Primary Email', 'CMP-0001, contact@apexcloud.com'],
          ['Product Code', 'YES', 'Product code for AMC', 'TALLY, SPINE'],
          ['Plan Name', 'YES', 'Contract plan name', 'Gold AMC, Platinum AMC'],
          ['Start Date (YYYY-MM-DD)', 'YES', 'Subscription start date', '2026-01-01'],
          ['Expiry Date (YYYY-MM-DD)', 'YES', 'Subscription expiration date', '2026-12-31'],
        ];
        break;

      case 'implementations':
        headers = ['Customer ID / Email', 'Product Code', 'Start Date (YYYY-MM-DD)', 'Target Go-Live Date (YYYY-MM-DD)', 'Status', 'Pending Activities'];
        sampleData = [['contact@apexcloud.com', 'TALLY', '2026-04-01', '2026-06-30', 'PLANNING', 'Server setup, data migration']];
        instructions = [
          ['Field Name', 'Required', 'Description', 'Allowed / Example Values'],
          ['Customer ID / Email', 'YES', 'Customer ID or Primary Email', 'CMP-0001, contact@apexcloud.com'],
          ['Product Code', 'YES', 'Product code for implementation project', 'TALLY, SPINE'],
          ['Start Date (YYYY-MM-DD)', 'YES', 'Project kickoff date', '2026-04-01'],
          ['Target Go-Live Date (YYYY-MM-DD)', 'YES', 'Target go-live milestone date', '2026-06-30'],
          ['Status', 'NO', 'Initial implementation status', 'NEW, PLANNING, IN_PROGRESS, UAT, LIVE'],
          ['Pending Activities', 'NO', 'Key pending deliverables', 'Server setup, data migration'],
        ];
        break;

      default:
        throw new BadRequestException(`Unknown template type '${type}'`);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type.toUpperCase());

    if (instructions.length > 0) {
      const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'INSTRUCTIONS');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // --- PRODUCTS IMPORT ---
  async validateProductImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const errors: ImportError[] = [];
    const validRows: any[] = [];
    const seenCodes = new Set<string>();

    const existingProds = await this.prisma.product.findMany({ select: { code: true } });
    const dbCodes = new Set(existingProds.map((p) => p.code.toUpperCase()));
    let duplicateCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;
      const code = String(row['Product Code'] || row['product_code'] || row['code'] || '').trim().toUpperCase();
      const name = String(row['Product Name'] || row['product_name'] || row['name'] || '').trim();
      const category = String(row['Category'] || row['category'] || 'Software').trim();
      const description = String(row['Description'] || row['description'] || '').trim();

      let hasError = false;
      if (!code) {
        errors.push({ rowNumber: rowNum, field: 'Product Code', value: code, message: 'Product code is required' });
        hasError = true;
      } else if (seenCodes.has(code) || dbCodes.has(code)) {
        errors.push({ rowNumber: rowNum, field: 'Product Code', value: code, message: 'Duplicate product code' });
        duplicateCount++;
        hasError = true;
      } else {
        seenCodes.add(code);
      }

      if (!name) {
        errors.push({ rowNumber: rowNum, field: 'Product Name', value: name, message: 'Product name is required' });
        hasError = true;
      }

      if (!hasError) {
        validRows.push({ code, name, category, description, isActive: true });
      }
    }

    return {
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: rawRows.length - validRows.length,
      duplicateCount,
      errors,
      previewRows: validRows.slice(0, 10),
    };
  }

  async commitProductImport(rows: any[], actorUserId?: number): Promise<{ importedCount: number }> {
    let importedCount = 0;
    for (const row of rows) {
      const nextSeq = await this.prisma.getNextSequence('PRODUCT_SEQ');
      const id = `PROD-${String(nextSeq).padStart(4, '0')}`;
      await this.prisma.product.upsert({
        where: { code: row.code },
        update: { name: row.name, category: row.category, description: row.description, isActive: true },
        create: { id, code: row.code, name: row.name, category: row.category, description: row.description, isActive: true },
      });
      importedCount++;
    }
    return { importedCount };
  }

  // --- DEPARTMENTS IMPORT ---
  async validateDepartmentImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const errors: ImportError[] = [];
    const validRows: any[] = [];
    const seenCodes = new Set<string>();

    const existingDepts = await this.prisma.department.findMany({ select: { code: true, name: true } });
    const dbCodes = new Set(existingDepts.map((d) => d.code.toUpperCase()));
    const dbNames = new Set(existingDepts.map((d) => d.name.toLowerCase()));
    let duplicateCount = 0;

    const products = await this.prisma.product.findMany({ select: { id: true, code: true } });
    const productCodeMap = new Map(products.map((p) => [p.code.toUpperCase(), p.id]));

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;
      const name = String(row['Department Name'] || row['department_name'] || row['name'] || '').trim();
      const code = String(row['Department Code'] || row['department_code'] || row['code'] || '').trim().toUpperCase();
      const productCode = String(row['Product Code'] || row['product_code'] || '').trim().toUpperCase();
      const description = String(row['Description'] || row['description'] || '').trim();

      let hasError = false;
      if (!name) {
        errors.push({ rowNumber: rowNum, field: 'Department Name', value: name, message: 'Department name is required' });
        hasError = true;
      } else if (dbNames.has(name.toLowerCase())) {
        errors.push({ rowNumber: rowNum, field: 'Department Name', value: name, message: 'Department with this name already exists' });
        duplicateCount++;
        hasError = true;
      }

      if (!code) {
        errors.push({ rowNumber: rowNum, field: 'Department Code', value: code, message: 'Department code is required' });
        hasError = true;
      } else if (seenCodes.has(code) || dbCodes.has(code)) {
        errors.push({ rowNumber: rowNum, field: 'Department Code', value: code, message: 'Duplicate department code' });
        duplicateCount++;
        hasError = true;
      } else {
        seenCodes.add(code);
      }

      let productId: string | null = null;
      if (productCode) {
        productId = productCodeMap.get(productCode) || null;
        if (!productId) {
          errors.push({ rowNumber: rowNum, field: 'Product Code', value: productCode, message: `Product '${productCode}' not found` });
          hasError = true;
        }
      }

      if (!hasError) {
        validRows.push({ name, code, productId, description, isActive: true });
      }
    }

    return {
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: rawRows.length - validRows.length,
      duplicateCount,
      errors,
      previewRows: validRows.slice(0, 10),
    };
  }

  async commitDepartmentImport(rows: any[], actorUserId?: number): Promise<{ importedCount: number }> {
    let importedCount = 0;
    for (const row of rows) {
      const nextSeq = await this.prisma.getNextSequence('DEPARTMENT_SEQ');
      const id = `DEP-${String(nextSeq).padStart(4, '0')}`;
      await this.prisma.department.create({
        data: { id, name: row.name, code: row.code, productId: row.productId || null, description: row.description || null, isActive: true },
      });
      importedCount++;
    }
    return { importedCount };
  }

  // --- EMPLOYEES IMPORT ---
  async validateEmployeeImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const errors: ImportError[] = [];
    const validRows: any[] = [];
    const seenEmails = new Set<string>();
    let duplicateCount = 0;

    const existingUsers = await this.prisma.user.findMany({ select: { email: true } });
    const dbEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const departments = await this.prisma.department.findMany({ select: { id: true, code: true, name: true } });
    const deptMap = new Map<string, { id: string; name: string }>();
    for (const d of departments) {
      deptMap.set(d.id.toLowerCase(), { id: d.id, name: d.name });
      deptMap.set(d.code.toLowerCase(), { id: d.id, name: d.name });
      deptMap.set(d.name.toLowerCase(), { id: d.id, name: d.name });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validLevels = ['L1', 'L2', 'L3', 'MANAGER'];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const name = String(row['Full Name'] || row['name'] || '').trim();
      const email = String(row['Email Address'] || row['email'] || '').trim().toLowerCase();
      const phone = String(row['Phone Number'] || row['phone'] || '').trim();
      const rawDept = String(row['Department Code'] || row['Department'] || row['department'] || '').trim();
      const designation = String(row['Designation'] || row['designation'] || '').trim();
      const level = String(row['Support Level'] || row['level'] || 'L1').trim().toUpperCase();
      const managerId = String(row['Manager ID'] || row['manager_id'] || '').trim();

      let hasError = false;

      if (!name) {
        errors.push({ rowNumber: rowNum, field: 'Full Name', value: name, message: 'Name is required' });
        hasError = true;
      }

      if (!email || !emailRegex.test(email)) {
        errors.push({ rowNumber: rowNum, field: 'Email Address', value: email, message: 'Valid email is required' });
        hasError = true;
      } else if (seenEmails.has(email) || dbEmails.has(email)) {
        errors.push({ rowNumber: rowNum, field: 'Email Address', value: email, message: 'Duplicate email address' });
        duplicateCount++;
        hasError = true;
      } else {
        seenEmails.add(email);
      }

      if (!phone) {
        errors.push({ rowNumber: rowNum, field: 'Phone Number', value: phone, message: 'Phone is required' });
        hasError = true;
      }

      if (!validLevels.includes(level)) {
        errors.push({ rowNumber: rowNum, field: 'Support Level', value: level, message: 'Level must be L1, L2, L3, or MANAGER' });
        hasError = true;
      }

      // Department mapping: ONE EMPLOYEE = EXACTLY ONE DEPARTMENT
      let departmentId: string | null = null;
      let departmentName = rawDept;
      if (rawDept) {
        const found = deptMap.get(rawDept.toLowerCase());
        if (found) {
          departmentId = found.id;
          departmentName = found.name;
        } else {
          // If no department found, we can map to first available or flag error
          const fallback = departments[0];
          if (fallback) {
            departmentId = fallback.id;
            departmentName = fallback.name;
          }
        }
      } else {
        const fallback = departments[0];
        if (fallback) {
          departmentId = fallback.id;
          departmentName = fallback.name;
        }
      }

      if (!hasError) {
        validRows.push({
          name,
          email,
          phone,
          department: departmentName,
          department_id: departmentId,
          designation: designation || `${level} Specialist`,
          level: level as 'L1' | 'L2' | 'L3' | 'MANAGER',
          manager_id: managerId || null,
        });
      }
    }

    return {
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: rawRows.length - validRows.length,
      duplicateCount,
      errors,
      previewRows: validRows.slice(0, 10),
    };
  }

  async commitEmployeeImport(rows: any[], actorUserId?: number): Promise<{ importedCount: number }> {
    let importedCount = 0;
    for (const row of rows) {
      await this.employeesService.createEmployee(row, actorUserId);
      importedCount++;
    }
    return { importedCount };
  }

  // --- CUSTOMERS / COMPANIES IMPORT ---
  async validateCompanyImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const errors: ImportError[] = [];
    const validRows: any[] = [];
    const seenEmails = new Set<string>();
    let duplicateCount = 0;

    const existingCompanies = await this.prisma.company.findMany({
      select: { primaryEmail: true, gstn: true },
    });
    const dbEmails = new Set(existingCompanies.map((c) => c.primaryEmail.toLowerCase()));
    const dbGstns = new Set(existingCompanies.map((c) => c.gstn?.toUpperCase()).filter(Boolean));

    const products = await this.prisma.product.findMany({ select: { id: true, code: true, name: true } });
    const productLookup = new Map<string, string>();
    for (const p of products) {
      productLookup.set(p.id.toLowerCase(), p.id);
      productLookup.set(p.code.toLowerCase(), p.id);
      productLookup.set(`prod-${p.code.toLowerCase()}`, p.id);
      productLookup.set(p.name.toLowerCase(), p.id);
      productLookup.set(p.name.toLowerCase().replace(/[^a-z0-9]/g, ''), p.id);
      productLookup.set(p.code.toLowerCase().replace(/[^a-z0-9]/g, ''), p.id);
    }
    const defaultProduct = products[0]?.id;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const gstnRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const companyName = String(row['Company Name'] || row['company_name'] || '').trim();
      const address = String(row['Address'] || row['address'] || '').trim();
      const primaryEmail = String(row['Primary Email'] || row['primary_email'] || '').trim().toLowerCase();
      const contactPerson = String(row['Contact Person'] || row['contact_person'] || '').trim();
      const contactPhone = String(row['Contact Phone'] || row['contact_phone'] || '').trim();
      const gstn = String(row['GSTN'] || row['gstn'] || '').trim().toUpperCase();
      const rawProducts = String(row['Product Codes (Comma-separated)'] || row['Products'] || row['products'] || '').trim();

      let rowHasError = false;

      if (!companyName) {
        errors.push({ rowNumber: rowNum, field: 'Company Name', value: companyName, message: 'Company name is required' });
        rowHasError = true;
      }

      if (!address) {
        errors.push({ rowNumber: rowNum, field: 'Address', value: address, message: 'Address is required' });
        rowHasError = true;
      }

      if (!primaryEmail || !emailRegex.test(primaryEmail)) {
        errors.push({ rowNumber: rowNum, field: 'Primary Email', value: primaryEmail, message: 'Valid primary email is required' });
        rowHasError = true;
      } else if (seenEmails.has(primaryEmail) || dbEmails.has(primaryEmail)) {
        errors.push({ rowNumber: rowNum, field: 'Primary Email', value: primaryEmail, message: 'Duplicate email (already exists)' });
        duplicateCount++;
        rowHasError = true;
      } else {
        seenEmails.add(primaryEmail);
      }

      if (!contactPerson) {
        errors.push({ rowNumber: rowNum, field: 'Contact Person', value: contactPerson, message: 'Contact person is required' });
        rowHasError = true;
      }

      if (!contactPhone) {
        errors.push({ rowNumber: rowNum, field: 'Contact Phone', value: contactPhone, message: 'Contact phone is required' });
        rowHasError = true;
      }

      if (gstn && !gstnRegex.test(gstn)) {
        errors.push({ rowNumber: rowNum, field: 'GSTN', value: gstn, message: 'Invalid GSTN format (Expected: 15 alphanumeric characters)' });
        rowHasError = true;
      } else if (gstn && dbGstns.has(gstn)) {
        errors.push({ rowNumber: rowNum, field: 'GSTN', value: gstn, message: 'Duplicate GSTN (already registered)' });
        duplicateCount++;
        rowHasError = true;
      }

      // MANDATORY PRODUCT SELECTION:
      const matchedProductIds: string[] = [];
      if (rawProducts) {
        const parts = rawProducts.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        for (const p of parts) {
          const matched = productLookup.get(p);
          if (matched) {
            matchedProductIds.push(matched);
          } else {
            errors.push({ rowNumber: rowNum, field: 'Products', value: p, message: `Product '${p}' not recognized` });
            rowHasError = true;
          }
        }
      } else if (defaultProduct) {
        matchedProductIds.push(defaultProduct);
      } else {
        errors.push({ rowNumber: rowNum, field: 'Products', value: '', message: 'Customer must have at least one product purchased' });
        rowHasError = true;
      }

      if (!rowHasError) {
        validRows.push({
          company_name: companyName,
          address,
          primary_email: primaryEmail,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          gstn: gstn || null,
          product_ids: matchedProductIds,
          alternate_contact: row['Alternate Contact'] || null,
          alternate_contact_phone: row['Alternate Contact Phone'] || null,
          alternate_contact_email: row['Alternate Contact Email'] || null,
        });
      }
    }

    return {
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: rawRows.length - validRows.length,
      duplicateCount,
      errors,
      previewRows: validRows.slice(0, 10),
    };
  }

  async commitCompanyImport(rows: any[], actorUserId?: number): Promise<{ importedCount: number }> {
    let importedCount = 0;
    for (const row of rows) {
      await this.companiesService.createCompany(row, actorUserId);
      importedCount++;
    }
    return { importedCount };
  }

  // --- BRANCHES IMPORT ---
  async validateBranchImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const errors: ImportError[] = [];
    const validRows: any[] = [];

    const companies = await this.prisma.company.findMany({
      include: { products: { where: { isActive: true }, include: { product: true } } },
    });
    const companyMap = new Map<string, typeof companies[0]>();
    for (const c of companies) {
      companyMap.set(c.id.toLowerCase(), c);
      companyMap.set(c.primaryEmail.toLowerCase(), c);
      companyMap.set(c.companyName.toLowerCase(), c);
    }

    const products = await this.prisma.product.findMany({ select: { id: true, code: true, name: true } });
    const productLookup = new Map<string, string>();
    for (const p of products) {
      productLookup.set(p.id.toLowerCase(), p.id);
      productLookup.set(p.code.toLowerCase(), p.id);
      productLookup.set(`prod-${p.code.toLowerCase()}`, p.id);
      productLookup.set(p.name.toLowerCase(), p.id);
      productLookup.set(p.name.toLowerCase().replace(/[^a-z0-9]/g, ''), p.id);
      productLookup.set(p.code.toLowerCase().replace(/[^a-z0-9]/g, ''), p.id);
    }

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const customerRef = String(
        row['Customer ID / Email'] ||
        row['Customer ID'] ||
        row['Customer Email'] ||
        row['Customer'] ||
        row['customer_id'] ||
        row['company_id'] ||
        row['Primary Email'] ||
        row['primary_email'] ||
        row['email'] ||
        ''
      ).trim();
      const branchName = String(row['Branch Name'] || row['branch_name'] || row['Name'] || row['name'] || '').trim();
      const address = String(row['Address'] || row['address'] || row['Branch Address'] || '').trim();
      const city = String(row['City'] || row['city'] || '').trim();
      const state = String(row['State'] || row['state'] || '').trim();
      const pincode = String(row['PIN Code'] || row['pincode'] || row['PIN'] || row['postal_code'] || '').trim();
      const contactPerson = String(row['Contact Person'] || row['contact_person'] || row['Contact Name'] || '').trim();
      const contactPhone = String(row['Contact Phone'] || row['contact_phone'] || row['Phone'] || '').trim();
      const contactEmail = String(row['Contact Email'] || row['contact_email'] || row['Email'] || '').trim();
      const rawProducts = String(
        row['Branch Product Codes (Comma-separated)'] ||
        row['Branch Product Codes'] ||
        row['Product Codes'] ||
        row['Products'] ||
        row['products'] ||
        ''
      ).trim();

      let hasError = false;

      const company = companyMap.get(customerRef.toLowerCase());
      if (!company) {
        errors.push({
          rowNumber: rowNum,
          field: 'Customer ID / Email',
          value: customerRef,
          message: `Customer not found. Please create the customer first or provide a valid Customer ID/email. (Input: '${customerRef}')`,
        });
        hasError = true;
      }

      if (!branchName) {
        errors.push({ rowNumber: rowNum, field: 'Branch Name', value: branchName, message: 'Branch name is required' });
        hasError = true;
      }

      if (!city) {
        errors.push({ rowNumber: rowNum, field: 'City', value: city, message: 'City is required' });
        hasError = true;
      }

      if (!contactPerson) {
        errors.push({ rowNumber: rowNum, field: 'Contact Person', value: contactPerson, message: 'Contact person is required' });
        hasError = true;
      }

      if (!contactPhone) {
        errors.push({ rowNumber: rowNum, field: 'Contact Phone', value: contactPhone, message: 'Contact phone is required' });
        hasError = true;
      }

      // Branch product validation: Branch Products MUST be a subset of Customer-Owned Products!
      const branchProductIds: string[] = [];
      if (company && rawProducts) {
        const ownedIds = new Set(company.products.map((cp) => cp.productId));
        const parts = rawProducts.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        for (const p of parts) {
          const pid = productLookup.get(p);
          if (!pid) {
            errors.push({ rowNumber: rowNum, field: 'Branch Product Codes', value: p, message: `Product '${p}' not recognized in Product Master.` });
            hasError = true;
          } else if (!ownedIds.has(pid)) {
            errors.push({
              rowNumber: rowNum,
              field: 'Branch Product Codes',
              value: p,
              message: `Product is not assigned to this customer. Customer '${company.companyName}' does not own product '${p}'.`,
            });
            hasError = true;
          } else {
            branchProductIds.push(pid);
          }
        }
      }

      if (!hasError && company) {
        validRows.push({
          companyId: company.id,
          branchName,
          address: address || `${branchName}, ${city}`,
          city,
          state: state || 'State',
          pincode,
          contactPerson,
          contactPhone,
          contactEmail: contactEmail || null,
          product_ids: branchProductIds,
        });
      }
    }

    return {
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: rawRows.length - validRows.length,
      duplicateCount: 0,
      errors,
      previewRows: validRows.slice(0, 10),
    };
  }

  async commitBranchImport(rows: any[], actorUserId?: number): Promise<{ importedCount: number }> {
    let importedCount = 0;
    for (const row of rows) {
      await this.companiesService.createCompanyBranch(row.companyId, row, actorUserId);
      importedCount++;
    }
    return { importedCount };
  }

  // --- SAFE DEV / STAGING DATA RESET ---
  async devReset(actorUserId?: number): Promise<{ message: string; preservedAdmin: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Development data reset is strictly prohibited in production environment.');
    }

    // Safely remove demo tickets, implementations, branches, customer products, etc.
    await this.prisma.$transaction(async (tx) => {
      // 1. Tickets & related
      await tx.ticketFeedback.deleteMany();
      await tx.ticketReopenHistory.deleteMany();
      await tx.ticketEscalation.deleteMany();
      await tx.ticketResolutionSession.deleteMany();
      await tx.ticketComment.deleteMany();
      await tx.ticketAttachment.deleteMany();
      await tx.ticketAssignment.deleteMany();
      await tx.ticketHistory.deleteMany();
      await tx.ticket.deleteMany();

      // 2. Implementation Tasks & Implementations
      await tx.implementationTask.deleteMany();
      await tx.implementation.deleteMany();

      // 3. Subscriptions
      await tx.subscription.deleteMany();

      // 4. Branches & Branch Products
      await tx.branchProduct.deleteMany();
      await tx.companyBranch.deleteMany();

      // 5. Customer Products & Companies
      await tx.companyProduct.deleteMany();
      await tx.companyContact.deleteMany();
      await tx.company.deleteMany();

      // 6. Attendance
      await tx.employeeAttendance.deleteMany();

      // 7. Non-admin Employees & Users
      const nonAdminUsers = await tx.user.findMany({
        where: { role: { not: UserRole.ADMIN } },
        select: { id: true },
      });
      const nonAdminUserIds = nonAdminUsers.map((u) => u.id);

      await tx.employee.deleteMany({
        where: { userId: { in: nonAdminUserIds } },
      });
      await tx.user.deleteMany({
        where: { id: { in: nonAdminUserIds } },
      });

      // 8. Reset Sequence Trackers
      await tx.sequenceTracker.upsert({
        where: { name: 'TICKET_SEQ' },
        update: { currentValue: 0 },
        create: { name: 'TICKET_SEQ', currentValue: 0 },
      });
      await tx.sequenceTracker.upsert({
        where: { name: 'COMPANY_SEQ' },
        update: { currentValue: 0 },
        create: { name: 'COMPANY_SEQ', currentValue: 0 },
      });
      await tx.sequenceTracker.upsert({
        where: { name: 'BRANCH_SEQ' },
        update: { currentValue: 0 },
        create: { name: 'BRANCH_SEQ', currentValue: 0 },
      });
      await tx.sequenceTracker.upsert({
        where: { name: 'TASK_SEQ' },
        update: { currentValue: 0 },
        create: { name: 'TASK_SEQ', currentValue: 0 },
      });
      await tx.sequenceTracker.upsert({
        where: { name: 'IMPLEMENTATION_SEQ' },
        update: { currentValue: 0 },
        create: { name: 'IMPLEMENTATION_SEQ', currentValue: 0 },
      });
      await tx.sequenceTracker.upsert({
        where: { name: 'EMPLOYEE_SEQ' },
        update: { currentValue: 10 },
        create: { name: 'EMPLOYEE_SEQ', currentValue: 10 },
      });
    });

    return {
      message: 'Demo and business records reset safely. Core schema, migrations, products, and admin account preserved.',
      preservedAdmin: 'admin@kanvtech.com',
    };
  }
}

