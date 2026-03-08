import { execa } from 'execa';
import fs from 'fs-extra';
import { logger } from './logger.js';
import { config } from './config.js';

async function addReviewComments(repository, pr, repoDir) {
  const originalDir = process.cwd();
  
  try {
    const guidelines = await fs.readFile('agents.md', 'utf-8');
    
    const prompt = `You are a code reviewer. Review this Pull Request and provide comments in Indonesian.

Repository: ${repository}
Pull Request: #${pr.number} ${pr.title}

Review guidelines:
${guidelines}

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE STEPS:

STEP 1: Get the list of changed files in this PR
PREFERRED: Use GitHub MCP if available (check your available tools)
FALLBACK: Use gh CLI command: gh pr diff ${pr.number} --repo ${repository}

STEP 2: Review each changed file carefully
For EACH file that has issues, you MUST add inline comments.

PREFERRED METHOD (if GitHub MCP is available):
Use the GitHub MCP tools to:
- Get PR details and diff
- Add review comments with create_review or add_review_comment
- Submit review with REQUEST_CHANGES or APPROVE

FALLBACK METHOD (if GitHub MCP not available):
Use gh CLI commands:

For general PR comment:
gh pr review ${pr.number} --comment-body "Your comment in Indonesian" --repo ${repository}

For inline comment on specific line:
gh pr review ${pr.number} --repo ${repository} --comment --body "Your detailed comment in Indonesian explaining the issue and how to fix it"

For multiple inline comments using gh api:
gh api repos/${repository}/pulls/${pr.number}/reviews \\
  -f body="Review summary in Indonesian" \\
  -f event=COMMENT \\
  -f comments[][path]="path/to/file.js" \\
  -f comments[][line]=10 \\
  -f comments[][body]="Issue description in Indonesian"

STEP 3: Focus on these issues:
- Security vulnerabilities (SQL injection, XSS, etc)
- Bugs and logic errors
- Performance problems
- Code quality issues
- Missing error handling
- Unused variables or imports
- Best practices violations

STEP 4: Write comments in Indonesian
- Be specific about the issue
- Explain why it's a problem
- Suggest how to fix it
- Reference the exact line number

STEP 5: After adding all comments, respond with:
DECISION: [APPROVE or REQUEST_CHANGES]
MESSAGE: [Summary in Indonesian listing all issues found with file names and line numbers]

Example MESSAGE format:
Ditemukan beberapa masalah yang perlu diperbaiki:
1. file.js:45 - Potensi SQL injection pada query user
2. handler.php:120 - Missing error handling untuk API call
3. utils.ts:67 - Variabel 'unused' tidak digunakan

Your response:`;

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
    
    logger.info(`Decision: ${decision}`);
    logger.info(`Message: ${message}`);
    
    return { decision, message };
    
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

async function fixPR(repository, pr, repoDir) {
  const originalDir = process.cwd();
  
  try {
    const guidelines = await fs.readFile('agents.md', 'utf-8');
    
    const prompt = `You are a code reviewer and fixer. Review and FIX issues in this Pull Request.

Repository: ${repository}
Pull Request: #${pr.number} ${pr.title}

Review guidelines:
${guidelines}

IMPORTANT INSTRUCTIONS:
1. Review all changed files in this PR
2. Identify issues: bugs, security problems, performance issues, code quality problems
3. DIRECTLY FIX the issues by modifying the files
4. After fixing, commit the changes with descriptive commit messages in Indonesian
5. Use: git add . && git commit -m "fix: description of fixes" && git push origin ${pr.headRefName}

Fix the code now.`;

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
      const { decision, message } = await addReviewComments(repository, pr, repoDir);
      
      if (decision === 'APPROVE') {
        await approvePR(repository, pr, message);
      } else {
        await rejectPR(repository, pr, message);
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
