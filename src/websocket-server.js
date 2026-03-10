import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger.js';

export class WSManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> userData
    this.sessionToken = process.env.DASHBOARD_SESSION_TOKEN || 'electron-dashboard-token';
    this.rateWindowStartedAt = 0;
    this.rateWindowCount = 0;
  }

  init(server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      logger.info('New WebSocket connection');
      
      // Setup keep-alive
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleMessage(ws, data);
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket connection closed');
      });
    });

    // Heartbeat interval
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  async handleMessage(ws, data) {
    if (data.type === 'auth') {
      if (!data.token || data.token !== this.sessionToken) {
        ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid session token' }));
        ws.close(4001, 'Invalid session token');
        return;
      }

      this.clients.set(ws, {
        userId: data.userId,
        subscriptions: new Set()
      });
      ws.send(JSON.stringify({ type: 'auth_success' }));
      return;
    }

    if (data.type === 'subscribe') {
      const client = this.clients.get(ws);
      if (!client) {
        ws.send(JSON.stringify({ type: 'error', message: 'Authenticate before subscribing' }));
        return;
      }

      if (typeof data.channel === 'string' && data.channel.length > 0) {
        client.subscriptions.add(data.channel);
        ws.send(JSON.stringify({ type: 'subscription_success', channel: data.channel }));
      }
    }
  }

  broadcast(type, payload, channel = 'dashboard') {
    if (!this.wss) return;

    const now = Date.now();
    if (now - this.rateWindowStartedAt >= 1000) {
      this.rateWindowStartedAt = now;
      this.rateWindowCount = 0;
    }

    if (this.rateWindowCount >= 10) {
      logger.warn(`WebSocket rate limit reached. Dropping event ${type}.`);
      return;
    }

    this.rateWindowCount += 1;

    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    this.wss.clients.forEach((client) => {
      const clientData = this.clients.get(client);
      if (
        client.readyState === WebSocket.OPEN
        && clientData
        && clientData.subscriptions.has(channel)
      ) {
        client.send(message);
      }
    });
  }
}

export const wsManager = new WSManager();
export default wsManager;
