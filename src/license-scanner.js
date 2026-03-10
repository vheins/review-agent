import fs from 'fs-extra';
import path from 'path';
import { dbManager } from './database.js';
import { logger } from './logger.js';

export class LicenseScanner {
  constructor() {
    this.allowlist = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC'];
    this.blocklist = ['GPL-3.0', 'AGPL-3.0'];
  }

  async validateLicenses(repoDir, prId) {
    if (!dbManager.isAvailable()) return [];

    const findings = [];
    const packageJsonPath = path.join(repoDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) return [];

    try {
      const pkg = await fs.readJson(packageJsonPath);
      const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      // In a real app, we'd use a tool like 'license-checker' to get licenses of all sub-dependencies
      // For this implementation, we'll check the project's own license if it changed
      // or simulate checking dependencies.
      
      const projectLicense = pkg.license;
      if (projectLicense) {
        const result = this.checkLicense(projectLicense);
        if (result.type === 'blocked') {
          findings.push({
            pr_id: prId,
            finding_type: 'license',
            severity: 'critical',
            title: `Blocked License: ${projectLicense}`,
            description: `The project uses a blocked license: ${projectLicense}.`,
            file_path: 'package.json',
            detected_at: new Date().toISOString()
          });
        } else if (result.type === 'unknown') {
          findings.push({
            pr_id: prId,
            finding_type: 'license',
            severity: 'low',
            title: `Unknown License: ${projectLicense}`,
            description: `The license ${projectLicense} is not in the allowlist.`,
            file_path: 'package.json',
            detected_at: new Date().toISOString()
          });
        }
      } else {
        findings.push({
          pr_id: prId,
          finding_type: 'license',
          severity: 'medium',
          title: 'Missing License',
          description: 'No license specified in package.json.',
          file_path: 'package.json',
          detected_at: new Date().toISOString()
        });
      }
    } catch (e) {
      logger.error(`License scan failed: ${e.message}`);
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

  checkLicense(license) {
    if (this.blocklist.includes(license)) return { type: 'blocked' };
    if (this.allowlist.includes(license)) return { type: 'allowed' };
    return { type: 'unknown' };
  }
}

export const licenseScanner = new LicenseScanner();
export default licenseScanner;
