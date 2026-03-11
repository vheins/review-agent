/**
 * Configuration barrel export
 * 
 * This file provides clean imports for configuration modules and schemas.
 * 
 * Usage:
 * ```typescript
 * import { ConfigModule, AppConfig, ReviewConfig } from '@/config';
 * 
 * // In a service:
 * constructor(private configService: ConfigService) {}
 * 
 * const appConfig = this.configService.get<AppConfig>('app');
 * const port = this.configService.get<number>('app.apiPort');
 * ```
 */

// Export configuration module
export { ConfigModule } from './config.module';

// Export configuration types
export type { AppConfig } from './app.config';
export type { ReviewConfig } from './review.config';
export type { AiExecutorConfig, ExecutorSettings } from './ai-executor.config';
export type { DatabaseConfig } from './database.config';

// Export configuration factory functions
export { default as appConfig } from './app.config';
export { default as reviewConfig } from './review.config';
export { default as aiExecutorConfig } from './ai-executor.config';
export { default as databaseConfig } from './database.config';

// Export validation schema
export { validationSchema } from './validation.schema';

