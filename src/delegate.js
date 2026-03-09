import { execa } from 'execa';
import fs from 'fs-extra';
import { logger, notify } from './logger.js';
import { config } from './config.js';

async function executeAIReview(prompt, repoDir, mode = 'review') {
  const originalDir = process.cwd();

  try {
    process.chdir(repoDir);

    const executor = config.aiExecutor.toLowerCase();

    // Check if executor is enabled
    if (executor === 'gemini' && !config.geminiEnabled) {
      throw new Error('Gemini executor is disabled. Enable GEMINI_ENABLED=true in .env');
    }

    if (executor === 'copilot' && !config.copilotEnabled) {
      throw new Error('Copilot executor is disabled. Enable COPILOT_ENABLED=true in .env');
    }

    if (executor === 'kiro' && !config.kiroEnabled) {
      throw new Error('Kiro executor is disabled. Enable KIRO_ENABLED=true in .env');
    }

    if (executor === 'claude' && !config.claudeEnabled) {
      throw new Error('Claude executor is disabled. Enable CLAUDE_ENABLED=true in .env');
    }

    if (executor === 'codex' && !config.codexEnabled) {
      throw new Error('Codex executor is disabled. Enable CODEX_ENABLED=true in .env');
    }

    if (executor === 'opencode' && !config.opencodeEnabled) {
      throw new Error('OpenCode executor is disabled. Enable OPENCODE_ENABLED=true in .env');
    }

    console.log(`\n--- PROMPT TO ${executor.toUpperCase()} ---`);
    console.log(prompt);
    console.log('--- END PROMPT ---\n');

    let result;

    if (executor === 'copilot') {
      // GitHub Copilot CLI execution
      const copilotArgs = ['-p', prompt];

      if (config.copilotYolo) {
        copilotArgs.push('--yolo');
        logger.info('YOLO mode enabled - auto-approving all actions');
      } else {
        copilotArgs.push('--allow-all-tools');
      }

      // Add model selection
      copilotArgs.push('--model', config.copilotModel);

      // Silent mode for cleaner output
      if (mode === 'review') {
        copilotArgs.push('--silent');
      }

      result = await execa('copilot', copilotArgs);

    } else if (executor === 'kiro') {
      // Kiro CLI execution
      const kiroArgs = ['chat', prompt];

      // Add agent selection if not auto
      if (config.kiroAgent && config.kiroAgent !== 'auto') {
        kiroArgs.unshift('--agent', config.kiroAgent);
      }

      // Note: Kiro CLI doesn't support --yolo flag
      // YOLO mode is informational only for Kiro
      if (config.kiroYolo) {
        logger.info('YOLO mode enabled (Kiro will use default approval behavior)');
      }

      result = await execa('kiro-cli', kiroArgs);

    } else if (executor === 'claude') {
      // Claude Code CLI execution
      const claudeArgs = ['--print', prompt];

      // Add model selection
      if (config.claudeModel) {
        claudeArgs.push('--model', config.claudeModel);
      }

      // Add agent if specified
      if (config.claudeAgent) {
        claudeArgs.push('--agent', config.claudeAgent);
      }

      if (config.claudeYolo) {
        claudeArgs.push('--dangerously-skip-permissions');
        logger.info('YOLO mode enabled - skipping all permissions');
      }

      result = await execa('claude', claudeArgs);

    } else if (executor === 'codex') {
      // Codex CLI execution
      const codexArgs = ['exec', prompt];

      // Add model selection
      if (config.codexModel && config.codexModel !== 'auto') {
        codexArgs.push('--model', config.codexModel);
      }

      if (config.codexYolo) {
        codexArgs.push('--dangerously-bypass-approvals-and-sandbox');
        logger.info('YOLO mode enabled - bypassing all approvals');
      }

      result = await execa('codex', codexArgs);

    } else if (executor === 'opencode') {
      // OpenCode CLI execution
      const opencodeArgs = ['run', prompt];

      // Add model selection
      if (config.opencodeModel && config.opencodeModel !== 'auto') {
        opencodeArgs.push('--model', config.opencodeModel);
      }

      // Add agent if specified
      if (config.opencodeAgent) {
        opencodeArgs.push('--agent', config.opencodeAgent);
      }

      result = await execa('opencode', opencodeArgs);

    } else {
      // Gemini CLI execution (default)
      const geminiArgs = ['-p', prompt];

      // Add model selection if not auto
      if (config.geminiModel && !config.geminiModel.startsWith('auto')) {
        geminiArgs.push('--model', config.geminiModel);
      }

      if (config.geminiYolo) {
        geminiArgs.push('-y');
        logger.info('YOLO mode enabled - auto-approving all actions');
      }

      result = await execa('gemini', geminiArgs);
    }

    const output = result.stdout.trim();

    console.log(`\n--- ${executor.toUpperCase()} OUTPUT ---`);
    console.log(output);
    console.log('--- END OUTPUT ---\n');

    return output;

  } finally {
    process.chdir(originalDir);
  }
}

async function addReviewComments(repository, pr, repoDir) {
  try {
    const guidelines = await fs.readFile('agents.md', 'utf-8');
    const promptTemplate = await fs.readFile('context/review-prompt.md', 'utf-8');

    // Replace placeholders in template
    const prompt = promptTemplate
      .replace(/\{\{repository\}\}/g, repository)
      .replace(/\{\{pr\.number\}\}/g, pr.number)
      .replace(/\{\{pr\.title\}\}/g, pr.title)
      .replace(/\{\{guidelines\}\}/g, guidelines);

    logger.info(`Adding review comments for PR #${pr.number} using ${config.aiExecutor.toUpperCase()}`);

    const output = await executeAIReview(prompt, repoDir, 'review');

    const decisionMatch = output.match(/DECISION:\s*(APPROVE|REQUEST_CHANGES)/i);
    const messageMatch = output.match(/MESSAGE:\s*(.+)/is);

    if (!decisionMatch || !messageMatch) {
      logger.warn(`${config.aiExecutor.toUpperCase()} response does not match expected format. Using fallback.`);
    }

    const decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'REQUEST_CHANGES';
    const message = messageMatch ? messageMatch[1].trim() : 'Review telah dilakukan. Silakan periksa komentar yang diberikan untuk detail lebih lanjut.';

    // Check if AI already posted comments by looking for gh commands in output
    const hasPostedComments = output.includes('gh pr review') ||
      output.includes('gh api') ||
      output.includes('review submitted') ||
      output.includes('comment added');

    logger.info(`Decision: ${decision}`);
    logger.info(`Message: ${message}`);
    logger.info(`${config.aiExecutor.toUpperCase()} already posted comments: ${hasPostedComments}`);

    return { decision, message, hasPostedComments };

  } catch (error) {
    logger.error(`Failed to execute AI review: ${error.message}`);
    throw error;
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

    logger.info(`Fixing issues in PR #${pr.number} using ${config.aiExecutor.toUpperCase()}`);

    await executeAIReview(prompt, repoDir, 'fix');

  } catch (error) {
    logger.error(`Failed to fix PR: ${error.message}`);
    throw error;
  }
}

export async function delegateToGemini(repository, pr, repoDir) {
  if (config.dryRun) {
    console.log(`\n[DRY RUN] Mode: ${config.reviewMode}, PR #${pr.number}`);
    return;
  }

  // Check if PR targets master/main branch
  const isMasterBranch = pr.baseRefName === 'master' || pr.baseRefName === 'main';
  const originalMode = config.reviewMode;

  if (isMasterBranch) {
    logger.warn(`PR #${pr.number} targets protected branch: ${pr.baseRefName}`);
    logger.warn('Forcing COMMENT mode and disabling AUTO_MERGE for safety');

    // Override config for this PR
    config.reviewMode = 'comment';
    const originalAutoMerge = config.autoMerge;
    config.autoMerge = false;

    try {
      if (originalMode === 'fix') {
        logger.info('Original mode was FIX, but switching to COMMENT for master branch');
      }

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

      // For master branch, always require manual merge
      if (decision === 'APPROVE') {
        notify.manualMerge(
          pr.number,
          repository,
          `PR targets protected branch '${pr.baseRefName}' - Manual merge required for safety`
        );
      } else {
        const issuesCount = (message.match(/\d+\./g) || []).length;
        notify.requestChanges(pr.number, repository, issuesCount);
      }
    } finally {
      // Restore original config
      config.reviewMode = originalMode;
      config.autoMerge = originalAutoMerge;
    }
    return;
  }

  // Normal flow for non-master branches
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
