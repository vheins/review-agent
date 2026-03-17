import { describe, expect, it } from 'vitest';
import { BaseAiExecutor } from '../packages/backend/src/modules/ai/executors/index.js';

class TestExecutor extends BaseAiExecutor {
  constructor() {
    super('test');
  }

  async review(): Promise<string> {
    return '';
  }

  build(pr: any, changedFiles: string[]): string {
    return this.buildReviewPrompt(pr, changedFiles);
  }
}

describe('BaseAiExecutor prompt builder', () => {
  it('includes changed file paths without embedding diff content', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        title: 'feat: Implement working story employee integration and management',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headRefName: 'feature/working-story',
        baseRefName: 'main',
      },
      ['backend/cmd/api/main.go'],
    );

    expect(prompt).toContain('Review the following Pull Request:');
    expect(prompt).toContain('Changed File Paths:');
    expect(prompt).toContain('- backend/cmd/api/main.go');
    expect(prompt).not.toContain('Diff:');
    expect(prompt).not.toContain('diff --git');
    expect(prompt).not.toContain('index 4e878ae..4456d15');
  });
});
