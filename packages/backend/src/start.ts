import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ReviewEngineService } from './modules/review/review-engine.service.js';
import { IssueResolverService } from './modules/issue/issue-resolver.service.js';
import { DiscordBotService } from './modules/discord/discord-bot.service.js';
import { TuiService } from './tui/tui.service.js';
import { applyRuntimeFlags } from './runtime/runtime-flags.js';
import 'reflect-metadata';

const REVIEW_INTERVAL = parseInt(process.env.REVIEW_INTERVAL || '600', 10);
const ISSUE_INTERVAL = parseInt(process.env.ISSUE_INTERVAL || '600', 10);
let tui: TuiService | null = null;
const runtimeFlags = applyRuntimeFlags();

function updateHeader(cycleCount: number, status: string): void {
  if (!tui) return;

  const now = new Date().toLocaleTimeString('en-GB', { hour12: false });
  tui.updateHeader(
    ` {cyan-fg}{bold}Review Agent{/}  {yellow-fg}Cycle ${cycleCount}{/}  ${status}  {gray-fg}PR:${REVIEW_INTERVAL}s Issue:${ISSUE_INTERVAL}s{/}  {gray-fg}${now}{/}  {gray-fg}[f] fetch now  q / Ctrl+C to exit{/}`,
  );
}

async function countdown(cycleCount: number, seconds: number): Promise<void> {
  if (tui) {
    let fetchNowRequested = false;
    tui.setFetchNowCallback(() => {
      fetchNowRequested = true;
    });
    for (let i = seconds; i > 0; i--) {
      if (fetchNowRequested) break;
      tui.setCountdown(i);
      updateHeader(cycleCount, `{yellow-fg}Waiting for next cycle{/}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (fetchNowRequested) break;
    }
    tui.setFetchNowCallback(null);
    tui.clearCountdown();
    tui.addLog(fetchNowRequested ? 'Fetch now triggered by user.' : 'Starting next review run...');
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const reviewEngine = app.get(ReviewEngineService);
  const issueResolver = app.get(IssueResolverService);
  const discordBot = app.get(DiscordBotService);
  tui = app.get(TuiService);
  await tui.init();

  const ready = await discordBot.waitForReady();
  if (ready) {
    await discordBot.playTTSEnglish('Hello, this is Jarvis. All systems online.');
  }
  tui.addLog('Application initialized in continuous review mode.');
  await discordBot.playTTSEnglish('Application initialized in continuous review mode.');
  if (runtimeFlags.noSound) {
    tui.addLog('Discord soundboard disabled via --no-sound.');
  }
  updateHeader(0, `{green-fg}Booted{/}`);

  process.on('SIGINT', async () => {
    tui?.addLog('Shutting down...');
    try {
      await discordBot.playTTSEnglish('Shutting down. Goodbye.');
    } catch {}
    tui?.destroy();
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    try {
      await discordBot.playTTSEnglish('Shutting down. Goodbye.');
    } catch {}
    tui?.destroy();
    await app.close();
    process.exit(0);
  });

  let cycleCount = 0;
  while (true) {
    cycleCount++;
    try {
      updateHeader(cycleCount, `{green-fg}Running PR review cycle{/}`);
      tui?.addLog(`── Cycle #${cycleCount} [PR Review] ──`);
      await reviewEngine.runAll();
    } catch (error) {
      const msg = `[NestJS] Error during PR review run: ${error.message}`;
      tui?.addLog(msg);
      updateHeader(cycleCount, `{red-fg}PR review cycle failed{/}`);
    }

    try {
      updateHeader(cycleCount, `{green-fg}Running issue resolution cycle{/}`);
      tui?.addLog(`── Cycle #${cycleCount} [Issue Resolution] ──`);
      await issueResolver.runAll();
    } catch (error) {
      const msg = `[NestJS] Error during issue resolution run: ${error.message}`;
      tui?.addLog(msg);
      updateHeader(cycleCount, `{red-fg}Issue cycle failed{/}`);
    }

    await countdown(cycleCount, REVIEW_INTERVAL);
  }
}

bootstrap().catch(error => {
  tui?.destroy();
  console.error('[NestJS] Failed to bootstrap:', error);
  process.exit(1);
});
