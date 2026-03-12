import { dbManager } from './database.js';
import { securityScanner } from './security-scanner.js';

export class ComplianceReporter {
  constructor() {}

  async generateComplianceSummary(daysLookback = 30) {
    if (!dbManager.isAvailable()) return null;

    const since = new Date(Date.now() - daysLookback * 24 * 60 * 60 * 1000).toISOString();

    const findings = dbManager.db.prepare(`
      SELECT finding_type, severity, COUNT(*) as count
      FROM security_findings
      WHERE detected_at >= ?
      GROUP BY finding_type, severity
    `).all(since);

    const resolved = dbManager.db.prepare(`
      SELECT COUNT(*) as count FROM security_findings
      WHERE detected_at >= ? AND is_resolved = 1
    `).get(since).count;

    const total = dbManager.db.prepare(`
      SELECT COUNT(*) as count FROM security_findings
      WHERE detected_at >= ?
    `).get(since).count;

    return {
      period: `${daysLookback} days`,
      totalFindings: total,
      resolvedFindings: resolved,
      complianceRate: total > 0 ? (resolved / total) * 100 : 100,
      findingsBreakdown: findings
    };
  }

  async generateExecutiveReport(repositoryId) {
    // Simplified version
    const summary = await this.generateComplianceSummary(90);
    
    let report = `# Compliance Executive Summary\n\n`;
    report += `## Overview\n`;
    report += `- Compliance Rate: ${summary.complianceRate.toFixed(1)}%\n`;
    report += `- Total Security Findings: ${summary.totalFindings}\n`;
    report += `- Resolved: ${summary.resolvedFindings}\n\n`;
    
    report += `## Framework Alignment\n`;
    report += `- **SOC2**: Alignment with CC7.1 (Vulnerability Management)\n`;
    report += `- **ISO 27001**: Alignment with A.12.6.1 (Technical Vulnerability Management)\n`;
    
    return report;
  }
}

export const complianceReporter = new ComplianceReporter();
export default complianceReporter;
