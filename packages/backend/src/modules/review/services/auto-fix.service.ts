import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitHubClientService } from '../../github/github.service.js';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(
    private readonly github: GitHubClientService,
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
}
