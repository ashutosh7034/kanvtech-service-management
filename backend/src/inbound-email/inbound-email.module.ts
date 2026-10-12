import { Module } from '@nestjs/common';
import { InboundEmailService } from './inbound-email.service';
import { InboundEmailController } from './inbound-email.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [PrismaModule, NotificationsModule, StorageModule, TicketsModule],
  controllers: [InboundEmailController],
  providers: [InboundEmailService],
  exports: [InboundEmailService],
})
export class InboundEmailModule {}
