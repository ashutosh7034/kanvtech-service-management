import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { EmployeesService } from '../employees/employees.service';

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

  generateTemplate(type: 'companies' | 'employees'): Buffer {
    let headers: string[] = [];
    let sampleData: any[] = [];

    if (type === 'companies') {
      headers = [
        'Company Name',
        'Address',
        'GSTN',
        'Primary Email',
        'Contact Person',
        'Contact Phone',
        'Alternate Contact',
        'Alternate Contact Phone',
        'Alternate Contact Email',
      ];
      sampleData = [
        [
          'Apex Industrial Solutions',
          'Plot 45, Phase 1, Industrial Area, Pune 411018',
          '27AAACA9988G1Z1',
          'contact@apexsolutions.com',
          'Suresh Kulkarni',
          '+91 98220 12345',
          'Ramesh Deshmukh',
          '+91 98220 54321',
          'ramesh@apexsolutions.com',
        ],
      ];
    } else {
      headers = [
        'Full Name',
        'Email Address',
        'Phone Number',
        'Department',
        'Designation',
        'Support Level',
        'Manager ID',
      ];
      sampleData = [
        ['Devendra Rao', 'devendra.rao@kanvtech.com', '+91 98110 33445', 'Service Desk', 'L1 Support Specialist', 'L1', 'EMP-001'],
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type.toUpperCase());
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async validateCompanyImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

    const errors: ImportError[] = [];
    const validRows: any[] = [];
    const seenEmails = new Set<string>();
    let duplicateCount = 0;

    const existingCompanies = await this.prisma.company.findMany({
      select: { primaryEmail: true, gstn: true },
    });
    const dbEmails = new Set(existingCompanies.map((c) => c.primaryEmail.toLowerCase()));
    const dbGstns = new Set(existingCompanies.map((c) => c.gstn?.toUpperCase()).filter(Boolean));

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

      if (!rowHasError) {
        validRows.push({
          company_name: companyName,
          address,
          primary_email: primaryEmail,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          gstn: gstn || null,
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

  async validateEmployeeImport(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

    const errors: ImportError[] = [];
    const validRows: any[] = [];
    const seenEmails = new Set<string>();
    let duplicateCount = 0;

    const existingUsers = await this.prisma.user.findMany({ select: { email: true } });
    const dbEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validLevels = ['L1', 'L2', 'L3'];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;

      const name = String(row['Full Name'] || row['name'] || '').trim();
      const email = String(row['Email Address'] || row['email'] || '').trim().toLowerCase();
      const phone = String(row['Phone Number'] || row['phone'] || '').trim();
      const department = String(row['Department'] || row['department'] || '').trim();
      const designation = String(row['Designation'] || row['designation'] || '').trim();
      const level = String(row['Support Level'] || row['level'] || 'L1').trim().toUpperCase();
      const managerId = String(row['Manager ID'] || row['manager_id'] || '').trim();

      let rowHasError = false;

      if (!name) {
        errors.push({ rowNumber: rowNum, field: 'Full Name', value: name, message: 'Name is required' });
        rowHasError = true;
      }

      if (!email || !emailRegex.test(email)) {
        errors.push({ rowNumber: rowNum, field: 'Email Address', value: email, message: 'Valid email is required' });
        rowHasError = true;
      } else if (seenEmails.has(email) || dbEmails.has(email)) {
        errors.push({ rowNumber: rowNum, field: 'Email Address', value: email, message: 'Duplicate email address' });
        duplicateCount++;
        rowHasError = true;
      } else {
        seenEmails.add(email);
      }

      if (!phone) {
        errors.push({ rowNumber: rowNum, field: 'Phone Number', value: phone, message: 'Phone is required' });
        rowHasError = true;
      }

      if (!validLevels.includes(level)) {
        errors.push({ rowNumber: rowNum, field: 'Support Level', value: level, message: 'Level must be L1, L2, or L3' });
        rowHasError = true;
      }

      if (!rowHasError) {
        validRows.push({
          name,
          email,
          phone,
          department: department || 'Technical Support',
          designation: designation || `${level} Specialist`,
          level: level as 'L1' | 'L2' | 'L3',
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
}
