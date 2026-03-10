import express from 'express';
import { dbManager } from '../database.js';
import { reviewEngine } from '../review-engine.js';
import { healthScoreCalculator } from '../health-score-calculator.js';
import { autoFixService } from '../auto-fix-service.js';

const router = express.Router();

// GET /api/prs - List PRs
router.get('/', async (req, res) => {
  const { status, repository_id } = req.query;
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

  const prs = dbManager.db.prepare(query).all(...params);
  res.json(prs);
});

// GET /api/prs/:id - Get PR details
router.get('/:id', async (req, res) => {
  const pr = dbManager.db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(req.params.id);
  if (!pr) return res.status(404).json({ error: 'PR not found' });
  res.json(pr);
});

// POST /api/prs/:id/review - Trigger review
router.post('/:id/review', async (req, res) => {
  const pr = dbManager.db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(req.params.id);
  if (!pr) return res.status(404).json({ error: 'PR not found' });

  // Start review asynchronously
  reviewEngine.reviewPR(pr, './workspace/temp').catch(e => console.error(e));
  
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
