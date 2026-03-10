import { dbManager } from './database.js';
import { githubClient } from './github.js';

export class RepositoryManager {
  constructor() {}

  async syncRepositories() {
    if (!dbManager.isAvailable()) return [];

    // Fetch all repos the user has access to or specific ones
    // For now we assume we add them manually or sync based on PRs found
    const prs = await githubClient.fetchOpenPRs();
    
    return dbManager.transaction(() => {
      const upsertStmt = dbManager.db.prepare(`
        INSERT INTO repositories (
          github_repo_id, owner, name, full_name, default_branch, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(owner, name) DO UPDATE SET
          default_branch = excluded.default_branch,
          updated_at = CURRENT_TIMESTAMP
      `);

      const repoIds = [];
      const seen = new Set();

      for (const pr of prs) {
        if (seen.has(pr.repository.nameWithOwner)) continue;
        
        const [owner, name] = pr.repository.nameWithOwner.split('/');
        // Note: github_repo_id is not in search results by default, we use 0 or fetch it
        const result = upsertStmt.run(0, owner, name, pr.repository.nameWithOwner, pr.baseRefName);
        repoIds.push(result.lastInsertRowid);
        seen.add(pr.repository.nameWithOwner);
      }

      return repoIds;
    })();
  }

  async getRepository(repositoryId) {
    if (!dbManager.isAvailable()) return null;
    return dbManager.db.prepare('SELECT * FROM repositories WHERE id = ?').get(repositoryId);
  }

  async getAllRepositories() {
    if (!dbManager.isAvailable()) return [];
    return dbManager.db.prepare('SELECT * FROM repositories').all();
  }
}

export const repositoryManager = new RepositoryManager();
export default repositoryManager;
