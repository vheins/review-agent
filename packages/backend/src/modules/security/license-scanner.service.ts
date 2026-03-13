import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import fs from 'fs-extra';
import * as path from 'path';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

@Injectable()
export class LicenseScannerService {
  private readonly logger = new Logger(LicenseScannerService.name);
  private readonly allowlist = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC'];
  private readonly blocklist = ['GPL-3.0', 'AGPL-3.0'];

  constructor(
    @InjectRepository(SecurityFinding)
    private readonly securityRepository: Repository<SecurityFinding>,
  ) {}

  async validateLicenses(repoDir: string, repository: string, prNumber: number): Promise<SecurityFinding[]> {
    const findings: any[] = [];
    const packageJsonPath = path.join(repoDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) return [];

    try {
      const pkg = await fs.readJson(packageJsonPath);
      const projectLicense = pkg.license;

      if (projectLicense) {
        const result = this.checkLicense(projectLicense);
        if (result.type === 'blocked') {
          findings.push({
            prNumber,
            repository,
            finding_type: 'license',
            severity: 'critical',
            title: `Blocked License: ${projectLicense}`,
            description: `The project uses a blocked license: ${projectLicense}.`,
            file_path: 'package.json',
            is_resolved: false,
            detectedAt: new Date()
          });
        } else if (result.type === 'unknown') {
          findings.push({
            prNumber,
            repository,
            finding_type: 'license',
            severity: 'low',
            title: `Unknown License: ${projectLicense}`,
            description: `The license ${projectLicense} is not in the allowlist.`,
            file_path: 'package.json',
            is_resolved: false,
            detectedAt: new Date()
          });
        }
      } else {
        findings.push({
          prNumber,
          repository,
          finding_type: 'license',
          severity: 'medium',
          title: 'Missing License',
          description: 'No license specified in package.json.',
          file_path: 'package.json',
          is_resolved: false,
          detectedAt: new Date()
        });
      }
    } catch (e) {
      this.logger.error(`License scan failed: ${e.message}`);
    }

    if (findings.length > 0) {
      const savedFindings = await this.securityRepository.save(findings);
      return savedFindings;
    }

    return [];
  }

  checkLicense(license: string): { type: 'blocked' | 'allowed' | 'unknown' } {
    if (this.blocklist.includes(license)) return { type: 'blocked' };
    if (this.allowlist.includes(license)) return { type: 'allowed' };
    return { type: 'unknown' };
  }
}
