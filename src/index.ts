/**
 * Root barrel export for NestJS backend
 * 
 * This file provides clean imports from the root src directory.
 * 
 * Usage:
 * import { AppModule } from '@/index';
 */

// Export the root module
export * from './app.module';

// Export barrel exports from subdirectories
export * from './modules';
export * from './common';
export * from './database';
export * from './config';
