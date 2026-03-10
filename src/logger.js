import chalk from 'chalk';
import ora from 'ora';
import notifier from 'node-notifier';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
import { config } from './config.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const levels = { info: 0, warn: 1, error: 2 };
const currentLevel = levels[config.logLevel] || 0;

// Log directory setup
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_RETENTION_DAYS = 7;

// Ensure log directory exists
fs.ensureDirSync(LOG_DIR);

// Get current date for log file name
function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `review-agent-${year}-${month}-${day}.log`;
}

// Clean old log files (keep only last 7 days)
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = Date.now();
    const retentionMs = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (file.startsWith('review-agent-') && file.endsWith('.log')) {
        const filePath = path.join(LOG_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > retentionMs) {
          fs.unlinkSync(filePath);
          console.log(chalk.gray(`🗑️  Deleted old log: ${file}`));
        }
      }
    });
  } catch (error) {
    console.error(chalk.red('Failed to clean old logs:'), error.message);
  }
}

// Write to log file
function writeToLogFile(level, message) {
  try {
    const logFile = path.join(LOG_DIR, getLogFileName());
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    fs.appendFileSync(logFile, logEntry, 'utf-8');
  } catch (error) {
    console.error(chalk.red('Failed to write to log file:'), error.message);
  }
}

// Clean old logs on startup
cleanOldLogs();

// Single spinner instance to avoid concurrent spinners
let activeSpinner = null;

// Handle process termination to stop spinner
const cleanup = () => {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
};

process.on('SIGINT', () => {
  cleanup();
  console.log(chalk.yellow('\n\n⚠ Process interrupted by user'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

export const logger = {
  info: (msg) => {
    if (currentLevel <= 0) {
      // Stop any active spinner first
      if (activeSpinner) {
        activeSpinner.stop();
        activeSpinner = null;
      }
      console.log(chalk.blue('ℹ'), msg);
      writeToLogFile('info', msg);
    }
  },

  warn: (msg) => {
    if (currentLevel <= 1) {
      // Stop any active spinner first
      if (activeSpinner) {
        activeSpinner.stop();
        activeSpinner = null;
      }
      console.log(chalk.yellow('⚠'), msg);
      writeToLogFile('warn', msg);
    }
  },

  error: (msg) => {
    if (currentLevel <= 2) {
      // Stop any active spinner first
      if (activeSpinner) {
        activeSpinner.stop();
        activeSpinner = null;
      }
      console.log(chalk.red('✖'), msg);
      writeToLogFile('error', msg);
    }
  },

  countdown: async (seconds) => {
    if (currentLevel > 0) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return;
    }

    // Stop any active spinner first
    if (activeSpinner) {
      activeSpinner.stop();
      activeSpinner = null;
    }

    let interrupted = false;
    const interruptHandler = () => {
      interrupted = true;
    };

    process.once('SIGUSR1', interruptHandler);

    for (let i = seconds; i > 0; i--) {
      if (interrupted) {
        process.stdout.write(`\r${chalk.yellow('⚡')} Countdown interrupted - executing now!          \n`);
        process.removeListener('SIGUSR1', interruptHandler);
        return;
      }
      process.stdout.write(`\r${chalk.blue('ℹ')} Waiting ${chalk.yellow(i)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    process.removeListener('SIGUSR1', interruptHandler);
    process.stdout.write(`\r${chalk.green('✔')} Waiting ${chalk.green('done!')}          \n`);
  },

  spinner: (text) => {
    if (currentLevel > 0) {
      return {
        start: () => { },
        succeed: (msg) => console.log(chalk.green('✔'), msg || text),
        fail: (msg) => console.log(chalk.red('✖'), msg || text),
        warn: (msg) => console.log(chalk.yellow('⚠'), msg || text),
        stop: () => { },
        text: ''
      };
    }

    // Stop any active spinner first
    if (activeSpinner) {
      activeSpinner.stop();
    }

    activeSpinner = ora({
      text,
      color: 'cyan',
      spinner: 'dots',
      discardStdin: false,
      hideCursor: true
    });

    // Wrap methods to track active spinner
    const originalStart = activeSpinner.start.bind(activeSpinner);
    const originalSucceed = activeSpinner.succeed.bind(activeSpinner);
    const originalFail = activeSpinner.fail.bind(activeSpinner);
    const originalWarn = activeSpinner.warn.bind(activeSpinner);
    const originalStop = activeSpinner.stop.bind(activeSpinner);

    activeSpinner.start = () => {
      originalStart();
      return activeSpinner;
    };

    activeSpinner.succeed = (msg) => {
      originalSucceed(msg);
      activeSpinner = null;
      return activeSpinner;
    };

    activeSpinner.fail = (msg) => {
      originalFail(msg);
      activeSpinner = null;
      return activeSpinner;
    };

    activeSpinner.warn = (msg) => {
      originalWarn(msg);
      activeSpinner = null;
      return activeSpinner;
    };

    activeSpinner.stop = () => {
      originalStop();
      activeSpinner = null;
    };

    return activeSpinner;
  }
};

export const notify = {
  manualMerge: (prNumber, repository, reason = 'Merge conflicts detected', prUrl = null) => {
    // Stop any active spinner first
    if (activeSpinner) {
      activeSpinner.stop();
      activeSpinner = null;
    }

    // Generate PR URL if not provided
    if (!prUrl) {
      prUrl = `https://github.com/${repository}/pull/${prNumber}`;
    }

    // Windows notification
    notifier.notify({
      title: '⚠️ Manual Merge Required',
      message: `PR #${prNumber} needs manual merge\n${reason}`,
      sound: true,
      wait: false,
      timeout: 10
    });

    // Create clickable link
    const prLink = terminalLink(`#${prNumber}`, prUrl, {
      fallback: (text, url) => `${text} (${url})`
    });

    // Big CLI box notification
    const message = boxen(
      chalk.bold.red('⚠️  MANUAL MERGE REQUIRED  ⚠️\n\n') +
      chalk.yellow(`Repository: ${chalk.white(repository)}\n`) +
      chalk.yellow(`PR Number: ${chalk.white(prLink)}\n`) +
      chalk.yellow(`Reason: ${chalk.white(reason)}\n\n`) +
      chalk.cyan('Please resolve the conflicts manually and push the changes.\n') +
      chalk.gray(`Link: ${prUrl}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'red',
        backgroundColor: '#000000'
      }
    );

    console.log('\n' + message + '\n');
  },

  success: (prNumber, repository, message = 'PR approved and merged', prUrl = null) => {
    // Stop any active spinner first
    if (activeSpinner) {
      activeSpinner.stop();
      activeSpinner = null;
    }

    // Generate PR URL if not provided
    if (!prUrl) {
      prUrl = `https://github.com/${repository}/pull/${prNumber}`;
    }

    // Windows notification
    notifier.notify({
      title: '✅ PR Success',
      message: `PR #${prNumber} - ${message}`,
      sound: true,
      wait: false,
      timeout: 5
    });

    // Create clickable link
    const prLink = terminalLink(`#${prNumber}`, prUrl, {
      fallback: (text, url) => `${text} (${url})`
    });

    // CLI box notification
    const boxMessage = boxen(
      chalk.bold.green('✅  SUCCESS  ✅\n\n') +
      chalk.cyan(`Repository: ${chalk.white(repository)}\n`) +
      chalk.cyan(`PR Number: ${chalk.white(prLink)}\n`) +
      chalk.cyan(`Status: ${chalk.white(message)}\n\n`) +
      chalk.gray(`Link: ${prUrl}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green',
        backgroundColor: '#000000'
      }
    );

    console.log('\n' + boxMessage + '\n');
  },

  requestChanges: (prNumber, repository, issuesCount, prUrl = null) => {
    // Stop any active spinner first
    if (activeSpinner) {
      activeSpinner.stop();
      activeSpinner = null;
    }

    // Generate PR URL if not provided
    if (!prUrl) {
      prUrl = `https://github.com/${repository}/pull/${prNumber}`;
    }

    // Windows notification
    notifier.notify({
      title: '🔍 Changes Requested',
      message: `PR #${prNumber} - ${issuesCount} issues found`,
      sound: true,
      wait: false,
      timeout: 5
    });

    // Create clickable link
    const prLink = terminalLink(`#${prNumber}`, prUrl, {
      fallback: (text, url) => `${text} (${url})`
    });

    // CLI box notification
    const boxMessage = boxen(
      chalk.bold.yellow('🔍  CHANGES REQUESTED  🔍\n\n') +
      chalk.cyan(`Repository: ${chalk.white(repository)}\n`) +
      chalk.cyan(`PR Number: ${chalk.white(prLink)}\n`) +
      chalk.cyan(`Issues Found: ${chalk.white(issuesCount)}\n\n`) +
      chalk.yellow('Please review the comments and make necessary changes.\n') +
      chalk.gray(`Link: ${prUrl}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow',
        backgroundColor: '#000000'
      }
    );

    console.log('\n' + boxMessage + '\n');
  }
};
