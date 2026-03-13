import { Module } from '@nestjs/common';
import { AiExecutorService } from './ai-executor.service.js';
import { AiFixGeneratorService } from './ai-fix-generator.service.js';
import { GeminiExecutor } from './executors/gemini.executor.js';
import { ConfigModule } from '../../config/config.module.js';
import { CommentParserModule } from '../../common/parser/comment-parser.module.js';

/**
 * AiModule - Module for AI-powered review operations
 * 
 * Provides services for executing reviews and generating fixes.
 * 
 * Requirements: 8.1
 */
@Module({
  imports: [ConfigModule, CommentParserModule],
  providers: [AiExecutorService, AiFixGeneratorService, GeminiExecutor],
  exports: [AiExecutorService, AiFixGeneratorService, GeminiExecutor],
})
export class AiModule {}
