import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Task Allotment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('task-allotment')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get('queue')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get active ticket queue for task allotment' })
  async getQueue(@Query() query: any) {
    const result = await this.assignmentsService.getTaskAllotmentQueue({
      status: query.status,
      priority: query.priority,
      assignedStatus: query.assignedStatus,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { success: true, ...result };
  }

  @Get('eligible-employees')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get active eligible employees with current workload' })
  async getEligibleEmployees() {
    const employees = await this.assignmentsService.getEligibleEmployees();
    return { success: true, employees };
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get task allotment summary stats' })
  async getStats() {
    const stats = await this.assignmentsService.getAllotmentStats();
    return { success: true, stats };
  }

  @Post('assign')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Direct task allotment or reassignment to employee' })
  async assignTicket(@Body() body: any, @Request() req: any) {
    const ticket = await this.assignmentsService.assignTicket({
      ticketId: body.ticketId || body.ticket_id,
      employeeId: body.employeeId || body.employee_id,
      level: body.level,
      assignedByUserId: req.user.userId,
      assignmentType: 'MANUAL',
      notes: body.notes,
    });
    return { success: true, ticket, message: 'Ticket assigned successfully' };
  }
}
