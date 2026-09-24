import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ImplementationStatus } from '@prisma/client';

@Injectable()
export class ImplementationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateImplementationId(): Promise<string> {
    const nextSeq = await this.prisma.getNextSequence('IMPLEMENTATION_SEQ');
    return `IMP-${String(nextSeq).padStart(4, '0')}`;
  }

  async getImplementations(params: {
    companyId?: string;
    productId?: string;
    status?: string;
    ownerEmployeeId?: string;
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
    if (params.ownerEmployeeId) where.ownerEmployeeId = params.ownerEmployeeId;
    if (params.status && params.status !== 'ALL') {
      where.status = params.status as ImplementationStatus;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { company: { companyName: { contains: q, mode: 'insensitive' } } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { pendingActivities: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.implementation.count({ where }),
      this.prisma.implementation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { targetGoLiveDate: 'asc' }],
        include: {
          company: { select: { id: true, companyName: true, primaryEmail: true } },
          product: { select: { id: true, code: true, name: true, category: true } },
          subscription: { select: { id: true, planName: true, status: true } },
          ownerEmployee: { select: { id: true, name: true, email: true, designation: true } },
        },
      }),
    ]);

    const formatted = items.map((imp) => ({
      id: imp.id,
      company_id: imp.companyId,
      company_name: imp.company?.companyName || null,
      company_email: imp.company?.primaryEmail || null,
      product_id: imp.productId,
      product_name: imp.product?.name || null,
      product_code: imp.product?.code || null,
      subscription_id: imp.subscriptionId,
      subscription_plan: imp.subscription?.planName || null,
      owner_employee_id: imp.ownerEmployeeId,
      owner_employee_name: imp.ownerEmployee?.name || null,
      owner_employee_designation: imp.ownerEmployee?.designation || null,
      team_members: imp.teamMembersJson ? JSON.parse(imp.teamMembersJson) : [],
      start_date: imp.startDate,
      target_go_live_date: imp.targetGoLiveDate,
      actual_go_live_date: imp.actualGoLiveDate,
      status: imp.status,
      progress_percentage: imp.progressPercentage,
      pending_activities: imp.pendingActivities,
      notes: imp.notes,
      completed_at: imp.completedAt,
      created_at: imp.createdAt,
      updated_at: imp.updatedAt,
    }));

    return {
      data: formatted,
      total,
      page,
      limit,
    };
  }

  async getImplementationById(id: string) {
    const imp = await this.prisma.implementation.findUnique({
      where: { id },
      include: {
        company: true,
        product: true,
        subscription: true,
        ownerEmployee: true,
      },
    });

    if (!imp) return null;

    return {
      id: imp.id,
      project_code: imp.id,
      projectCode: imp.id,
      company_id: imp.companyId,
      company_name: imp.company?.companyName || null,
      company: imp.company,
      product_id: imp.productId,
      product_name: imp.product?.name || null,
      product: imp.product,
      subscription_id: imp.subscriptionId,
      subscription: imp.subscription,
      owner_employee_id: imp.ownerEmployeeId,
      owner_employee: imp.ownerEmployee,
      team_members: imp.teamMembersJson ? JSON.parse(imp.teamMembersJson) : [],
      start_date: imp.startDate,
      target_go_live_date: imp.targetGoLiveDate,
      actual_go_live_date: imp.actualGoLiveDate,
      status: imp.status,
      progress_percentage: imp.progressPercentage,
      progressPercentage: imp.progressPercentage,
      pending_activities: imp.pendingActivities,
      notes: imp.notes,
      completed_at: imp.completedAt,
      created_at: imp.createdAt,
      updated_at: imp.updatedAt,
    };
  }

  async createImplementation(
    data: {
      companyId?: string;
      company_id?: string;
      productId?: string;
      product_id?: string;
      subscriptionId?: string;
      subscription_id?: string;
      ownerEmployeeId?: string;
      owner_employee_id?: string;
      teamMembers?: string[] | string;
      team_members?: string[] | string;
      startDate?: string | Date;
      start_date?: string | Date;
      targetGoLiveDate?: string | Date;
      target_go_live_date?: string | Date;
      status?: ImplementationStatus;
      progressPercentage?: number;
      progress_percentage?: number;
      pendingActivities?: string;
      pending_activities?: string;
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
    const subscriptionId = data.subscriptionId || data.subscription_id || null;
    let ownerEmployeeId = data.ownerEmployeeId || data.owner_employee_id || (data as any).leadSpecialistId || null;
    if (ownerEmployeeId && !String(ownerEmployeeId).startsWith('EMP-')) {
      const emp = await this.prisma.employee.findFirst({ where: { userId: Number(ownerEmployeeId) } });
      if (emp) ownerEmployeeId = emp.id;
    }
    const rawStartDate = data.startDate || data.start_date;
    const rawTargetDate = data.targetGoLiveDate || data.target_go_live_date;

    if (!companyId || !productId || !rawStartDate || !rawTargetDate) {
      throw new BadRequestException('Company, Product, Start Date, and Target Go-Live Date are required');
    }

    const startDate = new Date(rawStartDate);
    const targetGoLiveDate = new Date(rawTargetDate);

    if (isNaN(startDate.getTime()) || isNaN(targetGoLiveDate.getTime())) {
      throw new BadRequestException('Invalid date provided for Start Date or Target Go-Live Date');
    }

    let teamMembersJson: string | null = null;
    const rawTeam = data.teamMembers || data.team_members;
    if (Array.isArray(rawTeam)) {
      teamMembersJson = JSON.stringify(rawTeam);
    } else if (typeof rawTeam === 'string' && rawTeam.trim()) {
      teamMembersJson = JSON.stringify(rawTeam.split(',').map((s) => s.trim()));
    }

    const id = await this.generateImplementationId();
    const progress = data.progressPercentage !== undefined ? Number(data.progressPercentage) : (data.progress_percentage !== undefined ? Number(data.progress_percentage) : 0);

    const imp = await this.prisma.implementation.create({
      data: {
        id,
        companyId,
        productId,
        subscriptionId,
        ownerEmployeeId,
        teamMembersJson,
        startDate,
        targetGoLiveDate,
        status: data.status || ImplementationStatus.NEW,
        progressPercentage: Math.min(100, Math.max(0, progress)),
        pendingActivities: data.pendingActivities || data.pending_activities || null,
        notes: data.notes || null,
      },
    });

    await this.auditService.log({
      actorUserId,
      action: 'IMPLEMENTATION_CREATED',
      entityType: 'IMPLEMENTATION',
      entityId: imp.id,
      newValues: { id: imp.id, companyId, productId, status: imp.status },
    });

    return this.getImplementationById(imp.id);
  }

  async updateImplementation(
    id: string,
    data: {
      ownerEmployeeId?: string;
      owner_employee_id?: string;
      teamMembers?: string[] | string;
      team_members?: string[] | string;
      startDate?: string | Date;
      start_date?: string | Date;
      targetGoLiveDate?: string | Date;
      target_go_live_date?: string | Date;
      actualGoLiveDate?: string | Date;
      actual_go_live_date?: string | Date;
      status?: ImplementationStatus;
      progressPercentage?: number;
      progress_percentage?: number;
      pendingActivities?: string;
      pending_activities?: string;
      notes?: string;
    },
    actorUserId: number,
  ) {
    const existing = await this.prisma.implementation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Implementation not found');

    const updateData: any = {};
    if (data.ownerEmployeeId !== undefined || data.owner_employee_id !== undefined) {
      updateData.ownerEmployeeId = data.ownerEmployeeId || data.owner_employee_id || null;
    }

    const rawTeam = data.teamMembers || data.team_members;
    if (rawTeam !== undefined) {
      if (Array.isArray(rawTeam)) {
        updateData.teamMembersJson = JSON.stringify(rawTeam);
      } else if (typeof rawTeam === 'string') {
        updateData.teamMembersJson = JSON.stringify(rawTeam.split(',').map((s) => s.trim()));
      }
    }

    if (data.startDate || data.start_date) updateData.startDate = new Date(data.startDate || data.start_date!);
    if (data.targetGoLiveDate || data.target_go_live_date) updateData.targetGoLiveDate = new Date(data.targetGoLiveDate || data.target_go_live_date!);
    if (data.actualGoLiveDate || data.actual_go_live_date) updateData.actualGoLiveDate = new Date(data.actualGoLiveDate || data.actual_go_live_date!);
    
    if (data.status) {
      updateData.status = data.status;
      if (data.status === ImplementationStatus.LIVE && !existing.actualGoLiveDate && !updateData.actualGoLiveDate) {
        updateData.actualGoLiveDate = new Date();
      }
      if (data.status === ImplementationStatus.COMPLETED) {
        updateData.completedAt = new Date();
        updateData.progressPercentage = 100;
      }
    }

    if (data.progressPercentage !== undefined || data.progress_percentage !== undefined) {
      const p = Number(data.progressPercentage !== undefined ? data.progressPercentage : data.progress_percentage);
      updateData.progressPercentage = Math.min(100, Math.max(0, p));
    }

    if (data.pendingActivities !== undefined || data.pending_activities !== undefined) {
      updateData.pendingActivities = data.pendingActivities || data.pending_activities || null;
    }

    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await this.prisma.implementation.update({
      where: { id },
      data: updateData,
    });

    await this.auditService.log({
      actorUserId,
      action: 'IMPLEMENTATION_UPDATED',
      entityType: 'IMPLEMENTATION',
      entityId: id,
      oldValues: { status: existing.status, progress: existing.progressPercentage },
      newValues: updateData,
    });

    return this.getImplementationById(id);
  }

  async getStats() {
    const all = await this.prisma.implementation.findMany({
      select: { status: true, progressPercentage: true },
    });

    let newCount = 0;
    let planning = 0;
    let inProgress = 0;
    let configuration = 0;
    let testing = 0;
    let readyForGoLive = 0;
    let live = 0;
    let completed = 0;
    let blocked = 0;

    for (const imp of all) {
      switch (imp.status) {
        case ImplementationStatus.NEW:
          newCount++;
          break;
        case ImplementationStatus.PLANNING:
          planning++;
          break;
        case ImplementationStatus.IN_PROGRESS:
          inProgress++;
          break;
        case ImplementationStatus.CONFIGURATION:
          configuration++;
          break;
        case ImplementationStatus.TESTING:
          testing++;
          break;
        case ImplementationStatus.READY_FOR_GO_LIVE:
          readyForGoLive++;
          break;
        case ImplementationStatus.LIVE:
          live++;
          break;
        case ImplementationStatus.COMPLETED:
          completed++;
          break;
        case ImplementationStatus.BLOCKED:
          blocked++;
          break;
      }
    }

    return {
      total: all.length,
      new: newCount,
      planning,
      inProgress,
      configuration,
      testing,
      readyForGoLive,
      live,
      completed,
      blocked,
      activeProjects: inProgress + configuration + testing + readyForGoLive + planning,
    };
  }
}
