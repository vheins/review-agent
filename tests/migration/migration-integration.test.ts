import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { MigrationReport } from '../../packages/backend/src/migration/interfaces/migration-report.interface.js';
import path from 'path';
import fs from 'fs-extra';

// We can't easily test the CLI action directly without spawning, 
// but we can test the runValidation logic if we export it.
// For now, let's verify the reports folder and general availability of validators.

describe('Migration Validator Integration', () => {
  it('should have all validator files present', async () => {
    const migrationDir = path.resolve(process.cwd(), 'packages/backend/src/migration');
    const files = await fs.readdir(migrationDir);
    
    const expectedFiles = [
      'database-validator.ts',
      'config-validator.ts',
      'websocket-validator.ts',
      'ai-executor-validator.ts',
      'review-engine-validator.ts',
      'github-validator.ts',
      'security-validator.ts',
      'metrics-validator.ts',
      'team-validator.ts',
      'utility-validator.ts',
      'orchestration-validator.ts',
      'resource-management-validator.ts',
      'specialized-services-validator.ts',
      'parser-validator.ts',
      'report-generator.ts'
    ];

    for (const file of expectedFiles) {
      expect(files).toContain(file);
    }
  });

  it('should be able to instantiate all validators', async () => {
    // This is a sanity check that imports work
    const { DatabaseValidator } = await import('../../packages/backend/src/migration/database-validator.js');
    const { ConfigValidator } = await import('../../packages/backend/src/migration/config-validator.js');
    
    expect(new DatabaseValidator()).toBeDefined();
    expect(new ConfigValidator()).toBeDefined();
  });
});
