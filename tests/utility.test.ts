import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchProcessorService } from '../src/modules/pull-request/batch-processor.service.js';
import { AuditLoggerService } from '../src/common/audit/audit-logger.service.js';

describe('Utility Services', () => {
  describe('BatchProcessorService', () => {
    let service: BatchProcessorService;
    let prRepo: any;

    beforeEach(() => {
      prRepo = {
        find: vi.fn(),
      };
      service = new BatchProcessorService(prRepo);
    });

    it('should group PRs by base branch', async () => {
      const mockPRs = [
        { number: 1, baseBranch: 'main', title: 'Fix auth bug' },
        { number: 2, baseBranch: 'main', title: 'Update dependencies' },
        { number: 3, baseBranch: 'develop', title: 'New feature UI' },
      ];
      prRepo.find.mockResolvedValue(mockPRs);

      const batches = await service.groupPRsIntoBatches('o/r');

      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2); // main branch PRs (related by branch)
      expect(batches[1]).toHaveLength(1); // develop branch PR
    });

    it('should group PRs by title overlap', async () => {
      const mockPRs = [
        { number: 1, baseBranch: 'main', title: 'Refactor database service' },
        { number: 2, baseBranch: 'develop', title: 'Database optimization' },
      ];
      prRepo.find.mockResolvedValue(mockPRs);

      const batches = await service.groupPRsIntoBatches('o/r');

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2); // related by "database"
    });
  });

  describe('AuditLoggerService', () => {
    let service: AuditLoggerService;
    let auditRepo: any;

    beforeEach(() => {
      auditRepo = {
        create: vi.fn().mockImplementation(val => val),
        save: vi.fn().mockResolvedValue(true),
      };
      service = new AuditLoggerService(auditRepo);
    });

    it('should log actions correctly', async () => {
      await service.logAction('test_action', 'user1', 'pr', '123');
      expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        actionType: 'test_action',
        actorId: 'user1',
      }));
      expect(auditRepo.save).toHaveBeenCalled();
    });
  });
});
