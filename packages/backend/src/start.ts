import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ReviewEngineService } from './modules/review/review-engine.service.js';
import 'reflect-metadata';

const REVIEW_INTERVAL = parseInt(process.env.REVIEW_INTERVAL || '600', 10);
let countdownVisible = false;

function clearStatusLine(): void {
  if (!countdownVisible || !process.stdout.isTTY) return;
  process.stdout.write('\r\x1b[2K');
  countdownVisible = false;
}

function installConsoleLineGuard(): void {
  const rawLog = console.log.bind(console);
  const rawWarn = console.warn.bind(console);
  const rawError = console.error.bind(console);
  const rawInfo = console.info.bind(console);

  console.log = (...args: Parameters<typeof console.log>) => {
    clearStatusLine();
    rawLog(...args);
  };

  console.warn = (...args: Parameters<typeof console.warn>) => {
    clearStatusLine();
    rawWarn(...args);
  };

  console.error = (...args: Parameters<typeof console.error>) => {
    clearStatusLine();
    rawError(...args);
  };

  console.info = (...args: Parameters<typeof console.info>) => {
    clearStatusLine();
    rawInfo(...args);
  };
}

const BANNER = `
╔══════════════════════════════════════════════════════════════════╗
║  ██████╗ ██╗   ██╗████████╗██╗   ██╗██╗  ██╗                     ║
║  ██╔══██╗██║   ██║╚══██╔══╝██║   ██║██║  ██║                     ║
║  ██████╔╝██║   ██║   ██║   ██║   ██║███████║                     ║
║  ██╔══██╗██║   ██║   ██║   ██║   ██║██╔══██║                     ║
║  ██████╔╝╚██████╔╝   ██║   ╚██████╔╝██║  ██║                     ║
║  ╚═════╝  ╚═════╝    ╚═╝    ╚═════╝ ╚═╝  ╚═╝                     ║
║                                                                  ║
║      ██╗      █████╗ ██╗    ██╗ █████╗ ███╗   ██╗               ║
║      ██║     ██╔══██╗██║    ██║██╔══██╗████╗  ██║               ║
║      ██║     ███████║██║ █╗ ██║███████║██╔██╗ ██║               ║
║      ██║     ██╔══██║██║███╗██║██╔══██║██║╚██╗██║               ║
║      ███████╗██║  ██║╚███╔███╔╝██║  ██║██║ ╚████║               ║
║      ╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═══╝               ║
╚══════════════════════════════════════════════════════════════════╝
`;

async function countdown(seconds: number): Promise<void> {
  for (let i = seconds; i > 0; i--) {
    countdownVisible = true;
    process.stdout.write(`\r⏳ Next review in ${i}s... (Ctrl+C to stop)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  clearStatusLine();
  console.log(BANNER);
  process.stdout.write('\r✔ Starting next review run...                    \n');
}

async function bootstrap() {
  installConsoleLineGuard();
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
      await reviewEngine.runAll();
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
