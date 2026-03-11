import { Module, Global } from '@nestjs/common';
import { ReviewGateway } from './review.gateway.js';

@Global()
@Module({
  providers: [ReviewGateway],
  exports: [ReviewGateway],
})
export class WebSocketModule {}
