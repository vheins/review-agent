import express from 'express';
import { dbManager } from '../database.js';
import { metricsEngine } from '../metrics-engine.js';
import { dataExporter } from '../data-exporter.js';

const router = express.Router();

// GET /api/metrics/overview
router.get('/overview', async (req, res) => {
  const stats = await metricsEngine.calculateMetrics();
  res.json(stats);
});

// GET /api/metrics/repository/:id
router.get('/repository/:id', async (req, res) => {
  const stats = await metricsEngine.getRepositoryMetrics(req.params.id);
  res.json(stats);
});

// GET /api/metrics/developer/:id
router.get('/developer/:id', async (req, res) => {
  const stats = await metricsEngine.getDeveloperMetrics(req.params.id);
  res.json(stats);
});

// GET /api/metrics/trends
router.get('/trends', async (req, res) => {
  const { metric_type } = req.query;
  const analysis = await metricsEngine.getTrendAnalysis(metric_type);
  res.json(analysis);
});

// POST /api/metrics/export
router.post('/export', async (req, res) => {
  const { filters, format } = req.body;
  const result = await dataExporter.exportMetrics(filters, format);
  res.json(result);
});

export default router;
