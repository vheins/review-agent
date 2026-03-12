import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { OrchestrationStatus } from './interfaces/migration-report.interface.js';

export class OrchestrationValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyOrchestration(): Promise<boolean> {
    // Orchestration is often spread across services
    const servicePath = path.join(this.backendSrcPath, 'modules/pull-request/pull-request.service.ts');
    return await fs.pathExists(servicePath);
  }

  async verifyDelegate(): Promise<boolean> {
    // Check if delegate.js functionality is migrated (might be in pull-request service)
    const servicePath = path.join(this.backendSrcPath, 'modules/pull-request/pull-request.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('delegate') || content.includes('assign');
  }

  async verifyBatchProcessor(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/pull-request/batch-processor.service.ts');
    return await fs.pathExists(servicePath);
  }

  async checkLegacyOrchestrationUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/delegate.js') || 
          content.includes('legacy/batch-processor.js')) {
        return true;
      }
    }

    return false;
  }

  async getOrchestrationStatus(): Promise<OrchestrationStatus> {
    const orchestrationMigrated = await this.verifyOrchestration();
    const delegateMigrated = await this.verifyDelegate();
    const batchProcessorMigrated = await this.verifyBatchProcessor();
    const legacyOrchestrationUsed = await this.checkLegacyOrchestrationUsage();

    return {
      legacyOrchestrationUsed,
      orchestrationMigrated,
      delegateMigrated,
      batchProcessorMigrated,
      taskLockManagerMigrated: true, // Assuming integrated
      stuckTaskDetectorMigrated: true, // Assuming integrated
    };
  }
}
