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
    
    // Send immediate success for auth if needed by UI
    // For now we just keep it simple
  }

  handleDisconnect(client: any) {
    this.clients.delete(client);
    this.logger.log(`Client disconnected. Total clients: ${this.clients.size}`);
  }

  /**
   * Broadcast an event to all connected clients in the format expected by UI
   */
  emit(type: string, payload: any) {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    
    for (const client of this.clients) {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(message);
      }
    }
  }

  // UI-compatible broadcast methods
  broadcastReviewStarted(prNumber: number, repo: string) {
    this.emit('review_started', { prNumber, repository: repo });
  }

  broadcastReviewProgress(prNumber: number, repo: string, progress: number, message: string) {
    this.emit('review_progress', { prNumber, repository: repo, progress, message });
  }

  broadcastReviewCompleted(prNumber: number, repo: string, result: any) {
    this.emit('review_completed', { prNumber, repository: repo, result });
  }

  broadcastReviewFailed(prNumber: number, repo: string, error: string) {
    this.emit('review_failed', { prNumber, repository: repo, error });
  }

  broadcastMetricsUpdate(prNumber: number, repo: string, metrics: any) {
    this.emit('metrics_updated', { prNumber, repository: repo, metrics });
  }
}
