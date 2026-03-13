import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';
import { execa } from 'execa';
import fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class DependencyScannerService {
  private readonly logger = new Logger(DependencyScannerService.name);

  constructor(
    @InjectRepository(SecurityFinding)
    private readonly findingRepository: Repository<SecurityFinding>,
  ) {}

  async scanDependencies(repoDir: string, repoName: string, prNumber: number): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const packageJsonPath = path.join(repoDir, 'package.json');
    
    if (!await fs.pathExists(packageJsonPath)) return [];

    try {
      this.logger.log(`Running npm audit for ${repoName}#${prNumber}...`);
      const { stdout } = await execa('npm', ['audit', '--json'], { cwd: repoDir, reject: false });
      
      const auditResult = JSON.parse(stdout || '{}');
      
      if (auditResult.vulnerabilities) {
        for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities) as any) {
          const finding = this.findingRepository.create({
            prNumber,
            repository: repoName,
            findingType: 'vulnerability',
            severity: this.mapNpmSeverity(vuln.severity),
            title: `Vulnerable Dependency: ${pkgName}`,
            description: `Package ${pkgName} has a security vulnerability. Range: ${vuln.range}.`,
            filePath: 'package.json',
          });
          findings.push(finding);
        }
      }
    } catch (e) {
      this.logger.error(`Dependency scan failed: ${e.message}`);
    }

    if (findings.length > 0) {
      await this.findingRepository.save(findings);
    }

    return findings;
  }

  private mapNpmSeverity(severity: string): string {
    const s = severity.toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'moderate') return 'medium';
    return 'low';
  }
}
