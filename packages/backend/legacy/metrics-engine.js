import { dbManager } from './database.js';

export class MetricsEngine {
  constructor() {}

  async recordReview(prId, executorType, startTime, endTime, outcome, rejectionReasons = []) {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    const durationSeconds = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
    const rejectionReasonsJson = JSON.stringify(rejectionReasons);

    return dbManager.transaction(() => {
      // Create review session record
      const result = dbManager.db.prepare(`
        INSERT INTO review_sessions (
          pr_id, executor_type, status, started_at, completed_at, 
          duration_seconds, outcome, rejection_reasons
        ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?)
      `).run(prId, executorType, startTime, endTime, durationSeconds, outcome, rejectionReasonsJson);

      const reviewSessionId = result.lastInsertRowid;

      // Record duration as a metric
      dbManager.db.prepare(`
        INSERT INTO pr_metrics (pr_id, metric_type, metric_value, metric_unit, recorded_at)
        VALUES (?, 'review_duration', ?, 'seconds', ?)
      `).run(prId, durationSeconds, endTime);

      return reviewSessionId;
    })();
  }

  async calculateTimeToMerge(prId) {
    if (!dbManager.isAvailable()) return null;

    const pr = dbManager.db.prepare('SELECT created_at, merged_at FROM pull_requests WHERE id = ?').get(prId);
    if (pr && pr.created_at && pr.merged_at) {
      const timeToMerge = Math.floor((new Date(pr.merged_at) - new Date(pr.created_at)) / 1000);
      
      dbManager.db.prepare('UPDATE pull_requests SET time_to_merge_seconds = ? WHERE id = ?')
        .run(timeToMerge, prId);
        
      dbManager.db.prepare(`
        INSERT INTO pr_metrics (pr_id, metric_type, metric_value, metric_unit, recorded_at)
        VALUES (?, 'time_to_merge', ?, 'seconds', ?)
      `).run(prId, timeToMerge, pr.merged_at);
      
      return timeToMerge;
    }
    return null;
  }

  async calculateMetrics(filters = {}) {
    if (!dbManager.isAvailable()) return null;

    let query = `
      SELECT 
        AVG(duration_seconds) as avg_duration,
        COUNT(*) as total_reviews,
        SUM(CASE WHEN outcome = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN outcome = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN outcome = 'needs_changes' THEN 1 ELSE 0 END) as needs_changes_count
      FROM review_sessions rs
      JOIN pull_requests pr ON rs.pr_id = pr.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.repository_id) {
      query += ' AND pr.repository_id = ?';
      params.push(filters.repository_id);
    }
    if (filters.startDate) {
      query += ' AND rs.completed_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND rs.completed_at <= ?';
      params.push(filters.endDate);
    }

    const stats = dbManager.db.prepare(query).get(...params);
    
    // Calculate approval rate
    if (stats.total_reviews > 0) {
      stats.approval_rate = (stats.approved_count / stats.total_reviews) * 100;
    } else {
      stats.approval_rate = 0;
    }

    return stats;
  }

  async getMetricsByTimeBucket(granularity = 'day', filters = {}) {
    if (!dbManager.isAvailable()) return [];

    let timeFormat;
    if (granularity === 'hour') timeFormat = '%Y-%m-%d %H:00:00';
    else if (granularity === 'month') timeFormat = '%Y-%m-01';
    else timeFormat = '%Y-%m-%d'; // default day

    let query = `
      SELECT 
        strftime(?, completed_at) as bucket,
        AVG(duration_seconds) as avg_duration,
        COUNT(*) as count
      FROM review_sessions rs
      JOIN pull_requests pr ON rs.pr_id = pr.id
      WHERE completed_at IS NOT NULL
    `;
    const params = [timeFormat];

    if (filters.repository_id) {
      query += ' AND pr.repository_id = ?';
      params.push(filters.repository_id);
    }

    query += ' GROUP BY bucket ORDER BY bucket ASC';

    return dbManager.db.prepare(query).all(...params);
  }

  async getTrendAnalysis(metricType = 'review_duration', granularity = 'day', filters = {}) {
    const data = await this.getMetricsByTimeBucket(granularity, filters);
    if (data.length < 2) return { trend: 'stable', change: 0, current_ewma: data.length === 1 ? data[0].avg_duration : 0 };

    const alpha = 0.3; // Smoothing factor
    let ewma = data[0].avg_duration;
    
    for (let i = 1; i < data.length; i++) {
      ewma = alpha * data[i].avg_duration + (1 - alpha) * ewma;
    }

    const lastValue = data[data.length - 1].avg_duration;
    const previousValue = data[data.length - 2].avg_duration;
    const change = previousValue > 0 ? ((lastValue - previousValue) / previousValue) * 100 : 0;

    return {
      current_ewma: ewma,
      last_value: lastValue,
      percentage_change: change,
      trend: change > 5 ? 'increasing' : (change < -5 ? 'decreasing' : 'stable')
    };
  }

  async detectAnomalies(metricType = 'review_duration') {
    if (!dbManager.isAvailable()) return [];

    const stats = dbManager.db.prepare(`
      SELECT 
        AVG(metric_value) as avg_val,
        SUM((metric_value - (SELECT AVG(metric_value) FROM pr_metrics WHERE metric_type = ?)) * 
            (metric_value - (SELECT AVG(metric_value) FROM pr_metrics WHERE metric_type = ?))) / COUNT(*) as variance
      FROM pr_metrics WHERE metric_type = ?
    `).get(metricType, metricType, metricType);

    if (!stats || stats.variance === null) return [];

    const stdDev = Math.sqrt(stats.variance);
    const threshold = 2 * stdDev;

    return dbManager.db.prepare(`
      SELECT * FROM pr_metrics 
      WHERE metric_type = ? AND ABS(metric_value - ?) > ?
    `).all(metricType, stats.avg_val, threshold);
  }

  async getDeveloperMetrics(developerId, filters = {}) {
    if (!dbManager.isAvailable()) return null;

    let query = `
      SELECT 
        COUNT(rs.id) as review_count,
        AVG(rs.duration_seconds) as avg_review_time,
        SUM(CASE WHEN rs.outcome = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN rs.outcome = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM review_sessions rs
      JOIN pull_requests pr ON rs.pr_id = pr.id
      WHERE pr.author_id = ?
    `;
    const params = [developerId];

    if (filters.startDate) {
      query += ' AND rs.completed_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND rs.completed_at <= ?';
      params.push(filters.endDate);
    }

    const stats = dbManager.db.prepare(query).get(...params);
    
    if (stats.review_count > 0) {
      stats.approval_rate = (stats.approved_count / stats.review_count) * 100;
      stats.rejection_rate = (stats.rejected_count / stats.review_count) * 100;
    } else {
      stats.approval_rate = 0;
      stats.rejection_rate = 0;
    }

    return stats;
  }

  async getRepositoryMetrics(repositoryId, filters = {}) {
    if (!dbManager.isAvailable()) return null;

    let query = `
      SELECT 
        COUNT(DISTINCT pr.id) as pr_volume,
        AVG(pr.time_to_merge_seconds) as avg_time_to_merge,
        AVG(pr.health_score) as avg_health_score,
        COUNT(rs.id) as total_reviews
      FROM pull_requests pr
      LEFT JOIN review_sessions rs ON pr.id = rs.pr_id
      WHERE pr.repository_id = ?
    `;
    const params = [repositoryId];

    if (filters.startDate) {
      query += ' AND pr.created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND pr.created_at <= ?';
      params.push(filters.endDate);
    }

    return dbManager.db.prepare(query).get(...params);
  }
}

export const metricsEngine = new MetricsEngine();
export default metricsEngine;
