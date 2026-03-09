import { execa } from 'execa';
import fs from 'fs-extra';
import { logger, notify } from './logger.js';
import { config } from './config.js';

async function addReviewComments(repository, pr, repoDir) {
  const originalDir = process.cwd();

  try {
    const guidelines = await fs.readFile('agents.md', 'utf-8');
    const promptTemplate = await fs.readFile('context/review-prompt.md', 'utf-8');

    // Replace placeholders in template
    const prompt = promptTemplate
      .replace(/\{\{repository\}\}/g, repository)
      .replace(/\{\{pr\.number\}\}/g, pr.number)
      .replace(/\{\{pr\.title\}\}/g, pr.title)
      .replace(/\{\{guidelines\}\}/g, guidelines);

    logger.info(`Adding review comments for PR #${pr.number}`);

    console.log('\n--- PROMPT TO GEMINI ---');
    console.log(prompt);
    console.log('--- END PROMPT ---\n');

    process.chdir(repoDir);

    // Capture output while also displaying it
    const geminiArgs = ['-p', prompt];
    if (config.geminiYolo) {
      geminiArgs.push('-y');
      logger.info('YOLO mode enabled - auto-approving all actions');
    }

    const result = await execa('gemini', geminiArgs);

    const output = result.stdout.trim();

    console.log('\n--- GEMINI OUTPUT ---');
    console.log(output);
    console.log('--- END OUTPUT ---\n');

    const decisionMatch = output.match(/DECISION:\s*(APPROVE|REQUEST_CHANGES)/i);
    const messageMatch = output.match(/MESSAGE:\s*(.+)/is);

    if (!decisionMatch || !messageMatch) {
      logger.warn('Gemini response does not match expected format. Using fallback.');
    }

    const decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'REQUEST_CHANGES';
    const message = messageMatch ? messageMatch[1].trim() : 'Review telah dilakukan. Silakan periksa komentar yang diberikan untuk detail lebih lanjut.';

    // Check if Gemini already posted comments by looking for gh commands in output
    const hasPostedComments = output.includes('gh pr review') ||
      output.includes('gh api') ||
      output.includes('review submitted') ||
      output.includes('comment added');

    logger.info(`Decision: ${decision}`);
    logger.info(`Message: ${message}`);
    logger.info(`Gemini already posted comments: ${hasPostedComments}`);

    return { decision, message, hasPostedComments };

  } finally {
    process.chdir(originalDir);
  }
}

async function approvePR(repository, pr, message) {
  try {
    logger.info(`Approving PR #${pr.number}`);
    await execa('gh', [
      'pr', 'review', pr.number.toString(),
      '--approve',
      '--body', message,
      '--repo', repository
    ], { stdio: 'inherit' });
    logger.info(`PR #${pr.number} approved`);
  } catch (error) {
    logger.error(`Failed to approve PR #${pr.number}: ${error.message}`);
  }
}

async function rejectPR(repository, pr, message) {
  try {
    logger.info(`Rejecting PR #${pr.number}`);
    await execa('gh', [
      'pr', 'review', pr.number.toString(),
      '--request-changes',
      '--body', message,
      '--repo', repository
    ], { stdio: 'inherit' });
    logger.info(`PR #${pr.number} rejected`);
  } catch (error) {
    logger.error(`Failed to reject PR #${pr.number}: ${error.message}`);
  }
}

async function mergePR(repository, pr) {
  try {
    logger.info(`Merging PR #${pr.number}`);
    await execa('gh', [
      'pr', 'merge', pr.number.toString(),
      '--auto',
      '--squash',
      '--repo', repository
    ], { stdio: 'inherit' });
    logger.info(`PR #${pr.number} merged successfully`);
  } catch (error) {
    logger.error(`Failed to merge PR #${pr.number}: ${error.message}`);
  }
}

async function fixPR(repository, pr, repoDir) {
  const originalDir = process.cwd();

  try {
    const guidelines = await fs.readFile('agents.md', 'utf-8');
    const promptTemplate = await fs.readFile('context/fix-prompt.md', 'utf-8');

    // Replace placeholders in template
    const prompt = promptTemplate
      .replace(/\{\{repository\}\}/g, repository)
      .replace(/\{\{pr\.number\}\}/g, pr.number)
      .replace(/\{\{pr\.title\}\}/g, pr.title)
      .replace(/\{\{pr\.headRefName\}\}/g, pr.headRefName)
      .replace(/\{\{guidelines\}\}/g, guidelines);

    logger.info(`Fixing issues in PR #${pr.number}`);

    console.log('\n--- PROMPT TO GEMINI ---');
    console.log(prompt);
    console.log('--- END PROMPT ---\n');

    process.chdir(repoDir);

    const geminiArgs = ['-p', prompt];
    if (config.geminiYolo) {
      geminiArgs.push('-y');
      logger.info('YOLO mode enabled - auto-approving all actions');
    }

    await execa('gemini', geminiArgs, { stdio: 'inherit' });

  } finally {
    process.chdir(originalDir);
  }
}

export async function delegateToGemini(repository, pr, repoDir) {
  if (config.dryRun) {
    console.log(`\n[DRY RUN] Mode: ${config.reviewMode}, PR #${pr.number}`);
    return;
  }

  try {
    if (config.reviewMode === 'comment') {
      const { decision, message, hasPostedComments } = await addReviewComments(repository, pr, repoDir);

      if (hasPostedComments) {
        logger.info('Gemini already posted review comments, skipping duplicate summary comment');
      } else {
        logger.info('Gemini did not post comments, posting summary via gh CLI');
        if (decision === 'APPROVE') {
          await approvePR(repository, pr, message);
        } else {
          await rejectPR(repository, pr, message);
        }
      }

      // Auto merge if approved and AUTO_MERGE is enabled
      if (decision === 'APPROVE' && config.autoMerge) {
        logger.info('AUTO_MERGE enabled and PR approved, attempting to merge...');
        try {
          await mergePR(repository, pr);
          notify.success(pr.number, repository, 'PR approved and merged successfully');
        } catch (error) {
          if (error.message.includes('conflict') || error.message.includes('mergeable')) {
            notify.manualMerge(pr.number, repository, 'Merge conflicts detected - cannot auto-merge');
          } else {
            logger.error(`Merge failed: ${error.message}`);
          }
        }
      } else if (decision === 'APPROVE') {
        notify.success(pr.number, repository, 'PR approved');
      } else {
        // Count issues from message
        const issuesCount = (message.match(/\d+\./g) || []).length;
        notify.requestChanges(pr.number, repository, issuesCount);
      }
    } else if (config.reviewMode === 'fix') {
      await fixPR(repository, pr, repoDir);
    } else {
      logger.error(`Unknown review mode: ${config.reviewMode}`);
    }
  } catch (error) {
    logger.error(`Failed to process PR #${pr.number}: ${error.message}`);
  }
}
