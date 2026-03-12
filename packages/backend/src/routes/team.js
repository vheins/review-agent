import express from 'express';
import { dbManager } from '../database.js';
import { assignmentEngine } from '../assignment-engine.js';

const router = express.Router();

// POST /api/assignments/assign
router.post('/assign', async (req, res) => {
  const { prId, files, authorId } = req.body;
  const assigned = await assignmentEngine.assignReviewers(prId, files, authorId);
  res.json({ assigned_ids: assigned });
});

// GET /api/assignments/workload
router.get('/workload', async (req, res) => {
  const devs = dbManager.db.prepare('SELECT id, github_username, current_workload_score FROM developers').all();
  res.json(devs);
});

// PUT /api/developers/:id/availability
router.put('/developers/:id/availability', async (req, res) => {
  const { is_available, unavailable_until } = req.body;
  await assignmentEngine.setAvailability(req.params.id, is_available, unavailable_until);
  res.json({ status: 'updated' });
});

export default router;
