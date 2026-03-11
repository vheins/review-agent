import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { api } from '../electron/api-helper.cjs';

describe('Electron API Client (api-helper)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('getDashboardSnapshot should call correct endpoint', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ snapshot: {} }),
    });

    const result = await api.getDashboardSnapshot({ rangeDays: 15 });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/dashboard?rangeDays=15'),
      expect.any(Object)
    );
  });

  it('listPRs should handle filters correctly', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ prs: [] }),
    });

    await api.listPRs({ status: 'open', search: 'fix' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/prs?status=open&search=fix'),
      expect.any(Object)
    );
  });

  it('getPRDetail should format path correctly', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ detail: {} }),
    });

    await api.getPRDetail('owner/repo-123');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/prs/owner/repo-123'),
      expect.any(Object)
    );
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server Error' }),
    });

    const result = await api.getDashboardSnapshot();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Server Error');
  });
});
