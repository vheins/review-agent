import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Comment } from '../../../database/entities/comment.entity.js';
import { Review } from '../../../database/entities/review.entity.js';

@Injectable()
export class RejectionCategorizerService {
  private readonly logger = new Logger(RejectionCategorizerService.name);
  private readonly categories = {
    security: ['vulnerability', 'auth', 'injection', 'secret', 'security', 'cve'],
    quality: ['complexity', 'style', 'performance', 'refactor', 'quality', 'logic', 'bug', 'error'],
    testing: ['test', 'coverage', 'mock', 'assertion', 'fixture'],
    documentation: ['doc', 'comment', 'readme', 'typing', 'type']
  };

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  categorizeComment(comment: any): string {
    const category = (comment.category || '').toLowerCase();
    const message = (comment.message || '').toLowerCase();
    
    for (const [cat, keywords] of Object.entries(this.categories)) {
      if (keywords.some(kw => category.includes(kw) || message.includes(kw))) {
        return cat;
      }
    }
    
    return 'other';
  }

  categorizeReview(comments: any[]): string[] {
    const reasons = new Set<string>();
    for (const comment of comments) {
      if (['error', 'warning'].includes(comment.severity?.toLowerCase())) {
        reasons.add(this.categorizeComment(comment));
      }
    }
    return Array.from(reasons);
  }

  async getRejectionFrequencies(filters: any = {}) {
    const where: any = {
      status: 'completed'
    };

    if (filters.startDate && filters.endDate) {
      where.startedAt = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    const reviews = await this.reviewRepository.find({
      where,
      relations: ['comments']
    });

    const frequencies: Record<string, number> = {};
    for (const review of reviews) {
      // In a real app, we might check decision like 'REQUEST_CHANGES'
      const reasons = this.categorizeReview(review.comments);
      for (const reason of reasons) {
        frequencies[reason] = (frequencies[reason] || 0) + 1;
      }
    }
    
    return frequencies;
  }
}
