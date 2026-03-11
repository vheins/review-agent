import { Module } from '@nestjs/common';
import { AiExecutorService } from './ai-executor.service.js';
import { AiFixGeneratorService } from './ai-fix-generator.service.js';
import { ConfigModule } from '../../config/config.module.js';

/**
 * AiModule - Module for AI-powered review operations
 * 
 * Provides services for executing reviews and generating fixes.
 * 
 * Requirements: 8.1
 */
@Module({
  imports: [ConfigModule],
  providers: [AiExecutorService, AiFixGeneratorService],
  exports: [AiExecutorService, AiFixGeneratorService],
})
export class AiModule {}
