import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SlaModule } from '../sla/sla.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployeeTasksModule } from '../employee-tasks/employee-tasks.module';

@Module({
  imports: [PrismaModule, SlaModule, NotificationsModule, EmployeeTasksModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
