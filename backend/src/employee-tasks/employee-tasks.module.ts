import { Module } from '@nestjs/common';
import { EmployeeTasksService } from './employee-tasks.service';
import { EmployeeTasksController } from './employee-tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [EmployeeTasksController],
  providers: [EmployeeTasksService],
  exports: [EmployeeTasksService],
})
export class EmployeeTasksModule {}
