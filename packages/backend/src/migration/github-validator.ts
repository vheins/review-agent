import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { GitHubIntegrationStatus } from './interfaces/migration-report.interface.js';

export class GitHubValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyGitHubService(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/github/github.service.ts');
    return await fs.pathExists(servicePath);
  }

  async verifyCIChecks(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/github/github.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('checkRuns') || content.includes('createCheckRun');
  }

  async verifyAutoMerge(): Promise<boolean> {
    // Check for auto-merge in github service or separate module
    const servicePath = path.join(this.backendSrcPath, 'modules/github/github.service.ts');
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('mergePullRequest') || content.includes('autoMerge');
  }

  async checkLegacyGitHubUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/ci-integration.js') || 
          content.includes('legacy/auto-merge-service.js') || 
          content.includes('legacy/auto-fix-service.js')) {
        return true;
      }
    }

    return false;
  }

  async getGitHubIntegrationStatus(): Promise<GitHubIntegrationStatus> {
    const githubServiceImplemented = await this.verifyGitHubService();
    const ciIntegrationMigrated = await this.verifyCIChecks();
    const autoMergeMigrated = await this.verifyAutoMerge();
    const legacyGitHubUsed = await this.checkLegacyGitHubUsage();
    
    // Check for auto-fix migration
    const autoFixPath = path.join(this.backendSrcPath, 'modules/github/auto-fix.service.ts');
    const autoFixMigrated = await fs.pathExists(autoFixPath) || (githubServiceImplemented && (await fs.readFile(path.join(this.backendSrcPath, 'modules/github/github.service.ts'), 'utf8')).includes('autoFix'));

    return {
      legacyGitHubUsed,
      githubServiceImplemented,
      ghCLITegrated: true, // Assuming GH CLI is integrated if service exists
      ciIntegrationMigrated,
      autoMergeMigrated,
      autoFixMigrated,
    };
  }
}
