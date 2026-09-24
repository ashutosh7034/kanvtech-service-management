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
    const nextSeq = await this.prisma.getNextSequence('SUBSCRIPTION_SEQ');
    return `SUB-${String(nextSeq).padStart(4, '0')}`;
  }

  computeStatus(expiryDate: Date, currentStatus: SubscriptionStatus): SubscriptionStatus {
    if (currentStatus === SubscriptionStatus.RENEWED) return SubscriptionStatus.RENEWED;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return SubscriptionStatus.EXPIRED;
    if (diffDays <= 30) return SubscriptionStatus.EXPIRING_SOON;
    return SubscriptionStatus.ACTIVE;
  }

  async getSubscriptions(params: {
    companyId?: string;
    productId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

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
          company: { select: { id: true, companyName: true, primaryEmail: true } },
          product: { select: { id: true, code: true, name: true, category: true } },
          ownerEmployee: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const now = new Date();
    const formatted = items.map((sub) => {
      const expiry = new Date(sub.expiryDate);
      const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const autoStatus = this.computeStatus(sub.expiryDate, sub.status);

      return {
        id: sub.id,
        company_id: sub.companyId,
        company_name: sub.company?.companyName || null,
        company_email: sub.company?.primaryEmail || null,
        product_id: sub.productId,
        product_code: sub.product?.code || null,
        product_name: sub.product?.name || null,
        product_category: sub.product?.category || null,
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
        owner_employee_name: sub.ownerEmployee?.name || null,
        notes: sub.notes,
        last_warning_sent_at: sub.lastWarningSentAt,
        warning_count: sub.warningCount,
        created_at: sub.createdAt,
        updated_at: sub.updatedAt,
      };
    });

    return {
      data: formatted,
      total,
      page,
      limit,
    };
  }

  async getSubscriptionById(id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
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
    const autoStatus = this.computeStatus(sub.expiryDate, sub.status);

    return {
      id: sub.id,
      company_id: sub.companyId,
      company_name: sub.company?.companyName || null,
      company: sub.company,
      product_id: sub.productId,
      product_name: sub.product?.name || null,
      product: sub.product,
      plan_name: sub.planName,
      start_date: sub.startDate,
      expiry_date: sub.expiryDate,
      renewal_date: sub.renewalDate,
      days_remaining: daysRemaining,
      status: autoStatus,
      owner_employee_id: sub.ownerEmployeeId,
      owner_employee: sub.ownerEmployee,
      notes: sub.notes,
      last_warning_sent_at: sub.lastWarningSentAt,
      warning_count: sub.warningCount,
      implementations: sub.implementations,
      created_at: sub.createdAt,
      updated_at: sub.updatedAt,
    };
  }

  async createSubscription(
    data: {
      companyId?: string;
      company_id?: string;
      productId?: string;
      product_id?: string;
      planName?: string;
      plan_name?: string;
      startDate?: string | Date;
      start_date?: string | Date;
      expiryDate?: string | Date;
      expiry_date?: string | Date;
      ownerEmployeeId?: string;
      owner_employee_id?: string;
      notes?: string;
    },
    actorUserId: number,
  ) {
    const companyId = data.companyId || data.company_id;
    let productId = data.productId || data.product_id;
    if (!productId) {
      const defaultProd = await this.prisma.product.findFirst({ where: { isActive: true } });
      productId = defaultProd?.id || (await this.prisma.product.findFirst())?.id;
    }
    const planName = data.planName || data.plan_name || (data as any).contractName || (data as any).contract_name || 'Standard Enterprise AMC';
    const rawStartDate = data.startDate || data.start_date;
    const rawExpiryDate = data.expiryDate || data.expiry_date;
    const ownerEmployeeId = data.ownerEmployeeId || data.owner_employee_id || null;

    if (!companyId || !productId || !planName || !rawStartDate || !rawExpiryDate) {
      throw new BadRequestException('Company, Product, Plan Name, Start Date, and Expiry Date are required');
    }

    const startDate = new Date(rawStartDate);
    const expiryDate = new Date(rawExpiryDate);

    if (isNaN(startDate.getTime()) || isNaN(expiryDate.getTime())) {
      throw new BadRequestException('Invalid date provided for Start Date or Expiry Date');
    }

    if (expiryDate <= startDate) {
      throw new BadRequestException('Expiry Date must be after Start Date');
    }

    const status = this.computeStatus(expiryDate, SubscriptionStatus.ACTIVE);
    const id = await this.generateSubscriptionId();

    const sub = await this.prisma.subscription.create({
      data: {
        id,
        companyId,
        productId,
        planName: planName.trim(),
        startDate,
        expiryDate,
        status,
        ownerEmployeeId,
        notes: data.notes?.trim() || null,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_CREATED',
      entityType: 'SUBSCRIPTION',
      entityId: sub.id,
      newValues: { id: sub.id, companyId, productId, planName, expiryDate },
    });

    return this.getSubscriptionById(sub.id);
  }

  async updateSubscription(
    id: string,
    data: {
      planName?: string;
      plan_name?: string;
      startDate?: string | Date;
      start_date?: string | Date;
      expiryDate?: string | Date;
      expiry_date?: string | Date;
      renewalDate?: string | Date;
      renewal_date?: string | Date;
      status?: SubscriptionStatus;
      ownerEmployeeId?: string;
      owner_employee_id?: string;
      notes?: string;
    },
    actorUserId: number,
  ) {
    const existing = await this.prisma.subscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subscription not found');

    const updateData: any = {};
    if (data.planName || data.plan_name) updateData.planName = (data.planName || data.plan_name)?.trim();
    if (data.startDate || data.start_date) updateData.startDate = new Date(data.startDate || data.start_date!);
    if (data.expiryDate || data.expiry_date) {
      const exp = new Date(data.expiryDate || data.expiry_date!);
      updateData.expiryDate = exp;
      if (!data.status) {
        updateData.status = this.computeStatus(exp, existing.status);
      }
    }
    if (data.renewalDate || data.renewal_date) updateData.renewalDate = new Date(data.renewalDate || data.renewal_date!);
    if (data.status) updateData.status = data.status;
    if (data.ownerEmployeeId !== undefined || data.owner_employee_id !== undefined) {
      updateData.ownerEmployeeId = data.ownerEmployeeId || data.owner_employee_id || null;
    }
    if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

    const updated = await this.prisma.subscription.update({
      where: { id },
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

    return this.getSubscriptionById(id);
  }

  async sendWarning(id: string, actorUserId: number, customMessage?: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
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
      where: { id },
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
      `Your subscription for ${sub.product.name} (${sub.planName}) expires on ${new Date(sub.expiryDate).toLocaleDateString()}. Please contact your account representative to renew and maintain uninterrupted SLA coverage.`;

    await this.notificationsService.broadcastTicketEvent({
      eventType: 'SUBSCRIPTION_WARNING',
      ticketId: sub.id,
      title: `Subscription Renewal Reminder: ${sub.product.name}`,
      message: msg,
      recipientUserId: targetUserId,
      recipientEmail: targetEmail,
      linkUrl: `/maintenance`,
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
    data: { newExpiryDate: string | Date; planName?: string; notes?: string },
    actorUserId: number,
  ) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const newExpiry = new Date(data.newExpiryDate);
    if (isNaN(newExpiry.getTime())) {
      throw new BadRequestException('Invalid date provided for Renewal Expiry Date');
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        renewalDate: new Date(),
        expiryDate: newExpiry,
        status: SubscriptionStatus.RENEWED,
        planName: data.planName?.trim() || sub.planName,
        notes: data.notes ? `${sub.notes ? sub.notes + '\n' : ''}[Renewed on ${new Date().toLocaleDateString()}]: ${data.notes}` : sub.notes,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'SUBSCRIPTION_RENEWED',
      entityType: 'SUBSCRIPTION',
      entityId: id,
      oldValues: { oldExpiry: sub.expiryDate, oldStatus: sub.status },
      newValues: { newExpiry, status: SubscriptionStatus.RENEWED },
    });

    return this.getSubscriptionById(id);
  }

  async getStats() {
    const now = new Date();
    const all = await this.prisma.subscription.findMany();

    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let renewed = 0;

    for (const s of all) {
      const st = this.computeStatus(s.expiryDate, s.status);
      if (st === SubscriptionStatus.ACTIVE) active++;
      else if (st === SubscriptionStatus.EXPIRING_SOON) expiringSoon++;
      else if (st === SubscriptionStatus.EXPIRED) expired++;
      else if (st === SubscriptionStatus.RENEWED) renewed++;
    }

    return {
      total: all.length,
      active,
      expiringSoon,
      expired,
      renewed,
    };
  }
}
