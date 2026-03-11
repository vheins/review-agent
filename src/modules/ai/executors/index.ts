import { PullRequest } from '../../github/github.service.js';

/**
 * AI Review Comment Interface
 */
export interface AiReviewComment {
  file_path: string;
  line_number: number;
  issue_type: 'security' | 'quality' | 'style' | 'logic' | 'general';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggested_fix?: string;
  is_auto_fixable: boolean;
}

/**
 * AI Executor Interface
 */
export interface AiExecutor {
  readonly name: string;
  review(pr: PullRequest, diff: string, repoDir: string): Promise<string>;
}

/**
 * Base AI Executor class
 */
export abstract class BaseAiExecutor implements AiExecutor {
  constructor(public readonly name: string) {}

  abstract review(pr: PullRequest, diff: string, repoDir: string): Promise<string>;

  protected buildReviewPrompt(pr: PullRequest, diff: string): string {
    return `
Review the following Pull Request:
Title: ${pr.title}
Repository: ${pr.repository.nameWithOwner}

Diff:
${diff}

Please provide your review in the following format:
[File: path/to/file] [Line: line_number] [Type: security|quality|style|logic] [Severity: critical|high|medium|low] Message...
    `.trim();
  }
}
