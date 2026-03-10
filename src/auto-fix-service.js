import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { dbManager } from './database.js';
import { logger } from './logger.js';

export class AutoFixService {
  constructor(workspaceDir = './workspace') {
    this.workspaceDir = workspaceDir;
  }

  isFixable(comment) {
    return comment.is_auto_fixable === 1 || !!comment.suggested_fix;
  }

  async generateFixes(comments) {
    return comments.filter(c => this.isFixable(c)).map(c => ({
      comment_id: c.id,
      file_path: c.file_path,
      line_number: c.line_number,
      suggested_fix: c.suggested_fix
    }));
  }

  async applyFixes(repoDir, fixes) {
    const results = [];
    
    for (const fix of fixes) {
      const filePath = path.join(repoDir, fix.file_path);
      if (!await fs.pathExists(filePath)) continue;

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Simple replacement logic for line-based fixes
        // Note: this is very simplified. Real suggestions might span multiple lines.
        if (fix.line_number > 0 && fix.line_number <= lines.length) {
          lines[fix.line_number - 1] = fix.suggested_fix;
          await fs.writeFile(filePath, lines.join('\n'));
          results.push({ ...fix, status: 'applied' });
        }
      } catch (e) {
        logger.error(`Failed to apply fix to ${fix.file_path}: ${e.message}`);
        results.push({ ...fix, status: 'failed', error: e.message });
      }
    }

    return results;
  }

  async runProjectFixers(repoDir) {
    // Try to run standard tools if they exist
    const hasEslint = await fs.pathExists(path.join(repoDir, '.eslintrc.json')) || await fs.pathExists(path.join(repoDir, 'package.json'));
    
    if (hasEslint) {
      try {
        logger.info('Running eslint --fix...');
        await execa('npm', ['run', 'lint', '--', '--fix'], { cwd: repoDir, reject: false });
      } catch (e) {}
    }

    const hasPrettier = await fs.pathExists(path.join(repoDir, '.prettierrc'));
    if (hasPrettier) {
      try {
        logger.info('Running prettier --write...');
        await execa('npx', ['prettier', '--write', '.'], { cwd: repoDir, reject: false });
      } catch (e) {}
    }
  }

  async verifyFixes(repoDir, testCommand = 'npm test') {
    try {
      logger.info(`Verifying fixes with ${testCommand}...`);
      const { exitCode } = await execa(testCommand.split(' ')[0], testCommand.split(' ').slice(1), { 
        cwd: repoDir, 
        reject: false 
      });
      return exitCode === 0;
    } catch (e) {
      return false;
    }
  }

  async commitAndPushFixes(repoDir, branchName, message = 'chore: apply automated fixes') {
    try {
      await execa('git', ['add', '.'], { cwd: repoDir });
      await execa('git', ['commit', '-m', message], { cwd: repoDir });
      await execa('git', ['push', 'origin', branchName], { cwd: repoDir });
      return true;
    } catch (e) {
      logger.error(`Failed to commit/push fixes: ${e.message}`);
      return false;
    }
  }

  async fixPR(pr, reviewSessionId, repoDir) {
    if (!dbManager.isAvailable()) return { status: 'failed', error: 'Database not available' };

    const comments = dbManager.db.prepare(
      'SELECT * FROM review_comments WHERE review_session_id = ?'
    ).all(reviewSessionId);

    const fixableComments = comments.filter(c => this.isFixable(c));
    if (fixableComments.length === 0) return { status: 'no_fixes' };

    let attempt = 1;
    const maxAttempts = 3;
    let currentStatus = 'pending';

    while (attempt <= maxAttempts) {
      const attemptId = dbManager.db.prepare(`
        INSERT INTO auto_fix_attempts (
          pr_id, review_session_id, attempt_number, issues_targeted, 
          fixes_applied, status, started_at
        ) VALUES (?, ?, ?, ?, ?, 'processing', CURRENT_TIMESTAMP)
      `).run(
        pr.id, reviewSessionId, attempt, 
        JSON.stringify(fixableComments.map(c => c.id)),
        '[]'
      ).lastInsertRowid;

      try {
        const appliedResults = await this.applyFixes(repoDir, fixableComments);
        const successfulFixes = appliedResults.filter(r => r.status === 'applied');

        dbManager.db.prepare(
          'UPDATE auto_fix_attempts SET fixes_applied = ? WHERE id = ?'
        ).run(JSON.stringify(successfulFixes), attemptId);

        // Run project tools
        await this.runProjectFixers(repoDir);

        // Verify
        const passed = await this.verifyFixes(repoDir);
        
        if (passed) {
          const pushed = await this.commitAndPushFixes(repoDir, pr.headRefName);
          
          dbManager.db.prepare(`
            UPDATE auto_fix_attempts 
            SET status = ?, test_passed = 1, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(pushed ? 'success' : 'failed', attemptId);

          if (pushed) return { status: 'success', attempt };
        } else {
          dbManager.db.prepare(`
            UPDATE auto_fix_attempts 
            SET status = 'failed', test_passed = 0, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(attemptId);
          
          // If tests failed, we might want to rollback but for now we'll just try again or stop
          // In a real app, we'd git reset --hard
          await execa('git', ['reset', '--hard', 'HEAD'], { cwd: repoDir });
        }
      } catch (e) {
        dbManager.db.prepare(`
          UPDATE auto_fix_attempts 
          SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(e.message, attemptId);
      }

      attempt++;
    }

    return { status: 'failed', maxAttemptsReached: true };
  }
}

export const autoFixService = new AutoFixService();
export default autoFixService;
