import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitHubClientService } from '../../github/github.service.js';
import { AiFixGeneratorService } from '../../ai/ai-fix-generator.service.js';
import fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(
    private readonly github: GitHubClientService,
    private readonly aiFixGen: AiFixGeneratorService,
    private readonly dataSource: DataSource,
  ) {}

  isFixable(comment: any): boolean {
    return comment.is_auto_fixable === 1 || !!comment.suggested_fix || !!comment.suggestion;
  }

  async applyFixes(repoDir: string, fixes: any[]): Promise<any[]> {
    const results = [];
    
    for (const fix of fixes) {
      const filePath = path.join(repoDir, fix.file_path || fix.file);
      if (!await fs.pathExists(filePath)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        const lineNumber = fix.line_number || fix.line;
        const suggestedFix = fix.suggested_fix || fix.suggestion;

        if (lineNumber > 0 && lineNumber <= lines.length) {
          lines[lineNumber - 1] = suggestedFix;
          await fs.writeFile(filePath, lines.join('\n'));
          results.push({ ...fix, status: 'applied' });
        }
      } catch (e) {
        this.logger.error(`Failed to apply fix to ${fix.file_path || fix.file}: ${e.message}`);
        results.push({ ...fix, status: 'failed', error: e.message });
      }
    }

    return results;
  }

  async runProjectFixers(repoDir: string) {
    const hasEslint = await fs.pathExists(path.join(repoDir, '.eslintrc.json')) || 
                     await fs.pathExists(path.join(repoDir, 'package.json'));
    
    if (hasEslint) {
      try {
        this.logger.log('Running eslint --fix...');
        await this.github.execaVerbose('npm', ['run', 'lint', '--', '--fix'], { cwd: repoDir, reject: false });
      } catch (e) {}
    }

    const hasPrettier = await fs.pathExists(path.join(repoDir, '.prettierrc'));
    if (hasPrettier) {
      try {
        this.logger.log('Running prettier --write...');
        await this.github.execaVerbose('npx', ['prettier', '--write', '.'], { cwd: repoDir, reject: false });
      } catch (e) {}
    }
  }

  async verifyFixes(repoDir: string, testCommand = 'npm test'): Promise<boolean> {
    try {
      this.logger.log(`Verifying fixes with ${testCommand}...`);
      const { exitCode } = await this.github.execaVerbose(
        testCommand.split(' ')[0], 
        testCommand.split(' ').slice(1), 
        { cwd: repoDir, reject: false }
      );
      return exitCode === 0;
    } catch (e) {
      return false;
    }
  }

  async commitAndPushFixes(repoDir: string, branchName: string, message = 'chore: apply automated fixes'): Promise<boolean> {
    try {
      await this.github.execaVerbose('git', ['add', '.'], { cwd: repoDir });
      await this.github.execaVerbose('git', ['commit', '-m', message], { cwd: repoDir });
      await this.github.execaVerbose('git', ['push', 'origin', 'HEAD'], { cwd: repoDir });
      return true;
    } catch (e) {
      this.logger.error(`Failed to commit/push fixes: ${e.message}`);
      return false;
    }
  }

  /**
   * Attempt to fix merge conflicts by merging from base branch
   */
  async fixConflicts(repoDir: string, baseBranch: string, prInfo?: { number: number, title: string, repository: string, headRefName: string }): Promise<boolean> {
    try {
      this.logger.log(`Attempting to fix conflicts by merging origin/${baseBranch}...`);
      
      // Fetch latest from origin
      await this.github.execaVerbose('git', ['fetch', 'origin', baseBranch], { cwd: repoDir });
      
      // Try to merge
      const { exitCode } = await this.github.execaVerbose(
        'git', ['merge', `origin/${baseBranch}`, '--no-edit'], 
        { cwd: repoDir, allowFail: true }
      );
      
      if (exitCode !== 0) {
        this.logger.warn('Merge failed with conflicts. Attempting AI-powered resolution...');
        
        // Identify conflicted files
        const { stdout: conflictedFilesRaw } = await this.github.execaVerbose(
          'git', ['diff', '--name-only', '--diff-filter=U'],
          { cwd: repoDir }
        );
        
        const conflictedFiles = conflictedFilesRaw.split('\n').filter(f => f.trim() !== '');
        
        if (conflictedFiles.length === 0) {
          this.logger.error('Git reported conflicts but no conflicted files found.');
          await this.github.execaVerbose('git', ['merge', '--abort'], { cwd: repoDir, reject: false });
          return false;
        }

        for (const relativePath of conflictedFiles) {
          const fullPath = path.join(repoDir, relativePath);
          const content = await fs.readFile(fullPath, 'utf8');
          
          const resolvedContent = await this.aiFixGen.resolveConflicts(content, relativePath, prInfo);
          
          if (resolvedContent) {
            await fs.writeFile(fullPath, resolvedContent);
            await this.github.execaVerbose('git', ['add', relativePath], { cwd: repoDir });
            this.logger.log(`AI successfully resolved conflict in: ${relativePath}`);
          } else {
            this.logger.error(`AI failed to resolve conflict in: ${relativePath}`);
            await this.github.execaVerbose('git', ['merge', '--abort'], { cwd: repoDir, reject: false });
            return false;
          }
        }

        // Finalize merge commit with Indonesian message
        const conflictFilesStr = conflictedFiles.join(', ');
        await this.github.execaVerbose('git', ['commit', '-m', `fix(conflict): selesaikan konflik di ${conflictFilesStr}`], { cwd: repoDir });
        this.logger.log('Conflicts successfully resolved via AI and merge completed.');
        return true;
      }
      
      this.logger.log('Conflicts successfully resolved via standard merge.');
      return true;
    } catch (e) {
      this.logger.error(`Failed during conflict resolution attempt: ${e.message}`);
      // Ensure we don't leave the repo in a merging state
      await this.github.execaVerbose('git', ['merge', '--abort'], { cwd: repoDir, allowFail: true });
      return false;
    }
  }
}
