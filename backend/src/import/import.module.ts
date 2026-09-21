import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { CompaniesModule } from '../companies/companies.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [CompaniesModule, EmployeesModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
