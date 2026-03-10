import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { DatabaseManager, dbManager } from '../src/database.js';
import { WorkflowOrchestrator } from '../src/workflow-orchestrator.js';
import { WebhookHandler } from '../src/webhook-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integration Workflow', () => {
  const testDbDir = path.join(__dirname, '..', 'data', 'test-integration');
  const testDbPath = path.join(testDbDir, 'test-integration.db');

  let testDbManager;

  beforeEach(async () => {
    await fs.ensureDir(testDbDir);
    testDbManager = new DatabaseManager(testDbPath);
    await testDbManager.initialize();
    dbManager.db = testDbManager.db;

    testDbManager.db.prepare(`
      INSERT OR IGNORE INTO developers (id, github_username, display_name, role, created_at, updated_at)
      VALUES
        (1, 'author', 'Author', 'developer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (2, 'reviewer', 'Reviewer', 'lead', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
  });

  afterEach(async () => {
    testDbManager.close();
    dbManager.db = null;
    vi.restoreAllMocks();
    if (await fs.pathExists(testDbDir)) {
      await fs.remove(testDbDir);
    }
  });

  function makePayload() {
    return {
      action: 'opened',
      repository: {
        full_name: 'acme/platform',
        name: 'platform',
        owner: { login: 'acme' }
      },
      pull_request: {
        number: 42,
        title: 'Improve review lifecycle',
        body: 'PR body',
        state: 'open',
        created_at: '2026-03-10T00:00:00.000Z',
        updated_at: '2026-03-10T00:05:00.000Z',
        head: { ref: 'feature/review-lifecycle' },
        base: { ref: 'main' },
        user: { login: 'author' }
      }
    };
  }

  it('processes a PR from tests to merge', async () => {
    const githubClient = {
      prepareRepository: vi.fn().mockResolvedValue('/tmp/repo'),
      assignReviewers: vi.fn().mockResolvedValue(true),
      mergePR: vi.fn().mockResolvedValue(true)
    };
    const testAndHealService = {
      runTests: vi.fn().mockResolvedValue({ status: 'passed' })
    };
    const assignmentEngine = {
      assignReviewers: vi.fn().mockResolvedValue([2])
    };
    const reviewEngine = {
      getChangedFiles: vi.fn().mockResolvedValue([{ path: 'src/app.js' }]),
      reviewPR: vi.fn().mockResolvedValue({ reviewSessionId: 11, outcome: 'approved' })
    };
    const autoFixService = {
      fixPR: vi.fn()
    };
    const autoMergeService = {
      mergeIfEligible: vi.fn().mockResolvedValue({ status: 'merged', merged: true, reasons: [] })
    };
    const escalationService = {
      escalate: vi.fn().mockResolvedValue(undefined)
    };
    const wsManager = {
      broadcast: vi.fn()
    };

    const orchestrator = new WorkflowOrchestrator({
      dbManager,
      githubClient,
      testAndHealService,
      assignmentEngine,
      reviewEngine,
      autoFixService,
      autoMergeService,
      escalationService,
      wsManager,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    const result = await orchestrator.processPullRequest(makePayload());

    expect(result.status).toBe('merged');
    expect(testAndHealService.runTests).toHaveBeenCalled();
    expect(assignmentEngine.assignReviewers).toHaveBeenCalled();
    expect(reviewEngine.reviewPR).toHaveBeenCalled();
    expect(autoMergeService.mergeIfEligible).toHaveBeenCalled();
    expect(wsManager.broadcast).toHaveBeenCalledWith('pr_update', expect.objectContaining({ stage: 'merged' }));
  });

  it('re-reviews a PR after successful auto-fix', async () => {
    const orchestrator = new WorkflowOrchestrator({
      dbManager,
      githubClient: {
        prepareRepository: vi.fn().mockResolvedValue('/tmp/repo'),
        assignReviewers: vi.fn().mockResolvedValue(true),
        mergePR: vi.fn().mockResolvedValue(true)
      },
      testAndHealService: {
        runTests: vi.fn().mockResolvedValue({ status: 'passed' })
      },
      assignmentEngine: {
        assignReviewers: vi.fn().mockResolvedValue([2])
      },
      reviewEngine: {
        getChangedFiles: vi.fn().mockResolvedValue([{ path: 'src/app.js' }]),
        reviewPR: vi.fn().mockResolvedValue({ reviewSessionId: 21, outcome: 'needs_changes' }),
        reReview: vi.fn().mockResolvedValue({ reviewSessionId: 22, outcome: 'approved' })
      },
      autoFixService: {
        fixPR: vi.fn().mockResolvedValue({ status: 'success', attempt: 1 })
      },
      autoMergeService: {
        mergeIfEligible: vi.fn().mockResolvedValue({ status: 'merged', merged: true, reasons: [] })
      },
      escalationService: {
        escalate: vi.fn().mockResolvedValue(undefined)
      },
      wsManager: {
        broadcast: vi.fn()
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    const result = await orchestrator.processPullRequest(makePayload());

    expect(result.status).toBe('merged');
    expect(orchestrator.autoFixService.fixPR).toHaveBeenCalled();
    expect(orchestrator.reviewEngine.reReview).toHaveBeenCalled();
  });

  it('escalates when tests fail before review', async () => {
    const escalationService = {
      escalate: vi.fn().mockResolvedValue(undefined)
    };
    const reviewEngine = {
      getChangedFiles: vi.fn(),
      reviewPR: vi.fn()
    };

    const orchestrator = new WorkflowOrchestrator({
      dbManager,
      githubClient: {
        prepareRepository: vi.fn().mockResolvedValue('/tmp/repo'),
        assignReviewers: vi.fn().mockResolvedValue(true)
      },
      testAndHealService: {
        runTests: vi.fn().mockResolvedValue({ status: 'failed', healResult: null })
      },
      assignmentEngine: {
        assignReviewers: vi.fn()
      },
      reviewEngine,
      autoFixService: {
        fixPR: vi.fn()
      },
      autoMergeService: {
        mergeIfEligible: vi.fn()
      },
      escalationService,
      wsManager: {
        broadcast: vi.fn()
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    const result = await orchestrator.processPullRequest(makePayload());

    expect(result.status).toBe('tests_failed');
    expect(escalationService.escalate).toHaveBeenCalledWith(expect.any(Number), 'pull_request', 'Tests failed before review', 'high');
    expect(reviewEngine.reviewPR).not.toHaveBeenCalled();
  });

  it('webhook handler delegates opened PR events to the orchestrator', async () => {
    const processPullRequest = vi.fn().mockResolvedValue({ status: 'merged' });
    const handler = new WebhookHandler('secret', {
      workflowOrchestrator: { processPullRequest }
    });
    const payload = makePayload();

    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', 'secret');
    const signature = `sha256=${hmac.update(payloadString).digest('hex')}`;

    expect(handler.verifySignature(payloadString, signature)).toBe(true);

    await handler.handleEvent('pull_request', payload);

    expect(processPullRequest).toHaveBeenCalledWith(payload);
  });
});
