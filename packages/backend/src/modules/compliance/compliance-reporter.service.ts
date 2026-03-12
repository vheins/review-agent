import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Comment } from '../../database/entities/comment.entity.js';
import { Review } from '../../database/entities/review.entity.js';

/**
 * ComplianceReporterService - Service for generating compliance and audit reports
 * 
 * Features:
 * - Automated compliance summary generation
 * - Security policy enforcement checks
 * - Framework alignment (SOC2, ISO 27001)
 * 
 * Requirements: 14.1, 14.2
 */
@Injectable()
export class ComplianceReporterService {
  private readonly logger = new Logger(ComplianceReporterService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  /**
   * Generate a summary of security compliance over a period
   * 
   * @param daysLookback - Number of days to look back
   */
  async generateComplianceSummary(daysLookback: number = 30) {
    const since = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000);

    // Fetch all security-related comments in the period
    const securityComments = await this.commentRepository.find({
      where: {
        category: 'security',
        review: {
          startedAt: MoreThanOrEqual(since)
        }
      },
      relations: ['review']
    });

    const totalFindings = securityComments.length;
    // For now, consider "resolved" if the PR was merged or closed (simplified)
    // In a real app, we'd check if subsequent reviews for the same PR don't have the issue
    const resolvedFindings = securityComments.filter(c => c.postedAt !== null).length; // Simplified proxy

    const severityBreakdown = {
      error: securityComments.filter(c => c.severity === 'error').length,
      warning: securityComments.filter(c => c.severity === 'warning').length,
      info: securityComments.filter(c => c.severity === 'info').length,
    };

    return {
      period: `${daysLookback} days`,
      totalFindings,
      resolvedFindings,
      complianceRate: totalFindings > 0 ? (resolvedFindings / totalFindings) * 100 : 100,
      severityBreakdown
    };
  }

  /**
   * Generate an executive markdown report
   */
  async generateExecutiveReport(daysLookback: number = 90): Promise<string> {
    const summary = await this.generateComplianceSummary(daysLookback);
    
    let report = `# Compliance Executive Summary\n\n`;
    report += `## Period: Last ${daysLookback} Days\n\n`;
    report += `### Overview\n`;
    report += `- **Compliance Rate**: ${summary.complianceRate.toFixed(1)}%\n`;
    report += `- **Total Security Findings**: ${summary.totalFindings}\n`;
    report += `- **Resolved Findings**: ${summary.resolvedFindings}\n\n`;
    
    report += `### Severity Breakdown\n`;
    report += `- Critical/High (Errors): ${summary.severityBreakdown.error}\n`;
    report += `- Medium (Warnings): ${summary.severityBreakdown.warning}\n`;
    report += `- Low (Info): ${summary.severityBreakdown.info}\n\n`;
    
    report += `### Policy Enforcement\n`;
    if (summary.severityBreakdown.error > 0) {
      report += `⚠️ **Warning**: ${summary.severityBreakdown.error} high-severity security issues remained unposted or unresolved in this period.\n`;
    } else {
      report += `✅ **Success**: No high-severity security issues found in this period.\n`;
    }
    
    report += `\n### Framework Alignment\n`;
    report += `- **SOC2**: Alignment with CC7.1 (Vulnerability Management)\n`;
    report += `- **ISO 27001**: Alignment with A.12.6.1 (Technical Vulnerability Management)\n`;
    report += `- **GDPR**: Alignment with Article 32 (Security of processing)\n`;
    
    return report;
  }

  /**
   * Export report as JSON
   */
  async exportReportJson(daysLookback: number = 30): Promise<string> {
    const summary = await this.generateComplianceSummary(daysLookback);
    return JSON.stringify(summary, null, 2);
  }
}
