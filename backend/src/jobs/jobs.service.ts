import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from '../sla/sla.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private slaQueue: Queue | null = null;
  private slaWorker: Worker | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      this.slaQueue = new Queue('sla-monitor', {
        connection: { host: redisHost, port: redisPort, maxRetriesPerRequest: null },
      });

      this.slaWorker = new Worker(
        'sla-monitor',
        async (job) => {
          await this.processSlaCheck();
        },
        { connection: { host: redisHost, port: redisPort, maxRetriesPerRequest: null } },
      );

      this.slaWorker.on('error', (err) => {
        this.logger.debug(`BullMQ Worker notice (${err.message}). Using resilient in-process scheduled processor.`);
      });

      this.logger.log('Initialized Redis + BullMQ SLA background job processor');
    } catch (err: any) {
      this.logger.warn(`Redis not available (${err.message}). Running background SLA checks with internal timer.`);
    }

    // Always run scheduled SLA sweep every 60 seconds
    this.intervalId = setInterval(() => {
      this.processSlaCheck().catch((e) => this.logger.error(`SLA sweep error: ${e.message}`));
    }, 60000);
  }

  async onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.slaWorker) await this.slaWorker.close();
    if (this.slaQueue) await this.slaQueue.close();
  }

  async processSlaCheck() {
    const activeTickets = await this.prisma.ticket.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        createdAt: true,
        slaDeadline: true,
        status: true,
        slaStatus: true,
      },
    });

    for (const ticket of activeTickets) {
      const computed = this.slaService.computeSLAStatus({
        createdAt: ticket.createdAt,
        deadline: ticket.slaDeadline,
        status: ticket.status,
      });

      if (computed.status !== ticket.slaStatus) {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { slaStatus: computed.status },
        });

        if (computed.status === 'BREACHED') {
          this.logger.warn(`[SLA Alert] Ticket ${ticket.id} SLA has breached.`);
        } else if (computed.status === 'WARNING') {
          this.logger.warn(`[SLA Warning] Ticket ${ticket.id} SLA warning threshold (75%) reached.`);
        }
      }
    }
  }
}
