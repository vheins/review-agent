import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceReporterService } from '../src/modules/compliance/compliance-reporter.service.js';

describe('ComplianceReporterService', () => {
  let service: ComplianceReporterService;
  let commentRepo: any;
  let reviewRepo: any;

  beforeEach(() => {
    commentRepo = {
      find: vi.fn(),
    };
    reviewRepo = {};
    service = new ComplianceReporterService(commentRepo, reviewRepo as any);
  });

  it('should generate compliance summary correctly', async () => {
    const mockComments = [
      { severity: 'error', category: 'security', postedAt: new Date() },
      { severity: 'warning', category: 'security', postedAt: null },
    ];
    commentRepo.find.mockResolvedValue(mockComments);

    const summary = await service.generateComplianceSummary(30);

    expect(summary.totalFindings).toBe(2);
    expect(summary.resolvedFindings).toBe(1);
    expect(summary.complianceRate).toBe(50);
    expect(summary.severityBreakdown.error).toBe(1);
  });

  it('should generate markdown executive report', async () => {
    commentRepo.find.mockResolvedValue([]);
    const report = await service.generateExecutiveReport();
    expect(report).toContain('# Compliance Executive Summary');
    expect(report).toContain('SOC2');
  });
});
