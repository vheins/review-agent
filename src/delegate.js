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

IMPORTANT INSTRUCTIONS:
1. Review all changed files in this PR
2. For each issue found, create a review comment using GitHub CLI
3. Use this command format for inline comments:
   gh pr review ${pr.number} --comment-body "Your comment in Indonesian" --repo ${repository}
4. For file-specific comments with line numbers, use:
   gh api repos/${repository}/pulls/${pr.number}/comments -f body="Your comment" -f path="file/path" -F line=123 -f side="RIGHT"
5. Focus on: bugs, security issues, performance problems, code quality
6. Write all comments in Indonesian language
7. Be specific and constructive

After reviewing, you MUST respond with this EXACT format:
DECISION: [APPROVE or REQUEST_CHANGES]
MESSAGE: [Your summary message in Indonesian explaining what you found]

Example 1 (if issues found):
DECISION: REQUEST_CHANGES
MESSAGE: Ditemukan beberapa masalah: 1) Potensi SQL injection di query user, 2) Missing error handling di fungsi payment, 3) Variabel tidak digunakan di line 45.

Example 2 (if no issues):
DECISION: APPROVE
MESSAGE: Kode sudah baik, tidak ada masalah yang ditemukan. Semua best practices sudah diikuti.

Your response:`;

    logger.info(`Adding review comments for PR #${pr.number}`);
    process.chdir(repoDir);
    const result = await execa('gemini', ['-p', prompt], { stdio: 'inherit' });
    
    const output = result.stdout?.trim() || '';
    logger.info(`Gemini response:\n${output}`);
    
    const decisionMatch = output.match(/DECISION:\s*(APPROVE|REQUEST_CHANGES)/i);
    const messageMatch = output.match(/MESSAGE:\s*(.+)/is);
    
    if (!decisionMatch || !messageMatch) {
      logger.warn('Gemini response does not match expected format. Using fallback.');
    }
    
    const decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'REQUEST_CHANGES';
    const message = messageMatch ? messageMatch[1].trim() : 'Review telah dilakukan. Silakan periksa komentar yang diberikan untuk detail lebih lanjut.';
    
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
    process.chdir(repoDir);
    await execa('gemini', ['-p', prompt], { stdio: 'inherit' });
    
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
