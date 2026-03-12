import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { RouteFile, RouteEndpoint } from './interfaces/migration-report.interface.js';

export class RouteMigrationValidator {
  private routesPath: string;
  private controllersPath: string;

  constructor() {
    const baseDir = process.cwd().endsWith('packages/backend') 
      ? process.cwd() 
      : path.resolve(process.cwd(), 'packages/backend');
      
    this.routesPath = path.resolve(baseDir, 'src/routes');
    this.controllersPath = path.resolve(baseDir, 'src/modules');
  }

  async scanRouteFiles(): Promise<RouteFile[]> {
    const files = await globby('*.js', {
      cwd: this.routesPath,
    });

    return await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(this.routesPath, file);
        const controllerEquiv = await this.findControllerEquivalent(file);
        
        const endpoints = await this.extractEndpoints(fullPath);
        
        return {
          path: fullPath,
          filename: file,
          hasControllerEquivalent: !!controllerEquiv,
          controllerEquivalent: controllerEquiv,
          endpoints,
          needsMigration: true, // Since it's still a .js file in routes
        };
      })
    );
  }

  private async findControllerEquivalent(routeFile: string): Promise<string | undefined> {
    const nameNoExt = routeFile.replace(/\.js$/, '');
    
    // Look for controllers in modules
    const patterns = [
      `**/${nameNoExt}.controller.ts`,
      `**/${nameNoExt}s.controller.ts`, // Handle pluralization
      `**/controllers/${nameNoExt}.controller.ts`,
    ];

    for (const pattern of patterns) {
      const matches = await globby(pattern, {
        cwd: this.controllersPath,
      });
      if (matches.length > 0) {
        return path.join('packages/backend/src/modules', matches[0]);
      }
    }

    return undefined;
  }

  private async extractEndpoints(filePath: string): Promise<RouteEndpoint[]> {
    const content = await fs.readFile(filePath, 'utf8');
    const endpoints: RouteEndpoint[] = [];
    
    // Simple regex to find express routes
    // router.get('/path', ...)
    const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
      endpoints.push({
        method: match[1].toUpperCase() as any,
        path: match[2],
        existsInController: false, // Default to false, will be verified later
      });
    }
    
    return endpoints;
  }

  async verifyDecorators(controllerPath: string): Promise<boolean> {
    if (!await fs.pathExists(controllerPath)) return false;
    
    const content = await fs.readFile(controllerPath, 'utf8');
    const hasControllerDecorator = content.includes('@Controller');
    const hasMethodDecorators = /@(Get|Post|Put|Delete|Patch)/.test(content);
    
    return hasControllerDecorator && hasMethodDecorators;
  }
}
