import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';
import { dataExporter } from './data-exporter.js';
import { config } from './config.js';

export class ResourceCleanup {
  constructor() {}

  async runCleanup() {
    logger.info('Starting periodic resource cleanup...');

    try {
      // 1. Cleanup expired exports
      await dataExporter.cleanupExpiredExports();

      // 2. Cleanup workspace (cloned repos)
      await this.cleanupWorkspace();

      // 3. Cleanup temp logs or files if any
      
      logger.info('Resource cleanup finished.');
    } catch (e) {
      logger.error(`Cleanup failed: ${e.message}`);
    }
  }

  async cleanupWorkspace() {
    const workspaceDir = config.workspaceDir;
    if (!await fs.pathExists(workspaceDir)) return;

    const dirs = await fs.readdir(workspaceDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const dir of dirs) {
      if (dir === '.gitkeep') continue;
      
      const fullPath = path.join(workspaceDir, dir);
      const stats = await fs.stat(fullPath);
      
      if (now - stats.mtimeMs > maxAge) {
        logger.info(`Removing old workspace directory: ${dir}`);
        await fs.remove(fullPath);
      }
    }
  }

  schedule(intervalMs = 60 * 60 * 1000) { // Default 1 hour
    setInterval(() => this.runCleanup(), intervalMs);
  }
}

export const resourceCleanup = new ResourceCleanup();
export default resourceCleanup;
