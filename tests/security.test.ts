import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityScannerService } from '../src/modules/security/security-scanner.service.js';

describe('SecurityScannerService', () => {
  let service: SecurityScannerService;
  let findingRepo: any;

  beforeEach(() => {
    findingRepo = {
      create: vi.fn().mockImplementation(val => val),
      save: vi.fn().mockResolvedValue(true),
    };
    service = new SecurityScannerService(findingRepo);
  });

  it('should detect SQL injection patterns', async () => {
    const files = [
      { path: 'test.js', content: 'db.query("SELECT * FROM users WHERE id = ${id}")' }
    ];
    const findings = await service.scanFiles('o/r', 1, files);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Potential SQL Injection');
  });

  it('should detect hardcoded secrets', async () => {
    const files = [
      { path: 'config.js', content: 'const api_key = "12345678901234567890"' }
    ];
    const findings = await service.scanFiles('o/r', 1, files);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Hardcoded Secret');
  });

  it('should detect XSS patterns', async () => {
    const files = [
      { path: 'app.jsx', content: '<div dangerouslySetInnerHTML={{ __html: content }} />' }
    ];
    const findings = await service.scanFiles('o/r', 1, files);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Potential XSS');
  });
});
