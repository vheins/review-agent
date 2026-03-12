import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';
import { ReviewModule } from '../review/review.module.js';
import { OrchestrationModule } from '../orchestration/orchestration.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ReviewModule, OrchestrationModule, ConfigModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
