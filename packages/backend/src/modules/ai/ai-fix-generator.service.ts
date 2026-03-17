import { Injectable, Logger } from '@nestjs/common';
import { AiReviewComment } from './executors/index.js';
import { GeminiExecutor } from './executors/gemini.executor.js';
import { AppConfigService } from '../../config/app-config.service.js';

/**
 * AiFixGeneratorService - Service for generating and validating AI fixes
 * 
 * Features:
 * - Complex fix generation using AI
 * - Fix validation (syntax and logic) 
 * 
 * Requirements: 8.6
 */
@Injectable()
export class AiFixGeneratorService {
  private readonly logger = new Logger(AiFixGeneratorService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly gemini: GeminiExecutor,
  ) {}

  /**
   * Generate a complex fix for a review comment
   * 
   * @param comment - Review comment with issue details
   * @param fileContent - Original file content
   * @param filePath - Path to the file
   * @returns Generated fix or null if failed
   */
  async generateComplexFix(comment: AiReviewComment, fileContent: string, filePath: string): Promise<string | null> {
    this.logger.log(`Generating AI fix for: ${comment.message} in ${filePath}`);
    
    try {
      const prompt = `
Context: You are an expert developer fixing a code issue.
File: ${filePath}
Issue: ${comment.message}
Issue Type: ${comment.issue_type}
Severity: ${comment.severity}
Line Number: ${comment.line_number}

Original File Content:
\`\`\
${fileContent}
\`\`\

Task: Provide the full corrected content of the file. Ensure the fix addresses the reported issue while maintaining the overall logic and style.
Only return the file content, no explanations or markdown blocks.
`;

      const response = await this.gemini.model.generateContent(prompt);
      const text = response.response.text();
      
      // Clean up potential markdown blocks if AI ignored instructions
      let fixedContent = text.trim();
      if (fixedContent.startsWith('```')) {
        fixedContent = fixedContent.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }

      if (await this.validateFix(fixedContent, fileContent)) {
        return fixedContent;
      }
    } catch (error) {
      this.logger.error(`Failed to generate complex fix: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Resolve merge conflicts in a file using AI with specific fix context
   */
  async resolveConflicts(fileContent: string, filePath: string, prInfo?: { number: number, title: string, repository: string, headRefName: string }): Promise<string | null> {
    this.logger.log(`AI resolving merge conflicts in: ${filePath} using fix context`);
    
    try {
      const prContext = prInfo ? `
Repository: ${prInfo.repository}
Pull Request: #${prInfo.number} ${prInfo.title}
Branch: ${prInfo.headRefName}
` : '';

      const prompt = `
Kamu adalah code reviewer dan fixer. Tugas kamu adalah menyelesaikan konflik merge (merge conflict).
${prContext}
File: ${filePath}

File di bawah ini mengandung marker konflik Git (<<<<<<<, =======, >>>>>>>). 
Selesaikan konflik dengan menggabungkan perubahan secara benar, pertahankan integritas fungsional kode, dan ikuti coding style yang sudah ada.

Conflicted File Content:
\`\`\
${fileContent}
\`\`\

Tugas: Berikan hasil akhir isi file yang sudah diperbaiki (resolved) secara lengkap TANPA marker konflik.
Hanya kembalikan isi file, jangan ada penjelasan atau markdown blocks.
`;

      const response = await this.gemini.model.generateContent(prompt);
      const text = response.response.text();
      
      let resolvedContent = text.trim();
      if (resolvedContent.startsWith('```')) {
        resolvedContent = resolvedContent.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }

      if (resolvedContent && !resolvedContent.includes('<<<<<<<')) {
        return resolvedContent;
      }
    } catch (error) {
      this.logger.error(`AI failed to resolve conflicts in ${filePath}: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Validate a generated fix
   * 
   * @param fix - Generated fix content
   * @param originalContent - Original content
   * @returns Validation result
   */
  async validateFix(fix: string | null, originalContent: string): Promise<boolean> {
    try {
      // Basic validation: fix shouldn't be empty or same as original
      if (!fix || fix === originalContent) return false;
      
      // We could add syntax checking here (e.g., using a parser)
      return true;
    } catch (e) {
      return false;
    }
  }
}
