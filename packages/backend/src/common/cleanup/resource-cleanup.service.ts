import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataExporterService } from '../exporter/data-exporter.service.js';
import { AppConfigService } from '../../config/app-config.service.js';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class ResourceCleanupService implements OnModuleInit {
  private readonly logger = new Logger(ResourceCleanupService.name);

  constructor(
    private readonly dataExporter: DataExporterService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit() {
    // Schedule cleanup every hour
    setInterval(() => this.runCleanup(), 60 * 60 * 1000);
    // Trigger initial cleanup
    this.runCleanup().catch(e => this.logger.error(`Initial cleanup failed: ${e.message}`));
  }

  async runCleanup() {
    this.logger.log('Starting periodic resource cleanup...');

    try {
      // 1. Cleanup expired exports
      await this.dataExporter.cleanupOldExports();

      // 2. Cleanup workspace
      await this.cleanupWorkspace();

      this.logger.log('Resource cleanup finished.');
    } catch (e) {
      this.logger.error(`Cleanup failed: ${e.message}`);
    }
  }

  async cleanupWorkspace() {
    const appConfig = this.config.getAppConfig();
    const workspaceDir = appConfig.workspaceDir;
    
    if (!await fs.pathExists(workspaceDir)) return;

    const items = await fs.readdir(workspaceDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const item of items) {
      if (item === '.gitkeep' || item === 'exports') continue;
      
      const fullPath = path.join(workspaceDir, item);
      const stats = await fs.stat(fullPath);
      
      if (now - stats.mtimeMs > maxAge) {
        this.logger.log(`Removing old workspace resource: ${item}`);
        await fs.remove(fullPath);
      }
    }
  }
}
