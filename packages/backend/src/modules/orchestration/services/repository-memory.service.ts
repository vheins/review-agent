import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RepositoryMemoryEntry } from '../../../database/entities/repository-memory-entry.entity.js';

@Injectable()
export class RepositoryMemoryService {
  private readonly logger = new Logger(RepositoryMemoryService.name);

  constructor(
    @InjectRepository(RepositoryMemoryEntry)
    private readonly memoryRepository: Repository<RepositoryMemoryEntry>,
  ) {}

  /**
   * Record a new memory observation
   */
  async recordObservation(
    repositoryId: number,
    memoryType: string,
    content: string,
    importance: number = 1.0,
    metadata?: any
  ): Promise<void> {
    this.logger.debug(`Recording memory for repo ID ${repositoryId}: ${memoryType}`);
    
    const entry = this.memoryRepository.create({
      repositoryId,
      memoryType,
      content,
      importance,
      metadata,
      lastObservedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
    });

    await this.memoryRepository.save(entry);
  }

  /**
   * Recall relevant memory for a repository
   */
  async recallMemory(repositoryId: number, memoryType?: string): Promise<RepositoryMemoryEntry[]> {
    const where: any = { repositoryId };
    if (memoryType) where.memoryType = memoryType;
    
    return this.memoryRepository.find({
      where,
      order: { importance: 'DESC', lastObservedAt: 'DESC' },
    });
  }

  /**
   * Trigger memory decay/cleanup
   */
  async cleanupStaleMemory(): Promise<void> {
    this.logger.log('Cleaning up stale repository memory');
    await this.memoryRepository.delete({
      expiresAt: LessThan(new Date())
    });
  }
}
