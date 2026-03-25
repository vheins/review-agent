import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { PullRequest } from '../github/github.service.js';
import { AiExecutor, AiReviewComment, BaseAiExecutor } from './executors/index.js';
import { GeminiExecutor } from './executors/gemini.executor.js';
import { CopilotExecutor } from './executors/copilot.executor.js';
import { KiroExecutor } from './executors/kiro.executor.js';
import { ClaudeExecutor } from './executors/claude.executor.js';
import { CodexExecutor } from './executors/codex.executor.js';
import { OpenCodeExecutor } from './executors/opencode.executor.js';
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
  async executeReview(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<AiReviewComment[]> {
    try {
      const executor = await this.selectExecutor(pr);
      this.logger.log(`🔍 Starting ${executor.name} review for PR #${pr.number}: "${pr.title}"`);
      this.logger.debug(`📁 Changed files: ${changedFiles.join(', ')}`);

      const startTime = Date.now();
      const rawOutput = await executor.review(pr, changedFiles, repoDir);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      this.logger.log(`✅ ${executor.name} review completed in ${duration}s for PR #${pr.number}`);
      this.logger.debug(`📋 Raw output length: ${rawOutput.length} characters`);

      const comments = this.parser.parse(rawOutput) as any;
      this.logger.log(`📝 Parsed ${comments.length} comments from review`);

      return comments;
    } catch (error) {
      this.logger.error(`❌ AI review failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async executeRaw(pr: PullRequest, changedFiles: string[], repoDir: string): Promise<string> {
    const executor = await this.selectExecutor(pr);
    this.logger.log(`🔍 Starting raw ${executor.name} review for PR #${pr.number}`);

    const startTime = Date.now();
    const output = await executor.review(pr, changedFiles, repoDir);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    this.logger.log(`✅ Raw review completed in ${duration}s (${output.length} chars)`);
    return output;
  }

  async executePrompt(executorName: string, prompt: string, repoDir?: string): Promise<string> {
    const executor = this.executors.get(executorName.toLowerCase()) || this.executors.get('gemini')!;
    this.logger.log(`Executing custom prompt using ${executor.name}`);
    if (executor instanceof BaseAiExecutor) {
      const cwd = repoDir || process.cwd();
      const anyExec = executor as any;
      
      switch (executor.name) {
        case 'opencode':
          return anyExec.execCli('opencode', ['run', prompt], { cwd, allowFail: true });
        case 'kiro':
          return anyExec.execCli('kiro-cli', ['chat', '--no-interactive', '--trust-all-tools'], { cwd, input: prompt });
        case 'claude':
          return anyExec.execCli('claude', ['-p', prompt, '--output-format', 'text', '--dangerously-skip-permissions'], { cwd });
        case 'codex':
          return anyExec.execCli('codex', ['exec', '-', '--dangerously-bypass-approvals-and-sandbox'], { cwd, input: prompt });
        case 'copilot':
          return anyExec.execCli('copilot', ['--yolo', '--allow-all-tools'], { cwd, input: prompt });
        case 'gemini':
        default:
          return anyExec.execCli(executor.name, ['--yolo'], { cwd, input: prompt });
      }
    }
    throw new Error(`Executor ${executorName} does not support raw prompts`);
  }

  /**
   * Generate high-level insights for a Tech Lead
   */
  async generateLeadInsights(pr: PullRequest, diff: string): Promise<{ summary: string; risk: number; impact: number; category: string }> {
    try {
      const prompt = `As a Technical Lead, analyze this PR and provide:
1. A 2-sentence executive summary.
2. A risk score (0-100) based on complexity and potential breakage.
3. An impact score (0-100) based on how much it changes the system.
4. A category (feature, bugfix, refactor, security, chore).

PR Title: ${pr.title}
Diff:
${diff.slice(0, 5000)}

Return JSON: { "summary": "...", "risk": 0, "impact": 0, "category": "..." }`;

      const text = await this.executePrompt('gemini', prompt);
      const jsonStr = text.match(/\{.*\}/s)?.[0];
      
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
      
      return {
        summary: 'Failed to generate summary',
        risk: 50,
        impact: 50,
        category: 'unknown'
      };
    } catch (error) {
      this.logger.error(`Lead insights failed: ${error.message}`);
      return {
        summary: 'Error generating insights',
        risk: 0,
        impact: 0,
        category: 'error'
      };
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
