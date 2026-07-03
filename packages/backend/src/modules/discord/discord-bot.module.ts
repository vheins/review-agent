import { Module, Global } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service.js';

@Global()
@Module({
  providers: [DiscordBotService],
  exports: [DiscordBotService],
})
export class DiscordBotModule {}
