import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve security and operational audit logs (Admin only)' })
  async getAuditLogs(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(500, Math.max(1, Number(limit) || 100));
    const logs = await this.auditService.getLogs(parsedLimit);

    return {
      success: true,
      logs: logs.map((l) => ({
        id: l.id,
        created_at: l.createdAt,
        actor_email: l.actor?.email || 'System',
        actor_role: l.actor?.role || 'SYSTEM',
        action: l.action,
        entity_type: l.entityType,
        entity_id: l.entityId,
        old_values_json: l.oldValuesJson,
        new_values_json: l.newValuesJson,
        ip_address: l.ipAddress,
      })),
    };
  }
}
