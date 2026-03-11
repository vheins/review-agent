import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service.js';

/**
 * Logger Module
 * Global module yang menyediakan LoggerService untuk seluruh aplikasi
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
