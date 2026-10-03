import { Module } from '@nestjs/common';
import { EmployeeTasksService } from './employee-tasks.service';
import { EmployeeTasksController } from './employee-tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeTasksController],
  providers: [EmployeeTasksService],
  exports: [EmployeeTasksService],
})
export class EmployeeTasksModule {}
