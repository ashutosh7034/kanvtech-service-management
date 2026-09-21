import { Global, Module } from '@nestjs/common';
import { TimerService } from './timer.service';

@Global()
@Module({
  providers: [TimerService],
  exports: [TimerService],
})
export class TimerModule {}
