import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ReviewEngineService } from './modules/review/review-engine.service.js';
import { TuiService } from './tui/tui.service.js';
import { applyRuntimeFlags } from './runtime/runtime-flags.js';
import 'reflect-metadata';

const REVIEW_INTERVAL = parseInt(process.env.REVIEW_INTERVAL || '600', 10);
let tui: TuiService | null = null;
const runtimeFlags = applyRuntimeFlags();

function updateHeader(cycleCount: number, status: string): void {
  if (!tui) return;

  const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
  tui.updateHeader(
    ` {cyan-fg}{bold}PR Review Agent{/}  {yellow-fg}Cycle ${cycleCount}{/}  ${status}  {gray-fg}Interval ${REVIEW_INTERVAL}s{/}  {gray-fg}${now}{/}  {gray-fg}q / Ctrl+C to exit{/}`,
  );
}

async function countdown(cycleCount: number, seconds: number): Promise<void> {
  if (tui) {
    for (let i = seconds; i > 0; i--) {
      tui.setCountdown(i);
      updateHeader(cycleCount, `{yellow-fg}Waiting for next cycle{/}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    tui.clearCountdown();
    tui.addLog('Starting next review run...');
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const reviewEngine = app.get(ReviewEngineService);
  tui = app.get(TuiService);
  await tui.init();

  tui.addLog('Application initialized in continuous review mode.');
  if (runtimeFlags.noSound) {
    tui.addLog('Discord soundboard disabled via --no-sound.');
  }
  updateHeader(0, `{green-fg}Booted{/}`);

  process.on('SIGINT', async () => {
    tui?.addLog('Shutting down...');
    tui?.destroy();
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    tui?.destroy();
    await app.close();
    process.exit(0);
  });

  let cycleCount = 0;
  while (true) {
    cycleCount++;
    try {
      updateHeader(cycleCount, `{green-fg}Running review cycle{/}`);
      tui?.addLog(`── Cycle #${cycleCount} ──`);
      await reviewEngine.runAll();
    } catch (error) {
      const msg = `[NestJS] Error during review run: ${error.message}`;
      tui?.addLog(msg);
      updateHeader(cycleCount, `{red-fg}Cycle failed{/}`);
    }
    await countdown(cycleCount, REVIEW_INTERVAL);
  }
}

bootstrap().catch((error) => {
  tui?.destroy();
  console.error('[NestJS] Failed to bootstrap:', error);
  process.exit(1);
});
