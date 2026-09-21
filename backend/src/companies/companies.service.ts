import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getCompanies(params: {
    search?: string;
    isActive?: string;
    companyId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.companyId) {
      where.id = params.companyId;
    }

    if (params.isActive !== undefined && params.isActive !== '') {
      where.isActive = params.isActive === '1' || params.isActive === 'true';
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { companyName: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { primaryEmail: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, companies] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tickets: {
            select: { status: true },
          },
        },
      }),
    ]);

    const data = companies.map((c) => {
      const openCount = c.tickets.filter((t) => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length;
      const resolvedCount = c.tickets.filter((t) => t.status === 'RESOLVED').length;
      const closedCount = c.tickets.filter((t) => t.status === 'CLOSED').length;

      return {
        id: c.id,
        company_name: c.companyName,
        address: c.address,
        gstn: c.gstn,
        primary_email: c.primaryEmail,
        alternate_emails: c.alternateEmails,
        contact_person: c.contactPerson,
        contact_phone: c.contactPhone,
        contact_address: c.contactAddress,
        contact_status: c.contactStatus,
        alternate_contact: c.alternateContact,
        alternate_contact_phone: c.alternateContactPhone,
        alternate_contact_address: c.alternateContactAddress,
        alternate_contact_email: c.alternateContactEmail,
        is_active: c.isActive ? 1 : 0,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        open_ticket_count: openCount,
        resolved_ticket_count: resolvedCount,
        closed_ticket_count: closedCount,
      };
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getCompanyById(id: string) {
    const c = await this.prisma.company.findUnique({
      where: { id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        tickets: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            problemType: true,
            priority: true,
            status: true,
            createdAt: true,
            slaStatus: true,
          },
        },
      },
    });

    if (!c) return null;

    const allTickets = await this.prisma.ticket.findMany({
      where: { companyId: id },
      select: { status: true },
    });

    const total = allTickets.length;
    const open = allTickets.filter((t) => t.status === 'OPEN').length;
    const inProgress = allTickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const resolved = allTickets.filter((t) => t.status === 'RESOLVED').length;
    const closed = allTickets.filter((t) => t.status === 'CLOSED').length;

    return {
      id: c.id,
      company_name: c.companyName,
      address: c.address,
      gstn: c.gstn,
      primary_email: c.primaryEmail,
      alternate_emails: c.alternateEmails,
      contact_person: c.contactPerson,
      contact_phone: c.contactPhone,
      contact_address: c.contactAddress,
      contact_status: c.contactStatus,
      alternate_contact: c.alternateContact,
      alternate_contact_phone: c.alternateContactPhone,
      alternate_contact_address: c.alternateContactAddress,
      alternate_contact_email: c.alternateContactEmail,
      is_active: c.isActive ? 1 : 0,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      contacts: c.contacts.map((ct) => ({
        id: ct.id,
        company_id: ct.companyId,
        user_id: ct.userId,
        name: ct.name,
        email: ct.email,
        phone: ct.phone,
        designation: ct.designation,
        is_primary: ct.isPrimary ? 1 : 0,
        is_active: ct.isActive ? 1 : 0,
        created_at: ct.createdAt,
      })),
      ticketSummary: {
        total,
        open,
        inProgress,
        resolved,
        closed,
      },
      recentTickets: c.tickets.map((t) => ({
        id: t.id,
        problem_type: t.problemType,
        priority: t.priority,
        status: t.status,
        created_at: t.createdAt,
        sla_status: t.slaStatus,
      })),
    };
  }

  async createCompany(data: any, actorUserId?: number): Promise<string> {
    const companyName = (data.company_name || data.companyName || '').trim();
    const address = (data.address || '').trim();
    const primaryEmail = (data.primary_email || data.primaryEmail || '').trim().toLowerCase();
    const contactPerson = (data.contact_person || data.contactPerson || '').trim();
    const contactPhone = (data.contact_phone || data.contactPhone || '').trim();
    const gstn = (data.gstn || '').trim();
    const alternateEmails = (data.alternate_emails || data.alternateEmails || '').trim();
    const contactAddress = (data.contact_address || data.contactAddress || '').trim();
    const alternateContact = (data.alternate_contact || data.alternateContact || '').trim();
    const alternateContactPhone = (data.alternate_contact_phone || data.alternateContactPhone || '').trim();
    const alternateContactAddress = (data.alternate_contact_address || data.alternateContactAddress || '').trim();
    const alternateContactEmail = (data.alternate_contact_email || data.alternateContactEmail || '').trim().toLowerCase();

    if (!companyName) {
      throw new BadRequestException('Company name is required.');
    }
    if (!address) {
      throw new BadRequestException('Address is required.');
    }
    if (!primaryEmail) {
      throw new BadRequestException('Primary email is required.');
    }
    if (!contactPerson) {
      throw new BadRequestException('Contact person is required.');
    }
    if (!contactPhone) {
      throw new BadRequestException('Contact phone is required.');
    }

    const existingName = await this.prisma.company.findFirst({
      where: { companyName: { equals: companyName, mode: 'insensitive' } },
    });
    if (existingName) {
      throw new BadRequestException(`Company with name '${companyName}' already exists.`);
    }

    const existingEmail = await this.prisma.company.findFirst({
      where: { primaryEmail: { equals: primaryEmail, mode: 'insensitive' } },
    });
    if (existingEmail) {
      throw new BadRequestException(`Company with primary email '${primaryEmail}' already exists.`);
    }

    if (gstn) {
      const existingGstn = await this.prisma.company.findFirst({
        where: { gstn: { equals: gstn, mode: 'insensitive' } },
      });
      if (existingGstn) {
        throw new BadRequestException(`Company with GSTN '${gstn}' already exists.`);
      }
    }

    // Monotonic collision-safe sequence generator:
    // Determine the safe maximum from existing companies to guarantee monotonicity
    const allCompanies = await this.prisma.company.findMany({ select: { id: true } });
    let maxNum = 0;
    for (const comp of allCompanies) {
      const match = comp.id.match(/^CMP-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextSeq = await this.prisma.getNextSequence('COMPANY_SEQ');
    const safeSeq = Math.max(nextSeq, maxNum + 1);
    const companyId = `CMP-${String(safeSeq).padStart(4, '0')}`;

    await this.prisma.company.create({
      data: {
        id: companyId,
        companyName,
        address,
        gstn: gstn || null,
        primaryEmail,
        alternateEmails: alternateEmails || null,
        contactPerson,
        contactPhone,
        contactAddress: contactAddress || null,
        contactStatus: 'ACTIVE',
        alternateContact: alternateContact || null,
        alternateContactPhone: alternateContactPhone || null,
        alternateContactAddress: alternateContactAddress || null,
        alternateContactEmail: alternateContactEmail || null,
        isActive: true,
        contacts: {
          create: [
            {
              name: contactPerson,
              email: primaryEmail,
              phone: contactPhone,
              designation: 'Primary Contact',
              isPrimary: true,
              isActive: true,
            },
            ...(data.contacts || [])
              .filter((c: any) => c.name && c.email)
              .map((c: any) => ({
                name: (c.name || '').trim(),
                email: (c.email || '').trim().toLowerCase(),
                phone: c.phone || '',
                designation: c.designation || 'Contact',
                isPrimary: Boolean(c.is_primary || c.isPrimary),
                isActive: true,
              })),
          ],
        },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'COMPANY_CREATED',
      entityType: 'COMPANY',
      entityId: companyId,
      newValues: { id: companyId, companyName, primaryEmail, contactPerson },
    });

    return companyId;
  }

  async updateCompany(id: string, data: any, actorUserId?: number): Promise<void> {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Company not found');

    const companyName = data.company_name ?? data.companyName;
    const address = data.address;
    const gstn = data.gstn;
    const primaryEmail = data.primary_email ?? data.primaryEmail;
    const alternateEmails = data.alternate_emails ?? data.alternateEmails;
    const contactPerson = data.contact_person ?? data.contactPerson;
    const contactPhone = data.contact_phone ?? data.contactPhone;
    const contactAddress = data.contact_address ?? data.contactAddress;
    const alternateContact = data.alternate_contact ?? data.alternateContact;
    const alternateContactPhone = data.alternate_contact_phone ?? data.alternateContactPhone;
    const alternateContactAddress = data.alternate_contact_address ?? data.alternateContactAddress;
    const alternateContactEmail = data.alternate_contact_email ?? data.alternateContactEmail;
    const isActive = data.is_active !== undefined ? Boolean(data.is_active) : (data.isActive !== undefined ? Boolean(data.isActive) : undefined);

    await this.prisma.company.update({
      where: { id },
      data: {
        companyName: companyName !== undefined ? companyName.trim() : undefined,
        address: address !== undefined ? address.trim() : undefined,
        gstn: gstn !== undefined ? gstn.trim() : undefined,
        primaryEmail: primaryEmail !== undefined ? primaryEmail.trim().toLowerCase() : undefined,
        alternateEmails: alternateEmails !== undefined ? alternateEmails.trim() : undefined,
        contactPerson: contactPerson !== undefined ? contactPerson.trim() : undefined,
        contactPhone: contactPhone !== undefined ? contactPhone.trim() : undefined,
        contactAddress: contactAddress !== undefined ? contactAddress.trim() : undefined,
        alternateContact: alternateContact !== undefined ? alternateContact.trim() : undefined,
        alternateContactPhone: alternateContactPhone !== undefined ? alternateContactPhone.trim() : undefined,
        alternateContactAddress: alternateContactAddress !== undefined ? alternateContactAddress.trim() : undefined,
        alternateContactEmail: alternateContactEmail !== undefined ? alternateContactEmail.trim().toLowerCase() : undefined,
        isActive,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'COMPANY_UPDATED',
      entityType: 'COMPANY',
      entityId: id,
      oldValues: existing,
      newValues: data,
    });
  }

  async toggleCompanyStatus(id: string, isActive: boolean, actorUserId?: number): Promise<void> {
    await this.prisma.company.update({
      where: { id },
      data: { isActive },
    });

    await this.auditService.log({
      actorUserId,
      action: isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_DEACTIVATED',
      entityType: 'COMPANY',
      entityId: id,
    });
  }
}
