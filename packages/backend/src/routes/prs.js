import express from 'express';
import path from 'path';
import { dbManager } from '../database.js';
import { reviewEngine } from '../review-engine.js';
import { healthScoreCalculator } from '../health-score-calculator.js';
import { autoFixService } from '../auto-fix-service.js';
import { AppError } from '../error-handler.js';

const router = express.Router();

// GET /api/prs - List PRs
router.get('/', async (req, res) => {
  const { status, repository_id } = req.query;
  const limit = Math.min(Number(req.query.limit || 25), 100);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  let query = 'SELECT * FROM pull_requests WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (repository_id) {
    query += ' AND repository_id = ?';
    params.push(repository_id);
  }

  const totalQuery = `SELECT COUNT(*) AS total FROM (${query}) AS filtered_prs`;
  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  const prs = dbManager.db.prepare(query).all(...params, limit, offset);
  const total = dbManager.db.prepare(totalQuery).get(...params).total;

  res.json({
    prs: prs,
    pagination: {
      total,
      limit,
      offset
    }
  });
});

// GET /api/prs/:id - Get PR details
router.get('/:id', async (req, res) => {
  const pr = dbManager.db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(req.params.id);
  if (!pr) {
    throw new AppError('PR not found', 404, 'PR_NOT_FOUND');
  }
  res.json(pr);
});

// POST /api/prs/:id/review - Trigger review
router.post('/:id/review', async (req, res) => {
  const pr = dbManager.db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(req.params.id);
  if (!pr) {
    throw new AppError('PR not found', 404, 'PR_NOT_FOUND');
  }

  // Start review asynchronously
  reviewEngine.reviewPR(pr, process.cwd().includes('packages/backend') ? path.resolve(process.cwd(), '../../workspace/temp') : path.resolve(process.cwd(), 'workspace/temp')).catch(e => console.error(e));

  res.json({ message: 'Review triggered', status: 'processing' });
});

// GET /api/prs/:id/health - Get health score
router.get('/:id/health', async (req, res) => {
  const score = await healthScoreCalculator.calculatePRHealthScore(req.params.id);
  res.json(score);
});

// GET /api/prs/:id/history - Get review history
router.get('/:id/history', async (req, res) => {
  const history = await reviewEngine.getReviewHistory(req.params.id);
  res.json(history);
});

export default router;
