import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  async getDepartments(@Query() query: any) {
    return this.departmentsService.getDepartments(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'L1_EMPLOYEE', 'L2_EMPLOYEE', 'L3_EMPLOYEE')
  async getDepartmentById(@Param('id') id: string) {
    return this.departmentsService.getDepartmentById(id);
  }

  @Get(':id/employees')
  @Roles('ADMIN', 'MANAGER')
  async getDepartmentEmployees(@Param('id') id: string) {
    return this.departmentsService.getDepartmentEmployees(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async createDepartment(@Body() body: any, @Req() req: any) {
    return this.departmentsService.createDepartment(body, req.user?.id || req.user?.userId);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  async updateDepartment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.departmentsService.updateDepartment(id, body, req.user?.id || req.user?.userId);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  async toggleDepartmentStatus(@Param('id') id: string, @Body() body: { isActive: boolean }, @Req() req: any) {
    return this.departmentsService.toggleDepartmentStatus(id, body.isActive, req.user?.id || req.user?.userId);
  }
}
