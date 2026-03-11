import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLoggerService } from './audit-logger.service.js';
import { AuditTrail } from '../../database/entities/audit-trail.entity.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditTrail]),
  ],
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditLoggerModule {}
