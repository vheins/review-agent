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

    const proc = execa(cmd, args, {
      ...opts,
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    if (proc.stdout) {
      proc.stdout.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const cleaned = stripAnsi(line);
          if (cleaned.trim()) {
            process.stdout.write(chalk.gray('  │ ') + cleaned + '\n');
            stdoutLines.push(cleaned);
          }
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const cleaned = stripAnsi(line);
          if (cleaned.trim()) {
            process.stdout.write(chalk.yellow('  │ ') + cleaned + '\n');
            stderrLines.push(cleaned);
          }
        }
      });
    }

    const result = await proc;
    const duration = Date.now() - start;

    let stdout = stdoutLines.join('\n');
    if (!stdout && result.stdout) {
      stdout = stripAnsi(result.stdout);
    }

    let stderr = stderrLines.join('\n');
    if (!stderr && result.stderr) {
      stderr = stripAnsi(result.stderr);
    }

    if (result.exitCode !== 0) {
      if (!opts.allowFail) {
        const err = new Error(stderr || `${cmd} failed with exit code ${result.exitCode}`) as any;
        err.exitCode = result.exitCode;
        this.logger.error(`✖ ${cmd} failed in ${duration}ms with code ${result.exitCode}`);
        throw err;
      }
      this.logger.warn(`✖ ${cmd} exited with code ${result.exitCode} (allowed) after ${duration}ms`);
    } else {
      this.logger.log(`✔ ${cmd} completed in ${duration}ms (exit 0)`);
    }

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: result.exitCode || 0,
    };
  }

  async searchPRs(flag: string): Promise<any[]> {
    this.logger.log(`[CLI] Searching PRs with flag: ${flag}`);
    const { stdout } = await this.execaVerbose('gh', [
      'search', 'prs',
      flag,
      '--limit', '100',
      '--json', 'id,number,title,body,state,url,author,labels,createdAt,updatedAt,closedAt,isDraft,isLocked',
    ]);
    return JSON.parse(stdout || '[]');
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
    return JSON.parse(stdout || '[]');
  }

  async getPRDetail(repoName: string, prNumber: number): Promise<any> {
    this.logger.debug(`[CLI] Getting PR view: ${repoName}#${prNumber}`);
    const { stdout } = await this.execaVerbose('gh', [
      'pr', 'view', prNumber.toString(),
      '--repo', repoName,
      '--json', 'id,number,title,body,state,url,author,labels,headRefName,headRefOid,baseRefName,isDraft,mergeable,mergeStateStatus,mergedAt,closedAt,createdAt',
    ]);
    const detail = JSON.parse(stdout || '{}');
    
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
    return JSON.parse(stdout || '[]');
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
    return JSON.parse(stdout || '[]');
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
    return JSON.parse(stdout || '[]');
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
    return JSON.parse(stdout || '{}');
  }
}
