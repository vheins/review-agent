import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { PullRequest } from '../github/github.service.js';
import { AiExecutor, AiReviewComment } from './executors/index.js';
import { GeminiExecutor } from './executors/gemini.executor.js';
import { CopilotExecutor } from './executors/copilot.executor.js';
import { KiroExecutor, ClaudeExecutor, CodexExecutor, OpenCodeExecutor } from './executors/others.executor.js';

/**
 * AiExecutorService - Service for AI-powered PR reviews
 * 
 * This service manages different AI executors and provides methods
 * to perform PR reviews and parse AI output.
 * 
 * Features:
 * - Strategy pattern for different AI executors
 * - Output parsing into structured comments
 * - Integration with AppConfigService for executor selection
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
@Injectable()
export class AiExecutorService {
  private readonly logger = new Logger(AiExecutorService.name);
  private readonly executors = new Map<string, AiExecutor>();
  
  // Regex for structured comment formats
  private readonly structuredRegex = /\[File:\s*([^\]]+)\]\s*\[Line:\s*(\d+)\]\s*\[Type:\s*([^\]]+)\]\s*\[Severity:\s*([^\]]+)\]\s*([\s\S]+?)(?=\[File:|$)/gi;
  
  // Regex for suggested fixes in markdown blocks
  private readonly fixRegex = /```(?:suggestion|fix)\s*([\s\S]+?)```/gi;

  constructor(private readonly config: AppConfigService) {
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
      return this.parseOutput(rawOutput);
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
   * Parse AI output into structured comments
   * 
   * @param output - Raw output from AI
   * @returns List of parsed comments
   * 
   * Requirements: 8.5
   */
  parseOutput(output: string): AiReviewComment[] {
    const comments: AiReviewComment[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    this.structuredRegex.lastIndex = 0;

    while ((match = this.structuredRegex.exec(output)) !== null) {
      const filePath = match[1].trim();
      const lineNumber = parseInt(match[2], 10);
      const issueTypeRaw = match[3].trim().toLowerCase();
      const severityRaw = match[4].trim().toLowerCase();
      const fullMessage = match[5].trim();

      // Extract suggested fix if present in the message
      const fixRegexCopy = new RegExp(this.fixRegex);
      const fixMatch = fixRegexCopy.exec(fullMessage);
      const suggestedFix = fixMatch ? fixMatch[1].trim() : undefined;
      const message = fixMatch ? fullMessage.replace(fixRegexCopy, '').trim() : fullMessage;

      comments.push({
        file_path: filePath,
        line_number: lineNumber,
        issue_type: this.normalizeIssueType(issueTypeRaw),
        severity: this.normalizeSeverity(severityRaw),
        message: message,
        suggested_fix: suggestedFix,
        is_auto_fixable: !!suggestedFix
      });
    }

    // Fallback for less structured formats
    if (comments.length === 0) {
      this.parseUnstructured(output, comments);
    }

    return comments;
  }

  /**
   * Normalize issue type string
   */
  private normalizeIssueType(type: string): 'security' | 'quality' | 'style' | 'logic' | 'general' {
    if (['security', 'quality', 'style', 'logic'].includes(type)) {
      return type as any;
    }
    return 'general';
  }

  /**
   * Normalize severity string
   */
  private normalizeSeverity(severity: string): 'error' | 'warning' | 'info' {
    const s = severity.toLowerCase();
    if (s.includes('critical') || s.includes('error') || s.includes('high')) return 'error';
    if (s.includes('warn') || s.includes('medium')) return 'warning';
    return 'info';
  }

  /**
   * Parse unstructured AI output (fallback)
   */
  private parseUnstructured(output: string, comments: AiReviewComment[]): void {
    // Basic markdown list parsing: 1. path/to/file.js:123 - message
    const lineRegex = /(?:\d+\.\s+)?([^:\s\n]+):(\d+)\s*-\s*([^\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = lineRegex.exec(output)) !== null) {
      comments.push({
        file_path: match[1],
        line_number: parseInt(match[2], 10),
        issue_type: 'general',
        severity: 'warning',
        message: match[3].trim(),
        is_auto_fixable: false
      });
    }
  }
}
