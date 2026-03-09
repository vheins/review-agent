import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'history.db');

// Ensure data directory exists
fs.ensureDirSync(path.dirname(dbPath));

const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS pr_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    pr_title TEXT NOT NULL,
    pr_url TEXT NOT NULL,
    decision TEXT NOT NULL,
    severity_score INTEGER DEFAULT 0,
    severity_breakdown TEXT,
    message TEXT,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repository, pr_number, reviewed_at)
  );

  CREATE INDEX IF NOT EXISTS idx_reviewed_at ON pr_reviews(reviewed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_repository ON pr_reviews(repository);
`);

export const prReviewDB = {
    // Add new PR review
    addReview(data) {
        const stmt = db.prepare(`
      INSERT INTO pr_reviews (repository, pr_number, pr_title, pr_url, decision, severity_score, severity_breakdown, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        return stmt.run(
            data.repository,
            data.pr_number,
            data.pr_title,
            data.pr_url,
            data.decision,
            data.severity_score || 0,
            data.severity_breakdown || '',
            data.message || ''
        );
    },

    // Get recent reviews
    getRecentReviews(limit = 50) {
        const stmt = db.prepare(`
      SELECT * FROM pr_reviews
      ORDER BY reviewed_at DESC
      LIMIT ?
    `);

        return stmt.all(limit);
    },

    // Get reviews by repository
    getReviewsByRepository(repository, limit = 20) {
        const stmt = db.prepare(`
      SELECT * FROM pr_reviews
      WHERE repository = ?
      ORDER BY reviewed_at DESC
      LIMIT ?
    `);

        return stmt.all(repository, limit);
    },

    // Get review statistics
    getStats() {
        const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN decision = 'REQUEST_CHANGES' THEN 1 ELSE 0 END) as rejected
      FROM pr_reviews
    `);

        return stmt.get();
    },

    // Clear old reviews (keep last N days)
    clearOldReviews(days = 30) {
        const stmt = db.prepare(`
      DELETE FROM pr_reviews
      WHERE reviewed_at < datetime('now', '-' || ? || ' days')
    `);

        return stmt.run(days);
    }
};

export default db;
