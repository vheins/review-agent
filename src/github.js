import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { logger } from './logger.js';
import { config } from './config.js';

// ─────────────────────────────────────────────
// Helper: verbose execa wrapper (mirrors delegate.js)
// ─────────────────────────────────────────────
async function execaVerbose(cmd, args, opts = {}) {
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

// ─────────────────────────────────────────────
// Fetch open PRs from GitHub
// ─────────────────────────────────────────────
export async function fetchOpenPRs() {
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
      const { stdout } = await execaVerbose('gh', [
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
    logger.info(`Total unique PRs before filter: ${uniquePRs.length}`);

    // Filter excluded repo owners
    const filteredPRs = uniquePRs.filter(pr => {
      const owner = pr.repository.nameWithOwner.split('/')[0];
      return !config.excludeRepoOwners.includes(owner);
    });

    if (filteredPRs.length < uniquePRs.length) {
      logger.info(`Filtered out ${uniquePRs.length - filteredPRs.length} PRs from excluded owners`);
    }

    // Sort oldest first
    filteredPRs.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));

    // Fetch branch details
    logger.info(`► Fetching branch details for ${filteredPRs.length} PRs...`);
    for (const pr of filteredPRs) {
      logger.info(`  Fetching branch info for PR #${pr.number} (${pr.repository.nameWithOwner})...`);
      const { stdout: detailJson } = await execaVerbose('gh', [
        'pr', 'view', pr.number.toString(),
        '--repo', pr.repository.nameWithOwner,
        '--json', 'headRefName,baseRefName',
      ]);
      const detail = JSON.parse(detailJson || '{}');
      pr.headRefName = detail.headRefName;
      pr.baseRefName = detail.baseRefName;
      logger.info(`  PR #${pr.number}: ${pr.headRefName} → ${pr.baseRefName}`);
    }

    logger.info(`╚══ fetchOpenPRs complete — ${filteredPRs.length} PRs to process\n`);
    return filteredPRs;

  } catch (error) {
    logger.error(`Failed to fetch PRs: ${error.message}`);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Clone / update repository for review
// ─────────────────────────────────────────────
export async function prepareRepository(pr) {
  const repoName = pr.repository.nameWithOwner;
  const repoDir = path.join(config.workspaceDir, repoName.replace('/', '-'));

  try {
    logger.info(`╔══ STEP: prepareRepository — ${repoName}`);
    logger.info(`  Target directory: ${repoDir}`);

    if (await fs.pathExists(repoDir)) {
      logger.info(`  Repository exists — fetching & checking out ${pr.headRefName}...`);

      await execaVerbose('git', ['fetch', 'origin'], { cwd: repoDir });
      await execaVerbose('git', ['checkout', pr.headRefName], { cwd: repoDir });
      await execaVerbose('git', ['pull', 'origin', pr.headRefName], { cwd: repoDir });

    } else {
      logger.info(`  Repository not found — cloning git@github.com:${repoName}.git...`);

      await execaVerbose('git', ['clone', `git@github.com:${repoName}.git`, repoDir]);
      await execaVerbose('git', ['checkout', pr.headRefName], { cwd: repoDir });
    }

    logger.info(`✔ Repository ready at ${repoDir}`);
    logger.info('╚══ prepareRepository complete\n');
    return repoDir;

  } catch (error) {
    logger.error(`Failed to prepare repository: ${error.message}`);
    throw error;
  }
}
