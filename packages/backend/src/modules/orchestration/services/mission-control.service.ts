import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { MissionSession } from '../../../database/entities/mission-session.entity.js';
import { MissionStep } from '../../../database/entities/mission-step.entity.js';
import { PullRequest } from '../../github/github.service.js';
import { SessionLedgerService } from './session-ledger.service.js';
import { QueuePolicyEngine } from './queue-policy-engine.service.js';
import { ConfidenceScorerService } from './confidence-scorer.service.js';
import { HumanOverrideService } from './human-override.service.js';
import { AuditService } from './audit.service.js';
import { OrchestrationGateway } from '../orchestration.gateway.js';
import { RUNBOOKS, validateRunbook } from '../runbooks.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MissionControlService implements OnModuleInit {
  private readonly logger = new Logger(MissionControlService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly ledger: SessionLedgerService,
    @Optional()
    private readonly queueEngine: QueuePolicyEngine,
    @Optional()
    private readonly confidenceScorer: ConfidenceScorerService,
    @Optional()
    private readonly humanOverride: HumanOverrideService,
    @Optional()
    private readonly audit: AuditService,
    @Optional()
    private readonly gateway: OrchestrationGateway,
    @InjectRepository(MissionSession)
    private readonly sessionRepository: Repository<MissionSession>,
    @InjectRepository(MissionStep)
    private readonly stepRepository: Repository<MissionStep>,
  ) {}

  async onModuleInit() {
    await this.recoverSessions();
  }

  async recoverSessions(): Promise<void> {
    this.logger.log('Starting mission session recovery...');
    const activeSessions = await this.sessionRepository.find({
      where: { status: In(['running', 'paused', 'awaiting_human']) }
    });

    for (const session of activeSessions) {
      await this.ledger?.append(session.id, 'recovery', 'system', `System restart recovery. Original status: ${session.status}`);
      if (session.status === 'running') {
        const activeStep = await this.stepRepository.findOne({
          where: { sessionId: session.id, status: 'pending' }
        });
        if (!activeStep) await this.advanceMission(session.id);
      }
    }
  }

  async startMission(pr: any, runbookType: string, mode: string = 'observe'): Promise<MissionSession> {
    if (!validateRunbook(runbookType)) throw new Error(`Invalid runbook type: ${runbookType}`);
    const repository = typeof pr.repository === 'string' ? pr.repository : (pr.repository?.nameWithOwner || pr.repository);

    const session = this.sessionRepository.create({
      id: uuidv4(),
      prNumber: pr.number,
      repository,
      runbookType,
      status: 'running',
      operationMode: mode,
      startedAt: new Date(),
      updatedAt: new Date(),
    });

    const savedSession = await this.sessionRepository.save(session);
    await this.ledger?.append(savedSession.id, 'mission_start', 'system', `Started mission session`, { prTitle: pr.title });
    this.gateway?.broadcastMissionUpdate(savedSession);
    await this.audit?.logAction('mission_start', 'system', 'mission_session', savedSession.id, { runbookType, mode });

    const firstStepDef = RUNBOOKS[runbookType][0];
    await this.createStep(savedSession.id, firstStepDef.role, firstStepDef.name, { action: firstStepDef.action });
    return savedSession;
  }

  async createStep(sessionId: string, role: string, stepName: string, metadata?: any): Promise<MissionStep> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const action = metadata?.action;
    if (action) {
      if (session.operationMode === 'observe' && (action === 'fix' || action === 'merge' || action === 'review')) {
        return this.createSkippedStep(sessionId, role, stepName, 'Blocked by observe mode', metadata);
      }
      if (session.operationMode === 'review-only' && (action === 'fix' || action === 'merge')) {
        return this.createSkippedStep(sessionId, role, stepName, 'Blocked by review-only mode', metadata);
      }
      if (session.operationMode === 'fix-safe' && action === 'merge') {
        return this.createSkippedStep(sessionId, role, stepName, 'Blocked by fix-safe mode', metadata);
      }

      if (this.confidenceScorer && (action === 'fix' || action === 'merge')) {
        const shouldGate = await this.confidenceScorer.shouldGateAction(session.prNumber, session.repository, action);
        if (shouldGate) {
          await this.sessionRepository.update(sessionId, { status: 'awaiting_human', updatedAt: new Date() });
          await this.ledger?.append(sessionId, 'confidence_gate', 'system', `Action ${action} gated due to low confidence`);
          const step = await this.createGatedStep(sessionId, role, stepName, `Gated due to low confidence for ${action}`, metadata);
          if (this.humanOverride) await this.humanOverride.requestOverride(sessionId, `Confidence threshold breach for ${action}`, { action });
          const updatedSession = await this.sessionRepository.findOne({ where: { id: sessionId } });
          this.gateway?.broadcastMissionUpdate(updatedSession);
          return step;
        }
      }
    }

    const step = this.stepRepository.create({ id: uuidv4(), sessionId, role, stepName, status: 'pending', startedAt: new Date(), metadata });
    const savedStep = await this.stepRepository.save(step);
    await this.ledger?.append(sessionId, 'step_start', role, `Started step: ${stepName}`, { stepId: savedStep.id });
    await this.sessionRepository.update(sessionId, { currentRole: role, currentStepId: savedStep.id, updatedAt: new Date() });
    const updatedSession = await this.sessionRepository.findOne({ where: { id: sessionId } });
    this.gateway?.broadcastMissionUpdate(updatedSession);
    return savedStep;
  }

  private async createSkippedStep(sessionId: string, role: string, stepName: string, reason: string, metadata?: any): Promise<MissionStep> {
    const step = this.stepRepository.create({ id: uuidv4(), sessionId, role, stepName, status: 'skipped', startedAt: new Date(), completedAt: new Date(), metadata: { ...metadata, skipReason: reason } });
    const savedStep = await this.stepRepository.save(step);
    await this.ledger?.append(sessionId, 'step_skip', role, `Skipped step: ${stepName}. Reason: ${reason}`);
    setTimeout(() => this.advanceMission(sessionId), 100);
    return savedStep;
  }

  private async createGatedStep(sessionId: string, role: string, stepName: string, reason: string, metadata?: any): Promise<MissionStep> {
    const step = this.stepRepository.create({ id: uuidv4(), sessionId, role, stepName, status: 'awaiting_human', startedAt: new Date(), metadata: { ...metadata, gateReason: reason } });
    return await this.stepRepository.save(step);
  }

  async advanceMission(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId }, relations: ['steps'] });
    if (!session || session.status !== 'running') return;
    const runbook = RUNBOOKS[session.runbookType];
    const completedStepsCount = session.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;

    if (completedStepsCount >= runbook.length) {
      await this.sessionRepository.update(sessionId, { status: 'completed', completedAt: new Date(), updatedAt: new Date() });
      await this.ledger?.append(sessionId, 'mission_complete', 'system', 'Mission completed successfully');
      const updatedSession = await this.sessionRepository.findOne({ where: { id: sessionId } });
      this.gateway?.broadcastMissionUpdate(updatedSession);
      await this.audit?.logAction('mission_complete', 'system', 'mission_session', sessionId, {});
      return;
    }
    const nextStepDef = runbook[completedStepsCount];
    await this.createStep(sessionId, nextStepDef.role, nextStepDef.name, { action: nextStepDef.action });
  }

  async completeStep(stepId: string, status: 'completed' | 'failed' | 'skipped', metadata?: any): Promise<void> {
    const step = await this.stepRepository.findOne({ where: { id: stepId } });
    if (!step) return;
    await this.stepRepository.update(stepId, { status, completedAt: new Date(), metadata: { ...step.metadata, ...metadata } });
    await this.ledger?.append(step.sessionId, 'step_complete', step.role, `Completed step: ${step.stepName}`, { status });
    if (status === 'completed') await this.advanceMission(step.sessionId);
    else if (status === 'failed') {
      await this.sessionRepository.update(step.sessionId, { status: 'failed', failureReason: `Step ${step.stepName} failed`, updatedAt: new Date() });
      await this.ledger?.append(step.sessionId, 'mission_failed', 'system', `Step failed`);
      const updatedSession = await this.sessionRepository.findOne({ where: { id: step.sessionId } });
      this.gateway?.broadcastMissionUpdate(updatedSession);
    }
  }

  async pauseMission(sessionId: string, reason: string): Promise<void> {
    await this.sessionRepository.update(sessionId, { status: 'paused', updatedAt: new Date() });
    await this.ledger?.append(sessionId, 'interruption', 'system', `Mission paused: ${reason}`);
    const updatedSession = await this.sessionRepository.findOne({ where: { id: sessionId } });
    this.gateway?.broadcastMissionUpdate(updatedSession);
    await this.audit?.logAction('mission_pause', 'system', 'mission_session', sessionId, { reason });
  }

  async resumeMission(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, { status: 'running', updatedAt: new Date() });
    await this.ledger?.append(sessionId, 'recovery', 'system', 'Mission resumed');
    const updatedSession = await this.sessionRepository.findOne({ where: { id: sessionId } });
    this.gateway?.broadcastMissionUpdate(updatedSession);
    await this.audit?.logAction('mission_resume', 'system', 'mission_session', sessionId, {});
  }
}
