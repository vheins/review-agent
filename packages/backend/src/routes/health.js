import express from 'express';
import { healthService } from '../health-service.js';
import { stuckTaskDetector } from '../stuck-task-detector.js';
import { auditLogger } from '../audit-logger.js';
import { dbManager } from '../database.js';

const router = express.Router();

// GET /api/health/detailed
router.get('/detailed', async (req, res) => {
  const status = await healthService.getHealthStatus();
  res.json(status);
});

// GET /api/tasks/stuck
router.get('/tasks/stuck', async (req, res) => {
  const stuck = await stuckTaskDetector.detectStuckTasks();
  res.json(stuck);
});

// POST /api/tasks/:id/recover
router.post('/tasks/:id/recover', async (req, res) => {
  const session = dbManager.db.prepare('SELECT * FROM review_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  await stuckTaskDetector.recoverTask(session);
  res.json({ status: 'recovery_initiated' });
});

// GET /api/audit
router.get('/audit', async (req, res) => {
  const { actionType, actorId } = req.query;
  const logs = await auditLogger.getAuditLogs({ actionType, actorId });
  res.json(logs);
});

// GET /api/export/:exportId
router.get('/export/:exportId', async (req, res) => {
  const row = dbManager.db.prepare('SELECT file_path FROM exports WHERE id = ?').get(req.params.exportId);
  if (!row) return res.status(404).json({ error: 'Export not found' });
  res.download(row.file_path);
});

export default router;
