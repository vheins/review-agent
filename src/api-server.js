import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import http from 'http';
import { logger } from './logger.js';
import { wsManager } from './websocket-server.js';
import { config } from './config.js';
import prRoutes from './routes/prs.js';
import reviewRoutes from './routes/reviews.js';
import metricsRoutes from './routes/metrics.js';
import teamRoutes from './routes/team.js';
import securityRoutes from './routes/security.js';
import configRoutes from './routes/config.js';
import healthRoutes from './routes/health.js';

export class APIServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.port = process.env.API_PORT || 3000;
  }

  init() {
    // 1. Middleware
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(morgan('dev'));

    // 2. Auth Middleware (Simulation)
    this.app.use((req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      if (apiKey || req.path.startsWith('/api/webhooks') || req.path === '/health') {
        next();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // 3. API Routes
    this.app.use('/api/prs', prRoutes);
    this.app.use('/api/reviews', reviewRoutes);
    this.app.use('/api/metrics', metricsRoutes);
    this.app.use('/api/team', teamRoutes);
    this.app.use('/api/security', securityRoutes);
    this.app.use('/api/config', configRoutes);
    this.app.use('/api/health', healthRoutes);

    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 4. WebSocket integration
    wsManager.init(this.server);

    // 5. Error Handler
    this.app.use((err, req, res, next) => {
      logger.error(`API Error: ${err.message}`);
      res.status(500).json({ error: 'Internal Server Error' });
    });
  }

  start() {
    this.init();
    this.server.listen(this.port, () => {
      logger.info(`REST API and WebSocket server listening on port ${this.port}`);
    });
  }

  stop() {
    this.server.close();
  }
}

export const apiServer = new APIServer();
export default apiServer;
