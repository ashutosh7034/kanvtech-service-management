import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmployeeTasksService {
  private readonly logger = new Logger(EmployeeTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authority level ranking according to platform hierarchy:
   * Rank 5: SUPER ADMIN / ADMIN
   * Rank 4: MANAGER
   * Rank 3: L3 EMPLOYEE
   * Rank 2: L2 EMPLOYEE
   * Rank 1: L1 EMPLOYEE
   * Rank 0: Others / Inactive
   */
  getAuthorityRank(role?: string, level?: string): number {
    const r = (role || '').toUpperCase();
    const l = (level || '').toUpperCase();

    if (r === 'ADMIN' || r === 'SUPER_ADMIN') {
      return 5;
    }
    if (r === 'MANAGER' || l === 'MANAGER') {
      return 4;
    }
    if (r === 'L3_EMPLOYEE' || l === 'L3') {
      return 3;
    }
    if (r === 'L2_EMPLOYEE' || l === 'L2') {
      return 2;
    }
    if (r === 'L1_EMPLOYEE' || l === 'L1') {
      return 1;
    }
    return 0;
  }

  async resolveEmployeeId(user: any): Promise<string> {
    if (user?.employeeId) {
      return String(user.employeeId);
    }
    const userId = user?.userId || user?.id;
    if (userId) {
      const empByUserId = await this.prisma.employee.findFirst({
        where: { userId: Number(userId) },
      });
      if (empByUserId) return empByUserId.id;
    }
    if (user?.email) {
      const empByEmail = await this.prisma.employee.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } },
      });
      if (empByEmail) return empByEmail.id;
    }

    // Auto-create/ensure employee profile for Admin/Super Admin/Manager if not already linked
    const role = (user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER') {
      const userIdNum = Number(userId || 1);
      const email = user?.email || (role === 'ADMIN' ? 'admin@kanvtech.com' : `manager_${userIdNum}@kanvtech.com`);
      const name = role === 'ADMIN' || role === 'SUPER_ADMIN' ? 'System Administrator' : 'Operations Manager';
      const empId = `EMP-${String(userIdNum).padStart(3, '0')}`;

      const existingEmp = await this.prisma.employee.findUnique({ where: { id: empId } });
      if (existingEmp) return existingEmp.id;

      const created = await this.prisma.employee.create({
        data: {
          id: empId,
          userId: userIdNum,
          name,
          email,
          phone: '+91 98000 00000',
          department: 'Executive Management',
          designation: role === 'ADMIN' || role === 'SUPER_ADMIN' ? 'Chief Administrator' : 'Operations Manager',
          level: 'MANAGER',
          availability: 'AVAILABLE',
          status: 'ACTIVE',
        },
      });
      return created.id;
    }

    throw new ForbiddenException('Employee account required to manage personal tasks.');
  }

  private async generateTaskId(): Promise<string> {
    try {
      if (typeof (this.prisma as any).getNextSequence === 'function') {
        const seq = await (this.prisma as any).getNextSequence('EMP_TASK_SEQ');
        return `ETSK-${String(seq).padStart(4, '0')}`;
      }
      const count = await this.prisma.employeeTask.count();
      return `ETSK-${String(count + 1).padStart(4, '0')}`;
    } catch {
      return `ETSK-${Date.now().toString().slice(-4)}`;
    }
  }

  /**
   * Get list of employees the current user is authorized to assign tasks to.
   * Super Admin / Admin -> Manager, L3, L2, L1 (excludes Admins, self)
   * Manager -> L3, L2, L1 (excludes Managers, Admins, self)
   * L3 -> L2, L1
   * L2 -> L1
   * L1 -> [] (Cannot assign to anyone)
   */
  async getEligibleAssignees(
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserRole: string | undefined,
  ) {
    let requestingLevel: string | undefined;
    if (requestingEmployeeId) {
      const emp = await this.prisma.employee.findUnique({
        where: { id: requestingEmployeeId },
        select: { level: true },
      });
      requestingLevel = emp?.level;
    }

    const creatorRank = this.getAuthorityRank(requestingUserRole, requestingLevel);

    // If rank is 1 or less (L1 or unrecognized), cannot assign to anyone
    if (creatorRank <= 1) {
      return [];
    }

    // Fetch all active employees
    const allEmployees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { role: true, isActive: true } },
        departmentRel: { select: { name: true } },
      },
      orderBy: [{ level: 'desc' }, { name: 'asc' }],
    });

    // Filter employees where targetRank < creatorRank and target is not the requester
    const eligible = allEmployees.filter((emp) => {
      if (emp.id === requestingEmployeeId) return false;
      const targetRank = this.getAuthorityRank(emp.user?.role, emp.level);
      return targetRank < creatorRank;
    });

    return eligible.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      level: e.level,
      role: e.user?.role,
      department_name: e.departmentRel?.name || e.department,
      designation: e.designation,
    }));
  }

  /**
   * Create a new personal or assigned task with due date/time, attachments, and reminders.
   * Backend strictly enforces the hierarchy authority rule:
   * Creator authority rank must be strictly higher than target employee rank for assignments.
   */
  async createTask(
    creatorEmployeeId: string,
    creatorUserId: number | undefined,
    creatorRole: string | undefined,
    data: {
      title: string;
      description?: string;
      category?: string;
      dueDate?: string;
      dueTime?: string;
      taskType?: string;
      priority?: string;
      reminderTime?: string;
      assignedToIds?: string[];
      attachments?: Array<{ fileName: string; filePath: string; fileSize?: number; mimeType?: string }>;
    },
  ) {
    if (!data.title?.trim()) {
      throw new BadRequestException('Task title is required.');
    }

    const now = new Date();
    let dueDateTime: Date | null = null;
    let reminderDateTime: Date | null = null;

    if (data.dueDate) {
      const datePart = data.dueDate.split('T')[0];
      const timePart = data.dueTime ? data.dueTime.trim() : '23:59:59';
      dueDateTime = new Date(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
      if (isNaN(dueDateTime.getTime())) {
        dueDateTime = new Date(data.dueDate);
      }
      if (isNaN(dueDateTime.getTime())) {
        throw new BadRequestException('Invalid due date format.');
      }
    }

    if (data.reminderTime) {
      reminderDateTime = new Date(data.reminderTime);
      if (isNaN(reminderDateTime.getTime())) {
        throw new BadRequestException('Invalid reminder date/time format.');
      }

      // Reminder cannot be in the past when creating a new task (allow 5 minutes tolerance)
      if (reminderDateTime.getTime() < now.getTime() - 5 * 60 * 1000) {
        throw new BadRequestException('Reminder time cannot be in the past.');
      }

      // Reminder cannot be after due date/time (with 1 minute grace)
      if (dueDateTime && reminderDateTime.getTime() > dueDateTime.getTime() + 60 * 1000) {
        throw new BadRequestException('Reminder date/time cannot be after the task due date/time.');
      }
    }

    const priority = data.priority ? data.priority.toUpperCase() : 'MEDIUM';

    // Resolve creator authority rank
    let creatorLevel: string | undefined;
    if (creatorEmployeeId) {
      const cEmp = await this.prisma.employee.findUnique({
        where: { id: creatorEmployeeId },
        select: { level: true },
      });
      creatorLevel = cEmp?.level;
    }
    const creatorRank = this.getAuthorityRank(creatorRole, creatorLevel);

    // Normalize assignees
    let targetAssigneeIds: string[] = [];
    if (Array.isArray(data.assignedToIds) && data.assignedToIds.length > 0) {
      targetAssigneeIds = data.assignedToIds;
    } else {
      targetAssigneeIds = [creatorEmployeeId];
    }

    // Map 'MYSELF' to creatorEmployeeId and remove duplicates
    const resolvedAssigneeIds = Array.from(
      new Set(targetAssigneeIds.map((id) => (id === 'MYSELF' || id === 'myself' ? creatorEmployeeId : id)))
    );

    // Validate authority for each target assignee
    for (const assigneeId of resolvedAssigneeIds) {
      if (assigneeId !== creatorEmployeeId) {
        const targetEmp = await this.prisma.employee.findUnique({
          where: { id: assigneeId },
          include: { user: { select: { role: true, isActive: true } } },
        });

        if (!targetEmp || targetEmp.status !== 'ACTIVE') {
          throw new BadRequestException(`Target employee '${assigneeId}' not found or inactive.`);
        }

        const targetRank = this.getAuthorityRank(targetEmp.user?.role, targetEmp.level);

        // Security check: Must have strictly higher rank than target
        if (creatorRank <= targetRank) {
          throw new ForbiddenException(
            `Unauthorized task assignment: You cannot assign tasks to ${targetEmp.name} (${targetEmp.level || targetEmp.user?.role || 'employee'}) as their hierarchy level is at or above your authority level.`,
          );
        }
      }
    }

    // Format description with attachments metadata if present
    let rawDescription = data.description?.trim() || null;
    if (data.attachments && Array.isArray(data.attachments) && data.attachments.length > 0) {
      const meta = `<!--ATTACHMENTS:${JSON.stringify(data.attachments)}-->`;
      rawDescription = rawDescription ? `${rawDescription}\n\n${meta}` : meta;
    }

    const createdTasks: any[] = [];

    for (const assigneeId of resolvedAssigneeIds) {
      const id = await this.generateTaskId();
      const isSelf = assigneeId === creatorEmployeeId;
      const taskType = isSelf ? 'Personal' : 'Assigned Task';

      const task = await this.prisma.employeeTask.create({
        data: {
          id,
          title: data.title.trim(),
          description: rawDescription,
          category: data.category?.trim() || null,
          dueDate: dueDateTime,
          dueTime: data.dueTime?.trim() || null,
          taskType,
          priority,
          reminderTime: reminderDateTime,
          reminderTriggeredAt: null,
          status: 'PENDING',
          createdBy: creatorEmployeeId,
          assignedTo: assigneeId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true, userId: true } },
          assignee: { select: { id: true, name: true, email: true, userId: true } },
        },
      });

      // If assigned to another employee, create in-app notification
      if (!isSelf && task.assignee?.userId) {
        const creatorName = task.creator?.name || (creatorRank >= 5 ? 'Admin' : 'Manager');
        await this.notificationsService.createInAppNotification(
          task.assignee.userId,
          'New Task Assigned',
          `New task assigned by ${creatorName}: ${task.title}`,
          'TASK_ASSIGNED',
          '/task-reminders',
        );
      }

      if (creatorUserId) {
        await this.auditService.log({
          actorUserId: creatorUserId,
          action: 'TASK_CREATED',
          entityType: 'EMPLOYEE_TASK',
          entityId: task.id,
          newValues: {
            title: task.title,
            priority: task.priority,
            assignedTo: assigneeId,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            reminderTime: task.reminderTime,
          },
        });
      }

      createdTasks.push(this.formatTask(task));
    }

    return createdTasks.length === 1 ? createdTasks[0] : createdTasks;
  }

  /**
   * Get personal tasks for the authenticated employee with filtering and search.
   */
  async getMyTasks(
    employeeId: string,
    params: {
      status?: string;
      filter?: string;
      priority?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = { assignedTo: employeeId };

    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    if (params.priority && params.priority !== 'ALL') {
      where.priority = params.priority.toUpperCase();
    }

    if (params.category && params.category !== 'ALL') {
      where.category = params.category;
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Specific timeframe filters
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (params.filter === 'today') {
      where.dueDate = { gte: startOfToday, lte: endOfToday };
    } else if (params.filter === 'upcoming') {
      where.dueDate = { gt: endOfToday };
      where.status = 'PENDING';
    } else if (params.filter === 'overdue') {
      where.dueDate = { lt: startOfToday };
      where.status = 'PENDING';
    } else if (params.filter === 'completed') {
      where.status = 'COMPLETED';
    }

    const [total, tasks] = await Promise.all([
      this.prisma.employeeTask.count({ where }),
      this.prisma.employeeTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          creator: { select: { id: true, name: true, email: true, userId: true } },
          assignee: { select: { id: true, name: true, email: true, userId: true } },
        },
      }),
    ]);

    return {
      data: tasks.map(this.formatTask),
      total,
      page,
      limit,
    };
  }

  /**
   * Get dynamic Dashboard summary metrics and top categorized tasks.
   */
  async getDashboardSummary(employeeId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const allMyTasks = await this.prisma.employeeTask.findMany({
      where: { assignedTo: employeeId },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        creator: { select: { id: true, name: true, email: true, userId: true } },
        assignee: { select: { id: true, name: true, email: true, userId: true } },
      },
    });

    const pendingTasks = allMyTasks.filter((t) => t.status === 'PENDING');
    const completedTasks = allMyTasks.filter((t) => t.status === 'COMPLETED');

    const dueTodayTasks = pendingTasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= startOfToday && d <= endOfToday;
    });

    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d < startOfToday;
    });

    const upcomingTasks = pendingTasks.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d > endOfToday;
    });

    return {
      metrics: {
        dueTodayCount: dueTodayTasks.length,
        upcomingCount: upcomingTasks.length,
        overdueCount: overdueTasks.length,
        completedCount: completedTasks.length,
        totalPendingCount: pendingTasks.length,
      },
      todayTasks: dueTodayTasks.slice(0, 5).map(this.formatTask),
      overdueTasks: overdueTasks.slice(0, 5).map(this.formatTask),
      upcomingTasks: upcomingTasks.slice(0, 5).map(this.formatTask),
    };
  }

  /**
   * Get a specific task by ID with strict ownership verification.
   */
  async getTaskById(id: string, requestingEmployeeId: string) {
    const task = await this.prisma.employeeTask.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true, userId: true } },
        assignee: { select: { id: true, name: true, email: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    // Strict Personal Task Privacy: Only the owner/assignee can access
    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('You do not have access to this task.');
    }

    return this.formatTask(task);
  }

  /**
   * Update personal task details.
   */
  async updateTask(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    data: {
      title?: string;
      description?: string;
      category?: string;
      dueDate?: string;
      dueTime?: string;
      taskType?: string;
      priority?: string;
      reminderTime?: string;
      status?: string;
    },
  ) {
    const task = await this.prisma.employeeTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('You cannot edit this task.');
    }

    let dueDateTime = task.dueDate;
    if (data.dueDate !== undefined) {
      dueDateTime = data.dueDate ? new Date(data.dueDate) : null;
    }

    let reminderDateTime = task.reminderTime;
    let resetReminderTrigger = false;

    if (data.reminderTime !== undefined) {
      if (data.reminderTime) {
        reminderDateTime = new Date(data.reminderTime);
        if (isNaN(reminderDateTime.getTime())) {
          throw new BadRequestException('Invalid reminder date/time format.');
        }
        // If reminder changed, reset triggered flag so new reminder will fire
        if (!task.reminderTime || reminderDateTime.getTime() !== task.reminderTime.getTime()) {
          resetReminderTrigger = true;
        }
      } else {
        reminderDateTime = null;
        resetReminderTrigger = true;
      }
    }

    const newStatus = data.status || task.status;
    let completedAt = task.completedAt;
    if (newStatus === 'COMPLETED' && task.status !== 'COMPLETED') {
      completedAt = new Date();
    } else if (newStatus === 'PENDING') {
      completedAt = null;
    }

    const updated = await this.prisma.employeeTask.update({
      where: { id },
      data: {
        title: data.title?.trim() || task.title,
        description: data.description !== undefined ? data.description?.trim() || null : task.description,
        category: data.category !== undefined ? data.category?.trim() || null : task.category,
        dueDate: dueDateTime,
        dueTime: data.dueTime !== undefined ? data.dueTime?.trim() || null : task.dueTime,
        taskType: data.taskType || task.taskType,
        priority: data.priority ? data.priority.toUpperCase() : task.priority,
        reminderTime: reminderDateTime,
        reminderTriggeredAt: resetReminderTrigger ? null : task.reminderTriggeredAt,
        status: newStatus,
        completedAt,
      },
      include: {
        creator: { select: { id: true, name: true, email: true, userId: true } },
        assignee: { select: { id: true, name: true, email: true, userId: true } },
      },
    });

    if (requestingUserId) {
      await this.auditService.log({
        actorUserId: requestingUserId,
        action: newStatus === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
        entityType: 'EMPLOYEE_TASK',
        entityId: task.id,
        newValues: {
          title: updated.title,
          status: updated.status,
          priority: updated.priority,
          reminderTime: updated.reminderTime,
        },
      });
    }

    return this.formatTask(updated);
  }

  /**
   * Mark task as completed.
   */
  async completeTask(id: string, requestingEmployeeId: string, requestingUserId?: number) {
    return this.updateTask(id, requestingEmployeeId, requestingUserId, { status: 'COMPLETED' });
  }

  /**
   * Delete or cancel personal task.
   */
  async deleteTask(id: string, requestingEmployeeId: string, requestingUserId?: number) {
    const task = await this.prisma.employeeTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('Only the task owner can delete it.');
    }

    await this.prisma.employeeTask.delete({ where: { id } });

    if (requestingUserId) {
      await this.auditService.log({
        actorUserId: requestingUserId,
        action: 'TASK_DELETED',
        entityType: 'EMPLOYEE_TASK',
        entityId: id,
        oldValues: { title: task.title, status: task.status },
      });
    }

    return { message: 'Task deleted successfully.' };
  }

  /**
   * Background processor: checks due reminders and creates IN-APP notifications idempotently.
   */
  async processDueReminders(): Promise<{ processedCount: number }> {
    const now = new Date();

    const dueTasks = await this.prisma.employeeTask.findMany({
      where: {
        status: 'PENDING',
        reminderTime: { lte: now },
        reminderTriggeredAt: null, // Idempotent: only trigger if not already triggered
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            userId: true,
          },
        },
      },
    });

    let processedCount = 0;

    for (const task of dueTasks) {
      const targetUserId = task.assignee?.userId;

      if (targetUserId) {
        const dueInfo = task.dueTime ? ` Due at ${task.dueTime}.` : '';
        const scheduledTimeStr = task.reminderTime ? new Date(task.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const scheduledInfo = scheduledTimeStr ? `Scheduled for ${scheduledTimeStr}.` : '';

        await this.notificationsService.createInAppNotification(
          targetUserId,
          `Task Reminder: ${task.title}`,
          `${task.title}. ${scheduledInfo}${dueInfo}`.trim(),
          'PERSONAL_TASK_REMINDER',
          `/task_reminders?id=${task.id}`,
        );
      }

      // Mark reminder as triggered in DB immediately
      await this.prisma.employeeTask.update({
        where: { id: task.id },
        data: { reminderTriggeredAt: new Date() },
      });

      processedCount++;
    }

    if (processedCount > 0) {
      this.logger.log(`[Task Reminders] Dispatched ${processedCount} in-app reminder notifications.`);
    }

    return { processedCount };
  }

  /**
   * Format employee task for API responses.
   */
  private formatTask(task: any) {
    let description = task.description;
    let attachments: Array<{ fileName: string; filePath: string; fileSize?: number; mimeType?: string }> = [];

    if (description && description.includes('<!--ATTACHMENTS:')) {
      const match = description.match(/<!--ATTACHMENTS:(.*?)-->/);
      if (match && match[1]) {
        try {
          attachments = JSON.parse(match[1]);
        } catch {
          attachments = [];
        }
      }
      description = description.replace(/<!--ATTACHMENTS:.*?-->/, '').trim();
    }

    return {
      id: task.id,
      title: task.title,
      description,
      attachments,
      category: task.category,
      due_date: task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate) : null,
      due_time: task.dueTime,
      task_type: task.taskType,
      priority: task.priority,
      reminder_time: task.reminderTime ? (task.reminderTime instanceof Date ? task.reminderTime.toISOString() : task.reminderTime) : null,
      reminder_triggered_at: task.reminderTriggeredAt ? (task.reminderTriggeredAt instanceof Date ? task.reminderTriggeredAt.toISOString() : task.reminderTriggeredAt) : null,
      status: task.status,
      created_by: task.createdBy,
      assigned_to: task.assignedTo,
      creator_name: task.creator?.name,
      creator_email: task.creator?.email,
      assignee_name: task.assignee?.name,
      assignee_email: task.assignee?.email,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      completed_at: task.completedAt,
    };
  }
}
