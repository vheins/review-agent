import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseManager {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'history.db');
    this.db = null;
    this.dbError = null;
    this.checkpointInterval = null;
    this.initPromise = null;
    
    // Ensure data directory exists
    fs.ensureDirSync(path.dirname(this.dbPath));
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      try {
        const Database = (await import('better-sqlite3')).default;
        this.db = new Database(this.dbPath);

        // Configure pragmas (Requirement 53.1)
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('cache_size = -16000'); // 16MB cache
        this.db.pragma('temp_store = MEMORY');

        // Initialize schema (Requirement 41.1, 41.2)
        await this.runMigrations();

        // Set up periodic checkpoint (Requirement 53.1)
        this.setupCheckpoint();

        console.log('✓ Database initialized successfully with WAL mode');
        return true;
      } catch (error) {
        this.dbError = error.message;
        console.warn('⚠ Database initialization failed:', error.message);
        return false;
      }
    })();
    
    return this.initPromise;
  }

  async runMigrations() {
    // Basic migration system: Check if a main table exists, if not, run full schema
    const tableExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pull_requests'").get();
    
    if (!tableExists) {
      console.log('Initializing fresh database schema...');
      const schemaPath = path.join(__dirname, 'database', 'schema.sql');
      if (await fs.pathExists(schemaPath)) {
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Execute schema in a single transaction
        this.db.transaction(() => {
          this.db.exec(schema);
          
          // Seed initial data for FK requirements (dev and repo)
          this.db.prepare(`
            INSERT OR IGNORE INTO developers (id, github_username, created_at, updated_at)
            VALUES (1, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run();
          
          this.db.prepare(`
            INSERT OR IGNORE INTO repositories (id, github_repo_id, owner, name, full_name, default_branch, created_at, updated_at)
            VALUES (1, 0, 'system', 'default', 'system/default', 'main', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run();

          // Handle legacy data migration if old table exists
          const oldTableExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pr_reviews'").get();
          if (oldTableExists) {
            console.log('Migrating legacy pr_reviews data...');
            this.db.exec(`
              INSERT OR IGNORE INTO pull_requests (github_pr_id, repository_id, author_id, title, status, source_branch, target_branch, created_at, updated_at)
              SELECT 
                pr_number as github_pr_id, 
                1 as repository_id, 
                1 as author_id, 
                pr_title as title, 
                'closed' as status,
                'unknown' as source_branch,
                'main' as target_branch,
                reviewed_at as created_at,
                reviewed_at as updated_at
              FROM pr_reviews;
            `);
          }
        })();
      } else {
        throw new Error(`Schema file not found at ${schemaPath}`);
      }
    }

    this.applyIncrementalMigrations();
  }

  applyIncrementalMigrations() {
    const hasErrorLogs = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='error_logs'").get();
    if (!hasErrorLogs) {
      this.db.exec(`
        CREATE TABLE error_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          message TEXT NOT NULL,
          stack_trace TEXT,
          severity TEXT NOT NULL,
          context TEXT,
          request_path TEXT,
          request_method TEXT,
          actor_id TEXT,
          created_at DATETIME NOT NULL
        );

        CREATE INDEX idx_error_logs_created ON error_logs(created_at);
        CREATE INDEX idx_error_logs_severity ON error_logs(severity, created_at);
      `);
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pr_repo_status ON pull_requests(repository_id, status);
      CREATE INDEX IF NOT EXISTS idx_review_pr_completed ON review_sessions(pr_id, completed_at);
      CREATE INDEX IF NOT EXISTS idx_test_pr_completed ON test_runs(pr_id, completed_at);
    `);
  }

  setupCheckpoint() {
    // Run a passive checkpoint every 5 minutes
    this.checkpointInterval = setInterval(() => {
      if (this.db) {
        try {
          this.db.pragma('wal_checkpoint(PASSIVE)');
          console.log('Database checkpoint completed');
        } catch (error) {
          console.error('Database checkpoint failed:', error.message);
        }
      }
    }, 5 * 60 * 1000);
    
    // Ensure it doesn't keep the process alive
    this.checkpointInterval.unref();
  }

  close() {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Helper to run in a transaction (Requirement 53.1)
  transaction(fn) {
    return this.db.transaction(fn);
  }

  isAvailable() {
    return this.db !== null;
  }

  getError() {
    return this.dbError;
  }

  addReview(review) {
    if (!this.db) return;
    try {
      this.transaction(() => {
        // Ensure repository exists
        let repo = this.db.prepare('SELECT id FROM repositories WHERE full_name = ?').get(review.repository);
        if (!repo) {
          const parts = (review.repository || '').split('/');
          const owner = parts[0] || 'unknown';
          const name = parts[1] || 'unknown';
          const repoId = Math.floor(Math.random() * 1000000);
          const res = this.db.prepare(
            'INSERT INTO repositories (github_repo_id, owner, name, full_name, default_branch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
          ).run(repoId, owner, name, review.repository || 'unknown', 'main');
          repo = { id: res.lastInsertRowid };
        }

        // Ensure PR exists
        let pr = this.db.prepare('SELECT id FROM pull_requests WHERE github_pr_id = ?').get(review.pr_number);
        if (!pr) {
          const res = this.db.prepare(`
            INSERT INTO pull_requests (github_pr_id, repository_id, author_id, title, source_branch, target_branch, status, created_at, updated_at)
            VALUES (?, ?, 1, ?, 'unknown', 'main', 'closed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(review.pr_number, repo.id, review.pr_title || 'Unknown');
          pr = { id: res.lastInsertRowid };
        }

        // Insert review session
        this.db.prepare(`
          INSERT INTO review_sessions (pr_id, executor_type, status, started_at, completed_at, outcome, quality_score)
          VALUES (?, 'unknown', 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)
        `).run(pr.id, review.decision || 'unknown', review.severity_score || 0);
      })();
    } catch (error) {
      console.warn('Failed to add review:', error.message);
    }
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

export { dbManager, DatabaseManager };
export default dbManager;
