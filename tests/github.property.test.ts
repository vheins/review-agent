import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GitHubClientService } from '../src/modules/github/github.service.js';
import { execa } from 'execa';
import * as fc from 'fast-check';
import { EventEmitter } from 'events';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('GitHubClientService Property Tests', () => {
  let service: GitHubClientService;
  let configService: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockExecaProcess(stdoutContent: string, exitCode = 0) {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const promise = Promise.resolve({ stdout: stdoutContent, stderr: '', exitCode }) as any;
    promise.stdout = stdout;
    promise.stderr = stderr;
    return promise;
  }

  describe('Property 17: GitHub PR Scanning Scope', () => {
    it('should only call gh search for scopes included in configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.subarray(['authored', 'assigned', 'review-requested']),
          async (prScope) => {
            vi.clearAllMocks();
            
            configService = {
              getAppConfig: vi.fn().mockReturnValue({
                prScope,
                excludeRepoOwners: [],
                workspaceDir: './test-workspace',
              }),
            };
            
            service = new GitHubClientService(configService as any);
            
            (execa as Mock).mockImplementation(() => createMockExecaProcess('[]'));
            
            await service.fetchOpenPRs();
            
            // Check authored scope
            if (prScope.includes('authored')) {
              expect(execa).toHaveBeenCalledWith('gh', expect.arrayContaining(['--author=@me']), expect.any(Object));
            } else {
              expect(execa).not.toHaveBeenCalledWith('gh', expect.arrayContaining(['--author=@me']), expect.any(Object));
            }
            
            // Check assigned scope
            if (prScope.includes('assigned')) {
              expect(execa).toHaveBeenCalledWith('gh', expect.arrayContaining(['--assignee=@me']), expect.any(Object));
            } else {
              expect(execa).not.toHaveBeenCalledWith('gh', expect.arrayContaining(['--assignee=@me']), expect.any(Object));
            }
            
            // Check review-requested scope
            if (prScope.includes('review-requested')) {
              expect(execa).toHaveBeenCalledWith('gh', expect.arrayContaining(['--review-requested=@me']), expect.any(Object));
            } else {
              expect(execa).not.toHaveBeenCalledWith('gh', expect.arrayContaining(['--review-requested=@me']), expect.any(Object));
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 18: Atomic Comment Posting', () => {
    it('should return false and not throw when gh command fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.constantFrom('APPROVE', 'REQUEST_CHANGES', 'COMMENT'),
          async (body, event) => {
            vi.clearAllMocks();
            configService = { getAppConfig: vi.fn().mockReturnValue({}) };
            service = new GitHubClientService(configService as any);
            
            // Mock failure
            (execa as Mock).mockImplementation(() => createMockExecaProcess('error', 1));
            
            const result = await service.addReview('owner/repo', 1, body, event as any);
            
            expect(result).toBe(false);
            expect(execa).toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return true when gh command succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          async (body) => {
            vi.clearAllMocks();
            configService = { getAppConfig: vi.fn().mockReturnValue({}) };
            service = new GitHubClientService(configService as any);
            
            // Mock success
            (execa as Mock).mockImplementation(() => createMockExecaProcess('success', 0));
            
            const result = await service.addReview('owner/repo', 1, body, 'COMMENT');
            
            expect(result).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
