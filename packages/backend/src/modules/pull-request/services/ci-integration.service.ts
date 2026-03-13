import { Injectable, Logger } from '@nestjs/common';
import { GitHubClientService } from '../../github/github.service.js';

/**
 * CIIntegrationService - Service for managing CI integration and test results
 * 
 * This service provides methods to fetch PR checks and test results from GitHub.
 * 
 * Requirements: 11.4
 */
@Injectable()
export class CIIntegrationService {
  private readonly logger = new Logger(CIIntegrationService.name);

  constructor(private readonly github: GitHubClientService) {}

  /**
   * Get PR checks from GitHub
   * 
   * @param repoName - Name of the repository (owner/repo)
   * @param prNumber - PR number
   * @returns List of PR checks
   */
  async getPRChecks(repoName: string, prNumber: number) {
    return this.github.getPRChecks(repoName, prNumber);
  }

  /**
   * Get summarized test results for a PR
   * 
   * @param repoName - Name of the repository (owner/repo)
   * @param prNumber - PR number
   * @returns Test result summary
   */
  async getTestResults(repoName: string, prNumber: number) {
    return this.github.getTestResults(repoName, prNumber);
  }

  /**
   * Basic LCOV parser for coverage percentage
   * 
   * @param lcovContent - Raw LCOV content
   * @returns Coverage percentage (0-100)
   */
  async parseLcov(lcovContent: string): Promise<number> {
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
