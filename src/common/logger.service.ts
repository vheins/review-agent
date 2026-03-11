import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Custom Logger Service dengan daily rotation dan 7-day retention
 * Implements NestJS LoggerService interface
 * Maintains log format: [timestamp] [LEVEL] message
 */
@Injectable({ scope: Scope.DEFAULT })
export class LoggerService implements NestLoggerService {
  private readonly LOG_DIR: string;
  private readonly LOG_RETENTION_DAYS = 7;
  private context?: string;

  constructor(context?: string) {
    this.context = context;
    this.LOG_DIR = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
    this.cleanOldLogs();
  }

  /**
   * Ensure logs directory exists
   */
  private ensureLogDirectory(): void {
    try {
      fs.ensureDirSync(this.LOG_DIR);
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * Get log file name based on current date
   * Format: review-agent-YYYY-MM-DD.log
   */
  private getLogFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `review-agent-${year}-${month}-${day}.log`;
  }

  /**
   * Clean old log files based on retention policy
   * Removes files older than LOG_RETENTION_DAYS
   */
  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.LOG_DIR);
      const retentionMs = this.LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('review-agent-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.LOG_DIR, file);
        const stats = fs.statSync(filePath);
        const fileAge = Date.now() - stats.mtime.getTime();

        if (fileAge > retentionMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * Format log entry with timestamp and level
   * Format: [timestamp] [LEVEL] message
   */
  private formatLogEntry(level: string, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context || this.context ? ` [${context || this.context}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}`;
  }

  /**
   * Write log entry to file
   */
  private writeToFile(entry: string): void {
    try {
      const logFile = path.join(this.LOG_DIR, this.getLogFileName());
      fs.appendFileSync(logFile, entry + '\n', 'utf-8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log a message with specified level
   */
  private logWithLevel(level: string, message: any, context?: string): void {
    const messageStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const entry = this.formatLogEntry(level, messageStr, context);
    
    // Write to console
    console.log(entry);
    
    // Write to file
    this.writeToFile(entry);
  }

  /**
   * Write a 'log' level log (info level)
   */
  log(message: any, context?: string): void {
    this.logWithLevel('INFO', message, context);
  }

  /**
   * Write an 'error' level log
   */
  error(message: any, trace?: string, context?: string): void {
    const messageStr = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const fullMessage = trace ? `${messageStr}\n${trace}` : messageStr;
    this.logWithLevel('ERROR', fullMessage, context);
  }

  /**
   * Write a 'warn' level log
   */
  warn(message: any, context?: string): void {
    this.logWithLevel('WARN', message, context);
  }

  /**
   * Write a 'debug' level log
   */
  debug(message: any, context?: string): void {
    this.logWithLevel('DEBUG', message, context);
  }

  /**
   * Write a 'verbose' level log
   */
  verbose(message: any, context?: string): void {
    this.logWithLevel('VERBOSE', message, context);
  }

  /**
   * Set context for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }
}
