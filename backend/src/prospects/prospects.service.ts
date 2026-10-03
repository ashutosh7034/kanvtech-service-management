import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CompaniesService } from '../companies/companies.service';

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly companiesService: CompaniesService,
  ) {}

  private async generateProspectId(): Promise<string> {
    const seq = await this.prisma.getNextSequence('PROSPECT_SEQ');
    return `PROS-${String(seq).padStart(4, '0')}`;
  }

  async createProspect(data: {
    companyName: string;
    contactPerson: string;
    phone: string;
    email: string;
    address?: string;
    enquiry?: string;
    source?: string;
    assignedEmployeeId?: string;
    notes?: string;
  }, actorUserId?: number) {
    const id = await this.generateProspectId();

    const prospect = await this.prisma.prospect.create({
      data: {
        id,
        companyName: data.companyName.trim(),
        contactPerson: data.contactPerson.trim(),
        phone: data.phone.trim(),
        email: data.email.trim().toLowerCase(),
        address: data.address?.trim() || null,
        enquiry: data.enquiry?.trim() || null,
        source: data.source?.trim() || null,
        assignedEmployeeId: data.assignedEmployeeId || null,
        notes: data.notes?.trim() || null,
        status: 'ENQUIRY',
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'PROSPECT_CREATED',
      entityType: 'PROSPECT',
      entityId: prospect.id,
      newValues: { companyName: data.companyName, email: data.email, status: 'ENQUIRY' },
    });

    return prospect;
  }

  async getProspects(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;
    const where: any = {};

    if (params.status) where.status = params.status;
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { companyName: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.prospect.count({ where }),
      this.prisma.prospect.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    ]);

    return { data, total, page, limit };
  }

  async getProspectById(id: string) {
    const p = await this.prisma.prospect.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Prospect ${id} not found.`);
    return p;
  }

  async updateProspect(id: string, data: {
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    enquiry?: string;
    source?: string;
    status?: string;
    assignedEmployeeId?: string;
    notes?: string;
  }, actorUserId?: number) {
    const existing = await this.getProspectById(id);
    if (existing.status === 'CONVERTED') {
      throw new BadRequestException('Cannot edit a converted prospect.');
    }

    const updated = await this.prisma.prospect.update({
      where: { id },
      data: {
        companyName: data.companyName?.trim() || existing.companyName,
        contactPerson: data.contactPerson?.trim() || existing.contactPerson,
        phone: data.phone?.trim() || existing.phone,
        email: data.email?.trim().toLowerCase() || existing.email,
        address: data.address !== undefined ? data.address?.trim() || null : existing.address,
        enquiry: data.enquiry !== undefined ? data.enquiry?.trim() || null : existing.enquiry,
        source: data.source !== undefined ? data.source?.trim() || null : existing.source,
        status: data.status || existing.status,
        assignedEmployeeId: data.assignedEmployeeId !== undefined ? data.assignedEmployeeId : existing.assignedEmployeeId,
        notes: data.notes !== undefined ? data.notes?.trim() || null : existing.notes,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'PROSPECT_UPDATED',
      entityType: 'PROSPECT',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: data.status || existing.status },
    });

    return updated;
  }

  async convertProspect(id: string, conversionData: {
    address?: string;
    gstn?: string;
    productIds: string[];
  }, actorUserId: number) {
    const prospect = await this.getProspectById(id);

    if (prospect.status === 'CONVERTED') {
      throw new BadRequestException('This prospect has already been converted to a customer.');
    }

    if (!conversionData.productIds || conversionData.productIds.length === 0) {
      throw new BadRequestException('At least one product must be selected for conversion.');
    }

    // Create the company - createCompany returns the company ID string
    const companyId = await this.companiesService.createCompany({
      company_name: prospect.companyName,
      address: conversionData.address || prospect.address || 'To be updated',
      gstn: conversionData.gstn || undefined,
      primary_email: prospect.email,
      contact_person: prospect.contactPerson,
      contact_phone: prospect.phone,
      products: conversionData.productIds,
    });

    // Mark prospect as converted
    await this.prisma.prospect.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedToCompanyId: companyId,
        convertedAt: new Date(),
        convertedByUserId: actorUserId,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'PROSPECT_CONVERTED',
      entityType: 'PROSPECT',
      entityId: id,
      newValues: {
        convertedToCompanyId: companyId,
        prospectName: prospect.companyName,
      },
    });

    return { prospect: await this.getProspectById(id), companyId };
  }
}
