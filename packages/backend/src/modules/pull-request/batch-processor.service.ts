import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PullRequest } from '../../database/entities/pull-request.entity.js';

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);

  constructor(
    @InjectRepository(PullRequest)
    private readonly prRepo: Repository<PullRequest>,
  ) {}

  async groupPRsIntoBatches(repoName: string): Promise<PullRequest[][]> {
    const openPRs = await this.prRepo.find({
      where: { repository: repoName, status: 'open' },
      order: { createdAt: 'ASC' },
    });

    const batches: PullRequest[][] = [];
    const processed = new Set<number>();

    for (const pr of openPRs) {
      if (processed.has(pr.number)) continue;

      const currentBatch = [pr];
      processed.add(pr.number);

      for (const other of openPRs) {
        if (processed.has(other.number)) continue;

        if (this.isRelated(pr, other)) {
          currentBatch.push(other);
          processed.add(other.number);
        }
      }

      batches.push(currentBatch);
    }

    return batches;
  }

  private isRelated(pr1: PullRequest, pr2: PullRequest): boolean {
    // 1. Same base branch
    if (pr1.baseBranch === pr2.baseBranch) return true;

    // 2. Overlapping titles
    const words1 = new Set(pr1.title.toLowerCase().split(/\s+/));
    const words2 = pr2.title.toLowerCase().split(/\s+/);
    const overlap = words2.filter(w => words1.has(w) && w.length > 3);
    
    return overlap.length > 0;
  }
}
