import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { dbManager } from './database.js';
import { logger } from './logger.js';

export class TestAndHealService {
  constructor() {}

  async runTests(repoDir, prId, type = 'initial') {
    if (!dbManager.isAvailable()) return null;

    const startTime = new Date().toISOString();
    logger.info(`Running tests for PR #${prId} (${type})...`);

    try {
      const { stdout, stderr, exitCode } = await execa('npm', ['test'], { cwd: repoDir, reject: false });
      const endTime = new Date().toISOString();
      const status = exitCode === 0 ? 'passed' : 'failed';

      const testRunId = dbManager.db.prepare(`
        INSERT INTO test_runs (
          pr_id, run_type, status, test_results, started_at, completed_at, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        prId, type, status, 
        JSON.stringify({ stdout, stderr }), 
        startTime, endTime,
        Math.floor((new Date(endTime) - new Date(startTime)) / 1000)
      ).lastInsertRowid;

      let healResult = null;
      if (status === 'failed') {
        const failures = this.parseFailures(stderr || stdout);
        dbManager.db.prepare('UPDATE test_runs SET failures_detected = ? WHERE id = ?')
          .run(JSON.stringify(failures), testRunId);

        if (type === 'initial' && failures.some(f => f.healable)) {
          healResult = await this.healFailures(repoDir, prId, failures);
        }
      }

      return { testRunId, status, healResult };
    } catch (e) {
      logger.error(`Test execution crashed: ${e.message}`);
      return null;
    }
  }

  parseFailures(output) {
    const failures = [];
    
    if (output.includes('Module not found') || output.includes('Cannot find module')) {
      failures.push({ type: 'import_error', healable: true, message: 'Missing or incorrect import' });
    }
    
    if (output.includes('Snapshot mismatch') || output.includes('snapshot failed')) {
      failures.push({ type: 'snapshot_mismatch', healable: true, message: 'UI snapshots need update' });
    }

    if (output.includes('timeout') || output.includes('exceeded timeout')) {
      failures.push({ type: 'timeout', healable: false, message: 'Test timed out' });
    }

    return failures;
  }

  async healFailures(repoDir, prId, failures) {
    logger.info(`Attempting to heal ${failures.length} failures...`);
    let healed = false;

    for (const failure of failures) {
      if (failure.type === 'snapshot_mismatch') {
        logger.info('Healing: Updating snapshots...');
        await execa('npm', ['test', '--', '-u'], { cwd: repoDir, reject: false });
        healed = true;
      }
      
      if (failure.type === 'import_error') {
        logger.info('Healing: Running npm install to fix missing modules...');
        await execa('npm', ['install'], { cwd: repoDir, reject: false });
        healed = true;
      }
    }

    if (healed) {
      // Re-run tests
      return await this.runTests(repoDir, prId, 'post_heal');
    }

    return null;
  }
}

export const testAndHealService = new TestAndHealService();
export default testAndHealService;
