import {
  Controller,
  Get,
  Post,
  Put,
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
      search: query.search,
    });
    return { success: true, employees: list, data: list };
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
    const id = await this.employeesService.createEmployee(body, req.user.userId);
    return { success: true, employeeId: id, id, message: 'Employee created successfully' };
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update employee profile and availability' })
  async updateEmployee(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    await this.employeesService.updateEmployee(id, body, req.user.userId);
    return { success: true, message: 'Employee updated successfully' };
  }

  @Post('attendance/check-in')
  @ApiOperation({ summary: 'Employee attendance check-in' })
  async checkIn(@Body() body: any, @Request() req: any) {
    const employeeId = req.user.employeeId || body.employeeId;
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
    const employeeId = req.user.employeeId || body.employeeId;
    await this.employeesService.checkOut({
      employeeId,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
    });
    return { success: true, message: 'Checked out successfully' };
  }
}
