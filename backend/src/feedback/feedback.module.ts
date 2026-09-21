import { Global, Module } from '@nestjs/common';
import { FeedbackService } from './feedback.service';

@Global()
@Module({
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
