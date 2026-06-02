import { describe, expect, it } from 'vitest';
import fs from 'fs';
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
    expect(prompt).toContain('## COMPACT FSM');
    expect(prompt).toContain('STATE `S0_INIT`');
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

    expect(prompt).toContain('MUST NOT approve while active actionable thread exists.');
    expect(prompt).toContain('New inline finding of any severity => `REQUEST_CHANGES`.');
    expect(prompt).toContain('If any inline comment is created/planned, `DECISION` MUST be `REQUEST_CHANGES`.');
    expect(prompt).toContain('`APPROVE` is valid only if score is 0, no new inline comment, and all active threads are clear.');
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

    expect(prompt).toContain('STATE `S1_LOAD_STANDARDS`');
    expect(prompt).toContain('MUST run `standard-search` query `"pull-request-review"` before reviewing.');
    expect(prompt).toContain('`MCP_STANDARD: not found; review used agents.md and verified codebase patterns.`');
    expect(prompt).toContain('MUST deduplicate findings by root cause, not by file.');
    expect(prompt).toContain('For each root cause, MUST trace all related reader, writer, validator, event/model hook, service/action, form schema, migration, and test.');
    expect(prompt).toContain('MUST group changes by domain/invariant, not by diff hunk.');
    expect(prompt).toContain('MUST NOT repeat or contradict active comments on the same root cause.');
  });

  it('requires cross-domain invariant review before suggesting fixes', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 380,
        title: 'Enhance vendor dashboard and improve UI layouts and usability',
        repository: { nameWithOwner: 'idsolutions-id/eprocurement-dashboard' },
        headSha: 'jkl012',
      },
      ['app/Models/AssessmentBiddingDetail.php', 'app/Models/Requirement.php'],
    );

    expect(prompt).toContain('STATE `S5_AUDIT`');
    expect(prompt).toContain('Lifecycle coverage: create, update, delete, restore, bulk action, import/seed, submit form, model event, service method, and UI display.');
    expect(prompt).toContain('Scoring/weight must use one canonical aggregator.');
    expect(prompt).toContain('Concurrency guard for cross-record or aggregate invariants must use an outer transaction/unit-of-work boundary that persists the main mutation before releasing the lock.');
    expect(prompt).toContain('UI/schema security hardening must be backed by server-side guard and regression test.');
    expect(prompt).toContain('Derived score/status/count/locale/session must be recomputed from server-side source of truth');
  });

  it('requires selective local skill invocation for deep PR review', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 380,
        title: 'Enhance vendor dashboard and improve UI layouts and usability',
        repository: { nameWithOwner: 'idsolutions-id/eprocurement-dashboard' },
        headSha: 'mno345',
      },
      ['app/Models/Requirement.php', 'app/Models/RequirementOption.php'],
    );

    expect(prompt).toContain('STATE `S2_INVOKE_SKILLS`');
    expect(prompt).toContain('Use skill `senior-code-review` for non-trivial PRs.');
    expect(prompt).toContain('Use skill `root-cause-analysis` if there are old review comments, repeated fixes, bugs across files');
    expect(prompt).toContain('Use skill `race-condition-detection` if there is transaction, lock, model event');
    expect(prompt).toContain('Use skill `data-corruption-investigation` if PR touches migration, derived score/status/count');
    expect(prompt).toContain('Use skill `regression-test-suite-design` if there is bug fix, security/data-integrity/concurrency finding');
    expect(prompt).toContain('`SKILL_CONTEXT: <skill-name> unavailable; review used prompt rules and verified codebase patterns.`');
  });

  it('forces PRs with more than 50 conversations into direct-fix-only mode', () => {
    const executor = new TestExecutor();
    const prompt = executor.build(
      {
        number: 379,
        title: 'fix: converge repeated review comments',
        repository: { nameWithOwner: 'idsolutions-id/eprocurement-dashboard' },
        headSha: 'pqr678',
      },
      ['app/Filament/Resources/RequirementResource.php'],
    );

    expect(prompt).toContain('GLOBAL OVERRIDE `CONVERSATION_OVERLOAD_DIRECT_FIX`');
    expect(prompt).toContain('IF Conversation count > 50, THEN set local mode `direct-fix-only` regardless of `Takeover mode`.');
    expect(prompt).toContain('MUST determine Conversation count from the GitHub PR Conversation tab or GraphQL `timelineItems.totalCount`.');
    expect(prompt).toContain('IF `LOCAL_MODE=direct-fix-only`, MUST NOT write findings; fix the root cause directly instead.');
    expect(prompt).toContain('If `LOCAL_MODE=direct-fix-only`, MUST NOT create a pending review or submit `REQUEST_CHANGES`; commit/push fixes and approve/merge when clear.');
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

    expect(prompt).toContain('File source must not exceed 500 lines.');
    expect(prompt).toContain('If PR touches a source file with total length >500 lines, MUST add a review comment requiring refactor.');
    expect(prompt).toContain('must be split to be more SOLID and DRY');
    expect(prompt).toContain('This is a maintainability blocker, minimum severity `MEDIUM`.');
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

    expect(prompt).toContain('MUST use `gh` CLI for review write actions.');
    expect(prompt).toContain('If already approved on current HEAD, open, mergeable, checks pass, and no blocker remains, merge directly without duplicate approval.');
    expect(prompt).toContain('MUST use merge commit, not squash or rebase.');
    expect(prompt).toContain('If PR is approved and mergeable, work is not done until merge succeeds or a concrete merge blocker is reported.');
    expect(prompt).toContain('gh api repos/idsolutions-id/field-operation-qc-web/pulls/102/reviews -f body=\"\"');
  });

  it('keeps the fix prompt in compact FSM form with branch-safe commit and push rules', () => {
    const prompt = fs.readFileSync('context/fix-prompt.md', 'utf8');

    expect(prompt).toContain('## COMPACT FSM');
    expect(prompt).toContain('STATE `F0_INIT`');
    expect(prompt).toContain('MUST work only on branch `{{pr.headRefName}}`.');
    expect(prompt).toContain('MUST NOT push to `main`, `master`, `development`, or any branch other than `{{pr.headRefName}}`.');
    expect(prompt).toContain('STATE `F4_DEDUP_AND_PRIORITIZE`');
    expect(prompt).toContain('MUST deduplicate reviewer comments by `(path, line, root cause)`.');
    expect(prompt).toContain('STATE `F7_COMMIT_AND_PUSH`');
    expect(prompt).toContain('git push origin {{pr.headRefName}}');
    expect(prompt).toContain('STATUS: <Done|Blocked|Failed>');
  });
});
