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
    
    // Search in all configured scopes
    if (config.prScope.includes('authored')) {
      const searchResult = await execa('gh', [
        'search', 'prs',
        '--author=@me',
        '--json', 'number,title,repository'
      ], { stdio: 'pipe' });
      allPRs.push(...JSON.parse(searchResult.stdout));
    }
    
    if (config.prScope.includes('assigned')) {
      const searchResult = await execa('gh', [
        'search', 'prs',
        '--assignee=@me',
        '--json', 'number,title,repository'
      ], { stdio: 'pipe' });
      allPRs.push(...JSON.parse(searchResult.stdout));
    }
    
    if (config.prScope.includes('review-requested')) {
      const searchResult = await execa('gh', [
        'search', 'prs',
        '--review-requested=@me',
        '--json', 'number,title,repository'
      ], { stdio: 'pipe' });
      allPRs.push(...JSON.parse(searchResult.stdout));
    }

    const pr = allPRs.find(p => p.number === parseInt(prNumber));

    if (!pr) {
      logger.error(`PR #${prNumber} not found in your PRs (scope: ${config.prScope.join(', ')})`);
      process.exit(1);
    }

    logger.info(`Found PR #${pr.number}: ${pr.title}`);
    logger.info(`Repository: ${pr.repository.nameWithOwner}`);
    
    // Fetch detailed PR info including branch name
    logger.info('Fetching PR details...');
    const detailResult = await execa('gh', [
      'pr', 'view', pr.number.toString(),
      '--repo', pr.repository.nameWithOwner,
      '--json', 'number,title,headRefName'
    ], { stdio: 'pipe' });
    
    const prDetail = JSON.parse(detailResult.stdout);
    
    const prData = {
      number: pr.number,
      title: pr.title,
      headRefName: prDetail.headRefName,
      repository: pr.repository
    };
    
    logger.info(`Branch: ${prData.headRefName}`);

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
