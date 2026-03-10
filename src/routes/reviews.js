import express from 'express';
import { dbManager } from '../database.js';
import { reviewEngine } from '../review-engine.js';
import { falsePositiveTracker } from '../false-positive-tracker.js';

const router = express.Router();

// GET /api/reviews/:id - Get review details
router.get('/:id', async (req, res) => {
  const review = dbManager.db.prepare('SELECT * FROM review_sessions WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review session not found' });
  res.json(review);
});

// POST /api/reviews/:id/cancel - Cancel review
router.post('/:id/cancel', async (req, res) => {
  await reviewEngine.cancelReview(req.params.id);
  res.json({ message: 'Cancellation requested' });
});

// GET /api/reviews/:id/comments - Get review comments
router.get('/:id/comments', async (req, res) => {
  const comments = dbManager.db.prepare('SELECT * FROM review_comments WHERE review_session_id = ?').all(req.params.id);
  res.json(comments);
});

// POST /api/comments/:id/false-positive - Mark as false positive
router.post('/comments/:id/false-positive', async (req, res) => {
  const { developer_id, justification } = req.body;
  const fpId = await falsePositiveTracker.markFalsePositive(req.params.id, developer_id, justification);
  res.json({ id: fpId, status: 'marked' });
});

export default router;
