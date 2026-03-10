import { config } from './config.js';
import { logger } from './logger.js';
import { prepareRepository } from './github.js';
import { delegateReview } from './delegate.js';
import { execa } from 'execa';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import fs from 'fs-extra';

// ─────────────────────────────────────────────
// Helper: verbose execa wrapper (shared pattern)
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

  if (result.exitCode !== 0 && !opts.allowFail) {
    const err = new Error(result.stderr || `${cmd} failed with exit code ${result.exitCode}`);
    err.exitCode = result.exitCode;
    throw err;
  }

  if (result.exitCode !== 0) {
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
// Review a specific PR by number
// ─────────────────────────────────────────────
async function reviewSpecificPR() {
  const prNumber = process.argv[2];

  if (!prNumber) {
    console.error(chalk.red('Usage: yarn review <PR_NUMBER>'));
    console.error(chalk.gray('Example: yarn review 112'));
    process.exit(1);
  }

  console.log('\n' + chalk.bold.cyan('╔══════════════════════════════════════════════'));
  console.log(chalk.bold.cyan(`║ review-pr  PR #${prNumber}`));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════') + '\n');

  logger.info(`Searching for PR #${prNumber} across all scopes...`);

  try {
    const allPRs = [];
    const scopes = [
      { scope: 'authored',         flag: '--author=@me',           label: 'authored' },
      { scope: 'assigned',         flag: '--assignee=@me',         label: 'assigned' },
      { scope: 'review-requested', flag: '--review-requested=@me', label: 'review-requested' },
    ];

    for (const { flag, label } of scopes) {
      try {
        logger.info(`► Searching open PRs (${label})...`);
        const { stdout } = await execaVerbose('gh', [
          'search', 'prs',
          flag,
          '--state=open',
          '--json', 'number,title,repository,state',
        ], { allowFail: true });
        const items = JSON.parse(stdout || '[]');
        logger.info(`  Found ${items.length} PRs (${label})`);
        allPRs.push(...items);
      } catch {
        logger.warn(`  Could not fetch PRs for scope: ${label}`);
      }
    }

    const pr = allPRs.find(p => p.number === parseInt(prNumber, 10));

    if (!pr) {
      logger.error(`PR #${prNumber} not found in any of your open PRs`);
      process.exit(1);
    }

    logger.info(`Found PR #${pr.number}: ${chalk.bold(pr.title)}`);
    logger.info(`Repository: ${pr.repository.nameWithOwner}`);
    logger.info(`State: ${pr.state}`);

    // Fetch branch detail
    logger.info('► Fetching PR branch details...');
    const { stdout: detailJson } = await execaVerbose('gh', [
      'pr', 'view', pr.number.toString(),
      '--repo', pr.repository.nameWithOwner,
      '--json', 'number,title,headRefName,baseRefName',
    ]);

    const prDetail = JSON.parse(detailJson || '{}');
    const prData = {
      number: pr.number,
      title: pr.title,
      headRefName: prDetail.headRefName,
      baseRefName: prDetail.baseRefName,
      repository: pr.repository,
    };

    logger.info(`Branch: ${chalk.bold(prData.headRefName)} → ${chalk.bold(prData.baseRefName)}`);

    if (config.delegate || config.dryRun) {
      if (!config.dryRun) {
        await fs.ensureDir(config.workspaceDir);
        logger.info(`Workspace directory: ${config.workspaceDir}`);
      }

      logger.info(`► Processing PR #${prData.number} from ${pr.repository.nameWithOwner}...`);

      let repoDir;
      if (!config.dryRun) {
        repoDir = await prepareRepository(prData);
      }

      await delegateReview(pr.repository.nameWithOwner, prData, repoDir);

      logger.info('✔ PR review completed\n');
    } else {
      logger.info('Delegation disabled (DELEGATE=false)');
    }

  } catch (error) {
    logger.error(`Failed to review PR #${prNumber}: ${error.message}`);
    process.exit(1);
  }
}

reviewSpecificPR();
