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

    await Promise.all([
      this.scanNpm(repoDir, repoName, prNumber, findings),
      this.scanComposer(repoDir, repoName, prNumber, findings),
    ]);

    if (findings.length > 0) {
      await this.findingRepository.save(findings);
    }

    return findings;
  }

  private async scanNpm(repoDir: string, repoName: string, prNumber: number, findings: SecurityFinding[]): Promise<void> {
    const packageJsonPath = path.join(repoDir, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) return;

    // Determine lockfile type
    const hasPackageLock = await fs.pathExists(path.join(repoDir, 'package-lock.json'));
    const hasYarnLock = await fs.pathExists(path.join(repoDir, 'yarn.lock'));
    const hasPnpmLock = await fs.pathExists(path.join(repoDir, 'pnpm-lock.yaml'));

    try {
      let stdout = '';

      if (hasPackageLock) {
        this.logger.log(`Running npm audit for ${repoName}#${prNumber}...`);
        ({ stdout } = await execa('npm', ['audit', '--json'], { cwd: repoDir, reject: false }));
        const auditResult = JSON.parse(stdout || '{}');
        if (auditResult.vulnerabilities) {
          for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities) as any) {
            findings.push(this.findingRepository.create({
              prNumber, repository: repoName, findingType: 'vulnerability',
              severity: this.mapNpmSeverity(vuln.severity),
              title: `Vulnerable Dependency: ${pkgName}`,
              description: `Package \`${pkgName}\` has a **${vuln.severity}** vulnerability. Affected range: \`${vuln.range}\`. ${vuln.fixAvailable ? 'Fix available.' : 'No fix available yet.'}`,
              filePath: 'package.json', lineNumber: null,
            }));
          }
        }
      } else if (hasYarnLock) {
        this.logger.log(`Running yarn audit for ${repoName}#${prNumber}...`);
        ({ stdout } = await execa('yarn', ['audit', '--json'], { cwd: repoDir, reject: false }));
        for (const line of stdout.split('\n').filter(Boolean)) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'auditAdvisory') {
              const { advisory } = entry.data;
              findings.push(this.findingRepository.create({
                prNumber, repository: repoName, findingType: 'vulnerability',
                severity: this.mapNpmSeverity(advisory.severity),
                title: `Vulnerable Dependency: ${advisory.module_name}`,
                description: `Package \`${advisory.module_name}\` has a **${advisory.severity}** vulnerability: ${advisory.title}. Affected: \`${advisory.vulnerable_versions}\`.`,
                filePath: 'package.json', lineNumber: null,
              }));
            }
          } catch (_) {}
        }
      } else if (hasPnpmLock) {
        this.logger.log(`Running pnpm audit for ${repoName}#${prNumber}...`);
        ({ stdout } = await execa('pnpm', ['audit', '--json'], { cwd: repoDir, reject: false }));
        const auditResult = JSON.parse(stdout || '{}');
        if (auditResult.advisories) {
          for (const advisory of Object.values(auditResult.advisories) as any) {
            findings.push(this.findingRepository.create({
              prNumber, repository: repoName, findingType: 'vulnerability',
              severity: this.mapNpmSeverity(advisory.severity),
              title: `Vulnerable Dependency: ${advisory.module_name}`,
              description: `Package \`${advisory.module_name}\` has a **${advisory.severity}** vulnerability: ${advisory.title}.`,
              filePath: 'package.json', lineNumber: null,
            }));
          }
        }
      } else {
        this.logger.warn(`No lockfile found in ${repoName} — skipping npm audit`);
      }
    } catch (e) {
      this.logger.warn(`npm/yarn/pnpm audit failed: ${e.message}`);
    }
  }

  private async scanComposer(repoDir: string, repoName: string, prNumber: number, findings: SecurityFinding[]): Promise<void> {
    const composerJsonPath = path.join(repoDir, 'composer.json');
    if (!await fs.pathExists(composerJsonPath)) return;

    // Try composer audit (Composer 2.4+)
    try {
      this.logger.log(`Running composer audit for ${repoName}#${prNumber}...`);
      const { stdout } = await execa('composer', ['audit', '--format=json', '--no-interaction'], { cwd: repoDir, reject: false });
      const auditResult = JSON.parse(stdout || '{}');

      const advisories: any[] = auditResult.advisories ? Object.values(auditResult.advisories) : [];
      for (const advisory of advisories.flat()) {
        findings.push(this.findingRepository.create({
          prNumber,
          repository: repoName,
          findingType: 'vulnerability',
          severity: this.mapComposerSeverity(advisory.severity),
          title: `Vulnerable Dependency: ${advisory.packageName}`,
          description: `Package \`${advisory.packageName}\` has a vulnerability: **${advisory.title}**. CVE: ${advisory.cve || 'N/A'}. Affected versions: \`${advisory.affectedVersions}\`.`,
          filePath: 'composer.json',
          lineNumber: null,
        }));
      }
    } catch (e) {
      this.logger.warn(`composer audit failed: ${e.message}`);
    }
  }

  private mapNpmSeverity(severity: string): string {
    const s = severity.toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'moderate') return 'medium';
    return 'low';
  }

  private mapComposerSeverity(severity: string): string {
    if (!severity) return 'medium';
    const s = severity.toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'medium' || s === 'moderate') return 'medium';
    return 'low';
  }
}
