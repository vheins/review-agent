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

/**
 * AppModule - Root NestJS Module
 * 
 * This is the root module that imports all feature modules and configures
 * global providers, middleware, and other application-wide settings.
 * 
 * Architecture:
 * - Feature modules will be imported here as they are created
 * - Global configuration (ConfigModule, DatabaseModule, LoggerModule)
 * - WebSocket gateway for real-time updates
 * - Guards, interceptors, and filters applied globally
 */
@Module({
  imports: [
    // Core modules
    ConfigModule, // Global configuration with .env support
    DatabaseModule, // TypeORM with SQLite
    LoggerModule, // Custom logger with daily rotation
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    
    // Feature modules
    GitHubModule, // GitHub CLI operations
    AiModule, // AI-powered review operations
    ReviewModule, // Core review orchestration
    MetricsModule, // Metrics and quality scoring
    ComplianceModule, // Compliance reporting
    PullRequestModule, // Pull Request management
    DataExporterModule, // Data exporting
    HealthModule, // Health check
    WebSocketModule, // Real-time updates
    SecurityModule, // Security scanning
    WebhookModule, // GitHub webhooks
    TeamModule, // Team and developer services
    AuditLoggerModule, // Audit logging
    
    // Future feature modules will be added here:
    // PullRequestModule,
    // ReviewModule,
    // MetricsModule,
    // TeamModule,
    // SecurityModule,
    // WebSocketModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
