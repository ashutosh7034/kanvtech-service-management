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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeTasksService } from './employee-tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Employee Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employee-tasks')
export class EmployeeTasksController {
  constructor(private readonly employeeTasksService: EmployeeTasksService) {}

  private getEmployeeId(req: any): string {
    const eid = req.user?.employeeId;
    if (!eid) {
      throw new ForbiddenException('Employee account required to manage tasks.');
    }
    return eid;
  }

  @Get()
  @ApiOperation({ summary: 'Get my task reminders' })
  async getMyTasks(@Query() query: any, @Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const result = await this.employeeTasksService.getMyTasks(employeeId, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get('reminders')
  @ApiOperation({ summary: 'Get due/overdue task reminders for dashboard' })
  async getDueReminders(@Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const result = await this.employeeTasksService.getDueReminders(employeeId);
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific task by ID' })
  async getTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const task = await this.employeeTasksService.getTaskById(id, employeeId);
    return { success: true, task };
  }

  @Post()
  @ApiOperation({ summary: 'Create a personal task reminder' })
  async createTask(@Body() body: any, @Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const task = await this.employeeTasksService.createTask(employeeId, {
      title: body.title,
      description: body.description,
      dueDate: body.due_date || body.dueDate,
      dueTime: body.due_time || body.dueTime,
      priority: body.priority,
      reminderTime: body.reminder_time || body.reminderTime,
      assignedTo: body.assigned_to || body.assignedTo,
    });
    return { success: true, task, message: 'Task reminder created successfully.' };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a task reminder' })
  async updateTask(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const task = await this.employeeTasksService.updateTask(id, employeeId, {
      title: body.title,
      description: body.description,
      dueDate: body.due_date || body.dueDate,
      dueTime: body.due_time || body.dueTime,
      priority: body.priority,
      reminderTime: body.reminder_time || body.reminderTime,
      status: body.status,
    });
    return { success: true, task, message: 'Task updated successfully.' };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a task as completed' })
  async completeTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const task = await this.employeeTasksService.completeTask(id, employeeId);
    return { success: true, task, message: 'Task marked as completed.' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task reminder' })
  async deleteTask(@Param('id') id: string, @Request() req: any) {
    const employeeId = this.getEmployeeId(req);
    const result = await this.employeeTasksService.deleteTask(id, employeeId);
    return { success: true, ...result };
  }
}
