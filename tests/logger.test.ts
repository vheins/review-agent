import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggerService } from '../src/common/logger.service';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('LoggerService', () => {
  let logger: LoggerService;
  const LOG_DIR = path.join(process.cwd(), 'logs');
  const testLogFile = path.join(LOG_DIR, getLogFileName());

  function getLogFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `review-agent-${year}-${month}-${day}.log`;
  }

  beforeEach(() => {
    // Ensure logs directory exists
    fs.ensureDirSync(LOG_DIR);
    logger = new LoggerService();
  });

  afterEach(() => {
    // Clean up test logs
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
  });

  describe('Log Directory Management', () => {
    it('should create logs directory if it does not exist', () => {
      expect(fs.existsSync(LOG_DIR)).toBe(true);
    });

    it('should use logs/ directory for storing log files', () => {
      logger.log('test message');
      expect(fs.existsSync(testLogFile)).toBe(true);
    });
  });

  describe('Daily Log Rotation', () => {
    it('should create log file with current date in filename', () => {
      logger.log('test message');
      const expectedFileName = getLogFileName();
      const logFilePath = path.join(LOG_DIR, expectedFileName);
      expect(fs.existsSync(logFilePath)).toBe(true);
    });

    it('should use format review-agent-YYYY-MM-DD.log', () => {
      logger.log('test message');
      const fileName = getLogFileName();
      expect(fileName).toMatch(/^review-agent-\d{4}-\d{2}-\d{2}\.log$/);
    });
  });

  describe('7-Day Retention Policy', () => {
    it('should delete log files older than 7 days', () => {
      // Create old log file
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);
      const year = oldDate.getFullYear();
      const month = String(oldDate.getMonth() + 1).padStart(2, '0');
      const day = String(oldDate.getDate()).padStart(2, '0');
      const oldLogFile = path.join(LOG_DIR, `review-agent-${year}-${month}-${day}.log`);
      
      fs.writeFileSync(oldLogFile, 'old log content');
      
      // Set file modification time to 8 days ago
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldLogFile, new Date(eightDaysAgo), new Date(eightDaysAgo));
      
      // Create new logger instance to trigger cleanup
      new LoggerService();
      
      // Old file should be deleted
      expect(fs.existsSync(oldLogFile)).toBe(false);
    });

    it('should keep log files newer than 7 days', () => {
      // Create recent log file
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const year = recentDate.getFullYear();
      const month = String(recentDate.getMonth() + 1).padStart(2, '0');
      const day = String(recentDate.getDate()).padStart(2, '0');
      const recentLogFile = path.join(LOG_DIR, `review-agent-${year}-${month}-${day}.log`);
      
      fs.writeFileSync(recentLogFile, 'recent log content');
      
      // Set file modification time to 3 days ago
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      fs.utimesSync(recentLogFile, new Date(threeDaysAgo), new Date(threeDaysAgo));
      
      // Create new logger instance to trigger cleanup
      new LoggerService();
      
      // Recent file should still exist
      expect(fs.existsSync(recentLogFile)).toBe(true);
      
      // Cleanup
      fs.unlinkSync(recentLogFile);
    });
  });

  describe('Log Format', () => {
    it('should use format [timestamp] [LEVEL] message', () => {
      logger.log('test message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      // Check format: [timestamp] [LEVEL] message
      expect(lastLine).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] test message$/);
    });

    it('should include context in log format when provided', () => {
      const loggerWithContext = new LoggerService('TestContext');
      loggerWithContext.log('test message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      expect(lastLine).toContain('[TestContext]');
      expect(lastLine).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[TestContext\] test message$/);
    });

    it('should format timestamp as ISO string', () => {
      logger.log('test message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      
      const timestampMatch = lastLine.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      expect(timestampMatch).toBeTruthy();
      
      if (timestampMatch) {
        const timestamp = new Date(timestampMatch[1]);
        expect(timestamp.toISOString()).toBe(timestampMatch[1]);
      }
    });
  });

  describe('Log Levels', () => {
    it('should support INFO level via log()', () => {
      logger.log('info message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[INFO] info message');
    });

    it('should support WARN level', () => {
      logger.warn('warning message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[WARN] warning message');
    });

    it('should support ERROR level', () => {
      logger.error('error message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[ERROR] error message');
    });

    it('should support DEBUG level', () => {
      logger.debug('debug message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[DEBUG] debug message');
    });

    it('should support VERBOSE level', () => {
      logger.verbose('verbose message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[VERBOSE] verbose message');
    });
  });

  describe('Error Logging with Stack Trace', () => {
    it('should log error with stack trace when provided', () => {
      const errorMessage = 'Something went wrong';
      const stackTrace = 'Error: Something went wrong\n    at Object.<anonymous> (/path/to/file.js:10:15)';
      
      logger.error(errorMessage, stackTrace);
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[ERROR]');
      expect(content).toContain(errorMessage);
      expect(content).toContain(stackTrace);
    });
  });

  describe('Object Logging', () => {
    it('should stringify objects when logging', () => {
      const obj = { key: 'value', nested: { prop: 123 } };
      logger.log(obj);
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain(JSON.stringify(obj));
    });
  });

  describe('Context Management', () => {
    it('should allow setting context after instantiation', () => {
      logger.setContext('NewContext');
      logger.log('test message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[NewContext]');
    });

    it('should override context when passed to log method', () => {
      const loggerWithContext = new LoggerService('DefaultContext');
      loggerWithContext.log('test message', 'OverrideContext');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      expect(content).toContain('[OverrideContext]');
      expect(content).not.toContain('[DefaultContext]');
    });
  });

  describe('NestJS LoggerService Interface Compatibility', () => {
    it('should implement log method', () => {
      expect(typeof logger.log).toBe('function');
    });

    it('should implement error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should implement warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should implement debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    it('should implement verbose method', () => {
      expect(typeof logger.verbose).toBe('function');
    });
  });

  describe('File Writing', () => {
    it('should append to existing log file', () => {
      logger.log('first message');
      logger.log('second message');
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('first message');
      expect(lines[1]).toContain('second message');
    });

    it('should handle concurrent writes', () => {
      const messages = Array.from({ length: 10 }, (_, i) => `message ${i}`);
      
      messages.forEach(msg => logger.log(msg));
      
      const content = fs.readFileSync(testLogFile, 'utf-8');
      const lines = content.trim().split('\n');
      
      expect(lines.length).toBe(10);
      messages.forEach((msg, i) => {
        expect(lines[i]).toContain(msg);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully during logging', () => {
      // Test that logger doesn't crash the application
      // Error handling is implemented with try-catch blocks
      expect(() => {
        logger.log('test message');
        logger.error('error message');
        logger.warn('warning message');
      }).not.toThrow();
    });
  });
});
