import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeeTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateTaskId(): Promise<string> {
    const seq = await this.prisma.getNextSequence('EMP_TASK_SEQ');
    return `ETSK-${String(seq).padStart(4, '0')}`;
  }

  async createTask(
    creatorEmployeeId: string,
    data: {
      title: string;
      description?: string;
      dueDate?: string;
      dueTime?: string;
      priority?: string;
      reminderTime?: string;
      assignedTo?: string;
    },
  ) {
    if (!data.title?.trim()) {
      throw new BadRequestException('Task title is required.');
    }

    // Default self-task: assignedTo = creatorEmployeeId
    const assignedTo = data.assignedTo || creatorEmployeeId;

    const id = await this.generateTaskId();

    const task = await this.prisma.employeeTask.create({
      data: {
        id,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        dueTime: data.dueTime?.trim() || null,
        priority: data.priority || 'MEDIUM',
        reminderTime: data.reminderTime ? new Date(data.reminderTime) : null,
        status: 'PENDING',
        createdBy: creatorEmployeeId,
        assignedTo,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatTask(task);
  }

  async getMyTasks(
    employeeId: string,
    params: { status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { assignedTo: employeeId };
    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    const [total, tasks] = await Promise.all([
      this.prisma.employeeTask.count({ where }),
      this.prisma.employeeTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
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

  async getTaskById(id: string, requestingEmployeeId: string) {
    const task = await this.prisma.employeeTask.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    // Only creator or assignee can view
    if (task.createdBy !== requestingEmployeeId && task.assignedTo !== requestingEmployeeId) {
      throw new ForbiddenException('You do not have access to this task.');
    }

    return this.formatTask(task);
  }

  async updateTask(
    id: string,
    requestingEmployeeId: string,
    data: {
      title?: string;
      description?: string;
      dueDate?: string;
      dueTime?: string;
      priority?: string;
      reminderTime?: string;
      status?: string;
    },
  ) {
    const task = await this.prisma.employeeTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found.');

    if (task.createdBy !== requestingEmployeeId && task.assignedTo !== requestingEmployeeId) {
      throw new ForbiddenException('You cannot edit this task.');
    }

    const updated = await this.prisma.employeeTask.update({
      where: { id },
      data: {
        title: data.title?.trim() || task.title,
        description: data.description !== undefined ? data.description?.trim() || null : task.description,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : task.dueDate,
        dueTime: data.dueTime !== undefined ? data.dueTime?.trim() || null : task.dueTime,
        priority: data.priority || task.priority,
        reminderTime: data.reminderTime !== undefined ? (data.reminderTime ? new Date(data.reminderTime) : null) : task.reminderTime,
        status: data.status || task.status,
        completedAt: data.status === 'COMPLETED' && task.status !== 'COMPLETED' ? new Date() : task.completedAt,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatTask(updated);
  }

  async completeTask(id: string, requestingEmployeeId: string) {
    return this.updateTask(id, requestingEmployeeId, { status: 'COMPLETED' });
  }

  async deleteTask(id: string, requestingEmployeeId: string) {
    const task = await this.prisma.employeeTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found.');

    if (task.createdBy !== requestingEmployeeId) {
      throw new ForbiddenException('Only the task creator can delete it.');
    }

    await this.prisma.employeeTask.delete({ where: { id } });
    return { message: 'Task deleted successfully.' };
  }

  /** Get due/overdue reminders for a given employee (for dashboard notifications) */
  async getDueReminders(employeeId: string) {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes window

    const tasks = await this.prisma.employeeTask.findMany({
      where: {
        assignedTo: employeeId,
        status: 'PENDING',
        OR: [
          { reminderTime: { lte: soon } },
          { dueDate: { lte: now } },
        ],
      },
      orderBy: { dueDate: 'asc' },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });

    return { reminders: tasks.map(this.formatTask) };
  }

  private formatTask(task: any) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.dueDate,
      due_time: task.dueTime,
      priority: task.priority,
      reminder_time: task.reminderTime,
      status: task.status,
      created_by: task.createdBy,
      assigned_to: task.assignedTo,
      creator_name: task.creator?.name,
      creator_email: task.creator?.email,
      assignee_name: task.assignee?.name,
      assignee_email: task.assignee?.email,
      created_at: task.createdAt,
      completed_at: task.completedAt,
    };
  }
}
