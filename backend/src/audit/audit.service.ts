import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorUserId?: number | null;
    action: string;
    entityType: string;
    entityId: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    tenantId?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: params.actorUserId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: String(params.entityId),
          oldValuesJson: params.oldValues ? JSON.stringify(params.oldValues) : null,
          newValuesJson: params.newValues ? JSON.stringify(params.newValues) : null,
          ipAddress: params.ipAddress || null,
          tenantId: params.tenantId || 'KANVTECH',
        },
      });
    } catch (e: any) {
      this.logger.error(`[Audit Log Error]: ${e.message}`);
    }
  }

  async getLogs(limit = 100, tenantId?: string) {
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }
    return this.prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            role: true,
            isSuperAdmin: true,
            employee: {
              select: {
                id: true,
                name: true,
                designation: true,
                level: true,
              },
            },
          },
        },
      },
    });
  }
}
