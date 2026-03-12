import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { SpecializedServiceStatus } from './interfaces/migration-report.interface.js';

export class SpecializedServicesValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifySLAMonitor(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/metrics/metrics.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('SLA') || content.includes('slaComplianceRate');
  }

  async verifyFalsePositiveTracker(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/metrics/metrics.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('falsePositive') || content.includes('QualityScore');
  }

  async verifyDiscussionTracker(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'modules/github/github.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('comment') || content.includes('thread');
  }

  async getSpecializedServicesStatus(): Promise<SpecializedServiceStatus[]> {
    const services: SpecializedServiceStatus[] = [];
    
    services.push({
      serviceType: 'slaMonitor',
      migrated: await this.verifySLAMonitor(),
    });

    services.push({
      serviceType: 'falsePositiveTracker',
      migrated: await this.verifyFalsePositiveTracker(),
    });

    services.push({
      serviceType: 'discussionTracker',
      migrated: await this.verifyDiscussionTracker(),
    });

    return services;
  }
}
