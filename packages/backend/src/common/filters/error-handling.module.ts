import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorLog } from '../../database/entities/error-log.entity.js';
import { ErrorLoggerService } from './error-logger.service.js';
import { OrchestrationModule } from '../../modules/orchestration/orchestration.module.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ErrorLog]),
    OrchestrationModule,
  ],
  providers: [ErrorLoggerService],
  exports: [ErrorLoggerService],
})
export class ErrorHandlingModule {}
