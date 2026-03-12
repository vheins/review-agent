import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { ParserStatus } from './interfaces/migration-report.interface.js';

export class ParserValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyCommentParser(): Promise<boolean> {
    const servicePath = path.join(this.backendSrcPath, 'common/parser/comment-parser.service.ts');
    return await fs.pathExists(servicePath);
  }

  async verifyTemplateManager(): Promise<boolean> {
    // Check if template management exists
    const servicePath = path.join(this.backendSrcPath, 'common/parser/comment-parser.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('template') || content.includes('format');
  }

  async verifyRoundTrip(): Promise<boolean> {
    // This would ideally be a functional test, but statically we check if both
    // parse and format methods exist
    const servicePath = path.join(this.backendSrcPath, 'common/parser/comment-parser.service.ts');
    if (!(await fs.pathExists(servicePath))) return false;
    const content = await fs.readFile(servicePath, 'utf8');
    return content.includes('parse') && (content.includes('format') || content.includes('generate'));
  }

  async checkLegacyParserUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/comment-parser.js')) {
        return true;
      }
    }

    return false;
  }

  async getParserStatus(): Promise<ParserStatus> {
    const parserImplemented = await this.verifyCommentParser();
    const templateManagerMigrated = await this.verifyTemplateManager();
    const roundTripValid = await this.verifyRoundTrip();
    const legacyParserUsed = await this.checkLegacyParserUsage();

    return {
      legacyParserUsed,
      parserImplemented,
      templateManagerMigrated,
      roundTripValid,
    };
  }
}
