import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditTrail } from '../../database/entities/audit-trail.entity.js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(
    @InjectRepository(AuditTrail)
    private readonly auditRepo: Repository<AuditTrail>,
  ) {}

  async logAction(actionType: string, actorId: string, resourceType: string, resourceId: string, details: any = {}, options: any = {}) {
    const log = this.auditRepo.create({
      id: uuidv4(),
      actionType,
      actorId,
      actorType: options.actorType || 'system',
      resourceType,
      resourceId,
      actionDetails: details,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
    });

    await this.auditRepo.save(log);
    this.logger.log(`Audit: ${actionType} by ${actorId} on ${resourceType}#${resourceId}`);
  }

  async getAuditLogs(filters: any = {}, limit: number = 50, offset: number = 0): Promise<AuditTrail[]> {
    const query = this.auditRepo.createQueryBuilder('audit');

    if (filters.actionType) query.andWhere('audit.actionType = :actionType', { actionType: filters.actionType });
    if (filters.actorId) query.andWhere('audit.actorId = :actorId', { actorId: filters.actorId });
    if (filters.resourceType) query.andWhere('audit.resourceType = :resourceType', { resourceType: filters.resourceType });

    return query
      .orderBy('audit.timestamp', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();
  }
}
