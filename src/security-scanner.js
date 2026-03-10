import { dbManager } from './database.js';
import { logger } from './logger.js';

export class SecurityScanner {
  constructor() {
    this.vulnerabilityPatterns = [
      {
        id: 'sql_injection',
        name: 'Potential SQL Injection',
        pattern: /query\s*\(\s*['"].*?\$\{.*?\}['"]\s*\)/gi,
        severity: 'critical',
        description: 'Direct string interpolation in SQL queries can lead to SQL injection.'
      },
      {
        id: 'xss',
        name: 'Potential XSS',
        pattern: /dangerouslySetInnerHTML/gi,
        severity: 'high',
        description: 'Using dangerouslySetInnerHTML can lead to Cross-Site Scripting (XSS) vulnerabilities.'
      },
      {
        id: 'hardcoded_secret',
        name: 'Hardcoded Secret',
        pattern: /(api_key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9\-_]{16,}['"]/gi,
        severity: 'critical',
        description: 'Hardcoded secrets in source code are a major security risk.'
      }
    ];
  }

  async scanPR(prId, changedFiles = []) {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    const findings = [];

    for (const file of changedFiles) {
      if (!file.content) continue;

      // 1. Scan for vulnerability patterns
      for (const pattern of this.vulnerabilityPatterns) {
        let match;
        // Reset regex state for global patterns
        pattern.pattern.lastIndex = 0;
        
        while ((match = pattern.pattern.exec(file.content)) !== null) {
          const lineOffset = file.content.substring(0, match.index).split('\n').length;
          
          findings.push({
            pr_id: prId,
            finding_type: 'vulnerability',
            severity: pattern.severity,
            title: pattern.name,
            description: pattern.description,
            file_path: file.path,
            line_number: lineOffset,
            detected_at: new Date().toISOString()
          });
        }
      }
    }

    // 2. Store findings
    if (findings.length > 0) {
      dbManager.transaction(() => {
        const insertStmt = dbManager.db.prepare(`
          INSERT INTO security_findings (
            pr_id, finding_type, severity, title, description, 
            file_path, line_number, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const f of findings) {
          insertStmt.run(
            f.pr_id, f.finding_type, f.severity, f.title, 
            f.description, f.file_path, f.line_number, f.detected_at
          );
        }
      })();
    }

    return findings;
  }

  async getFindings(prId) {
    if (!dbManager.isAvailable()) return [];
    return dbManager.db.prepare('SELECT * FROM security_findings WHERE pr_id = ?').all(prId);
  }

  async generateReport(prId) {
    const findings = await this.getFindings(prId);
    if (findings.length === 0) return 'No security issues found.';

    const stats = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };

    let report = `# Security Scan Report for PR #${prId}\n\n`;
    report += `## Summary\n`;
    report += `- Critical Issues: ${stats.critical}\n`;
    report += `- High Issues: ${stats.high}\n`;
    report += `- Medium Issues: ${stats.medium}\n`;
    report += `- Low Issues: ${stats.low}\n\n`;

    report += `## Findings\n\n`;

    for (const f of findings) {
      report += `### [${f.severity.toUpperCase()}] ${f.title}\n`;
      report += `- **Type**: ${f.finding_type}\n`;
      report += `- **Location**: ${f.file_path}${f.line_number ? `:${f.line_number}` : ''}\n`;
      report += `- **Description**: ${f.description}\n`;
      if (f.remediation) {
        report += `- **Remediation**: ${f.remediation}\n`;
      }
      report += `\n`;
    }

    return report;
  }
}

export const securityScanner = new SecurityScanner();
export default securityScanner;
