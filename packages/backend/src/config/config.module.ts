import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import appConfig from './app.config.js';
import reviewConfig from './review.config.js';
import aiExecutorConfig from './ai-executor.config.js';
import databaseConfig from './database.config.js';
import { validationSchema } from './validation.schema.js';
import { AppConfigService } from './app-config.service.js';
import { ConfigController } from './config.controller.js';
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
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // Make ConfigService available globally
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '../../../.env'),
      ],
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
  controllers: [ConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
