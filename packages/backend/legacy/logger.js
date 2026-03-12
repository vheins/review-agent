import chalk from 'chalk';
import ora from 'ora';
import notifier from 'node-notifier';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const levels = { debug: -1, info: 0, warn: 1, error: 2 };
const currentLevel = levels[config.logLevel] || 0;
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_RETENTION_DAYS = 7;

fs.ensureDirSync(LOG_DIR);

function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `review-agent-${year}-${month}-${day}.log`;
}

function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const retentionMs = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.startsWith('review-agent-') || !file.endsWith('.log')) {
        continue;
      }

      const filePath = path.join(LOG_DIR, file);
      const fileAge = Date.now() - fs.statSync(filePath).mtime.getTime();

      if (fileAge > retentionMs) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error(chalk.red('Failed to clean old logs:'), error.message);
  }
}

function normalizeEntry(level, message, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  };
}

function writeToLogFile(entry) {
  try {
    const logFile = path.join(LOG_DIR, getLogFileName());
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch (error) {
    console.error(chalk.red('Failed to write to log file:'), error.message);
  }
}

function formatConsoleMessage(entry) {
  const contextText = Object.keys(entry.context).length > 0
    ? ` ${chalk.gray(JSON.stringify(entry.context))}`
    : '';

  return `${entry.message}${contextText}`;
}

cleanOldLogs();

let activeSpinner = null;

const cleanup = () => {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
};

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

function logWithLevel(level, color, icon, message, context = {}) {
  if (currentLevel > levels[level]) {
    return;
  }

  cleanup();

  const entry = normalizeEntry(level, message, context);
  console.log(color(icon), formatConsoleMessage(entry));
  writeToLogFile(entry);
}

export const logger = {
  debug: (message, context = {}) => logWithLevel('debug', chalk.gray, '⚙', message, context),
  info: (message, context = {}) => logWithLevel('info', chalk.blue, 'ℹ', message, context),
  warn: (message, context = {}) => logWithLevel('warn', chalk.yellow, '⚠', message, context),
  error: (message, context = {}) => logWithLevel('error', chalk.red, '✖', message, context),

  countdown: async (seconds) => {
    if (currentLevel > 0) {
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return;
    }

    cleanup();

    let interrupted = false;
    const interruptHandler = () => {
      interrupted = true;
    };

    process.once('SIGUSR1', interruptHandler);

    for (let i = seconds; i > 0; i -= 1) {
      if (interrupted) {
        process.stdout.write(`\r${chalk.yellow('⚡')} Countdown interrupted - executing now!          \n`);
        process.removeListener('SIGUSR1', interruptHandler);
        return;
      }

      process.stdout.write(`\r${chalk.blue('ℹ')} Waiting ${chalk.yellow(i)} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    process.removeListener('SIGUSR1', interruptHandler);
    process.stdout.write(`\r${chalk.green('✔')} Waiting ${chalk.green('done!')}          \n`);
  },

  spinner: (text) => {
    if (currentLevel > 0) {
      return {
        start: () => {},
        succeed: (message) => console.log(chalk.green('✔'), message || text),
        fail: (message) => console.log(chalk.red('✖'), message || text),
        warn: (message) => console.log(chalk.yellow('⚠'), message || text),
        stop: () => {},
        text: ''
      };
    }

    cleanup();
    activeSpinner = ora({
      text,
      color: 'cyan',
      spinner: 'dots',
      discardStdin: false,
      hideCursor: true
    });

    return activeSpinner;
  },

  searchLogs: async ({ level, text, limit = 100 } = {}) => {
    const files = (await fs.readdir(LOG_DIR))
      .filter((file) => file.startsWith('review-agent-') && file.endsWith('.log'))
      .sort()
      .reverse();

    const results = [];

    for (const file of files) {
      const content = await fs.readFile(path.join(LOG_DIR, file), 'utf8');
      const lines = content.trim().split('\n').filter(Boolean).reverse();

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const matchesLevel = !level || entry.level === level;
          const matchesText = !text || JSON.stringify(entry).includes(text);

          if (matchesLevel && matchesText) {
            results.push(entry);
          }

          if (results.length >= limit) {
            return results;
          }
        } catch (error) {
          continue;
        }
      }
    }

    return results;
  }
};

export const notify = {
  manualMerge: (prNumber, repository, reason = 'Merge conflicts detected', prUrl = null) => {
    cleanup();

    const resolvedPrUrl = prUrl ?? `https://github.com/${repository}/pull/${prNumber}`;

    notifier.notify({
      title: '⚠️ Manual Merge Required',
      message: `PR #${prNumber} needs manual merge\n${reason}`,
      sound: true,
      wait: false
    });

    console.log(
      boxen(
        `${chalk.yellow.bold('Manual Merge Required')}\n\n`
        + `Repository: ${chalk.cyan(repository)}\n`
        + `PR: ${chalk.green(`#${prNumber}`)}\n`
        + `Reason: ${chalk.white(reason)}\n\n`
        + `${terminalLink('Open PR in browser', resolvedPrUrl)}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      )
    );
  }
};
