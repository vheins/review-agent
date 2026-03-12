import { dbManager } from './database.js';
import { logger } from './logger.js';

export class SensitiveDataHandler {
  constructor() {
    this.piiPatterns = [
      { id: 'email', name: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
      { id: 'phone', name: 'Phone Number', pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
      { id: 'credit_card', name: 'Credit Card Number', pattern: /\b(?:\d[ -]*?){13,16}\b/g },
      { id: 'ssn', name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g }
    ];
  }

  async detectSensitiveData(prId, changedFiles = []) {
    if (!dbManager.isAvailable()) return [];

    const findings = [];

    for (const file of changedFiles) {
      if (!file.content) continue;

      for (const p of this.piiPatterns) {
        let match;
        p.pattern.lastIndex = 0;
        
        while ((match = p.pattern.exec(file.content)) !== null) {
          const lineOffset = file.content.substring(0, match.index).split('\n').length;
          
          findings.push({
            pr_id: prId,
            finding_type: 'sensitive_data',
            severity: 'high',
            title: `Potential PII: ${p.name}`,
            description: `Potential personally identifiable information (${p.name}) detected.`,
            file_path: file.path,
            line_number: lineOffset,
            detected_at: new Date().toISOString()
          });
        }
      }

      // High entropy strings (potential secrets)
      const words = file.content.split(/[\s"']+/);
      for (const word of words) {
        if (word.length > 20 && this.calculateEntropy(word) > 4.5) {
          // Check if it's likely a random string and not just a long word
          if (/^[a-zA-Z0-9+/=_-]+$/.test(word)) {
            findings.push({
              pr_id: prId,
              finding_type: 'sensitive_data',
              severity: 'critical',
              title: 'High Entropy String',
              description: 'Potential secret or key detected based on high character entropy.',
              file_path: file.path,
              detected_at: new Date().toISOString()
            });
          }
        }
      }
    }

    // Store findings
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
            f.description, f.file_path, f.line_number || null, f.detected_at
          );
        }
      })();
    }

    return findings;
  }

  calculateEntropy(str) {
    const len = str.length;
    if (len === 0) return 0;
    
    const freq = {};
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

  redact(text) {
    let redacted = text;
    for (const p of this.piiPatterns) {
      redacted = redacted.replace(p.pattern, '[REDACTED]');
    }
    return redacted;
  }
}

export const sensitiveDataHandler = new SensitiveDataHandler();
export default sensitiveDataHandler;
