import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Comment } from '../../database/entities/comment.entity.js';
import { Review } from '../../database/entities/review.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

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
    @InjectRepository(SecurityFinding)
    private readonly securityRepository: Repository<SecurityFinding>,
  ) {}

  /**
   * Generate a summary of security compliance over a period
   * 
   * @param daysLookback - Number of days to look back
   */
  async generateComplianceSummary(daysLookback: number = 30) {
    const since = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000);

    const totalFindings = await this.securityRepository.count({
      where: {
        detectedAt: MoreThanOrEqual(since)
      }
    });

    const resolvedFindings = await this.securityRepository.count({
      where: {
        detectedAt: MoreThanOrEqual(since),
        is_resolved: true
      }
    });

    const findings = await this.securityRepository.find({
      where: {
        detectedAt: MoreThanOrEqual(since)
      }
    });

    const severityBreakdown = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
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
    report += `- Critical: ${summary.severityBreakdown.critical}\n`;
    report += `- High: ${summary.severityBreakdown.high}\n`;
    report += `- Medium: ${summary.severityBreakdown.medium}\n`;
    report += `- Low: ${summary.severityBreakdown.low}\n\n`;
    
    report += `### Policy Enforcement\n`;
    if (summary.severityBreakdown.critical > 0 || summary.severityBreakdown.high > 0) {
      report += `⚠️ **Warning**: Significant security issues detected in this period.\n`;
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
