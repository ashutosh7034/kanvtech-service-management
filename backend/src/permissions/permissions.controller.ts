import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Get centralized permission catalog' })
  async getCatalog() {
    return this.permissionsService.getCatalog();
  }

  @Get('my-permissions')
  @ApiOperation({ summary: 'Get effective permissions of the logged-in user' })
  async getMyPermissions(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const tenantId = req.user?.tenantId;
    const permissions = await this.permissionsService.getEffectivePermissions(userId, tenantId);
    return {
      success: true,
      permissions,
      effectivePermissions: permissions,
      count: permissions.length,
    };
  }

  @Get('employees')
  @Roles('ADMIN')
  @RequirePermissions('employee.assign_permissions')
  @ApiOperation({ summary: 'List employees with granted permissions in the tenant workspace' })
  async getEmployeesWithPermissions(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }
    return this.permissionsService.getEmployeesWithPermissions(tenantId);
  }

  @Get('employees/:employeeId')
  @Roles('ADMIN')
  @RequirePermissions('employee.assign_permissions')
  @ApiOperation({ summary: 'Get assigned permissions for an individual employee' })
  async getEmployeePermissions(
    @Param('employeeId') employeeId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }
    return this.permissionsService.getEmployeePermissions(tenantId, employeeId);
  }

  @Put('employees/:employeeId')
  @Roles('ADMIN')
  @RequirePermissions('employee.assign_permissions')
  @ApiOperation({ summary: 'Update granted permissions for an employee' })
  async updateEmployeePermissions(
    @Param('employeeId') employeeId: string,
    @Body() body: { permissionCodes: string[] },
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant workspace context is required.');
    }
    const actorUserId = req.user?.id || req.user?.userId;

    if (!Array.isArray(body?.permissionCodes)) {
      throw new BadRequestException('Invalid payload: permissionCodes array is required.');
    }

    return this.permissionsService.updateEmployeePermissions(
      tenantId,
      employeeId,
      body.permissionCodes,
      actorUserId,
    );
  }
}

