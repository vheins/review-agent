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
  it('renders the review prompt for the target PR', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 106,
        title: 'feat: dashboard improvements',
        repository: { nameWithOwner: 'idsolutions-id/human-resource-dashboard' },
        headSha: 'abc123',
        headRefName: 'feature/working-story',
        baseRefName: 'main',
      },
      ['backend/cmd/api/main.go'],
    );

    expect(prompt).toContain('Repository: idsolutions-id/human-resource-dashboard');
    expect(prompt).toContain('Pull Request: #106 feat: dashboard improvements');
    expect(prompt).toContain('commit_id="abc123"');
    expect(prompt).not.toContain('{{repository}}');
    expect(prompt).not.toContain('{{pr.number}}');
  });

  it('guards against approving when inline comments or active actionable threads exist', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 106,
        title: 'feat: dashboard improvements',
        repository: { nameWithOwner: 'idsolutions-id/field-operation-qc-web' },
        headSha: 'abc123',
      },
      ['src/modules/dashboard/pages/index.vue'],
    );

    expect(prompt).toContain('Jika ada komentar inline baru, review tidak boleh berakhir sebagai `APPROVE`.');
    expect(prompt).toContain('Ada thread aktif yang unresolved + not outdated dan actionable');
    expect(prompt).toContain('Jika kamu sudah membuat atau berencana membuat inline comment, `DECISION` harus `REQUEST_CHANGES`.');
    expect(prompt).toContain('`DECISION: APPROVE` hanya valid jika body review tidak memuat temuan dan tidak ada komentar inline baru.');
  });

  it('requires the CLI agent to merge an already approved open PR without backend/script fallback', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 102,
        title: 'Fix/gh 49 project list info',
        repository: { nameWithOwner: 'idsolutions-id/field-operation-qc-web' },
        headSha: '5d096983d3c790395440a10e682129ce3044d242',
      },
      ['src/modules/dashboard/pages/index.vue'],
    );

    expect(prompt).toContain('PR SUDAH LULUS. Jangan submit `APPROVE` ulang. Langsung merge dengan merge commit.');
    expect(prompt).toContain('Jika PR sudah `APPROVED` sebelum review ini berjalan, jangan kirim approval duplikat.');
    expect(prompt).toContain('Semua aksi di poin ini HARUS kamu jalankan sendiri via `gh` CLI di dalam sesi agent.');
    expect(prompt).toContain('Jangan mengandalkan runtime, service backend, script auto-merge, cron, webhook, atau fallback lain');
    expect(prompt).toContain('gh pr merge 102 --repo idsolutions-id/field-operation-qc-web --merge --delete-branch');
  });
});
