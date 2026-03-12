import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './app.config';
import { ReviewConfig } from './review.config';
import { AiExecutorConfig } from './ai-executor.config';
import { DatabaseConfig } from './database.config';

/**
 * Example Configuration Service
 * 
 * This example demonstrates how to use the typed configuration
 * in your services. You can inject ConfigService and access
 * configuration values with full type safety.
 * 
 * Usage patterns:
 * 1. Get entire config namespace: configService.get<AppConfig>('app')
 * 2. Get specific value: configService.get<number>('app.apiPort')
 * 3. Get with default: configService.get('app.apiPort', 3000)
 * 
 * Requirements: 9.5
 */
@Injectable()
export class ExampleConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Example: Get entire app configuration namespace
   */
  getAppConfig(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  /**
   * Example: Get specific configuration value with type safety
   */
  getApiPort(): number {
    return this.configService.get<number>('app.apiPort', 3000);
  }

  /**
   * Example: Get review configuration
   */
  getReviewConfig(): ReviewConfig {
    return this.configService.get<ReviewConfig>('review')!;
  }

  /**
   * Example: Get AI executor configuration
   */
  getAiExecutorConfig(): AiExecutorConfig {
    return this.configService.get<AiExecutorConfig>('aiExecutor')!;
  }

  /**
   * Example: Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return this.configService.get<DatabaseConfig>('database')!;
  }

  /**
   * Example: Check if auto-merge is enabled
   */
  isAutoMergeEnabled(): boolean {
    return this.configService.get<boolean>('app.autoMerge', false);
  }

  /**
   * Example: Get current AI executor name
   */
  getCurrentExecutor(): string {
    return this.configService.get<string>('aiExecutor.executor', 'gemini');
  }

  /**
   * Example: Get workspace directory
   */
  getWorkspaceDir(): string {
    return this.configService.get<string>('app.workspaceDir', './workspace');
  }

  /**
   * Example: Get PR scope as array
   */
  getPrScope(): string[] {
    return this.configService.get<string[]>('app.prScope', [
      'authored',
      'assigned',
      'review-requested',
    ]);
  }

  /**
   * Example: Get severity scores
   */
  getSeverityScores() {
    const review = this.getReviewConfig();
    return {
      critical: review.severityCritical,
      high: review.severityHigh,
      medium: review.severityMedium,
      low: review.severityLow,
      threshold: review.severityThreshold,
    };
  }
}
