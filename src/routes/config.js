import express from 'express';
import { configManager } from '../config.js';
import { ruleEngine } from '../rule-engine.js';
import { dbManager } from '../database.js';

const router = express.Router();

// GET /api/config/:repoId
router.get('/:repoId', async (req, res) => {
  const config = await configManager.getRepoConfig(req.params.repoId);
  res.json(config);
});

// PUT /api/config/:repoId
router.put('/:repoId', async (req, res) => {
  const success = await configManager.saveRepoConfig(req.params.repoId, req.body, 'user');
  res.json({ success });
});

// GET /api/rules/:repoId
router.get('/rules/:repoId', async (req, res) => {
  const rules = await ruleEngine.loadRules(req.params.repoId);
  res.json(rules);
});

// POST /api/rules/:repoId
router.post('/rules/:repoId', async (req, res) => {
  const ruleId = await ruleEngine.saveRule(req.params.repoId, req.body);
  res.json({ id: ruleId });
});

export default router;
