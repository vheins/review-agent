import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser } from 'json2csv';
import { v4 as uuidv4 } from 'uuid';
import { dbManager } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DataExporter {
  constructor(exportDir) {
    this.exportDir = exportDir || path.join(__dirname, '..', 'data', 'exports');
    fs.ensureDirSync(this.exportDir);
  }

  async exportMetrics(filters = {}, format = 'csv', userId = 'system') {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    let query = 'SELECT * FROM pr_metrics WHERE 1=1';
    const params = [];

    if (filters.pr_id) {
      query += ' AND pr_id = ?';
      params.push(filters.pr_id);
    }
    if (filters.startDate) {
      query += ' AND recorded_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND recorded_at <= ?';
      params.push(filters.endDate);
    }

    const data = dbManager.db.prepare(query).all(...params);
    return this.saveExport(data, 'metrics', format, filters, userId);
  }

  async exportReviews(filters = {}, format = 'csv', userId = 'system') {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    let query = `
      SELECT rs.*, pr.title as pr_title, pr.github_pr_id 
      FROM review_sessions rs
      JOIN pull_requests pr ON rs.pr_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.repository_id) {
      query += ' AND pr.repository_id = ?';
      params.push(filters.repository_id);
    }
    if (filters.executor_type) {
      query += ' AND rs.executor_type = ?';
      params.push(filters.executor_type);
    }

    const data = dbManager.db.prepare(query).all(...params);
    return this.saveExport(data, 'reviews', format, filters, userId);
  }

  async saveExport(data, resourceType, format, filters, userId) {
    const id = uuidv4();
    const fileName = `${resourceType}-${id}.${format}`;
    const filePath = path.join(this.exportDir, fileName);
    
    let content;
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      const parser = new Parser();
      content = data.length > 0 ? parser.parse(data) : '';
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    await fs.writeFile(filePath, content);

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    dbManager.db.prepare(`
      INSERT INTO exports (id, file_path, file_type, resource_type, filters, created_at, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, filePath, format, resourceType, JSON.stringify(filters), createdAt, expiresAt, userId);

    return { id, fileName, filePath, expiresAt };
  }

  async cleanupExpiredExports() {
    if (!dbManager.isAvailable()) return;

    const now = new Date().toISOString();
    const expired = dbManager.db.prepare('SELECT * FROM exports WHERE expires_at < ?').all(now);

    for (const item of expired) {
      if (await fs.pathExists(item.file_path)) {
        await fs.remove(item.file_path);
      }
    }

    dbManager.db.prepare('DELETE FROM exports WHERE expires_at < ?').run(now);
    console.log(`Cleaned up ${expired.length} expired exports`);
  }
}

export const dataExporter = new DataExporter();
export default dataExporter;
