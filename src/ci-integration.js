import { githubClient } from './github.js';
import { logger } from './logger.js';

export class CIIntegration {
  constructor() {}

  async getPRChecks(repoName, prNumber) {
    try {
      const { stdout } = await githubClient.execaVerbose('gh', [
        'pr', 'checks', prNumber.toString(),
        '--repo', repoName,
        '--json', 'name,status,conclusion,url'
      ]);
      
      return JSON.parse(stdout || '[]');
    } catch (e) {
      logger.error(`Failed to fetch PR checks: ${e.message}`);
      return [];
    }
  }

  async getTestResults(repoName, prNumber) {
    const checks = await this.getPRChecks(repoName, prNumber);
    
    const results = {
      total: checks.length,
      passed: checks.filter(c => c.conclusion === 'success').length,
      failed: checks.filter(c => c.conclusion === 'failure').length,
      pending: checks.filter(c => c.status === 'in_progress' || c.status === 'queued').length,
      allPassed: checks.length > 0 && checks.every(c => c.conclusion === 'success' || c.conclusion === 'neutral' || c.conclusion === 'skipped'),
      details: checks
    };

    return results;
  }

  async parseLcov(lcovContent) {
    // Basic LCOV parser for coverage percentage
    // LCOV format: SF:path/to/file, DA:line,count, LF:total, LH:covered
    const lines = lcovContent.split('\n');
    let totalLH = 0;
    let totalLF = 0;

    for (const line of lines) {
      if (line.startsWith('LH:')) {
        totalLH += parseInt(line.split(':')[1], 10);
      } else if (line.startsWith('LF:')) {
        totalLF += parseInt(line.split(':')[1], 10);
      }
    }

    return totalLF > 0 ? (totalLH / totalLF) * 100 : 0;
  }
}

export const ciIntegration = new CIIntegration();
export default ciIntegration;
