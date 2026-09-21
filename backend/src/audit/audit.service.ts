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
        },
      });
    } catch (e: any) {
      this.logger.error(`[Audit Log Error]: ${e.message}`);
    }
  }

  async getLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }
}
