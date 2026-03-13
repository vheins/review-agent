import { Injectable, Logger } from '@nestjs/common';

/**
 * ResponseCacheService - Simple in-memory cache for API responses
 */
@Injectable()
export class ResponseCacheService {
  private readonly logger = new Logger(ResponseCacheService.name);
  private readonly store = new Map<string, { value: any, expiresAt: number }>();
  private readonly defaultTtlMs = 30000;

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: any, ttlMs: number = this.defaultTtlMs): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  /**
   * Clear cache
   * 
   * @param prefix - Optional prefix to clear specific keys
   */
  clear(prefix: string = ''): void {
    if (!prefix) {
      this.store.clear();
      return;
    }

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}
