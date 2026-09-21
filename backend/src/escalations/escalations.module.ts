import { Global, Module } from '@nestjs/common';
import { EscalationsService } from './escalations.service';

@Global()
@Module({
  providers: [EscalationsService],
  exports: [EscalationsService],
})
export class EscalationsModule {}
