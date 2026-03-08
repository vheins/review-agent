import dotenv from 'dotenv';

dotenv.config();

export const config = {
  delegate: process.env.DELEGATE === 'true',
  reviewMode: process.env.REVIEW_MODE || 'comment',
  reviewInterval: parseInt(process.env.REVIEW_INTERVAL || '600', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  workspaceDir: process.env.WORKSPACE_DIR || './workspace',
  dryRun: process.argv.includes('--dry-run'),
  excludeRepoOwners: process.env.EXCLUDE_REPO_OWNERS 
    ? process.env.EXCLUDE_REPO_OWNERS.split(',').map(o => o.trim())
    : [],
  prScope: process.env.PR_SCOPE 
    ? process.env.PR_SCOPE.split(',').map(s => s.trim())
    : ['authored', 'assigned', 'review-requested']
};
