import express from 'express';
import { dbManager } from '../database.js';
import { securityScanner } from '../security-scanner.js';

const router = express.Router();

// GET /api/security/findings/:prId
router.get('/findings/:prId', async (req, res) => {
  const findings = await securityScanner.getFindings(req.params.prId);
  res.json(findings);
});

// GET /api/security/report/:prId
router.get('/report/:prId', async (req, res) => {
  const report = await securityScanner.generateReport(req.params.prId);
  res.json({ report });
});

// POST /api/security/scan/:prId
router.post('/scan/:prId', async (req, res) => {
  // Trigger scan asynchronously (needs files)
  res.json({ status: 'queued' });
});

export default router;
