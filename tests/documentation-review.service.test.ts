import { describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import * as path from 'path';
import { DocumentationReviewService } from '../packages/backend/src/modules/review/services/documentation-review.service.js';

describe('DocumentationReviewService', () => {
  const service = new DocumentationReviewService();

  it('flags broken markdown structure and missing README sections', async () => {
    const findings = await service.analyzeChangedFiles(
      [
        {
          path: 'README.md',
          content: [
            '# Review Agent',
            '',
            'Intro singkat.',
            '',
            '### Langsung Lompat',
            '',
            '## Usage',
            '',
            '## Configuration',
          ].join('\n'),
        },
      ],
      process.cwd(),
    );

    expect(findings.some((finding) => finding.message.includes('melompat dari H1 ke H3'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('Section "Langsung Lompat" masih kosong'))).toBe(true);
    expect(findings.some((finding) => finding.message.includes('bagian setup/installasi'))).toBe(true);
  });

  it('flags broken relative links and unclosed code fences', async () => {
    const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-review-'));

    try {
      await fs.ensureDir(path.join(repoDir, 'docs'));
      await fs.writeFile(path.join(repoDir, 'docs', 'guide.md'), '# Guide\n');

      const findings = await service.analyzeChangedFiles(
        [
          {
            path: 'docs/API.md',
            content: [
              '# API',
              '',
              '[Guide](./guide.md)',
              '[Missing](./missing.md)',
              '',
              '```bash',
              'yarn start',
            ].join('\n'),
          },
        ],
        repoDir,
      );

      expect(findings.some((finding) => finding.message.includes('tidak mengarah ke file yang ada'))).toBe(true);
      expect(findings.some((finding) => finding.message.includes('Code fence Markdown belum ditutup'))).toBe(true);
      expect(findings.every((finding) => !finding.message.includes('"./guide.md" tidak mengarah'))).toBe(true);
    } finally {
      await fs.remove(repoDir);
    }
  });
});
