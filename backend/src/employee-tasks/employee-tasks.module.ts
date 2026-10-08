import { Module } from '@nestjs/common';
import { EmployeeTasksService } from './employee-tasks.service';
import { EmployeeTasksController } from './employee-tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule, StorageModule],
  controllers: [EmployeeTasksController],
  providers: [EmployeeTasksService],
  exports: [EmployeeTasksService],
})
export class EmployeeTasksModule {}
