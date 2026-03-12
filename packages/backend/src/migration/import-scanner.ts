import { globby } from 'globby';
import fs from 'fs-extra';
import path from 'path';
import { ImportReference } from './interfaces/migration-report.interface.js';

export class ImportScanner {
  private rootPath: string;

  constructor() {
    this.rootPath = process.cwd().endsWith('packages/backend') 
      ? path.resolve(process.cwd(), '../..') 
      : process.cwd();
  }

  async scanCodebaseForImports(): Promise<ImportReference[]> {
    const patterns = [
      'packages/backend/src/**/*.ts',
      'packages/desktop/src/**/*.ts',
      'packages/ui/src/**/*.{ts,tsx}',
      'tests/**/*.ts',
    ];

    try {
      const files = await globby(patterns, {
        cwd: this.rootPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
      });

      const references: ImportReference[] = [];

      for (const file of files) {
        const fullPath = path.join(this.rootPath, file);
        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (line.includes('legacy/')) {
            const importMatch = line.match(/(?:import|from|require)\s*['"](.*legacy\/.*)['"]/);
            if (importMatch) {
              const importPath = importMatch[1];
              references.push({
                filePath: file,
                lineNumber: index + 1,
                importPath: importPath,
                importType: this.detectImportType(importPath),
                legacyFile: this.extractLegacyFileName(importPath),
              });
            }
          }
        });
      }

      return references;
    } catch (error) {
      console.error('Error scanning for imports:', error);
      return [];
    }
  }

  private detectImportType(importPath: string): 'relative' | 'absolute' {
    if (importPath.startsWith('.') || importPath.startsWith('..')) {
      return 'relative';
    }
    return 'absolute';
  }

  private extractLegacyFileName(importPath: string): string | undefined {
    const parts = importPath.split('legacy/');
    if (parts.length > 1) {
      return parts[1].split(/['"/]/)[0];
    }
    return undefined;
  }

  async verifyPackageJsonScripts(): Promise<boolean> {
    try {
      const packageJsonPaths = await globby('**/package.json', {
        cwd: this.rootPath,
        ignore: ['**/node_modules/**'],
      });

      for (const p of packageJsonPaths) {
        const fullPath = path.join(this.rootPath, p);
        const pkg = await fs.readJson(fullPath);
        
        if (pkg.scripts) {
          for (const script of Object.values(pkg.scripts as Record<string, string>)) {
            if (script.includes('legacy/')) {
              return false;
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error verifying package.json scripts:', error);
      return true;
    }
  }
}
