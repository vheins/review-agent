import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { ReviewEngineStatus } from './interfaces/migration-report.interface.js';

export class ReviewEngineStatusValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyReviewEngine(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/review/review-engine.service.ts');
    return await fs.pathExists(servicePath);
  }

  async verifyReviewQueue(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/review/review-queue.service.ts');
    return await fs.pathExists(servicePath);
  }

  async verifyChecklist(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/review/checklist.service.ts');
    return await fs.pathExists(servicePath);
  }

  async checkLegacyReviewUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/review-engine.js') || 
          content.includes('legacy/review-queue.js') || 
          content.includes('legacy/checklist-manager.js')) {
        return true;
      }
    }

    return false;
  }

  async getReviewEngineStatus(): Promise<ReviewEngineStatus> {
    const reviewEngineImplemented = await this.verifyReviewEngine();
    const reviewQueueImplemented = await this.verifyReviewQueue();
    const checklistImplemented = await this.verifyChecklist();
    const legacyEngineUsed = await this.checkLegacyReviewUsage();
    
    // workflowComplete is true if all services are implemented and no legacy used
    const workflowComplete = reviewEngineImplemented && reviewQueueImplemented && checklistImplemented && !legacyEngineUsed;

    return {
      legacyEngineUsed,
      reviewEngineImplemented,
      reviewQueueImplemented,
      checklistImplemented,
      workflowComplete,
    };
  }
}
