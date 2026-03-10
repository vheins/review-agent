import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger.js';

export class WSManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // ws -> userData
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
      // Simple auth simulation
      this.clients.set(ws, { userId: data.userId });
      ws.send(JSON.stringify({ type: 'auth_success' }));
    }
  }

  broadcast(type, payload) {
    if (!this.wss) return;

    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

export const wsManager = new WSManager();
export default wsManager;
