import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateSubscriptionId(): Promise<string> {
    while (true) {
      const nextSeq = await this.prisma.getNextSequence('SUBSCRIPTION_SEQ');
      const id = `SUB-${String(nextSeq).padStart(4, '0')}`;
      const exists = await this.prisma.subscription.findUnique({ where: { id } });
      if (!exists) return id;
    }
  }

  computeStatus(expiryDate: Date, currentStatus: any, startDate?: Date): SubscriptionStatus {
    const rawStatus = String(currentStatus || '').toUpperCase();
    if (rawStatus === 'SUSPENDED') return 'SUSPENDED' as SubscriptionStatus;
    if (rawStatus === 'CANCELLED') return 'CANCELLED' as SubscriptionStatus;
    if (rawStatus === 'DRAFT') return 'DRAFT' as SubscriptionStatus;
    if (rawStatus === 'RENEWED') return SubscriptionStatus.RENEWED;

    const now = new Date();
    if (startDate) {
      const start = new Date(startDate);
      if (start.getTime() > now.getTime()) {
        return 'DRAFT' as SubscriptionStatus;
      }
    }

    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return SubscriptionStatus.EXPIRED;
    if (diffDays <= 30) return SubscriptionStatus.EXPIRING_SOON;
    return SubscriptionStatus.ACTIVE;
  }

  // --- AMC Plan Helpers ---

  private formatAmcPlan(row: any) {
    if (!row) return null;
    const safeParse = (val: any, fallback: any) => {
      if (val === null || val === undefined) return fallback;
      if (typeof val === 'object') return val;
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenant_id: row.tenant_id,
      name: row.name,
      code: row.code,
      description: row.description || '',
      coverageType: row.coverage_type || 'COMPREHENSIVE',
      coverage_type: row.coverage_type || 'COMPREHENSIVE',
      supportAvailability: row.support_availability || 'BUSINESS_HOURS',
      support_availability: row.support_availability || 'BUSINESS_HOURS',
      responseTimeHours: Number(row.response_time_hours || 4),
      response_time_hours: Number(row.response_time_hours || 4),
      resolutionTimeHours: Number(row.resolution_time_hours || 24),
      resolution_time_hours: Number(row.resolution_time_hours || 24),
      preventiveMaintenanceFrequency: row.preventive_maintenance_frequency || 'QUARTERLY',
      preventive_maintenance_frequency: row.preventive_maintenance_frequency || 'QUARTERLY',
      includedVisits: Number(row.included_visits || 4),
      included_visits: Number(row.included_visits || 4),
      remoteSupport: Boolean(row.remote_support),
      remote_support: Boolean(row.remote_support),
      onsiteSupport: Boolean(row.onsite_support),
      onsite_support: Boolean(row.onsite_support),
      partsCoverage: Boolean(row.parts_coverage),
      parts_coverage: Boolean(row.parts_coverage),
      exclusions: row.exclusions || '',
      pricingModel: row.pricing_model || 'FIXED',
      pricing_model: row.pricing_model || 'FIXED',
      price: Number(row.price || 0),
      billingFrequency: row.billing_frequency || 'ANNUAL',
      billing_frequency: row.billing_frequency || 'ANNUAL',
      defaultDurationMonths: Number(row.default_duration_months || 12),
      default_duration_months: Number(row.default_duration_months || 12),
      applicableProducts: safeParse(row.applicable_products, []),
      applicable_products: safeParse(row.applicable_products, []),
      inclusions: safeParse(row.inclusions, []),
      slaRules: safeParse(row.sla_rules, []),
      sla_rules: safeParse(row.sla_rules, []),
      renewalConfiguration: safeParse(row.renewal_configuration, {}),
      renewal_configuration: safeParse(row.renewal_configuration, {}),
      isActive: Boolean(row.is_active),
      is_active: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAmcPlans(tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM amc_plans WHERE tenant_id = $1 ORDER BY created_at ASC`,
      tId,
    );
    return rows.map((r) => this.formatAmcPlan(r));
  }

  async getAmcPlanById(id: string, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM amc_plans WHERE id = $1 AND tenant_id = $2`,
      id,
      tId,
    );
    return rows.length ? this.formatAmcPlan(rows[0]) : null;
  }

  async createAmcPlan(data: any, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    if (!data.name || !data.code) {
      throw new BadRequestException('Plan Name and Plan Code are required');
    }
    const cleanCode = data.code.trim().toUpperCase();
    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM amc_plans WHERE code = $1 AND tenant_id = $2`,
      cleanCode,
      tId,
    );
    if (existing.length > 0) {
      throw new BadRequestException(`An AMC Plan with code '${cleanCode}' already exists`);
    }

    const nextSeq = await this.prisma.getNextSequence('AMC_PLAN_SEQ');
    const id = `PLAN-${String(nextSeq).padStart(4, '0')}`;
    const name = data.name.trim();
    const description = data.description || '';
    const coverageType = data.coverageType || data.coverage_type || 'COMPREHENSIVE';
    const supportAvailability = data.supportAvailability || data.support_availability || 'BUSINESS_HOURS';
    const responseTimeHours = Number(data.responseTimeHours ?? data.response_time_hours ?? 4);
    const resolutionTimeHours = Number(data.resolutionTimeHours ?? data.resolution_time_hours ?? 24);
    const preventiveMaintenanceFrequency =
      data.preventiveMaintenanceFrequency || data.preventive_maintenance_frequency || 'QUARTERLY';
    const includedVisits = Number(data.includedVisits ?? data.included_visits ?? 4);
    const remoteSupport = data.remoteSupport !== false && data.remote_support !== false;
    const onsiteSupport = Boolean(data.onsiteSupport ?? data.onsite_support ?? true);
    const partsCoverage = Boolean(data.partsCoverage ?? data.parts_coverage ?? false);
    const exclusions = data.exclusions || '';
    const pricingModel = data.pricingModel || data.pricing_model || 'FIXED';
    const price = Number(data.price ?? 0);
    const billingFrequency = data.billingFrequency || data.billing_frequency || 'ANNUAL';
    const defaultDurationMonths = Number(data.defaultDurationMonths ?? data.default_duration_months ?? 12);
    const applicableProducts = JSON.stringify(data.applicableProducts || data.applicable_products || []);
    const inclusions = JSON.stringify(data.inclusions || []);
    const slaRules = JSON.stringify(data.slaRules || data.sla_rules || []);
    const isActive = data.isActive !== false && data.is_active !== false;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO amc_plans (
        id, tenant_id, name, code, description, coverage_type, support_availability,
        response_time_hours, resolution_time_hours, preventive_maintenance_frequency,
        included_visits, remote_support, onsite_support, parts_coverage, exclusions,
        pricing_model, price, billing_frequency, default_duration_months,
        applicable_products, inclusions, sla_rules, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, $23
      )`,
      id,
      tId,
      name,
      cleanCode,
      description,
      coverageType,
      supportAvailability,
      responseTimeHours,
      resolutionTimeHours,
      preventiveMaintenanceFrequency,
      includedVisits,
      remoteSupport,
      onsiteSupport,
      partsCoverage,
      exclusions,
      pricingModel,
      price,
      billingFrequency,
      defaultDurationMonths,
      applicableProducts,
      inclusions,
      slaRules,
      isActive,
    );

    await this.auditService.log({
      actorUserId,
      action: 'AMC_PLAN_CREATED',
      entityType: 'AMC_PLAN',
      entityId: id,
      newValues: { id, name, code: cleanCode, price, coverageType, tenantId: tId },
    });

    return this.getAmcPlanById(id, tId);
  }

  async updateAmcPlan(id: string, data: any, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const existing = await this.getAmcPlanById(id, tId);
    if (!existing) throw new NotFoundException('AMC Plan not found');

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const coverageType = data.coverageType || data.coverage_type || existing.coverageType;
    const supportAvailability = data.supportAvailability || data.support_availability || existing.supportAvailability;
    const responseTimeHours = Number(data.responseTimeHours ?? data.response_time_hours ?? existing.responseTimeHours);
    const resolutionTimeHours = Number(data.resolutionTimeHours ?? data.resolution_time_hours ?? existing.resolutionTimeHours);
    const preventiveMaintenanceFrequency =
      data.preventiveMaintenanceFrequency || data.preventive_maintenance_frequency || existing.preventiveMaintenanceFrequency;
    const includedVisits = Number(data.includedVisits ?? data.included_visits ?? existing.includedVisits);
    const remoteSupport = data.remoteSupport !== undefined ? Boolean(data.remoteSupport) : (data.remote_support !== undefined ? Boolean(data.remote_support) : existing.remoteSupport);
    const onsiteSupport = data.onsiteSupport !== undefined ? Boolean(data.onsiteSupport) : (data.onsite_support !== undefined ? Boolean(data.onsite_support) : existing.onsiteSupport);
    const partsCoverage = data.partsCoverage !== undefined ? Boolean(data.partsCoverage) : (data.parts_coverage !== undefined ? Boolean(data.parts_coverage) : existing.partsCoverage);
    const exclusions = data.exclusions !== undefined ? data.exclusions : existing.exclusions;
    const pricingModel = data.pricingModel || data.pricing_model || existing.pricingModel;
    const price = Number(data.price ?? existing.price);
    const billingFrequency = data.billingFrequency || data.billing_frequency || existing.billingFrequency;
    const defaultDurationMonths = Number(data.defaultDurationMonths ?? data.default_duration_months ?? existing.defaultDurationMonths);
    const applicableProducts = JSON.stringify(data.applicableProducts || data.applicable_products || existing.applicableProducts);
    const inclusions = JSON.stringify(data.inclusions || existing.inclusions);
    const slaRules = JSON.stringify(data.slaRules || data.sla_rules || existing.slaRules);
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : (data.is_active !== undefined ? Boolean(data.is_active) : existing.isActive);

    await this.prisma.$executeRawUnsafe(
      `UPDATE amc_plans SET
        name = $1, description = $2, coverage_type = $3, support_availability = $4,
        response_time_hours = $5, resolution_time_hours = $6, preventive_maintenance_frequency = $7,
        included_visits = $8, remote_support = $9, onsite_support = $10, parts_coverage = $11,
        exclusions = $12, pricing_model = $13, price = $14, billing_frequency = $15,
        default_duration_months = $16, applicable_products = $17::jsonb, inclusions = $18::jsonb,
        sla_rules = $19::jsonb, is_active = $20, updated_at = now()
      WHERE id = $21 AND tenant_id = $22`,
      name,
      description,
      coverageType,
      supportAvailability,
      responseTimeHours,
      resolutionTimeHours,
      preventiveMaintenanceFrequency,
      includedVisits,
      remoteSupport,
      onsiteSupport,
      partsCoverage,
      exclusions,
      pricingModel,
      price,
      billingFrequency,
      defaultDurationMonths,
      applicableProducts,
      inclusions,
      slaRules,
      isActive,
      id,
      tId,
    );

    await this.auditService.log({
      actorUserId,
      action: 'AMC_PLAN_UPDATED',
      entityType: 'AMC_PLAN',
      entityId: id,
      newValues: { id, name, price, coverageType, tenantId: tId },
    });

    return this.getAmcPlanById(id, tId);
  }

  async duplicateAmcPlan(id: string, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const existing = await this.getAmcPlanById(id, tId);
    if (!existing) throw new NotFoundException('AMC Plan not found');

    const nextSeq = await this.prisma.getNextSequence('AMC_PLAN_SEQ');
    const newId = `PLAN-${String(nextSeq).padStart(4, '0')}`;
    let newCode = `${existing.code}-COPY`;
    let codeCounter = 1;
    while (true) {
      const codeCheck: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM amc_plans WHERE code = $1 AND tenant_id = $2`,
        newCode,
        tId,
      );
      if (codeCheck.length === 0) break;
      codeCounter++;
      newCode = `${existing.code}-COPY${codeCounter}`;
    }

    const newName = `${existing.name} (Copy)`;

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO amc_plans (
        id, tenant_id, name, code, description, coverage_type, support_availability,
        response_time_hours, resolution_time_hours, preventive_maintenance_frequency,
        included_visits, remote_support, onsite_support, parts_coverage, exclusions,
        pricing_model, price, billing_frequency, default_duration_months,
        applicable_products, inclusions, sla_rules, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, true
      )`,
      newId,
      tId,
      newName,
      newCode,
      existing.description,
      existing.coverageType,
      existing.supportAvailability,
      existing.responseTimeHours,
      existing.resolutionTimeHours,
      existing.preventiveMaintenanceFrequency,
      existing.includedVisits,
      existing.remoteSupport,
      existing.onsiteSupport,
      existing.partsCoverage,
      existing.exclusions,
      existing.pricingModel,
      existing.price,
      existing.billingFrequency,
      existing.defaultDurationMonths,
      JSON.stringify(existing.applicableProducts),
      JSON.stringify(existing.inclusions),
      JSON.stringify(existing.slaRules),
    );

    await this.auditService.log({
      actorUserId,
      action: 'AMC_PLAN_DUPLICATED',
      entityType: 'AMC_PLAN',
      entityId: newId,
      newValues: { sourceId: id, newId, name: newName, code: newCode },
    });

    return this.getAmcPlanById(newId, tId);
  }

  async toggleAmcPlanStatus(id: string, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const existing = await this.getAmcPlanById(id, tId);
    if (!existing) throw new NotFoundException('AMC Plan not found');

    const newStatus = !existing.isActive;
    await this.prisma.$executeRawUnsafe(
      `UPDATE amc_plans SET is_active = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3`,
      newStatus,
      id,
      tId,
    );

    await this.auditService.log({
      actorUserId,
      action: 'AMC_PLAN_STATUS_TOGGLED',
      entityType: 'AMC_PLAN',
      entityId: id,
      newValues: { id, isActive: newStatus },
    });

    return this.getAmcPlanById(id, tId);
  }

  async deleteAmcPlan(id: string, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const existing = await this.getAmcPlanById(id, tId);
    if (!existing) throw new NotFoundException('AMC Plan not found');

    await this.prisma.$executeRawUnsafe(`DELETE FROM amc_plans WHERE id = $1 AND tenant_id = $2`, id, tId);

    await this.auditService.log({
      actorUserId,
      action: 'AMC_PLAN_DELETED',
      entityType: 'AMC_PLAN',
      entityId: id,
      oldValues: { id, name: existing.name, code: existing.code },
    });

    return { success: true, message: `AMC Plan '${existing.name}' deleted successfully` };
  }

  // --- Subscriptions / AMC Contracts Core ---

  private extractStructuredContractMetadata(notes: string | null) {
    if (!notes) return { userNotes: '', meta: null };
    const marker = '<!-- AMC_CONTRACT_META_JSON:';
    const idx = notes.indexOf(marker);
    if (idx === -1) {
      return { userNotes: notes, meta: null };
    }
    const endMarker = ':AMC_CONTRACT_META_JSON -->';
    const endIdx = notes.indexOf(endMarker, idx);
    const userNotes = notes.substring(0, idx).trim();
    if (endIdx === -1) {
      return { userNotes, meta: null };
    }
    try {
      const jsonStr = notes.substring(idx + marker.length, endIdx).trim();
      const meta = JSON.parse(jsonStr);
      return { userNotes, meta };
    } catch {
      return { userNotes, meta: null };
    }
  }

  private serializeContractNotes(userNotes: string | null | undefined, meta: any): string {
    const cleanNotes = (userNotes || '').trim();
    if (!meta) return cleanNotes;
    return `${cleanNotes ? cleanNotes + '\n\n' : ''}<!-- AMC_CONTRACT_META_JSON: ${JSON.stringify(meta)} :AMC_CONTRACT_META_JSON -->`;
  }

  async getSubscriptions(params: {
    companyId?: string;
    productId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    tenantId?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.tenantId) where.tenantId = params.tenantId;

    if (params.companyId) where.companyId = params.companyId;
    if (params.productId) where.productId = params.productId;
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as SubscriptionStatus;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { planName: { contains: q, mode: 'insensitive' } },
        { company: { companyName: { contains: q, mode: 'insensitive' } } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expiryDate: 'asc' },
        include: {
          company: { select: { id: true, companyName: true, primaryEmail: true, contactPerson: true, contactPhone: true } },
          product: { select: { id: true, code: true, name: true, category: true } },
          ownerEmployee: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const now = new Date();
    const formatted = items.map((sub) => {
      const expiry = new Date(sub.expiryDate);
      const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const autoStatus = this.computeStatus(sub.expiryDate, sub.status, sub.startDate);
      const { userNotes, meta } = this.extractStructuredContractMetadata(sub.notes);

      return {
        id: sub.id,
        agreement_id: sub.id,
        agreementId: sub.id,
        company_id: sub.companyId,
        companyId: sub.companyId,
        company_name: sub.company?.companyName || null,
        companyName: sub.company?.companyName || null,
        company_email: sub.company?.primaryEmail || null,
        companyEmail: sub.company?.primaryEmail || null,
        contact_person: sub.company?.contactPerson || null,
        contact_phone: sub.company?.contactPhone || null,
        product_id: sub.productId,
        productId: sub.productId,
        product_code: sub.product?.code || null,
        productCode: sub.product?.code || null,
        product_name: sub.product?.name || null,
        productName: sub.product?.name || null,
        product_category: sub.product?.category || null,
        productCategory: sub.product?.category || null,
        plan_name: sub.planName,
        planName: sub.planName,
        start_date: sub.startDate,
        startDate: sub.startDate,
        expiry_date: sub.expiryDate,
        expiryDate: sub.expiryDate,
        renewal_date: sub.renewalDate,
        renewalDate: sub.renewalDate,
        days_remaining: daysRemaining,
        daysRemaining,
        status: autoStatus,
        owner_employee_id: sub.ownerEmployeeId,
        ownerEmployeeId: sub.ownerEmployeeId,
        owner_employee_name: sub.ownerEmployee?.name || null,
        ownerEmployeeName: sub.ownerEmployee?.name || null,
        notes: userNotes,
        rawNotes: sub.notes,
        last_warning_sent_at: sub.lastWarningSentAt,
        lastWarningSentAt: sub.lastWarningSentAt,
        warning_count: sub.warningCount,
        warningCount: sub.warningCount,
        created_at: sub.createdAt,
        createdAt: sub.createdAt,
        updated_at: sub.updatedAt,
        updatedAt: sub.updatedAt,
        tenantId: sub.tenantId,
        // Structured metadata unpacked
        contractAmount: meta?.contractAmount ?? null,
        currency: meta?.currency || 'INR',
        taxRate: meta?.taxRate ?? 18,
        totalAmount: meta?.totalAmount ?? null,
        billingFrequency: meta?.billingFrequency || 'ANNUAL',
        paymentTerms: meta?.paymentTerms || 'Net 30',
        renewalType: meta?.renewalType || 'MANUAL',
        coverageType: meta?.coverageType || 'COMPREHENSIVE',
        preventiveVisits: meta?.preventiveVisits ?? 4,
        supportTeam: meta?.supportTeam || 'L2 Support',
        contractMeta: meta,
      };
    });

    return {
      data: formatted,
      total,
      page,
      limit,
    };
  }

  async getSubscriptionById(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const sub = await this.prisma.subscription.findFirst({
      where,
      include: {
        company: true,
        product: true,
        ownerEmployee: true,
        implementations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sub) return null;

    const now = new Date();
    const expiry = new Date(sub.expiryDate);
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const autoStatus = this.computeStatus(sub.expiryDate, sub.status, sub.startDate);
    const { userNotes, meta } = this.extractStructuredContractMetadata(sub.notes);

    // Also fetch associated tickets for this customer & product to show in contract details
    const relatedTickets = await this.prisma.ticket.findMany({
      where: {
        companyId: sub.companyId,
        productId: sub.productId,
        ...(tenantId ? { tenantId } : {}),
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        problemType: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });

    return {
      id: sub.id,
      agreement_id: sub.id,
      agreementId: sub.id,
      company_id: sub.companyId,
      companyId: sub.companyId,
      company_name: sub.company?.companyName || null,
      companyName: sub.company?.companyName || null,
      company: sub.company,
      product_id: sub.productId,
      productId: sub.productId,
      product_name: sub.product?.name || null,
      productName: sub.product?.name || null,
      product: sub.product,
      plan_name: sub.planName,
      planName: sub.planName,
      start_date: sub.startDate,
      startDate: sub.startDate,
      expiry_date: sub.expiryDate,
      expiryDate: sub.expiryDate,
      renewal_date: sub.renewalDate,
      renewalDate: sub.renewalDate,
      days_remaining: daysRemaining,
      daysRemaining,
      status: autoStatus,
      owner_employee_id: sub.ownerEmployeeId,
      ownerEmployeeId: sub.ownerEmployeeId,
      owner_employee: sub.ownerEmployee,
      ownerEmployee: sub.ownerEmployee,
      notes: userNotes,
      rawNotes: sub.notes,
      last_warning_sent_at: sub.lastWarningSentAt,
      warning_count: sub.warningCount,
      implementations: sub.implementations,
      relatedTickets,
      created_at: sub.createdAt,
      createdAt: sub.createdAt,
      updated_at: sub.updatedAt,
      tenantId: sub.tenantId,
      // Metadata unpacked
      contractMeta: meta || {},
      contractAmount: meta?.contractAmount ?? null,
      currency: meta?.currency || 'INR',
      taxRate: meta?.taxRate ?? 18,
      taxAmount: meta?.taxAmount ?? null,
      totalAmount: meta?.totalAmount ?? null,
      billingFrequency: meta?.billingFrequency || 'ANNUAL',
      paymentTerms: meta?.paymentTerms || 'Net 30',
      renewalType: meta?.renewalType || 'MANUAL',
      coverageType: meta?.coverageType || 'COMPREHENSIVE',
      preventiveVisits: meta?.preventiveVisits ?? 4,
      pmFrequency: meta?.pmFrequency || 'QUARTERLY',
      remoteSupport: meta?.remoteSupport ?? true,
      onsiteSupport: meta?.onsiteSupport ?? true,
      breakdownSupport: meta?.breakdownSupport ?? true,
      softwareUpdates: meta?.softwareUpdates ?? true,
      partsCoverage: meta?.partsCoverage ?? false,
      exclusions: meta?.exclusions || null,
      supportAvailability: meta?.supportAvailability || 'BUSINESS_HOURS',
      responseTimeHours: meta?.responseTimeHours ?? 4,
      resolutionTimeHours: meta?.resolutionTimeHours ?? 24,
      supportTeam: meta?.supportTeam || 'L2 Support Team',
      renewalHistory: meta?.renewalHistory || [],
    };
  }

  async createSubscription(data: any, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const companyId = data.companyId || data.company_id;
    const rawStartDate = data.startDate || data.start_date;
    const rawExpiryDate = data.expiryDate || data.expiry_date;
    const planName =
      data.agreementName ||
      data.planName ||
      data.plan_name ||
      data.contractName ||
      data.contract_name ||
      'Standard Enterprise AMC';
    const ownerEmployeeId = data.ownerEmployeeId || data.owner_employee_id || null;

    if (!companyId || !rawStartDate || !rawExpiryDate) {
      throw new BadRequestException('Customer Company, Start Date, and Expiry Date are required');
    }

    // Tenant check on company
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId: tId },
    });
    if (!company) {
      throw new BadRequestException('Referenced customer company does not exist in the active tenant');
    }

    const startDate = new Date(rawStartDate);
    const expiryDate = new Date(rawExpiryDate);

    if (isNaN(startDate.getTime()) || isNaN(expiryDate.getTime())) {
      throw new BadRequestException('Invalid date provided for Start Date or Expiry Date');
    }

    if (expiryDate <= startDate) {
      throw new BadRequestException('Expiry Date must be strictly after Start Date');
    }

    // Determine target productId
    let targetProductId = data.productId || data.product_id;
    if (!targetProductId && data.productIds && data.productIds.length > 0) {
      targetProductId = data.productIds[0];
    }

    if (!targetProductId) {
      throw new BadRequestException('A valid Product must be selected for the AMC Contract');
    }

    // Validate that product is mapped to the customer company
    const companyProduct = await this.prisma.companyProduct.findFirst({
      where: { companyId, productId: targetProductId },
    });
    if (!companyProduct) {
      // Check if product exists in tenant
      const product = await this.prisma.product.findFirst({
        where: { id: targetProductId, tenantId: tId },
      });
      if (!product) {
        throw new BadRequestException('Selected product does not belong to active tenant');
      }
      // If companyProduct record doesn't exist yet, automatically map it to ensure customer product entitlement
      await this.prisma.companyProduct.create({
        data: {
          companyId,
          productId: targetProductId,
          isActive: true,
        },
      });
    }

    // Validate owner employee if specified
    if (ownerEmployeeId) {
      const emp = await this.prisma.employee.findFirst({
        where: { id: ownerEmployeeId, tenantId: tId },
      });
      if (!emp) {
        throw new BadRequestException('Assigned Account Manager does not belong to active tenant');
      }
    }

    // Compute status
    let status: SubscriptionStatus;
    if (data.status === 'DRAFT') {
      status = 'DRAFT' as SubscriptionStatus;
    } else {
      status = this.computeStatus(expiryDate, SubscriptionStatus.ACTIVE, startDate);
    }

    const id = await this.generateSubscriptionId();

    // Prepare contract metadata
    const contractAmount = Number(data.contractAmount ?? data.amount ?? data.price ?? 0);
    const taxRate = Number(data.taxRate ?? 18);
    const taxAmount = Number(data.taxAmount ?? ((contractAmount * taxRate) / 100));
    const totalAmount = Number(data.totalAmount ?? (contractAmount + taxAmount));

    const contractMeta = {
      planId: data.planId || data.plan_id || null,
      planCode: data.planCode || data.plan_code || null,
      contractAmount,
      currency: data.currency || 'INR',
      taxRate,
      taxAmount,
      totalAmount,
      billingFrequency: data.billingFrequency || data.billing_frequency || 'ANNUAL',
      paymentTerms: data.paymentTerms || data.payment_terms || 'Net 30',
      renewalType: data.renewalType || data.renewal_type || 'MANUAL',
      supportTeam: data.supportTeam || data.support_team || 'L2 Support Team',
      coverageType: data.coverageType || data.coverage_type || 'COMPREHENSIVE',
      preventiveVisits: Number(data.preventiveVisits ?? data.includedVisits ?? data.included_visits ?? 4),
      pmFrequency: data.pmFrequency || data.preventiveMaintenanceFrequency || data.preventive_maintenance_frequency || 'QUARTERLY',
      remoteSupport: data.remoteSupport !== false && data.remote_support !== false,
      onsiteSupport: Boolean(data.onsiteSupport ?? data.onsite_support ?? true),
      breakdownSupport: data.breakdownSupport !== false && data.breakdown_support !== false,
      softwareUpdates: data.softwareUpdates !== false && data.software_updates !== false,
      partsCoverage: Boolean(data.partsCoverage ?? data.parts_coverage ?? false),
      exclusions: data.exclusions || null,
      responseTimeHours: Number(data.responseTimeHours ?? data.response_time_hours ?? 4),
      resolutionTimeHours: Number(data.resolutionTimeHours ?? data.resolution_time_hours ?? 24),
      supportAvailability: data.supportAvailability || data.support_availability || 'BUSINESS_HOURS',
      slaRules: data.slaRules || data.sla_rules || [],
      renewalHistory: [],
    };

    const combinedNotes = this.serializeContractNotes(data.notes, contractMeta);

    const sub = await this.prisma.subscription.create({
      data: {
        id,
        companyId,
        productId: targetProductId,
        planName: planName.trim(),
        startDate,
        expiryDate,
        status,
        ownerEmployeeId,
        notes: combinedNotes,
        tenantId: tId,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_CREATED',
      entityType: 'SUBSCRIPTION',
      entityId: sub.id,
      newValues: {
        id: sub.id,
        companyId,
        productId: targetProductId,
        planName: sub.planName,
        status: sub.status,
        startDate,
        expiryDate,
        totalAmount,
        tenantId: sub.tenantId,
      },
    });

    return this.getSubscriptionById(sub.id, tId);
  }

  async updateSubscription(
    id: string,
    data: any,
    actorUserId: number,
    tenantId?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const existing = await this.prisma.subscription.findFirst({
      where: { id, tenantId: tId },
    });
    if (!existing) throw new NotFoundException('Subscription not found');

    const updateData: any = {};
    if (data.planName || data.plan_name) updateData.planName = (data.planName || data.plan_name)?.trim();
    if (data.startDate || data.start_date) updateData.startDate = new Date(data.startDate || data.start_date!);
    if (data.expiryDate || data.expiry_date) {
      const exp = new Date(data.expiryDate || data.expiry_date!);
      updateData.expiryDate = exp;
      if (!data.status) {
        updateData.status = this.computeStatus(exp, existing.status, updateData.startDate || existing.startDate);
      }
    }
    if (data.renewalDate || data.renewal_date) updateData.renewalDate = new Date(data.renewalDate || data.renewal_date!);
    if (data.status) updateData.status = data.status;
    if (data.ownerEmployeeId !== undefined || data.owner_employee_id !== undefined) {
      updateData.ownerEmployeeId = data.ownerEmployeeId || data.owner_employee_id || null;
    }

    // Update notes and metadata if provided
    const { userNotes, meta } = this.extractStructuredContractMetadata(existing.notes);
    const updatedMeta = { ...(meta || {}) };

    if (data.contractAmount !== undefined) updatedMeta.contractAmount = Number(data.contractAmount);
    if (data.billingFrequency !== undefined) updatedMeta.billingFrequency = data.billingFrequency;
    if (data.paymentTerms !== undefined) updatedMeta.paymentTerms = data.paymentTerms;
    if (data.coverageType !== undefined) updatedMeta.coverageType = data.coverageType;
    if (data.preventiveVisits !== undefined) updatedMeta.preventiveVisits = Number(data.preventiveVisits);
    if (data.supportTeam !== undefined) updatedMeta.supportTeam = data.supportTeam;

    const finalNotes = data.notes !== undefined ? data.notes : userNotes;
    updateData.notes = this.serializeContractNotes(finalNotes, updatedMeta);

    const updated = await this.prisma.subscription.update({
      where: { id: existing.id },
      data: updateData,
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_UPDATED',
      entityType: 'SUBSCRIPTION',
      entityId: id,
      oldValues: { status: existing.status, expiryDate: existing.expiryDate },
      newValues: updateData,
    });

    return this.getSubscriptionById(id, tId);
  }

  async sendWarning(id: string, actorUserId: number, customMessage?: string, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const sub = await this.prisma.subscription.findFirst({
      where: { id, tenantId: tId },
      include: {
        company: {
          include: {
            contacts: { where: { isActive: true } },
          },
        },
        product: true,
      },
    });

    if (!sub) throw new NotFoundException('Subscription not found');

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        lastWarningSentAt: new Date(),
        warningCount: { increment: 1 },
      },
    });

    const primaryContact = sub.company.contacts.find((c) => c.isPrimary) || sub.company.contacts[0];
    const targetEmail = primaryContact?.email || sub.company.primaryEmail;
    const targetUserId = primaryContact?.userId || undefined;

    const msg =
      customMessage ||
      `Your AMC subscription for ${sub.product.name} (${sub.planName}) expires on ${new Date(sub.expiryDate).toLocaleDateString()}. Please contact your account representative to renew and maintain uninterrupted SLA coverage.`;

    await this.notificationsService.broadcastTicketEvent({
      eventType: 'SUBSCRIPTION_WARNING',
      ticketId: sub.id,
      title: `AMC Contract Renewal Reminder: ${sub.product.name}`,
      message: msg,
      recipientUserId: targetUserId,
      recipientEmail: targetEmail,
      linkUrl: `/annual-maintenance`,
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_WARNING_SENT',
      entityType: 'SUBSCRIPTION',
      entityId: id,
      newValues: { recipientEmail: targetEmail, warningCount: updated.warningCount, sentAt: updated.lastWarningSentAt },
    });

    return {
      success: true,
      message: `Renewal warning dispatched successfully to ${targetEmail}`,
      subscription: updated,
    };
  }

  async renewSubscription(
    id: string,
    data: {
      newExpiryDate: string | Date;
      planName?: string;
      notes?: string;
      amount?: number;
      poNumber?: string;
    },
    actorUserId: number,
    tenantId?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const sub = await this.prisma.subscription.findFirst({
      where: { id, tenantId: tId },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    const newExpiry = new Date(data.newExpiryDate);
    if (isNaN(newExpiry.getTime())) {
      throw new BadRequestException('Invalid date provided for Renewal Expiry Date');
    }

    const { userNotes, meta } = this.extractStructuredContractMetadata(sub.notes);
    const existingHistory = meta?.renewalHistory || [];

    const renewalRecord = {
      renewedAt: new Date().toISOString(),
      renewedByUserId: actorUserId,
      previousExpiryDate: sub.expiryDate,
      newExpiryDate: newExpiry,
      planName: data.planName?.trim() || sub.planName,
      amount: data.amount ?? meta?.contractAmount ?? null,
      poNumber: data.poNumber || null,
      notes: data.notes || '',
    };

    const updatedMeta = {
      ...(meta || {}),
      renewalHistory: [...existingHistory, renewalRecord],
      lastRenewedAt: new Date().toISOString(),
    };

    if (data.amount !== undefined) {
      updatedMeta.contractAmount = Number(data.amount);
    }

    const renewalNotePrefix = `[Renewed on ${new Date().toLocaleDateString()}]: ${data.notes || 'Renewed agreement'}`;
    const combinedUserNotes = userNotes ? `${userNotes}\n${renewalNotePrefix}` : renewalNotePrefix;
    const combinedSerializedNotes = this.serializeContractNotes(combinedUserNotes, updatedMeta);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        renewalDate: new Date(),
        expiryDate: newExpiry,
        status: SubscriptionStatus.RENEWED,
        planName: data.planName?.trim() || sub.planName,
        notes: combinedSerializedNotes,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_RENEWED',
      entityType: 'SUBSCRIPTION',
      entityId: id,
      oldValues: { oldExpiry: sub.expiryDate, oldStatus: sub.status },
      newValues: { newExpiry, status: SubscriptionStatus.RENEWED, renewalRecord },
    });

    return this.getSubscriptionById(id, tId);
  }

  async getStats(tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const all = await this.prisma.subscription.findMany({ where: { tenantId: tId } });

    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let renewed = 0;
    let draft = 0;
    let suspended = 0;

    for (const s of all) {
      const st = this.computeStatus(s.expiryDate, s.status, s.startDate);
      const stStr = String(st);
      if (stStr === 'ACTIVE') active++;
      else if (stStr === 'EXPIRING_SOON') expiringSoon++;
      else if (stStr === 'EXPIRED') expired++;
      else if (stStr === 'RENEWED') renewed++;
      else if (stStr === 'DRAFT') draft++;
      else if (stStr === 'SUSPENDED') suspended++;
    }

    return {
      total: all.length,
      active,
      expiringSoon,
      expired,
      renewed,
      draft,
      suspended,
    };
  }

  async deleteSubscription(id: string, actorUserId: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const sub = await this.prisma.subscription.findFirst({
      where: { id, tenantId: tId },
      include: { company: true, product: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.prisma.subscription.delete({
      where: { id },
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_DELETED',
      entityType: 'SUBSCRIPTION',
      entityId: id,
      oldValues: {
        id,
        companyName: sub.company?.companyName,
        productName: sub.product?.name,
        planName: sub.planName,
        status: sub.status,
      },
    });

    return { success: true, message: `Subscription '${id}' deleted successfully.` };
  }
}
