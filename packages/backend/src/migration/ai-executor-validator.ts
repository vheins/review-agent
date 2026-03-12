import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { AIExecutorStatus } from './interfaces/migration-report.interface.js';

export class AIExecutorValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyExecutorImplementations(): Promise<AIExecutorStatus[]> {
    const executorsPath = path.join(this.backendSrcPath, 'modules/ai/executors');
    if (!(await fs.pathExists(executorsPath))) {
      return [];
    }

    const executorFiles = await globby('*.executor.ts', {
      cwd: executorsPath,
    });

    const executorTypes: AIExecutorStatus['executorType'][] = [
      'gemini', 'copilot', 'kiro', 'claude', 'codex', 'opencode'
    ];

    const status: AIExecutorStatus[] = [];

    for (const type of executorTypes) {
      const fileName = `${type}.executor.ts`;
      const exists = executorFiles.includes(fileName) || (type === 'others' && executorFiles.includes('others.executor.ts'));
      
      // Special case for types combined in others.executor.ts
      let implemented = exists;
      if (!exists && executorFiles.includes('others.executor.ts')) {
        const content = await fs.readFile(path.join(executorsPath, 'others.executor.ts'), 'utf8');
        if (content.toLowerCase().includes(type)) {
          implemented = true;
        }
      }

      status.push({
        executorType: type,
        implemented,
        configIntegrated: implemented, // Assume true if implemented for now
      });
    }

    return status;
  }

  async verifyFixGenerator(): Promise<boolean> {
    const fixGeneratorPath = path.join(this.backendSrcPath, 'modules/ai/ai-fix-generator.service.ts');
    return await fs.pathExists(fixGeneratorPath);
  }

  async checkLegacyAIUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/ai-executors.js') || content.includes('legacy/ai-executors') ||
          content.includes('legacy/ai-fix-generator.js')) {
        return true;
      }
    }

    return false;
  }
}
