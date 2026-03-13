import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { LoggerModule } from './common/logger.module.js';
import { GitHubModule } from './modules/github/github.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { ReviewModule } from './modules/review/review.module.js';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { ComplianceModule } from './modules/compliance/compliance.module.js';
import { PullRequestModule } from './modules/pull-request/pull-request.module.js';
import { DataExporterModule } from './common/exporter/data-exporter.module.js';
import { HealthModule } from './common/health/health.module.js';
import { WebSocketModule } from './modules/websocket/websocket.module.js';
import { SecurityModule } from './modules/security/security.module.js';
import { WebhookModule } from './modules/webhook/webhook.module.js';
import { TeamModule } from './modules/team/team.module.js';
import { AuditLoggerModule } from './common/audit/audit-logger.module.js';
import { ErrorHandlingModule } from './common/filters/error-handling.module.js';
import { NotificationModule } from './common/notification/notification.module.js';
import { ShutdownModule } from './common/shutdown/shutdown.module.js';
import { CleanupModule } from './common/cleanup/cleanup.module.js';
import { QueueModule } from './modules/queue/queue.module.js';

/**
 * AppModule - Root NestJS Module
 */
@Module({
  imports: [
    // Core modules
    ConfigModule,
    DatabaseModule,
    LoggerModule,
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    
    // Feature modules
    GitHubModule,
    AiModule,
    ReviewModule,
    MetricsModule,
    ComplianceModule,
    PullRequestModule,
    DataExporterModule,
    HealthModule,
    WebSocketModule,
    SecurityModule,
    WebhookModule,
    TeamModule,
    AuditLoggerModule,
    ErrorHandlingModule,
    NotificationModule,
    ShutdownModule,
    CleanupModule,
    QueueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
