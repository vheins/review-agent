import { execa } from 'execa';
import fs from 'fs-extra';
import stripAnsi from 'strip-ansi';
import { logger, notify } from './logger.js';
import { config } from './config.js';
import { prReviewDB } from './database.js';

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

      // Add non-interactive mode for automation
      kiroArgs.push('--no-interactive', '--trust-all-tools');

      if (config.kiroYolo) {
        logger.info('YOLO mode enabled - trusting all tools');
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

      // Always run Gemini in YOLO mode
      geminiArgs.push('-y');
      logger.info('YOLO mode enabled - auto-approving all actions');

      result = await execa('gemini', geminiArgs);
    }

    const output = stripAnsi(result.stdout.trim());

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
      .replace(/\{\{guidelines\}\}/g, guidelines)
      .replace(/\{\{severityThreshold\}\}/g, config.severityThreshold)
      .replace(/\{\{severityCritical\}\}/g, config.severityCritical)
      .replace(/\{\{severityHigh\}\}/g, config.severityHigh)
      .replace(/\{\{severityMedium\}\}/g, config.severityMedium)
      .replace(/\{\{severityLow\}\}/g, config.severityLow);

    logger.info(`Adding review comments for PR #${pr.number} using ${config.aiExecutor.toUpperCase()}`);
    logger.info(`Severity threshold: ${config.severityThreshold} (Critical:${config.severityCritical}, High:${config.severityHigh}, Medium:${config.severityMedium}, Low:${config.severityLow})`);

    const output = await executeAIReview(prompt, repoDir, 'review');

    const severityScoreMatch = output.match(/\*?\*?SEVERITY_SCORE\*?\*?:\s*(\d+)/i);
    const severityBreakdownMatch = output.match(/\*?\*?SEVERITY_BREAKDOWN\*?\*?:\s*([^\n]+)/i);
    const decisionMatch = output.match(/\*?\*?DECISION\*?\*?:\s*(APPROVE|REQUEST_CHANGES)/i);
    const messageMatch = output.match(/\*?\*?MESSAGE\*?\*?:\s*(.+)/is);

    if (!decisionMatch || !messageMatch) {
      logger.warn(`${config.aiExecutor.toUpperCase()} response does not match expected format. Using fallback.`);
    }

    const severityScore = severityScoreMatch ? parseInt(severityScoreMatch[1], 10) : 0;
    const severityBreakdown = severityBreakdownMatch ? severityBreakdownMatch[1].trim() : 'N/A';

    // Parse severity breakdown to check for Critical/High issues
    let hasCritical = false;
    let hasHigh = false;
    if (severityBreakdownMatch) {
      const criticalMatch = severityBreakdown.match(/Critical:\s*(\d+)/i);
      const highMatch = severityBreakdown.match(/High:\s*(\d+)/i);
      hasCritical = criticalMatch && parseInt(criticalMatch[1], 10) > 0;
      hasHigh = highMatch && parseInt(highMatch[1], 10) > 0;
    }

    let decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'REQUEST_CHANGES';
    let message = messageMatch ? messageMatch[1].trim() : '';
    // If we couldn't parse a proper MESSAGE block or the AI didn't provide one, 
    // fallback to using the entire raw AI output (stripped of metadata keywords) so the user sees the actual review
    if (!message) {
      if (output) {
         message = output
           .replace(/\*?\*?SEVERITY_SCORE\*?\*?:\s*\d+/ig, '')
           .replace(/\*?\*?SEVERITY_BREAKDOWN\*?\*?:\s*[^\n]+/ig, '')
           .replace(/\*?\*?DECISION\*?\*?:\s*(APPROVE|REQUEST_CHANGES)/ig, '')
           .trim();
      }
      // Ultimate fallback if somehow the output was completely empty
      if (!message) {
         message = 'Review telah dilakukan. Silakan periksa komentar yang diberikan untuk detail lebih lanjut.';
      }
      logger.warn('Failed to parse MESSAGE block. Using cleaned raw AI output as fallback.');
    }

    // Override decision if Critical or High issues found
    if ((hasCritical || hasHigh) && decision === 'APPROVE') {
      logger.warn(`Overriding APPROVE decision due to ${hasCritical ? 'CRITICAL' : 'HIGH'} severity issues`);
      decision = 'REQUEST_CHANGES';
    }

    // Check if AI already posted comments by looking for gh/mcp commands in output
    const hasPostedComments = output.includes('gh pr review') ||
      output.includes('gh api') ||
      output.includes('review submitted') ||
      output.includes('comment added') ||
      output.includes('add_comment_to_pending_review') ||
      output.includes('pull_request_review_write');
    logger.info(`Severity Score: ${severityScore} (Threshold: ${config.severityThreshold})`);
    logger.info(`Severity Breakdown: ${severityBreakdown}`);
    logger.info(`Has Critical: ${hasCritical}, Has High: ${hasHigh}`);
    logger.info(`Decision: ${decision}${(hasCritical || hasHigh) && decisionMatch && decisionMatch[1].toUpperCase() === 'APPROVE' ? ' (OVERRIDDEN due to Critical/High issues)' : ''}`);
    logger.info(`Message: ${message}`);
    logger.info(`${config.aiExecutor.toUpperCase()} already posted comments: ${hasPostedComments}`);

    // Save review to database
    try {
      prReviewDB.addReview({
        repository,
        pr_number: pr.number,
        pr_title: pr.title,
        pr_url: `https://github.com/${repository}/pull/${pr.number}`,
        decision,
        severity_score: severityScore,
        severity_breakdown: severityBreakdown,
        message: message.substring(0, 500) // Limit message length
      });
      logger.info('Review saved to database');
    } catch (dbError) {
      logger.warn(`Failed to save review to database: ${dbError.message}`);
    }

    return { decision, message, hasPostedComments, severityScore, severityBreakdown };

  } catch (error) {
    logger.error(`Failed to execute AI review: ${error.message}`);
    throw error;
  }
}

async function handleReviewSubmission(repository, prNumber, decision, message, hasPostedComments) {
  try {
    const { stdout } = await execa('gh', ['api', `repos/${repository}/pulls/${prNumber}/reviews`]);
    const reviews = JSON.parse(stdout);
    const pendingReview = reviews.find(r => r.state === 'PENDING');
    
    if (pendingReview) {
      logger.info(`Found pending review (${pendingReview.id}). Submitting it to prevent orphaned inline comments.`);
      await execa('gh', [
        'api', '--method', 'POST', 
        `repos/${repository}/pulls/${prNumber}/reviews/${pendingReview.id}/events`,
        '-f', `event=${decision}`,
        '-f', `body=${message}`
      ]);
      logger.info(`Pending review submitted successfully as ${decision}`);
      return;
    }
    
    if (hasPostedComments) {
      logger.info('AI already posted review comments and no pending review remains. Skipping fallback to prevent double comments.');
      return;
    }
    
    logger.info('AI did not post inline comments and no pending review found. Posting fallback summary review.');
    const args = ['pr', 'review', prNumber.toString(), '--body', message, '--repo', repository];
    if (decision === 'APPROVE') {
      args.push('--approve');
    } else {
      args.push('--request-changes');
    }
    
    await execa('gh', args, { stdio: 'inherit' });
    logger.info(`Fallback review (${decision}) created successfully.`);
  } catch (error) {
     logger.error(`Failed to handle review submission: ${error.message}`);
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

export { executeAIReview };

export async function delegateReview(repository, pr, repoDir) {
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

      const { decision, message, hasPostedComments, severityScore, severityBreakdown } = await addReviewComments(repository, pr, repoDir);

      await handleReviewSubmission(repository, pr.number, decision, message, hasPostedComments);

      // Auto-fix minor issues if approved with low severity score (even for master branch)
      if (decision === 'APPROVE' && severityScore > 0 && severityScore < config.severityThreshold) {
        logger.info(`PR approved but has minor issues (score: ${severityScore}). Running auto-fix...`);
        logger.info(`Severity breakdown: ${severityBreakdown}`);

        try {
          await fixPR(repository, pr, repoDir);
          logger.info('Auto-fix completed for minor issues');
        } catch (fixError) {
          logger.warn(`Auto-fix failed: ${fixError.message}`);
          logger.warn('PR remains approved, but manual fixes may be needed');
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
      const { decision, message, hasPostedComments, severityScore, severityBreakdown } = await addReviewComments(repository, pr, repoDir);

      await handleReviewSubmission(repository, pr.number, decision, message, hasPostedComments);

      // Auto-fix minor issues if approved with low severity score
      if (decision === 'APPROVE' && severityScore > 0 && severityScore < config.severityThreshold) {
        logger.info(`PR approved but has minor issues (score: ${severityScore}). Running auto-fix...`);
        logger.info(`Severity breakdown: ${severityBreakdown}`);

        try {
          await fixPR(repository, pr, repoDir);
          logger.info('Auto-fix completed for minor issues');
        } catch (fixError) {
          logger.warn(`Auto-fix failed: ${fixError.message}`);
          logger.warn('PR remains approved, but manual fixes may be needed');
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
