import { execa } from 'execa';
import path from 'path';
import fs from 'fs-extra';
import { logger } from './logger.js';
import { config } from './config.js';

export async function fetchOpenPRs() {
  try {
    const allPRs = [];
    
    if (config.prScope.includes('authored')) {
      logger.info('Fetching PRs authored by @me...');
      const { stdout: authoredPRs } = await execa('gh', ['search', 'prs', '--state=open', '--author=@me', '--json', 'number,title,repository,url,updatedAt']);
      const authored = JSON.parse(authoredPRs);
      logger.info(`Found ${authored.length} authored PRs`);
      allPRs.push(...authored);
    }
    
    if (config.prScope.includes('assigned')) {
      logger.info('Fetching PRs assigned to @me...');
      const { stdout: assignedPRs } = await execa('gh', ['search', 'prs', '--state=open', '--assignee=@me', '--json', 'number,title,repository,url,updatedAt']);
      const assigned = JSON.parse(assignedPRs);
      logger.info(`Found ${assigned.length} assigned PRs`);
      allPRs.push(...assigned);
    }
    
    if (config.prScope.includes('review-requested')) {
      logger.info('Fetching PRs with review requested from @me...');
      const { stdout: reviewPRs } = await execa('gh', ['search', 'prs', '--state=open', '--review-requested=@me', '--json', 'number,title,repository,url,updatedAt']);
      const review = JSON.parse(reviewPRs);
      logger.info(`Found ${review.length} review-requested PRs`);
      allPRs.push(...review);
    }
    
    // Merge and deduplicate by PR URL
    const uniquePRs = Array.from(new Map(allPRs.map(pr => [pr.url, pr])).values());
    logger.info(`Total unique PRs: ${uniquePRs.length}`);
    
    // Filter out excluded repo owners
    const filteredPRs = uniquePRs.filter(pr => {
      const owner = pr.repository.nameWithOwner.split('/')[0];
      return !config.excludeRepoOwners.includes(owner);
    });
    
    if (filteredPRs.length < uniquePRs.length) {
      logger.info(`Filtered out ${uniquePRs.length - filteredPRs.length} PRs from excluded owners`);
    }
    
    // Sort by updatedAt (oldest first)
    filteredPRs.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    
    // Fetch branch name for each PR
    logger.info('Fetching branch details for each PR...');
    for (const pr of filteredPRs) {
      const { stdout: detailJson } = await execa('gh', ['pr', 'view', pr.number.toString(), '--repo', pr.repository.nameWithOwner, '--json', 'headRefName']);
      const detail = JSON.parse(detailJson);
      pr.headRefName = detail.headRefName;
      logger.info(`PR #${pr.number} (${pr.repository.nameWithOwner}): branch ${pr.headRefName}`);
    }
    
    return filteredPRs;
  } catch (error) {
    logger.error(`Failed to fetch PRs: ${error.message}`);
    throw error;
  }
}

export async function prepareRepository(pr) {
  const repoName = pr.repository.nameWithOwner;
  const repoDir = path.join(config.workspaceDir, repoName.replace('/', '-'));
  
  try {
    if (await fs.pathExists(repoDir)) {
      logger.info(`Repository ${repoName} exists, checking out branch ${pr.headRefName}`);
      await execa('git', ['fetch', 'origin'], { cwd: repoDir, stdio: 'inherit' });
      await execa('git', ['checkout', pr.headRefName], { cwd: repoDir, stdio: 'inherit' });
      await execa('git', ['pull', 'origin', pr.headRefName], { cwd: repoDir, stdio: 'inherit' });
    } else {
      logger.info(`Cloning ${repoName} to ${repoDir}`);
      await execa('git', ['clone', `git@github.com:${repoName}.git`, repoDir], { stdio: 'inherit' });
      await execa('git', ['checkout', pr.headRefName], { cwd: repoDir, stdio: 'inherit' });
    }
    return repoDir;
  } catch (error) {
    logger.error(`Failed to prepare repository: ${error.message}`);
    throw error;
  }
}
