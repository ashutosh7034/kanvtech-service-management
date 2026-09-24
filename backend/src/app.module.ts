import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TimerModule } from './timer/timer.module';
import { SlaModule } from './sla/sla.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { EscalationsModule } from './escalations/escalations.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { FeedbackModule } from './feedback/feedback.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { TicketsModule } from './tickets/tickets.module';
import { ImportModule } from './import/import.module';
import { ReportsModule } from './reports/reports.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';
import { ProductsModule } from './products/products.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ImplementationsModule } from './implementations/implementations.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    StorageModule,
    NotificationsModule,
    TimerModule,
    SlaModule,
    AssignmentsModule,
    EscalationsModule,
    ApprovalsModule,
    FeedbackModule,
    CompaniesModule,
    EmployeesModule,
    TicketsModule,
    ProductsModule,
    SubscriptionsModule,
    ImplementationsModule,
    ImportModule,
    ReportsModule,
    JobsModule,
  ],
})
export class AppModule {}
