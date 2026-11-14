import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { EmailVerificationModule } from '../email-verification/email-verification.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [EmailVerificationModule, EntitlementsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
