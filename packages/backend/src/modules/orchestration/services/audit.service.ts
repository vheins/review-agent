import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditTrail } from '../../../database/entities/audit-trail.entity.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditTrail)
    private readonly auditRepository: Repository<AuditTrail>,
  ) {}

  /**
   * Log an audited action
   */
  async logAction(
    actionType: string,
    actorId: string,
    resourceType: string,
    resourceId: string,
    details: any,
    actorType: string = 'system'
  ): Promise<void> {
    this.logger.debug(`Audit: ${actorType} ${actionType} on ${resourceType}:${resourceId}`);
    
    const entry = this.auditRepository.create({
      actionType,
      actorType,
      actorId,
      resourceType,
      resourceId,
      actionDetails: details,
      timestamp: new Date(),
    });

    await this.auditRepository.save(entry);
  }
}
