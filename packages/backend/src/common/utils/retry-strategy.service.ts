import { Injectable, Logger } from '@nestjs/common';

/**
 * RetryStrategyService - Service for executing operations with retry logic
 */
@Injectable()
export class RetryStrategyService {
  private readonly logger = new Logger(RetryStrategyService.name);
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000;

  /**
   * Execute a function with retry logic
   * 
   * @param fn - Function to execute
   * @param context - Context string for logging
   * @returns Result of the function
   */
  async execute<T>(fn: () => Promise<T>, context: string = ''): Promise<T> {
    let attempt = 0;
    
    while (attempt <= this.maxRetries) {
      try {
        return await fn();
      } catch (e) {
        if (attempt === this.maxRetries || !this.isRetryable(e)) {
          this.logger.error(`Failed ${context} after ${attempt + 1} attempts: ${e.message}`);
          throw e;
        }

        const delay = this.calculateDelay(attempt);
        this.logger.warn(`Retryable error in ${context} (attempt ${attempt + 1}/${this.maxRetries + 1}). Retrying in ${delay}ms... Error: ${e.message}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
    throw new Error(`Execution failed after ${this.maxRetries} retries`);
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    // Plus jitter: +/- 10%
    const exponential = this.baseDelay * Math.pow(2, attempt);
    const jitter = exponential * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(exponential + jitter);
  }

  private isRetryable(error: any): boolean {
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

    const msg = error.message?.toLowerCase() || '';
    return retryableMessages.some(m => msg.includes(m));
  }
}
