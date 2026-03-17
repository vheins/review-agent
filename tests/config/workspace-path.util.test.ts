import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveWorkspaceDir } from '../../packages/backend/src/config/workspace-path.util.js';

describe('resolveWorkspaceDir', () => {
  const originalWorkspaceDir = process.env.WORKSPACE_DIR;

  afterEach(() => {
    if (originalWorkspaceDir === undefined) {
      delete process.env.WORKSPACE_DIR;
      return;
    }

    process.env.WORKSPACE_DIR = originalWorkspaceDir;
  });

  it('defaults to the monorepo root workspace directory', () => {
    delete process.env.WORKSPACE_DIR;

    expect(resolveWorkspaceDir()).toBe(path.resolve(process.cwd(), 'workspace'));
  });

  it('prefers WORKSPACE_DIR when provided', () => {
    process.env.WORKSPACE_DIR = '/tmp/custom-workspace';

    expect(resolveWorkspaceDir()).toBe('/tmp/custom-workspace');
  });
});
