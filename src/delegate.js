import { execa } from 'execa';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import stripAnsi from 'strip-ansi';
import chalk from 'chalk';
import { logger, notify } from './logger.js';
import { config } from './config.js';
import { prReviewDB } from './database.js';

// ─────────────────────────────────────────────
// Helper: verbose execa wrapper
// Line-buffers stdout/stderr so each \n-terminated
// line is printed whole — avoids partial-chunk splits
// ─────────────────────────────────────────────
async function execaVerbose(cmd, args, opts = {}) {
  const { allowFail, input, ...execaOpts } = opts;
  const label = chalk.magenta(`[exec]`) + ' ' + chalk.white(`${cmd} ${args.join(' ')}`);
  logger.info(`▶ ${label}`);

  const proc = execa(cmd, args, {
    ...execaOpts,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: input !== undefined ? 'pipe' : 'ignore',
    reject: false,
  });

  // Pipe prompt via stdin to avoid OS ARG_MAX limits
  if (input !== undefined && proc.stdin) {
    proc.stdin.write(input);
    proc.stdin.end();
  }

  const stdoutLines = [];
  const stderrLines = [];
  let stdoutBuf = '';
  let stderrBuf = '';

  function flushLines(buf, lines, color) {
    const parts = buf.split('\n');
    const remaining = parts.pop(); // last segment may be incomplete
    for (const part of parts) {
      const cleaned = stripAnsi(part);
      if (cleaned.trim()) {
        process.stdout.write(color('  │ ') + cleaned + '\n');
        lines.push(cleaned);
      }
    }
    return remaining; // return incomplete tail
  }

  if (proc.stdout) {
    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      stdoutBuf = flushLines(stdoutBuf, stdoutLines, chalk.gray);
    });
  }

  if (proc.stderr) {
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      stderrBuf = flushLines(stderrBuf, stderrLines, chalk.yellow);
    });
  }

  const result = await proc;

  // Flush any remaining partial line after process ends
  if (stdoutBuf.trim()) {
    const cleaned = stripAnsi(stdoutBuf);
    process.stdout.write(chalk.gray('  │ ') + cleaned + '\n');
    stdoutLines.push(cleaned);
  }
  if (stderrBuf.trim()) {
    const cleaned = stripAnsi(stderrBuf);
    process.stdout.write(chalk.yellow('  │ ') + cleaned + '\n');
    stderrLines.push(cleaned);
  }

  if (result.exitCode !== 0) {
    logger.warn(`✖ ${cmd} exited with code ${result.exitCode}`);
  } else {
    logger.info(`✔ ${cmd} completed (exit 0)`);
  }

  if (result.exitCode !== 0 && !allowFail) {
    const err = new Error(result.stderr || `${cmd} failed with exit code ${result.exitCode}`);
    err.exitCode = result.exitCode;
    throw err;
  }

  return {
    stdout: stdoutLines.join('\n'),
    stderr: stderrLines.join('\n'),
    exitCode: result.exitCode,
  };
}

// ─────────────────────────────────────────────
// Core: Execute AI review via configured executor
// ─────────────────────────────────────────────
async function executeAIReview(prompt, repoDir, mode = 'review') {
  const originalDir = process.cwd();

  // ── Store prompt to temp file FIRST (avoids OS ARG_MAX limit for long prompts) ──
  const promptFile = path.join(os.tmpdir(), `review-prompt-${Date.now()}.md`);
  await fs.writeFile(promptFile, prompt, 'utf-8');

  try {
    process.chdir(repoDir);

    const executor = config.aiExecutor.toLowerCase();

    // Validate executor enabled
    const enabledMap = {
      gemini: config.geminiEnabled,
      copilot: config.copilotEnabled,
      kiro: config.kiroEnabled,
      claude: config.claudeEnabled,
      codex: config.codexEnabled,
      opencode: config.opencodeEnabled,
    };

    if (enabledMap[executor] === false) {
      throw new Error(`${executor} executor is disabled. Check your .env configuration.`);
    }

    // ── Log prompt header ──
    logger.info(`Executor: ${chalk.bold(executor.toUpperCase())} | Mode: ${chalk.bold(mode.toUpperCase())}`);
    logger.info(`Prompt: ${prompt.length} chars → stored at ${promptFile}`);
    console.log('\n' + chalk.bold.cyan('┌─── PROMPT TO ' + executor.toUpperCase() + ' (' + mode.toUpperCase() + ') ───'));
    console.log(chalk.cyan('│'));
    prompt.split('\n').forEach(line => console.log(chalk.cyan('│') + ' ' + chalk.white(line)));
    console.log(chalk.bold.cyan('└───────────────────────────────────────') + '\n');

    // ── Build executor args — flags only, prompt via stdin ──
    let cliCmd = '';
    let args = [];

    if (executor === 'copilot') {
      cliCmd = 'copilot';
      args = ['--yolo', '--allow-all-tools', '--model', config.copilotModel];
      if (mode === 'review') args.push('--silent');
      logger.info('YOLO mode: --yolo --allow-all-tools | prompt → stdin');

    } else if (executor === 'kiro') {
      cliCmd = 'kiro-cli';
      args = ['chat', '--no-interactive', '--trust-all-tools'];
      if (config.kiroAgent && config.kiroAgent !== 'auto') {
        args.unshift('--agent', config.kiroAgent);
      }
      logger.info('YOLO mode: --no-interactive --trust-all-tools | prompt → stdin');

    } else if (executor === 'claude') {
      cliCmd = 'claude';
      args = ['--dangerously-skip-permissions'];
      if (config.claudeModel) args.push('--model', config.claudeModel);
      if (config.claudeAgent) args.push('--agent', config.claudeAgent);
      logger.info('YOLO mode: --dangerously-skip-permissions | prompt → stdin');

    } else if (executor === 'codex') {
      cliCmd = 'codex';
      args = ['exec', '--dangerously-bypass-approvals-and-sandbox'];
      if (config.codexModel && config.codexModel !== 'auto') {
        args.push('--model', config.codexModel);
      }
      logger.info('YOLO mode: --dangerously-bypass-approvals-and-sandbox | prompt → stdin');

    } else if (executor === 'opencode') {
      cliCmd = 'opencode';
      args = ['run', '--yolo'];
      if (config.opencodeModel && config.opencodeModel !== 'auto') {
        args.push('--model', config.opencodeModel);
      }
      if (config.opencodeAgent) args.push('--agent', config.opencodeAgent);
      logger.info('YOLO mode: --yolo | prompt → stdin');

    } else {
      // Gemini (default) — --yolo enables headless, prompt via stdin
      cliCmd = 'gemini';
      args = ['--yolo'];
      if (config.geminiModel && !config.geminiModel.startsWith('auto')) {
        args.push('--model', config.geminiModel);
      }
      logger.info('YOLO mode: --yolo | prompt → stdin');
    }

    logger.info(`Spawning: ${chalk.bold(cliCmd)} (prompt ${prompt.length} chars → stdin)`);
    console.log('');

    const { stdout, stderr } = await execaVerbose(cliCmd, args, { input: prompt });
    // stdout only: used for parsing AI response (MESSAGE, DECISION, SEVERITY_SCORE)
    const output = stripAnsi(stdout.trim());
    // stdout+stderr: used only for tool detection (hasPostedComments)
    // Gemini CLI prints startup logs + tool call results to stderr — don't mix into AI response
    const outputForDetection = stripAnsi((stdout + '\n' + stderr).trim());

    console.log('\n' + chalk.bold.green('┌─── ' + executor.toUpperCase() + ' OUTPUT ───'));
    output.split('\n').forEach(line => console.log(chalk.green('│') + ' ' + line));
    console.log(chalk.bold.green('└───────────────────────────────────────') + '\n');

    return output;

  } finally {
    process.chdir(originalDir);
    // Clean up temp prompt file
    fs.remove(promptFile).catch(() => { });
  }
}

// ─────────────────────────────────────────────
// Add review comments by calling AI agent
// ─────────────────────────────────────────────
async function addReviewComments(repository, pr, repoDir) {
  try {
    logger.info(`╔══ STEP: addReviewComments — PR #${pr.number} (${repository})`);

    const guidelines = await fs.readFile('agents.md', 'utf-8');
    const promptTemplate = await fs.readFile('context/review-prompt.md', 'utf-8');

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

    logger.info(`Executor: ${config.aiExecutor.toUpperCase()}`);
    logger.info(`Severity threshold: ${config.severityThreshold} (Critical:${config.severityCritical}, High:${config.severityHigh}, Medium:${config.severityMedium}, Low:${config.severityLow})`);
    logger.info(`Prompt length: ${prompt.length} chars`);

    logger.info('► Delegating code review to AI agent...');
    const output = await executeAIReview(prompt, repoDir, 'review');

    // ── Parse AI output ──
    logger.info('► Parsing AI response...');

    const severityScoreMatch = output.match(/\*?\*?SEVERITY_SCORE\*?\*?:\s*(\d+)/i);
    const severityBreakdownMatch = output.match(/\*?\*?SEVERITY_BREAKDOWN\*?\*?:\s*([^\n]+)/i);
    const decisionMatch = output.match(/\*?\*?DECISION\*?\*?:\s*(APPROVE|REQUEST_CHANGES)/i);
    const messageMatch = output.match(/\*?\*?MESSAGE\*?\*?:\s*(.+)/is);

    logger.info(`  Parsed SEVERITY_SCORE: ${severityScoreMatch ? severityScoreMatch[1] : 'not found'}`);
    logger.info(`  Parsed SEVERITY_BREAKDOWN: ${severityBreakdownMatch ? severityBreakdownMatch[1].trim() : 'not found'}`);
    logger.info(`  Parsed DECISION: ${decisionMatch ? decisionMatch[1] : 'not found (using fallback REQUEST_CHANGES)'}`);
    logger.info(`  Parsed MESSAGE: ${messageMatch ? 'found (' + messageMatch[1].trim().substring(0, 80) + '...)' : 'not found'}`);

    if (!decisionMatch || !messageMatch) {
      logger.warn(`${config.aiExecutor.toUpperCase()} response does not match expected format. Using fallback.`);
    }

    const severityScore = severityScoreMatch ? parseInt(severityScoreMatch[1], 10) : 0;
    const severityBreakdown = severityBreakdownMatch ? severityBreakdownMatch[1].trim() : 'N/A';

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

    if (!message) {
      if (output) {
        message = output
          .replace(/\*?\*?SEVERITY_SCORE\*?\*?:\s*\d+/ig, '')
          .replace(/\*?\*?SEVERITY_BREAKDOWN\*?\*?:\s*[^\n]+/ig, '')
          .replace(/\*?\*?DECISION\*?\*?:\s*(APPROVE|REQUEST_CHANGES)/ig, '')
          .trim();
      }
      if (!message) {
        message = 'Review telah dilakukan. Silakan periksa komentar yang diberikan untuk detail lebih lanjut.';
      }
      logger.warn('Failed to parse MESSAGE block. Using cleaned raw AI output as fallback.');
    }

    // Override decision if Critical/High found
    if ((hasCritical || hasHigh) && decision === 'APPROVE') {
      logger.warn(`Overriding APPROVE → REQUEST_CHANGES due to ${hasCritical ? 'CRITICAL' : 'HIGH'} severity issues`);
      decision = 'REQUEST_CHANGES';
    }

    // Detect if AI successfully posted comments — use combined stdout+stderr for detection
    // Exclude lines that are error messages (tool call failed but name appears in error text)
    const toolErrorLines = outputForDetection.split('\n').filter(l =>
      l.includes('Error executing tool') ||
      l.includes('reported an error') ||
      l.includes('params must have required property')
    );
    const failedTools = new Set(
      toolErrorLines.flatMap(l => {
        const m = l.match(/Error executing tool\s+(\S+)/);
        return m ? [m[1]] : [];
      })
    );

    const commentToolSucceeded = outputForDetection.includes('add_comment_to_pending_review') &&
      !failedTools.has('add_comment_to_pending_review');
    // submit_pending = submit pending review with inline comments; create = standalone review
    const reviewWriteSucceeded = outputForDetection.includes('pull_request_review_write') &&
      (!failedTools.has('pull_request_review_write'));

    if (failedTools.size > 0) {
      logger.warn(`Tools that failed during review: ${[...failedTools].join(', ')}`);
      logger.warn('Fallback review will be submitted to ensure PR gets a response.');
    }

    // Final safety check via GitHub API: if PR already has a submitted review,
    // treat as posted to prevent duplicate submission regardless of text detection
    let alreadyReviewedViaAPI = false;
    try {
      const { stdout: reviewsJson } = await execaVerbose(
        'gh', ['api', `repos/${repository}/pulls/${pr.number}/reviews`, '--jq', '[.[] | select(.state != "PENDING")]'],
        { allowFail: true }
      );
      const existingReviews = JSON.parse(reviewsJson || '[]');
      if (existingReviews.length > 0) {
        logger.info(`GitHub API: found ${existingReviews.length} submitted review(s) on PR #${pr.number} — skipping fallback.`);
        alreadyReviewedViaAPI = true;
      }
    } catch (_) {
      logger.warn('Could not verify existing reviews via API — falling back to text detection.');
    }

    const hasPostedComments = alreadyReviewedViaAPI ||
      outputForDetection.includes('gh pr review') ||
      outputForDetection.includes('review submitted') ||
      outputForDetection.includes('comment added') ||
      commentToolSucceeded ||
      reviewWriteSucceeded;

    // ── Summary log ──
    console.log('\n' + chalk.bold.blue('┌─── REVIEW ANALYSIS SUMMARY ───'));
    console.log(chalk.blue(`│`) + ` Severity Score  : ${chalk.bold(severityScore)} (threshold: ${config.severityThreshold})`);
    console.log(chalk.blue(`│`) + ` Severity Detail : ${severityBreakdown}`);
    console.log(chalk.blue(`│`) + ` Has Critical    : ${hasCritical ? chalk.red('YES') : chalk.green('no')}`);
    console.log(chalk.blue(`│`) + ` Has High        : ${hasHigh ? chalk.yellow('YES') : chalk.green('no')}`);
    console.log(chalk.blue(`│`) + ` Decision        : ${decision === 'APPROVE' ? chalk.green(decision) : chalk.red(decision)}`);
    console.log(chalk.blue(`│`) + ` AI posted cmts  : ${hasPostedComments ? chalk.green('yes') : chalk.yellow('no')}`);
    console.log(chalk.bold.blue('└────────────────────────────────') + '\n');

    // ── Save to DB ──
    try {
      logger.info('► Saving review result to database...');
      prReviewDB.addReview({
        repository,
        pr_number: pr.number,
        pr_title: pr.title,
        pr_url: `https://github.com/${repository}/pull/${pr.number}`,
        decision,
        severity_score: severityScore,
        severity_breakdown: severityBreakdown,
        message: message.substring(0, 500),
      });
      logger.info('✔ Review saved to database');
    } catch (dbError) {
      logger.warn(`Failed to save review to database: ${dbError.message}`);
    }

    logger.info('╚══ addReviewComments complete\n');
    return { decision, message, hasPostedComments, severityScore, severityBreakdown };

  } catch (error) {
    logger.error(`Failed to execute AI review: ${error.message}`);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Submit review (approve or request changes)
// ─────────────────────────────────────────────
async function handleReviewSubmission(repository, prNumber, decision, message, hasPostedComments) {
  try {
    logger.info(`╔══ STEP: handleReviewSubmission — PR #${prNumber} → decision: ${chalk.bold(decision)}`);

    // Check for pending review
    logger.info(`► Checking for existing pending review on PR #${prNumber}...`);
    const { stdout } = await execaVerbose('gh', ['api', `repos/${repository}/pulls/${prNumber}/reviews`]);
    const reviews = JSON.parse(stdout || '[]');
    const pendingReview = reviews.find(r => r.state === 'PENDING');

    if (pendingReview) {
      logger.info(`Found pending review id=${pendingReview.id} — submitting as ${chalk.bold(decision)}...`);
      await execaVerbose('gh', [
        'api', '--method', 'POST',
        `repos/${repository}/pulls/${prNumber}/reviews/${pendingReview.id}/events`,
        '-f', `event=${decision}`,
        '-f', `body=${message}`,
      ]);
      logger.info(`✔ Pending review submitted as ${decision}`);
      logger.info('╚══ handleReviewSubmission complete\n');
      return;
    }

    if (hasPostedComments) {
      logger.info('AI already posted review comments. No pending review remains — skipping fallback to prevent duplicate comments.');
      logger.info('╚══ handleReviewSubmission complete\n');
      return;
    }

    logger.info('No pending review & AI did not post inline comments. Creating fallback summary review...');
    const args = ['pr', 'review', prNumber.toString(), '--body', message, '--repo', repository];
    if (decision === 'APPROVE') {
      args.push('--approve');
      logger.info(`► Approving PR #${prNumber}...`);
    } else {
      args.push('--request-changes');
      logger.info(`► Requesting changes on PR #${prNumber}...`);
    }

    await execaVerbose('gh', args);
    logger.info(`✔ Fallback review (${decision}) submitted successfully`);
    logger.info('╚══ handleReviewSubmission complete\n');

  } catch (error) {
    logger.error(`Failed to handle review submission: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// Merge PR
// ─────────────────────────────────────────────
async function mergePR(repository, pr) {
  try {
    logger.info(`╔══ STEP: mergePR — PR #${pr.number} in ${repository}`);
    logger.info(`► Merging PR #${pr.number} via gh pr merge (squash)...`);

    await execaVerbose('gh', [
      'pr', 'merge', pr.number.toString(),
      '--auto',
      '--squash',
      '--repo', repository,
    ]);

    logger.info(`✔ PR #${pr.number} merged successfully`);
    logger.info('╚══ mergePR complete\n');
  } catch (error) {
    logger.error(`Failed to merge PR #${pr.number}: ${error.message}`);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Fix PR issues via AI agent
// Runs on the PR's head branch (checkout enforced)
// ─────────────────────────────────────────────
async function fixPR(repository, pr, repoDir) {
  try {
    logger.info(`╔══ STEP: fixPR — PR #${pr.number} in ${repository}`);
    logger.info(`  Branch: ${chalk.bold(pr.headRefName)} (all changes will be committed here)`);

    // Ensure we are on the correct PR branch before running AI
    logger.info(`► Ensuring checkout of branch '${pr.headRefName}' before fixing...`);
    await execaVerbose('git', ['fetch', 'origin', pr.headRefName], { cwd: repoDir });
    await execaVerbose('git', ['checkout', pr.headRefName], { cwd: repoDir });
    await execaVerbose('git', ['pull', 'origin', pr.headRefName], { cwd: repoDir });
    logger.info(`✔ On branch '${pr.headRefName}' — ready for auto-fix`);

    const guidelines = await fs.readFile('agents.md', 'utf-8');
    const promptTemplate = await fs.readFile('context/fix-prompt.md', 'utf-8');

    const prompt = promptTemplate
      .replace(/\{\{repository\}\}/g, repository)
      .replace(/\{\{pr\.number\}\}/g, pr.number)
      .replace(/\{\{pr\.title\}\}/g, pr.title)
      .replace(/\{\{pr\.headRefName\}\}/g, pr.headRefName)
      .replace(/\{\{guidelines\}\}/g, guidelines);

    logger.info(`► Delegating auto-fix to ${config.aiExecutor.toUpperCase()} agent...`);
    await executeAIReview(prompt, repoDir, 'fix');

    logger.info('╚══ fixPR complete\n');
  } catch (error) {
    logger.error(`Failed to fix PR: ${error.message}`);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Public exports
// ─────────────────────────────────────────────
export { executeAIReview };

export async function delegateReview(repository, pr, repoDir) {
  if (config.dryRun) {
    console.log(chalk.yellow(`\n[DRY RUN] Mode: ${config.reviewMode}, PR #${pr.number} (${repository})`));
    return;
  }

  const isMasterBranch = pr.baseRefName === 'master' || pr.baseRefName === 'main';
  const originalMode = config.reviewMode;

  console.log('\n' + chalk.bold.magenta(`╔══════════════════════════════════════════════`));
  console.log(chalk.bold.magenta(`║ delegateReview  PR #${pr.number}: ${pr.title}`));
  console.log(chalk.bold.magenta(`║ Repository: ${repository}`));
  console.log(chalk.bold.magenta(`║ Branch: ${pr.headRefName} → ${pr.baseRefName}`));
  console.log(chalk.bold.magenta(`║ Mode: ${config.reviewMode.toUpperCase()}`));
  console.log(chalk.bold.magenta(`╚══════════════════════════════════════════════`) + '\n');

  if (isMasterBranch) {
    logger.warn(`PR #${pr.number} targets protected branch: ${pr.baseRefName}`);
    logger.warn('Forcing COMMENT mode and disabling AUTO_MERGE for safety');

    config.reviewMode = 'comment';
    const originalAutoMerge = config.autoMerge;
    config.autoMerge = false;

    try {
      if (originalMode === 'fix') {
        logger.info('Original mode was FIX, but switching to COMMENT for master branch');
      }

      const { decision, message, hasPostedComments, severityScore, severityBreakdown } =
        await addReviewComments(repository, pr, repoDir);

      await handleReviewSubmission(repository, pr.number, decision, message, hasPostedComments);

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
      config.reviewMode = originalMode;
      config.autoMerge = originalAutoMerge;
    }
    return;
  }

  // ── Normal flow ──
  try {
    if (config.reviewMode === 'comment') {
      const { decision, message, hasPostedComments, severityScore, severityBreakdown } =
        await addReviewComments(repository, pr, repoDir);

      await handleReviewSubmission(repository, pr.number, decision, message, hasPostedComments);

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

      if (decision === 'APPROVE' && config.autoMerge) {
        logger.info('AUTO_MERGE enabled and PR approved — attempting to merge...');
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
        const issuesCount = (message.match(/\d+\./g) || []).length;
        notify.requestChanges(pr.number, repository, issuesCount);
      }

      // Open PR in browser after review is done
      logger.info('► Opening PR in browser...');
      await execaVerbose('gh', ['pr', 'view', pr.number, '--repo', repository, '--web'], { allowFail: true });

    } else if (config.reviewMode === 'fix') {
      await fixPR(repository, pr, repoDir);
      
      // Open PR in browser after fix is done
      logger.info('► Opening PR in browser...');
      await execaVerbose('gh', ['pr', 'view', pr.number, '--repo', repository, '--web'], { allowFail: true });

    } else {
      logger.error(`Unknown review mode: ${config.reviewMode}`);
    }
  } catch (error) {
    logger.error(`Failed to process PR #${pr.number}: ${error.message}`);
  }
}
