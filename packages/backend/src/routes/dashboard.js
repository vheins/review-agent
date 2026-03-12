import express from 'express';
import { dbManager } from '../database.js';

const router = express.Router();

// GET /api/dashboard - Get dashboard snapshot
router.get('/', async (req, res, next) => {
    try {
        const rangeDays = parseInt(req.query.rangeDays) || 30;
        const startDate = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

        // Check if database is initialized
        if (!dbManager.db) {
            return res.json({
                snapshot: {
                    overview: { openPRs: 0, blockingPRs: 0, avgReviewSeconds: 0, slaComplianceRate: 0, avgHealthScore: 0 },
                    metricsOverview: { total_reviews: 0 },
                    repositories: [],
                    reviewQueue: [],
                    recentActivity: [],
                    workload: [],
                    configSummary: [],
                    approvalByExecutor: [],
                    trendData: []
                }
            });
        }

        // Get overview metrics with safe fallbacks
        let overview = { openPRs: 0, blockingPRs: 0, avgReviewSeconds: 0, slaComplianceRate: 0, avgHealthScore: 0 };
        try {
            overview = {
                openPRs: dbManager.db.prepare(`SELECT COUNT(*) as count FROM pull_requests WHERE status = 'open'`).get()?.count || 0,
                blockingPRs: dbManager.db.prepare(`SELECT COUNT(*) as count FROM pull_requests WHERE status = 'open' AND (priority_score >= 85 OR health_score <= 80)`).get()?.count || 0,
                avgReviewSeconds: dbManager.db.prepare(`SELECT AVG(duration_seconds) as avg FROM review_sessions WHERE completed_at >= ? AND status = 'completed'`).get(startDate)?.avg || 0,
                slaComplianceRate: 85,
                avgHealthScore: dbManager.db.prepare(`SELECT AVG(health_score) as avg FROM pull_requests WHERE health_score IS NOT NULL`).get()?.avg || 0
            };
        } catch (e) {
            console.error('Error fetching overview:', e.message);
        }

        // Get metrics overview
        let metricsOverview = { total_reviews: 0 };
        try {
            metricsOverview = {
                total_reviews: dbManager.db.prepare(`SELECT COUNT(*) as count FROM review_sessions WHERE completed_at >= ? AND status = 'completed'`).get(startDate)?.count || 0
            };
        } catch (e) {
            console.error('Error fetching metrics overview:', e.message);
        }

        // Get repositories
        let repositories = [];
        try {
            repositories = dbManager.db.prepare(`SELECT DISTINCT id, full_name, default_branch FROM repositories ORDER BY full_name`).all() || [];
        } catch (e) {
            console.error('Error fetching repositories:', e.message);
        }

        // Get review queue
        let reviewQueue = [];
        try {
            reviewQueue = dbManager.db.prepare(`
        SELECT pr.id, pr.github_pr_id, pr.title, pr.repository_id, r.full_name as repository, pr.author, pr.status, pr.priority_score, pr.health_score, pr.is_blocking
        FROM pull_requests pr
        LEFT JOIN repositories r ON pr.repository_id = r.id
        WHERE pr.status = 'open'
        ORDER BY pr.priority_score DESC, pr.created_at ASC
        LIMIT 10
      `).all() || [];
        } catch (e) {
            console.error('Error fetching review queue:', e.message);
        }

        // Get recent activity
        let recentActivity = [];
        try {
            recentActivity = dbManager.db.prepare(`
        SELECT 'review' as source, executor_type as title, outcome as status, outcome as tone, 'Review completed' as description, completed_at as occurred_at
        FROM review_sessions
        WHERE completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 8
      `).all() || [];
        } catch (e) {
            console.error('Error fetching recent activity:', e.message);
        }

        // Get workload data
        let workload = [];
        try {
            workload = dbManager.db.prepare(`
        SELECT author as label, COUNT(*) * 10 as value
        FROM pull_requests
        WHERE status = 'open'
        GROUP BY author
        ORDER BY value DESC
        LIMIT 5
      `).all() || [];
        } catch (e) {
            console.error('Error fetching workload:', e.message);
        }

        // Get config summary
        const configSummary = repositories.map(repo => ({
            repository: repo.full_name,
            mode: 'comment',
            interval: 600,
            autoMerge: true,
            threshold: 10
        }));

        // Get approval by executor
        let approvalByExecutor = [];
        try {
            approvalByExecutor = dbManager.db.prepare(`
        SELECT executor_type, COUNT(*) as total, SUM(CASE WHEN outcome = 'approved' THEN 1 ELSE 0 END) as approved
        FROM review_sessions
        WHERE completed_at >= ?
        GROUP BY executor_type
      `).all(startDate).map(row => ({
                executor_type: row.executor_type,
                approval_rate: row.total > 0 ? (row.approved / row.total) * 100 : 0
            })) || [];
        } catch (e) {
            console.error('Error fetching approval by executor:', e.message);
        }

        // Get trend data
        let trendData = [];
        try {
            trendData = dbManager.db.prepare(`
        SELECT DATE(completed_at) as date, AVG(duration_seconds) as avg_duration
        FROM review_sessions
        WHERE completed_at >= ?
        GROUP BY DATE(completed_at)
        ORDER BY date ASC
      `).all(startDate).map(row => ({
                label: row.date.slice(5, 10),
                value: row.avg_duration || 0
            })) || [];
        } catch (e) {
            console.error('Error fetching trend data:', e.message);
        }

        const snapshot = {
            overview,
            metricsOverview,
            repositories,
            reviewQueue,
            recentActivity,
            workload,
            configSummary,
            approvalByExecutor,
            trendData
        };

        res.json({ snapshot });
    } catch (error) {
        console.error('Dashboard error:', error);
        next(error);
    }
});

export default router;
