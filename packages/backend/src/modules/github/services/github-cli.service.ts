import { Injectable, Logger } from '@nestjs/common';
import { execa } from 'execa';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';

@Injectable()
export class GithubCliService {
  private readonly logger = new Logger(GithubCliService.name);

  /**
   * Execute a command with verbose logging
   */
  async execaVerbose(cmd: string, args: string[], opts: any = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const label = chalk.magenta(`[exec]`) + ' ' + chalk.white(`${cmd} ${args.join(' ')}`);
    this.logger.log(`▶ ${label}`);
    const start = Date.now();

    // Use execa's built-in buffering for data integrity
    const proc = execa(cmd, args, {
      ...opts,
      all: true, // Combine stdout and stderr
      reject: false,
    });

    // For verbose logging without corrupting the return value, 
    // we pipe to a logger but return the raw buffer result.
    if (proc.stdout && !opts.silent) {
      let lineCount = 0;
      proc.stdout.on('data', (chunk) => {
        if (lineCount > 100) return; // Limit console noise for huge outputs
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const cleaned = stripAnsi(line).trim();
          if (cleaned) {
            process.stdout.write(chalk.gray('  │ ') + cleaned + '\n');
            lineCount++;
          }
        }
        if (lineCount === 100) {
          process.stdout.write(chalk.gray('  │ ') + '... (output truncated in console for brevity)\n');
          lineCount++;
        }
      });
    }

    const result = await proc;
    const duration = Date.now() - start;

    const stdout = stripAnsi(result.stdout || '');
    const stderr = stripAnsi(result.stderr || '');

    if (result.exitCode !== 0) {
      if (!opts.allowFail) {
        this.logger.error(`[CLI] ✖ ${cmd} failed in ${duration}ms with code ${result.exitCode}`);
        const err = new Error(stderr || `${cmd} failed with exit code ${result.exitCode}`) as any;
        err.exitCode = result.exitCode;
        throw err;
      }
      this.logger.warn(`[CLI] ✖ ${cmd} exited with code ${result.exitCode} (allowed) after ${duration}ms`);
    } else {
      this.logger.log(`[CLI] ✔ ${cmd} completed in ${duration}ms (exit 0)`);
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result.exitCode || 0,
    };
  }

  async searchPRs(query: string): Promise<any[]> {
    this.logger.log(`[CLI] Searching PRs: ${query}`);
    // Split query by space to handle multiple qualifiers correctly in execa
    const queryParts = query.split(' ').filter(part => part.trim() !== '');
    
    const { stdout } = await this.execaVerbose('gh', [
      'search', 'prs',
      ...queryParts,
      '--limit', '500',
      '--json', 'id,number,title,body,state,url,author,labels,createdAt,updatedAt,closedAt,isDraft,isLocked,repository',
    ]);
    
    try {
      return JSON.parse(stdout || '[]');
    } catch (e) {
      this.logger.error(`[CLI] Failed to parse JSON response from search: ${e.message}`);
      return [];
    }
  }

  async searchIssues(): Promise<any[]> {
    this.logger.log('[CLI] Searching issues mentioning @me');
    const { stdout } = await this.execaVerbose('gh', [
      'search', 'issues',
      '--state=open',
      '--mentions=@me',
      '--limit', '100',
      '--json', 'number,title,repository,url,updatedAt,state,author',
    ]);
    try {
      return JSON.parse(stdout || '[]');
    } catch (e) {
      this.logger.error(`[CLI] Failed to parse JSON response from issues search: ${e.message}`);
      return [];
    }
  }

  async getPRDetail(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[CLI] Getting PR view: ${repoName}#${prNumber}`);
    const { stdout } = await this.execaVerbose('gh', [
      'pr', 'view', prNumber.toString(),
      '--repo', repoName,
      '--json', 'id,number,title,body,state,url,author,labels,headRefName,headRefOid,baseRefName,isDraft,mergeable,mergeStateStatus,mergedAt,closedAt,createdAt',
    ]);
    
    let detail;
    try {
      detail = JSON.parse(stdout || '{}');
    } catch (e) {
      this.logger.error(`[CLI] Failed to parse JSON response from pr view: ${e.message}`);
      throw e;
    }
    
    // Normalize to match API structure if needed by consumer
    return {
      ...detail,
      head: { ref: detail.headRefName, sha: detail.headRefOid },
      base: { ref: detail.baseRefName },
      user: detail.author,
      html_url: detail.url,
      draft: detail.isDraft,
      labels: (detail.labels || []).map(l => l.name)
    };
  }

  async addReview(repoName: string, prNumber: number, body: string, event: string): Promise<void> {
    this.logger.log(`[CLI] Adding ${event} review to ${repoName}#${prNumber}`);
    await this.execaVerbose('gh', [
      'pr', 'review', prNumber.toString(),
      '--repo', repoName,
      '--body', body,
      `--${event.toLowerCase()}`
    ]);
  }

  async mergePR(repoName: string, prNumber: number, method: string): Promise<void> {
    this.logger.log(`[CLI] Merging PR ${repoName}#${prNumber} via ${method}`);
    await this.execaVerbose('gh', [
      'pr', 'merge', prNumber.toString(),
      '--repo', repoName,
      `--${method}`,
      '--delete-branch'
    ]);
  }

  async listReviews(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[CLI] Listing reviews for ${repoName}#${prNumber} via API fallback`);
    const { stdout } = await this.execaVerbose('gh', [
      'api',
      `/repos/${repoName}/pulls/${prNumber}/reviews`
    ]);
    try {
      return JSON.parse(stdout || '[]');
    } catch (e) {
      return [];
    }
  }

  async dismissReview(repoName: string, prNumber: number, reviewId: number, message: string): Promise<void> {
    this.logger.log(`[CLI] Dismissing review ${reviewId} for ${repoName}#${prNumber}`);
    await this.execaVerbose('gh', [
      'api',
      '-X', 'PUT',
      `/repos/${repoName}/pulls/${prNumber}/reviews/${reviewId}/dismissals`,
      '-f', `message=${message}`
    ]);
  }

  async listReviewComments(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[CLI] Listing review comments for ${repoName}#${prNumber} via API fallback`);
    const { stdout } = await this.execaVerbose('gh', [
      'api',
      `/repos/${repoName}/pulls/${prNumber}/comments`
    ]);
    try {
      return JSON.parse(stdout || '[]');
    } catch (e) {
      return [];
    }
  }

  async updateBranch(repoName: string, prNumber: number): Promise<void> {
    this.logger.log(`[CLI] Updating branch for ${repoName}#${prNumber}`);
    await this.execaVerbose('gh', [
      'pr', 'update-branch', prNumber.toString(),
      '--repo', repoName
    ]);
  }

  async getPRChecks(repoName: string, prNumber: number): Promise<any[]> {
    this.logger.debug(`[CLI] Checking PR status for ${repoName}#${prNumber}`);
    const { stdout } = await this.execaVerbose('gh', [
      'pr', 'checks', prNumber.toString(),
      '--repo', repoName,
      '--json', 'name,status,conclusion,url'
    ]);
    try {
      return JSON.parse(stdout || '[]');
    } catch (e) {
      return [];
    }
  }

  async assignReviewers(repoName: string, prNumber: number, reviewers: string[]): Promise<void> {
    this.logger.log(`[CLI] Assigning reviewers to ${repoName}#${prNumber}: ${reviewers.join(', ')}`);
    await this.execaVerbose('gh', [
      'pr', 'edit', prNumber.toString(),
      '--repo', repoName,
      '--add-reviewer', reviewers.join(',')
    ]);
  }

  async getRateLimit(): Promise<any> {
    this.logger.debug('[CLI] Checking rate limits via API fallback');
    const { stdout } = await this.execaVerbose('gh', ['api', 'rate_limit']);
    try {
      return JSON.parse(stdout || '{}');
    } catch (e) {
      return {};
    }
  }
}
