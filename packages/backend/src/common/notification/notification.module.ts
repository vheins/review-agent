import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../database/entities/notification.entity.js';
import { NotificationService } from './notification.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
  ],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
