/**
 * Common module barrel export
 * 
 * This file provides clean imports for shared utilities, guards,
 * interceptors, filters, and other cross-cutting concerns.
 * 
 * Usage:
 * import { SomeUtility, SomeDecorator } from '@/common/index.js';
 */

export * from './logger.service.js';
export * from './logger.module.js';

// Features under development or future modules
// export * from './decorators/index.js';
// export * from './guards/index.js';
// export * from './interceptors/index.js';
// export * from './filters/index.js';
// export * from './pipes/index.js';
// export * from './utils/index.js';

export * from './parser/index.js';
export * from './audit/index.js';
export * from './health/index.js';
export * from './exporter/index.js';
export * from './utils/index.js';
