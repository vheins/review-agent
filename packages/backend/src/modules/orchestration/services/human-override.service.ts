import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OverrideInboxItem } from '../../../database/entities/override-inbox-item.entity.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HumanOverrideService {
  private readonly logger = new Logger(HumanOverrideService.name);

  constructor(
    @InjectRepository(OverrideInboxItem)
    private readonly inboxRepository: Repository<OverrideInboxItem>,
  ) {}

  /**
   * Request human intervention
   */
  async requestOverride(
    sessionId: string,
    reason: string,
    metadata?: any
  ): Promise<OverrideInboxItem> {
    this.logger.log(`Requesting human override for session ${sessionId}: ${reason}`);
    
    const item = this.inboxRepository.create({
      id: uuidv4(),
      sessionId,
      reason,
      status: 'pending',
      createdAt: new Date(),
      metadata,
    });

    return await this.inboxRepository.save(item);
  }

  /**
   * Resolve an inbox item
   */
  async resolveOverride(
    itemId: string,
    resolverId: number,
    action: string,
    notes?: string
  ): Promise<void> {
    this.logger.log(`Resolving override ${itemId} with action: ${action}`);
    
    await this.inboxRepository.update(itemId, {
      status: 'resolved',
      resolverId,
      resolutionAction: action,
      resolutionNotes: notes,
      resolvedAt: new Date(),
    });
  }

  /**
   * Get pending items for an operator
   */
  async getPendingItems(): Promise<OverrideInboxItem[]> {
    return this.inboxRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      relations: ['session'],
    });
  }
}
