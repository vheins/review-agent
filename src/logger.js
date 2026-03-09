import chalk from 'chalk';
import { config } from './config.js';

const levels = { info: 0, warn: 1, error: 2 };
const currentLevel = levels[config.logLevel] || 0;

export const logger = {
  info: (msg) => currentLevel <= 0 && console.log(chalk.blue('[INFO]'), msg),
  warn: (msg) => currentLevel <= 1 && console.log(chalk.yellow('[WARN]'), msg),
  error: (msg) => currentLevel <= 2 && console.log(chalk.red('[ERROR]'), msg),
  countdown: async (seconds) => {
    if (currentLevel > 0) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return;
    }

    for (let i = seconds; i > 0; i--) {
      process.stdout.write(`\r${chalk.blue('[INFO]')} Waiting ${chalk.yellow(i)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    process.stdout.write(`\r${chalk.blue('[INFO]')} Waiting ${chalk.green('done!')}          \n`);
  }
};
