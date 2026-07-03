import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DiscordBotService } from './modules/discord/discord-bot.service.js';
import 'reflect-metadata';

const sound = process.argv[2] || 'approved';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const bot = app.get(DiscordBotService);
  console.log(`Playing sound: ${sound}.ogg`);
  await bot.playSound(sound as 'approved' | 'rejected');
  console.log('Done.');
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Soundboard test failed:', err.message);
  process.exit(1);
});
