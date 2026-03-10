import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { dbManager } from './database.js';
import { logger } from './logger.js';

export class DependencyScanner {
  constructor() {}

  async checkDependencies(repoDir, prId) {
    if (!dbManager.isAvailable()) return [];

    const findings = [];
    const packageJsonPath = path.join(repoDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) return [];

    try {
      logger.info('Running npm audit for security scanning...');
      const { stdout } = await execa('npm', ['audit', '--json'], { cwd: repoDir, reject: false });
      
      const auditResult = JSON.parse(stdout || '{}');
      
      if (auditResult.vulnerabilities) {
        for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities)) {
          findings.push({
            pr_id: prId,
            finding_type: 'vulnerability',
            severity: this.mapNpmSeverity(vuln.severity),
            title: `Vulnerable Dependency: ${pkgName}`,
            description: `Package ${pkgName} has a security vulnerability. Range: ${vuln.range}. More info: ${vuln.via?.[0]?.url || 'N/A'}`,
            file_path: 'package.json',
            detected_at: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      logger.error(`Dependency scan failed: ${e.message}`);
    }

    // Store findings
    if (findings.length > 0) {
      dbManager.transaction(() => {
        const insertStmt = dbManager.db.prepare(`
          INSERT INTO security_findings (
            pr_id, finding_type, severity, title, description, 
            file_path, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const f of findings) {
          insertStmt.run(
            f.pr_id, f.finding_type, f.severity, f.title, 
            f.description, f.file_path, f.detected_at
          );
        }
      })();
    }

    return findings;
  }

  mapNpmSeverity(severity) {
    const s = severity.toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'moderate') return 'medium';
    return 'low';
  }
}

export const dependencyScanner = new DependencyScanner();
export default dependencyScanner;
