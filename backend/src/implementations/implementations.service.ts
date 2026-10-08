import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ImplementationStatus } from '@prisma/client';

@Injectable()
export class ImplementationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateImplementationId(): Promise<string> {
    while (true) {
      const nextSeq = await this.prisma.getNextSequence('IMPLEMENTATION_SEQ');
      const id = `IMP-${String(nextSeq).padStart(4, '0')}`;
      const exists = await this.prisma.implementation.findUnique({ where: { id } });
      if (!exists) return id;
    }
  }

  async getEntitledModules(companyId: string, productId: string) {
    if (!companyId || !productId) return [];

    const companyProduct = await this.prisma.companyProduct.findFirst({
      where: { companyId, productId, isActive: true },
      include: {
        modules: {
          include: {
            module: {
              include: {
                submodules: { where: { isActive: true } },
              },
            },
          },
        },
      },
    });

    if (companyProduct) {
      if (companyProduct.purchaseType === 'COMPLETE') {
        const prod = await this.prisma.product.findUnique({
          where: { id: productId },
          include: {
            modules: {
              where: { isActive: true },
              include: { submodules: { where: { isActive: true } } },
            },
          },
        });
        return (prod?.modules || []).map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          submodules: m.submodules.map((s) => ({ id: s.id, name: s.name, description: s.description })),
        }));
      } else {
        return (companyProduct.modules || [])
          .filter((cpm) => cpm.module && cpm.module.isActive !== false)
          .map((cpm) => {
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
            const filteredSubs = (m.submodules || []).filter((s) => s.isActive !== false && (selectedSubIds.length === 0 || selectedSubIds.includes(s.id)));
            return {
              id: m.id,
              name: m.name,
              description: m.description,
              submodules: filteredSubs.map((s) => ({ id: s.id, name: s.name, description: s.description })),
            };
          });
      }
    }

    const countCp = await this.prisma.companyProduct.count({ where: { companyId, isActive: true } });
    if (countCp > 0) {
      return [];
    }

    const prod = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        modules: {
          where: { isActive: true },
          include: { submodules: { where: { isActive: true } } },
        },
      },
    });
    return (prod?.modules || []).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      submodules: m.submodules.map((s) => ({ id: s.id, name: s.name, description: s.description })),
    }));
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
        tasks: {
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          include: {
            module: { select: { id: true, name: true, description: true } },
            assignedEmployee: { select: { id: true, name: true, email: true, designation: true, level: true, userId: true } },
            completedByUser: {
              select: {
                id: true,
                email: true,
                employee: { select: { id: true, name: true, designation: true } },
              },
            },
          },
        },
      },
    });

    if (!imp) return null;

    const entitledModules = await this.getEntitledModules(imp.companyId, imp.productId);

    const moduleMap = new Map<string, {
      id: string;
      name: string;
      description?: string | null;
      tasks: any[];
      totalCount: number;
      completedCount: number;
      progressPercentage: number;
    }>();

    for (const em of entitledModules) {
      moduleMap.set(em.id, {
        id: em.id,
        name: em.name,
        description: em.description,
        tasks: [],
        totalCount: 0,
        completedCount: 0,
        progressPercentage: 0,
      });
    }

    const generalTasks: any[] = [];

    const formattedTasks = (imp.tasks || []).map((t) => {
      const taskObj = {
        id: t.id,
        implementation_id: t.implementationId,
        implementationId: t.implementationId,
        module_id: t.moduleId,
        moduleId: t.moduleId,
        module_name: t.module?.name || null,
        moduleName: t.module?.name || null,
        task_name: t.taskName,
        taskName: t.taskName,
        description: t.description,
        priority: t.priority,
        status: t.status,
        order_index: t.orderIndex,
        assigned_employee_id: t.assignedEmployeeId,
        assignedEmployeeId: t.assignedEmployeeId,
        assigned_employee_name: t.assignedEmployee?.name || null,
        assigned_employee_level: t.assignedEmployee?.level || null,
        assigned_employee_designation: t.assignedEmployee?.designation || null,
        due_date: t.dueDate,
        dueDate: t.dueDate,
        employee_task_id: t.employeeTaskId,
        completed_by: t.completedBy,
        completed_by_name: t.completedByUser?.employee?.name || t.completedByUser?.email || null,
        completed_at: t.completedAt,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      };

      if (t.moduleId && moduleMap.has(t.moduleId)) {
        const modEntry = moduleMap.get(t.moduleId)!;
        modEntry.tasks.push(taskObj);
        modEntry.totalCount++;
        if (t.status === 'COMPLETED') modEntry.completedCount++;
      } else if (t.moduleId) {
        moduleMap.set(t.moduleId, {
          id: t.moduleId,
          name: t.module?.name || t.moduleId,
          description: t.module?.description || null,
          tasks: [taskObj],
          totalCount: 1,
          completedCount: t.status === 'COMPLETED' ? 1 : 0,
          progressPercentage: 0,
        });
      } else {
        generalTasks.push(taskObj);
      }

      return taskObj;
    });

    const modulesProgress = Array.from(moduleMap.values()).map((m) => ({
      ...m,
      progressPercentage: m.totalCount === 0 ? 0 : Math.round((m.completedCount / m.totalCount) * 100),
    }));

    const totalTasks = formattedTasks.length;
    const completedTasks = formattedTasks.filter((t) => t.status === 'COMPLETED').length;
    const progressPercentage = totalTasks === 0 ? (imp.progressPercentage || 0) : Math.round((completedTasks / totalTasks) * 100);

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
      progress_percentage: progressPercentage,
      progressPercentage: progressPercentage,
      pending_activities: imp.pendingActivities,
      notes: imp.notes,
      completed_at: imp.completedAt,
      created_at: imp.createdAt,
      updated_at: imp.updatedAt,
      tasks: formattedTasks,
      generalTasks,
      modules: modulesProgress,
      entitledModules,
      metrics: {
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        progressPercentage,
      },
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
      tasks?: any[];
      modules?: any[];
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
    const rawStartDate = data.startDate || data.start_date || new Date().toISOString();
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
      include: {
        company: true,
        product: true,
      },
    });

    const initialTasks: any[] = [];
    if (Array.isArray(data.tasks)) {
      initialTasks.push(...data.tasks);
    }
    if (Array.isArray(data.modules)) {
      for (const m of data.modules) {
        if (Array.isArray(m.tasks)) {
          for (const t of m.tasks) {
            initialTasks.push({
              ...t,
              moduleId: t.moduleId || m.id || m.moduleId,
            });
          }
        }
      }
    }

    if (initialTasks.length > 0) {
      for (let i = 0; i < initialTasks.length; i++) {
        const taskItem = initialTasks[i];
        const taskName = typeof taskItem === 'string' ? taskItem : taskItem.taskName || taskItem.task_name || `Task ${i + 1}`;
        const taskId = await this.generateTaskId();
        const moduleId = typeof taskItem === 'object' ? (taskItem.moduleId || taskItem.module_id || null) : null;
        const assignedEmployeeId = typeof taskItem === 'object' ? (taskItem.assignedEmployeeId || taskItem.assigned_employee_id || null) : null;
        const priority = typeof taskItem === 'object' && taskItem.priority ? taskItem.priority : 'MEDIUM';
        const dueDate = typeof taskItem === 'object' && taskItem.dueDate ? new Date(taskItem.dueDate) : null;

        let employeeTaskId: string | null = null;
        if (assignedEmployeeId) {
          const emp = await this.prisma.employee.findUnique({
            where: { id: assignedEmployeeId },
            include: { user: true },
          });
          if (emp) {
            try {
              const nextSeq = await this.prisma.getNextSequence('EMP_TASK_SEQ');
              employeeTaskId = `ETSK-${String(nextSeq).padStart(4, '0')}`;
              await this.prisma.employeeTask.create({
                data: {
                  id: employeeTaskId,
                  title: `[${imp.id}] ${taskName}`,
                  description: taskItem.description || `Implementation task for ${imp.company?.companyName}`,
                  category: 'IMPLEMENTATION',
                  dueDate,
                  taskType: 'ASSIGNED TASK',
                  priority,
                  status: 'PENDING',
                  createdBy: ownerEmployeeId || assignedEmployeeId,
                  assignedTo: assignedEmployeeId,
                },
              });

              if (emp.user?.id) {
                await this.notificationsService.notify('IN_APP' as any, {
                  userId: emp.user.id,
                  recipient: emp.email || 'employee',
                  eventType: 'TASK_ASSIGNED',
                  title: 'New Implementation Task Assigned',
                  message: `Assigned: "${taskName}" for ${imp.company?.companyName}`,
                  linkUrl: '/implementations',
                });
              }
            } catch {}
          }
        }

        await this.prisma.implementationTask.create({
          data: {
            id: taskId,
            implementationId: imp.id,
            moduleId,
            taskName,
            description: typeof taskItem === 'object' ? taskItem.description : null,
            priority,
            status: 'PENDING',
            orderIndex: i + 1,
            assignedEmployeeId,
            dueDate,
            employeeTaskId,
          },
        });
      }
      await this.recalculateProgress(imp.id);
    }

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

    await this.prisma.implementation.update({
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

  async getImplementationTasks(implementationId: string) {
    const tasks = await this.prisma.implementationTask.findMany({
      where: { implementationId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        module: { select: { id: true, name: true, description: true } },
        assignedEmployee: { select: { id: true, name: true, email: true, designation: true, level: true } },
        completedByUser: {
          select: {
            id: true,
            email: true,
            employee: { select: { id: true, name: true, designation: true } },
          },
        },
      },
    });

    return tasks.map((t) => ({
      id: t.id,
      implementation_id: t.implementationId,
      implementationId: t.implementationId,
      module_id: t.moduleId,
      moduleId: t.moduleId,
      module_name: t.module?.name || null,
      moduleName: t.module?.name || null,
      task_name: t.taskName,
      taskName: t.taskName,
      description: t.description,
      priority: t.priority,
      status: t.status,
      order_index: t.orderIndex,
      assigned_employee_id: t.assignedEmployeeId,
      assignedEmployeeId: t.assignedEmployeeId,
      assigned_employee_name: t.assignedEmployee?.name || null,
      assigned_employee_level: t.assignedEmployee?.level || null,
      assigned_employee_designation: t.assignedEmployee?.designation || null,
      due_date: t.dueDate,
      dueDate: t.dueDate,
      employee_task_id: t.employeeTaskId,
      completed_by: t.completedBy,
      completed_by_name: t.completedByUser?.employee?.name || t.completedByUser?.email || null,
      completed_at: t.completedAt,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    }));
  }

  async recalculateProgress(implementationId: string): Promise<number> {
    const tasks = await this.prisma.implementationTask.findMany({
      where: { implementationId },
      select: { status: true },
    });

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const progressPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    const updateData: any = { progressPercentage };
    if (progressPercentage === 100 && total > 0) {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }

    await this.prisma.implementation.update({
      where: { id: implementationId },
      data: updateData,
    });

    return progressPercentage;
  }

  async generateTaskId(): Promise<string> {
    const allTasks = await this.prisma.implementationTask.findMany({ select: { id: true } });
    let maxNum = 0;
    for (const t of allTasks) {
      const m = t.id.match(/^TSK-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextSeq = await this.prisma.getNextSequence('TASK_SEQ');
    const safeNum = Math.max(nextSeq, maxNum + 1);
    return `TSK-${String(safeNum).padStart(4, '0')}`;
  }

  async addTask(
    implementationId: string,
    data: {
      moduleId?: string;
      module_id?: string;
      taskName?: string;
      task_name?: string;
      description?: string;
      priority?: string;
      assignedEmployeeId?: string;
      assigned_employee_id?: string;
      dueDate?: string | Date;
      due_date?: string | Date;
      dueTime?: string;
      due_time?: string;
    },
    actorUserId: number,
  ) {
    const imp = await this.prisma.implementation.findUnique({
      where: { id: implementationId },
      include: {
        company: { select: { id: true, companyName: true } },
        product: { select: { id: true, name: true } },
      },
    });
    if (!imp) throw new NotFoundException('Implementation not found');

    const taskName = (data.taskName || data.task_name || '').trim();
    if (!taskName) throw new BadRequestException('Task name is required');

    const moduleId = data.moduleId || data.module_id || null;
    let moduleObj: any = null;

    if (moduleId) {
      moduleObj = await this.prisma.productModule.findUnique({
        where: { id: moduleId },
      });
      if (!moduleObj) {
        throw new BadRequestException(`Module '${moduleId}' not found`);
      }
      if (moduleObj.productId !== imp.productId) {
        throw new BadRequestException(`Module '${moduleObj.name}' does not belong to product '${imp.product?.name}'`);
      }

      const entitled = await this.getEntitledModules(imp.companyId, imp.productId);
      const isEntitled = entitled.some((m) => m.id === moduleId);
      if (!isEntitled && entitled.length > 0) {
        throw new BadRequestException(`Customer '${imp.company?.companyName}' is not entitled to module '${moduleObj.name}'`);
      }
    }

    const assignedEmployeeId = data.assignedEmployeeId || data.assigned_employee_id || null;
    let assignedEmployee: any = null;
    if (assignedEmployeeId) {
      assignedEmployee = await this.prisma.employee.findUnique({
        where: { id: assignedEmployeeId },
        include: { user: { select: { id: true, email: true } } },
      });
      if (!assignedEmployee) {
        throw new BadRequestException(`Employee '${assignedEmployeeId}' not found`);
      }
    }

    const rawDueDate = data.dueDate || data.due_date;
    const dueTime = data.dueTime || data.due_time || null;
    let dueDate: Date | null = null;
    if (rawDueDate) {
      const datePart = typeof rawDueDate === 'string' ? rawDueDate.split('T')[0] : (rawDueDate instanceof Date ? rawDueDate.toISOString().split('T')[0] : String(rawDueDate));
      const timePart = dueTime ? dueTime.trim() : '23:59:59';
      dueDate = new Date(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
      if (isNaN(dueDate.getTime())) {
        dueDate = new Date(rawDueDate);
      }
    }

    const lastTask = await this.prisma.implementationTask.findFirst({
      where: { implementationId },
      orderBy: { orderIndex: 'desc' },
    });
    const orderIndex = lastTask ? lastTask.orderIndex + 1 : 0;
    const id = await this.generateTaskId();

    let employeeTaskId: string | null = null;

    if (assignedEmployee) {
      try {
        const nextSeq = await this.prisma.getNextSequence('EMP_TASK_SEQ');
        employeeTaskId = `ETSK-${String(nextSeq).padStart(4, '0')}`;
      } catch {
        employeeTaskId = `ETSK-${Date.now().toString().slice(-4)}`;
      }

      const creatorEmpId = imp.ownerEmployeeId || assignedEmployee.id;

      await this.prisma.employeeTask.create({
        data: {
          id: employeeTaskId,
          title: `[${imp.id}] ${moduleObj ? moduleObj.name + ': ' : ''}${taskName}`,
          description: data.description?.trim() || `Implementation task for ${imp.company?.companyName} (${imp.product?.name})`,
          category: 'IMPLEMENTATION',
          dueDate,
          dueTime,
          taskType: 'ASSIGNED TASK',
          priority: data.priority?.trim() || 'MEDIUM',
          status: 'PENDING',
          createdBy: creatorEmpId,
          assignedTo: assignedEmployee.id,
        },
      });

      if (assignedEmployee.user?.id) {
        await this.notificationsService.notify('IN_APP' as any, {
          userId: assignedEmployee.user.id,
          recipient: assignedEmployee.email || 'employee',
          eventType: 'TASK_ASSIGNED',
          title: 'New Implementation Task Assigned',
          message: `Assigned: "${taskName}" for ${imp.company?.companyName} (${moduleObj?.name || imp.product?.name})`,
          linkUrl: '/implementations',
        });
      }
    }

    const task = await this.prisma.implementationTask.create({
      data: {
        id,
        implementationId,
        moduleId,
        taskName,
        description: data.description?.trim() || null,
        priority: data.priority?.trim() || 'MEDIUM',
        status: 'PENDING',
        orderIndex,
        assignedEmployeeId,
        dueDate,
        employeeTaskId,
      },
      include: {
        module: true,
        assignedEmployee: true,
      },
    });

    const newProgress = await this.recalculateProgress(implementationId);

    await this.auditService.log({
      actorUserId,
      action: 'IMPLEMENTATION_TASK_ADDED',
      entityType: 'IMPLEMENTATION_TASK',
      entityId: task.id,
      newValues: { id: task.id, implementationId, moduleId, taskName, assignedEmployeeId, newProgress },
    });

    return {
      task: {
        id: task.id,
        implementation_id: task.implementationId,
        module_id: task.moduleId,
        module_name: task.module?.name || null,
        task_name: task.taskName,
        description: task.description,
        priority: task.priority,
        status: task.status,
        order_index: task.orderIndex,
        assigned_employee_id: task.assignedEmployeeId,
        assigned_employee_name: task.assignedEmployee?.name || null,
        assigned_employee_level: task.assignedEmployee?.level || null,
        due_date: task.dueDate,
        completed_by: task.completedBy,
        completed_at: task.completedAt,
        created_at: task.createdAt,
      },
      progressPercentage: newProgress,
    };
  }

  async updateTask(
    taskId: string,
    data: {
      moduleId?: string;
      module_id?: string;
      taskName?: string;
      task_name?: string;
      description?: string;
      priority?: string;
      assignedEmployeeId?: string;
      assigned_employee_id?: string;
      dueDate?: string | Date;
      due_date?: string | Date;
      dueTime?: string;
      due_time?: string;
    },
    actorUserId: number,
  ) {
    const existing = await this.prisma.implementationTask.findUnique({
      where: { id: taskId },
      include: {
        implementation: {
          include: {
            company: { select: { id: true, companyName: true } },
            product: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Task not found');

    const updateData: any = {};

    if (data.taskName !== undefined || data.task_name !== undefined) {
      updateData.taskName = (data.taskName || data.task_name || '').trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority?.trim() || 'MEDIUM';
    }

    const moduleId = data.moduleId !== undefined ? data.moduleId : data.module_id;
    let moduleObj: any = null;
    if (moduleId !== undefined) {
      if (moduleId) {
        moduleObj = await this.prisma.productModule.findUnique({ where: { id: moduleId } });
        if (!moduleObj) throw new BadRequestException(`Module '${moduleId}' not found`);
        const entitled = await this.getEntitledModules(existing.implementation.companyId, existing.implementation.productId);
        const isEntitled = entitled.some((m) => m.id === moduleId);
        if (!isEntitled && entitled.length > 0) {
          throw new BadRequestException(`Customer is not entitled to module '${moduleObj.name}'`);
        }
      }
      updateData.moduleId = moduleId || null;
    }

    const rawDueDate = data.dueDate !== undefined ? data.dueDate : data.due_date;
    if (rawDueDate !== undefined) {
      if (rawDueDate) {
        const datePart = typeof rawDueDate === 'string' ? rawDueDate.split('T')[0] : (rawDueDate instanceof Date ? rawDueDate.toISOString().split('T')[0] : String(rawDueDate));
        const timePart = data.dueTime || data.due_time || '23:59:59';
        const d = new Date(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
        updateData.dueDate = isNaN(d.getTime()) ? new Date(rawDueDate) : d;
      } else {
        updateData.dueDate = null;
      }
    }

    const assignedEmployeeId = data.assignedEmployeeId !== undefined ? data.assignedEmployeeId : data.assigned_employee_id;
    if (assignedEmployeeId !== undefined) {
      updateData.assignedEmployeeId = assignedEmployeeId || null;

      if (assignedEmployeeId && assignedEmployeeId !== existing.assignedEmployeeId) {
        const emp = await this.prisma.employee.findUnique({
          where: { id: assignedEmployeeId },
          include: { user: { select: { id: true, email: true } } },
        });

        if (emp?.user?.id) {
          await this.notificationsService.notify('IN_APP' as any, {
            userId: emp.user.id,
            recipient: emp.email || 'employee',
            eventType: 'TASK_ASSIGNED',
            title: 'New Implementation Task Assigned',
            message: `Assigned: "${updateData.taskName || existing.taskName}" for ${existing.implementation.company?.companyName}`,
            linkUrl: '/implementations',
          });
        }

        if (existing.employeeTaskId) {
          await this.prisma.employeeTask.updateMany({
            where: { id: existing.employeeTaskId },
            data: {
              assignedTo: assignedEmployeeId,
              title: `[${existing.implementationId}] ${moduleObj ? moduleObj.name + ': ' : ''}${updateData.taskName || existing.taskName}`,
              dueDate: updateData.dueDate !== undefined ? updateData.dueDate : existing.dueDate,
              priority: updateData.priority || existing.priority,
            },
          });
        } else {
          try {
            const nextSeq = await this.prisma.getNextSequence('EMP_TASK_SEQ');
            const newEmpTaskId = `ETSK-${String(nextSeq).padStart(4, '0')}`;
            await this.prisma.employeeTask.create({
              data: {
                id: newEmpTaskId,
                title: `[${existing.implementationId}] ${moduleObj ? moduleObj.name + ': ' : ''}${updateData.taskName || existing.taskName}`,
                description: updateData.description !== undefined ? updateData.description : existing.description,
                category: 'IMPLEMENTATION',
                dueDate: updateData.dueDate !== undefined ? updateData.dueDate : existing.dueDate,
                taskType: 'ASSIGNED TASK',
                priority: updateData.priority || existing.priority,
                status: existing.status,
                createdBy: existing.implementation.ownerEmployeeId || assignedEmployeeId,
                assignedTo: assignedEmployeeId,
              },
            });
            updateData.employeeTaskId = newEmpTaskId;
          } catch {}
        }
      }
    }

    const updated = await this.prisma.implementationTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        module: true,
        assignedEmployee: true,
      },
    });

    if (existing.employeeTaskId && (updateData.taskName || updateData.dueDate !== undefined || updateData.priority)) {
      await this.prisma.employeeTask.updateMany({
        where: { id: existing.employeeTaskId },
        data: {
          title: `[${existing.implementationId}] ${updated.module?.name ? updated.module.name + ': ' : ''}${updated.taskName}`,
          dueDate: updated.dueDate,
          priority: updated.priority || 'MEDIUM',
          description: updated.description,
        },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'IMPLEMENTATION_TASK_EDITED',
      entityType: 'IMPLEMENTATION_TASK',
      entityId: taskId,
      oldValues: { taskName: existing.taskName, assignedEmployeeId: existing.assignedEmployeeId },
      newValues: updateData,
    });

    return updated;
  }

  async toggleTaskCompletion(taskId: string, isCompleted: boolean, actorUserId: number) {
    const existing = await this.prisma.implementationTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException('Task not found');

    const updateData: any = {};
    if (isCompleted) {
      updateData.status = 'COMPLETED';
      updateData.completedBy = actorUserId;
      updateData.completedAt = new Date();
    } else {
      updateData.status = 'PENDING';
      updateData.completedBy = null;
      updateData.completedAt = null;
    }

    const updated = await this.prisma.implementationTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        module: true,
        assignedEmployee: true,
      },
    });

    if (existing.employeeTaskId) {
      await this.prisma.employeeTask.updateMany({
        where: { id: existing.employeeTaskId },
        data: {
          status: isCompleted ? 'COMPLETED' : 'PENDING',
          completedAt: isCompleted ? new Date() : null,
        },
      });
    }

    const newProgress = await this.recalculateProgress(existing.implementationId);

    await this.auditService.log({
      actorUserId,
      action: isCompleted ? 'IMPLEMENTATION_TASK_COMPLETED' : 'IMPLEMENTATION_TASK_REOPENED',
      entityType: 'IMPLEMENTATION_TASK',
      entityId: taskId,
      newValues: { taskId, implementationId: existing.implementationId, isCompleted, newProgress },
    });

    return {
      task: updated,
      progressPercentage: newProgress,
    };
  }

  async removeTask(taskId: string, actorUserId: number) {
    const existing = await this.prisma.implementationTask.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException('Task not found');

    const implementationId = existing.implementationId;
    const wasCompleted = existing.status === 'COMPLETED';

    if (existing.employeeTaskId) {
      await this.prisma.employeeTask.deleteMany({
        where: { id: existing.employeeTaskId },
      });
    }

    await this.prisma.implementationTask.delete({ where: { id: taskId } });
    const newProgress = await this.recalculateProgress(implementationId);

    await this.auditService.log({
      actorUserId,
      action: 'IMPLEMENTATION_TASK_REMOVED',
      entityType: 'IMPLEMENTATION_TASK',
      entityId: taskId,
      oldValues: {
        id: taskId,
        taskName: existing.taskName,
        implementationId,
        wasCompleted,
      },
      newValues: { newProgress },
    });

    return {
      success: true,
      progressPercentage: newProgress,
      wasCompleted,
      message: 'Task removed successfully',
    };
  }

  async reorderTasks(implementationId: string, taskIds: string[], actorUserId: number) {
    for (let i = 0; i < taskIds.length; i++) {
      await this.prisma.implementationTask.updateMany({
        where: { id: taskIds[i], implementationId },
        data: { orderIndex: i },
      });
    }

    await this.auditService.log({
      actorUserId,
      action: 'IMPLEMENTATION_TASKS_REORDERED',
      entityType: 'IMPLEMENTATION',
      entityId: implementationId,
      newValues: { taskIds },
    });

    return this.getImplementationTasks(implementationId);
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
