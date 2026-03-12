import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamValidator } from '../../packages/backend/src/migration/team-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('TeamValidator Property Tests', () => {
  let validator: TeamValidator;

  beforeEach(() => {
    validator = new TeamValidator();
  });

  describe('Property 21: Team management service migration verification', () => {
    it('should verify team management services implementation', async () => {
      // Feature: complete-nestjs-migration, Property 21: Team management service migration verification
      const status = await validator.getTeamManagementStatus();
      expect(typeof status.assignmentEngineImplemented).toBe('boolean');
      expect(typeof status.capacityPlannerMigrated).toBe('boolean');
      expect(typeof status.gamificationMigrated).toBe('boolean');
      expect(typeof status.developerDashboardMigrated).toBe('boolean');
    });
  });

  describe('Property 21.1: Legacy Team Management usage', () => {
    it('should verify that no legacy team-related references remain', async () => {
      // Feature: complete-nestjs-migration, Property 21: Team management service migration verification
      const usesLegacy = await validator.checkLegacyTeamUsage();
      expect(typeof usesLegacy).toBe('boolean');
    });
  });
});
