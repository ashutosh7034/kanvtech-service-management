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

    // Auto-create/ensure employee profile for Admin/Super Admin/Manager if not already linked
    const role = (user?.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER') {
      const userIdNum = Number(userId || 1);

      const existingByUserId = await this.prisma.employee.findUnique({
        where: { userId: userIdNum },
      });
      if (existingByUserId) return existingByUserId.id;

      if (user?.email) {
        const existingByEmail = await this.prisma.employee.findFirst({
          where: { email: { equals: user.email, mode: 'insensitive' } },
        });
        if (existingByEmail) return existingByEmail.id;
      }

      const email =
        user?.email ||
        (role === 'ADMIN' || role === 'SUPER_ADMIN'
          ? 'admin@kanvtech.com'
          : `manager_${userIdNum}@kanvtech.com`);
      const name =
        role === 'ADMIN' || role === 'SUPER_ADMIN' ? 'System Administrator' : 'Operations Manager';

      let empId = role === 'ADMIN' || role === 'SUPER_ADMIN' ? `EMP-ADM-${userIdNum}` : `EMP-MGR-${userIdNum}`;
      const existingEmp = await this.prisma.employee.findUnique({ where: { id: empId } });
      if (existingEmp) {
        if (existingEmp.userId === userIdNum) return existingEmp.id;
        empId = `EMP-USR-${userIdNum}-${Date.now().toString().slice(-4)}`;
      }

      const created = await this.prisma.employee.create({
        data: {
          id: empId,
          userId: userIdNum,
          name,
          email,
          phone: '+91 98000 00000',
          department: 'Executive Management',
          designation:
            role === 'ADMIN' || role === 'SUPER_ADMIN' ? 'Chief Administrator' : 'Operations Manager',
          level: 'MANAGER',
          availability: 'AVAILABLE',
          status: 'ACTIVE',
          tenantId: user?.tenantId || 'KANVTECH',
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
   * Parse due date & time into Date object.
   */
  parseDueDateTime(dueDate?: string | Date | null, dueTime?: string | null): Date | null {
    if (!dueDate) return null;
    let year: number;
    let month: number;
    let day: number;

    if (dueDate instanceof Date) {
      year = dueDate.getFullYear();
      month = dueDate.getMonth();
      day = dueDate.getDate();
    } else {
      const dateStr = String(dueDate).trim();
      const ymdMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      const dmyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);

      if (ymdMatch) {
        year = parseInt(ymdMatch[1], 10);
        month = parseInt(ymdMatch[2], 10) - 1;
        day = parseInt(ymdMatch[3], 10);
      } else if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10);
        month = parseInt(dmyMatch[2], 10) - 1;
        year = parseInt(dmyMatch[3], 10);
      } else {
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) return null;
        year = parsed.getFullYear();
        month = parsed.getMonth();
        day = parsed.getDate();
      }
    }

    const timePart = dueTime ? dueTime.trim() : '06:00 PM';
    let hours = 18;
    let minutes = 0;

    const ampmMatch = timePart.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (ampmMatch) {
      hours = parseInt(ampmMatch[1], 10);
      minutes = parseInt(ampmMatch[2], 10);
      const ampm = (ampmMatch[3] || '').toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }

    const d = new Date(year, month, day, hours, minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Calculate dynamic automatic reminder timestamp: Exactly offsetMinutes (default 20) before deadline.
   */
  computeReminderTime(dueDate?: string | Date | null, dueTime?: string | null, offsetMinutes: number = 20): Date | null {
    const dueDateTime = this.parseDueDateTime(dueDate, dueTime);
    if (!dueDateTime || isNaN(dueDateTime.getTime())) return null;

    const offset = !isNaN(Number(offsetMinutes)) ? Number(offsetMinutes) : 20;
    return new Date(dueDateTime.getTime() - offset * 60 * 1000);
  }

  /**
   * Get list of eligible employees within the same tenant.
   * Requirement 3:
   * - Any eligible employee can assign to any eligible employee within same tenant.
   * - Platform users (Ashutosh Pandey / PLATFORM_INCHARGE) and employees from other tenants are excluded.
   * - Inactive employees are excluded.
   */
  async getEligibleAssignees(requestingEmployeeId: string, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';

    const allEmployees = await this.prisma.employee.findMany({
      where: {
        tenantId: tId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            role: true,
            isActive: true,
            isSuperAdmin: true,
          },
        },
        departmentRel: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }],
    });

    // Exclude platform-level users (PLATFORM_INCHARGE / EMP-PLT-001) and the requester itself
    const eligible = allEmployees.filter((emp) => {
      if (emp.id === requestingEmployeeId) return false;
      if (emp.user?.role === 'PLATFORM_INCHARGE' || emp.id === 'EMP-PLT-001') return false;
      return true;
    });

    return eligible.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      level: e.level,
      role: e.user?.role,
      department_name: e.departmentRel?.name || e.department,
      designation: e.designation,
      status: e.status,
    }));
  }

  /**
   * Create task activity entry.
   */
  async logActivity(data: {
    taskId: string;
    tenantId: string;
    actorEmployeeId?: string;
    actorUserId?: number;
    actorName?: string;
    activityType: string;
    comment?: string;
    oldProgress?: number;
    newProgress?: number;
    oldStatus?: string;
    newStatus?: string;
    metadata?: any;
  }) {
    try {
      const actId = `TACT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO task_activities (
          id, task_id, tenant_id, actor_employee_id, actor_user_id, actor_name,
          activity_type, comment, old_progress, new_progress, old_status, new_status,
          metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, now()
        )`,
        actId,
        data.taskId,
        data.tenantId,
        data.actorEmployeeId || null,
        data.actorUserId || null,
        data.actorName || null,
        data.activityType,
        data.comment || null,
        data.oldProgress ?? null,
        data.newProgress ?? null,
        data.oldStatus || null,
        data.newStatus || null,
        JSON.stringify(data.metadata || {}),
      );
    } catch (err: any) {
      this.logger.warn(`Failed logging task activity for ${data.taskId}: ${err.message}`);
    }
  }

  /**
   * Fetch activity timeline for a task.
   */
  async getTaskActivities(taskId: string, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM task_activities WHERE task_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      taskId,
      tId,
    );

    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      actorEmployeeId: r.actor_employee_id,
      actorUserId: r.actor_user_id,
      actorName: r.actor_name,
      activityType: r.activity_type,
      comment: r.comment,
      oldProgress: r.old_progress,
      newProgress: r.new_progress,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      createdAt: r.created_at,
    }));
  }

  /**
   * Create a new task (two-way assignment).
   */
  async createTask(
    creatorEmployeeId: string,
    creatorUserId: number | undefined,
    creatorName: string | undefined,
    tenantId: string | undefined,
    data: {
      title: string;
      description?: string;
      category?: string;
      dueDate?: string;
      dueTime?: string;
      reminderOffsetMinutes?: number;
      taskType?: string;
      priority?: string;
      assignedToIds?: string[];
      attachments?: Array<{ fileName: string; filePath: string; fileSize?: number; mimeType?: string }>;
    },
  ) {
    const tId = tenantId || 'KANVTECH';
    if (!data.title?.trim()) {
      throw new BadRequestException('Task title is required.');
    }

    const offsetMinutes =
      data.reminderOffsetMinutes !== undefined && !isNaN(Number(data.reminderOffsetMinutes))
        ? Number(data.reminderOffsetMinutes)
        : 20;

    // Default Due Time: 6:00 PM EOD
    const dueTime = (data.dueTime?.trim() || '06:00 PM');
    const dueDateRaw = data.dueDate || new Date().toISOString().split('T')[0];
    const dueDateTime = this.parseDueDateTime(dueDateRaw, dueTime);

    // Automatic dynamic reminder = Due Date & Time - offsetMinutes
    const reminderDateTime = this.computeReminderTime(dueDateRaw, dueTime, offsetMinutes);
    const now = new Date();

    let reminderStatus = 'SCHEDULED';
    if (!reminderDateTime) {
      reminderStatus = 'NONE';
    } else if (reminderDateTime < now) {
      // Policy: if reminder time has already passed when set, mark as PASSED to avoid unexpected immediate firing
      reminderStatus = 'PASSED';
    }

    const priority = data.priority ? data.priority.toUpperCase() : 'MEDIUM';

    // Normalize assignees
    let targetAssigneeIds: string[] = [];
    if (Array.isArray(data.assignedToIds) && data.assignedToIds.length > 0) {
      targetAssigneeIds = data.assignedToIds;
    } else {
      targetAssigneeIds = [creatorEmployeeId];
    }

    const resolvedAssigneeIds = Array.from(
      new Set(targetAssigneeIds.map((id) => (id === 'MYSELF' || id === 'myself' ? creatorEmployeeId : id))),
    );

    // Validate each target assignee belongs to same tenant and is active
    for (const assigneeId of resolvedAssigneeIds) {
      if (assigneeId !== creatorEmployeeId) {
        const targetEmp = await this.prisma.employee.findFirst({
          where: { id: assigneeId, tenantId: tId, status: 'ACTIVE' },
          include: { user: { select: { role: true, isSuperAdmin: true } } },
        });

        if (!targetEmp) {
          throw new BadRequestException(`Target employee '${assigneeId}' not found, inactive, or not in active tenant.`);
        }

        if (targetEmp.user?.role === 'PLATFORM_INCHARGE' || targetEmp.id === 'EMP-PLT-001') {
          throw new BadRequestException(`Tasks cannot be assigned to platform-level administrative users.`);
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
          dueTime,
          taskType,
          priority,
          reminderTime: reminderDateTime,
          reminderTriggeredAt: null,
          status: 'PENDING',
          createdBy: creatorEmployeeId,
          assignedTo: assigneeId,
          tenantId: tId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
          assignee: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
        },
      });

      // Update dynamic reminder tracking columns
      await this.prisma.$executeRawUnsafe(
        `UPDATE employee_tasks
         SET reminder_offset_minutes = $1, reminder_status = $2, reminder_delivery_timestamp = null
         WHERE id = $3`,
        offsetMinutes,
        reminderStatus,
        task.id,
      );

      // Log initial creation activity
      await this.logActivity({
        taskId: task.id,
        tenantId: tId,
        actorEmployeeId: creatorEmployeeId,
        actorUserId: creatorUserId,
        actorName: creatorName || task.creator?.name,
        activityType: isSelf ? 'TASK_CREATED' : 'TASK_ASSIGNED',
        comment: isSelf ? 'Personal task created' : `Assigned to ${task.assignee?.name}`,
        newProgress: 0,
        newStatus: 'PENDING',
        metadata: {
          priority,
          dueTime,
          dueDate: dueDateTime,
          reminderOffsetMinutes: offsetMinutes,
          autoReminderTime: reminderDateTime,
          reminderStatus,
        },
      });

      // Instant In-App notification to Assignee
      if (!isSelf && task.assignee?.userId) {
        const assignorDisplayName = task.creator?.name || creatorName || 'A team member';
        const formattedDueDate = dueDateTime ? dueDateTime.toLocaleDateString() : 'Today';

        await this.notificationsService.createInAppNotification(
          task.assignee.userId,
          'NEW TASK ASSIGNED',
          `${assignorDisplayName} assigned you a new task: "${task.title}". Due: ${formattedDueDate} at ${dueTime}. Priority: ${priority}.`,
          'TASK_ASSIGNED',
          `/task-reminders?taskId=${task.id}`,
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
            tenantId: tId,
          },
        });
      }

      const fullTask = await this.getTaskById(task.id, creatorEmployeeId, tId);
      createdTasks.push(fullTask);
    }

    return createdTasks.length === 1 ? createdTasks[0] : createdTasks;
  }

  /**
   * Two-Way Task List with views:
   * - my_tasks: Assigned TO the employee
   * - sent_tasks: Assigned BY the employee to others
   * - team_tasks: Team-wide view for tenant
   */
  async getTasks(
    employeeId: string,
    params: {
      view?: 'my_tasks' | 'sent_tasks' | 'team_tasks';
      status?: string;
      filter?: string;
      priority?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
      tenantId?: string;
    },
  ) {
    const tId = params.tenantId || 'KANVTECH';
    const view = params.view || 'my_tasks';
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = { tenantId: tId };

    if (view === 'my_tasks') {
      where.assignedTo = employeeId;
    } else if (view === 'sent_tasks') {
      where.createdBy = employeeId;
      where.assignedTo = { not: employeeId };
    } else if (view === 'team_tasks') {
      // Team tasks within active tenant
    }

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
        { id: { contains: q, mode: 'insensitive' } },
      ];
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (params.filter === 'today') {
      where.dueDate = { gte: startOfToday, lte: endOfToday };
    } else if (params.filter === 'upcoming') {
      where.dueDate = { gt: endOfToday };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    } else if (params.filter === 'overdue') {
      where.dueDate = { lt: startOfToday };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
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
          creator: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
          assignee: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
        },
      }),
    ]);

    // Query extra columns (progress, reminders, etc.)
    const taskIds = tasks.map((t) => t.id);
    let extraMap: Record<string, any> = {};
    if (taskIds.length > 0) {
      const extras: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, progress, accepted_at, cancelled_at, cancellation_reason, last_reminder_sent_at, reminder_count, extension_requested_at, extension_requested_date, extension_reason,
                reminder_offset_minutes, reminder_status, reminder_delivery_timestamp
         FROM employee_tasks WHERE id = ANY($1::text[])`,
        taskIds,
      );
      extras.forEach((r) => {
        extraMap[r.id] = r;
      });
    }

    return {
      data: tasks.map((t) => this.formatTask(t, extraMap[t.id])),
      total,
      page,
      limit,
    };
  }

  /**
   * Get specific task with full activities and metadata.
   */
  async getTaskById(id: string, requestingEmployeeId: string, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
        assignee: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    const [extras]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT progress, accepted_at, cancelled_at, cancellation_reason, last_reminder_sent_at, reminder_count, extension_requested_at, extension_requested_date, extension_reason,
              reminder_offset_minutes, reminder_status, reminder_delivery_timestamp
       FROM employee_tasks WHERE id = $1`,
      id,
    );

    const activities = await this.getTaskActivities(id, tId);
    const formatted = this.formatTask(task, extras);

    return {
      ...formatted,
      activities,
    };
  }

  /**
   * Update task progress (Assignee action).
   */
  async updateProgress(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    data: { progress: number; comment?: string },
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true, email: true } },
        assignee: { select: { id: true, name: true, userId: true, email: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    // Only assignee or creator can update progress
    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('You are not authorized to update progress for this task.');
    }

    const newProgress = Math.max(0, Math.min(100, Number(data.progress ?? 0)));

    const [currExtra]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT progress FROM employee_tasks WHERE id = $1`,
      id,
    );
    const oldProgress = currExtra?.progress ?? 0;

    // Automatic status progression: If PENDING and progress > 0, moves to IN_PROGRESS
    let newStatus = task.status;
    if (task.status === 'PENDING' && newProgress > 0) {
      newStatus = 'IN_PROGRESS';
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET progress = $1, status = $2, updated_at = now() WHERE id = $3`,
      newProgress,
      newStatus,
      id,
    );

    // Activity log
    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.assignee?.name,
      activityType: 'PROGRESS_UPDATE',
      comment: data.comment || `Updated progress to ${newProgress}%`,
      oldProgress,
      newProgress,
      oldStatus: task.status,
      newStatus,
    });

    // Notify assignor if assignee updated progress
    if (task.createdBy !== requestingEmployeeId && task.creator?.userId) {
      const updaterName = requestingUserName || task.assignee?.name || 'Assignee';
      const commentSnippet = data.comment ? ` ("${data.comment}")` : '';
      await this.notificationsService.createInAppNotification(
        task.creator.userId,
        'TASK PROGRESS UPDATED',
        `${updaterName} updated progress on "${task.title}" to ${newProgress}%${commentSnippet}.`,
        'TASK_PROGRESS',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Accept task (Assignee action).
   */
  async acceptTask(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId) {
      throw new ForbiddenException('Only the assigned employee can accept this task.');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET status = 'ACCEPTED', accepted_at = now(), updated_at = now() WHERE id = $1`,
      id,
    );

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.assignee?.name,
      activityType: 'TASK_ACCEPTED',
      comment: 'Task accepted by assignee',
      oldStatus: task.status,
      newStatus: 'ACCEPTED',
    });

    // Notify assignor
    if (task.creator?.userId) {
      await this.notificationsService.createInAppNotification(
        task.creator.userId,
        'TASK ACCEPTED',
        `${task.assignee?.name || 'Assignee'} accepted task "${task.title}".`,
        'TASK_ACCEPTED',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Complete task (explicit completion workflow).
   */
  async completeTask(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    comment?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('You cannot complete this task.');
    }

    const [currExtra]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT progress FROM employee_tasks WHERE id = $1`,
      id,
    );
    const oldProgress = currExtra?.progress ?? 0;

    await this.prisma.employeeTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET progress = 100, updated_at = now() WHERE id = $1`,
      id,
    );

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.assignee?.name,
      activityType: 'TASK_COMPLETED',
      comment: comment || 'Task confirmed as completed',
      oldProgress,
      newProgress: 100,
      oldStatus: task.status,
      newStatus: 'COMPLETED',
    });

    // Notify assignor if assignee completed
    if (task.createdBy !== requestingEmployeeId && task.creator?.userId) {
      await this.notificationsService.createInAppNotification(
        task.creator.userId,
        'TASK COMPLETED',
        `${task.assignee?.name || 'Assignee'} marked task "${task.title}" as Completed.`,
        'TASK_COMPLETED',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Reopen task (Assignor / Manager action).
   */
  async reopenTask(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    reason?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('Only the assignor can reopen this task.');
    }

    await this.prisma.employeeTask.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        completedAt: null,
      },
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET progress = 50, updated_at = now() WHERE id = $1`,
      id,
    );

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.creator?.name,
      activityType: 'TASK_REOPENED',
      comment: reason || 'Task reopened for further review',
      oldStatus: task.status,
      newStatus: 'IN_PROGRESS',
    });

    // Notify assignee
    if (task.assignee?.userId) {
      await this.notificationsService.createInAppNotification(
        task.assignee.userId,
        'TASK REOPENED',
        `${task.creator?.name || 'Assignor'} reopened task "${task.title}": ${reason || 'Action required.'}`,
        'TASK_REOPENED',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Send Manual Reminder (Assignor action with rate limiting).
   */
  async sendManualReminder(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    customMessage?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('Only the task assignor can dispatch follow-up reminders.');
    }

    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new BadRequestException('Cannot send reminder for completed or cancelled tasks.');
    }

    // Rate-limiting check: At least 2 minutes between manual reminders
    const [extra]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT last_reminder_sent_at, reminder_count FROM employee_tasks WHERE id = $1`,
      id,
    );

    if (extra?.last_reminder_sent_at) {
      const lastSent = new Date(extra.last_reminder_sent_at);
      const elapsedMs = Date.now() - lastSent.getTime();
      if (elapsedMs < 2 * 60 * 1000) {
        throw new BadRequestException('A reminder was dispatched recently. Please wait 2 minutes before following up again.');
      }
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET last_reminder_sent_at = now(), reminder_count = reminder_count + 1, updated_at = now() WHERE id = $1`,
      id,
    );

    const reminderMsg =
      customMessage ||
      `Reminder from ${task.creator?.name || 'Assignor'}: Please check task "${task.title}". Due at ${task.dueTime || 'EOD'}.`;

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.creator?.name,
      activityType: 'MANUAL_REMINDER_SENT',
      comment: reminderMsg,
      metadata: { reminderCount: (extra?.reminder_count || 0) + 1 },
    });

    if (task.assignee?.userId) {
      await this.notificationsService.createInAppNotification(
        task.assignee.userId,
        'TASK REMINDER / FOLLOW-UP',
        reminderMsg,
        'MANUAL_TASK_REMINDER',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return {
      success: true,
      message: `Follow-up reminder sent to ${task.assignee?.name}.`,
    };
  }

  /**
   * Request deadline extension (Assignee action).
   */
  async requestExtension(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    data: { proposedDate: string; reason: string },
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId) {
      throw new ForbiddenException('Only the assignee can request a deadline extension.');
    }

    const proposed = new Date(data.proposedDate);
    if (isNaN(proposed.getTime())) {
      throw new BadRequestException('Invalid proposed date.');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET
        extension_requested_at = now(),
        extension_requested_date = $1,
        extension_reason = $2,
        updated_at = now()
       WHERE id = $3`,
      proposed,
      data.reason?.trim() || 'No reason specified',
      id,
    );

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.assignee?.name,
      activityType: 'EXTENSION_REQUESTED',
      comment: `Requested extension to ${proposed.toLocaleDateString()}: ${data.reason}`,
      metadata: { proposedDate: proposed, reason: data.reason },
    });

    if (task.creator?.userId) {
      await this.notificationsService.createInAppNotification(
        task.creator.userId,
        'DEADLINE EXTENSION REQUESTED',
        `${task.assignee?.name || 'Assignee'} requested extension for "${task.title}" to ${proposed.toLocaleDateString()}: ${data.reason}`,
        'EXTENSION_REQUESTED',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Cancel task (Assignor action).
   */
  async cancelTask(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    reason?: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('Only the task assignor can cancel this task.');
    }

    await this.prisma.employeeTask.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks SET cancelled_at = now(), cancellation_reason = $1, updated_at = now() WHERE id = $2`,
      reason?.trim() || 'Cancelled by assignor',
      id,
    );

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName || task.creator?.name,
      activityType: 'TASK_CANCELLED',
      comment: reason || 'Task cancelled',
      oldStatus: task.status,
      newStatus: 'CANCELLED',
    });

    if (task.assignee?.userId) {
      await this.notificationsService.createInAppNotification(
        task.assignee.userId,
        'TASK CANCELLED',
        `Task "${task.title}" was cancelled by ${task.creator?.name || 'Assignor'}: ${reason || ''}`,
        'TASK_CANCELLED',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Add comment to task (Either party).
   */
  async addComment(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    commentText: string,
  ) {
    const tId = tenantId || 'KANVTECH';
    if (!commentText?.trim()) {
      throw new BadRequestException('Comment text is required.');
    }

    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('You cannot comment on this task.');
    }

    await this.logActivity({
      taskId: id,
      tenantId: tId,
      actorEmployeeId: requestingEmployeeId,
      actorUserId: requestingUserId,
      actorName: requestingUserName,
      activityType: 'COMMENT',
      comment: commentText.trim(),
    });

    // Notify the other party
    const isAssignee = task.assignedTo === requestingEmployeeId;
    const recipientUserId = isAssignee ? task.creator?.userId : task.assignee?.userId;

    if (recipientUserId) {
      await this.notificationsService.createInAppNotification(
        recipientUserId,
        'NEW TASK COMMENT',
        `${requestingUserName || 'Team member'} commented on "${task.title}": ${commentText.trim()}`,
        'TASK_COMMENT',
        `/task-reminders?taskId=${task.id}`,
      );
    }

    return this.getTaskActivities(id, tId);
  }

  /**
   * Update task details (Assignor or permitted editor).
   */
  async updateTask(
    id: string,
    requestingEmployeeId: string,
    requestingUserId: number | undefined,
    requestingUserName: string | undefined,
    tenantId: string | undefined,
    data: {
      title?: string;
      description?: string;
      category?: string;
      dueDate?: string;
      dueTime?: string;
      reminderOffsetMinutes?: number;
      priority?: string;
      status?: string;
    },
  ) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
      include: {
        creator: { select: { id: true, name: true, userId: true } },
        assignee: { select: { id: true, name: true, userId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('You cannot edit this task.');
    }

    const [existingExtra]: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT reminder_offset_minutes, reminder_status, reminder_delivery_timestamp 
       FROM employee_tasks WHERE id = $1`,
      id,
    );

    let dueDateTime = task.dueDate;
    let dueTime = data.dueTime !== undefined ? data.dueTime?.trim() || null : task.dueTime;
    let offsetMinutes =
      data.reminderOffsetMinutes !== undefined && !isNaN(Number(data.reminderOffsetMinutes))
        ? Number(data.reminderOffsetMinutes)
        : (existingExtra?.reminder_offset_minutes ?? 20);

    let reminderDateTime = task.reminderTime;
    let resetReminder = false;
    let reminderStatus = existingExtra?.reminder_status || 'SCHEDULED';

    if (data.dueDate !== undefined || data.dueTime !== undefined || data.reminderOffsetMinutes !== undefined) {
      const rawDate = data.dueDate !== undefined ? data.dueDate : task.dueDate;
      dueDateTime = this.parseDueDateTime(rawDate, dueTime);

      // Recalculate automatic reminder dynamically: Due DateTime - offsetMinutes
      reminderDateTime = this.computeReminderTime(rawDate, dueTime, offsetMinutes);
      resetReminder = true;

      const now = new Date();
      if (!reminderDateTime) {
        reminderStatus = 'NONE';
      } else if (reminderDateTime < now) {
        // Policy: if reminder time has already passed, mark as PASSED to avoid unexpected immediate firing
        reminderStatus = 'PASSED';
      } else {
        reminderStatus = 'SCHEDULED';
      }
    }

    const newStatus = data.status || task.status;
    let completedAt = task.completedAt;
    if (newStatus === 'COMPLETED' && task.status !== 'COMPLETED') {
      completedAt = new Date();
      reminderStatus = 'CANCELLED';
    } else if (newStatus === 'CANCELLED') {
      reminderStatus = 'CANCELLED';
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
        dueTime,
        priority: data.priority ? data.priority.toUpperCase() : task.priority,
        reminderTime: reminderDateTime,
        reminderTriggeredAt: resetReminder ? null : task.reminderTriggeredAt,
        status: newStatus,
        completedAt,
      },
      include: {
        creator: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
        assignee: { select: { id: true, name: true, email: true, userId: true, designation: true, level: true } },
      },
    });

    // Update dynamic reminder columns transactionally
    await this.prisma.$executeRawUnsafe(
      `UPDATE employee_tasks 
       SET reminder_offset_minutes = $1, 
           reminder_status = $2, 
           reminder_delivery_timestamp = CASE WHEN $3 = true THEN NULL ELSE reminder_delivery_timestamp END,
           reminder_triggered_at = CASE WHEN $3 = true THEN NULL ELSE reminder_triggered_at END,
           updated_at = now()
       WHERE id = $4`,
      offsetMinutes,
      reminderStatus,
      resetReminder,
      id,
    );

    if (resetReminder) {
      await this.logActivity({
        taskId: id,
        tenantId: tId,
        actorEmployeeId: requestingEmployeeId,
        actorUserId: requestingUserId,
        actorName: requestingUserName,
        activityType: 'DEADLINE_CHANGED',
        comment: `Rescheduled deadline to ${dueDateTime ? dueDateTime.toLocaleDateString() : 'N/A'} at ${dueTime} (Reminder: ${offsetMinutes}m offset)`,
        metadata: {
          newDueDate: dueDateTime,
          newDueTime: dueTime,
          newReminder: reminderDateTime,
          reminderOffsetMinutes: offsetMinutes,
          reminderStatus,
        },
      });

      // Notify assignee if assignor changed deadline
      if (task.createdBy === requestingEmployeeId && task.assignee?.userId) {
        await this.notificationsService.createInAppNotification(
          task.assignee.userId,
          'TASK DEADLINE RESCHEDULED',
          `Deadline for task "${task.title}" was rescheduled to ${dueDateTime ? dueDateTime.toLocaleDateString() : ''} at ${dueTime}.`,
          'TASK_RESCHEDULED',
          `/task-reminders?taskId=${task.id}`,
        );
      }
    }

    return this.getTaskById(id, requestingEmployeeId, tId);
  }

  /**
   * Delete task.
   */
  async deleteTask(id: string, requestingEmployeeId: string, requestingUserId?: number, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const task = await this.prisma.employeeTask.findFirst({
      where: { id, tenantId: tId },
    });
    if (!task) throw new NotFoundException('Task not found.');

    if (task.assignedTo !== requestingEmployeeId && task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('Only the task owner or assignor can delete it.');
    }

    await this.prisma.employeeTask.delete({ where: { id } });

    if (requestingUserId) {
      await this.auditService.log({
        actorUserId: requestingUserId,
        action: 'TASK_DELETED',
        entityType: 'EMPLOYEE_TASK',
        entityId: id,
        oldValues: { title: task.title, status: task.status, tenantId: tId },
      });
    }

    return { success: true, message: 'Task deleted successfully.' };
  }

  /**
   * Dashboard summary counts.
   */
  async getDashboardSummary(employeeId: string, tenantId?: string) {
    const tId = tenantId || 'KANVTECH';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [myTasks, sentTasks] = await Promise.all([
      this.prisma.employeeTask.findMany({
        where: { assignedTo: employeeId, tenantId: tId },
      }),
      this.prisma.employeeTask.findMany({
        where: { createdBy: employeeId, assignedTo: { not: employeeId }, tenantId: tId },
      }),
    ]);

    const myPending = myTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const myCompleted = myTasks.filter((t) => t.status === 'COMPLETED');

    const dueToday = myPending.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= startOfToday && d <= endOfToday;
    });

    const overdue = myPending.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d < startOfToday;
    });

    const upcoming = myPending.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d > endOfToday;
    });

    const sentPending = sentTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    const sentCompleted = sentTasks.filter((t) => t.status === 'COMPLETED');

    return {
      myTasks: {
        total: myTasks.length,
        pending: myPending.length,
        dueToday: dueToday.length,
        overdue: overdue.length,
        upcoming: upcoming.length,
        completed: myCompleted.length,
      },
      sentTasks: {
        total: sentTasks.length,
        pending: sentPending.length,
        completed: sentCompleted.length,
      },
    };
  }

  /**
   * Background processor: checks due reminders (offset minutes before deadline)
   * and creates in-app notifications idempotently.
   */
  async processDueReminders(): Promise<{ processedCount: number }> {
    const now = new Date();

    const dueTasks: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT t.id, t.title, t.due_time, t.reminder_time, t.reminder_offset_minutes,
              u.id as assignee_user_id, e.name as assignee_name
       FROM employee_tasks t
       JOIN employees e ON t.assigned_to = e.id
       JOIN users u ON e.user_id = u.id
       WHERE t.status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD')
       AND t.reminder_time <= now()
       AND t.reminder_triggered_at IS NULL
       AND (t.reminder_status IS NULL OR t.reminder_status = 'SCHEDULED')`,
    );

    let processedCount = 0;

    for (const task of dueTasks) {
      if (task.assignee_user_id) {
        const dueInfo = task.due_time ? ` Due at ${task.due_time}.` : '';
        const offset = task.reminder_offset_minutes || 20;

        await this.notificationsService.createInAppNotification(
          Number(task.assignee_user_id),
          `Task Reminder: ${task.title}`,
          `Upcoming task: "${task.title}".${dueInfo} (${offset} mins before deadline)`,
          'TASK_REMINDER_AUTOMATIC',
          `/task-reminders?taskId=${task.id}`,
        );
      }

      await this.prisma.$executeRawUnsafe(
        `UPDATE employee_tasks 
         SET reminder_triggered_at = now(), reminder_delivery_timestamp = now(), reminder_status = 'TRIGGERED' 
         WHERE id = $1`,
        task.id,
      );

      processedCount++;
    }

    if (processedCount > 0) {
      this.logger.log(`[Task Reminders] Dispatched ${processedCount} in-app automatic reminder notifications.`);
    }

    return { processedCount };
  }

  /**
   * Format employee task for API responses.
   */
  private formatTask(task: any, extra?: any) {
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
      dueDate: task.dueDate ? (task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate) : null,
      due_time: task.dueTime,
      dueTime: task.dueTime,
      task_type: task.taskType,
      taskType: task.taskType,
      priority: task.priority,
      reminder_time: task.reminderTime
        ? task.reminderTime instanceof Date
          ? task.reminderTime.toISOString()
          : task.reminderTime
        : null,
      reminderTime: task.reminderTime
        ? task.reminderTime instanceof Date
          ? task.reminderTime.toISOString()
          : task.reminderTime
        : null,
      reminder_offset_minutes: extra?.reminder_offset_minutes ?? 20,
      reminderOffsetMinutes: extra?.reminder_offset_minutes ?? 20,
      reminder_status: extra?.reminder_status || (task.status === 'COMPLETED' || task.status === 'CANCELLED' ? 'CANCELLED' : task.reminderTriggeredAt ? 'TRIGGERED' : 'SCHEDULED'),
      reminderStatus: extra?.reminder_status || (task.status === 'COMPLETED' || task.status === 'CANCELLED' ? 'CANCELLED' : task.reminderTriggeredAt ? 'TRIGGERED' : 'SCHEDULED'),
      reminder_delivery_timestamp: extra?.reminder_delivery_timestamp ?? task.reminderTriggeredAt ?? null,
      reminderDeliveryTimestamp: extra?.reminder_delivery_timestamp ?? task.reminderTriggeredAt ?? null,
      reminder_triggered_at: task.reminderTriggeredAt
        ? task.reminderTriggeredAt instanceof Date
          ? task.reminderTriggeredAt.toISOString()
          : task.reminderTriggeredAt
        : null,
      status: task.status,
      progress: extra?.progress ?? 0,
      accepted_at: extra?.accepted_at ?? null,
      cancelled_at: extra?.cancelled_at ?? null,
      cancellation_reason: extra?.cancellation_reason ?? null,
      last_reminder_sent_at: extra?.last_reminder_sent_at ?? null,
      reminder_count: extra?.reminder_count ?? 0,
      extension_requested_at: extra?.extension_requested_at ?? null,
      extension_requested_date: extra?.extension_requested_date ?? null,
      extension_reason: extra?.extension_reason ?? null,
      created_by: task.createdBy,
      createdBy: task.createdBy,
      assigned_to: task.assignedTo,
      assignedTo: task.assignedTo,
      creator_name: task.creator?.name,
      creatorName: task.creator?.name,
      creator_email: task.creator?.email,
      creator_designation: task.creator?.designation,
      creator_level: task.creator?.level,
      assignee_name: task.assignee?.name,
      assigneeName: task.assignee?.name,
      assignee_email: task.assignee?.email,
      assignee_designation: task.assignee?.designation,
      assignee_level: task.assignee?.level,
      tenantId: task.tenantId,
      created_at: task.createdAt,
      createdAt: task.createdAt,
      updated_at: task.updatedAt,
      updatedAt: task.updatedAt,
      completed_at: task.completedAt,
      completedAt: task.completedAt,
    };
  }
}
