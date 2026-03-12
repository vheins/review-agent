import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as os from 'os';
import { execa } from 'execa';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getHealthStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: await this.checkDatabase(),
        disk: await this.checkDisk(),
        memory: this.checkMemory(),
        github: await this.checkGitHub(),
      },
      overall: 'healthy'
    };

    const serviceStatuses = Object.values(status.services).map(s => s.status);
    if (serviceStatuses.includes('unhealthy')) {
      status.overall = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      status.overall = 'degraded';
    }

    return status;
  }

  private async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'healthy' };
    } catch (e) {
      return { status: 'unhealthy', error: e.message };
    }
  }

  private async checkDisk() {
    try {
      const free = os.freemem();
      return { status: 'healthy', free_approx: free };
    } catch (e) {
      return { status: 'degraded', error: e.message };
    }
  }

  private checkMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    const usedPercent = ((total - free) / total) * 100;

    return {
      status: usedPercent > 90 ? 'degraded' : 'healthy',
      used_percent: usedPercent.toFixed(1)
    };
  }

  private async checkGitHub() {
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
