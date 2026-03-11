import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

@Injectable()
export class SecurityScannerService {
  private readonly logger = new Logger(SecurityScannerService.name);

  private readonly vulnerabilityPatterns = [
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

  constructor(
    @InjectRepository(SecurityFinding)
    private readonly findingRepository: Repository<SecurityFinding>,
  ) {}

  async scanFiles(repoName: string, prNumber: number, files: { path: string; content: string }[]): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      if (!file.content) continue;

      for (const pattern of this.vulnerabilityPatterns) {
        let match;
        pattern.pattern.lastIndex = 0;
        
        while ((match = pattern.pattern.exec(file.content)) !== null) {
          const lineOffset = file.content.substring(0, match.index).split('\n').length;
          
          const finding = this.findingRepository.create({
            prNumber,
            repository: repoName,
            findingType: 'vulnerability',
            severity: pattern.severity,
            title: pattern.name,
            description: pattern.description,
            filePath: file.path,
            lineNumber: lineOffset,
          });
          findings.push(finding);
        }
      }
    }

    if (findings.length > 0) {
      await this.findingRepository.save(findings);
      this.logger.log(`Found ${findings.length} security issues in PR #${prNumber}`);
    }

    return findings;
  }
}
