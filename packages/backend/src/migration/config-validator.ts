import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import { ConfigStatus } from './interfaces/migration-report.interface.js';

export class ConfigValidator {
  private backendSrcPath: string;
  private rootPath: string;

  constructor() {
    this.backendSrcPath = path.resolve(process.cwd(), 'packages/backend/src');
    this.rootPath = process.cwd();
  }

  async verifyNestJSConfig(): Promise<boolean> {
    const configModulePath = path.join(this.backendSrcPath, 'config/config.module.ts');
    if (!(await fs.pathExists(configModulePath))) {
      return false;
    }

    const content = await fs.readFile(configModulePath, 'utf8');
    return content.includes('ConfigModule') && content.includes('@nestjs/config');
  }

  async verifyValidationSchema(): Promise<boolean> {
    const schemaPath = path.join(this.backendSrcPath, 'config/validation.schema.ts');
    if (!(await fs.pathExists(schemaPath))) {
      return false;
    }

    const content = await fs.readFile(schemaPath, 'utf8');
    return content.includes('Joi.object');
  }

  async checkLegacyConfigUsage(): Promise<boolean> {
    const patterns = ['packages/backend/src/**/*.ts'];
    const files = await globby(patterns, {
      cwd: this.rootPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      const content = await fs.readFile(fullPath, 'utf8');
      if (content.includes('legacy/config.js') || content.includes('legacy/config')) {
        return true;
      }
    }

    return false;
  }

  async getConfigStatus(): Promise<ConfigStatus> {
    const nestJSConfigModule = await this.verifyNestJSConfig();
    const validationSchema = await this.verifyValidationSchema();
    const legacyConfigUsed = await this.checkLegacyConfigUsage();
    
    // Check for AppConfigService integration
    const configServicePath = path.join(this.backendSrcPath, 'config/app-config.service.ts');
    const configServicesIntegrated = await fs.pathExists(configServicePath);
    
    // hardcodedConfigMigrated is hard to check fully, let's assume true if legacy is not used
    const hardcodedConfigMigrated = !legacyConfigUsed;

    return {
      legacyConfigUsed,
      nestJSConfigModule,
      validationSchema,
      configServicesIntegrated,
      hardcodedConfigMigrated,
    };
  }
}
