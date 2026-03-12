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
    repository: string,
    type: string,
    content: string,
    importance: number = 1.0,
    metadata?: any
  ): Promise<void> {
    this.logger.debug(`Recording memory for repo ${repository}: ${type}`);
    
    const entry = this.memoryRepository.create({
      repository,
      type,
      content,
      importance,
      metadata,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
    });

    await this.memoryRepository.save(entry);
  }

  /**
   * Recall relevant memory for a repository
   */
  async recallMemory(repository: string, type?: string): Promise<RepositoryMemoryEntry[]> {
    const where: any = { repository };
    if (type) where.type = type;
    
    return this.memoryRepository.find({
      where,
      order: { importance: 'DESC', createdAt: 'DESC' },
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
