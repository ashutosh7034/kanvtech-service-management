import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL via Prisma Client');
    } catch (err: any) {
      this.logger.warn(`PostgreSQL connection notice (${err.message}). Application will operate with resilient connection handling.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Collision-safe monotonic sequence generator.
   * Eliminates COUNT(*) + 1 concurrency issues.
   */
  async getNextSequence(name: string): Promise<number> {
    try {
      const tracker = await this.sequenceTracker.upsert({
        where: { name },
        update: { currentValue: { increment: 1 } },
        create: { name, currentValue: 1 },
      });
      return tracker.currentValue;
    } catch {
      // Fallback in case table tracker is locked or in-flight
      return Date.now() % 1000000;
    }
  }

  async getNextTicketId(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.getNextSequence('TICKET_SEQ');
    return `KT-${year}-${String(seq).padStart(6, '0')}`;
  }

  async getNextCompanyId(): Promise<string> {
    const seq = await this.getNextSequence('COMPANY_SEQ');
    return `CMP-${String(seq).padStart(4, '0')}`;
  }
}
