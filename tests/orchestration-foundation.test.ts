import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.setConfig({ hookTimeout: 60000 });
import * as fc from 'fast-check';
import {
  MissionSession,
  MissionStep,
  SessionLedgerEntry,
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
  QueueScore,
  OverrideInboxItem,
  RepositoryMemoryEntry,
  FocusWindow,
} from '../packages/backend/src/database/entities/index.js';
import { MissionControlService } from '../packages/backend/src/modules/orchestration/services/mission-control.service.js';
import { SessionLedgerService } from '../packages/backend/src/modules/orchestration/services/session-ledger.service.js';
import { QueuePolicyEngine } from '../packages/backend/src/modules/orchestration/services/queue-policy-engine.service.js';

describe('Orchestration Foundation', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let missionControl: MissionControlService;
  let ledger: SessionLedgerService;
  let prRepository: Repository<PullRequest>;
  let sessionRepository: Repository<MissionSession>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
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
          synchronize: true,
          logging: false,
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
        ]),
      ],
      providers: [
        MissionControlService,
        SessionLedgerService,
        QueuePolicyEngine,
      ],
    }).compile();

    dataSource = module.get(DataSource);
    missionControl = module.get(MissionControlService);
    ledger = module.get(SessionLedgerService);
    prRepository = module.get(getRepositoryToken(PullRequest));
    sessionRepository = module.get(getRepositoryToken(MissionSession));

    // Create a mock PR
    const pr = prRepository.create({
      number: 1,
      title: 'Test PR',
      author: 'testuser',
      repository: 'test/repo',
      branch: 'main',
      baseBranch: 'main',
      status: 'open',
      url: 'https://github.com/test/repo/pull/1',
      isDraft: false,
      labels: [],
    });
    await prRepository.save(pr);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Mission Session Creation', () => {
    it('should create a new mission session and append start event to ledger', async () => {
      const pr = {
        number: 1,
        title: 'Test PR',
        repository: { nameWithOwner: 'test/repo' },
        url: 'https://github.com/test/repo/pull/1',
        updatedAt: new Date().toISOString(),
        state: 'open',
        author: { login: 'testuser' }
      } as any;

      const session = await missionControl.startMission(pr, 'review-only');

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.prNumber).toBe(1);
      expect(session.status).toBe('running');

      const ledgerEntries = await ledger.getLedger(session.id);
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].eventType).toBe('mission_start');
    }, 60000);
  });

  describe('Mission Step Lifecycle', () => {
    it('should track step start and completion', async () => {
      const pr = await prRepository.findOne({ where: { number: 1 } });
      const session = await missionControl.startMission(pr as any, 'review-only');

      const step = await missionControl.createStep(session.id, 'Scout', 'Analyze Changes');
      expect(step.status).toBe('pending');

      const updatedSession = await sessionRepository.findOne({ where: { id: session.id } });
      expect(updatedSession?.currentRole).toBe('Scout');
      expect(updatedSession?.currentStepId).toBe(step.id);

      await missionControl.completeStep(step.id, 'completed', { filesCount: 5 });
      
      const ledgerEntries = await ledger.getLedger(session.id);
      expect(ledgerEntries.some(e => e.eventType === 'step_complete')).toBe(true);
    }, 60000);
  });

  describe('Property: Ledger Ordering Integrity', () => {
    it('should maintain chronological order of ledger entries', async () => {
      const pr = await prRepository.findOne({ where: { number: 1 } });
      const session = await missionControl.startMission(pr as any, 'review-only');

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: fc.string({ minLength: 1 }),
              actor: fc.string({ minLength: 1 }),
              description: fc.string({ minLength: 1 }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (events) => {
            for (const event of events) {
              await ledger.append(session.id, event.type, event.actor, event.description);
            }

            const entries = await ledger.getLedger(session.id);
            
            // Verify order by ID (since we use autoincrement ID and sequential saves)
            for (let i = 1; i < entries.length; i++) {
              expect(entries[i].id).toBeGreaterThan(entries[i-1].id);
              expect(entries[i].timestamp.getTime()).toBeGreaterThanOrEqual(entries[i-1].timestamp.getTime());
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 60000);
  });
});
