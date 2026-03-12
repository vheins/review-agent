import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLog } from '../../database/entities/error-log.entity.js';
import { OrchestrationGateway } from '../../modules/orchestration/orchestration.gateway.js';

@Injectable()
export class ErrorLoggerService {
  private readonly logger = new Logger(ErrorLoggerService.name);

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: Repository<ErrorLog>,
    @Optional()
    private readonly gateway: OrchestrationGateway,
  ) {}

  async log(error: any, context: any = {}): Promise<ErrorLog | null> {
    const statusCode = error?.status || error?.statusCode || 500;
    const severity = statusCode >= 500 ? 'critical' : 'error';
    const code = error?.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    const message = error?.message || 'Unexpected error';
    const stackTrace = error?.stack || null;

    this.logger.error(`${code}: ${message}`, stackTrace);

    try {
      const entry = this.errorLogRepository.create({
        code,
        message,
        stackTrace,
        severity,
        context,
        requestPath: context.requestPath || null,
        requestMethod: context.requestMethod || null,
        actorId: context.actorId || null,
        createdAt: new Date(),
      });

      const savedEntry = await this.errorLogRepository.save(entry);

      if (severity === 'critical') {
        this.gateway?.server?.emit('health_alert', {
          code,
          message,
        });
      }

      return savedEntry;
    } catch (e) {
      this.logger.error(`Failed to persist error log: ${e.message}`);
      return null;
    }
  }
}
