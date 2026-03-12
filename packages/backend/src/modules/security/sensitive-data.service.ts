import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

@Injectable()
export class SensitiveDataService {
  private readonly logger = new Logger(SensitiveDataService.name);
  private readonly piiPatterns = [
    { id: 'email', name: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { id: 'phone', name: 'Phone Number', pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
    { id: 'credit_card', name: 'Credit Card Number', pattern: /\b(?:\d[ -]*?){13,16}\b/g },
    { id: 'ssn', name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g }
  ];

  constructor(
    @InjectRepository(SecurityFinding)
    private readonly securityRepository: Repository<SecurityFinding>,
  ) {}

  async detectSensitiveData(repository: string, prNumber: number, changedFiles: { path: string, content: string }[] = []): Promise<SecurityFinding[]> {
    const findings: any[] = [];

    for (const file of changedFiles) {
      if (!file.content) continue;

      for (const p of this.piiPatterns) {
        let match: RegExpExecArray | null;
        p.pattern.lastIndex = 0;
        
        while ((match = p.pattern.exec(file.content)) !== null) {
          const lineOffset = file.content.substring(0, match.index).split('\n').length;
          
          findings.push({
            prNumber,
            repository,
            finding_type: 'sensitive_data',
            severity: 'high',
            title: `Potential PII: ${p.name}`,
            description: `Potential personally identifiable information (${p.name}) detected.`,
            file_path: file.path,
            line_number: lineOffset,
            is_resolved: false,
            detectedAt: new Date()
          });
        }
      }

      // High entropy strings (potential secrets)
      const words = file.content.split(/[\s"']+/);
      for (const word of words) {
        if (word.length > 20 && this.calculateEntropy(word) > 4.5) {
          if (/^[a-zA-Z0-9+/=_-]+$/.test(word)) {
            findings.push({
              prNumber,
              repository,
              finding_type: 'sensitive_data',
              severity: 'critical',
              title: 'High Entropy String',
              description: 'Potential secret or key detected based on high character entropy.',
              file_path: file.path,
              is_resolved: false,
              detectedAt: new Date()
            });
          }
        }
      }
    }

    if (findings.length > 0) {
      return await this.securityRepository.save(findings);
    }

    return [];
  }

  calculateEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;
    
    const freq: Record<string, number> = {};
    for (let i = 0; i < len; i++) {
      const char = str[i];
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  redact(text: string): string {
    let redacted = text;
    for (const p of this.piiPatterns) {
      redacted = redacted.replace(p.pattern, '[REDACTED]');
    }
    return redacted;
  }
}
