import { Module } from '@nestjs/common';
import { ImplementationsController } from './implementations.controller';
import { ImplementationsService } from './implementations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ImplementationsController],
  providers: [ImplementationsService],
  exports: [ImplementationsService],
})
export class ImplementationsModule {}
