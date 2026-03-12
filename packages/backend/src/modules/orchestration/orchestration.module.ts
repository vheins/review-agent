import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionSession } from '../../database/entities/mission-session.entity.js';
import { MissionStep } from '../../database/entities/mission-step.entity.js';
import { QueueScore } from '../../database/entities/queue-score.entity.js';
import { SessionLedgerEntry } from '../../database/entities/session-ledger-entry.entity.js';
import { OverrideInboxItem } from '../../database/entities/override-inbox-item.entity.js';
import { RepositoryMemoryEntry } from '../../database/entities/repository-memory-entry.entity.js';
import { FocusWindow } from '../../database/entities/focus-window.entity.js';

import { MissionControlService } from './services/mission-control.service.js';
import { QueuePolicyEngine } from './services/queue-policy-engine.service.js';
import { SessionLedgerService } from './services/session-ledger.service.js';
import { HumanOverrideService } from './services/human-override.service.js';
import { RepositoryMemoryService } from './services/repository-memory.service.js';

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
    ]),
  ],
  providers: [
    MissionControlService,
    QueuePolicyEngine,
    SessionLedgerService,
    HumanOverrideService,
    RepositoryMemoryService,
  ],
  exports: [
    MissionControlService,
    QueuePolicyEngine,
    SessionLedgerService,
    HumanOverrideService,
    RepositoryMemoryService,
  ],
})
export class OrchestrationModule {}
