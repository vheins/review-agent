import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { UtilityServiceStatus } from './interfaces/migration-report.interface.js';

export class UtilityValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyLogger(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'common/logger.service.ts');
    return await fs.pathExists(servicePath);
  }

  async verifyErrorHandler(): Promise<boolean> {
    const filtersPath = path.join(this.backendSrcPath, 'common/filters');
    if (!(await fs.pathExists(filtersPath))) return false;
    
    const filters = await globby('*.filter.ts', {
      cwd: filtersPath,
    });
    return filters.length > 0;
  }

  async verifyNotification(): Promise<boolean> {
    const notificationPath = path.join(this.backendSrcPath, 'modules/webhook');
    return await fs.pathExists(notificationPath);
  }

  async checkLegacyUtilityUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/audit-logger.js') || 
          content.includes('legacy/logger.js')) {
        return true;
      }
    }

    return false;
  }

  async getUtilityServicesStatus(): Promise<UtilityServiceStatus[]> {
    const services: UtilityServiceStatus[] = [];
    
    const loggerExists = await this.verifyLogger();
    const legacyUsed = await this.checkLegacyUtilityUsage();
    
    services.push({
      serviceType: 'logger',
      legacyUsed,
      migrated: loggerExists,
      implementation: loggerExists ? 'logger.service.ts' : undefined,
    });

    const errorHandlerExists = await this.verifyErrorHandler();
    services.push({
      serviceType: 'errorHandler',
      legacyUsed: false, // NestJS has built-in or custom filters
      migrated: errorHandlerExists,
      implementation: errorHandlerExists ? 'common/filters' : undefined,
    });

    const notificationExists = await this.verifyNotification();
    services.push({
      serviceType: 'notification',
      legacyUsed: false,
      migrated: notificationExists,
      implementation: notificationExists ? 'modules/webhook' : undefined,
    });

    return services;
  }
}
