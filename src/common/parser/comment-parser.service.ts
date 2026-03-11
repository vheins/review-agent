import { Injectable, Logger } from '@nestjs/common';
import stripAnsi from 'strip-ansi';

/**
 * AI Review Comment Interface
 */
export interface ParsedComment {
  file_path: string;
  line_number: number;
  issue_type: 'security' | 'quality' | 'style' | 'logic' | 'general';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggested_fix?: string;
  is_auto_fixable: boolean;
}

/**
 * CommentParserService - Service for parsing AI agent output
 * 
 * Features:
 * - Regex-based structured output parsing
 * - Fallback for unstructured output
 * - Severity and issue type normalization
 * 
 * Requirements: 8.5
 */
@Injectable()
export class CommentParserService {
  private readonly logger = new Logger(CommentParserService.name);

  // Regex for structured comment formats
  private readonly structuredRegex = /\[File:\s*([^\]]+)\]\s*\[Line:\s*(\d+)\]\s*\[Type:\s*([^\]]+)\]\s*\[Severity:\s*([^\]]+)\]\s*([\s\S]+?)(?=\[File:|$)/gi;
  
  // Regex for suggested fixes in markdown blocks
  private readonly fixRegex = /```(?:suggestion|fix)\s*([\s\S]+?)```/gi;

  /**
   * Parse AI output into structured comments
   * 
   * @param output - Raw output from AI
   * @returns List of parsed comments
   */
  parse(output: string): ParsedComment[] {
    const comments: ParsedComment[] = [];
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

  private normalizeIssueType(type: string): 'security' | 'quality' | 'style' | 'logic' | 'general' {
    if (['security', 'quality', 'style', 'logic'].includes(type)) {
      return type as any;
    }
    return 'general';
  }

  private normalizeSeverity(severity: string): 'error' | 'warning' | 'info' {
    const s = severity.toLowerCase();
    if (s.includes('critical') || s.includes('error') || s.includes('high')) return 'error';
    if (s.includes('warn') || s.includes('medium')) return 'warning';
    return 'info';
  }

  private parseUnstructured(output: string, comments: ParsedComment[]): void {
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
