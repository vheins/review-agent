import { globby } from 'globby';
import path from 'path';
import { LegacyFile } from './interfaces/migration-report.interface.js';

export class LegacyFileScanner {
  private legacyPath: string;
  private srcPath: string;

  constructor() {
    // If we're running from packages/backend, process.cwd() is that folder
    const baseDir = process.cwd().endsWith('packages/backend') 
      ? process.cwd() 
      : path.resolve(process.cwd(), 'packages/backend');
      
    this.legacyPath = path.resolve(baseDir, 'legacy');
    this.srcPath = path.resolve(baseDir, 'src');
  }

  async scanLegacyFiles(): Promise<LegacyFile[]> {
    const files = await globby('**/*.js', {
      cwd: this.legacyPath,
    });

    const legacyFiles: LegacyFile[] = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(this.legacyPath, file);
        const nestEquiv = await this.findNestJSEquivalent(file);
        
        return {
          path: fullPath,
          filename: file,
          hasNestJSEquivalent: !!nestEquiv,
          nestJSEquivalent: nestEquiv,
          migrationPriority: this.determinePriority(file),
        };
      })
    );

    return legacyFiles;
  }

  private async findNestJSEquivalent(legacyFile: string): Promise<string | undefined> {
    const filenameNoExt = legacyFile.replace(/\.js$/, '');
    
    // Common mapping patterns
    const patterns = [
      // Direct module equivalent
      `**/modules/**/${filenameNoExt}.service.ts`,
      `**/modules/**/${filenameNoExt}.controller.ts`,
      `**/modules/**/${filenameNoExt}.module.ts`,
      `**/modules/**/${filenameNoExt}.gateway.ts`,
      // Common shared services
      `**/common/**/${filenameNoExt}.service.ts`,
      // Root src services
      `${filenameNoExt}.service.ts`,
      // Kebab-case to camelCase or vice versa if applicable
      `**/${filenameNoExt.replace(/-/g, '')}.service.ts`,
    ];

    for (const pattern of patterns) {
      const matches = await globby(pattern, {
        cwd: this.srcPath,
      });
      if (matches.length > 0) {
        return path.join('packages/backend/src', matches[0]);
      }
    }

    return undefined;
  }

  private determinePriority(file: string): 'high' | 'medium' | 'low' {
    const highPriority = [
      'api-server.js',
      'database.js',
      'review-engine.js',
      'github.js',
      'config.js',
    ];
    
    const mediumPriority = [
      'ai-executors.js',
      'security-scanner.js',
      'metrics-engine.js',
      'assignment-engine.js',
    ];

    if (highPriority.some(p => file.includes(p))) return 'high';
    if (mediumPriority.some(p => file.includes(p))) return 'medium';
    return 'low';
  }

  async createMappingReport(): Promise<LegacyFile[]> {
    return this.scanLegacyFiles();
  }
}
