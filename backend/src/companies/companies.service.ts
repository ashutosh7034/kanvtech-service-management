import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TicketStatus, UserRole } from '@prisma/client';
import { validateEmail, validateOptionalEmail, validatePhone, validateOptionalPhone, validateOptionalGSTN } from '../common/validation.util';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly emailVerificationService?: EmailVerificationService,
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
      where.isActive = String(params.isActive) === '1' || String(params.isActive) === 'true';
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
          products: {
            where: { isActive: true },
            include: {
              product: { select: { id: true, code: true, name: true, category: true } },
              modules: {
                include: {
                  module: { select: { id: true, name: true } },
                },
              },
            },
          },
          branches: {
            where: { status: 'ACTIVE' },
            select: { id: true, branchName: true, city: true, status: true },
          },
          tickets: {
            select: { status: true },
          },
        },
      }),
    ]);

    const data = companies.map((c) => {
      const openCount = c.tickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(t.status)).length;
      const resolvedCount = c.tickets.filter((t) => ['RESOLVED', 'CUSTOMER_FEEDBACK', 'MANAGER_REVIEW'].includes(t.status)).length;
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
        isActive: c.isActive,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        open_ticket_count: openCount,
        resolved_ticket_count: resolvedCount,
        closed_ticket_count: closedCount,
        products_count: c.products.length,
        branches_count: c.branches.length,
        products: c.products.map((cp) => ({
          id: cp.id,
          product_id: cp.productId,
          productId: cp.productId,
          code: cp.product.code,
          name: cp.product.name,
          category: cp.product.category,
          purchase_type: cp.purchaseType,
          purchaseType: cp.purchaseType,
          purchased_at: cp.purchasedAt,
          modules: (cp.modules || []).filter((m: any) => m.module).map((m: any) => ({
            id: m.module.id,
            name: m.module.name,
          })),
        })),
        branches: c.branches.map((b) => ({
          id: b.id,
          branch_name: b.branchName,
          city: b.city,
          status: b.status,
        })),
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
        products: {
          where: { isActive: true },
          include: {
            product: {
              include: {
                modules: {
                  where: { isActive: true },
                  include: {
                    submodules: {
                      where: { isActive: true },
                    },
                  },
                },
              },
            },
            modules: {
              include: {
                module: {
                  include: {
                    submodules: {
                      where: { isActive: true },
                    },
                  },
                },
              },
            },
          },
        },
        branches: {
          include: {
            branchProducts: {
              where: { isActive: true },
              include: {
                product: true,
                modules: {
                  include: {
                    module: {
                      include: {
                        submodules: {
                          where: { isActive: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
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
    const open = allTickets.filter((t) => ['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(t.status)).length;
    const resolved = allTickets.filter((t) => ['RESOLVED', 'CUSTOMER_FEEDBACK', 'MANAGER_REVIEW'].includes(t.status)).length;
    const closed = allTickets.filter((t) => t.status === 'CLOSED').length;

    return {
      id: c.id,
      company_name: c.companyName,
      companyName: c.companyName,
      address: c.address,
      gstn: c.gstn,
      primary_email: c.primaryEmail,
      primaryEmail: c.primaryEmail,
      alternate_emails: c.alternateEmails,
      contact_person: c.contactPerson,
      contactPerson: c.contactPerson,
      contact_phone: c.contactPhone,
      contactPhone: c.contactPhone,
      contact_address: c.contactAddress,
      contact_status: c.contactStatus,
      alternate_contact: c.alternateContact,
      alternate_contact_phone: c.alternateContactPhone,
      alternate_contact_address: c.alternateContactAddress,
      alternate_contact_email: c.alternateContactEmail,
      is_active: c.isActive ? 1 : 0,
      isActive: c.isActive,
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
      products: c.products.map((cp) => {
        let mappedModules: any[] = [];
        if (cp.purchaseType === 'COMPLETE') {
          mappedModules = (cp.product?.modules || [])
            .filter((m: any) => m.isActive !== false)
            .map((m: any) => ({
              id: m.id,
              name: m.name,
              description: m.description,
              isActive: m.isActive,
              submodules: (m.submodules || [])
                .filter((s: any) => s.isActive !== false)
                .map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  isActive: s.isActive,
                })),
              selectedSubmoduleIds: (m.submodules || []).filter((s: any) => s.isActive !== false).map((s: any) => s.id),
            }));
        } else {
          mappedModules = (cp.modules || [])
            .filter((cpm: any) => cpm.module && cpm.module.isActive !== false)
            .map((cpm: any) => {
              const m = cpm.module;
              let selectedSubIds: string[] = [];
              if (cpm.submoduleIds) {
                try {
                  const parsed = JSON.parse(cpm.submoduleIds);
                  if (Array.isArray(parsed)) selectedSubIds = parsed;
                } catch {
                  selectedSubIds = String(cpm.submoduleIds).split(',').map((s: string) => s.trim()).filter(Boolean);
                }
              }

              const filteredSubmodules = (m.submodules || [])
                .filter((s: any) => s.isActive !== false && selectedSubIds.includes(s.id))
                .map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  isActive: s.isActive,
                }));

              return {
                id: m.id,
                name: m.name,
                description: m.description,
                isActive: m.isActive,
                submodules: filteredSubmodules,
                selectedSubmoduleIds: selectedSubIds,
              };
            });
        }

        return {
          id: cp.id,
          product_id: cp.productId,
          productId: cp.productId,
          code: cp.product?.code,
          name: cp.product?.name,
          category: cp.product?.category,
          description: cp.product?.description,
          is_active: cp.isActive ? 1 : 0,
          isActive: cp.isActive,
          purchase_type: cp.purchaseType,
          purchaseType: cp.purchaseType,
          purchased_at: cp.purchasedAt,
          notes: cp.notes,
          modules: mappedModules,
          module_ids: mappedModules.map((m: any) => m.id),
          moduleIds: mappedModules.map((m: any) => m.id),
        };
      }),
      branches: c.branches.map((b) => ({
        id: b.id,
        company_id: b.companyId,
        branch_name: b.branchName,
        gstn: b.gstn,
        address: b.address,
        city: b.city,
        state: b.state,
        pincode: b.pincode,
        contact_person: b.contactPerson,
        contact_phone: b.contactPhone,
        contact_email: b.contactEmail,
        status: b.status,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
        products: b.branchProducts.map((bp) => {
          const mappedModules = (bp.modules || [])
            .filter((bpm: any) => bpm.module && bpm.module.isActive !== false)
            .map((bpm: any) => {
              const m = bpm.module;
              let selectedSubIds: string[] = [];
              if (bpm.submoduleIds) {
                try {
                  const parsed = JSON.parse(bpm.submoduleIds);
                  if (Array.isArray(parsed)) selectedSubIds = parsed;
                } catch {
                  selectedSubIds = String(bpm.submoduleIds).split(',').map((s: string) => s.trim()).filter(Boolean);
                }
              }
              const filteredSubmodules = (m.submodules || [])
                .filter((s: any) => s.isActive !== false && selectedSubIds.includes(s.id))
                .map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  description: s.description,
                  isActive: s.isActive,
                }));
              return {
                id: m.id,
                name: m.name,
                description: m.description,
                isActive: m.isActive,
                submodules: filteredSubmodules,
                selectedSubmoduleIds: selectedSubIds,
              };
            });

          return {
            id: bp.id,
            product_id: bp.productId,
            code: bp.product.code,
            name: bp.product.name,
            category: bp.product.category,
            assigned_at: bp.assignedAt,
            is_active: bp.isActive ? 1 : 0,
            modules: mappedModules,
            module_ids: mappedModules.map((m: any) => m.id),
            moduleIds: mappedModules.map((m: any) => m.id),
          };
        }),
      })),
      ticketSummary: {
        total,
        open,
        inProgress: allTickets.filter((t) => t.status === 'IN_PROGRESS').length,
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
    const address = (data.address || data.address_line1 || data.addressLine1 || (data.city ? `${data.city}, ${data.state || ''}` : '')).trim();
    const primaryEmail = validateEmail(data.primary_email || data.primaryEmail, 'Primary corporate email');
    const contactPerson = (data.contact_person || data.contactPerson || '').trim();
    const contactPhone = validatePhone(data.contact_phone || data.contactPhone, 'Contact phone');
    const gstn = validateOptionalGSTN(data.gstn);
    const alternateEmails = (data.alternate_emails || data.alternateEmails || '').trim();
    const contactAddress = (data.contact_address || data.contactAddress || '').trim();
    const alternateContact = (data.alternate_contact || data.alternateContact || '').trim();
    const alternateContactPhone = validateOptionalPhone(data.alternate_contact_phone || data.alternateContactPhone, 'Alternate contact phone');
    const alternateContactAddress = (data.alternate_contact_address || data.alternateContactAddress || '').trim();
    const alternateContactEmail = validateOptionalEmail(data.alternate_contact_email || data.alternateContactEmail, 'Alternate contact email');

    if (!companyName) {
      throw new BadRequestException('Company name is required.');
    }
    if (!address) {
      throw new BadRequestException('Address is required.');
    }
    if (!contactPerson) {
      throw new BadRequestException('Contact person is required.');
    }

    // CORPORATE EMAIL VERIFICATION: Disabled per release configuration
    // Primary corporate email is accepted directly without verification blocker.


    // MANDATORY CUSTOMER PRODUCT VALIDATION:
    const rawProds = data.products !== undefined ? data.products : (data.product_ids !== undefined ? data.product_ids : data.productIds);
    let normalizedProds = this.normalizeProductEntitlements(rawProds || []);

    if (normalizedProds.length === 0) {
      if (rawProds !== undefined) {
        throw new BadRequestException('At least one product must be selected before registering a customer.');
      }
      // If legacy call without product array: check if default product exists
      const defaultProd = await this.prisma.product.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
      if (defaultProd) {
        normalizedProds = [{ productId: defaultProd.id, purchaseType: 'SELECTED_MODULES', modules: [] }];
      } else {
        throw new BadRequestException('At least one product must be selected before registering a customer.');
      }
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

    const contactEmail = (data.contact_email || data.contactEmail || primaryEmail).trim().toLowerCase();
    const loginEmail = contactEmail || primaryEmail;

    // Auto-create CUSTOMER login account for primary contact if not already existing
    let primaryUser = await this.prisma.user.findFirst({
      where: { email: { equals: loginEmail, mode: 'insensitive' } },
    });
    if (!primaryUser) {
      const providedPass = data.contact_password || data.contactPassword || data.password;
      const rawPassword =
        providedPass && typeof providedPass === 'string' && providedPass.trim() !== ''
          ? providedPass.trim()
          : 'Password@123';
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      primaryUser = await this.prisma.user.create({
        data: {
          email: loginEmail,
          passwordHash,
          role: UserRole.CUSTOMER,
          isActive: true,
        },
      });
    }

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
              userId: primaryUser.id,
              name: contactPerson,
              email: loginEmail,
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
        products: {
          create: normalizedProds.map((p) => ({
            productId: p.productId,
            purchaseType: p.purchaseType,
            isActive: true,
            notes: 'Purchased on customer registration',
            modules: p.modules.length > 0 ? {
              create: p.modules.map((m) => ({
                moduleId: m.moduleId,
                submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
              })),
            } : undefined,
          })),
        },
      },
    });

    // If branches were provided in initial registration:
    if (Array.isArray(data.branches) && data.branches.length > 0) {
      for (const b of data.branches) {
        await this.createCompanyBranch(companyId, b, actorUserId);
      }
    }

    await this.auditService.log({
      actorUserId,
      action: 'COMPANY_CREATED',
      entityType: 'COMPANY',
      entityId: companyId,
      newValues: { id: companyId, companyName, primaryEmail, contactPerson, products: normalizedProds },
    });

    return companyId;
  }

  normalizeProductEntitlements(rawInput: any): Array<{
    productId: string;
    purchaseType: string;
    modules: Array<{ moduleId: string; submoduleIds: string[] }>;
  }> {
    let list: any[] = [];
    if (Array.isArray(rawInput)) {
      list = rawInput;
    } else if (rawInput && typeof rawInput === 'object') {
      list = [rawInput];
    }

    return list
      .map((item: any) => {
        if (typeof item === 'string') {
          return {
            productId: item,
            purchaseType: 'SELECTED_MODULES',
            modules: [] as Array<{ moduleId: string; submoduleIds: string[] }>,
          };
        }
        const pid = item.productId || item.product_id || item.id;
        const purchaseType = item.purchaseType || item.purchase_type || 'SELECTED_MODULES';
        let modulesList: Array<{ moduleId: string; submoduleIds: string[] }> = [];

        if (Array.isArray(item.modules)) {
          modulesList = item.modules
            .map((m: any) => {
              if (typeof m === 'string') {
                return { moduleId: m, submoduleIds: [] };
              }
              const mId = m.moduleId || m.module_id || m.id;
              let sIds: string[] = [];
              if (Array.isArray(m.submoduleIds || m.submodule_ids || m.submodules)) {
                sIds = (m.submoduleIds || m.submodule_ids || m.submodules)
                  .map((s: any) => (typeof s === 'string' ? s : s.id || s.submoduleId || s.submodule_id))
                  .filter(Boolean);
              }
              return { moduleId: mId, submoduleIds: sIds };
            })
            .filter((m: any) => Boolean(m.moduleId));
        } else if (Array.isArray(item.moduleIds || item.module_ids)) {
          const sIdsAll: string[] = Array.isArray(item.submoduleIds || item.submodule_ids)
            ? item.submoduleIds || item.submodule_ids
            : [];
          modulesList = (item.moduleIds || item.module_ids).map((mId: string) => ({
            moduleId: mId,
            submoduleIds: sIdsAll,
          }));
        }

        return {
          productId: pid,
          purchaseType,
          modules: modulesList,
        };
      })
      .filter((p: any) => Boolean(p.productId));
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

    const validPrimaryEmail = primaryEmail !== undefined ? validateEmail(primaryEmail, 'Primary corporate email') : undefined;
    const validGstn = gstn !== undefined ? validateOptionalGSTN(gstn) : undefined;
    const validContactPhone = contactPhone !== undefined ? validatePhone(contactPhone, 'Contact phone') : undefined;
    const validAltPhone = alternateContactPhone !== undefined ? validateOptionalPhone(alternateContactPhone, 'Alternate contact phone') : undefined;
    const validAltEmail = alternateContactEmail !== undefined ? validateOptionalEmail(alternateContactEmail, 'Alternate contact email') : undefined;

    if (companyName !== undefined && !companyName.trim()) {
      throw new BadRequestException('Company name cannot be empty.');
    }
    if (address !== undefined && !address.trim()) {
      throw new BadRequestException('Address cannot be empty.');
    }
    if (contactPerson !== undefined && !contactPerson.trim()) {
      throw new BadRequestException('Contact person cannot be empty.');
    }

    await this.prisma.company.update({
      where: { id },
      data: {
        companyName: companyName !== undefined ? companyName.trim() : undefined,
        address: address !== undefined ? address.trim() : undefined,
        gstn: validGstn !== undefined ? validGstn : undefined,
        primaryEmail: validPrimaryEmail !== undefined ? validPrimaryEmail : undefined,
        alternateEmails: alternateEmails !== undefined ? alternateEmails.trim() : undefined,
        contactPerson: contactPerson !== undefined ? contactPerson.trim() : undefined,
        contactPhone: validContactPhone !== undefined ? validContactPhone : undefined,
        contactAddress: contactAddress !== undefined ? contactAddress.trim() : undefined,
        alternateContact: alternateContact !== undefined ? alternateContact.trim() : undefined,
        alternateContactPhone: validAltPhone !== undefined ? validAltPhone : undefined,
        alternateContactAddress: alternateContactAddress !== undefined ? alternateContactAddress.trim() : undefined,
        alternateContactEmail: validAltEmail !== undefined ? validAltEmail : undefined,
        isActive,
      },
    });

    // If product entitlements are passed to updateCompany:
    const rawProductsToUpdate = data.products !== undefined ? data.products : (data.product_ids !== undefined ? data.product_ids : (data.productIds !== undefined ? data.productIds : data.entitlements));
    if (Array.isArray(rawProductsToUpdate) && rawProductsToUpdate.length > 0) {
      const normalizedToUpdate = this.normalizeProductEntitlements(rawProductsToUpdate);
      const incomingPids = new Set(normalizedToUpdate.map(p => p.productId));

      for (const p of normalizedToUpdate) {
        const existingCp = await this.prisma.companyProduct.findUnique({
          where: { uq_company_product: { companyId: id, productId: p.productId } },
        });

        if (existingCp) {
          await this.prisma.companyProduct.update({
            where: { id: existingCp.id },
            data: {
              isActive: true,
              purchaseType: p.purchaseType,
            },
          });
          await this.prisma.companyProductModule.deleteMany({
            where: { companyProductId: existingCp.id },
          });
          if (p.modules.length > 0) {
            await this.prisma.companyProductModule.createMany({
              data: p.modules.map((m) => ({
                companyProductId: existingCp.id,
                moduleId: m.moduleId,
                submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
              })),
            });
          }
        } else {
          const createdCp = await this.prisma.companyProduct.create({
            data: {
              companyId: id,
              productId: p.productId,
              purchaseType: p.purchaseType,
              isActive: true,
              notes: 'Added on customer update',
            },
          });
          if (p.modules.length > 0) {
            await this.prisma.companyProductModule.createMany({
              data: p.modules.map((m) => ({
                companyProductId: createdCp.id,
                moduleId: m.moduleId,
                submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
              })),
            });
          }
        }
      }

      // Soft-deactivate products not in the updated list if at least 1 remains
      if (normalizedToUpdate.length > 0) {
        const currentActive = await this.prisma.companyProduct.findMany({
          where: { companyId: id, isActive: true },
        });
        for (const cur of currentActive) {
          if (!incomingPids.has(cur.productId)) {
            await this.prisma.companyProduct.update({
              where: { id: cur.id },
              data: { isActive: false },
            });
          }
        }
      }
    }

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

  // --- Customer Product Management ---

  async addCompanyProduct(
    companyId: string,
    productId: string,
    notes?: string,
    purchaseType?: string,
    modules?: any[],
    actorUserId?: number,
  ) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found in Product Master');

    const parsedModules = (modules || []).map((m: any) => {
      if (typeof m === 'string') return { moduleId: m, submoduleIds: [] };
      const mId = m.moduleId || m.module_id || m.id;
      let sIds: string[] = [];
      if (Array.isArray(m.submoduleIds || m.submodule_ids || m.submodules)) {
        sIds = (m.submoduleIds || m.submodule_ids || m.submodules)
          .map((s: any) => (typeof s === 'string' ? s : s.id || s.submoduleId || s.submodule_id))
          .filter(Boolean);
      }
      return { moduleId: mId, submoduleIds: sIds };
    }).filter((m: any) => Boolean(m.moduleId));

    const finalPurchaseType = purchaseType || 'SELECTED_MODULES';

    const existing = await this.prisma.companyProduct.findUnique({
      where: { uq_company_product: { companyId, productId } },
    });

    if (existing) {
      const updated = await this.prisma.companyProduct.update({
        where: { id: existing.id },
        data: { 
          isActive: true, 
          notes: notes || existing.notes,
          purchaseType: finalPurchaseType,
        },
      });
      
      await this.prisma.companyProductModule.deleteMany({ where: { companyProductId: existing.id } });
      if (parsedModules.length > 0) {
        await this.prisma.companyProductModule.createMany({
          data: parsedModules.map((m) => ({
            companyProductId: existing.id,
            moduleId: m.moduleId,
            submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
          })),
        });
      }

      await this.auditService.log({
        actorUserId,
        action: 'CUSTOMER_PRODUCT_UPDATED',
        entityType: 'COMPANY',
        entityId: companyId,
        newValues: { companyId, productId, productName: product.name, purchaseType: finalPurchaseType, modules: parsedModules },
      });
      
      return updated;
    }

    const created = await this.prisma.companyProduct.create({
      data: {
        companyId,
        productId,
        purchaseType: finalPurchaseType,
        isActive: true,
        notes: notes || 'Additional product purchased',
        modules: parsedModules.length > 0 ? {
          create: parsedModules.map((m) => ({
            moduleId: m.moduleId,
            submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
          })),
        } : undefined,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'CUSTOMER_PRODUCT_ADDED',
      entityType: 'COMPANY',
      entityId: companyId,
      newValues: { companyId, productId, productName: product.name, purchaseType: finalPurchaseType, modules: parsedModules },
    });

    return created;
  }

  async removeCompanyProduct(companyId: string, productId: string, actorUserId?: number) {
    // productId might be the Master Product ID (e.g. PROD-0001) or the CompanyProduct integer ID
    let existing = await this.prisma.companyProduct.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          { productId },
          ...(!isNaN(Number(productId)) ? [{ id: Number(productId) }] : []),
        ],
      },
    });

    if (!existing) {
      existing = await this.prisma.companyProduct.findFirst({
        where: {
          companyId,
          OR: [
            { productId },
            ...(!isNaN(Number(productId)) ? [{ id: Number(productId) }] : []),
          ],
        },
      });
    }

    if (!existing) throw new NotFoundException('Product assignment not found for this customer');
    
    // Use the actual master productId for branch deactivations
    const masterProductId = existing.productId;

    // Check if customer has only 1 active product left
    const totalActiveProducts = await this.prisma.companyProduct.count({
      where: { companyId, isActive: true },
    });
    if (totalActiveProducts <= 1) {
      throw new BadRequestException('A customer must retain at least one purchased product.');
    }

    // Soft-deactivate to preserve historical tickets/branches
    await this.prisma.companyProduct.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    // Deactivate from branch products too
    const branchIds = (await this.prisma.companyBranch.findMany({
      where: { companyId },
      select: { id: true },
    })).map((b) => b.id);

    if (branchIds.length > 0) {
      await this.prisma.branchProduct.updateMany({
        where: { branchId: { in: branchIds }, productId: masterProductId },
        data: { isActive: false },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'CUSTOMER_PRODUCT_REMOVED',
      entityType: 'COMPANY',
      entityId: companyId,
      newValues: { companyId, productId: masterProductId },
    });
  }

  // --- Branch Management ---

  async getCompanyBranches(companyId: string) {
    const branches = await this.prisma.companyBranch.findMany({
      where: { companyId },
      include: {
        branchProducts: {
          where: { isActive: true },
          include: {
            product: { select: { id: true, code: true, name: true, category: true } },
            modules: {
              include: {
                module: {
                  include: {
                    submodules: {
                      where: { isActive: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return branches.map((b) => ({
      id: b.id,
      company_id: b.companyId,
      branch_name: b.branchName,
      address: b.address,
      city: b.city,
      state: b.state,
      pincode: b.pincode,
      contact_person: b.contactPerson,
      contact_phone: b.contactPhone,
      contact_email: b.contactEmail,
      status: b.status,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
      products: b.branchProducts.map((bp) => {
        const mappedModules = (bp.modules || [])
          .filter((bpm: any) => bpm.module && bpm.module.isActive !== false)
          .map((bpm: any) => {
            const m = bpm.module;
            let selectedSubIds: string[] = [];
            if (bpm.submoduleIds) {
              try {
                const parsed = JSON.parse(bpm.submoduleIds);
                if (Array.isArray(parsed)) selectedSubIds = parsed;
              } catch {
                selectedSubIds = String(bpm.submoduleIds).split(',').map((s: string) => s.trim()).filter(Boolean);
              }
            }
            const filteredSubmodules = (m.submodules || [])
              .filter((s: any) => s.isActive !== false && selectedSubIds.includes(s.id))
              .map((s: any) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                isActive: s.isActive,
              }));
            return {
              id: m.id,
              name: m.name,
              description: m.description,
              isActive: m.isActive,
              submodules: filteredSubmodules,
              selectedSubmoduleIds: selectedSubIds,
            };
          });

        return {
          id: bp.id,
          product_id: bp.productId,
          code: bp.product.code,
          name: bp.product.name,
          category: bp.product.category,
          assigned_at: bp.assignedAt,
          is_active: bp.isActive ? 1 : 0,
          modules: mappedModules,
          module_ids: mappedModules.map((m: any) => m.id),
          moduleIds: mappedModules.map((m: any) => m.id),
        };
      }),
    }));
  }

  async getBranchById(branchId: string) {
    const b = await this.prisma.companyBranch.findUnique({
      where: { id: branchId },
      include: {
        company: { select: { id: true, companyName: true } },
        branchProducts: {
          where: { isActive: true },
          include: {
            product: true,
            modules: {
              include: {
                module: {
                  include: {
                    submodules: {
                      where: { isActive: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!b) return null;

    return {
      id: b.id,
      company_id: b.companyId,
      company_name: b.company.companyName,
      branch_name: b.branchName,
      address: b.address,
      city: b.city,
      state: b.state,
      pincode: b.pincode,
      contact_person: b.contactPerson,
      contact_phone: b.contactPhone,
      contact_email: b.contactEmail,
      alternate_phones: b.alternatePhones,
      alternate_emails: b.alternateEmails,
      status: b.status,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
      products: b.branchProducts.map((bp) => {
        const mappedModules = (bp.modules || [])
          .filter((bpm: any) => bpm.module && bpm.module.isActive !== false)
          .map((bpm: any) => {
            const m = bpm.module;
            let selectedSubIds: string[] = [];
            if (bpm.submoduleIds) {
              try {
                const parsed = JSON.parse(bpm.submoduleIds);
                if (Array.isArray(parsed)) selectedSubIds = parsed;
              } catch {
                selectedSubIds = String(bpm.submoduleIds).split(',').map((s: string) => s.trim()).filter(Boolean);
              }
            }
            const filteredSubmodules = (m.submodules || [])
              .filter((s: any) => s.isActive !== false && selectedSubIds.includes(s.id))
              .map((s: any) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                isActive: s.isActive,
              }));
            return {
              id: m.id,
              name: m.name,
              description: m.description,
              isActive: m.isActive,
              submodules: filteredSubmodules,
              selectedSubmoduleIds: selectedSubIds,
            };
          });

        return {
          id: bp.id,
          product_id: bp.productId,
          code: bp.product.code,
          name: bp.product.name,
          category: bp.product.category,
          assigned_at: bp.assignedAt,
          is_active: bp.isActive ? 1 : 0,
          modules: mappedModules,
          module_ids: mappedModules.map((m: any) => m.id),
          moduleIds: mappedModules.map((m: any) => m.id),
        };
      }),
    };
  }

  async createCompanyBranch(companyId: string, data: any, actorUserId?: number): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { products: { where: { isActive: true }, include: { modules: true } } },
    });
    if (!company) throw new NotFoundException('Company not found');

    const branchName = (data.branch_name || data.branchName || '').trim();
    const gstn = validateOptionalGSTN(data.gstn);
    const address = (data.address || '').trim();
    const city = (data.city || '').trim();
    const state = (data.state || '').trim();
    const pincode = (data.pincode || data.postal_code || '').trim();
    const contactPerson = (data.contact_person || data.contactPerson || '').trim();
    const contactPhone = validatePhone(data.contact_phone || data.contactPhone, 'Branch contact phone');
    const contactEmail = validateOptionalEmail(data.contact_email || data.contactEmail, 'Branch contact email');

    if (!branchName) throw new BadRequestException('Branch name is required.');
    if (!address) throw new BadRequestException('Branch address is required.');
    if (!city) throw new BadRequestException('Branch city is required.');
    if (!state) throw new BadRequestException('Branch state is required.');
    if (!contactPerson) throw new BadRequestException('Branch contact person is required.');

    // BRANCH PRODUCT & ENTITLEMENT RESTRICTION:
    // Branch Products/Modules/Submodules MUST be a subset of Customer-Owned Entitlements.
    const rawBranchProds = data.products !== undefined ? data.products : (data.product_ids !== undefined ? data.product_ids : data.productIds);
    const normalizedBranchProds = this.normalizeProductEntitlements(rawBranchProds || []);

    const ownedProductMap = new Map<string, { purchaseType: string; moduleMap: Map<string, Set<string>> }>();
    for (const cp of company.products) {
      const moduleMap = new Map<string, Set<string>>();
      for (const m of cp.modules) {
        let sIds = new Set<string>();
        if (m.submoduleIds) {
          try {
            const arr = JSON.parse(m.submoduleIds);
            if (Array.isArray(arr)) sIds = new Set(arr);
          } catch {
            sIds = new Set(String(m.submoduleIds).split(',').map((s) => s.trim()).filter(Boolean));
          }
        }
        moduleMap.set(m.moduleId, sIds);
      }
      ownedProductMap.set(cp.productId, { purchaseType: cp.purchaseType, moduleMap });
    }

    for (const bp of normalizedBranchProds) {
      if (!ownedProductMap.has(bp.productId)) {
        const prod = await this.prisma.product.findUnique({ where: { id: bp.productId } });
        const prodName = prod ? prod.name : bp.productId;
        throw new BadRequestException(
          `Cannot assign product '${prodName}' to branch because customer '${company.companyName}' does not own this product.`,
        );
      }

      const owned = ownedProductMap.get(bp.productId)!;
      if (owned.purchaseType === 'SELECTED_MODULES') {
        for (const m of bp.modules) {
          if (!owned.moduleMap.has(m.moduleId)) {
            const mod = await this.prisma.productModule.findUnique({ where: { id: m.moduleId } });
            const modName = mod ? mod.name : m.moduleId;
            throw new BadRequestException(
              `Cannot assign module '${modName}' to branch because customer '${company.companyName}' does not own this module.`,
            );
          }
          const ownedSubIds = owned.moduleMap.get(m.moduleId)!;
          if (ownedSubIds.size > 0) {
            for (const sId of m.submoduleIds) {
              if (!ownedSubIds.has(sId)) {
                throw new BadRequestException(
                  `Cannot assign submodule '${sId}' to branch because customer '${company.companyName}' does not own this submodule.`,
                );
              }
            }
          }
        }
      }
    }

    // Monotonic Branch ID
    const allBranches = await this.prisma.companyBranch.findMany({ select: { id: true } });
    let maxNum = 0;
    for (const b of allBranches) {
      const match = b.id.match(/^BR-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextSeq = await this.prisma.getNextSequence('BRANCH_SEQ');
    const safeSeq = Math.max(nextSeq, maxNum + 1);
    const branchId = `BR-${String(safeSeq).padStart(4, '0')}`;

    await this.prisma.companyBranch.create({
      data: {
        id: branchId,
        companyId,
        branchName,
        gstn: gstn || null,
        address,
        city,
        state,
        pincode: pincode || null,
        contactPerson,
        contactPhone,
        contactEmail: contactEmail || null,
        status: data.status || 'ACTIVE',
        branchProducts: {
          create: normalizedBranchProds.map((bp) => ({
            productId: bp.productId,
            isActive: true,
            modules: bp.modules.length > 0 ? {
              create: bp.modules.map((m) => ({
                moduleId: m.moduleId,
                submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
              })),
            } : undefined,
          })),
        },
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'BRANCH_CREATED',
      entityType: 'BRANCH',
      entityId: branchId,
      newValues: { id: branchId, companyId, branchName, gstn, city, products: normalizedBranchProds },
    });

    return branchId;
  }

  async updateCompanyBranch(branchId: string, data: any, actorUserId?: number) {
    const existing = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
    if (!existing) throw new NotFoundException('Branch not found');

    const branchName = data.branch_name ?? data.branchName;
    const gstn = data.gstn;
    const address = data.address;
    const city = data.city;
    const state = data.state;
    const pincode = data.pincode ?? data.postal_code;
    const contactPerson = data.contact_person ?? data.contactPerson;
    const contactPhone = data.contact_phone ?? data.contactPhone;
    const contactEmail = data.contact_email ?? data.contactEmail;
    const alternatePhones = data.alternate_phones ?? data.alternatePhones;
    const alternateEmails = data.alternate_emails ?? data.alternateEmails;
    const status = data.status;

    const validGstn = gstn !== undefined ? validateOptionalGSTN(gstn) : undefined;
    const validContactPhone = contactPhone !== undefined ? validatePhone(contactPhone, 'Branch contact phone') : undefined;
    const validContactEmail = contactEmail !== undefined ? validateOptionalEmail(contactEmail, 'Branch contact email') : undefined;

    await this.prisma.companyBranch.update({
      where: { id: branchId },
      data: {
        branchName: branchName !== undefined ? branchName.trim() : undefined,
        gstn: validGstn !== undefined ? validGstn : undefined,
        address: address !== undefined ? address.trim() : undefined,
        city: city !== undefined ? city.trim() : undefined,
        state: state !== undefined ? state.trim() : undefined,
        pincode: pincode !== undefined ? pincode.trim() : undefined,
        contactPerson: contactPerson !== undefined ? contactPerson.trim() : undefined,
        contactPhone: validContactPhone !== undefined ? validContactPhone : undefined,
        contactEmail: validContactEmail !== undefined ? validContactEmail : undefined,
        alternatePhones: alternatePhones !== undefined ? alternatePhones.trim() : undefined,
        alternateEmails: alternateEmails !== undefined ? alternateEmails.trim().toLowerCase() : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'BRANCH_UPDATED',
      entityType: 'BRANCH',
      entityId: branchId,
      oldValues: existing,
      newValues: data,
    });
  }

  async toggleBranchStatus(branchId: string, status: string, actorUserId?: number) {
    const existing = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
    if (!existing) throw new NotFoundException('Branch not found');

    await this.prisma.companyBranch.update({
      where: { id: branchId },
      data: { status },
    });

    await this.auditService.log({
      actorUserId,
      action: 'BRANCH_STATUS_UPDATED',
      entityType: 'BRANCH',
      entityId: branchId,
      newValues: { status },
    });
  }

  async assignBranchProducts(branchId: string, rawProducts: any, actorUserId?: number) {
    const branch = await this.prisma.companyBranch.findUnique({
      where: { id: branchId },
      include: { company: { include: { products: { where: { isActive: true }, include: { modules: true } } } } },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const normalizedBranchProds = this.normalizeProductEntitlements(rawProducts);

    const ownedProductMap = new Map<string, { purchaseType: string; moduleMap: Map<string, Set<string>> }>();
    for (const cp of branch.company.products) {
      const moduleMap = new Map<string, Set<string>>();
      for (const m of cp.modules) {
        let sIds = new Set<string>();
        if (m.submoduleIds) {
          try {
            const arr = JSON.parse(m.submoduleIds);
            if (Array.isArray(arr)) sIds = new Set(arr);
          } catch {
            sIds = new Set(String(m.submoduleIds).split(',').map((s) => s.trim()).filter(Boolean));
          }
        }
        moduleMap.set(m.moduleId, sIds);
      }
      ownedProductMap.set(cp.productId, { purchaseType: cp.purchaseType, moduleMap });
    }

    for (const bp of normalizedBranchProds) {
      if (!ownedProductMap.has(bp.productId)) {
        const prod = await this.prisma.product.findUnique({ where: { id: bp.productId } });
        const prodName = prod ? prod.name : bp.productId;
        throw new BadRequestException(
          `Cannot assign product '${prodName}' to branch because customer '${branch.company.companyName}' does not own this product.`,
        );
      }

      const owned = ownedProductMap.get(bp.productId)!;
      if (owned.purchaseType === 'SELECTED_MODULES') {
        for (const m of bp.modules) {
          if (!owned.moduleMap.has(m.moduleId)) {
            const mod = await this.prisma.productModule.findUnique({ where: { id: m.moduleId } });
            const modName = mod ? mod.name : m.moduleId;
            throw new BadRequestException(
              `Cannot assign module '${modName}' to branch because customer '${branch.company.companyName}' does not own this module.`,
            );
          }
          const ownedSubIds = owned.moduleMap.get(m.moduleId)!;
          if (ownedSubIds.size > 0) {
            for (const sId of m.submoduleIds) {
              if (!ownedSubIds.has(sId)) {
                throw new BadRequestException(
                  `Cannot assign submodule '${sId}' to branch because customer '${branch.company.companyName}' does not own this submodule.`,
                );
              }
            }
          }
        }
      }
    }

    const newProductIds = normalizedBranchProds.map((bp) => bp.productId);
    await this.prisma.branchProduct.updateMany({
      where: {
        branchId,
        productId: { notIn: newProductIds },
      },
      data: { isActive: false },
    });

    for (const bp of normalizedBranchProds) {
      const branchProd = await this.prisma.branchProduct.upsert({
        where: { uq_branch_product: { branchId, productId: bp.productId } },
        update: { isActive: true },
        create: { branchId, productId: bp.productId, isActive: true },
      });

      await this.prisma.branchProductModule.deleteMany({
        where: { branchProductId: branchProd.id },
      });

      if (bp.modules.length > 0) {
        await this.prisma.branchProductModule.createMany({
          data: bp.modules.map((m) => ({
            branchProductId: branchProd.id,
            moduleId: m.moduleId,
            submoduleIds: m.submoduleIds && m.submoduleIds.length > 0 ? JSON.stringify(m.submoduleIds) : null,
          })),
        });
      }
    }

    await this.auditService.log({
      actorUserId,
      action: 'BRANCH_PRODUCTS_ASSIGNED',
      entityType: 'BRANCH',
      entityId: branchId,
      newValues: { branchId, products: normalizedBranchProds },
    });
  }

  async removeBranchProduct(branchId: string, productId: string, actorUserId?: number) {
    let existing = await this.prisma.branchProduct.findUnique({
      where: { uq_branch_product: { branchId, productId } },
    });

    if (!existing && !isNaN(Number(productId))) {
      existing = await this.prisma.branchProduct.findUnique({
        where: { id: Number(productId), branchId },
      });
    }

    if (!existing) throw new NotFoundException('Product assignment not found for this branch');

    await this.prisma.branchProduct.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    await this.auditService.log({
      actorUserId,
      action: 'BRANCH_PRODUCT_REMOVED',
      entityType: 'BRANCH',
      entityId: branchId,
      newValues: { branchId, productId },
    });
  }
}
