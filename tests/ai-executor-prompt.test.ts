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
    expect(prompt).toContain('gh pr view 106 --repo idsolutions-id/human-resource-dashboard --json state,isDraft,reviewDecision,mergeStateStatus,mergeable,headRefOid,statusCheckRollup,autoMergeRequest');
    expect(prompt).toContain('Dry run: false');
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

    expect(prompt).toContain('Jika masih ada thread aktif actionable, PR tidak boleh `APPROVE`.');
    expect(prompt).toContain('Ada temuan inline baru dengan severity apa pun → `REQUEST_CHANGES`');
    expect(prompt).toContain('kalau kamu membuat atau berencana membuat inline comment, `DECISION` harus `REQUEST_CHANGES`');
    expect(prompt).toContain('`APPROVE` hanya valid jika score 0, tidak ada komentar inline baru, dan semua thread aktif sudah clear');
  });

  it('requires MCP standards before PR review and deduplicates findings', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 109,
        title: 'feat: apply review policy',
        repository: { nameWithOwner: 'idsolutions-id/review-agent' },
        headSha: 'def456',
      },
      ['packages/backend/src/modules/review/review-engine.service.ts'],
    );

    expect(prompt).toContain('Ambil standard repo/team dari MCP yang relevan.');
    expect(prompt).toContain('Review harus berbasis standard MCP yang berhasil dibaca + pattern codebase yang benar-benar kamu lihat.');
    expect(prompt).toContain('Jika standard MCP tidak ada, tulis di `MESSAGE`: `MCP_STANDARD: tidak ditemukan; review memakai agents.md dan pattern codebase yang sudah diverifikasi.`');
    expect(prompt).toContain('Deduplicate temuan berdasarkan root cause.');
    expect(prompt).toContain('Jika thread aktif yang sama sudah ada dan masih relevan, jangan buat komentar duplikat.');
  });

  it('requires a mandatory refactor finding for source files larger than 500 lines', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 110,
        title: 'refactor: extend review policy',
        repository: { nameWithOwner: 'idsolutions-id/review-agent' },
        headSha: 'ghi789',
      },
      ['packages/backend/src/modules/review/review-engine.service.ts'],
    );

    expect(prompt).toContain('File source tidak boleh lebih dari 500 baris kode.');
    expect(prompt).toContain('Jika PR menyentuh file source yang totalnya >500 baris, WAJIB beri komentar review yang meminta refactor.');
    expect(prompt).toContain('perlu dipecah agar lebih SOLID dan DRY');
    expect(prompt).toContain('Ini blocker maintainability dan minimal severity `MEDIUM`.');
  });

  it('requires the CLI agent to merge an already approved open PR without duplicate approval', () => {
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

    expect(prompt).toContain('Untuk write action review, gunakan `gh` CLI, bukan MCP GitHub write action.');
    expect(prompt).toContain('Jika PR sudah approved, masih open, mergeable, checks lulus, dan tidak ada blocker, langsung merge tanpa approval ulang');
    expect(prompt).toContain('Gunakan merge commit, bukan squash atau rebase.');
    expect(prompt).toContain('kalau PR sudah approved dan mergeable, kamu belum selesai sampai merge berhasil atau PR sudah merged');
    expect(prompt).toContain('gh api repos/idsolutions-id/field-operation-qc-web/pulls/102/reviews -f body=\"\"');
  });
});
