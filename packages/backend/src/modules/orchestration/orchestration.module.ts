import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionSession } from '../../database/entities/mission-session.entity.js';
import { MissionStep } from '../../database/entities/mission-step.entity.js';
import { QueueScore } from '../../database/entities/queue-score.entity.js';
import { SessionLedgerEntry } from '../../database/entities/session-ledger-entry.entity.js';
import { OverrideInboxItem } from '../../database/entities/override-inbox-item.entity.js';
import { RepositoryMemoryEntry } from '../../database/entities/repository-memory-entry.entity.js';
import { FocusWindow } from '../../database/entities/focus-window.entity.js';
import { PullRequest } from '../../database/entities/pull-request.entity.js';
import { RepositoryConfig } from '../../database/entities/repository-config.entity.js';
import { Review } from '../../database/entities/review.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { AuditTrail } from '../../database/entities/audit-trail.entity.js';
import { OrchestrationSet } from '../../database/entities/orchestration-set.entity.js';
import { OrchestrationSetMember } from '../../database/entities/orchestration-set-member.entity.js';
import { Export } from '../../database/entities/export.entity.js';

import { MissionControlService } from './services/mission-control.service.js';
import { QueuePolicyEngine } from './services/queue-policy-engine.service.js';
import { SessionLedgerService } from './services/session-ledger.service.js';
import { HumanOverrideService } from './services/human-override.service.js';
import { RepositoryMemoryService } from './services/repository-memory.service.js';
import { ConfidenceScorerService } from './services/confidence-scorer.service.js';
import { FocusWindowSchedulerService } from './services/focus-window-scheduler.service.js';
import { AuditService } from './services/audit.service.js';
import { EscalationService } from './services/escalation.service.js';
import { StuckTaskDetectorService } from './services/stuck-task-detector.service.js';
import { OrchestrationSetService } from './services/orchestration-set.service.js';
import { OrchestrationController } from './orchestration.controller.js';
import { OrchestrationGateway } from './orchestration.gateway.js';
import { NotificationModule } from '../../common/notification/notification.module.js';
import { DataExporterModule } from '../../common/exporter/data-exporter.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MissionSession,
      MissionStep,
      QueueScore,
      SessionLedgerEntry,
      OverrideInboxItem,
      RepositoryMemoryEntry,
      FocusWindow,
      PullRequest,
      RepositoryConfig,
      Review,
      Comment,
      AuditTrail,
      OrchestrationSet,
      OrchestrationSetMember,
      Export,
    ]),
    NotificationModule,
    DataExporterModule,
  ],
  controllers: [OrchestrationController],
  providers: [
    MissionControlService,
    QueuePolicyEngine,
    SessionLedgerService,
    HumanOverrideService,
    RepositoryMemoryService,
    ConfidenceScorerService,
    FocusWindowSchedulerService,
    AuditService,
    EscalationService,
    OrchestrationGateway,
    StuckTaskDetectorService,
    OrchestrationSetService,
  ],
  exports: [
    MissionControlService,
    QueuePolicyEngine,
    SessionLedgerService,
    HumanOverrideService,
    RepositoryMemoryService,
    ConfidenceScorerService,
    FocusWindowSchedulerService,
    AuditService,
    EscalationService,
    OrchestrationGateway,
    StuckTaskDetectorService,
    OrchestrationSetService,
  ],
})
export class OrchestrationModule {}
