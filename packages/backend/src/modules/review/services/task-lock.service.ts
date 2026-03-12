import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Review } from '../../../database/entities/review.entity.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TaskLockService {
  private readonly logger = new Logger(TaskLockService.name);
  private readonly instanceId = uuidv4();
  private readonly lockTimeoutMs = 60 * 60 * 1000; // 1 hour

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async acquireLock(reviewId: string): Promise<boolean> {
    const timeoutThreshold = new Date(Date.now() - this.lockTimeoutMs);

    const result = await this.reviewRepository.createQueryBuilder()
      .update(Review)
      .set({
        lockOwner: this.instanceId,
        lockTimestamp: new Date(),
      })
      .where('id = :id', { id: reviewId })
      .andWhere('(lock_owner IS NULL OR lock_timestamp < :threshold)', { threshold: timeoutThreshold })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.debug(`Lock acquired for review ${reviewId} by ${this.instanceId}`);
      return true;
    }

    return false;
  }

  async releaseLock(reviewId: string): Promise<void> {
    await this.reviewRepository.update(
      { id: reviewId, lockOwner: this.instanceId },
      { lockOwner: null, lockTimestamp: null }
    );
    this.logger.debug(`Lock released for review ${reviewId} by ${this.instanceId}`);
  }

  async isLockedByMe(reviewId: string): Promise<boolean> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      select: ['lockOwner']
    });
    return !!review && review.lockOwner === this.instanceId;
  }
}
