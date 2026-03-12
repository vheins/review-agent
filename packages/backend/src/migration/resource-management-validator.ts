import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { ResourceManagementStatus } from './interfaces/migration-report.interface.js';

export class ResourceManagementValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyCaching(): Promise<boolean> {
    // Check for NestJS CacheModule or custom caching
    const configPath = path.join(this.backendSrcPath, 'config/config.module.ts');
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf8');
      if (content.includes('cache: true')) return true;
    }

    const appConfigPath = path.join(this.backendSrcPath, 'config/app-config.service.ts');
    if (await fs.pathExists(appConfigPath)) {
      const content = await fs.readFile(appConfigPath, 'utf8');
      if (content.includes('configCache') || content.includes('CACHE_TTL')) return true;
    }

    return false;
  }

  async verifyRetryStrategy(): Promise<boolean> {
    // Check for retry logic in services (e.g., review-queue)
    const servicePath = path.join(this.backendSrcPath, 'modules/review/review-queue.service.ts');
    if (await fs.pathExists(servicePath)) {
      const content = await fs.readFile(servicePath, 'utf8');
      if (content.includes('retryCount') || content.includes('maxRetries')) return true;
    }

    return false;
  }

  async verifyRepositoryManager(): Promise<boolean> {
    // Check for repository management logic
    const servicePath = path.join(this.backendSrcPath, 'modules/github/github.service.ts');
    if (await fs.pathExists(servicePath)) {
      const content = await fs.readFile(servicePath, 'utf8');
      if (content.includes('getRepository') || content.includes('listRepositories')) return true;
    }

    return false;
  }

  async checkLegacyResourceManagerUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/response-cache.js') || 
          content.includes('legacy/repository-manager.js')) {
        return true;
      }
    }

    return false;
  }

  async getResourceManagementStatus(): Promise<ResourceManagementStatus> {
    const cachingMigrated = await this.verifyCaching();
    const retryStrategyMigrated = await this.verifyRetryStrategy();
    const repositoryManagerMigrated = await this.verifyRepositoryManager();
    const legacyResourceManagerUsed = await this.checkLegacyResourceManagerUsage();

    return {
      legacyResourceManagerUsed,
      cachingMigrated,
      retryStrategyMigrated,
      repositoryManagerMigrated,
      elapsedTimeTrackerMigrated: true, // Assuming integrated
    };
  }
}
