import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MissionSession } from '../../../database/entities/mission-session.entity.js';
import { MissionStep } from '../../../database/entities/mission-step.entity.js';
import { PullRequest } from '../../github/github.service.js';
import { SessionLedgerService } from './session-ledger.service.js';
import { QueuePolicyEngine } from './queue-policy-engine.service.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MissionControlService {
  private readonly logger = new Logger(MissionControlService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ledger: SessionLedgerService,
    private readonly queueEngine: QueuePolicyEngine,
    @InjectRepository(MissionSession)
    private readonly sessionRepository: Repository<MissionSession>,
    @InjectRepository(MissionStep)
    private readonly stepRepository: Repository<MissionStep>,
  ) {}

  /**
   * Start a new mission session for a PR
   */
  async startMission(pr: PullRequest, runbookType: string, mode: string = 'observe'): Promise<MissionSession> {
    this.logger.log(`Starting mission session for PR #${pr.number} (Runbook: ${runbookType})`);
    
    const session = this.sessionRepository.create({
      id: uuidv4(),
      prNumber: pr.number,
      repository: pr.repository.nameWithOwner,
      runbookType,
      status: 'running',
      operationMode: mode,
      startedAt: new Date(),
      updatedAt: new Date(),
    });

    const savedSession = await this.sessionRepository.save(session);
    
    await this.ledger.append(
      savedSession.id,
      'mission_start',
      'system',
      `Started mission session for PR #${pr.number} with runbook ${runbookType}`,
      { prTitle: pr.title }
    );

    return savedSession;
  }

  /**
   * Create a new mission step
   */
  async createStep(sessionId: string, role: string, stepName: string, metadata?: any): Promise<MissionStep> {
    const step = this.stepRepository.create({
      id: uuidv4(),
      sessionId,
      role,
      stepName,
      status: 'pending',
      startedAt: new Date(),
      metadata,
    });

    const savedStep = await this.stepRepository.save(step);

    await this.ledger.append(
      sessionId,
      'step_start',
      role,
      `Started step: ${stepName}`,
      { stepId: savedStep.id }
    );

    // Update current session state
    await this.sessionRepository.update(sessionId, {
      currentRole: role,
      currentStepId: savedStep.id,
      updatedAt: new Date(),
    });

    return savedStep;
  }

  /**
   * Complete a mission step
   */
  async completeStep(stepId: string, status: 'completed' | 'failed' | 'skipped', metadata?: any): Promise<void> {
    const step = await this.stepRepository.findOne({ where: { id: stepId } });
    if (!step) return;

    await this.stepRepository.update(stepId, {
      status,
      completedAt: new Date(),
      metadata: { ...step.metadata, ...metadata },
    });

    await this.ledger.append(
      step.sessionId,
      'step_complete',
      step.role,
      `Completed step: ${step.stepName} with status ${status}`,
      { stepId, status }
    );
  }

  /**
   * Pause a running mission session
   */
  async pauseMission(sessionId: string, reason: string): Promise<void> {
    this.logger.log(`Pausing mission session ${sessionId}: ${reason}`);
    await this.sessionRepository.update(sessionId, {
      status: 'paused',
      updatedAt: new Date(),
    });

    await this.ledger.append(sessionId, 'interruption', 'system', `Mission paused: ${reason}`);
  }

  /**
   * Resume a paused mission session
   */
  async resumeMission(sessionId: string): Promise<void> {
    this.logger.log(`Resuming mission session: ${sessionId}`);
    await this.sessionRepository.update(sessionId, {
      status: 'running',
      updatedAt: new Date(),
    });

    await this.ledger.append(sessionId, 'recovery', 'system', 'Mission resumed');
  }
}
