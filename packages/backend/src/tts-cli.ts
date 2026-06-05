import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DiscordBotService } from './modules/discord/discord-bot.service.js';
import 'reflect-metadata';

const message = process.argv[2] || 'J.A.R.V.I.S akan online';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const bot = app.get(DiscordBotService);
  const ready = await bot.waitForReady();
  if (!ready) {
    console.error('Discord bot not ready.');
    await app.close();
    process.exit(1);
  }

  console.log(`Sending TTS: ${message}`);
  await bot.playTTS(message);
  console.log('Done.');
  await app.close();
  process.exit(0);
}

main().catch(err => {
  console.error('TTS CLI failed:', err.message);
  process.exit(1);
});
