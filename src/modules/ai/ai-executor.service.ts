import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { PullRequest } from '../github/github.service.js';
import { AiExecutor, AiReviewComment } from './executors/index.js';
import { GeminiExecutor } from './executors/gemini.executor.js';
import { CopilotExecutor } from './executors/copilot.executor.js';
import { KiroExecutor, ClaudeExecutor, CodexExecutor, OpenCodeExecutor } from './executors/others.executor.js';
import { CommentParserService } from '../../common/parser/comment-parser.service.js';

/**
 * AiExecutorService - Service for AI-powered PR reviews
 * 
 * This service manages different AI executors and provides methods
 * to perform PR reviews and parse AI output.
 * 
 * Features:
 * - Strategy pattern for different AI executors
 * - Output parsing via CommentParserService
 * - Integration with AppConfigService for executor selection
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
@Injectable()
export class AiExecutorService {
  private readonly logger = new Logger(AiExecutorService.name);
  private readonly executors = new Map<string, AiExecutor>();

  constructor(
    private readonly config: AppConfigService,
    private readonly parser: CommentParserService,
  ) {
    this.registerExecutors();
  }

  /**
   * Register all available AI executors
   */
  private registerExecutors(): void {
    const availableExecutors = [
      new GeminiExecutor(),
      new CopilotExecutor(),
      new KiroExecutor(),
      new ClaudeExecutor(),
      new CodexExecutor(),
      new OpenCodeExecutor(),
    ];

    for (const executor of availableExecutors) {
      this.executors.set(executor.name, executor);
    }
    
    this.logger.log(`Registered ${this.executors.size} AI executors: ${Array.from(this.executors.keys()).join(', ')}`);
  }

  /**
   * Execute review for a Pull Request
   * 
   * @param pr - Pull Request to review
   * @param diff - Git diff content
   * @param repoDir - Local repository directory
   * @returns Parsed review comments
   * 
   * Requirements: 8.3, 8.4
   */
  async executeReview(pr: PullRequest, diff: string, repoDir: string): Promise<AiReviewComment[]> {
    try {
      const executor = await this.selectExecutor(pr);
      this.logger.log(`Executing review using ${executor.name} for PR #${pr.number}`);
      
      const rawOutput = await executor.review(pr, diff, repoDir);
      return this.parser.parse(rawOutput) as any;
    } catch (error) {
      this.logger.error(`AI review failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Select the best AI executor based on configuration
   * 
   * @param pr - Pull Request
   * @returns Selected AI executor
   * 
   * Requirements: 8.4
   */
  private async selectExecutor(pr: PullRequest): Promise<AiExecutor> {
    const repoConfig = await this.config.getRepositoryConfig(pr.repository.nameWithOwner);
    const preferred = repoConfig.executor.toLowerCase();
    
    if (this.executors.has(preferred)) {
      return this.executors.get(preferred)!;
    }
    
    this.logger.warn(`Preferred executor '${preferred}' not found, falling back to gemini`);
    return this.executors.get('gemini')!;
  }

  /**
   * Parse AI output into structured comments (Forward to parser service)
   * 
   * @param output - Raw output from AI
   * @returns List of parsed comments
   * 
   * Requirements: 8.5
   */
  parseOutput(output: string): AiReviewComment[] {
    return this.parser.parse(output) as any;
  }
}
