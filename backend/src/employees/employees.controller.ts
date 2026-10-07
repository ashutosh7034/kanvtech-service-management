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
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'List employees filtered by level, department, or status' })
  async getEmployees(@Query() query: any) {
    const list = await this.employeesService.getEmployees({
      level: query.level,
      status: query.status,
      availability: query.availability,
      department: query.department,
      departmentId: query.departmentId || query.department_id,
      search: query.search,
    });
    return { success: true, employees: list, data: list };
  }

  @Get('level-management/status')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Check if employee level management is enabled' })
  async getLevelManagementStatus() {
    const enabled = await this.employeesService.isLevelManagementEnabled();
    return { success: true, enabled };
  }

  @Post('level-management/toggle')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Enable or disable employee level management' })
  async toggleLevelManagement(@Body() body: { enabled: boolean }, @Request() req: any) {
    await this.employeesService.toggleLevelManagement(body.enabled, req.user?.id || req.user?.userId);
    return { success: true, message: `Employee level management ${body.enabled ? 'enabled' : 'disabled'}` };
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Get employee details and handled tickets' })
  async getEmployee(@Param('id') id: string) {
    const emp = await this.employeesService.getEmployeeById(id);
    if (!emp) {
      return { success: false, error: 'Employee not found' };
    }
    return { success: true, employee: emp };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new employee profile and credentials' })
  async createEmployee(@Body() body: any, @Request() req: any) {
    const id = await this.employeesService.createEmployee(body, req.user?.id || req.user?.userId);
    return { success: true, employeeId: id, id, message: 'Employee created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update employee profile and availability' })
  async updateEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.employeesService.updateEmployee(id, body, req.user?.id || req.user?.userId);
    return { success: true, message: 'Employee updated successfully' };
  }

  @Post(':id/promote')
  @Patch(':id/promote')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Promote employee to a specific tier or next tier' })
  async promoteEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const updated = await this.employeesService.promoteEmployee(id, body?.level, req.user?.id || req.user?.userId);
    return { success: true, employee: updated, message: 'Employee promoted successfully' };
  }

  @Post(':id/demote')
  @Patch(':id/demote')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Demote employee to a specific tier or lower tier' })
  async demoteEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const updated = await this.employeesService.demoteEmployee(id, body?.level, req.user?.id || req.user?.userId);
    return { success: true, employee: updated, message: 'Employee demoted successfully' };
  }

  @Post(':id/toggle-status')
  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Toggle employee active/inactive status' })
  async toggleStatus(@Param('id') id: string, @Request() req: any) {
    const updated = await this.employeesService.toggleEmployeeStatus(id, req.user?.id || req.user?.userId);
    return { success: true, employee: updated, message: `Employee status set to ${updated?.status}` };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate / delete employee profile' })
  async deleteEmployee(@Param('id') id: string, @Request() req: any) {
    const res = await this.employeesService.deleteEmployee(id, req.user?.id || req.user?.userId);
    return res;
  }



  @Post('attendance/check-in')
  @ApiOperation({ summary: 'Employee attendance check-in' })
  async checkIn(@Body() body: any, @Request() req: any) {
    const employeeId = req.user?.employeeId || body.employeeId;
    const att = await this.employeesService.checkIn({
      employeeId,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
    });
    return { success: true, attendance: att };
  }

  @Post('attendance/check-out')
  @ApiOperation({ summary: 'Employee attendance check-out' })
  async checkOut(@Body() body: any, @Request() req: any) {
    const employeeId = req.user?.employeeId || body.employeeId;
    await this.employeesService.checkOut({
      employeeId,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
    });
    return { success: true, message: 'Checked out successfully' };
  }
}
