import { Injectable, Logger } from '@nestjs/common';
import { AiReviewComment } from './executors/index.js';
import { AiExecutorService } from './ai-executor.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import fs from 'fs-extra';
import * as path from 'path';

/**
 * AiFixGeneratorService - Service for generating and validating AI fixes
 */
@Injectable()
export class AiFixGeneratorService {
  private readonly logger = new Logger(AiFixGeneratorService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly aiExecutor: AiExecutorService,
  ) {}

  /**
   * Generate a complex fix for a review comment
   */
  async generateComplexFix(comment: AiReviewComment, fileContent: string, filePath: string, repoDir: string): Promise<string | null> {
    this.logger.log(`Generating AI fix for: ${comment.message} in ${filePath}`);
    
    try {
      const fixPromptContent = await fs.readFile(path.resolve(process.cwd(), '../../context/fix-prompt.md'), 'utf8');
      
      const prompt = `
${fixPromptContent}

Tugas Spesifik: Perbaiki issue berikut pada file.
File: ${filePath}
Issue: ${comment.message}
Issue Type: ${comment.issue_type}
Line Number: ${comment.line_number}

Isi File Asli:
\`\`\`
${fileContent}
\`\`\`

Tugas: Berikan isi file LENGKAP yang sudah diperbaiki.
Hanya kembalikan isi file, jangan ada penjelasan atau markdown blocks.
`;

      // Use actual AI executor
      const repoConfig = await this.config.getRepositoryConfig('');
      const fixedContent = await this.aiExecutor.executePrompt(repoConfig.executor, prompt, repoDir);
      
      let cleanedContent = fixedContent.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }

      if (await this.validateFix(cleanedContent, fileContent)) {
        return cleanedContent;
      }
    } catch (error) {
      this.logger.error(`Failed to generate complex fix: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Resolve merge conflicts in a file using the actual AI model
   */
  async resolveConflicts(fileContent: string, filePath: string, repoDir: string, prInfo?: { number: number, title: string, repository: string, headRefName: string }): Promise<string | null> {
    this.logger.log(`AI resolving merge conflicts in: ${filePath} (workspace: ${repoDir})`);
    
    try {
      const fixPromptContent = await fs.readFile(path.resolve(process.cwd(), '../../context/fix-prompt.md'), 'utf8');
      
      const prompt = `
${fixPromptContent}

Tugas Spesifik: Selesaikan konflik merge pada file berikut.
File: ${filePath}

Isi File dengan Konflik:
\`\`\`
${fileContent}
\`\`\`

Berikan isi file LENGKAP yang sudah diperbaiki tanpa marker konflik. 
PENTING: Jangan tambahkan penjelasan, jangan gunakan markdown wrapper. Hanya kode mentah.
`;

      const repoConfig = await this.config.getRepositoryConfig(prInfo?.repository || '');
      const resolvedCode = await this.aiExecutor.executePrompt(repoConfig.executor, prompt, repoDir);
      
      let cleanedCode = resolvedCode.trim();
      if (cleanedCode.startsWith('```')) {
        cleanedCode = cleanedCode.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }

      // Safety check: code must be valid and not containing markers
      if (cleanedCode && !cleanedCode.includes('<<<<<<<') && cleanedCode.length > (fileContent.length * 0.3)) {
        return cleanedCode;
      } else {
        this.logger.error(`AI returned invalid content for ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`AI failed to resolve conflicts in ${filePath}: ${error.message}`);
    }
    
    return null;
  }

  /**
   * Validate a generated fix
   */
  async validateFix(fix: string | null, originalContent: string): Promise<boolean> {
    if (!fix || fix === originalContent) return false;
    // Basic length sanity check
    if (fix.length < originalContent.length * 0.2) return false;
    return true;
  }
}
