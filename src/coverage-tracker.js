import { dbManager } from './database.js';

export class CoverageTracker {
  constructor() {}

  async recordCoverage(prId, overallCoverage, fileCoverage = {}) {
    if (!dbManager.isAvailable()) return;

    dbManager.db.prepare(`
      INSERT INTO pr_metrics (pr_id, metric_type, metric_value, recorded_at)
      VALUES (?, 'coverage_overall', ?, CURRENT_TIMESTAMP)
    `).run(prId, overallCoverage);

    // Track per-file if needed (we might need a dedicated table for granular coverage)
  }

  calculateDelta(baseCoverage, prCoverage) {
    const delta = prCoverage - baseCoverage;
    return {
      base: baseCoverage,
      current: prCoverage,
      delta,
      isDecrease: delta < -0.01 // allow for tiny float variance
    };
  }

  async getBaseBranchCoverage(repositoryId, branchName = 'main') {
    // In a real app, we'd fetch the latest coverage metric for the base branch
    // For now we return a default or query the latest merged PR's coverage
    return 80.0; // dummy
  }
}

export const coverageTracker = new CoverageTracker();
export default coverageTracker;
