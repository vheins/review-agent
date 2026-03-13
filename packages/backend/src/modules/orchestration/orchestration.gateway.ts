import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server } from 'ws';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  path: '/orchestration',
})
export class OrchestrationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrchestrationGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    this.logger.log(`Client connected to orchestration`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client disconnected from orchestration`);
  }

  private broadcast(event: string, payload: any) {
    if (!this.server || !this.server.clients) return;
    
    const message = JSON.stringify({ event, data: payload });
    this.server.clients.forEach(client => {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(message);
      }
    });
  }

  /**
   * Broadcast mission session update
   */
  broadcastMissionUpdate(session: any) {
    this.broadcast('mission_update', session);
  }

  /**
   * Broadcast mission ledger entry
   */
  broadcastLedgerEntry(entry: any) {
    this.broadcast('ledger_entry', entry);
  }

  /**
   * Broadcast queue update
   */
  broadcastQueueUpdate(queue: any) {
    this.broadcast('queue_update', queue);
  }

  /**
   * Broadcast inbox update
   */
  broadcastInboxUpdate(item: any) {
    this.broadcast('inbox_update', item);
  }
}
