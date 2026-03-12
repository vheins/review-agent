import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OverrideInboxItem } from '../../../database/entities/override-inbox-item.entity.js';
import { MissionControlService } from './mission-control.service.js';
import { OrchestrationGateway } from '../orchestration.gateway.js';
import { AuditService } from './audit.service.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HumanOverrideService {
  private readonly logger = new Logger(HumanOverrideService.name);

  constructor(
    @InjectRepository(OverrideInboxItem)
    private readonly inboxRepository: Repository<OverrideInboxItem>,
    @Optional()
    private readonly missionControl: MissionControlService,
    @Optional()
    private readonly gateway: OrchestrationGateway,
    @Optional()
    private readonly audit: AuditService,
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

    const savedItem = await this.inboxRepository.save(item);
    this.gateway?.broadcastInboxUpdate(savedItem);
    
    return savedItem;
  }

  /**
   * Resolve an inbox item
   */
  async resolveOverride(
    itemId: string,
    resolverId: number,
    action: 'approve' | 'reject' | 'reroute' | 'defer',
    notes?: string
  ): Promise<void> {
    this.logger.log(`Resolving override ${itemId} with action: ${action}`);
    
    const item = await this.inboxRepository.findOne({ 
      where: { id: itemId },
      relations: ['session']
    });

    if (!item) throw new Error(`Inbox item ${itemId} not found`);

    await this.inboxRepository.update(itemId, {
      status: 'resolved',
      resolverId,
      resolutionAction: action,
      resolutionNotes: notes,
      resolvedAt: new Date(),
    });

    const updatedItem = await this.inboxRepository.findOne({ where: { id: itemId } });
    this.gateway?.broadcastInboxUpdate(updatedItem);

    // Audit log
    await this.audit?.logAction('resolve_override', resolverId.toString(), 'inbox_item', itemId, { action, notes }, 'human');

    if (this.missionControl) {
      if (action === 'approve') {
        const session = item.session;
        if (session && session.status === 'awaiting_human') {
          const gatedStep = await (this.missionControl as any).stepRepository.findOne({
            where: { sessionId: session.id, status: 'awaiting_human' }
          });

          if (gatedStep) {
            await this.missionControl.resumeMission(session.id);
            await this.missionControl.completeStep(gatedStep.id, 'completed', { resolvedBy: resolverId, resolution: action });
          }
        }
      } else if (action === 'reject') {
        const session = item.session;
        if (session) {
          await (this.missionControl as any).sessionRepository.update(session.id, {
            status: 'failed',
            failureReason: `Rejected by human: ${notes || 'No reason provided'}`,
            updatedAt: new Date(),
          });
          
          await (this.missionControl as any).ledger.append(
            session.id,
            'mission_failed',
            'human',
            `Mission rejected by operator: ${notes || ''}`
          );
        }
      }
    }
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
