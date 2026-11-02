import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';

@ApiTags('Platform Administration')
@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
@ApiBearerAuth()
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get global platform statistics (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Platform statistics returned' })
  @ApiResponse({ status: 403, description: 'Forbidden: Tenant administrators cannot access platform administration' })
  async getOverview() {
    return this.platformService.getOverview();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenant companies on the platform' })
  @ApiResponse({ status: 200, description: 'Tenants listed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Access denied' })
  async getAllTenants() {
    return this.platformService.getAllTenants();
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant details by ID' })
  async getTenantById(@Param('id') id: string) {
    return this.platformService.getTenantById(id);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a new tenant company workspace' })
  async createTenant(
    @Body()
    dto: {
      name: string;
      code: string;
      domain?: string;
      adminEmail: string;
      adminName?: string;
      password?: string;
      adminPassword?: string;
    },
    @Request() req: any,
  ) {
    const actorUserId = req?.user?.userId || req?.user?.id || 1;
    return this.platformService.createTenant(dto, actorUserId);
  }

  @Post('tenants/:id/reset-admin-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset administrator password for a tenant workspace' })
  async resetTenantAdminPassword(
    @Param('id') id: string,
    @Body() body: { newPassword?: string },
    @Request() req: any,
  ) {
    const actorUserId = req?.user?.userId || req?.user?.id || 1;
    return this.platformService.resetTenantAdminPassword(id, body?.newPassword, actorUserId);
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: 'Activate or suspend a tenant company workspace' })
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' },
    @Request() req: any,
  ) {
    const actorUserId = req?.user?.userId || req?.user?.id || 1;
    return this.platformService.updateTenantStatus(id, body.status, actorUserId);
  }
}
