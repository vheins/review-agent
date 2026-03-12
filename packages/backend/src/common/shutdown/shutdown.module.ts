import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '../../database/entities/review.entity.js';
import { GracefulShutdownService } from './graceful-shutdown.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
  ],
  providers: [GracefulShutdownService],
  exports: [GracefulShutdownService],
})
export class ShutdownModule {}
