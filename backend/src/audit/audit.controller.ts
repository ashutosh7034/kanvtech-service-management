import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../permissions/permissions.decorator';
import { formatAuditRecord } from './audit-formatter.util';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'EMPLOYEE')
@RequirePermissions('audit_logs.view')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve human-readable security and operational audit trail' })
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('tenantId') queryTenantId?: string,
    @Query('include_raw') includeRaw?: string,
    @Request() req?: any,
  ) {
    const user = req?.user;
    const isPlatformSecurityAdmin = Boolean(
      user?.isSuperAdmin ||
        user?.role === 'SUPER_ADMIN' ||
        user?.role === 'PLATFORM_INCHARGE' ||
        user?.isPlatformIncharge,
    );

    // Tenant Isolation: Non-platform administrators are strictly locked to their own tenant workspace
    const effectiveTenantId = isPlatformSecurityAdmin
      ? queryTenantId || (user?.defaultTenantId ?? user?.tenantId ?? undefined)
      : (user?.tenantId || 'KANVTECH');

    const parsedLimit = Math.min(500, Math.max(1, Number(limit) || 150));
    const logs = await this.auditService.getLogs(parsedLimit, effectiveTenantId);

    // Format logs into sanitized, human-readable records
    const formattedLogs = logs.map((l) =>
      formatAuditRecord(l, {
        allowRawJson: isPlatformSecurityAdmin && includeRaw === 'true',
      }),
    );

    return {
      success: true,
      logs: formattedLogs,
    };
  }
}
