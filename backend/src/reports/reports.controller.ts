import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { SlaService } from '../sla/sla.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly slaService: SlaService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get role-scoped executive dashboard and SLA metrics' })
  async getDashboard(@Request() req: any) {
    const metrics = await this.reportsService.getDashboardMetrics(
      req.user.role,
      req.user.userId,
      req.user.employeeId,
      req.user.companyId,
    );
    return { success: true, metrics };
  }

  @Get('resolution-by-level')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get resolution time and session metrics by support level' })
  async getResolutionByLevel() {
    const data = await this.reportsService.getResolutionTimeByLevel();
    return { success: true, data };
  }

  @Get('workload')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get employee workload and resolution performance' })
  async getEmployeeWorkload() {
    const data = await this.reportsService.getEmployeeWorkloadReport();
    return { success: true, data };
  }

  @Get('escalations')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get escalation flow matrix and top escalation reasons' })
  async getEscalationReport() {
    const data = await this.reportsService.getEscalationReport();
    return { success: true, data, ...data };
  }

  @Get('sla')
  @ApiOperation({ summary: 'Get active SLA configuration rules' })
  async getSLASettings() {
    const configs = await this.slaService.getConfigurations();
    return { success: true, configs, configurations: configs };
  }

  @Put('sla')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update SLA configuration for a priority level' })
  async updateSLASettings(@Body() body: any) {
    await this.slaService.updateConfiguration(body.priority, {
      response_time_hours: body.response_time_hours,
      resolution_time_hours: body.resolution_time_hours,
      warning_threshold_percent: body.warning_threshold_percent,
    });
    return { success: true, message: 'SLA configuration updated successfully' };
  }
}
