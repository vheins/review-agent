import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import appConfig from './app.config';
import reviewConfig from './review.config';
import aiExecutorConfig from './ai-executor.config';
import databaseConfig from './database.config';
import { validationSchema } from './validation.schema';
import { AppConfigService } from './app-config.service.js';
import { RepositoryConfig } from '../database/entities/repository-config.entity.js';

/**
 * ConfigModule - Application Configuration Module
 * 
 * This module configures the NestJS ConfigModule to load environment variables
 * from .env file and make them available throughout the application.
 * 
 * Features:
 * - Loads .env file from project root
 * - Makes ConfigService available globally
 * - Validates required environment variables using Joi schema
 * - Provides typed configuration objects via factory functions
 * - Provides AppConfigService for repository-specific configuration overrides
 * 
 * Configuration Namespaces:
 * - app: General application settings (port, intervals, workspace)
 * - review: Review settings (mode, severity scoring)
 * - aiExecutor: AI executor settings (Gemini, Copilot, Kiro, etc.)
 * - database: Database connection settings
 * 
 * Usage:
 * ```typescript
 * constructor(private appConfig: AppConfigService) {}
 * 
 * const port = this.appConfig.get<number>('app.apiPort');
 * const repoConfig = await this.appConfig.getRepositoryConfig('owner/repo');
 * ```
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // Make ConfigService available globally
      envFilePath: path.resolve(process.cwd(), '.env'),
      ignoreEnvFile: process.env.NODE_ENV === 'production', // Don't load .env in production
      cache: true, // Cache environment variables for performance
      validationSchema, // Validate environment variables at startup
      validationOptions: {
        allowUnknown: true, // Allow unknown environment variables
        abortEarly: false, // Validate all fields and return all errors
      },
      load: [
        appConfig,
        reviewConfig,
        aiExecutorConfig,
        databaseConfig,
      ],
    }),
    // Import TypeOrmModule to inject RepositoryConfig repository
    TypeOrmModule.forFeature([RepositoryConfig]),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
