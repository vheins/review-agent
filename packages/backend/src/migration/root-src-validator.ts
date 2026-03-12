import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { RootSrcFile, ImportReference } from './interfaces/migration-report.interface.js';
import { ImportScanner } from './import-scanner.js';

export class RootSrcValidator {
  private rootSrcPath: string;
  private rootPath: string;
  private importScanner: ImportScanner;

  constructor() {
    this.rootSrcPath = path.resolve(process.cwd(), 'src');
    this.rootPath = process.cwd();
    this.importScanner = new ImportScanner();
  }

  async scanRootSrcFiles(): Promise<RootSrcFile[]> {
    if (!(await fs.pathExists(this.rootSrcPath))) {
      return [];
    }

    const files = await globby('*', {
      cwd: this.rootSrcPath,
    });

    const importReferences = await this.importScanner.scanCodebaseForImports();

    return await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(this.rootSrcPath, file);
        const relativePath = path.join('src', file);
        const isCode = file.endsWith('.js') || file.endsWith('.ts');

        const fileImportRefs = importReferences.filter((ref) => 
          ref.importPath.includes(file) || 
          (ref.legacyFile && file.includes(ref.legacyFile))
        );

        const isUsed = await this.analyzeFileUsage(relativePath, fileImportRefs);

        return {
          path: relativePath,
          filename: file,
          isCode,
          isUsed,
          importReferences: fileImportRefs,
          recommendation: this.getRecommendation(file, isCode, isUsed),
        };
      })
    );
  }

  private async analyzeFileUsage(relativePath: string, importRefs: ImportReference[]): Promise<boolean> {
    // Files in src/ are "used" if they have import references or if they are essential non-code files
    if (importRefs.length > 0) {
      return true;
    }

    const filename = path.basename(relativePath);
    
    // Essential files that might not be imported directly
    const essentialFiles = ['ARCHITECTURE.md', 'README.md'];
    if (essentialFiles.includes(filename)) {
      return true;
    }

    return false;
  }

  private getRecommendation(filename: string, isCode: boolean, isUsed: boolean): 'keep' | 'remove' | 'review' {
    if (!isUsed && isCode) {
      return 'remove';
    }
    if (isUsed && isCode) {
      return 'review'; // Review to see if it can be moved to NestJS
    }
    return 'keep';
  }

  async checkDocumentationRelevance(): Promise<string[]> {
    const recommendations: string[] = [];
    const archDoc = path.join(this.rootSrcPath, 'ARCHITECTURE.md');

    if (await fs.pathExists(archDoc)) {
      const content = await fs.readFile(archDoc, 'utf8');
      if (content.includes('Express') && !content.includes('NestJS')) {
        recommendations.push('Update ARCHITECTURE.md to reflect NestJS migration');
      }
    }

    const readmeDoc = path.join(this.rootSrcPath, 'README.md');
    if (await fs.pathExists(readmeDoc)) {
      const content = await fs.readFile(readmeDoc, 'utf8');
      if (content.includes('legacy/')) {
        recommendations.push('Update README.md to remove legacy references');
      }
    }

    return recommendations;
  }
}
