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
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../permissions/permissions.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @RequirePermissions('employee.view')
  @ApiOperation({ summary: 'List employees filtered by level, department, or status' })
  async getEmployees(@Query() query: any, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin && query.tenantId ? query.tenantId : req.user.tenantId || 'KANVTECH';
    const list = await this.employeesService.getEmployees({
      level: query.level,
      status: query.status,
      availability: query.availability,
      department: query.department,
      departmentId: query.departmentId || query.department_id,
      search: query.search,
      tenantId,
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
  async getEmployee(@Param('id') id: string, @Request() req: any) {
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const emp = await this.employeesService.getEmployeeById(id, tenantId);
    if (!emp) {
      return { success: false, error: 'Employee not found' };
    }
    return { success: true, employee: emp };
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('employee.create')
  @ApiOperation({ summary: 'Create a new employee profile and credentials' })
  async createEmployee(@Body() body: any, @Request() req: any) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Authenticated tenant workspace context is required to create employees.');
    }
    const actor = {
      id: req.user?.id || req.user?.userId,
      role: req.user?.role as UserRole,
    };
    const id = await this.employeesService.createEmployee({ ...body, tenantId }, actor);
    return { success: true, employeeId: id, id, message: 'Employee created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('employee.update')
  @ApiOperation({ summary: 'Update employee profile and availability' })
  async updateEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const actor = {
      id: req.user?.id || req.user?.userId,
      role: req.user?.role as UserRole,
    };
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    await this.employeesService.updateEmployee(id, body, actor, tenantId);
    return { success: true, message: 'Employee updated successfully' };
  }

  @Post(':id/promote')
  @Patch(':id/promote')
  @Roles('ADMIN')
  @RequirePermissions('employee.update')
  @ApiOperation({ summary: 'Promote employee to a specific tier or next tier' })
  async promoteEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const actor = {
      id: req.user?.id || req.user?.userId,
      role: req.user?.role as UserRole,
    };
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const updated = await this.employeesService.promoteEmployee(id, body?.level, actor, tenantId);
    return { success: true, employee: updated, message: 'Employee promoted successfully' };
  }

  @Post(':id/demote')
  @Patch(':id/demote')
  @Roles('ADMIN')
  @RequirePermissions('employee.update')
  @ApiOperation({ summary: 'Demote employee to a specific tier or lower tier' })
  async demoteEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const actor = {
      id: req.user?.id || req.user?.userId,
      role: req.user?.role as UserRole,
    };
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const updated = await this.employeesService.demoteEmployee(id, body?.level, actor, tenantId);
    return { success: true, employee: updated, message: 'Employee demoted successfully' };
  }

  @Post(':id/toggle-status')
  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Toggle employee active/inactive status' })
  async toggleStatus(@Param('id') id: string, @Request() req: any) {
    const actor = {
      id: req.user?.id || req.user?.userId,
      role: req.user?.role as UserRole,
    };
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';

    // Verify dynamic activate vs deactivate permission for non-admins
    const isSuperOrAdmin =
      req.user.role === 'ADMIN' ||
      req.user.role === 'SUPER_ADMIN' ||
      req.user.role === 'PLATFORM_INCHARGE' ||
      req.user.isPlatformIncharge;

    if (!isSuperOrAdmin) {
      const targetEmp = await this.employeesService.getEmployeeById(id, tenantId);
      if (!targetEmp) {
        throw new NotFoundException('Employee not found');
      }
      const userPerms = req.user.effectivePermissions || [];
      if (targetEmp.status === 'ACTIVE') {
        if (!userPerms.includes('employee.deactivate')) {
          throw new ForbiddenException("Access denied. You lack the required permission: 'employee.deactivate'");
        }
      } else {
        if (!userPerms.includes('employee.activate')) {
          throw new ForbiddenException("Access denied. You lack the required permission: 'employee.activate'");
        }
      }
    }

    const updated = await this.employeesService.toggleEmployeeStatus(id, actor, tenantId);
    return { success: true, employee: updated, message: `Employee status set to ${updated?.status}` };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions('employee.delete')
  @ApiOperation({ summary: 'Deactivate / delete employee profile' })
  async deleteEmployee(@Param('id') id: string, @Request() req: any) {
    const actor = {
      id: req.user?.id || req.user?.userId,
      role: req.user?.role as UserRole,
    };
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    const res = await this.employeesService.deleteEmployee(id, actor, tenantId);
    return res;
  }

  @Post('attendance/check-in')
  @Roles('MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Employee attendance check-in' })
  async checkIn(@Body() body: any, @Request() req: any) {
    if (req.user?.role === 'ADMIN' || req.user?.role === UserRole.ADMIN) {
      throw new BadRequestException('Super Admin is exempt from attendance check-in. Attendance records are not created for Super Admin accounts.');
    }
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    let employeeId = req.user?.employeeId;
    if (req.user?.role === 'MANAGER' && !employeeId && body.employeeId) {
      employeeId = body.employeeId;
    } else if (!employeeId) {
      throw new ForbiddenException('No active employee profile linked to your user account.');
    }
    const att = await this.employeesService.checkIn({
      employeeId,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
      tenantId,
    });
    return { success: true, attendance: att };
  }

  @Post('attendance/check-out')
  @Roles('MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @ApiOperation({ summary: 'Employee attendance check-out' })
  async checkOut(@Body() body: any, @Request() req: any) {
    if (req.user?.role === 'ADMIN' || req.user?.role === UserRole.ADMIN) {
      throw new BadRequestException('Super Admin is exempt from attendance check-out.');
    }
    const tenantId = req.user.isSuperAdmin ? undefined : req.user.tenantId || 'KANVTECH';
    let employeeId = req.user?.employeeId;
    if (req.user?.role === 'MANAGER' && !employeeId && body.employeeId) {
      employeeId = body.employeeId;
    } else if (!employeeId) {
      throw new ForbiddenException('No active employee profile linked to your user account.');
    }
    await this.employeesService.checkOut({
      employeeId,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
      tenantId,
    });
    return { success: true, message: 'Checked out successfully' };
  }
}
