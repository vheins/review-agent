import os from 'os';
import { dbManager } from './database.js';
import { logger } from './logger.js';
import { execa } from 'execa';

export class HealthService {
  constructor() {}

  async getHealthStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      services: {
        database: this.checkDatabase(),
        disk: await this.checkDisk(),
        memory: this.checkMemory(),
        github: await this.checkGitHub(),
      },
      overall: 'healthy'
    };

    // Determine overall health
    const serviceStatuses = Object.values(status.services).map(s => s.status);
    if (serviceStatuses.includes('unhealthy')) {
      status.overall = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      status.overall = 'degraded';
    }

    return status;
  }

  checkDatabase() {
    try {
      if (dbManager.isAvailable()) {
        dbManager.db.prepare('SELECT 1').get();
        return { status: 'healthy' };
      }
      return { status: 'unhealthy', error: 'Database not available' };
    } catch (e) {
      return { status: 'unhealthy', error: e.message };
    }
  }

  async checkDisk() {
    try {
      // Very basic check - would use a library like 'check-disk-space' normally
      const free = os.freemem(); // Placeholder for actual disk check
      return { status: 'healthy', free_approx: free };
    } catch (e) {
      return { status: 'degraded', error: e.message };
    }
  }

  checkMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    const usedPercent = ((total - free) / total) * 100;

    return {
      status: usedPercent > 90 ? 'degraded' : 'healthy',
      used_percent: usedPercent.toFixed(1)
    };
  }

  async checkGitHub() {
    try {
      const { stdout } = await execa('gh', ['api', 'rate_limit'], { reject: false });
      const data = JSON.parse(stdout || '{}');
      const core = data.resources?.core || {};
      
      return {
        status: core.remaining < 10 ? 'degraded' : 'healthy',
        remaining: core.remaining,
        limit: core.limit,
        reset: core.reset ? new Date(core.reset * 1000).toISOString() : null
      };
    } catch (e) {
      return { status: 'degraded', error: 'Could not fetch rate limits' };
    }
  }
}

export const healthService = new HealthService();
export default healthService;
