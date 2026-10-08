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

@ApiTags('Employee Tasks / My Tasks')
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
  @ApiOperation({ summary: 'Get personal task reminders with filters and search' })
  async getMyTasks(@Query() query: any, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const result = await this.employeeTasksService.getMyTasks(employeeId, {
      status: query.status,
      filter: query.filter,
      priority: query.priority,
      category: query.category,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get personal task summary metrics for dashboard widget' })
  async getDashboardSummary(@Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const summary = await this.employeeTasksService.getDashboardSummary(employeeId);
    return { success: true, ...summary };
  }

  @Get('eligible-assignees')
  @ApiOperation({ summary: 'Get employees the current user is authorized to assign tasks to' })
  async getEligibleAssignees(@Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    const employees = await this.employeeTasksService.getEligibleAssignees(employeeId, userId, userRole);
    return { success: true, employees };
  }

  @Get('process-reminders')
  @ApiOperation({ summary: 'Trigger reminder sweep immediately (scheduler / test endpoint)' })
  async triggerReminderSweep() {
    const result = await this.employeeTasksService.processDueReminders();
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific personal task by ID' })
  async getTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const task = await this.employeeTasksService.getTaskById(id, employeeId);
    return { success: true, task };
  }

  @Post()
  @ApiOperation({ summary: 'Create a personal or assigned task reminder' })
  async createTask(@Body() body: any, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    const task = await this.employeeTasksService.createTask(employeeId, userId, userRole, {
      title: body.title,
      description: body.description,
      category: body.category,
      dueDate: body.due_date || body.dueDate,
      dueTime: body.due_time || body.dueTime,
      priority: body.priority,
      reminderTime: body.reminder_time || body.reminderTime,
      taskType: body.task_type || body.taskType,
      assignedToIds: body.assigned_to_ids || body.assignedToIds || (body.assigned_to ? [body.assigned_to] : undefined),
      attachments: body.attachments,
    });
    return { success: true, task, message: 'Task created successfully.' };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a personal task reminder' })
  async updateTask(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const task = await this.employeeTasksService.updateTask(id, employeeId, userId, {
      title: body.title,
      description: body.description,
      category: body.category,
      dueDate: body.due_date || body.dueDate,
      dueTime: body.due_time || body.dueTime,
      priority: body.priority,
      reminderTime: body.reminder_time || body.reminderTime,
      status: body.status,
      taskType: body.task_type || body.taskType,
    });
    return { success: true, task, message: 'Task updated successfully.' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a personal task as completed' })
  async completeTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const task = await this.employeeTasksService.completeTask(id, employeeId, userId);
    return { success: true, task, message: 'Task marked as completed.' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a personal task' })
  async deleteTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = await this.getEmployeeId(req);
    const userId = req.user?.userId || req.user?.id;
    const result = await this.employeeTasksService.deleteTask(id, employeeId, userId);
    return { success: true, ...result };
  }
}
