import chalk from 'chalk';
import { config } from './config.js';

const levels = { info: 0, warn: 1, error: 2 };
const currentLevel = levels[config.logLevel] || 0;

export const logger = {
  info: (msg) => currentLevel <= 0 && console.log(chalk.blue('[INFO]'), msg),
  warn: (msg) => currentLevel <= 1 && console.log(chalk.yellow('[WARN]'), msg),
  error: (msg) => currentLevel <= 2 && console.log(chalk.red('[ERROR]'), msg)
};
