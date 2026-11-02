import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { MassUpdateService } from './mass-update.service';
import { ImportController } from './import.controller';
import { CompaniesModule } from '../companies/companies.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [CompaniesModule, EmployeesModule],
  controllers: [ImportController],
  providers: [ImportService, MassUpdateService],
  exports: [ImportService, MassUpdateService],
})
export class ImportModule {}
