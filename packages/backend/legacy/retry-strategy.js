import { logger } from './logger.js';

export class RetryStrategy {
  constructor(maxRetries = 5, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async execute(fn, context = '') {
    let attempt = 0;
    
    while (attempt <= this.maxRetries) {
      try {
        return await fn();
      } catch (e) {
        if (attempt === this.maxRetries || !this.isRetryable(e)) {
          logger.error(`Failed ${context} after ${attempt + 1} attempts: ${e.message}`);
          throw e;
        }

        const delay = this.calculateDelay(attempt);
        logger.warn(`Retryable error in ${context} (attempt ${attempt + 1}/${this.maxRetries + 1}). Retrying in ${delay}ms... Error: ${e.message}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
  }

  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * 2^attempt
    // Plus jitter: +/- 10%
    const exponential = this.baseDelay * Math.pow(2, attempt);
    const jitter = exponential * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(exponential + jitter);
  }

  isRetryable(error) {
    // Standard retryable errors
    const retryableMessages = [
      'rate limit',
      'timeout',
      'network error',
      'connection reset',
      '503',
      '502',
      '504',
      'busy'
    ];

    const msg = error.message.toLowerCase();
    return retryableMessages.some(m => msg.includes(m));
  }
}

export const retryStrategy = new RetryStrategy();
export default retryStrategy;
