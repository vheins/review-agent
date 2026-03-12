import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  PullRequest,
  Review,
  Comment,
  ReviewMetrics,
  RepositoryConfig,
  DeveloperMetrics,
  SecurityFinding,
  Checklist,
  ChecklistItem,
  ReviewChecklist,
  AuditTrail,
  MissionSession,
  MissionStep,
  QueueScore,
  SessionLedgerEntry,
  OverrideInboxItem,
  RepositoryMemoryEntry,
  FocusWindow,
} from './entities/index.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DatabaseModule - TypeORM Configuration Module
 * 
 * This module configures TypeORM with SQLite driver for the application.
 * It uses async configuration to access environment variables through ConfigService.
 * 
 * Configuration:
 * - Database: SQLite (data/pr-review.db)
 * - Synchronize: Enabled in development mode for auto-schema sync
 * - Logging: Enabled for database queries in development
 * - Entities: Auto-loaded from database/entities directory
 * - Repositories: All entities registered via forFeature for dependency injection
 * 
 * Requirements: 2.1, 2.3, 2.4, 2.6
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get('NODE_ENV') !== 'production';
        const baseDir = process.cwd().includes('packages/backend') ? path.resolve(process.cwd(), '../../') : process.cwd();
        const dbPath = path.resolve(baseDir, 'data', 'pr-review.db');

        return {
          type: 'sqlite',
          database: dbPath,
          entities: [
            PullRequest,
            Review,
            Comment,
            ReviewMetrics,
            RepositoryConfig,
            DeveloperMetrics,
            SecurityFinding,
            Checklist,
            ChecklistItem,
            ReviewChecklist,
            AuditTrail,
            MissionSession,
            MissionStep,
            QueueScore,
            SessionLedgerEntry,
            OverrideInboxItem,
            RepositoryMemoryEntry,
            FocusWindow,
          ],
          synchronize: isDevelopment, // Auto-sync schema in development
          logging: isDevelopment ? ['query', 'error', 'warn'] : ['error'], // Log queries in development
          autoLoadEntities: false, // Use explicit entity list instead
        };
      },
    }),
    // Register all entities for repository injection
    TypeOrmModule.forFeature([
      PullRequest,
      Review,
      Comment,
      ReviewMetrics,
      RepositoryConfig,
      DeveloperMetrics,
      SecurityFinding,
      Checklist,
      ChecklistItem,
      ReviewChecklist,
      AuditTrail,
      MissionSession,
      MissionStep,
      QueueScore,
      SessionLedgerEntry,
      OverrideInboxItem,
      RepositoryMemoryEntry,
      FocusWindow,
    ]),
  ],
  exports: [TypeOrmModule], // Export TypeOrmModule so other modules can inject repositories
})
export class DatabaseModule {}
