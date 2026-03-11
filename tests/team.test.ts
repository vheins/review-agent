import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CapacityPlannerService } from '../src/modules/team/services/capacity-planner.service.js';
import { AssignmentEngineService } from '../src/modules/team/services/assignment-engine.service.js';

describe('Team Services', () => {
  describe('CapacityPlannerService', () => {
    let service: CapacityPlannerService;

    beforeEach(() => {
      service = new CapacityPlannerService();
    });

    it('should calculate capacity based on team size and review time', async () => {
      const teamSize = 5;
      const avgReviewTimeMs = 2 * 60 * 60 * 1000; // 2 hours
      const capacity = await service.calculateCapacity(teamSize, avgReviewTimeMs);
      
      // (5 * 6) / 2 = 15
      expect(capacity).toBe(15);
    });
  });

  describe('AssignmentEngineService', () => {
    let service: AssignmentEngineService;
    let devMetricsRepo: any;

    beforeEach(() => {
      devMetricsRepo = {
        find: vi.fn(),
      };
      service = new AssignmentEngineService(devMetricsRepo);
    });

    it('should suggest top candidates based on experience', async () => {
      const mockDevs = [
        { developerId: 'alice', totalPrsReviewed: 50 },
        { developerId: 'bob', totalPrsReviewed: 100 },
        { developerId: 'charlie', totalPrsReviewed: 10 },
      ];
      devMetricsRepo.find.mockResolvedValue(mockDevs);

      const suggested = await service.suggestReviewers('o/r', 1, [], 'charlie');

      expect(suggested).toHaveLength(2);
      expect(suggested).toContain('bob');
      expect(suggested).toContain('alice');
      expect(suggested).not.toContain('charlie');
    });
  });
});
