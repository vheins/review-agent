import { dbManager } from './database.js';

export class BatchProcessor {
  constructor() {}

  async findRelatedPRs(prId, repositoryId) {
    if (!dbManager.isAvailable()) return [];

    // Fetch files for target PR
    // We assume file info is either in DB or we fetch it.
    // For now, let's assume we have a way to get files for a PR.
    // In a real app, we might have a pr_files table.
    
    // For this implementation, let's use a simple heuristic:
    // PRs in the same repository that are open are candidates.
    // We'll group them by shared base branch or overlapping titles/descriptions.
    
    const targetPR = dbManager.db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(prId);
    if (!targetPR) return [];

    const otherOpenPRs = dbManager.db.prepare(
      'SELECT * FROM pull_requests WHERE repository_id = ? AND status = "open" AND id != ?'
    ).all(repositoryId, prId);

    const related = [];
    for (const other of otherOpenPRs) {
      if (this.isRelated(targetPR, other)) {
        related.push(other);
      }
    }

    return related;
  }

  isRelated(pr1, pr2) {
    // 1. Same target branch
    if (pr1.target_branch === pr2.target_branch) return true;

    // 2. Overlapping titles (common keywords)
    const words1 = new Set(pr1.title.toLowerCase().split(/\s+/));
    const words2 = pr2.title.toLowerCase().split(/\s+/);
    const overlap = words2.filter(w => words1.has(w) && w.length > 3);
    
    if (overlap.length > 0) return true;

    return false;
  }

  async groupPRsIntoBatches(repositoryId) {
    if (!dbManager.isAvailable()) return [];

    const openPRs = dbManager.db.prepare(
      'SELECT * FROM pull_requests WHERE repository_id = ? AND status = "open" ORDER BY created_at ASC'
    ).all(repositoryId);

    const batches = [];
    const processed = new Set();

    for (const pr of openPRs) {
      if (processed.has(pr.id)) continue;

      const currentBatch = [pr];
      processed.add(pr.id);

      for (const other of openPRs) {
        if (processed.has(other.id)) continue;

        if (this.isRelated(pr, other)) {
          currentBatch.push(other);
          processed.add(other.id);
        }
      }

      batches.push(currentBatch);
    }

    return batches;
  }
}

export const batchProcessor = new BatchProcessor();
export default batchProcessor;
