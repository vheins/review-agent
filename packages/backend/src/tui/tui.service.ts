import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import {
  getRandomTamagotchiSpriteTemplate,
  getTamagotchiSpriteTemplateBySeed,
  renderBitmap,
} from './sprites/index.js';
import type { PixelSpriteTemplate, SpriteMood } from './sprites/index.js';

export interface PrInfo {
  number: number;
  repo: string;
  title: string;
  key: string;
  author?: string;
}

export type PrState = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
type ConsoleMethod = 'log' | 'warn' | 'error' | 'info';

export interface CurrentReview {
  pr: PrInfo | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  step: string;
}

export interface LastReviewSummary {
  pr: PrInfo | null;
  decision: 'APPROVE' | 'REQUEST_CHANGES' | 'FAILED' | 'NONE';
  finishedAt?: number;
  durationMs?: number;
}

export interface GithubRateLimitData {
  remaining: number;
  limit: number;
  reset: Date | null;
}

interface DashboardBackend {
  init(): Promise<boolean>;
  destroy(): void;
  addLog(message: string): void;
  addAgentLog(message: string): void;
  setPrs(prs: PrInfo[]): void;
  setPrState(pr: Pick<PrInfo, 'repo' | 'number'>, state: PrState): void;
  updateHeader(text: string): void;
  setStats(stats: { total: number; success: number; failed: number; skipped: number }): void;
  setCountdown(seconds: number): void;
  clearCountdown(): void;
  setCurrentReview(pr: PrInfo | null, status: CurrentReview['status'], step: string): void;
  setLastReview(summary: LastReviewSummary): void;
  setGithubRateLimit(data: GithubRateLimitData | null): void;
}

function prKey(pr: Pick<PrInfo, 'repo' | 'number'>): string {
  return `${pr.repo}#${pr.number}`;
}

interface PrEntry {
  info: PrInfo;
  state: PrState;
}

interface ConsoleLogEntry {
  channel: LogChannel;
  message: string;
  timestamp: number;
}

function stripAnsi(s: string): string {
  return s
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1B\][0-9;]*[a-zA-Z]/g, '')
    .trim();
}

function stripTags(s: string): string {
  return s.replace(/\{[^}]+\}/g, '').trim();
}

function stripTerminalControl(s: string): string {
  return s
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

function isTerminalControlOnly(s: string): boolean {
  return stripTerminalControl(s).trim().length === 0;
}

type LogChannel = 'backend' | 'agent';
type LogFocus = 'all' | 'backend' | 'agent' | 'errors';
type TuiThemeName = 'retro-green' | 'amber-terminal';

interface TuiThemePalette {
  current: string;
  queue: string;
  logs: string;
  runtime: string;
  resultApprove: string;
  resultReject: string;
  resultFailed: string;
  resultIdle: string;
}

interface BlessedThemePalette {
  header: string;
  current: string;
  queue: string;
  backend: string;
  agent: string;
  runtime: string;
  resultIdle: string;
  resultApprove: string;
  resultReject: string;
  resultFailed: string;
}

const ANSI_THEMES: Record<TuiThemeName, TuiThemePalette> = {
  'retro-green': {
    current: '32',
    queue: '92',
    logs: '32',
    runtime: '32',
    resultApprove: '92',
    resultReject: '32',
    resultFailed: '33',
    resultIdle: '32',
  },
  'amber-terminal': {
    current: '33',
    queue: '93',
    logs: '33',
    runtime: '33',
    resultApprove: '93',
    resultReject: '91',
    resultFailed: '31',
    resultIdle: '33',
  },
};

const BLESSED_THEMES: Record<TuiThemeName, BlessedThemePalette> = {
  'retro-green': {
    header: 'green',
    current: 'green',
    queue: 'white',
    backend: 'green',
    agent: 'magenta',
    runtime: 'green',
    resultIdle: 'magenta',
    resultApprove: 'green',
    resultReject: 'red',
    resultFailed: 'yellow',
  },
  'amber-terminal': {
    header: 'yellow',
    current: 'yellow',
    queue: 'white',
    backend: 'yellow',
    agent: 'cyan',
    runtime: 'yellow',
    resultIdle: 'yellow',
    resultApprove: 'yellow',
    resultReject: 'red',
    resultFailed: 'red',
  },
};

function detectLogChannel(message: string): LogChannel {
  const backendPatterns = [
    /^\[Nest\]/,
    /^\[(?:TypeOrmModule|GithubCliService|GitHubClientService|RepositoryManagerService|ReviewEngineService|AiExecutorService|GracefulShutdownService|Manager|CLI|exec)\]/i,
    /\bStarting Review Engine\b/i,
    /\bFound \d+ open\b/i,
    /\bReview Engine \(Continuous Mode\) completed\b/i,
    /\bApplication initialized in continuous review mode\b/i,
    /\bShutting down\b/i,
  ];

  for (const pattern of backendPatterns) {
    if (pattern.test(message)) return 'backend';
  }

  const agentPatterns = [
    /^(?:[|│]|▶|⏳|✨|🔍|✅|📝|❌|→|\*)\b/u,
    /^\{.*"(?:id|body|line|severity|message|isResolved)"/,
    /^\[workspace\/.+\]\s*▶/i,
    /\b(?:claude|codex|copilot|gemini|kiro|opencode)\b/i,
    /\b(?:reviewing PR|Executing .* command|Raw review completed|Starting raw .* review)\b/i,
    /\b(?:Read|Glob|Grep|Search|Open|Edit|Write|Update|Create|Delete)\b.+\b(?:in|to)\b/i,
  ];

  for (const pattern of agentPatterns) {
    if (pattern.test(message)) return 'agent';
  }

  return 'backend';
}

function timeStr(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function shortTime(ts?: number): string {
  if (!ts) return '--:--:--';
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
}

function shortDuration(durationMs?: number): string {
  if (!durationMs || durationMs < 0) return '--';
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function isInstanceLoader(msg: string): boolean {
  return /\[Nest\]\s+\d+\s+-\s+\d+/.test(msg) && /InstanceLoader/.test(msg);
}

@Injectable()
export class TuiService implements OnModuleDestroy {
  private readonly logger = new Logger(TuiService.name);
  private backend: DashboardBackend | null = null;
  private fetchNowCallback: (() => void) | null = null;

  setFetchNowCallback(cb: (() => void) | null): void {
    this.fetchNowCallback = cb;
  }

  getFetchNowCallback(): (() => void) | null {
    return this.fetchNowCallback;
  }

  async init(): Promise<boolean> {
    const isTty = !!(process.stdout.isTTY || process.stdin.isTTY || process.env.FORCE_TUI);

    const trigger = () => this.fetchNowCallback?.();

    if (isTty && process.env.TUI_BACKEND === 'blessed') {
      const b = new BlessedBackend();
      b.setFetchNowTrigger(trigger);
      if (await b.init()) {
        this.backend = b;
        return true;
      }
      this.logger.warn('Blessed TUI init failed, falling back to ANSI dashboard mode.');
    }

    const b = new ConsoleBackend();
    b.setFetchNowTrigger(trigger);
    await b.init();
    this.backend = b;
    return true;
  }

  destroy(): void {
    if (this.backend) this.backend.destroy();
  }

  onModuleDestroy(): void {
    this.destroy();
  }

  addLog(message: string): void {
    this.backend?.addLog(message);
  }
  addAgentLog(message: string): void {
    this.backend?.addAgentLog(message);
  }
  setPrs(prs: PrInfo[]): void {
    this.backend?.setPrs(prs);
  }
  setPrState(pr: Pick<PrInfo, 'repo' | 'number'>, state: PrState): void {
    this.backend?.setPrState(pr, state);
  }
  updateHeader(text: string): void {
    this.backend?.updateHeader(text);
  }
  setStats(stats: { total: number; success: number; failed: number; skipped: number }): void {
    this.backend?.setStats(stats);
  }
  setCountdown(seconds: number): void {
    this.backend?.setCountdown(seconds);
  }
  clearCountdown(): void {
    this.backend?.clearCountdown();
  }
  setCurrentReview(pr: PrInfo | null, status: CurrentReview['status'], step: string): void {
    this.backend?.setCurrentReview(pr, status, step);
  }
  setLastReview(summary: LastReviewSummary): void {
    this.backend?.setLastReview(summary);
  }
  setGithubRateLimit(data: GithubRateLimitData | null): void {
    this.backend?.setGithubRateLimit(data);
  }
}

// ─── Blessed Backend (full TUI) ────────────────────────────────────

class BlessedBackend implements DashboardBackend {
  private isInitialized = false;
  private isDestroyed = false;
  private prs: Map<string, PrEntry> = new Map();
  private prOrder: string[] = [];
  private currentReview: CurrentReview = { pr: null, status: 'idle', step: '' };
  private lastReview: LastReviewSummary = { pr: null, decision: 'NONE' };
  private readonly lastReviewHistory: LastReviewSummary[] = [];
  private stats = { total: 0, success: 0, failed: 0, skipped: 0 };
  private countdownText = '';
  private theme: TuiThemeName =
    process.env.TUI_THEME === 'amber-terminal' ? 'amber-terminal' : 'retro-green';
  private currentReviewStartedAt: number | null = null;

  private screen: any;
  private headerBox: any;
  private currentReviewBox: any;
  private lastReviewBox: any;
  private queueBox: any;
  private backendLogWidget: any;
  private agentLogWidget: any;
  private countdownBox: any;
  private originalConsole: Partial<Record<ConsoleMethod, (...args: any[]) => void>> = {};
  private originalLoggerMethods: Record<string, Function> = {};
  private originalStdoutWrite: typeof process.stdout.write | null = null;
  private isRendering = false;
  private fetchNowTrigger: (() => void) | null = null;

  setFetchNowTrigger(cb: (() => void) | null): void {
    this.fetchNowTrigger = cb;
  }

  async init(): Promise<boolean> {
    try {
      const blessedMod = await import('blessed');
      const blessed = blessedMod.default || blessedMod;
      const theme = this.getThemePalette();

      this.screen = blessed.screen({
        smartCSR: true,
        title: 'PR Review Agent',
        cursor: { artificial: true, shape: 'line', blink: true, color: 'white' },
        terminal: process.env.TERM || 'xterm-256color',
        fullUnicode: true,
      });

      const headerH = 2;
      const availH = Math.max(16, (process.stdout.rows || 24) - headerH);
      const resultH = availH >= 24 ? 8 : availH >= 18 ? 7 : 6;
      const minQueueH = availH >= 22 ? 10 : availH >= 18 ? 9 : 7;
      const minBackendLogH = 3;
      const minAgentLogH = 3;
      const maxTopH = Math.max(resultH + minQueueH, availH - minBackendLogH - minAgentLogH);
      const topH = Math.min(maxTopH, Math.max(resultH + minQueueH, Math.round(availH * 0.66)));
      let remainingH = Math.max(minBackendLogH + minAgentLogH, availH - topH);
      let midH = Math.max(minBackendLogH, Math.floor(remainingH * 0.45));
      let botH = remainingH - midH;
      if (botH < minAgentLogH) {
        const deficit = minAgentLogH - botH;
        midH = Math.max(minBackendLogH, midH - deficit);
        botH = remainingH - midH;
      }
      const queueH = Math.max(minQueueH, topH - resultH);

      this.headerBox = blessed.text({
        parent: this.screen,
        top: 0,
        left: 0,
        width: '100%',
        height: headerH,
        content: '',
        style: { fg: theme.header, bg: 'black', bold: true },
        tags: true,
      });

      this.currentReviewBox = blessed.box({
        parent: this.screen,
        top: headerH,
        left: 0,
        width: '34%' as any,
        height: topH,
        label: ' Current Review ',
        border: { type: 'line', fg: theme.current } as any,
        style: { fg: 'white', bg: 'black', border: { fg: theme.current } },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: '│' } as any,
        tags: true,
      } as any);

      this.lastReviewBox = blessed.box({
        parent: this.screen,
        top: headerH,
        left: '34%' as any,
        width: '66%' as any,
        height: resultH,
        label: ' Review Result ',
        border: { type: 'line', fg: theme.resultIdle } as any,
        style: { fg: 'white', bg: 'black', border: { fg: theme.resultIdle } },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: '│' } as any,
        tags: true,
      } as any);

      this.queueBox = blessed.box({
        parent: this.screen,
        top: headerH + resultH,
        left: '34%' as any,
        width: '66%' as any,
        height: queueH,
        label: ' Review Queue ',
        border: { type: 'line', fg: theme.queue } as any,
        style: { fg: 'white', bg: 'black', border: { fg: theme.queue } },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: '│' } as any,
        tags: true,
      } as any);

      this.backendLogWidget = blessed.log({
        parent: this.screen,
        top: headerH + topH,
        left: 0,
        width: '100%',
        height: midH,
        label: ' Review Logs [BE] ',
        border: { type: 'line', fg: theme.backend } as any,
        style: { fg: 'white', bg: 'black', border: { fg: theme.backend } },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: '│' } as any,
        tags: true,
      } as any);

      this.agentLogWidget = blessed.log({
        parent: this.screen,
        top: headerH + topH + midH,
        left: 0,
        width: '100%',
        height: botH,
        label: ' Review Logs [AG] ',
        border: { type: 'line', fg: theme.agent } as any,
        style: { fg: 'white', bg: 'black', border: { fg: theme.agent } },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: '│' } as any,
        tags: true,
      } as any);

      this.countdownBox = blessed.text({
        parent: this.screen,
        top: headerH + topH + midH + botH,
        left: 0,
        width: '100%',
        height: 1,
        content: '',
        style: { fg: theme.runtime, bg: 'black' },
        tags: true,
      });

      this.screen.key(['escape', 'q', 'C-c'], () => {
        process.emit('SIGINT');
      });
      this.screen.key(['f'], () => {
        this.fetchNowTrigger?.();
      });
      this.screen.key(['t'], () => {
        this.theme = this.theme === 'retro-green' ? 'amber-terminal' : 'retro-green';
        this.applyTheme();
      });

      this.overrideStdout();
      this.overrideConsole();
      this.patchNestLogger();
      this.isInitialized = true;
      this.render();
      return true;
    } catch (err) {
      return false;
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.restoreConsole();
    this.restoreNestLogger();
    try {
      if (this.screen) this.screen.destroy();
    } catch {}
    this.restoreStdout();
    try {
      process.stdin.setRawMode(false);
    } catch {}
    this.isDestroyed = true;
  }

  private overrideStdout(): void {
    const tui = this;
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = function (chunk: any, encoding?: any, cb?: any): boolean {
      if (tui.isRendering || !tui.isInitialized) {
        return (tui.originalStdoutWrite as any)(chunk, encoding, cb);
      }
      const str =
        typeof chunk === 'string'
          ? chunk
          : Buffer.isBuffer(chunk)
            ? chunk.toString()
            : String(chunk);
      tui.routeCapturedOutput(str);
      if (typeof cb === 'function') cb();
      return true;
    } as any;
  }

  private restoreStdout(): void {
    if (this.originalStdoutWrite) {
      process.stdout.write = this.originalStdoutWrite;
      this.originalStdoutWrite = null;
    }
  }

  private getThemePalette(): BlessedThemePalette {
    return BLESSED_THEMES[this.theme];
  }

  private getThemeBadge(): string {
    return this.theme === 'amber-terminal' ? '[AMBER]' : '[GREEN]';
  }

  private applyTheme(): void {
    if (!this.isInitialized || this.isDestroyed) return;
    const theme = this.getThemePalette();

    if (this.headerBox) this.headerBox.style.fg = theme.header;
    if (this.currentReviewBox) {
      this.currentReviewBox.style.border = { fg: theme.current } as any;
      this.currentReviewBox.border = { type: 'line', fg: theme.current } as any;
    }
    if (this.queueBox) {
      this.queueBox.style.border = { fg: theme.queue } as any;
      this.queueBox.border = { type: 'line', fg: theme.queue } as any;
    }
    if (this.backendLogWidget) {
      this.backendLogWidget.style.border = { fg: theme.backend } as any;
      this.backendLogWidget.border = { type: 'line', fg: theme.backend } as any;
    }
    if (this.agentLogWidget) {
      this.agentLogWidget.style.border = { fg: theme.agent } as any;
      this.agentLogWidget.border = { type: 'line', fg: theme.agent } as any;
    }
    if (this.countdownBox) this.countdownBox.style.fg = theme.runtime;

    this.refreshLabels();
    this.updateFooter();
    this.updateCurrentReview();
    this.updatePrList();
    this.setLastReview(this.lastReview);
    this.render();
  }

  private refreshLabels(): void {
    if (this.currentReviewBox) this.currentReviewBox.setLabel(' Current Review ');
    if (this.lastReviewBox) this.lastReviewBox.setLabel(this.getBlessedLastReviewLabel());
    if (this.queueBox) this.queueBox.setLabel(' Review Queue ');
    if (this.backendLogWidget) this.backendLogWidget.setLabel(' Review Logs [BE] ');
    if (this.agentLogWidget) this.agentLogWidget.setLabel(' Review Logs [AG] ');
  }

  private getBlessedLastReviewLabel(): string {
    switch (this.lastReview.decision) {
      case 'APPROVE':
        return ' Review Result ✓ ';
      case 'REQUEST_CHANGES':
        return ' Review Result ! ';
      case 'FAILED':
        return ' Review Result × ';
      default:
        return ' Review Result ';
    }
  }

  private render(): void {
    if (this.isInitialized && !this.isDestroyed) {
      this.isRendering = true;
      try {
        this.screen.render();
      } catch {}
      this.isRendering = false;
    }
  }

  private overrideConsole(): void {
    const tui = this;
    const methods: ConsoleMethod[] = ['log', 'warn', 'error', 'info'];
    for (const method of methods) {
      this.originalConsole[method] = console[method].bind(console);
      console[method] = function (...args: any[]) {
        const raw = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        tui.routeCapturedOutput(raw);
      };
    }
  }

  private restoreConsole(): void {
    for (const [method, fn] of Object.entries(this.originalConsole)) {
      if (fn) (console as any)[method] = fn;
    }
  }

  private patchNestLogger(): void {
    const tui = this;
    const methods: ConsoleMethod[] = ['log', 'warn', 'error'];
    for (const method of methods) {
      const orig = (Logger as any).prototype[method];
      if (!orig) continue;
      this.originalLoggerMethods[method] = orig;
      (Logger as any).prototype[method] = function (this: any, message: any, context?: string) {
        const rendered = context ? `[${context}] ${String(message ?? '')}` : String(message ?? '');
        tui.routeCapturedOutput(rendered);
      };
    }
  }

  private restoreNestLogger(): void {
    for (const [method, fn] of Object.entries(this.originalLoggerMethods)) {
      if (fn) (Logger as any).prototype[method] = fn;
    }
    this.originalLoggerMethods = {};
  }

  private writeLog(message: string, escapeBraces = false): void {
    if (!this.isInitialized || this.isDestroyed || !this.backendLogWidget) return;
    const cleaned = stripAnsi(message);
    if (!cleaned) return;
    if (isInstanceLoader(cleaned)) return;
    const safe = escapeBraces ? cleaned.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D') : cleaned;
    const theme = this.getThemePalette();
    try {
      this.backendLogWidget.add(`[{${theme.backend}-fg}{bold}${timeStr()}{/}] ${safe}`);
    } catch {}
    this.render();
  }

  addLog(message: string): void {
    this.writeLog(message, false);
  }
  addAgentLog(message: string): void {
    if (!this.isInitialized || this.isDestroyed || !this.agentLogWidget) return;
    const cleaned = stripAnsi(message);
    if (!cleaned) return;
    const safe = cleaned.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D');
    const theme = this.getThemePalette();
    try {
      this.agentLogWidget.add(`[{${theme.agent}-fg}{bold}${timeStr()}{/}] ${safe}`);
    } catch {}
    this.render();
  }

  private addLogRaw(message: string): void {
    this.writeLog(message, true);
  }

  private routeCapturedOutput(message: string): void {
    if (!message || isTerminalControlOnly(message)) return;

    const lines = message
      .split(/\r?\n/)
      .map(line => stripAnsi(line).trim())
      .filter(Boolean);

    for (const line of lines) {
      if (isInstanceLoader(line)) continue;
      if (detectLogChannel(line) === 'agent') {
        this.addAgentLog(line);
        continue;
      }
      this.addLogRaw(line);
    }
  }

  setPrs(prs: PrInfo[]): void {
    this.prs.clear();
    this.prOrder = [];
    for (const pr of prs) {
      const key = prKey(pr);
      this.prs.set(key, { info: pr, state: 'queued' });
      this.prOrder.push(key);
    }
    this.updatePrList();
  }

  setPrState(pr: Pick<PrInfo, 'repo' | 'number'>, state: PrState): void {
    const entry = this.prs.get(prKey(pr));
    if (!entry) return;
    entry.state = state;
    this.updatePrList();
  }

  private getQueueBadge(state: PrState): string {
    switch (state) {
      case 'processing':
        return '[RUN]';
      case 'completed':
        return '[DONE]';
      case 'failed':
        return '[FAIL]';
      case 'skipped':
        return '[SKIP]';
      default:
        return '[WAIT]';
    }
  }

  private getQueueSectionKey(state: PrState): 'active' | 'waiting' | 'recent' {
    if (state === 'processing') return 'active';
    if (state === 'queued') return 'waiting';
    return 'recent';
  }

  private getQueueSectionLabel(state: PrState): string {
    switch (this.getQueueSectionKey(state)) {
      case 'active':
        return 'ACTIVE';
      case 'waiting':
        return 'WAITING';
      default:
        return 'RECENT';
    }
  }

  private getOrderedQueueKeys(): string[] {
    const active: string[] = [];
    const waiting: string[] = [];
    const recent: string[] = [];

    for (const key of this.prOrder) {
      const entry = this.prs.get(key);
      if (!entry) continue;
      const section = this.getQueueSectionKey(entry.state);
      if (section === 'active') active.push(key);
      else if (section === 'waiting') waiting.push(key);
      else recent.push(key);
    }

    return [...active, ...waiting, ...recent];
  }

  private updatePrList(): void {
    if (!this.isInitialized || this.isDestroyed || !this.queueBox) return;
    const lines: string[] = [];
    const orderedKeys = this.getOrderedQueueKeys();
    let previousSection: string | null = null;

    for (const key of orderedKeys) {
      const e = this.prs.get(key);
      if (!e) continue;
      const section = this.getQueueSectionLabel(e.state);
      if (section !== previousSection) {
        if (lines.length > 0) lines.push('');
        lines.push(` {gray-fg}┄┄ ${section} ┄┄{/}`);
        previousSection = section;
      }
      let icon: string, color: string;
      switch (e.state) {
        case 'queued':
          icon = '○';
          color = '{white-fg}';
          break;
        case 'processing':
          icon = '●';
          color = '{yellow-fg}';
          break;
        case 'completed':
          icon = '✓';
          color = '{green-fg}';
          break;
        case 'failed':
          icon = '✗';
          color = '{red-fg}';
          break;
        case 'skipped':
          icon = '–';
          color = '{gray-fg}';
          break;
      }
      const badge = this.getQueueBadge(e.state);
      lines.push(
        ` ${color}${icon}{/} {bold}${badge}{/} #${String(e.info.number)} ${e.info.repo.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D')}`,
      );
      lines.push(
        `   ${e.info.title.substring(0, 55).replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D')}`,
      );
      if (e.info.author) {
        lines.push(
          `   {gray-fg}@${e.info.author.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D')}{/}`,
        );
      }
    }
    if (lines.length === 0) {
      lines.push(' {gray-fg}┄┄ ACTIVE ┄┄{/}');
      lines.push(' {bold}BUTUH LAWAN{/}');
    }
    try {
      this.queueBox.setContent(lines.join('\n'));
    } catch {}
    this.render();
  }

  updateHeader(text: string): void {
    if (!this.isInitialized || this.isDestroyed || !this.headerBox) return;
    try {
      this.headerBox.setContent(text);
    } catch {}
    this.render();
  }

  setStats(stats: { total: number; success: number; failed: number; skipped: number }): void {
    this.stats = stats;
    this.updateFooter();
  }

  setCountdown(seconds: number): void {
    const m = Math.floor(seconds / 60),
      s = seconds % 60;
    this.countdownText = `Next review in ${m}m ${s}s`;
    this.updateFooter();
  }

  clearCountdown(): void {
    this.countdownText = '';
    if (!this.countdownBox) return;
    try {
      this.countdownBox.setContent('');
    } catch {}
    this.render();
  }

  private getFooterStateTag(): string {
    if (this.currentReview.status === 'processing') return '[RUNNING]';
    if (this.currentReview.status === 'failed') return '[FAILED]';
    if (this.currentReview.status === 'completed') return '[DONE]';
    if (this.countdownText) return '[WAITING]';
    return '[IDLE]';
  }

  private updateFooter(): void {
    if (!this.countdownBox) return;
    const theme = this.getThemePalette();
    const themeBadge = this.getThemeBadge();
    const stateTag = this.getFooterStateTag();
    const ops = `${themeBadge} ✓${this.stats.success} ✗${this.stats.failed} –${this.stats.skipped} total ${this.stats.total}`;
    const countdown = this.countdownText ? `  ${this.countdownText}` : '';
    try {
      this.countdownBox.setContent(
        ` {${theme.runtime}-fg}{bold}CORE ${stateTag}{/}  {gray-fg}┆{/}  {${theme.runtime}-fg}{bold}OPS{/} {${theme.runtime}-fg}${ops}{/}{${theme.runtime}-fg}${countdown}{/}  {gray-fg}[f] fetch now  [t] theme  [q] exit{/}`,
      );
    } catch {}
    this.render();
  }

  private getLastReviewSignal(decision: LastReviewSummary['decision']): string {
    switch (decision) {
      case 'APPROVE':
        return 'SIGNAL STABLE';
      case 'REQUEST_CHANGES':
        return 'SIGNAL ACTION REQUIRED';
      case 'FAILED':
        return 'SIGNAL SYSTEM ALERT';
      default:
        return 'SIGNAL STANDBY';
    }
  }

  setCurrentReview(pr: PrInfo | null, status: CurrentReview['status'], step: string): void {
    const previousPrKey = this.currentReview.pr?.key ?? null;
    const nextPrKey = pr?.key ?? null;
    if (!pr) {
      this.currentReviewStartedAt = null;
    } else if (
      status === 'processing' &&
      (this.currentReviewStartedAt === null ||
        previousPrKey !== nextPrKey ||
        this.currentReview.status !== 'processing')
    ) {
      this.currentReviewStartedAt = Date.now();
    }
    this.currentReview = { pr, status, step };
    this.updateCurrentReview();
  }

  setLastReview(summary: LastReviewSummary): void {
    this.lastReview = summary;
    this.rememberLastReview(summary);
    if (!this.isInitialized || this.isDestroyed || !this.lastReviewBox) return;
    const theme = this.getThemePalette();
    this.lastReviewBox.setLabel(this.getBlessedLastReviewLabel());
    if (!summary.pr || summary.decision === 'NONE') {
      this.lastReviewBox.style.border = { fg: theme.resultIdle } as any;
      this.lastReviewBox.border = { type: 'line', fg: theme.resultIdle } as any;
      const history = this.lastReviewHistory
        .slice(0, 3)
        .map(item => {
          const mark =
            item.decision === 'APPROVE' ? '✓' : item.decision === 'REQUEST_CHANGES' ? '!' : '×';
          return `${mark}#${item.pr?.number ?? '?'}`;
        })
        .join('  ');
      this.lastReviewBox.setContent(
        ` {gray-fg}┄┄ OUTCOME ┄┄{/}\n {bold}[ NONE ]{/}\n {bold}${this.getLastReviewSignal('NONE')}{/}\n {gray-fg}┄┄ META ┄┄{/}\n {gray-fg}No completed review yet{/}\n {gray-fg}Awaiting next decision{/}\n {gray-fg}┄┄ RECENT ┄┄{/}\n {gray-fg}${history || '--'}{/}`,
      );
      this.render();
      return;
    }
    const decisionColor =
      summary.decision === 'APPROVE'
        ? '{green-fg}'
        : summary.decision === 'REQUEST_CHANGES'
          ? '{red-fg}'
          : '{yellow-fg}';
    const borderColor =
      summary.decision === 'APPROVE'
        ? theme.resultApprove
        : summary.decision === 'REQUEST_CHANGES'
          ? theme.resultReject
          : theme.resultFailed;
    const decisionText = summary.decision === 'REQUEST_CHANGES' ? 'REJECT' : summary.decision;
    const decisionBadge =
      summary.decision === 'APPROVE'
        ? '<< APPROVE >>'
        : summary.decision === 'REQUEST_CHANGES'
          ? '<< REJECT >>'
          : '<< FAILED >>';
    const title = summary.pr.title.substring(0, 34).replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D');
    const author = summary.pr.author ? `@${summary.pr.author}` : 'unknown';
    const timing = `${shortTime(summary.finishedAt)}  ${shortDuration(summary.durationMs)}`;
    const history = this.lastReviewHistory
      .slice(0, 3)
      .map(item => {
        const mark =
          item.decision === 'APPROVE' ? '✓' : item.decision === 'REQUEST_CHANGES' ? '!' : '×';
        return `${mark}#${item.pr?.number ?? '?'}`;
      })
      .join('  ');
    this.lastReviewBox.style.border = { fg: borderColor } as any;
    this.lastReviewBox.border = { type: 'line', fg: borderColor } as any;
    this.lastReviewBox.setContent(
      ` {gray-fg}┄┄ OUTCOME ┄┄{/}\n ${decisionColor}{bold}${decisionBadge}{/}\n {bold}${this.getLastReviewSignal(summary.decision)}{/}\n {gray-fg}┄┄ META ┄┄{/}\n #${summary.pr.number} ${summary.pr.repo}\n {gray-fg}${title}{/}\n {gray-fg}${author}{/}  {gray-fg}${timing}{/}\n {gray-fg}┄┄ RECENT ┄┄{/}\n {gray-fg}${history || '--'}{/}`,
    );
    this.render();
  }

  setGithubRateLimit(_data: GithubRateLimitData | null): void {
    // no-op for BlessedBackend
  }

  private rememberLastReview(summary: LastReviewSummary): void {
    if (!summary.pr || summary.decision === 'NONE') return;
    this.lastReviewHistory.unshift(summary);
    if (this.lastReviewHistory.length > 3) {
      this.lastReviewHistory.splice(3);
    }
  }

  private getCurrentReviewElapsedText(): string {
    if (!this.currentReviewStartedAt) return '--';
    return shortDuration(Date.now() - this.currentReviewStartedAt);
  }

  private getCurrentReviewQueuePosition(): string {
    const pr = this.currentReview.pr;
    if (!pr) return '--/--';
    const index = this.prOrder.findIndex(key => key === pr.key);
    if (index === -1) return `1/${Math.max(1, this.prOrder.length)}`;
    return `${index + 1}/${Math.max(1, this.prOrder.length)}`;
  }

  private updateCurrentReview(): void {
    if (!this.isInitialized || this.isDestroyed || !this.currentReviewBox) return;
    const c = this.currentReview;
    if (!c.pr) {
      this.currentReviewBox.setContent(
        ` {gray-fg}┄┄ STATUS ┄┄{/}\n {bold}[IDLE]{/} Waiting for next PR\n {gray-fg}┄┄ TELEMETRY ┄┄{/}\n {gray-fg}AUTHOR{/} --\n {gray-fg}POSITION{/} --/--   {gray-fg}ELAPSED{/} --\n {gray-fg}┄┄ MODE ┄┄{/}\n {bold}MODE STANDBY{/}`,
      );
      this.render();
      return;
    }
    let icon: string, statusColor: string;
    switch (c.status) {
      case 'idle':
        icon = '○';
        statusColor = '{white-fg}';
        break;
      case 'processing':
        icon = '●';
        statusColor = '{yellow-fg}';
        break;
      case 'completed':
        icon = '✓';
        statusColor = '{green-fg}';
        break;
      case 'failed':
        icon = '✗';
        statusColor = '{red-fg}';
        break;
    }
    const title = c.pr.title.substring(0, 50).replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D');
    const repoText = `${c.pr.repo}`.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D');
    const author = c.pr.author
      ? `@${c.pr.author.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D')}`
      : 'unknown';
    const position = this.getCurrentReviewQueuePosition();
    const elapsed = this.getCurrentReviewElapsedText();
    const modeLabel =
      c.status === 'failed'
        ? 'MODE ALERT'
        : c.status === 'completed'
          ? 'MODE RESULT'
          : c.status === 'processing'
            ? 'MODE REVIEW'
            : 'MODE STANDBY';
    const stepText = c.step
      ? `\n {yellow-fg}→{/} ${c.step.replace(/{/g, '\uFF5B').replace(/}/g, '\uFF5D')}`
      : '';
    try {
      this.currentReviewBox.setContent(
        ` {gray-fg}┄┄ STATUS ┄┄{/}\n ${statusColor}${icon}{/} {bold}#${c.pr.number}{/} ${repoText}\n {gray-fg}${title}{/}\n {gray-fg}┄┄ TELEMETRY ┄┄{/}\n {gray-fg}AUTHOR{/} ${author}\n {gray-fg}POSITION{/} ${position}   {gray-fg}ELAPSED{/} ${elapsed}\n {gray-fg}┄┄ MODE ┄┄{/}\n {bold}${modeLabel}{/}${stepText}`,
      );
    } catch {}
    this.render();
  }
}

// ─── Console Backend (scrolling ANSI output, no TTY needed) ────────

class ConsoleBackend implements DashboardBackend {
  private static readonly SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private prs: Map<string, PrEntry> = new Map();
  private prOrder: string[] = [];
  private queueScrollOffset = 0;
  private currentReview: CurrentReview = { pr: null, status: 'idle', step: '' };
  private lastReview: LastReviewSummary = { pr: null, decision: 'NONE' };
  private recentReaction: LastReviewSummary = { pr: null, decision: 'NONE' };
  private recentReactionUntil = 0;
  private readonly lastReviewHistory: LastReviewSummary[] = [];
  private activeSprite: PixelSpriteTemplate = getRandomTamagotchiSpriteTemplate();
  private activeSpriteOwnerKey: string | null = null;
  private stats = { total: 0, success: 0, failed: 0, skipped: 0 };
  private countdownText = '';
  private githubRateLimit: GithubRateLimitData | null = null;
  private isDestroyed = false;
  private readonly isInteractive = !!(process.stdout.isTTY && process.stdin.isTTY);
  private headerText = 'PR Review Agent';
  private readonly logEntries: ConsoleLogEntry[] = [];
  private logFocus: LogFocus = 'all';
  private theme: TuiThemeName =
    process.env.TUI_THEME === 'amber-terminal' ? 'amber-terminal' : 'retro-green';
  private logScrollOffset = 0;
  private lastLogsViewportHeight = 0;
  private stdinListener?: (chunk: Buffer | string) => void;
  private readonly maxLogLines = 200;
  private originalConsole: Partial<Record<ConsoleMethod, (...args: any[]) => void>> = {};
  private originalLoggerMethods: Record<string, Function> = {};
  private originalStdoutWrite: typeof process.stdout.write | null = null;
  private isRendering = false;
  private animationTick = 0;
  private animationTimer: NodeJS.Timeout | null = null;
  private renderTimer: NodeJS.Timeout | null = null;
  private lastRenderAt = 0;
  private renderQueued = false;
  private lastInteractiveLayoutKey = '';
  private readonly lastInteractivePanels = new Map<string, string>();
  private currentReviewStartedAt: number | null = null;
  private currentReviewStepUpdatedAt: number | null = null;
  private fetchNowTrigger: (() => void) | null = null;

  setFetchNowTrigger(cb: (() => void) | null): void {
    this.fetchNowTrigger = cb;
  }

  async init(): Promise<boolean> {
    if (this.isInteractive) {
      this.enterInteractiveMode();
      this.overrideStdout();
      this.overrideConsole();
      this.patchNestLogger();
      this.startAnimationLoop();
      this.renderInteractive();
      return true;
    }
    this.printStatusBar('initializing');
    return true;
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.isInteractive) {
      if (this.stdinListener) process.stdin.off('data', this.stdinListener);
      try {
        process.stdin.setRawMode(false);
      } catch {}
      this.stopAnimationLoop();
      this.restoreConsole();
      this.restoreNestLogger();
      this.restoreStdout();
      process.stdout.write('\x1b[?25h\x1b[?1049l');
      process.stdout.write('\nShutting down.\n');
      return;
    }
    console.log('\n\x1B[33mShutting down.\x1B[0m');
  }

  private enterInteractiveMode(): void {
    process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H');
    try {
      process.stdin.setRawMode(true);
    } catch {}
    process.stdin.resume();
    this.stdinListener = (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const plainText = text.replace(/[\r\n]/g, '');
      if (text.includes('\u0003')) {
        process.emit('SIGINT');
        return;
      }
      if (text === '\u001b[A' || plainText === 'k') {
        this.scrollQueue(-1);
        return;
      }
      if (text === '\u001b[B' || plainText === 'j') {
        this.scrollQueue(1);
        return;
      }
      if (text === '\u001b[5~') {
        this.scrollQueue(-3);
        return;
      }
      if (text === '\u001b[6~') {
        this.scrollQueue(3);
        return;
      }
      if (text === '\u001b[H' || text === '\u001b[1~') {
        this.queueScrollOffset = 0;
        this.renderInteractive();
        return;
      }
      if (text === '\u001b[F' || text === '\u001b[4~') {
        this.queueScrollOffset = Math.max(0, this.prOrder.length - 1);
        this.renderInteractive();
        return;
      }
      if (plainText === 'a' || plainText === 'A') {
        this.logFocus = 'all';
        this.logScrollOffset = 0;
        this.renderInteractive();
        return;
      }
      if (plainText === 'b' || plainText === 'B') {
        this.logFocus = 'backend';
        this.logScrollOffset = 0;
        this.renderInteractive();
        return;
      }
      if (plainText === 'g') {
        this.logFocus = 'agent';
        this.logScrollOffset = 0;
        this.renderInteractive();
        return;
      }
      if (plainText === 'e' || plainText === 'E') {
        this.logFocus = 'errors';
        this.logScrollOffset = 0;
        this.renderInteractive();
        return;
      }
      if (plainText === 'K') {
        this.scrollLogs(1);
        return;
      }
      if (plainText === 'J') {
        this.scrollLogs(-1);
        return;
      }
      if (plainText === 'H') {
        this.logScrollOffset = this.getMaxLogScrollOffset();
        this.renderInteractive();
        return;
      }
      if (plainText === 'L' || plainText === 'G') {
        this.logScrollOffset = 0;
        this.renderInteractive();
        return;
      }
      if (text.includes('\u0015')) {
        this.scrollLogs(Math.max(3, Math.floor(this.lastLogsViewportHeight / 2)));
        return;
      }
      if (text.includes('\u0004')) {
        this.scrollLogs(-Math.max(3, Math.floor(this.lastLogsViewportHeight / 2)));
        return;
      }
      if (plainText === 't' || plainText === 'T') {
        this.theme = this.theme === 'retro-green' ? 'amber-terminal' : 'retro-green';
        this.renderInteractive();
        return;
      }
      if (plainText === 'f' || plainText === 'F') {
        this.fetchNowTrigger?.();
        return;
      }
      if (plainText === 'q' || plainText === 'Q') {
        process.emit('SIGINT');
      }
    };
    process.stdin.on('data', this.stdinListener);
  }

  private scrollQueue(delta: number): void {
    const orderedKeys = this.getOrderedQueueKeys();
    if (orderedKeys.length === 0) return;
    const maxOffset = Math.max(0, orderedKeys.length - 1);
    const nextOffset = Math.min(maxOffset, Math.max(0, this.queueScrollOffset + delta));
    if (nextOffset === this.queueScrollOffset) return;
    this.queueScrollOffset = nextOffset;
    this.renderInteractive();
  }

  private getFilteredLogEntries(): ConsoleLogEntry[] {
    return this.logEntries.filter(entry => this.matchesLogFocus(entry));
  }

  private getThemePalette(): TuiThemePalette {
    return ANSI_THEMES[this.theme];
  }

  private getThemeBadge(): string {
    return this.theme === 'amber-terminal' ? '[AMBER]' : '[GREEN]';
  }

  private getMaxLogScrollOffset(): number {
    const viewport = Math.max(1, this.lastLogsViewportHeight);
    return Math.max(0, this.getFilteredLogEntries().length - viewport);
  }

  private scrollLogs(delta: number): void {
    const maxOffset = this.getMaxLogScrollOffset();
    const nextOffset = Math.min(maxOffset, Math.max(0, this.logScrollOffset + delta));
    if (nextOffset === this.logScrollOffset) return;
    this.logScrollOffset = nextOffset;
    this.renderInteractive();
  }

  private startAnimationLoop(): void {
    if (this.animationTimer) return;
    this.animationTimer = setInterval(() => {
      if (this.isDestroyed) return;
      if (this.shouldAnimateSceneMotion()) {
        this.animationTick = (this.animationTick + 1) % 1000000;
      }
      this.renderInteractive();
    }, 120);
  }

  private stopAnimationLoop(): void {
    if (!this.animationTimer) return;
    clearInterval(this.animationTimer);
    this.animationTimer = null;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.renderQueued = false;
    this.lastInteractiveLayoutKey = '';
    this.lastInteractivePanels.clear();
  }

  private shouldAnimateSceneMotion(): boolean {
    return this.currentReview.status === 'processing';
  }

  private getInteractiveRenderIntervalMs(): number {
    if (this.currentReview.status !== 'processing') return 220;
    const outputState = this.getCurrentReviewOutputState();
    if (outputState.label.startsWith('Step stale')) return 260;
    if (outputState.label.startsWith('No log')) return 220;
    if (outputState.label.startsWith('Search')) return 180;
    return 120;
  }

  private getSpinnerFrame(offset = 0): string {
    return ConsoleBackend.SPINNER_FRAMES[
      (this.animationTick + offset) % ConsoleBackend.SPINNER_FRAMES.length
    ]!;
  }

  private getCurrentReviewDecision(): LastReviewSummary['decision'] {
    if (!this.currentReview.pr) return 'NONE';
    if (this.currentReview.status === 'failed') return 'FAILED';
    if (this.currentReview.status !== 'completed') return 'NONE';
    if (this.lastReview.pr?.key === this.currentReview.pr.key) {
      return this.lastReview.decision;
    }
    return 'APPROVE';
  }

  private getRecentReaction(): LastReviewSummary | null {
    if (Date.now() > this.recentReactionUntil) return null;
    if (!this.recentReaction.pr || this.recentReaction.decision === 'NONE') return null;
    return this.recentReaction;
  }

  private overrideStdout(): void {
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const tui = this;
    process.stdout.write = function (chunk: any, encoding?: any, cb?: any): boolean {
      if (tui.isRendering || !tui.isInteractive || !tui.originalStdoutWrite) {
        return (tui.originalStdoutWrite as any)?.(chunk, encoding, cb) ?? true;
      }
      const str =
        typeof chunk === 'string'
          ? chunk
          : Buffer.isBuffer(chunk)
            ? chunk.toString()
            : String(chunk);
      tui.routeCapturedOutput(str);
      if (typeof cb === 'function') cb();
      return true;
    } as any;
  }

  private restoreStdout(): void {
    if (this.originalStdoutWrite) {
      process.stdout.write = this.originalStdoutWrite;
      this.originalStdoutWrite = null;
    }
  }

  private overrideConsole(): void {
    const tui = this;
    const methods: ConsoleMethod[] = ['log', 'warn', 'error', 'info'];
    for (const method of methods) {
      this.originalConsole[method] = console[method].bind(console);
      console[method] = function (...args: any[]) {
        const raw = args
          .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');
        tui.routeCapturedOutput(raw);
      };
    }
  }

  private restoreConsole(): void {
    for (const [method, fn] of Object.entries(this.originalConsole)) {
      if (fn) (console as any)[method] = fn;
    }
    this.originalConsole = {};
  }

  private patchNestLogger(): void {
    const tui = this;
    const methods: ConsoleMethod[] = ['log', 'warn', 'error'];
    for (const method of methods) {
      const orig = (Logger as any).prototype[method];
      if (!orig) continue;
      this.originalLoggerMethods[method] = orig;
      (Logger as any).prototype[method] = function (this: any, message: any, context?: string) {
        const rendered = context ? `[${context}] ${String(message ?? '')}` : String(message ?? '');
        tui.routeCapturedOutput(rendered);
      };
    }
  }

  private restoreNestLogger(): void {
    for (const [method, fn] of Object.entries(this.originalLoggerMethods)) {
      if (fn) (Logger as any).prototype[method] = fn;
    }
    this.originalLoggerMethods = {};
  }

  private routeCapturedOutput(message: string): void {
    if (!message || isTerminalControlOnly(message)) return;

    const lines = message
      .split(/\r?\n/)
      .map(line => stripAnsi(line).trim())
      .filter(Boolean);

    for (const line of lines) {
      if (isInstanceLoader(line)) continue;
      this.pushLog(detectLogChannel(line), `[${timeStr()}] ${line}`);
    }

    this.renderInteractive(true);
  }

  private pushLog(channel: LogChannel, message: string): void {
    const nextEntry = { channel, message, timestamp: Date.now() };
    if (this.logScrollOffset > 0 && this.matchesLogFocus(nextEntry)) {
      this.logScrollOffset = Math.min(this.getMaxLogScrollOffset() + 1, this.logScrollOffset + 1);
    }
    this.logEntries.push(nextEntry);
    if (this.logEntries.length > this.maxLogLines) {
      this.logEntries.splice(0, this.logEntries.length - this.maxLogLines);
    }
    this.logScrollOffset = Math.min(this.logScrollOffset, this.getMaxLogScrollOffset());
  }

  private truncate(text: string, width: number): string {
    if (width <= 0) return '';
    if (text.length <= width) return text;
    if (width <= 1) return text.slice(0, width);
    return `${text.slice(0, width - 1)}…`;
  }

  private truncateStart(text: string, width: number): string {
    if (width <= 0) return '';
    if (text.length <= width) return text;
    if (width <= 1) return text.slice(text.length - width);
    return `…${text.slice(-(width - 1))}`;
  }

  private pad(text: string, width: number): string {
    const truncated = this.truncate(text, width);
    return truncated + ' '.repeat(Math.max(0, width - truncated.length));
  }

  private padLeft(text: string, width: number): string {
    const truncated = this.truncate(text, width);
    return ' '.repeat(Math.max(0, width - truncated.length)) + truncated;
  }

  private center(text: string, width: number): string {
    const truncated = this.truncate(text, width);
    if (truncated.length >= width) return truncated;
    const leftPad = Math.floor((width - truncated.length) / 2);
    return ' '.repeat(Math.max(0, leftPad)) + truncated;
  }

  private drawBox(
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    lines: string[],
    color = '36',
    contentColor?: string,
  ): string {
    if (width < 4 || height < 3) return '';
    const innerWidth = width - 2;
    const safeTitle = this.truncate(` ${title} `, Math.max(0, innerWidth - 2));
    const titleLen = safeTitle.length;
    const topFill = Math.max(0, innerWidth - titleLen);
    let out = '';
    out += `\x1b[${y};${x}H\x1b[${color}m┌${safeTitle}${'─'.repeat(topFill)}┐\x1b[0m`;
    for (let i = 0; i < height - 2; i++) {
      const line = this.pad(lines[i] || '', innerWidth);
      const content = contentColor ? `\x1b[${contentColor}m${line}\x1b[0m` : line;
      out += `\x1b[${y + 1 + i};${x}H\x1b[${color}m│\x1b[0m${content}\x1b[${color}m│\x1b[0m`;
    }
    out += `\x1b[${y + height - 1};${x}H\x1b[${color}m└${'─'.repeat(innerWidth)}┘\x1b[0m`;
    return out;
  }

  private overlayIntoBlank(base: string, start: number, text: string): string {
    const chars = this.pad(base, Math.max(base.length, start + text.length)).split('');
    for (let i = 0; i < text.length; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= chars.length) continue;
      if (chars[idx] !== ' ' || text[i] === ' ') continue;
      chars[idx] = text[i]!;
    }
    return chars.join('');
  }

  private overlayIntoLine(base: string, start: number, text: string): string {
    const chars = this.pad(base, Math.max(base.length, start + text.length)).split('');
    for (let i = 0; i < text.length; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= chars.length) continue;
      if (text[i] === ' ') continue;
      chars[idx] = text[i]!;
    }
    return chars.join('');
  }

  private overlayOpaqueLine(base: string, start: number, text: string): string {
    const chars = this.pad(base, Math.max(base.length, start + text.length)).split('');
    for (let i = 0; i < text.length; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= chars.length) continue;
      chars[idx] = text[i]!;
    }
    return chars.join('');
  }

  private getAvatarMotionPhase(status: CurrentReview['status'], isSleeping: boolean): number {
    return isSleeping
      ? Math.floor(this.animationTick / 5)
      : status === 'processing'
        ? Math.floor(this.animationTick / 3)
        : Math.floor(this.animationTick / 4);
  }

  private getAvatarDirectionGlyph(
    status: CurrentReview['status'],
    isSleeping: boolean,
    decision: LastReviewSummary['decision'] = 'NONE',
  ): string {
    if (isSleeping) return 'z';
    if (decision === 'APPROVE') return '*';
    if (decision === 'REQUEST_CHANGES') return '!';
    if (decision === 'FAILED') return 'x';
    if (status !== 'processing') return '·';
    const glyphs = ['<', '/', '^', '\\', '>', '/', '\\', '<'];
    return glyphs[this.getAvatarMotionPhase(status, isSleeping) % glyphs.length] ?? '>';
  }

  private getPingPongOffset(span: number, speed = 1): number {
    if (span <= 0) return 0;
    const phase = Math.floor(this.animationTick / Math.max(1, speed));
    const cycle = span * 2;
    const step = phase % cycle;
    return step <= span ? step : cycle - step;
  }

  private buildSparseLine(width: number, spacing: number, phase: number, glyph = '·'): string {
    const chars = Array.from({ length: width }, (_, index) =>
      (index + phase) % Math.max(2, spacing) === 0 ? glyph : ' ',
    );
    return chars.join('');
  }

  private alignLeftRight(left: string, right: string, width: number): string {
    if (width <= 0) return '';
    const safeRight = this.truncate(right, Math.max(0, Math.floor(width * 0.4)));
    const leftMax = Math.max(0, width - safeRight.length - (safeRight ? 1 : 0));
    const safeLeft = this.truncate(left, leftMax);
    const gap = Math.max(0, width - safeLeft.length - safeRight.length);
    return `${safeLeft}${' '.repeat(gap)}${safeRight}`;
  }

  private buildTelemetryTriplet(
    width: number,
    left: { label: string; value: string },
    center: { label: string; value: string },
    right: { label: string; value: string },
  ): string[] {
    if (width < 30) {
      return [
        this.alignLeftRight(
          `${left.label} ${left.value}`,
          `${center.label} ${center.value}`,
          width,
        ),
        this.alignLeftRight(`${right.label} ${right.value}`, '', width),
      ];
    }

    const separator = ' │ ';
    const totalSeparators = separator.length * 2;
    const availableWidth = Math.max(3, width - totalSeparators);
    const leftWidth = Math.max(8, Math.floor(availableWidth * 0.38));
    const centerWidth = Math.max(7, Math.floor(availableWidth * 0.24));
    const rightWidth = Math.max(7, availableWidth - leftWidth - centerWidth);

    const labelLine = [
      this.pad(this.truncate(left.label, leftWidth), leftWidth),
      this.pad(this.truncate(center.label, centerWidth), centerWidth),
      this.pad(this.truncate(right.label, rightWidth), rightWidth),
    ].join(separator);

    const valueLine = [
      this.pad(this.truncate(left.value, leftWidth), leftWidth),
      this.pad(this.truncate(center.value, centerWidth), centerWidth),
      this.pad(this.truncate(right.value, rightWidth), rightWidth),
    ].join(separator);

    return [labelLine, valueLine];
  }

  private buildSectionDivider(width: number, label: string): string {
    if (width <= 0) return '';
    const capsule = this.truncate(` ${label} `, Math.max(1, width));
    if (capsule.length >= width) return capsule;
    const fill = '┄';
    const left = Math.max(0, Math.floor((width - capsule.length) / 2));
    const right = Math.max(0, width - capsule.length - left);
    return `${fill.repeat(left)}${capsule}${fill.repeat(right)}`;
  }

  private buildFooterCoreVariants(): string[] {
    const stateTag = this.getFooterStateTag();
    const rawHeader = stripTags(this.headerText)
      .replace(/\s*q \/ Ctrl\+C to exit/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const compactHeader = rawHeader
      .replace(/^PR Review Agent\s*/i, '')
      .replace(/\bCycle\b/gi, 'C')
      .replace(/\bRunning review cycle\b/gi, 'RUN')
      .replace(/\bWaiting for next cycle\b/gi, 'WAIT')
      .replace(/\bInterval\b/gi, 'Int')
      .replace(/\s+/g, ' ')
      .trim();
    const ultraCompact = compactHeader
      .replace(/\bNext review in\b/gi, 'Next')
      .replace(/\bseconds?\b/gi, 's')
      .trim();

    return Array.from(
      new Set(
        [
          `CORE ${stateTag} ${rawHeader}`.trim(),
          `CORE ${stateTag} ${compactHeader}`.trim(),
          `${stateTag} ${compactHeader}`.trim(),
          `${stateTag} ${ultraCompact}`.trim(),
          stateTag,
        ].filter(Boolean),
      ),
    );
  }

  private buildFooterOpsVariants(): string[] {
    const stats = `✓ ${this.stats.success}  ✗ ${this.stats.failed}  – ${this.stats.skipped}  total ${this.stats.total}`;
    const statsCompact = `✓${this.stats.success} ✗${this.stats.failed} –${this.stats.skipped} t${this.stats.total}`;
    const statsTiny = `t${this.stats.total} ✓${this.stats.success} ✗${this.stats.failed}`;
    const countdown = this.countdownText ? `  ${this.countdownText}` : '';
    const theme = `  ${this.getThemeBadge()} t theme`;
    const hintsFull = `  ↑↓/jk queue  J/K log hist  H/L edge  a/b/g/e filter  [f] fetch now${theme}  q / Ctrl+C`;
    const hintsCompact = `  jk queue  JK log  H/L edge  a/b/g/e  [f] fetch${theme}`;
    const hintsTiny = `  jk q  JK log${theme}`;

    return Array.from(
      new Set([
        `OPS  ${stats}${countdown}${hintsFull}`,
        `OPS  ${stats}${countdown}${hintsCompact}`,
        `OPS  ${stats}${countdown}${hintsTiny}`,
        `OPS  ${stats}${countdown}`,
        `OPS  ${statsCompact}${countdown}`,
        `OPS  ${statsTiny}${countdown}`,
        countdown ? `OPS  ${this.countdownText}` : `OPS  ${statsTiny}`,
        `OPS  t${this.stats.total}`,
      ]),
    );
  }

  private buildFooterBar(width: number): string {
    if (width <= 0) return '';
    const separator = ' ┆ ';
    const leftVariants = this.buildFooterCoreVariants();
    const rightVariants = this.buildFooterOpsVariants();

    for (const left of leftVariants) {
      for (const right of rightVariants) {
        const leftBlockWidth = width - separator.length - right.length;
        if (leftBlockWidth < left.length || leftBlockWidth < 8) continue;
        return `${this.pad(left, leftBlockWidth)}${separator}${right}`;
      }
    }

    const fallbackLeft = leftVariants[leftVariants.length - 1] ?? this.getFooterStateTag();
    const fallbackRight = rightVariants[rightVariants.length - 1] ?? `OPS  t${this.stats.total}`;
    return this.alignLeftRight(fallbackLeft, fallbackRight, width);
  }

  private getFooterStateTag(): string {
    if (this.countdownText) return '[WAITING]';
    switch (this.currentReview.status) {
      case 'processing':
        return '[RUNNING]';
      case 'failed':
        return '[FAILED]';
      case 'completed':
        return '[DONE]';
      default:
        return '[IDLE]';
    }
  }

  private getPanelTitle(
    kind: 'current' | 'result' | 'queue' | 'logs' | 'runtime',
    width: number,
  ): string {
    const compact = width < 44;
    const ultra = width < 34;

    switch (kind) {
      case 'current':
        return ultra ? 'Review' : compact ? 'Current' : 'Current Review';
      case 'result':
        return ultra ? 'Result' : compact ? 'Review Result' : 'Review Result';
      case 'queue':
        return ultra ? 'Queue' : compact ? 'PR Queue' : 'Review Queue';
      case 'logs':
        return ultra ? 'Logs' : compact ? 'Review Logs' : 'Review Logs';
      case 'runtime':
        return ultra ? 'Runtime' : compact ? 'Runtime' : 'Runtime Status';
    }
  }

  private getLogsFocusBadge(): string {
    switch (this.logFocus) {
      case 'backend':
        return '[BE]';
      case 'agent':
        return '[AG]';
      case 'errors':
        return '[ERR]';
      default:
        return '[ALL]';
    }
  }

  private getLogsTitle(width = 0): string {
    const badge = this.getLogsFocusBadge();
    const flow = this.logScrollOffset > 0 ? '[HIST]' : '[LIVE]';
    const count = this.getFilteredLogEntries().length;
    const activity = this.currentReview.status === 'processing' ? this.getSpinnerFrame(2) : '·';
    if (width > 0 && width < 32) {
      return `Logs ${badge} ${count}`;
    }
    if (width > 0 && width < 46) {
      return `Logs ${badge} ${flow} ${count}`;
    }
    return `${this.getPanelTitle('logs', width || 999)} ${badge} ${flow} ${activity} ${count}`;
  }

  private matchesLogFocus(entry: ConsoleLogEntry): boolean {
    switch (this.logFocus) {
      case 'backend':
        return entry.channel === 'backend';
      case 'agent':
        return entry.channel === 'agent';
      case 'errors':
        return /\b(error|failed|warn|rejected|conflict|exception|timeout|exit code [1-9]|sql|abort)\b/i.test(
          entry.message,
        );
      default:
        return true;
    }
  }

  private getCurrentReviewElapsedText(): string {
    if (!this.currentReviewStartedAt) return '--';
    return shortDuration(Date.now() - this.currentReviewStartedAt);
  }

  private getCurrentReviewQueuePosition(): string {
    const pr = this.currentReview.pr;
    if (!pr) return '--/--';
    const index = this.prOrder.findIndex(key => key === pr.key);
    if (index === -1) return `1/${Math.max(1, this.prOrder.length)}`;
    return `${index + 1}/${Math.max(1, this.prOrder.length)}`;
  }

  private getQueueBadge(state: PrState): string {
    switch (state) {
      case 'processing':
        return '[RUN]';
      case 'completed':
        return '[DONE]';
      case 'failed':
        return '[FAIL]';
      case 'skipped':
        return '[SKIP]';
      default:
        return '[WAIT]';
    }
  }

  private getQueueSectionKey(state: PrState): 'active' | 'waiting' | 'recent' {
    if (state === 'processing') return 'active';
    if (state === 'queued') return 'waiting';
    return 'recent';
  }

  private getQueueSectionLabel(state: PrState): string {
    switch (this.getQueueSectionKey(state)) {
      case 'active':
        return 'ACTIVE';
      case 'waiting':
        return 'WAITING';
      default:
        return 'RECENT';
    }
  }

  private getOrderedQueueKeys(): string[] {
    const active: string[] = [];
    const waiting: string[] = [];
    const recent: string[] = [];

    for (const key of this.prOrder) {
      const entry = this.prs.get(key);
      if (!entry) continue;
      const section = this.getQueueSectionKey(entry.state);
      if (section === 'active') active.push(key);
      else if (section === 'waiting') waiting.push(key);
      else recent.push(key);
    }

    return [...active, ...waiting, ...recent];
  }

  private rememberLastReview(summary: LastReviewSummary): void {
    if (!summary.pr || summary.decision === 'NONE') return;
    this.lastReviewHistory.unshift(summary);
    if (this.lastReviewHistory.length > 3) {
      this.lastReviewHistory.splice(3);
    }
  }

  private formatLastReviewHistoryLine(width: number): string {
    if (this.lastReviewHistory.length === 0) return this.truncate('Recent --', width);
    const history = this.lastReviewHistory
      .slice(0, 3)
      .map(item => {
        const verdict =
          item.decision === 'APPROVE' ? 'ok' : item.decision === 'REQUEST_CHANGES' ? 'fix' : 'fail';
        return `#${item.pr?.number ?? '?'} ${verdict}`;
      })
      .join('  |  ');
    return this.truncate(`Recent ${history}`, width);
  }

  private getLastReviewVisual(): { title: string; color: string; badge: string } {
    const theme = this.getThemePalette();
    switch (this.lastReview.decision) {
      case 'APPROVE':
        return { title: 'Review Result ✓', color: theme.resultApprove, badge: '<< APPROVE >>' };
      case 'REQUEST_CHANGES':
        return { title: 'Review Result !', color: theme.resultReject, badge: '<< REJECT >>' };
      case 'FAILED':
        return { title: 'Review Result ×', color: theme.resultFailed, badge: '<< FAILED >>' };
      default:
        return { title: 'Review Result', color: theme.resultIdle, badge: '[ NONE ]' };
    }
  }

  private getLastReviewTitle(width: number): string {
    const base = this.getPanelTitle('result', width);
    switch (this.lastReview.decision) {
      case 'APPROVE':
        return `${base} ✓`;
      case 'REQUEST_CHANGES':
        return `${base} !`;
      case 'FAILED':
        return `${base} ×`;
      default:
        return base;
    }
  }

  private getLastReviewSignal(decision: LastReviewSummary['decision']): string {
    switch (decision) {
      case 'APPROVE':
        return 'SIGNAL STABLE';
      case 'REQUEST_CHANGES':
        return 'SIGNAL ACTION REQUIRED';
      case 'FAILED':
        return 'SIGNAL SYSTEM ALERT';
      default:
        return 'SIGNAL STANDBY';
    }
  }

  private buildReviewStatusBox(
    width: number,
    status: string,
    rightLabel: string,
    primary: string,
    secondary: string,
    detailLines: string[] = [],
  ): string[] {
    if (width < 8) {
      return [
        this.truncate(status, width),
        this.truncate(primary, width),
        this.truncate(secondary, width),
        ...detailLines.map(line => this.truncate(line, width)),
      ];
    }

    const innerWidth = width - 2;
    const title = this.truncate(` STATUS `, Math.max(0, innerWidth - 2));
    const top = `┌${title}${'─'.repeat(Math.max(0, innerWidth - title.length))}┐`;
    const lines = [
      `│${this.pad(this.alignLeftRight(status, rightLabel, innerWidth), innerWidth)}│`,
      `│${this.pad(this.alignLeftRight(primary, secondary, innerWidth), innerWidth)}│`,
    ];

    for (const detailLine of detailLines) {
      lines.push(`│${this.pad(this.truncate(detailLine, innerWidth), innerWidth)}│`);
    }

    const bottom = `└${'─'.repeat(innerWidth)}┘`;
    return [top, ...lines, bottom];
  }

  private buildCurrentReviewLogLines(width: number, maxLines: number): string[] {
    if (width <= 0 || maxLines <= 0) return [];
    const filtered = this.getFilteredLogEntries();
    if (filtered.length === 0) {
      return ['Log: --'];
    }

    const viewport = Math.max(1, maxLines);
    const maxOffset = Math.max(0, filtered.length - viewport);
    if (this.logScrollOffset > maxOffset) {
      this.logScrollOffset = maxOffset;
    }

    const end = Math.max(0, filtered.length - this.logScrollOffset);
    const sourceEntries = filtered.slice(0, end);
    const compacted: string[] = [];
    let index = sourceEntries.length - 1;

    while (index >= 0 && compacted.length < viewport) {
      const entry = sourceEntries[index]!;
      const match = entry.message.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
      const timestamp = match?.[1] ?? '--:--:--';
      const body = match?.[2] ?? entry.message;
      const source = entry.channel === 'agent' ? 'AG' : 'BE';
      const actionMatch = body.match(
        /^(?:→\s+)?(Read|Open|Edit|Write|Update|Create|Delete)\s+(.+)$/i,
      );

      if (actionMatch) {
        const action = actionMatch[1]!;
        const latestTarget = actionMatch[2]!;
        let count = 1;
        let cursor = index - 1;
        while (cursor >= 0) {
          const prev = sourceEntries[cursor]!;
          const prevMatch = prev.message.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
          const prevBody = prevMatch?.[2] ?? prev.message;
          const prevAction = prevBody.match(
            /^(?:→\s+)?(Read|Open|Edit|Write|Update|Create|Delete)\s+(.+)$/i,
          );
          if (!prevAction || prevAction[1]!.toLowerCase() !== action.toLowerCase()) {
            break;
          }
          count++;
          cursor--;
        }

        const normalizedAction = action[0]!.toUpperCase() + action.slice(1).toLowerCase();
        const tail = this.extractPathHint(latestTarget) ?? this.truncate(latestTarget, 24);
        const summary =
          count > 1
            ? `→ ${normalizedAction} ${count} files · ${tail}`
            : `→ ${normalizedAction} ${latestTarget}`;
        compacted.push(this.truncate(`[${source} ${timestamp}] ${summary}`, width));
        index = cursor;
        continue;
      }

      compacted.push(this.truncate(`[${source} ${timestamp}] ${body}`, width));
      index--;
    }

    return compacted.reverse();
  }

  private extractLogBody(message: string): string {
    return message.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '').trim();
  }

  private extractPathHint(text: string): string | null {
    const candidates = [
      text.match(/["'`]([^"'`\n]+(?:\/[^"'`\n]+)+)["'`]/)?.[1],
      text.match(/\b([A-Za-z0-9_.*-]+(?:\/[A-Za-z0-9_.*-]+)+)\b/)?.[1],
      text.match(/\b([A-Za-z0-9_.-]+\.[A-Za-z0-9_*.-]+)\b/)?.[1],
    ].filter((candidate): candidate is string => Boolean(candidate));

    const candidate = candidates.find(value => /[/.]/.test(value));
    if (!candidate) return null;

    const normalized = candidate.replace(/^\.\/+/, '').replace(/^"+|"+$/g, '');
    const parts = normalized.split('/').filter(Boolean);

    if (normalized.length <= 24) {
      return normalized;
    }

    for (let size = Math.min(4, parts.length); size >= 2; size--) {
      const tail = `…/${parts.slice(-size).join('/')}`;
      if (tail.length <= 24) return tail;
    }

    if (parts.length > 0) {
      const tail = `…/${parts[parts.length - 1]}`;
      if (tail.length <= 24) return tail;
    }

    return this.truncateStart(normalized, 24);
  }

  private extractReviewTargetHint(text: string): string | null {
    const prTarget =
      text.match(/\b(?:on|for)\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+)\b/i)?.[1] ??
      text.match(/\bPR\s+([A-Za-z0-9_.-]+#\d+)\b/i)?.[1];
    if (prTarget) {
      return this.truncate(`PR ${prTarget}`, 24);
    }

    const reviewId = text.match(/\breview\s+(\d+)\b/i)?.[1];
    if (reviewId) {
      return this.truncate(`Review ${reviewId}`, 24);
    }

    return null;
  }

  private extractGithubPullRequestTargetHint(text: string): string | null {
    const owner = text.match(/"owner":"([^"]+)"/i)?.[1];
    const repo = text.match(/"repo":"([^"]+)"/i)?.[1];
    const prNumber = text.match(
      /"(?:pullNumber|prNumber|number|pull_number|pr_number)":"?(\d+)"?/i,
    )?.[1];

    if (!owner || !repo) return null;
    const repoTarget = `${owner}/${repo}${prNumber ? `#${prNumber}` : ''}`;
    return this.truncate(repoTarget, 24);
  }

  private extractGithubPullRequestMethod(text: string): string | null {
    return text.match(/"method":"([^"]+)"/i)?.[1]?.toLowerCase() ?? null;
  }

  private getLatestLogEntry(channel?: LogChannel): ConsoleLogEntry | null {
    for (let index = this.logEntries.length - 1; index >= 0; index--) {
      const entry = this.logEntries[index]!;
      if (!channel || entry.channel === channel) return entry;
    }
    return null;
  }

  private getCurrentReviewOutputState(): {
    ageMs: number | null;
    label: string;
    boardLabel: string;
    isSearch: boolean;
  } {
    const latestAgentLog = this.getLatestLogEntry('agent');
    if (!latestAgentLog) {
      const staleMs = this.currentReviewStepUpdatedAt
        ? Math.max(0, Date.now() - this.currentReviewStepUpdatedAt)
        : null;
      if (staleMs !== null && staleMs >= 30_000) {
        return {
          ageMs: staleMs,
          label: `Step stale ${shortDuration(staleMs)}`,
          boardLabel: `STALE ${shortDuration(staleMs)}`,
          isSearch: false,
        };
      }
      return { ageMs: null, label: 'No output', boardLabel: 'NO LOG', isSearch: false };
    }

    const ageMs = Math.max(0, Date.now() - latestAgentLog.timestamp);
    const body = this.extractLogBody(latestAgentLog.message).toLowerCase();
    const isSearch = /\b(glob|grep|search|find)\b/.test(body);
    const stepAgeMs = this.currentReviewStepUpdatedAt
      ? Math.max(0, Date.now() - this.currentReviewStepUpdatedAt)
      : null;

    if (stepAgeMs !== null && stepAgeMs >= 90_000 && ageMs >= 30_000) {
      return {
        ageMs,
        label: `Step stale ${shortDuration(stepAgeMs)}`,
        boardLabel: `STALE ${shortDuration(stepAgeMs)}`,
        isSearch,
      };
    }

    if (isSearch && ageMs >= 30_000) {
      return {
        ageMs,
        label: `Search ${shortDuration(ageMs)}`,
        boardLabel: `SEARCH ${shortDuration(ageMs)}`,
        isSearch,
      };
    }

    if (ageMs >= 15_000) {
      return {
        ageMs,
        label: `No log ${shortDuration(ageMs)}`,
        boardLabel: `NO LOG ${shortDuration(ageMs)}`,
        isSearch,
      };
    }

    return {
      ageMs,
      label: `Busy ${shortDuration(ageMs)}`,
      boardLabel: `BUSY ${shortDuration(ageMs)}`,
      isSearch,
    };
  }

  private getCurrentReviewSpeechFromLogs(): string[] | null {
    const outputState = this.getCurrentReviewOutputState();
    if (outputState.label.startsWith('No log') || outputState.label.startsWith('Step stale')) {
      return null;
    }

    const recentEntries = this.logEntries.slice(-30).reverse();

    for (const entry of recentEntries) {
      const ageMs = Math.max(0, Date.now() - entry.timestamp);
      if (ageMs > 15_000) continue;
      const body = this.extractLogBody(entry.message);
      const lower = body.toLowerCase();
      const pathHint = this.extractPathHint(body);
      const reviewTarget = this.extractReviewTargetHint(body);
      const githubTarget = this.extractGithubPullRequestTargetHint(body);
      const githubMethod = this.extractGithubPullRequestMethod(body);

      if (/github_pull_request_(read|write)/i.test(body) && githubMethod) {
        if (/(get_review_comments|list_review_comments|get_comments)/.test(githubMethod)) {
          return ['Checking feedback...', githubTarget ?? 'What did they say?'];
        }
        if (/(get_diff|list_files|get_files|get_pull_request)/.test(githubMethod)) {
          return ['Reading the diff...', githubTarget ?? 'Looking closer.'];
        }
        if (
          /(create_review_comment|update_review_comment|reply_to_review_comment|add_comment)/.test(
            githubMethod,
          )
        ) {
          return ['Leaving a note...', githubTarget ?? 'This needs context.'];
        }
        if (/approve/.test(githubMethod)) {
          return ['Looks clean.', githubTarget ?? 'Ship it.'];
        }
        if (/(request_changes|changes_requested)/.test(githubMethod)) {
          return ['Needs another pass.', githubTarget ?? 'Not ready yet.'];
        }
        if (/(submit_review|create_review)/.test(githubMethod)) {
          return ['Sending verdict...', githubTarget ?? 'Here we go.'];
        }
      }

      if (/\b(glob|grep|search|find)\b/i.test(body)) {
        return ['Searching...', pathHint ?? 'Hunting for clues.'];
      }
      if (/\b(read|open)\b/i.test(body)) {
        return ['Reading file...', pathHint ?? 'Inspecting code.'];
      }
      if (/\b(edit|write|update)\b/i.test(body)) {
        return ['Editing file...', pathHint ?? 'Making a change.'];
      }
      if (/\b(create|delete)\b/i.test(body) && pathHint) {
        return [/\bdelete\b/i.test(body) ? 'Removing file...' : 'Creating file...', pathHint];
      }
      if (/\b(comment|inline comment|review comment)\b/i.test(lower)) {
        return ['Writing comment...', pathHint ?? reviewTarget ?? 'Leaving a note.'];
      }
      if (/\b(posting review|submit review|request_changes|approve|addreview)\b/i.test(lower)) {
        return ['Posting review...', reviewTarget ?? 'Sending verdict.'];
      }
      if (/\b(executing .* command|running)\b/i.test(lower)) {
        return ['Running command...', 'Working through it.'];
      }
    }

    return null;
  }

  private getCurrentReviewSpeechLines(
    status: CurrentReview['status'],
    decision: LastReviewSummary['decision'],
    step: string,
    hasPr: boolean,
  ): string[] {
    if (!hasPr) {
      return ['Waiting...', 'Need next PR.'];
    }

    if (decision === 'APPROVE') {
      return ['Looks clean.', 'Ship it.'];
    }
    if (decision === 'REQUEST_CHANGES') {
      return ['Needs changes.', 'Found an issue.'];
    }
    if (decision === 'FAILED' || status === 'failed') {
      return ['System alert.', 'Something broke.'];
    }

    if (status === 'processing') {
      const logDrivenSpeech = this.getCurrentReviewSpeechFromLogs();
      if (logDrivenSpeech) return logDrivenSpeech;
    }

    const normalizedStep = step.toLowerCase();
    const mappings: Array<{ patterns: string[]; lines: [string, string] }> = [
      {
        patterns: ['executing ai review', 'starting raw', 'raw review'],
        lines: ['Reviewing...', 'Thinking hard.'],
      },
      { patterns: ['scanning', 'scan'], lines: ['Scanning...', 'Looking for clues.'] },
      {
        patterns: ['analyzing', 'analyse', 'analyze'],
        lines: ['Analyzing...', 'Patterns detected.'],
      },
      { patterns: ['checking build', 'build'], lines: ['Checking build...', 'Hope it passes.'] },
      { patterns: ['running tests', 'test'], lines: ['Running tests...', 'No flakes, please.'] },
      {
        patterns: ['parsing comments', 'reading comments', 'comments'],
        lines: ['Reading notes...', 'Got some clues.'],
      },
      {
        patterns: ['generating review', 'writing review'],
        lines: ['Writing review...', 'Be precise.'],
      },
      {
        patterns: ['posting review', 'sending review'],
        lines: ['Sending it...', 'Ship the verdict.'],
      },
      { patterns: ['applying fix', 'patch'], lines: ['Patching...', 'Let me fix that.'] },
      { patterns: ['waiting', 'queued'], lines: ['On standby...', 'Queue moving.'] },
    ];

    for (const mapping of mappings) {
      if (mapping.patterns.some(pattern => normalizedStep.includes(pattern))) {
        return [...mapping.lines];
      }
    }

    if (status === 'processing') {
      return ['Reviewing...', 'Reading the diff.'];
    }
    if (status === 'completed') {
      return ['Looks okay.', 'Review complete.'];
    }

    return ['Still here...', 'Watching closely.'];
  }

  private getCurrentReviewModeDetail(status: CurrentReview['status'], step: string): string {
    if (status !== 'processing') return '';

    const outputState = this.getCurrentReviewOutputState();
    if (outputState.label.startsWith('No log')) {
      return outputState.label;
    }

    const logDriven = this.getCurrentReviewSpeechFromLogs()?.[0];
    if (logDriven) {
      return logDriven.replace(/\.\.\.$/, '');
    }

    const normalizedStep = step.toLowerCase();
    if (/executing ai review|starting raw|raw review/.test(normalizedStep)) return 'Active';
    if (/scan/.test(normalizedStep)) return 'Scanning';
    if (/analyz|analyse/.test(normalizedStep)) return 'Analyzing';
    if (/test/.test(normalizedStep)) return 'Running tests';
    if (/comment/.test(normalizedStep)) return 'Reviewing comments';
    if (/review/.test(normalizedStep)) return 'Reviewing';
    return 'Active';
  }

  private decorateSpeechBubble(
    lines: string[],
    width: number,
    messageLines: string[],
    anchor: { left: number; right: number; top: number; bottom: number; center: number },
  ): string[] {
    if (lines.length < 5 || width < 34 || messageLines.length === 0) {
      return lines;
    }

    const decorated = [...lines];
    const textWidth = Math.max(...messageLines.map(line => line.length));
    const bubbleInnerWidth = Math.min(Math.max(12, textWidth + 2), Math.max(12, width - 10));
    const bubbleWidth = bubbleInnerWidth + 2;
    const bubbleHeight = messageLines.length + 2;
    const placeRight = anchor.right + 3 + bubbleWidth < width;
    const bubbleCol = placeRight
      ? Math.max(1, Math.min(width - bubbleWidth - 1, anchor.right + 3))
      : Math.max(1, Math.min(width - bubbleWidth - 1, anchor.left - bubbleWidth - 2));
    const bubbleRow = Math.max(
      0,
      Math.min(lines.length - bubbleHeight - 1, anchor.top - Math.max(1, bubbleHeight - 2)),
    );
    const top = `╭${'─'.repeat(bubbleInnerWidth)}╮`;
    const bottom = `╰${'─'.repeat(bubbleInnerWidth)}╯`;

    decorated[bubbleRow] = this.overlayIntoLine(decorated[bubbleRow]!, bubbleCol, top);
    for (let index = 0; index < messageLines.length; index++) {
      const row = bubbleRow + 1 + index;
      if (row >= decorated.length) break;
      const body = `│${this.pad(messageLines[index]!, bubbleInnerWidth)}│`;
      decorated[row] = this.overlayOpaqueLine(decorated[row]!, bubbleCol, body);
    }
    if (bubbleRow + bubbleHeight - 1 < decorated.length) {
      decorated[bubbleRow + bubbleHeight - 1] = this.overlayIntoLine(
        decorated[bubbleRow + bubbleHeight - 1]!,
        bubbleCol,
        bottom,
      );
    }

    const tailRow = Math.min(decorated.length - 1, bubbleRow + bubbleHeight);
    if (placeRight) {
      const tailBaseCol = bubbleCol + Math.max(1, Math.floor(bubbleWidth * 0.2));
      if (tailRow < decorated.length) {
        decorated[tailRow] = this.overlayIntoLine(decorated[tailRow]!, tailBaseCol, '╲');
      }
      if (tailRow + 1 < decorated.length) {
        const tailTipCol = Math.max(anchor.center, tailBaseCol - 1);
        decorated[tailRow + 1] = this.overlayIntoLine(decorated[tailRow + 1]!, tailTipCol, '╱');
      }
    } else {
      const tailBaseCol = bubbleCol + bubbleWidth - Math.max(2, Math.floor(bubbleWidth * 0.2));
      if (tailRow < decorated.length) {
        decorated[tailRow] = this.overlayIntoLine(decorated[tailRow]!, tailBaseCol, '╱');
      }
      if (tailRow + 1 < decorated.length) {
        const tailTipCol = Math.min(anchor.center, tailBaseCol + 1);
        decorated[tailRow + 1] = this.overlayIntoLine(decorated[tailRow + 1]!, tailTipCol, '╲');
      }
    }

    return decorated;
  }

  private getSceneStatusBoardLines(status: CurrentReview['status'], prNumber?: number): string[] {
    if (status !== 'processing') return [];
    const outputState = this.getCurrentReviewOutputState();
    return [
      `${this.getSpinnerFrame()} REVIEW LIVE`,
      prNumber ? `AI CORE #${prNumber}` : 'AI CORE',
      outputState.boardLabel,
    ];
  }

  private decorateSceneStatusBoard(lines: string[], width: number, boardLines: string[]): string[] {
    if (boardLines.length === 0 || lines.length < 7 || width < 28) {
      return lines;
    }

    const decorated = [...lines];
    const boardInnerWidth = Math.max(14, ...boardLines.map(line => line.length + 2));
    const boardWidth = boardInnerWidth + 2;
    const boardCol = Math.max(1, Math.min(width - boardWidth - 1, Math.floor(width * 0.1)));
    const boardHeight = boardLines.length + 4;
    const boardRow = Math.max(
      1,
      Math.min(lines.length - boardHeight, Math.floor(lines.length * 0.56)),
    );
    const top = ` /${'-'.repeat(boardInnerWidth)}\\`;
    const bottom = ` \\${'_'.repeat(boardInnerWidth)}/`;
    const postOffset = Math.max(2, Math.floor(boardInnerWidth * 0.22));
    const postGap = Math.max(4, boardInnerWidth - postOffset * 2);
    const posts = `${' '.repeat(postOffset)}║${' '.repeat(postGap)}║`;
    const base = `${' '.repeat(Math.max(0, postOffset - 1))}╵${' '.repeat(postGap)}╵`;

    decorated[boardRow] = this.overlayOpaqueLine(decorated[boardRow]!, boardCol, top);
    for (let index = 0; index < boardLines.length; index++) {
      const body = `|${this.pad(boardLines[index]!, boardInnerWidth)}|`;
      decorated[boardRow + 1 + index] = this.overlayOpaqueLine(
        decorated[boardRow + 1 + index]!,
        boardCol,
        body,
      );
    }
    decorated[boardRow + 1 + boardLines.length] = this.overlayOpaqueLine(
      decorated[boardRow + 1 + boardLines.length]!,
      boardCol,
      bottom,
    );
    decorated[boardRow + 2 + boardLines.length] = this.overlayOpaqueLine(
      decorated[boardRow + 2 + boardLines.length]!,
      boardCol,
      posts,
    );
    decorated[boardRow + 3 + boardLines.length] = this.overlayOpaqueLine(
      decorated[boardRow + 3 + boardLines.length]!,
      boardCol,
      base,
    );
    return decorated;
  }

  private decorateReviewBackdrop(
    lines: string[],
    width: number,
    status: CurrentReview['status'],
    isSleeping: boolean,
    decision: LastReviewSummary['decision'] = 'NONE',
  ): string[] {
    if (lines.length === 0 || width < 18) {
      return lines.map(line => this.pad(line, width));
    }

    const decorated = lines.map(line => this.pad(line, width));
    const isMinimal = width < 34;
    const isCompact = width < 52;
    const cloudDrift = this.getPingPongOffset(
      Math.max(2, Math.min(8, Math.floor(width * 0.08))),
      4,
    );
    const sparkleDrift = this.getPingPongOffset(
      Math.max(2, Math.min(6, Math.floor(width * 0.06))),
      3,
    );
    const accentDrift = this.getPingPongOffset(
      Math.max(2, Math.min(5, Math.floor(width * 0.05))),
      2,
    );
    const directionGlyph = this.getAvatarDirectionGlyph(status, isSleeping, decision);
    const skyTop = 0;
    const skyMid = Math.max(1, Math.floor(lines.length * 0.18));
    const spriteBand = Math.max(2, Math.floor(lines.length * 0.34));
    const bushRow = Math.max(0, lines.length - 3);
    const grassRow = Math.max(0, lines.length - 2);
    const groundRow = Math.max(0, lines.length - 1);
    const centerX = Math.floor(width / 2);
    const leftCoreX = Math.max(1, Math.floor(width * 0.08));
    const leftBusX = Math.max(1, Math.floor(width * 0.18));
    const rightGraphX = Math.max(1, Math.floor(width * 0.76));
    const radarTop = Math.max(1, spriteBand - 3);
    const radarMid = Math.max(2, spriteBand - 1);
    const radarLow = Math.min(lines.length - 3, spriteBand + 3);

    for (let row = 1; row < Math.max(1, lines.length - 2); row += isMinimal ? 4 : 3) {
      decorated[row] = this.overlayIntoBlank(
        decorated[row]!,
        0,
        this.buildSparseLine(
          width,
          isMinimal ? 10 : isCompact ? 8 : 7,
          row + cloudDrift,
          isSleeping ? '·' : '.',
        ),
      );
    }

    const motifs = isSleeping
      ? [
          { row: skyTop, col: Math.max(1, Math.floor(width * 0.08)), text: 'z' },
          ...(!isMinimal
            ? [{ row: skyTop, col: Math.max(1, Math.floor(width * 0.22)), text: '·' }]
            : []),
          {
            row: skyMid,
            col: Math.max(1, Math.floor(width * 0.12)),
            text: isMinimal ? '.' : '.-.',
          },
          ...(!isMinimal
            ? [
                {
                  row: skyMid,
                  col: Math.max(1, Math.floor(width * 0.72)),
                  text: isCompact ? '()' : '(__)',
                },
              ]
            : []),
          { row: spriteBand, col: Math.max(1, Math.floor(width * 0.82)), text: '*' },
          { row: skyMid + 1, col: leftCoreX, text: isMinimal ? 'oo' : 'o==o' },
          ...(!isMinimal
            ? [
                { row: skyMid + 2, col: leftCoreX, text: isCompact ? '|:|' : '|##|' },
                { row: skyMid + 3, col: leftCoreX, text: 'o==o' },
              ]
            : []),
          ...(!isCompact
            ? [
                { row: skyMid + 1, col: leftBusX, text: 'o--o' },
                { row: skyMid + 2, col: leftBusX + 1, text: '\\/' },
                { row: skyMid + 3, col: leftBusX, text: 'o--o' },
              ]
            : []),
          {
            row: radarTop,
            col: Math.max(1, centerX - (isMinimal ? 2 : 4)),
            text: isMinimal ? '.~.' : '.-~~-.',
          },
          {
            row: radarMid,
            col: Math.max(1, centerX - (isMinimal ? 4 : 7)),
            text: isMinimal ? '/..\\' : isCompact ? '/ .. \\' : '/  ..  \\',
          },
          ...(!isMinimal
            ? [
                {
                  row: radarLow,
                  col: Math.max(1, centerX - (isCompact ? 4 : 6)),
                  text: isCompact ? '\\.__./' : '\\_.__./',
                },
              ]
            : []),
          { row: bushRow, col: Math.max(1, Math.floor(width * 0.09)), text: '/\\' },
          ...(!isMinimal
            ? [{ row: bushRow, col: Math.max(1, Math.floor(width * 0.78)), text: '/\\' }]
            : []),
          { row: grassRow, col: Math.max(1, Math.floor(width * 0.12)), text: ',v,' },
          ...(!isMinimal
            ? [{ row: grassRow, col: Math.max(1, Math.floor(width * 0.43)), text: '(v)' }]
            : []),
          ...(!isCompact
            ? [{ row: grassRow, col: Math.max(1, Math.floor(width * 0.73)), text: ',v,' }]
            : []),
          {
            row: groundRow,
            col: Math.max(1, Math.floor(width * 0.18)),
            text: isMinimal ? '._._.' : isCompact ? '._.._.' : '._.._.._.',
          },
          ...(!isMinimal
            ? [
                {
                  row: groundRow,
                  col: Math.max(1, Math.floor(width * 0.58)),
                  text: isCompact ? '._.' : '._.._.',
                },
              ]
            : []),
        ]
      : [
          { row: skyTop, col: Math.max(1, Math.floor(width * 0.08) + cloudDrift), text: '.-.' },
          ...(!isMinimal
            ? [
                {
                  row: skyTop,
                  col: Math.max(1, Math.floor(width * 0.74)),
                  text: isCompact ? '( )' : '(___)',
                },
              ]
            : []),
          { row: skyMid, col: Math.max(1, Math.floor(width * 0.14) + sparkleDrift), text: '*' },
          ...(!isMinimal
            ? [
                {
                  row: skyMid,
                  col: Math.max(1, Math.floor(width * 0.86) - sparkleDrift),
                  text: 'o',
                },
              ]
            : []),
          { row: skyMid + 1, col: leftCoreX, text: isMinimal ? 'oo' : 'o==o' },
          ...(!isMinimal
            ? [
                { row: skyMid + 2, col: leftCoreX, text: isCompact ? '|:|' : '|::|' },
                { row: skyMid + 3, col: leftCoreX, text: 'o==o' },
              ]
            : []),
          ...(!isCompact
            ? [
                { row: skyMid + 1, col: leftBusX, text: 'o--o' },
                { row: skyMid + 2, col: leftBusX - 1, text: '/\\/' },
                { row: skyMid + 3, col: leftBusX, text: 'o--o' },
                { row: skyMid + 1, col: rightGraphX, text: 'o--o' },
                { row: skyMid + 2, col: rightGraphX - 1, text: '\\o/' },
                { row: skyMid + 3, col: rightGraphX, text: 'o--o' },
              ]
            : []),
          {
            row: radarTop,
            col: Math.max(1, centerX - (isMinimal ? 3 : 5)),
            text: isMinimal ? '.~~.' : isCompact ? '.-~~-.' : '.-~~~~-.',
          },
          {
            row: radarMid,
            col: Math.max(1, centerX - (isMinimal ? 4 : 8)),
            text: isMinimal ? '/..\\' : isCompact ? '/ .-. \\' : '/  .--.  \\',
          },
          ...(!isMinimal
            ? [
                {
                  row: Math.max(radarMid + 1, 0),
                  col: Math.max(1, centerX - (isCompact ? 5 : 10)),
                  text: isCompact ? '| /\\ |' : '|  /  \\  |',
                },
              ]
            : []),
          ...(!isCompact
            ? [{ row: radarLow, col: Math.max(1, centerX - 8), text: '\\__----__/' }]
            : []),
          { row: spriteBand, col: Math.max(1, Math.floor(width * 0.08)), text: directionGlyph },
          ...(!isMinimal
            ? [
                {
                  row: Math.max(0, spriteBand + 1),
                  col: Math.max(1, Math.floor(width * 0.78) - accentDrift),
                  text: '*',
                },
              ]
            : []),
          { row: bushRow, col: Math.max(1, Math.floor(width * 0.08)), text: '/\\' },
          {
            row: bushRow,
            col: Math.max(1, Math.floor(width * 0.46)),
            text: isMinimal ? '|' : '\\|/',
          },
          ...(!isMinimal
            ? [{ row: bushRow, col: Math.max(1, Math.floor(width * 0.82)), text: '/\\' }]
            : []),
          { row: grassRow, col: Math.max(1, Math.floor(width * 0.12)), text: ',v,' },
          {
            row: grassRow,
            col: Math.max(1, Math.floor(width * 0.41)),
            text: isMinimal ? '*' : '*|*',
          },
          ...(!isCompact
            ? [{ row: grassRow, col: Math.max(1, Math.floor(width * 0.73)), text: ',v,' }]
            : []),
          {
            row: groundRow,
            col: Math.max(1, Math.floor(width * 0.16)),
            text: isMinimal ? '._._.' : isCompact ? '._/\\_.' : '._/\\_._/\\_.',
          },
          ...(!isMinimal
            ? [
                {
                  row: groundRow,
                  col: Math.max(1, Math.floor(width * 0.62)),
                  text: isCompact ? '._.' : '._/\\_.',
                },
              ]
            : []),
        ];

    if (status === 'processing') {
      motifs.push({
        row: Math.max(0, Math.floor(lines.length * 0.24)),
        col: Math.max(1, Math.floor(width * 0.62) - accentDrift),
        text: directionGlyph,
      });
      motifs.push({
        row: Math.max(0, lines.length - 4),
        col: Math.max(1, Math.floor(width * 0.62) - accentDrift),
        text: '*',
      });
      motifs.push({
        row: Math.max(0, Math.floor(lines.length * 0.58)),
        col: Math.max(1, Math.floor(width * 0.24) + accentDrift),
        text: '\\\\',
      });
    } else if (decision === 'APPROVE') {
      motifs.push({
        row: Math.max(0, Math.floor(lines.length * 0.26)),
        col: Math.max(1, Math.floor(width * 0.24) + sparkleDrift),
        text: '* *',
      });
      motifs.push({
        row: Math.max(0, Math.floor(lines.length * 0.44)),
        col: Math.max(1, Math.floor(width * 0.72) - sparkleDrift),
        text: '^',
      });
    } else if (decision === 'REQUEST_CHANGES' || decision === 'FAILED') {
      motifs.push({
        row: Math.max(0, Math.floor(lines.length * 0.24)),
        col: Math.max(1, Math.floor(width * 0.21) + accentDrift),
        text: '!!',
      });
      motifs.push({
        row: Math.max(0, Math.floor(lines.length * 0.46)),
        col: Math.max(1, Math.floor(width * 0.76) - accentDrift),
        text: 'x',
      });
    }

    for (const motif of motifs) {
      if (motif.row < 0 || motif.row >= decorated.length) continue;
      decorated[motif.row] = this.overlayIntoBlank(decorated[motif.row]!, motif.col, motif.text);
    }

    return decorated;
  }

  private getLeftPanelHeights(bodyHeight: number): {
    lastReview: number;
    queue: number;
    logs: number;
  } {
    const lastTarget = bodyHeight >= 30 ? 10 : bodyHeight >= 24 ? 9 : bodyHeight >= 20 ? 8 : 6;
    const lastMin = bodyHeight >= 20 ? 6 : 5;
    const queueMin = bodyHeight >= 24 ? 11 : bodyHeight >= 18 ? 9 : 7;

    let lastReview = Math.min(
      Math.max(lastMin, lastTarget),
      Math.max(lastMin, bodyHeight - queueMin),
    );

    let queue = bodyHeight - lastReview;

    if (queue < queueMin) {
      const deficit = queueMin - queue;
      lastReview = Math.max(lastMin, lastReview - deficit);
      queue = bodyHeight - lastReview;
    }

    return { lastReview, queue, logs: 0 };
  }

  private renderInteractive(force = false): void {
    if (this.isDestroyed || !this.isInteractive) return;

    const now = Date.now();
    const intervalMs = this.getInteractiveRenderIntervalMs();
    const waitMs = force ? 0 : Math.max(0, intervalMs - (now - this.lastRenderAt));

    if (waitMs === 0 && !this.renderQueued) {
      this.renderInteractiveNow();
      return;
    }

    if (this.renderQueued && !force) return;

    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }

    this.renderQueued = true;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.renderQueued = false;
      this.renderInteractiveNow();
    }, waitMs);
  }

  private renderInteractiveNow(): void {
    if (this.isDestroyed || !this.isInteractive) return;

    const cols = process.stdout.columns || 100;
    const rows = process.stdout.rows || 30;
    const footerH = 3;
    const bodyH = Math.max(8, rows - footerH);
    const leftW = Math.max(32, Math.floor(cols * 0.34));
    const rightW = Math.max(36, cols - leftW - 1);
    const { lastReview: lastReviewH, queue: queueH } = this.getLeftPanelHeights(bodyH);
    this.lastLogsViewportHeight = 3;

    const reviewLines = this.buildCurrentReviewLines(rightW - 2, bodyH - 2);
    const lastReviewLines = this.buildLastReviewLines(leftW - 2, lastReviewH - 2);
    const queueLines = this.buildQueueLines(leftW - 2, queueH - 2);
    const queueTitle = this.buildQueueTitle(leftW - 2, queueH - 2);
    const lastReviewVisual = this.getLastReviewVisual();
    const resultTitle = this.getLastReviewTitle(leftW - 2);
    const reviewTitle = this.getPanelTitle('current', rightW - 2);
    const runtimeTitle = this.getPanelTitle('runtime', cols - 2);
    const theme = this.getThemePalette();

    const layoutKey = `${cols}x${rows}:${leftW}:${rightW}:${lastReviewH}:${queueH}`;
    const forceFullRepaint = this.lastInteractiveLayoutKey !== layoutKey;
    if (forceFullRepaint) {
      this.lastInteractiveLayoutKey = layoutKey;
      this.lastInteractivePanels.clear();
    }

    let out = forceFullRepaint ? '\x1b[?25l\x1b[H\x1b[2J' : '';
    const panels = [
      {
        key: 'result',
        output: this.drawBox(
          1,
          1,
          leftW,
          lastReviewH,
          resultTitle,
          lastReviewLines,
          lastReviewVisual.color,
          lastReviewVisual.color,
        ),
      },
      {
        key: 'queue',
        output: this.drawBox(
          1,
          1 + lastReviewH,
          leftW,
          queueH,
          queueTitle,
          queueLines,
          theme.queue,
        ),
      },
      {
        key: 'current',
        output: this.drawBox(
          leftW + 1,
          1,
          rightW,
          bodyH,
          reviewTitle,
          reviewLines,
          theme.current,
          theme.current,
        ),
      },
      {
        key: 'runtime',
        output: this.drawBox(
          1,
          rows - footerH + 1,
          cols,
          footerH,
          runtimeTitle,
          [this.buildFooterBar(cols - 2)],
          theme.runtime,
        ),
      },
    ];

    for (const panel of panels) {
      const previous = this.lastInteractivePanels.get(panel.key);
      if (forceFullRepaint || previous !== panel.output) {
        out += panel.output;
        this.lastInteractivePanels.set(panel.key, panel.output);
      }
    }

    if (!out) {
      this.lastRenderAt = Date.now();
      return;
    }

    this.isRendering = true;
    (this.originalStdoutWrite ?? process.stdout.write.bind(process.stdout))(out);
    this.isRendering = false;
    this.lastRenderAt = Date.now();
  }

  private buildQueueTitle(width: number, height: number): string {
    const orderedKeys = this.getOrderedQueueKeys();
    const baseTitle = this.getPanelTitle('queue', width);
    if (orderedKeys.length === 0) return baseTitle;
    let consumed = 0;
    let visibleItems = 0;
    for (let i = this.queueScrollOffset; i < orderedKeys.length; i++) {
      const entry = this.prs.get(orderedKeys[i]!);
      if (!entry) continue;
      const itemLines = entry.info.author ? 4 : 3;
      if (consumed + itemLines > height) break;
      consumed += itemLines;
      visibleItems++;
    }
    const start = Math.min(orderedKeys.length, this.queueScrollOffset + 1);
    const end = Math.min(orderedKeys.length, this.queueScrollOffset + visibleItems);
    const compact = width < 38;
    return compact
      ? `${baseTitle} ${start}-${Math.max(start, end)}/${orderedKeys.length}`
      : `${baseTitle} ${start}-${Math.max(start, end)}/${orderedKeys.length}`;
  }

  private centerWithOffset(text: string, width: number, offset: number): string {
    const truncated = this.truncate(text, width);
    if (truncated.length >= width) return truncated;
    const maxLeftPad = Math.max(0, width - truncated.length);
    const centeredPad = Math.floor(maxLeftPad / 2);
    const leftPad = Math.min(Math.max(0, centeredPad + offset), maxLeftPad);
    return ' '.repeat(leftPad) + truncated;
  }

  private getAvatarVerticalPadding(
    availableAvatarArea: number,
    avatarHeight: number,
    status: CurrentReview['status'],
    isSleeping: boolean,
    decision: LastReviewSummary['decision'] = 'NONE',
  ): { top: number; bottom: number } {
    const slack = Math.max(0, availableAvatarArea - avatarHeight);
    const centeredTop = Math.floor(slack / 2);

    if (slack === 0) {
      return { top: centeredTop, bottom: 0 };
    }

    const maxTravel = Math.min(status === 'processing' ? 2 : 1, slack);
    const phase = this.getAvatarMotionPhase(status, isSleeping);

    const offsets = isSleeping
      ? [0, 0, 1, 1, 0, 0, -1, -1]
      : decision === 'APPROVE'
        ? [0, -1, -2, -1, 0, -1, 0, 1]
        : decision === 'REQUEST_CHANGES' || decision === 'FAILED'
          ? [1, 0, 1, 0, 1, 0, 0, 0]
          : status === 'processing'
            ? [0, -maxTravel, -maxTravel, -1, 0, maxTravel, maxTravel, 1]
            : [-1, 0, 1, 0];
    const offset = Math.max(-maxTravel, Math.min(maxTravel, offsets[phase % offsets.length] ?? 0));
    const top = Math.min(slack, Math.max(0, centeredTop + offset));
    return { top, bottom: slack - top };
  }

  private buildAvatarLines(
    width: number,
    height: number,
    status: CurrentReview['status'],
    decision: LastReviewSummary['decision'] = 'NONE',
  ): string[] {
    const isSleeping = status === 'idle' && !this.currentReview.pr;
    const frame = this.getAvatarFrameData(width, height, status, isSleeping, decision);
    return frame.lines.map(line => this.centerWithOffset(line, width, frame.swayOffset));
  }

  private getAvatarFrameData(
    width: number,
    height: number,
    status: CurrentReview['status'],
    isSleeping: boolean,
    decision: LastReviewSummary['decision'] = 'NONE',
  ): { lines: string[]; spriteWidth: number; spriteHeight: number; swayOffset: number } {
    const mood: SpriteMood = isSleeping
      ? 'sleeping'
      : decision === 'REQUEST_CHANGES' || decision === 'FAILED'
        ? 'failed'
        : decision === 'APPROVE'
          ? 'completed'
          : status;
    const frames = this.activeSprite.bitmaps[mood];
    const frameHold = isSleeping ? 5 : mood === 'processing' ? 3 : 6;
    const frameIndex = Math.floor(this.animationTick / frameHold) % Math.max(1, frames.length);
    const rawLines = renderBitmap(frames[frameIndex] ?? frames[0] ?? []).slice(0, height);

    const spriteWidth = rawLines.reduce((max, line) => Math.max(max, line.length), 0);
    const maxTravel = Math.max(2, Math.min(8, Math.floor((width - spriteWidth) / 2) - 1));
    const swayFrames = isSleeping
      ? [-1, -1, 0, 0, 1, 1, 0, 0]
      : decision === 'APPROVE'
        ? [0, -1, 0, 1, 0, -1, 0, 1]
        : decision === 'REQUEST_CHANGES' || decision === 'FAILED'
          ? [-2, 2, -1, 1, -2, 2, 0, 0]
          : status === 'processing'
            ? [
                -maxTravel,
                -Math.max(1, Math.ceil(maxTravel * 0.66)),
                -Math.max(1, Math.ceil(maxTravel * 0.33)),
                Math.max(1, Math.ceil(maxTravel * 0.33)),
                maxTravel,
                Math.max(1, Math.ceil(maxTravel * 0.66)),
                Math.max(1, Math.ceil(maxTravel * 0.33)),
                -Math.max(1, Math.ceil(maxTravel * 0.33)),
              ]
            : [-1, 0, 1, 0];
    const swayIndex = this.getAvatarMotionPhase(status, isSleeping);
    const swayOffset = swayFrames[swayIndex % swayFrames.length] ?? 0;
    return {
      lines: rawLines,
      spriteWidth,
      spriteHeight: rawLines.length,
      swayOffset,
    };
  }

  private getAvatarAnchor(
    width: number,
    height: number,
    topPadding: number,
    status: CurrentReview['status'],
    isSleeping: boolean,
    decision: LastReviewSummary['decision'] = 'NONE',
  ): { left: number; right: number; top: number; bottom: number; center: number } {
    const frame = this.getAvatarFrameData(width, height, status, isSleeping, decision);
    const centeredLeft = Math.floor(Math.max(0, width - frame.spriteWidth) / 2);
    const maxLeft = Math.max(0, width - frame.spriteWidth);
    const left = Math.min(Math.max(0, centeredLeft + frame.swayOffset), maxLeft);
    const right = Math.min(width - 1, left + Math.max(0, frame.spriteWidth - 1));
    const top = Math.max(0, topPadding);
    const bottom = Math.min(
      top + Math.max(0, frame.spriteHeight - 1),
      topPadding + Math.max(0, height - 1),
    );
    return {
      left,
      right,
      top,
      bottom,
      center: left + Math.floor(Math.max(0, frame.spriteWidth - 1) / 2),
    };
  }

  private buildCurrentReviewLines(width: number, height: number): string[] {
    const innerPadding = width >= 28 ? 2 : 1;
    const contentWidth = Math.max(1, width - innerPadding * 2);
    const lines: string[] = [];
    const reaction = !this.currentReview.pr ? this.getRecentReaction() : null;
    const reactionDecision = reaction?.decision ?? 'NONE';
    const visualStatus = reaction
      ? reactionDecision === 'APPROVE'
        ? 'completed'
        : 'failed'
      : this.currentReview.status;
    const visualDecision = reaction ? reactionDecision : this.getCurrentReviewDecision();
    const isSleeping = this.currentReview.status === 'idle' && !this.currentReview.pr && !reaction;
    const sceneStatusBoardLines = this.getSceneStatusBoardLines(
      this.currentReview.status,
      this.currentReview.pr?.number ?? reaction?.pr?.number,
    );
    const speechLines = this.getCurrentReviewSpeechLines(
      visualStatus,
      visualDecision,
      this.currentReview.step,
      Boolean(this.currentReview.pr || reaction?.pr),
    );
    const footerReserve =
      !this.currentReview.pr && !reaction ? 4 : this.currentReview.step && !reaction ? 12 : 8;
    const availableAvatarArea = Math.max(3, height - footerReserve);
    const avatarHeight = Math.min(
      availableAvatarArea,
      Math.max(4, Math.min(9, availableAvatarArea - 1)),
    );
    const verticalPadding = this.getAvatarVerticalPadding(
      availableAvatarArea,
      avatarHeight,
      visualStatus,
      isSleeping,
      visualDecision,
    );
    const avatarAnchor = this.getAvatarAnchor(
      contentWidth,
      avatarHeight,
      verticalPadding.top,
      visualStatus,
      isSleeping,
      visualDecision,
    );
    const topPadding = verticalPadding.top;
    const bottomPadding = verticalPadding.bottom;

    for (let i = 0; i < topPadding; i++) {
      lines.push('');
    }

    lines.push(...this.buildAvatarLines(contentWidth, avatarHeight, visualStatus, visualDecision));

    for (let i = 0; i < bottomPadding; i++) {
      lines.push('');
    }

    const sceneLines = this.decorateReviewBackdrop(
      lines,
      contentWidth,
      visualStatus,
      isSleeping,
      visualDecision,
    );
    const sceneWithSpeech = this.decorateSpeechBubble(
      sceneLines,
      contentWidth,
      speechLines,
      avatarAnchor,
    );
    const sceneWithStatusBoard = this.decorateSceneStatusBoard(
      sceneWithSpeech,
      contentWidth,
      sceneStatusBoardLines,
    );
    lines.length = 0;
    lines.push(...sceneWithStatusBoard);

    if (!this.currentReview.pr && !reaction) {
      lines.push(
        ...this.buildReviewStatusBox(
          contentWidth,
          'IDLE',
          'SLEEP',
          'Tidur nyenyak...',
          'QUEUE: EMPTY',
          ['Menunggu lawan berikutnya'],
        ),
      );
      return lines
        .slice(0, height)
        .map(line => this.pad(`${' '.repeat(innerPadding)}${line}`, width));
    }

    const pr = this.currentReview.pr ?? reaction?.pr!;
    const animatedDots =
      this.currentReview.status === 'processing' ? '.'.repeat((this.animationTick % 3) + 1) : '';
    const author = pr.author ? `@${pr.author}` : '@unknown';
    const elapsed = reaction
      ? `Elapsed ${shortDuration(reaction.durationMs)}`
      : `Elapsed ${this.getCurrentReviewElapsedText()}`;
    const modeLabel =
      visualDecision === 'APPROVE'
        ? 'MODE MERCY'
        : visualDecision === 'REQUEST_CHANGES'
          ? 'MODE JUDGE'
          : visualDecision === 'FAILED'
            ? 'MODE ALERT'
            : 'MODE REVIEW';
    const compactTelemetry = contentWidth < 52;
    const outputState = this.getCurrentReviewOutputState();
    const telemetryLines = this.buildTelemetryTriplet(
      contentWidth,
      { label: compactTelemetry ? 'AUTH' : 'AUTHOR', value: author },
      {
        label: compactTelemetry ? 'POS' : 'POSITION',
        value: reaction ? 'LAST' : this.getCurrentReviewQueuePosition(),
      },
      {
        label: compactTelemetry ? 'TIME' : 'ELAPSED',
        value: reaction ? shortDuration(reaction.durationMs) : this.getCurrentReviewElapsedText(),
      },
    );
    const modeDetail = this.getCurrentReviewModeDetail(
      this.currentReview.status,
      this.currentReview.step,
    );
    const modeStepLabel =
      this.currentReview.step && !reaction
        ? `${modeLabel} · ${modeDetail || `Active${animatedDots}`}`
        : modeLabel;
    const currentReviewLogLines =
      this.currentReview.step && !reaction ? this.buildCurrentReviewLogLines(contentWidth, 3) : [];
    lines.push(
      ...this.buildReviewStatusBox(
        contentWidth,
        pr.repo,
        `#${pr.number}`,
        pr.title,
        '',
        this.currentReview.step && !reaction
          ? [
              this.buildSectionDivider(contentWidth, 'TELEMETRY'),
              ...telemetryLines,
              this.buildSectionDivider(contentWidth, 'MODE'),
              this.alignLeftRight(modeStepLabel, outputState.label, contentWidth),
              this.buildSectionDivider(contentWidth, 'LOGS'),
              ...currentReviewLogLines,
            ]
          : [
              this.buildSectionDivider(contentWidth, 'TELEMETRY'),
              ...telemetryLines,
              this.buildSectionDivider(contentWidth, 'MODE'),
              this.alignLeftRight(
                modeLabel,
                reaction ? 'LAST REVIEW' : outputState.label,
                contentWidth,
              ),
            ],
      ),
    );

    return lines
      .slice(0, height)
      .map(line => this.pad(`${' '.repeat(innerPadding)}${line}`, width));
  }

  private buildLastReviewLines(width: number, height: number): string[] {
    const innerPadding = width >= 28 ? 2 : 1;
    const contentWidth = Math.max(1, width - innerPadding * 2);
    const lines: string[] = [];
    const canFit = (count: number) => lines.length + count <= height;
    if (!this.lastReview.pr || this.lastReview.decision === 'NONE') {
      lines.push(this.center('No completed review yet', contentWidth));
      return lines
        .slice(0, height)
        .map(line => this.pad(`${' '.repeat(innerPadding)}${line}`, width));
    }

    const visual = this.getLastReviewVisual();
    const decision =
      this.lastReview.decision === 'REQUEST_CHANGES' ? 'REJECT' : this.lastReview.decision;
    const badge = visual.badge;
    const author = this.lastReview.pr.author ? `@${this.lastReview.pr.author}` : '@unknown';
    const timing = `${shortTime(this.lastReview.finishedAt)}  ${shortDuration(this.lastReview.durationMs)}`;
    lines.push(this.buildSectionDivider(contentWidth, 'OUTCOME'));
    lines.push(this.center(badge, contentWidth));
    if (canFit(1)) {
      lines.push(this.center(this.getLastReviewSignal(this.lastReview.decision), contentWidth));
    }
    if (height >= 9 && canFit(1)) {
      lines.push(this.buildSectionDivider(contentWidth, 'META'));
    }
    if (canFit(1)) {
      lines.push(
        this.alignLeftRight(
          `#${this.lastReview.pr.number} ${this.lastReview.pr.repo}`,
          author,
          contentWidth,
        ),
      );
    }
    if (canFit(1)) {
      lines.push(this.truncate(this.lastReview.pr.title, contentWidth));
    }
    if (canFit(1)) {
      lines.push(this.alignLeftRight(decision.toLowerCase(), timing, contentWidth));
    }
    if (canFit(2)) {
      lines.push(this.buildSectionDivider(contentWidth, 'RECENT'));
      lines.push(this.formatLastReviewHistoryLine(contentWidth));
    }
    return lines
      .slice(0, height)
      .map(line => this.pad(`${' '.repeat(innerPadding)}${line}`, width));
  }

  private buildQueueLines(width: number, height: number): string[] {
    const innerPadding = width >= 28 ? 2 : 1;
    const contentWidth = Math.max(1, width - innerPadding * 2);
    const lines: string[] = [];
    const orderedKeys = this.getOrderedQueueKeys();
    if (orderedKeys.length === 0) {
      const banner = [
        this.center('BUTUH LAWAN', contentWidth),
        this.center('Belum ada PR di antrean', contentWidth),
      ];
      return banner
        .slice(0, height)
        .map(line => this.pad(`${' '.repeat(innerPadding)}${line}`, width));
    }
    const maxOffset = Math.max(0, orderedKeys.length - 1);
    if (this.queueScrollOffset > maxOffset) {
      this.queueScrollOffset = maxOffset;
    }
    let lastSection: string | null = null;
    for (let i = this.queueScrollOffset; i < orderedKeys.length; i++) {
      const key = orderedKeys[i]!;
      const entry = this.prs.get(key);
      if (!entry) continue;
      const sectionLabel = this.getQueueSectionLabel(entry.state);
      if (sectionLabel !== lastSection && lines.length < height) {
        lines.push(this.buildSectionDivider(contentWidth, sectionLabel));
        lastSection = sectionLabel;
      }
      const icon =
        entry.state === 'processing'
          ? this.getSpinnerFrame(lines.length)
          : entry.state === 'completed'
            ? '✓'
            : entry.state === 'failed'
              ? '✗'
              : entry.state === 'skipped'
                ? '–'
                : '○';
      const badge = this.getQueueBadge(entry.state);
      lines.push(
        this.truncate(`${icon} ${badge} #${entry.info.number} ${entry.info.repo}`, contentWidth),
      );
      lines.push(this.truncate(`  ${entry.info.title}`, contentWidth));
      if (entry.info.author) {
        lines.push(this.truncate(`  @${entry.info.author}`, contentWidth));
      }
      if (lines.length >= height) break;
    }
    return lines
      .slice(0, height)
      .map(line => this.pad(`${' '.repeat(innerPadding)}${line}`, width));
  }

  private buildUnifiedLogLines(width: number, height: number): string[] {
    const innerPadding = width >= 40 ? 2 : 1;
    const contentWidth = Math.max(1, width - innerPadding * 2);
    const filtered = this.getFilteredLogEntries();
    const maxOffset = Math.max(0, filtered.length - Math.max(1, height));
    if (this.logScrollOffset > maxOffset) {
      this.logScrollOffset = maxOffset;
    }
    const end = Math.max(0, filtered.length - this.logScrollOffset);
    const start = Math.max(0, end - height);
    const visible = filtered.slice(start, end);
    if (visible.length === 0) {
      const emptyLabel =
        this.logFocus === 'all'
          ? 'Belum ada log'
          : this.logFocus === 'backend'
            ? 'Belum ada backend log'
            : this.logFocus === 'agent'
              ? 'Belum ada agent log'
              : 'Belum ada error log';
      return [
        this.pad(`${' '.repeat(innerPadding)}${this.center(emptyLabel, contentWidth)}`, width),
      ];
    }
    return visible.map(entry => {
      const match = entry.message.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
      const timestamp = match?.[1] ?? '--:--:--';
      const body = match?.[2] ?? entry.message;
      const prefix = entry.channel === 'agent' ? `[AG ${timestamp}] ` : `[BE ${timestamp}] `;
      const line = this.truncate(`${prefix}${body}`, contentWidth);
      return this.pad(`${' '.repeat(innerPadding)}${line}`, width);
    });
  }

  private printStatusBar(state?: string): void {
    if (this.isDestroyed) return;
    const cr = this.currentReview;
    let statusLine = `\x1B[36m════════════════════════════════════════════════════════════\x1B[0m\n`;
    statusLine += `\x1B[36;1m  PR REVIEW AGENT\x1B[0m`;
    if (state) statusLine += ` \x1B[33m[${state}]\x1B[0m`;
    statusLine += `\n`;

    if (cr.pr) {
      const icon =
        cr.status === 'processing'
          ? '\x1B[33m●\x1B[0m'
          : cr.status === 'completed'
            ? '\x1B[32m✓\x1B[0m'
            : cr.status === 'failed'
              ? '\x1B[31m✗\x1B[0m'
              : '\x1B[37m○\x1B[0m';
      statusLine += `  ${icon} \x1B[1m#${cr.pr.number}\x1B[0m ${cr.pr.repo}\n`;
      statusLine += `    \x1B[90m${cr.pr.title.substring(0, 60)}\x1B[0m\n`;
      if (cr.step) statusLine += `    \x1B[33m→ ${cr.step}\x1B[0m\n`;
    } else {
      statusLine += `  \x1B[90mWaiting for next PR...\x1B[0m\n`;
    }

    const prCount = this.prOrder.length;
    const active = Array.from(this.prs.values()).filter(e => e.state === 'processing').length;
    statusLine += `  \x1B[90mQueue: ${prCount} PRs (${active} active)\x1B[0m\n`;

    statusLine += `\x1B[36m────────────────────────────────────────────────────────────\x1B[0m\n`;

    process.stdout.write(statusLine);
  }

  addLog(message: string): void {
    if (this.isDestroyed) return;
    const cleaned = stripAnsi(stripTags(message));
    if (!cleaned || isInstanceLoader(cleaned)) return;
    if (this.isInteractive) {
      this.pushLog('backend', `[${timeStr()}] ${cleaned}`);
      this.renderInteractive(true);
      return;
    }
    process.stdout.write(` \x1B[32m[${timeStr()}]\x1B[0m ${cleaned}\n`);
  }

  addAgentLog(message: string): void {
    if (this.isDestroyed) return;
    const cleaned = stripAnsi(stripTags(message));
    if (!cleaned) return;
    if (this.isInteractive) {
      this.pushLog('agent', `[${timeStr()}] ${cleaned}`);
      this.renderInteractive(true);
      return;
    }
    process.stdout.write(` \x1B[35m[${timeStr()}]\x1B[0m ${cleaned}\n`);
  }

  setPrs(prs: PrInfo[]): void {
    this.prs.clear();
    this.prOrder = [];
    for (const pr of prs) {
      const key = prKey(pr);
      this.prs.set(key, { info: pr, state: 'queued' });
      this.prOrder.push(key);
    }
    this.queueScrollOffset = 0;
    if (this.isInteractive) {
      this.renderInteractive();
      return;
    }
    this.printStatusBar();
  }

  setPrState(pr: Pick<PrInfo, 'repo' | 'number'>, state: PrState): void {
    const entry = this.prs.get(prKey(pr));
    if (!entry) return;
    entry.state = state;
    if (this.isInteractive) {
      this.renderInteractive();
      return;
    }
    this.printStatusBar(state);
  }

  updateHeader(text: string): void {
    this.headerText = stripTags(stripAnsi(text));
    if (this.isInteractive) {
      this.renderInteractive();
    }
  }

  setStats(stats: { total: number; success: number; failed: number; skipped: number }): void {
    this.stats = stats;
    if (this.isInteractive) {
      this.renderInteractive();
    }
  }

  setCountdown(seconds: number): void {
    const m = Math.floor(seconds / 60),
      s = seconds % 60;
    this.countdownText = `Next review in ${m}m ${s}s`;
    if (this.isInteractive) {
      this.renderInteractive();
      return;
    }
    if (seconds % 5 === 0) {
      process.stdout.write(` \x1B[33m⏳ ${this.countdownText} (Ctrl+C)\x1B[0m\x1B[K\r`);
    }
  }

  clearCountdown(): void {
    this.countdownText = '';
    if (this.isInteractive) {
      this.renderInteractive();
    }
  }

  setCurrentReview(pr: PrInfo | null, status: CurrentReview['status'], step: string): void {
    const nextKey = pr ? pr.key : null;
    if (nextKey && nextKey !== this.activeSpriteOwnerKey) {
      this.activeSprite = getTamagotchiSpriteTemplateBySeed(nextKey);
      this.activeSpriteOwnerKey = nextKey;
    } else if (!nextKey && status === 'idle') {
      this.activeSpriteOwnerKey = null;
      this.activeSprite = getRandomTamagotchiSpriteTemplate();
    }
    const currentKey = this.currentReview.pr?.key ?? null;
    if (
      pr &&
      status === 'processing' &&
      (currentKey !== nextKey || this.currentReview.status !== 'processing')
    ) {
      this.currentReviewStartedAt = Date.now();
    } else if (!pr && status === 'idle') {
      this.currentReviewStartedAt = null;
    }
    if (!pr && status === 'idle') {
      this.currentReviewStepUpdatedAt = null;
    } else if (
      currentKey !== nextKey ||
      this.currentReview.status !== status ||
      this.currentReview.step !== step
    ) {
      this.currentReviewStepUpdatedAt = Date.now();
    }
    this.currentReview = { pr, status, step };
    if (this.isInteractive) {
      this.renderInteractive();
      return;
    }
    this.printStatusBar(status);
  }

  setLastReview(summary: LastReviewSummary): void {
    this.lastReview = summary;
    this.rememberLastReview(summary);
    if (summary.pr && summary.decision !== 'NONE') {
      this.recentReaction = summary;
      this.recentReactionUntil = Date.now() + 3500;
    }
    if (this.isInteractive) {
      this.renderInteractive();
      return;
    }
    this.printStatusBar(summary.decision);
  }

  setGithubRateLimit(data: GithubRateLimitData | null): void {
    this.githubRateLimit = data;
    if (this.isInteractive) {
      this.renderInteractive();
    }
  }
}
