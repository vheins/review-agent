import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../../../database/entities/comment.entity.js';

@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async syncThreads(reviewId: string, threads: any[]): Promise<void> {
    this.logger.log(`Syncing ${threads.length} threads for review ${reviewId}`);
    
    for (const thread of threads) {
      const existing = await this.commentRepository.findOne({
        where: { githubThreadId: thread.github_thread_id }
      });

      if (existing) {
        await this.commentRepository.update(existing.id, {
          message: thread.body,
          isResolved: thread.is_resolved,
          resolvedAt: thread.is_resolved ? new Date() : null,
        });
      } else {
        const newComment = this.commentRepository.create({
          reviewId,
          githubThreadId: thread.github_thread_id,
          message: thread.body,
          isResolved: thread.is_resolved,
          file: thread.file_path || 'unknown',
          line: thread.line_number || 0,
          severity: 'info',
          category: 'general',
          postedAt: new Date(),
        });
        await this.commentRepository.save(newComment);
      }
    }
  }

  async resolveThread(githubThreadId: string): Promise<void> {
    await this.commentRepository.update({ githubThreadId }, {
      isResolved: true,
      resolvedAt: new Date(),
    });
  }

  async getUnresolvedThreads(reviewId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { reviewId, isResolved: false }
    });
  }
}
