import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OrchestrationSet } from '../../../database/entities/orchestration-set.entity.js';
import { OrchestrationSetMember } from '../../../database/entities/orchestration-set-member.entity.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * OrchestrationSetService - Service for managing groups of related PRs
 * 
 * This service allows coordinating reviews across multiple related Pull Requests.
 */
@Injectable()
export class OrchestrationSetService {
  private readonly logger = new Logger(OrchestrationSetService.name);

  constructor(
    @InjectRepository(OrchestrationSet)
    private readonly setRepository: Repository<OrchestrationSet>,
    @InjectRepository(OrchestrationSetMember)
    private readonly memberRepository: Repository<OrchestrationSetMember>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new orchestration set
   */
  async createSet(name: string, description: string, prs: { prId: number, dependencyPrId?: number }[] = []): Promise<string> {
    const setId = uuidv4();

    await this.dataSource.transaction(async (manager) => {
      const set = manager.create(OrchestrationSet, {
        id: setId,
        name,
        description,
        status: 'pending',
        createdAt: new Date()
      });
      await manager.save(set);

      for (const pr of prs) {
        const member = manager.create(OrchestrationSetMember, {
          setId,
          prId: pr.prId,
          dependencyPrId: pr.dependencyPrId || null
        });
        await manager.save(member);
      }
    });

    this.logger.log(`Created orchestration set ${name} (${setId}) with ${prs.length} members`);
    return setId;
  }

  /**
   * Get the status of an orchestration set
   */
  async getSetStatus(setId: string): Promise<any> {
    const set = await this.setRepository.findOne({
      where: { id: setId },
      relations: ['members', 'members.pullRequest']
    });

    if (!set) return null;

    const completed = set.members.filter(m => 
      m.pullRequest.status === 'merged' || m.pullRequest.status === 'closed'
    ).length;
    
    const total = set.members.length;

    return {
      ...set,
      completedCount: completed,
      totalCount: total,
      progress: total > 0 ? (completed / total) * 100 : 0
    };
  }

  /**
   * Assign reviewers to all PRs in a set
   */
  async assignReviewersToSet(setId: string, reviewerIds: number[]): Promise<void> {
    const members = await this.memberRepository.find({ where: { setId } });
    
    // This logic might need integration with PullRequestService or TeamService
    // For now, we'll just log it or implement a basic version
    this.logger.log(`Assigning ${reviewerIds.length} reviewers to set ${setId} (${members.length} PRs)`);
    
    // Integration logic would go here
  }
}
