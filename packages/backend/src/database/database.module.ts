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
  Export,
  ErrorLog,
  Notification,
  Repository,
  CustomRule,
  ReviewTemplate,
  TestRun,
  OrchestrationSet,
  OrchestrationSetMember,
  Job,
} from './entities/index.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DatabaseModule - TypeORM Configuration Module
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
            Export,
            ErrorLog,
            Notification,
            Repository,
            CustomRule,
            ReviewTemplate,
            TestRun,
            OrchestrationSet,
            OrchestrationSetMember,
            Job,
          ],
          synchronize: isDevelopment,
          logging: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
          autoLoadEntities: false,
        };
      },
    }),
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
      Export,
      ErrorLog,
      Notification,
      Repository,
      CustomRule,
      ReviewTemplate,
      TestRun,
      OrchestrationSet,
      OrchestrationSetMember,
      Job,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
