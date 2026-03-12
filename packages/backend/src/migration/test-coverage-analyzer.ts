import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { TestCoverage } from './interfaces/migration-report.interface.js';

export class TestCoverageAnalyzer {
  private testsPath: string;
  private rootPath: string;

  constructor() {
    this.rootPath = process.cwd().endsWith('packages/backend') 
      ? path.resolve(process.cwd(), '../..') 
      : process.cwd();
    this.testsPath = path.resolve(this.rootPath, 'tests');
  }

  async analyzeTestCoverage(modulePaths: string[]): Promise<TestCoverage[]> {
    const testFiles = await globby('**/*.{test,spec}.{ts,js}', {
      cwd: this.testsPath,
    });

    return await Promise.all(
      modulePaths.map(async (modulePath) => {
        const moduleName = path.basename(modulePath, '.ts').replace('.service', '').replace('.controller', '');
        const matchingTests = testFiles.filter(f => 
          f.toLowerCase().includes(moduleName.toLowerCase())
        );

        const hasTests = matchingTests.length > 0;
        
        return {
          modulePath,
          hasTests,
          testFilePath: hasTests ? path.join('tests', matchingTests[0]) : undefined,
          coveragePercentage: hasTests ? 85 : 0, // Mock percentage for now
          needsTesting: !hasTests,
        };
      })
    );
  }

  async generateCoverageReport(modulePaths: string[]): Promise<TestCoverage[]> {
    return this.analyzeTestCoverage(modulePaths);
  }
}
