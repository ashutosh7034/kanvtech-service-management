import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeeTasksService } from './employee-tasks.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { RequirePermissions } from '../permissions/permissions.decorator';

@ApiTags('Employee Tasks / Two-Way Task Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['employee-tasks', 'my-tasks'])
export class EmployeeTasksController {
  constructor(
    private readonly employeeTasksService: EmployeeTasksService,
    private readonly storageService: StorageService,
  ) {}

  private async getEmployeeId(req: any): Promise<string> {
    return this.employeeTasksService.resolveEmployeeId(req.user);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file attachment for task' })
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const uploaded = await this.storageService.upload(file);
    return { success: true, file: uploaded, attachment: uploaded };
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with two-way views (my_tasks, sent_tasks, team_tasks)' })
  async getTasks(@Query() query: any, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const result = await this.employeeTasksService.getTasks(employeeId, {
      view: query.view || 'my_tasks',
      status: query.status,
      filter: query.filter,
      priority: query.priority,
      category: query.category,
      search: query.search,
      page: query.page,
      limit: query.limit,
      tenantId: req.user?.tenantId,
    });
    return { success: true, ...result };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary metrics for My Tasks, Sent Tasks, and Team Tasks' })
  async getDashboardSummary(@Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const summary = await this.employeeTasksService.getDashboardSummary(employeeId, req.user?.tenantId);
    return { success: true, ...summary };
  }

  @Get('eligible-assignees')
  @ApiOperation({ summary: 'Get active employees within tenant authorized for task assignment' })
  async getEligibleAssignees(@Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const employees = await this.employeeTasksService.getEligibleAssignees(employeeId, req.user?.tenantId);
    return { success: true, employees };
  }

  @Get('process-reminders')
  @ApiOperation({ summary: 'Trigger automatic reminder sweep (20 minutes before deadline)' })
  async triggerReminderSweep() {
    const result = await this.employeeTasksService.processDueReminders();
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific task details by ID' })
  async getTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const task = await this.employeeTasksService.getTaskById(id, employeeId, req.user?.tenantId, req.user);
    return { success: true, task };
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'Get activity timeline and history for task' })
  async getActivities(@Param('id') id: string, @Request() req: any) {
    const activities = await this.employeeTasksService.getTaskActivities(id, req.user?.tenantId);
    return { success: true, activities };
  }

  @Post()
  @RequirePermissions('task.assign')
  @ApiOperation({ summary: 'Create and assign a task to eligible employee' })
  async createTask(@Body() body: any, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.createTask(
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      {
        title: body.title,
        description: body.description,
        category: body.category,
        dueDate: body.due_date || body.dueDate,
        dueTime: body.due_time || body.dueTime,
        reminderOffsetMinutes:
          body.reminder_offset_minutes !== undefined
            ? Number(body.reminder_offset_minutes)
            : body.reminderOffsetMinutes !== undefined
            ? Number(body.reminderOffsetMinutes)
            : 20,
        priority: body.priority,
        taskType: body.task_type || body.taskType,
        assignedToIds:
          body.assigned_to_ids ||
          body.assignedToIds ||
          (body.assigned_to ? [body.assigned_to] : undefined) ||
          (body.assignedTo ? [body.assignedTo] : undefined) ||
          (body.assignedToId ? [body.assignedToId] : undefined) ||
          (body.assigned_to_id ? [body.assigned_to_id] : undefined),
        attachments: body.attachments,
      },
    );
    return { success: true, task, message: 'Task created and assigned successfully.' };
  }

  @Put(':id')
  @RequirePermissions('task.edit')
  @ApiOperation({ summary: 'Update task details and reschedule deadline' })
  async updateTask(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.updateTask(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      {
        title: body.title,
        description: body.description,
        category: body.category,
        dueDate: body.due_date || body.dueDate,
        dueTime: body.due_time || body.dueTime,
        reminderOffsetMinutes:
          body.reminder_offset_minutes !== undefined
            ? Number(body.reminder_offset_minutes)
            : body.reminderOffsetMinutes !== undefined
            ? Number(body.reminderOffsetMinutes)
            : undefined,
        priority: body.priority,
        status: body.status,
      },
      req.user,
    );
    return { success: true, task, message: 'Task updated successfully.' };
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Assignee accepts assigned task' })
  async acceptTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.acceptTask(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      req.user,
    );
    return { success: true, task, message: 'Task accepted.' };
  }

  @Post(':id/progress')
  @RequirePermissions('task.update_progress')
  @ApiOperation({ summary: 'Update task progress percentage (0-100%) and add progress comment' })
  async updateProgress(@Param('id') id: string, @Body() body: { progress: number; comment?: string }, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.updateProgress(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      {
        progress: Number(body.progress),
        comment: body.comment,
      },
      req.user,
    );
    return { success: true, task, message: 'Progress updated successfully.' };
  }

  @Post(':id/complete')
  @RequirePermissions('task.complete')
  @ApiOperation({ summary: 'Confirm and mark assigned task as completed' })
  async completeTask(@Param('id') id: string, @Body() body: { comment?: string }, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.completeTask(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body?.comment,
      req.user,
    );
    return { success: true, task, message: 'Task completed successfully.' };
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reopen completed or cancelled task' })
  async reopenTask(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.reopenTask(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body?.reason,
      req.user,
    );
    return { success: true, task, message: 'Task reopened successfully.' };
  }

  @Post(':id/send-reminder')
  @RequirePermissions('task.send_reminder')
  @ApiOperation({ summary: 'Assignor dispatches manual follow-up reminder to assignee' })
  async sendManualReminder(@Param('id') id: string, @Body() body: { message?: string }, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const result = await this.employeeTasksService.sendManualReminder(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body?.message,
      req.user,
    );
    return result;
  }

  @Post(':id/request-extension')
  @ApiOperation({ summary: 'Assignee requests deadline extension' })
  async requestExtension(
    @Param('id') id: string,
    @Body() body: { proposedDate: string; reason: string },
    @Request() req: any,
  ) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.requestExtension(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body,
      req.user,
    );
    return { success: true, task, message: 'Extension requested successfully.' };
  }

  @Post(':id/decide-extension')
  @ApiOperation({ summary: 'Assignor or Administrator decides (approves/rejects) deadline extension' })
  async decideExtension(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; decisionComment?: string },
    @Request() req: any,
  ) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.decideExtension(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body,
      req.user,
    );
    return {
      success: true,
      task,
      message: body.action === 'APPROVE' ? 'Deadline extension approved.' : 'Deadline extension rejected.',
    };
  }

  @Post(':id/approve-extension')
  @ApiOperation({ summary: 'Assignor approves deadline extension' })
  async approveExtension(
    @Param('id') id: string,
    @Body() body: { decisionComment?: string },
    @Request() req: any,
  ) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.decideExtension(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      { action: 'APPROVE', decisionComment: body?.decisionComment },
      req.user,
    );
    return { success: true, task, message: 'Deadline extension approved.' };
  }

  @Post(':id/reject-extension')
  @ApiOperation({ summary: 'Assignor rejects deadline extension' })
  async rejectExtension(
    @Param('id') id: string,
    @Body() body: { decisionComment?: string },
    @Request() req: any,
  ) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.decideExtension(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      { action: 'REJECT', decisionComment: body?.decisionComment },
      req.user,
    );
    return { success: true, task, message: 'Deadline extension rejected.' };
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add discussion comment to task' })
  async addComment(@Param('id') id: string, @Body() body: { comment: string }, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const activities = await this.employeeTasksService.addComment(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body?.comment,
      req.user,
    );
    return { success: true, activities, message: 'Comment added.' };
  }

  @Post(':id/cancel')
  @RequirePermissions('task.cancel')
  @ApiOperation({ summary: 'Assignor cancels task' })
  async cancelTask(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userName = req.user?.name || req.user?.displayName;
    const task = await this.employeeTasksService.cancelTask(
      id,
      employeeId,
      userId,
      userName,
      req.user?.tenantId,
      body?.reason,
      req.user,
    );
    return { success: true, task, message: 'Task cancelled.' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  async deleteTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    return this.employeeTasksService.deleteTask(id, employeeId, userId, req.user?.tenantId, req.user);
  }
}
