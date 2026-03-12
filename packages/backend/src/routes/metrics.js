import express from 'express';
import { dbManager } from '../database.js';
import { metricsEngine } from '../metrics-engine.js';
import { dataExporter } from '../data-exporter.js';
import { responseCache } from '../response-cache.js';

const router = express.Router();

function getCached(key, resolver) {
  const cached = responseCache.get(key);
  if (cached) {
    return cached;
  }

  return Promise.resolve(resolver()).then((value) => {
    responseCache.set(key, value);
    return value;
  });
}

// GET /api/metrics/overview
router.get('/overview', async (req, res) => {
  const cacheKey = `metrics:overview:${JSON.stringify(req.query)}`;
  const stats = await getCached(cacheKey, () => metricsEngine.calculateMetrics(req.query));
  res.json(stats);
});

// GET /api/metrics/repository/:id
router.get('/repository/:id', async (req, res) => {
  const cacheKey = `metrics:repository:${req.params.id}:${JSON.stringify(req.query)}`;
  const stats = await getCached(cacheKey, () => metricsEngine.getRepositoryMetrics(req.params.id, req.query));
  res.json(stats);
});

// GET /api/metrics/developer/:id
router.get('/developer/:id', async (req, res) => {
  const cacheKey = `metrics:developer:${req.params.id}:${JSON.stringify(req.query)}`;
  const stats = await getCached(cacheKey, () => metricsEngine.getDeveloperMetrics(req.params.id, req.query));
  res.json(stats);
});

// GET /api/metrics/trends
router.get('/trends', async (req, res) => {
  const { metric_type, granularity } = req.query;
  const cacheKey = `metrics:trends:${metric_type}:${granularity}:${JSON.stringify(req.query)}`;
  const analysis = await getCached(cacheKey, () => metricsEngine.getTrendAnalysis(metric_type, granularity, req.query));
  res.json(analysis);
});

// POST /api/metrics/export
router.post('/export', async (req, res) => {
  const { filters, format } = req.body;
  const result = await dataExporter.exportMetrics(filters, format);
  responseCache.clear('metrics:');
  res.json(result);
});

export default router;
