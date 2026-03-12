import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Comment } from '../../../database/entities/comment.entity.js';
import { Review } from '../../../database/entities/review.entity.js';

@Injectable()
export class FalsePositiveService {
  private readonly logger = new Logger(FalsePositiveService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async markFalsePositive(commentId: string, developerId: number, justification: string): Promise<void> {
    this.logger.log(`Marking comment ${commentId} as false positive by dev ${developerId}`);
    
    await this.commentRepository.update(commentId, {
      isFalsePositive: true,
      falsePositiveJustification: justification,
      markedByDeveloperId: developerId,
    });
  }

  async calculateFalsePositiveRates(filters: any = {}) {
    const where: any = {};
    if (filters.startDate && filters.endDate) {
      where.startedAt = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    const reviews = await this.reviewRepository.find({
      where,
      relations: ['comments']
    });

    const ratesByExecutor: Record<string, any> = {};
    const ratesByCategory: Record<string, any> = {};

    for (const review of reviews) {
      const exec = review.executor;
      if (!ratesByExecutor[exec]) ratesByExecutor[exec] = { total: 0, fps: 0 };
      
      for (const comment of review.comments) {
        ratesByExecutor[exec].total++;
        if (comment.isFalsePositive) ratesByExecutor[exec].fps++;

        const cat = comment.category;
        if (!ratesByCategory[cat]) ratesByCategory[cat] = { total: 0, fps: 0 };
        ratesByCategory[cat].total++;
        if (comment.isFalsePositive) ratesByCategory[cat].fps++;
      }
    }

    // Finalize rates
    const executorFinal: Record<string, number> = {};
    for (const exec in ratesByExecutor) {
      executorFinal[exec] = ratesByExecutor[exec].total > 0 
        ? ratesByExecutor[exec].fps / ratesByExecutor[exec].total 
        : 0;
    }

    const categoryFinal: Record<string, number> = {};
    for (const cat in ratesByCategory) {
      categoryFinal[cat] = ratesByCategory[cat].total > 0
        ? ratesByCategory[cat].fps / ratesByCategory[cat].total
        : 0;
    }

    return {
      ratesByExecutor: executorFinal,
      ratesByCategory: categoryFinal
    };
  }
}
