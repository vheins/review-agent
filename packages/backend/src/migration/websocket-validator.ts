import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { WebSocketStatus } from './interfaces/migration-report.interface.js';

export class WebSocketValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyGatewayImplementation(): Promise<boolean> {
    const wsPath = path.join(this.backendSrcPath, 'modules/websocket');
    if (!(await fs.pathExists(wsPath))) {
      return false;
    }

    const gateways = await globby('*.gateway.ts', {
      cwd: wsPath,
    });

    return gateways.length > 0;
  }

  async verifyGatewayDecorators(): Promise<boolean> {
    const wsPath = path.join(this.backendSrcPath, 'modules/websocket');
    if (!(await fs.pathExists(wsPath))) {
      return false;
    }

    const gateways = await globby('*.gateway.ts', {
      cwd: wsPath,
    });

    for (const gateway of gateways) {
      const fullPath = path.join(wsPath, gateway);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('@WebSocketGateway') && content.includes('@SubscribeMessage')) {
        return true;
      }
    }

    return false;
  }

  async checkLegacyWSUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/websocket-server.js') || content.includes('legacy/websocket-server')) {
        return true;
      }
    }

    return false;
  }

  async getWebSocketStatus(): Promise<WebSocketStatus> {
    const gatewayImplementation = await this.verifyGatewayImplementation();
    const gatewayDecorators = await this.verifyGatewayDecorators();
    const legacyWSUsed = await this.checkLegacyWSUsage();
    
    // clientConnections and authAndAuthz are hard to check statically
    // Let's check for some keywords in gateways
    let clientConnections = false;
    let authAndAuthz = false;

    if (gatewayImplementation) {
      const wsPath = path.join(this.backendSrcPath, 'modules/websocket');
      const gateways = await globby('*.gateway.ts', { cwd: wsPath });
      for (const g of gateways) {
        const content = await fs.readFile(path.join(wsPath, g), 'utf8');
        if (content.includes('handleConnection')) clientConnections = true;
        if (content.includes('@UseGuards') || content.includes('WindoGuard')) authAndAuthz = true;
      }
    }

    return {
      legacyWSUsed,
      gatewayImplementation,
      gatewayDecorators,
      clientConnections,
      authAndAuthz,
    };
  }
}
