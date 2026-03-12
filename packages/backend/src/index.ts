/**
 * Main entry point for the Review Agent backend
 * 
 * This file provides barrel exports for all major components of the application.
 * Usage:
 * import { AppModule } from '@/index.js';
 */

import 'reflect-metadata';

export * from './app.module.js';
export * from './modules/index.js';
export * from './common/index.js';
export * from './database/index.js';
export * from './config/index.js';
