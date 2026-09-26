import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ImplementationsService } from './implementations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Implementations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('implementations')
export class ImplementationsController {
  constructor(private readonly implementationsService: ImplementationsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get summary metrics of new customer implementations' })
  async getStats() {
    const stats = await this.implementationsService.getStats();
    return { success: true, stats };
  }

  @Get()
  @ApiOperation({ summary: 'List implementations with filters and pagination' })
  async getImplementations(@Query() query: any, @Request() req: any) {
    let companyId = query.companyId;
    if (req.user.role === 'CUSTOMER') {
      companyId = req.user.companyId;
    }
    const result = await this.implementationsService.getImplementations({
      companyId,
      productId: query.productId,
      status: query.status,
      ownerEmployeeId: query.ownerEmployeeId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single implementation details by ID' })
  async getImplementation(@Param('id') id: string, @Request() req: any) {
    const imp = await this.implementationsService.getImplementationById(id);
    if (!imp) {
      return { success: false, error: 'Implementation not found' };
    }
    if (req.user.role === 'CUSTOMER' && imp.company_id !== req.user.companyId) {
      return { success: false, error: 'Unauthorized access to implementation record' };
    }
    return { success: true, implementation: imp };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new customer implementation project' })
  async createImplementation(@Body() body: any, @Request() req: any) {
    const imp = await this.implementationsService.createImplementation(body, req.user.userId || req.user.id);
    return { success: true, implementation: imp, message: 'Implementation project created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Update implementation status, milestones, or team progress' })
  async updateImplementation(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const imp = await this.implementationsService.updateImplementation(id, body, req.user.userId || req.user.id);
    return { success: true, implementation: imp, message: 'Implementation project updated successfully' };
  }

  // --- IMPLEMENTATION TASK CHECKLIST ENDPOINTS (Updates #4 & #7) ---

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Get all task checklist items for an implementation project' })
  async getTasks(@Param('id') id: string, @Request() req: any) {
    if (req.user.role === 'CUSTOMER') {
      const imp = await this.implementationsService.getImplementationById(id);
      if (!imp || imp.company_id !== req.user.companyId) {
        return { success: false, error: 'Unauthorized access to implementation tasks' };
      }
    }
    const tasks = await this.implementationsService.getImplementationTasks(id);
    return { success: true, data: tasks, tasks };
  }

  @Post(':id/tasks')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Add a new task checklist item to an implementation' })
  async addTask(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const result = await this.implementationsService.addTask(id, body, req.user.userId || req.user.id);
    return { success: true, ...result, message: 'Task added successfully' };
  }

  @Put('tasks/:taskId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Edit implementation task details' })
  async updateTask(@Param('taskId') taskId: string, @Body() body: any, @Request() req: any) {
    const task = await this.implementationsService.updateTask(taskId, body, req.user.userId || req.user.id);
    return { success: true, task, message: 'Task updated successfully' };
  }

  @Post('tasks/:taskId/toggle')
  @Patch('tasks/:taskId/toggle')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Toggle completion status of a task checklist item' })
  async toggleTask(@Param('taskId') taskId: string, @Body() body: any, @Request() req: any) {
    const isCompleted = body.isCompleted !== undefined ? Boolean(body.isCompleted) : (body.status === 'COMPLETED');
    const result = await this.implementationsService.toggleTaskCompletion(taskId, isCompleted, req.user.userId || req.user.id);
    return { success: true, ...result, message: isCompleted ? 'Task marked as completed' : 'Task reopened' };
  }

  @Post('tasks/:taskId/reopen')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Reopen a completed implementation task' })
  async reopenTask(@Param('taskId') taskId: string, @Request() req: any) {
    const result = await this.implementationsService.toggleTaskCompletion(taskId, false, req.user.userId || req.user.id);
    return { success: true, ...result, message: 'Task reopened successfully' };
  }

  @Delete('tasks/:taskId')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Remove an implementation task' })
  async removeTask(@Param('taskId') taskId: string, @Request() req: any) {
    const result = await this.implementationsService.removeTask(taskId, req.user.userId || req.user.id);
    return { ...result };
  }

  @Post(':id/tasks/reorder')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Reorder tasks for an implementation project' })
  async reorderTasks(@Param('id') id: string, @Body() body: { taskIds: string[] }, @Request() req: any) {
    const tasks = await this.implementationsService.reorderTasks(id, body.taskIds || [], req.user.userId || req.user.id);
    return { success: true, tasks, message: 'Tasks reordered successfully' };
  }
}

