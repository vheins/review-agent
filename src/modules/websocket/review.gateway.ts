import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Logger } from '@nestjs/common';

/**
 * ReviewGateway - WebSocket Gateway for real-time updates
 * 
 * Features:
 * - Real-time broadcasting of review progress
 * - Connection tracking
 * - Express-compatible event formats
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
@WebSocketGateway({
  path: '/ws',
})
export class ReviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ReviewGateway.name);
  private clients = new Set<any>();

  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    this.clients.add(client);
    this.logger.log(`Client connected. Total clients: ${this.clients.size}`);
  }

  handleDisconnect(client: any) {
    this.clients.delete(client);
    this.logger.log(`Client disconnected. Total clients: ${this.clients.size}`);
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, data: any) {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.logger.log(`Broadcasting event: ${event}`);
    
    for (const client of this.clients) {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(payload);
      }
    }
  }

  // Specialized broadcast methods
  broadcastReviewStart(prNumber: number, repo: string) {
    this.broadcast('review:start', { prNumber, repository: repo });
  }

  broadcastReviewProgress(prNumber: number, repo: string, progress: number, message: string) {
    this.broadcast('review:progress', { prNumber, repository: repo, progress, message });
  }

  broadcastReviewComplete(prNumber: number, repo: string, result: any) {
    this.broadcast('review:complete', { prNumber, repository: repo, result });
  }

  broadcastReviewError(prNumber: number, repo: string, error: string) {
    this.broadcast('review:error', { prNumber, repository: repo, error });
  }
}
