import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionLedgerEntry } from '../../../database/entities/session-ledger-entry.entity.js';
import { OrchestrationGateway } from '../orchestration.gateway.js';

@Injectable()
export class SessionLedgerService {
  private readonly logger = new Logger(SessionLedgerService.name);

  constructor(
    @InjectRepository(SessionLedgerEntry)
    private readonly ledgerRepository: Repository<SessionLedgerEntry>,
    @Optional()
    private readonly gateway: OrchestrationGateway,
  ) {}

  /**
   * Append a new entry to the mission ledger
   */
  async append(
    sessionId: string,
    eventType: string,
    actor: string,
    description: string,
    metadata?: any
  ): Promise<SessionLedgerEntry> {
    this.logger.debug(`Appending ledger entry for session ${sessionId}: ${eventType}`);
    
    const entry = this.ledgerRepository.create({
      sessionId,
      eventType,
      actor,
      description,
      metadata,
      timestamp: new Date(),
    });

    const savedEntry = await this.ledgerRepository.save(entry);
    this.gateway?.broadcastLedgerEntry(savedEntry);
    
    return savedEntry;
  }

  /**
   * Get full ledger for a session
   */
  async getLedger(sessionId: string): Promise<SessionLedgerEntry[]> {
    return this.ledgerRepository.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    });
  }
}
