import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MigrationReport } from './interfaces/migration-report.interface.js';

export class ReportGenerator {
  private outputDir: string;

  constructor(outputDir: string = 'reports/migration') {
    this.outputDir = path.resolve(process.cwd(), outputDir);
  }

  async generateJsonReport(report: MigrationReport, filename: string = 'migration-report.json'): Promise<string> {
    await fs.ensureDir(this.outputDir);
    const filePath = path.join(this.outputDir, filename);
    await fs.writeJson(filePath, report, { spaces: 2 });
    return filePath;
  }

  async generateMarkdownReport(report: MigrationReport, filename: string = 'migration-report.md'): Promise<string> {
    await fs.ensureDir(this.outputDir);
    const filePath = path.join(this.outputDir, filename);

    let md = `# Migration Validation Report\n\n`;
    md += `**Status:** ${report.overallStatus.toUpperCase()}\n`;
    md += `**Date:** ${new Date().toISOString()}\n\n`;

    md += `## Summary\n\n`;
    md += `- **Legacy Files:** ${report.legacyFiles.length - report.unmigratedFiles.length}/${report.legacyFiles.length} migrated\n`;
    md += `- **Import References:** ${report.importReferences.length} legacy imports found\n`;
    md += `- **Route Files:** ${report.routeFiles.length} legacy routes remaining\n`;
    md += `- **Test Coverage:** ${report.testCoverage.filter(t => t.hasTests).length}/${report.testCoverage.length} modules have tests\n\n`;

    if (report.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      report.recommendations.forEach(rec => {
        md += `- ${rec}\n`;
      });
      md += `\n`;
    }

    md += `## Detailed Status\n\n`;
    md += `### Core Modules\n\n`;
    md += `| Module | Status | Details |\n`;
    md += `| --- | --- | --- |\n`;
    md += `| Database Layer | ${report.databaseLayer.typeORMConfigComplete ? '✅' : '❌'} | ${report.databaseLayer.legacyDBFilesUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| Configuration | ${report.config.nestJSConfigModule ? '✅' : '❌'} | ${report.config.legacyConfigUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| WebSockets | ${report.websocket.gatewayImplementation ? '✅' : '❌'} | ${report.websocket.legacyWSUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| Review Engine | ${report.reviewEngine.reviewEngineImplemented ? '✅' : '❌'} | ${report.reviewEngine.legacyEngineUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| GitHub Integration | ${report.githubIntegration.githubServiceImplemented ? '✅' : '❌'} | ${report.githubIntegration.legacyGitHubUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| Security | ${report.security.securityScannerImplemented ? '✅' : '❌'} | ${report.security.legacySecurityUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| Metrics | ${report.metrics.metricsServiceImplemented ? '✅' : '❌'} | ${report.metrics.legacyMetricsUsed ? 'Legacy used' : 'Clean'} |\n`;
    md += `| Team Management | ${report.teamManagement.assignmentEngineImplemented ? '✅' : '❌'} | ${report.teamManagement.legacyAssignmentUsed ? 'Legacy used' : 'Clean'} |\n`;

    await fs.writeFile(filePath, md);
    return filePath;
  }

  async generateRemovalChecklist(report: MigrationReport): Promise<string> {
    await fs.ensureDir(this.outputDir);
    const filePath = path.join(this.outputDir, 'removal-checklist.md');

    let md = `# Pre-Removal Verification Checklist\n\n`;
    md += `Use this checklist before deleting the \`legacy/\` folder.\n\n`;

    md += `## 1. Code Migration [${report.unmigratedFiles.length === 0 ? 'COMPLETE' : 'INCOMPLETE'}]\n`;
    if (report.unmigratedFiles.length > 0) {
      md += `**CRITICAL:** The following files are NOT yet migrated:\n`;
      report.unmigratedFiles.forEach(f => md += `- [ ] ${f}\n`);
    } else {
      md += `- [x] All 64 legacy files have corresponding NestJS modules.\n`;
    }

    md += `\n## 2. Reference Cleanup [${report.importReferences.length === 0 ? 'COMPLETE' : 'INCOMPLETE'}]\n`;
    if (report.importReferences.length > 0) {
      md += `**CRITICAL:** Legacy references still exist in the following files:\n`;
      const uniqueFiles = Array.from(new Set(report.importReferences.map(r => r.filePath)));
      uniqueFiles.forEach(f => md += `- [ ] ${f}\n`);
    } else {
      md += `- [x] No code imports from the \`legacy/\` directory.\n`;
      md += `- [x] No \`package.json\` scripts reference the \`legacy/\` directory.\n`;
    }

    md += `\n## 3. Functional Verification\n`;
    md += `- [ ] All NestJS integration tests passing.\n`;
    md += `- [ ] Database schema matches legacy schema structure.\n`;
    md += `- [ ] All API endpoints verified via Postman/Insomnia.\n`;

    await fs.writeFile(filePath, md);
    return filePath;
  }
}
