import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ReviewEngineService } from './modules/review/review-engine.service.js';
import 'reflect-metadata';

const REVIEW_INTERVAL = parseInt(process.env.REVIEW_INTERVAL || '600', 10);

async function countdown(seconds: number): Promise<void> {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r⏳ Next review in ${i}s... (Ctrl+C to stop)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write('\r✔ Starting next review run...                    \n');
}

async function bootstrap() {
  console.log('[NestJS] Initializing application for continuous review mode...');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const reviewEngine = app.get(ReviewEngineService);

  process.on('SIGINT', async () => {
    console.log('\n[NestJS] Shutting down...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });

  while (true) {
    try {
      await reviewEngine.runOnce();
    } catch (error) {
      console.error('[NestJS] Error during review run:', error.message);
    }
    await countdown(REVIEW_INTERVAL);
  }
}

bootstrap().catch((error) => {
  console.error('[NestJS] Failed to bootstrap:', error);
  process.exit(1);
});
