import { describe, expect, it } from 'vitest';
import {
  buildOpenCodeRunArgs,
  parseOpenCodeVersion,
} from '../packages/backend/src/modules/ai/executors/opencode.util.js';

describe('parseOpenCodeVersion', () => {
  it('detects v2 from "opencode v2.0.20"', () => {
    expect(parseOpenCodeVersion('opencode v2.0.20')).toBe('v2');
  });

  it('detects v1 from "1.4.3"', () => {
    expect(parseOpenCodeVersion('1.4.3')).toBe('v1');
  });

  it('falls back to v1 when no version is present', () => {
    expect(parseOpenCodeVersion('unknown')).toBe('v1');
  });
});

describe('buildOpenCodeRunArgs', () => {
  const base = {
    repoDir: '/tmp/repo',
    model: 'openai/gpt-5',
    agent: 'reviewer',
    variant: 'max',
    prompt: 'REVIEW',
  };

  it('builds v1 args with --dir, --variant and legacy permission flag', () => {
    expect(buildOpenCodeRunArgs({ ...base, version: 'v1' })).toEqual([
      'run',
      '--dir',
      '/tmp/repo',
      '--thinking',
      '--dangerously-skip-permissions',
      '--variant',
      'max',
      '--model',
      'openai/gpt-5',
      '--agent',
      'reviewer',
      'REVIEW',
    ]);
  });

  it('builds v2 args with --auto and model#variant', () => {
    expect(buildOpenCodeRunArgs({ ...base, version: 'v2' })).toEqual([
      'run',
      '--thinking',
      '--auto',
      '--model',
      'openai/gpt-5#max',
      '--agent',
      'reviewer',
      'REVIEW',
    ]);
  });

  it('omits model when auto and omits variant when unset (v2)', () => {
    expect(
      buildOpenCodeRunArgs({
        version: 'v2',
        repoDir: '/tmp/repo',
        model: 'auto',
        prompt: 'REVIEW',
      }),
    ).toEqual(['run', '--thinking', '--auto', 'REVIEW']);
  });
});
