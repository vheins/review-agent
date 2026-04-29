import { describe, expect, it, vi } from 'vitest';
import {
  formatCountdownDuration,
  formatRateLimitWait,
} from '../packages/backend/src/common/utils/rate-limit-wait-format.util.js';

describe('rate limit wait formatting', () => {
  it('formats wait durations as hours, minutes, and seconds', () => {
    expect(formatCountdownDuration(2 * 60 * 60 * 1000 + 3 * 60 * 1000 + 4 * 1000)).toBe('02h 03m 04s');
    expect(formatCountdownDuration(999)).toBe('00h 00m 01s');
  });

  it('uses the local timezone when showing the retry time', () => {
    vi.stubEnv('TZ', 'Asia/Jakarta');

    try {
      const formatted = formatRateLimitWait(36 * 60 * 1000 + 20 * 1000, Date.parse('2026-04-27T03:35:32.000Z'));

      expect(formatted).toContain('00h 36m 20s');
      expect(formatted).toContain('11:11:52');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
