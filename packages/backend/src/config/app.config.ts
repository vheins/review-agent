import { registerAs } from '@nestjs/config';
import { resolveWorkspaceDir } from './workspace-path.util.js';

/**
 * Application Configuration
 * 
 * Typed configuration for general application settings.
 * 
 * Requirements: 9.1, 9.2, 9.5
 */
export interface AppConfig {
  nodeEnv: string;
  apiPort: number;
  reviewInterval: number;
  logLevel: string;
  workspaceDir: string;
  excludeRepoOwners: string[];
  prScope: string[];
  autoMerge: boolean;
  dryRun: boolean;
  staleInvolvesReviewDays: number;
}

export default registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPort: parseInt(process.env.API_PORT || '3000', 10),
  reviewInterval: parseInt(process.env.REVIEW_INTERVAL || '600', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  workspaceDir: resolveWorkspaceDir(),
  excludeRepoOwners: process.env.EXCLUDE_REPO_OWNERS
    ? process.env.EXCLUDE_REPO_OWNERS.split(',').map(s => s.trim())
    : [],
  prScope: process.env.PR_SCOPE
    ? process.env.PR_SCOPE.split(',').map(s => s.trim())
    : ['authored', 'assigned', 'review-requested', 'involves'],
  autoMerge: process.env.AUTO_MERGE === 'true',
  dryRun: process.env.DRY_RUN === 'true',
  staleInvolvesReviewDays: parseInt(process.env.STALE_INVOLVES_REVIEW_DAYS || '3', 10),
}));
