import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { LoggerModule } from './common/logger.module.js';

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
    
    // Feature modules will be added here:
    // PullRequestModule,
    // ReviewModule,
    // GitHubModule,
    // AiModule,
    // MetricsModule,
    // TeamModule,
    // SecurityModule,
    // WebSocketModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
