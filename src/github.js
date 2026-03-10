import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { logger } from './logger.js';
import { config } from './config.js';

export class GitHubClient {
  constructor() {}

  async execaVerbose(cmd, args, opts = {}) {
    const label = chalk.magenta(`[exec]`) + ' ' + chalk.white(`${cmd} ${args.join(' ')}`);
    logger.info(`▶ ${label}`);

    const proc = execa(cmd, args, {
      ...opts,
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    const stdoutLines = [];
    const stderrLines = [];

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

    if (result.exitCode !== 0) {
      if (!opts.allowFail) {
        const err = new Error(result.stderr || `${cmd} failed with exit code ${result.exitCode}`);
        err.exitCode = result.exitCode;
        throw err;
      }
      logger.warn(`✖ ${cmd} exited with code ${result.exitCode} (allowed)`);
    } else {
      logger.info(`✔ ${cmd} completed (exit 0)`);
    }

    return {
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      exitCode: result.exitCode,
    };
  }

  async fetchOpenPRs() {
    try {
      logger.info('╔══ STEP: fetchOpenPRs');
      const allPRs = [];

      const scopeActions = [
        { scope: 'authored',         flag: '--author=@me',           label: 'authored by @me' },
        { scope: 'assigned',         flag: '--assignee=@me',         label: 'assigned to @me' },
        { scope: 'review-requested', flag: '--review-requested=@me', label: 'review-requested @me' },
      ];

      for (const { scope, flag, label } of scopeActions) {
        if (!config.prScope.includes(scope)) continue;

        logger.info(`► Fetching PRs ${label}...`);
        const { stdout } = await this.execaVerbose('gh', [
          'search', 'prs',
          '--state=open',
          flag,
          '--json', 'number,title,repository,url,updatedAt',
        ]);
        const items = JSON.parse(stdout || '[]');
        logger.info(`  Found ${items.length} PRs (${label})`);
        allPRs.push(...items);
      }

      // Deduplicate by URL
      const uniquePRs = Array.from(new Map(allPRs.map(pr => [pr.url, pr])).values());
      
      const filteredPRs = uniquePRs.filter(pr => {
        const owner = pr.repository.nameWithOwner.split('/')[0];
        return !config.excludeRepoOwners.includes(owner);
      });

      filteredPRs.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));

      for (const pr of filteredPRs) {
        const { stdout: detailJson } = await this.execaVerbose('gh', [
          'pr', 'view', pr.number.toString(),
          '--repo', pr.repository.nameWithOwner,
          '--json', 'headRefName,baseRefName',
        ]);
        const detail = JSON.parse(detailJson || '{}');
        pr.headRefName = detail.headRefName;
        pr.baseRefName = detail.baseRefName;
      }

      return filteredPRs;
    } catch (error) {
      logger.error(`Failed to fetch PRs: ${error.message}`);
      throw error;
    }
  }

  async prepareRepository(pr) {
    const repoName = pr.repository.nameWithOwner;
    const repoDir = path.join(config.workspaceDir, repoName.replace('/', '-'));

    try {
      if (await fs.pathExists(repoDir)) {
        await this.execaVerbose('git', ['fetch', 'origin'], { cwd: repoDir });
        await this.execaVerbose('git', ['checkout', pr.headRefName], { cwd: repoDir });
        await this.execaVerbose('git', ['reset', '--hard', `origin/${pr.headRefName}`], { cwd: repoDir });
        await this.execaVerbose('git', ['clean', '-fd'], { cwd: repoDir });
      } else {
        await this.execaVerbose('git', ['clone', `git@github.com:${repoName}.git`, repoDir]);
        await this.execaVerbose('git', ['checkout', pr.headRefName], { cwd: repoDir });
      }
      return repoDir;
    } catch (error) {
      logger.error(`Failed to prepare repository: ${error.message}`);
      throw error;
    }
  }

  async addReview(repoName, prNumber, body, event = 'COMMENT') {
    // event: APPROVE, REQUEST_CHANGES, COMMENT
    try {
      await this.execaVerbose('gh', [
        'pr', 'review', prNumber.toString(),
        '--repo', repoName,
        '--body', body,
        `--${event.toLowerCase()}`
      ]);
      return true;
    } catch (e) {
      logger.error(`Failed to add review: ${e.message}`);
      return false;
    }
  }

  async mergePR(repoName, prNumber, method = 'squash') {
    try {
      await this.execaVerbose('gh', [
        'pr', 'merge', prNumber.toString(),
        '--repo', repoName,
        `--${method}`,
        '--delete-branch'
      ]);
      return true;
    } catch (e) {
      logger.error(`Failed to merge PR: ${e.message}`);
      return false;
    }
  }

  async assignReviewers(repoName, prNumber, reviewers = []) {
    if (reviewers.length === 0) return true;
    try {
      await this.execaVerbose('gh', [
        'pr', 'edit', prNumber.toString(),
        '--repo', repoName,
        '--add-reviewer', reviewers.join(',')
      ]);
      return true;
    } catch (e) {
      logger.error(`Failed to assign reviewers: ${e.message}`);
      return false;
    }
  }
}

export const githubClient = new GitHubClient();

// Compatibility wrappers
export const fetchOpenPRs = () => githubClient.fetchOpenPRs();
export const prepareRepository = (pr) => githubClient.prepareRepository(pr);
