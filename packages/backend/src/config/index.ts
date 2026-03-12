/**
 * Configuration Module Index
 * 
 * Barrel export for all configuration-related components.
 * 
 * Usage:
 * import { ConfigModule, AppConfig, ReviewConfig, AppConfigService } from '@/config/index.js';
 */

export { ConfigModule } from './config.module.js';
export { AppConfigService } from './app-config.service.js';
export type { AppConfig } from './app.config.js';
export type { ReviewConfig } from './review.config.js';
export type { AiExecutorConfig, ExecutorSettings } from './ai-executor.config.js';
export type { DatabaseConfig } from './database.config.js';
export { default as appConfig } from './app.config.js';
export { default as reviewConfig } from './review.config.js';
export { default as aiExecutorConfig } from './ai-executor.config.js';
export { default as databaseConfig } from './database.config.js';
export { validationSchema } from './validation.schema.js';
