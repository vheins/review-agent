import { config } from './config.js';
import { logger } from './logger.js';
import { prepareRepository } from './github.js';
import { delegateToGemini } from './delegate.js';
import { execa } from 'execa';
import fs from 'fs-extra';

async function reviewSpecificPR() {
  const prNumber = process.argv[2];

  if (!prNumber) {
    console.error('Usage: yarn review <PR_NUMBER>');
    console.error('Example: yarn review 112');
    process.exit(1);
  }

  logger.info(`Searching for PR #${prNumber}...`);

  try {
    const allPRs = [];

    // Search in all scopes (open PRs only) to allow re-review
    const scopes = ['authored', 'assigned', 'review-requested'];

    for (const scope of scopes) {
      try {
        const flag = scope === 'authored' ? '--author=@me'
          : scope === 'assigned' ? '--assignee=@me'
            : '--review-requested=@me';

        const searchResult = await execa('gh', [
          'search', 'prs',
          flag,
          '--state=open',
          '--json', 'number,title,repository,state'
        ], { stdio: 'pipe' });
        allPRs.push(...JSON.parse(searchResult.stdout));
      } catch (error) {
        // Continue if one scope fails
      }
    }

    const pr = allPRs.find(p => p.number === parseInt(prNumber));

    if (!pr) {
      logger.error(`PR #${prNumber} not found in any of your PRs`);
      process.exit(1);
    }

    logger.info(`Found PR #${pr.number}: ${pr.title}`);
    logger.info(`Repository: ${pr.repository.nameWithOwner}`);
    logger.info(`State: ${pr.state}`);

    // Fetch detailed PR info including branch name
    logger.info('Fetching PR details...');
    const detailResult = await execa('gh', [
      'pr', 'view', pr.number.toString(),
      '--repo', pr.repository.nameWithOwner,
      '--json', 'number,title,headRefName,baseRefName'
    ], { stdio: 'pipe' });

    const prDetail = JSON.parse(detailResult.stdout);

    const prData = {
      number: pr.number,
      title: pr.title,
      headRefName: prDetail.headRefName,
      baseRefName: prDetail.baseRefName,
      repository: pr.repository
    };

    logger.info(`Branch: ${prData.headRefName} → ${prData.baseRefName}`);

    if (config.delegate || config.dryRun) {
      if (!config.dryRun) {
        await fs.ensureDir(config.workspaceDir);
        logger.info(`Workspace directory: ${config.workspaceDir}`);
      }

      logger.info(`Processing PR #${prData.number} from ${pr.repository.nameWithOwner}`);

      let repoDir;
      if (!config.dryRun) {
        repoDir = await prepareRepository(prData);
      }

      await delegateToGemini(pr.repository.nameWithOwner, prData, repoDir);

      logger.info('PR review completed');
    } else {
      logger.info('Delegation disabled (DELEGATE=false)');
    }
  } catch (error) {
    logger.error(`Failed to review PR #${prNumber}: ${error.message}`);
    process.exit(1);
  }
}

reviewSpecificPR();
