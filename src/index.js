import { config } from './config.js';
import { logger } from './logger.js';
import { fetchOpenPRs, prepareRepository } from './github.js';
import { delegateReview } from './delegate.js';
import fs from 'fs-extra';

async function run(once = false) {
  logger.info('Starting PR review check...');

  const prs = await fetchOpenPRs();
  logger.info(`Found ${prs.length} open PRs`);

  if (prs.length === 0) {
    logger.info('No PRs to process');
    return;
  }

  console.log('');
  prs.forEach(pr => console.log(`#${pr.number} ${pr.title} (${pr.repository.nameWithOwner})`));
  console.log('');

  if (config.delegate || config.dryRun) {
    if (config.dryRun) {
      logger.info('DRY RUN mode - simulating delegation for first PR only...');
    } else {
      logger.info('Delegation enabled, processing PRs...');
      await fs.ensureDir(config.workspaceDir);
      logger.info(`Workspace directory: ${config.workspaceDir}`);
    }

    const prsToProcess = (config.dryRun || once) ? prs.slice(0, 1) : prs;

    for (const pr of prsToProcess) {
      logger.info(`Processing PR #${pr.number} from ${pr.repository.nameWithOwner}`);

      let repoDir;
      if (!config.dryRun) {
        repoDir = await prepareRepository(pr);
      }

      await delegateReview(pr.repository.nameWithOwner, pr, repoDir);
    }

    logger.info('All PRs processed');
  } else {
    logger.info('Delegation disabled (DELEGATE=false)');
  }
}

async function main() {
  const once = process.argv.includes('--once');

  if (config.dryRun) {
    logger.info('Running in DRY RUN mode - no actual changes will be made');
  }

  if (once) {
    await run(true);
  } else {
    while (true) {
      await run(false);
      await logger.countdown(config.reviewInterval);
    }
  }
}

main().catch(error => {
  logger.error(error.message);
  process.exit(1);
});
