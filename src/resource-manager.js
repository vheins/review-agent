import { logger } from './logger.js';

export class ResourceManager {
  constructor() {
    this.listeners = []; // { emitter, event, listener }
    this.timers = new Set();
    this.intervals = new Set();
  }

  on(emitter, event, listener) {
    emitter.on(event, listener);
    this.listeners.push({ emitter, event, listener });
  }

  setTimeout(fn, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  setInterval(fn, delay) {
    const interval = setInterval(fn, delay);
    this.intervals.add(interval);
    return interval;
  }

  cleanup() {
    // 1. Remove all listeners
    for (const { emitter, event, listener } of this.listeners) {
      emitter.removeListener(event, listener);
    }
    this.listeners = [];

    // 2. Clear all timers
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // 3. Clear all intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals.clear();

    logger.info('Resource cleanup complete.');
  }

  monitorMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usedPercent = (heapUsedMB / heapTotalMB) * 100;

    logger.info(`Memory Usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${usedPercent.toFixed(1)}%)`);

    if (usedPercent > 80 && global.gc) {
      logger.warn('High memory usage detected. Triggering garbage collection...');
      global.gc();
    }
  }
}

export const resourceManager = new ResourceManager();
export default resourceManager;
