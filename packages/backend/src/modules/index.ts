/**
 * Feature modules barrel export
 * 
 * This file provides clean imports for all feature modules in the application.
 * Usage:
 * import { ReviewModule, PullRequestModule } from '@/modules/index.js';
 */

export * from './review/review.module.js';
export * from './pull-request/pull-request.module.js';
export * from './metrics/metrics.module.js';
export * from './team/team.module.js';
export * from './security/security.module.js';
export * from './github/github.module.js';
export * from './ai/ai.module.js';
export * from './webhook/index.js';
export * from './websocket/index.js';
