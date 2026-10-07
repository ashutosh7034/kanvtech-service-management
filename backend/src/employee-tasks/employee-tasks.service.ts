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
   * Create a new personal self-task with due date/time and reminder.
   */
  async createTask(
    creatorEmployeeId: string,
    creatorUserId: number | undefined,
    data: {
      title: string;
      description?: string;
      category?: string;
      dueDate?: string;
      dueTime?: string;
      taskType?: string;
      priority?: string;
      reminderTime?: string;
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

    const id = await this.generateTaskId();
    const priority = data.priority ? data.priority.toUpperCase() : 'MEDIUM';

    const task = await this.prisma.employeeTask.create({
      data: {
        id,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        dueDate: dueDateTime,
        dueTime: data.dueTime?.trim() || null,
        taskType: data.taskType || 'SELF TASK',
        priority,
        reminderTime: reminderDateTime,
        reminderTriggeredAt: null,
        status: 'PENDING',
        createdBy: creatorEmployeeId,
        assignedTo: creatorEmployeeId, // Strictly personal to owner
      },
      include: {
        creator: { select: { id: true, name: true, email: true, userId: true } },
        assignee: { select: { id: true, name: true, email: true, userId: true } },
      },
    });

    if (creatorUserId) {
      await this.auditService.log({
        actorUserId: creatorUserId,
        action: 'TASK_CREATED',
        entityType: 'EMPLOYEE_TASK',
        entityId: task.id,
        newValues: {
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          reminderTime: task.reminderTime,
        },
      });
    }

    return this.formatTask(task);
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
    return {
      id: task.id,
      title: task.title,
      description: task.description,
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
