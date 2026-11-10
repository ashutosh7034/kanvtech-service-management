import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../permissions/permissions.decorator';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @RequirePermissions('department.view')
  async getDepartments(@Query() query: any, @Req() req: any) {
    return this.departmentsService.getDepartments(query, req.user?.tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  @RequirePermissions('department.view')
  async getDepartmentById(@Param('id') id: string, @Req() req: any) {
    return this.departmentsService.getDepartmentById(id, req.user?.tenantId);
  }

  @Get(':id/employees')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('department.view')
  async getDepartmentEmployees(@Param('id') id: string, @Req() req: any) {
    return this.departmentsService.getDepartmentEmployees(id, req.user?.tenantId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('department.create')
  async createDepartment(@Body() body: any, @Req() req: any) {
    return this.departmentsService.createDepartment(body, req.user?.id || req.user?.userId, req.user?.tenantId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('department.update')
  async updateDepartment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.departmentsService.updateDepartment(id, body, req.user?.id || req.user?.userId, req.user?.tenantId);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  @RequirePermissions('department.update')
  async toggleDepartmentStatus(@Param('id') id: string, @Body() body: { isActive: boolean }, @Req() req: any) {
    return this.departmentsService.toggleDepartmentStatus(id, body.isActive, req.user?.id || req.user?.userId, req.user?.tenantId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermissions('department.delete')
  async deleteDepartment(@Param('id') id: string, @Req() req: any) {
    return this.departmentsService.deleteDepartment(id, req.user?.id || req.user?.userId, req.user?.tenantId);
  }
}
