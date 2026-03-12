import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'orchestration',
})
export class OrchestrationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OrchestrationGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to orchestration: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from orchestration: ${client.id}`);
  }

  /**
   * Broadcast mission session update
   */
  broadcastMissionUpdate(session: any) {
    this.server.emit('mission_update', session);
  }

  /**
   * Broadcast mission ledger entry
   */
  broadcastLedgerEntry(entry: any) {
    this.server.emit('ledger_entry', entry);
  }

  /**
   * Broadcast queue update
   */
  broadcastQueueUpdate(queue: any) {
    this.server.emit('queue_update', queue);
  }

  /**
   * Broadcast inbox update
   */
  broadcastInboxUpdate(item: any) {
    this.server.emit('inbox_update', item);
  }
}
