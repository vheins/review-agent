import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueScore } from '../../../database/entities/queue-score.entity.js';
import { PullRequest } from '../../../database/entities/pull-request.entity.js';
import { RepositoryConfig } from '../../../database/entities/repository-config.entity.js';
import { RepositoryMemoryService } from './repository-memory.service.js';
import { OrchestrationGateway } from '../orchestration.gateway.js';

@Injectable()
export class QueuePolicyEngine {
  private readonly logger = new Logger(QueuePolicyEngine.name);

  constructor(
    @InjectRepository(QueueScore)
    private readonly scoreRepository: Repository<QueueScore>,
    @InjectRepository(RepositoryConfig)
    private readonly configRepository: Repository<RepositoryConfig>,
    @InjectRepository(PullRequest)
    private readonly prRepository: Repository<PullRequest>,
    @Optional()
    private readonly memoryService: RepositoryMemoryService,
    @Optional()
    private readonly gateway: OrchestrationGateway,
  ) {}

  /**
   * Calculate and persist the score for a single PR
   */
  async calculateScore(pr: any): Promise<QueueScore> {
    this.logger.debug(`Calculating queue score for PR #${pr.number}`);
    
    const repository = typeof pr.repository === 'string' ? pr.repository : (pr.repository?.nameWithOwner || pr.repository);
    const config = await this.configRepository.findOne({ where: { repository } });
    const weights = config?.queueWeights || {};
    
    const updatedAt = new Date(pr.updated_at || pr.updatedAt);
    const ageInHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
    const rawFactorAge = Math.min(20, (ageInHours / 168) * 20);
    const factorAge = rawFactorAge * (weights.age ?? 1.0);

    let rawFactorSla = 0;
    const category = (pr.pr_category || pr.category || '').toLowerCase();
    if (category === 'security') rawFactorSla = 30;
    else if (category === 'bugfix') rawFactorSla = 15;
    const factorSla = rawFactorSla * (weights.sla ?? 1.0);

    const rawFactorSeverity = (pr.risk_score || 0) * 0.2;
    const factorSeverity = rawFactorSeverity * (weights.severity ?? 1.0);

    const isBlocking = pr.labels?.some((l: any) => 
      (typeof l === 'string' ? l : l.name).toLowerCase().includes('blocking')
    );
    const rawFactorBlocking = isBlocking ? 25 : 0;
    const factorBlocking = rawFactorBlocking * (weights.blocking ?? 1.0);

    const rawFactorCriticality = (config?.criticality ?? 1.0) * 10;
    const factorCriticality = rawFactorCriticality * (weights.criticality ?? 1.0);

    const health = pr.health_score || 100;
    const rawFactorHealth = (100 - health) * 0.25;
    const factorHealth = rawFactorHealth * (weights.health ?? 1.0);

    let rawFactorMemory = 0;
    if (this.memoryService) {
      const memories = await this.memoryService.recallMemory(repository);
      const highImportanceMemory = memories.filter(m => m.importance > 0.8);
      rawFactorMemory = Math.min(15, highImportanceMemory.length * 5);
    }
    const factorMemory = rawFactorMemory * (weights.memory ?? 1.0);

    const totalScore = factorAge + factorSla + factorSeverity + factorBlocking + factorCriticality + factorHealth + factorMemory;

    let score = await this.scoreRepository.findOne({ where: { prNumber: pr.number, repository } });
    if (!score) {
      score = this.scoreRepository.create({
        prNumber: pr.number,
        repository,
      });
    }

    score.totalScore = totalScore;
    score.factorAge = factorAge;
    score.factorSla = factorSla;
    score.factorSeverity = factorSeverity;
    score.factorBlocking = factorBlocking;
    score.factorCriticality = factorCriticality;
    score.factorHealth = factorHealth;
    score.factorMemory = factorMemory;
    score.calculatedAt = new Date();

    const savedScore = await this.scoreRepository.save(score);
    
    // Broadcast queue update
    const queue = await this.getQueue(repository);
    this.gateway?.broadcastQueueUpdate({ repository, queue });

    return savedScore;
  }

  async reScoreAll(repository?: string): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Re-scoring all PRs${repository ? ` for repository ${repository}` : ''}`);
    
    const openPRs = await this.prRepository.find({
      where: repository ? { repository, status: 'open' } : { status: 'open' }
    });

    for (const pr of openPRs) {
      await this.calculateScore(pr);
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Re-scoring completed in ${duration}ms for ${openPRs.length} PRs`);
    
    if (duration > 1000) {
      this.logger.warn(`Queue re-scoring took longer than 1s: ${duration}ms`);
    }
  }

  async getQueue(repository?: string): Promise<QueueScore[]> {
    return this.scoreRepository.find({
      where: repository ? { repository } : {},
      order: { totalScore: 'DESC' },
      relations: ['pullRequest'],
    });
  }
}
