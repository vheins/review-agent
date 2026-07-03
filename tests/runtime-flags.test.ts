import { afterEach, describe, expect, it } from 'vitest';
import { applyRuntimeFlags } from '../packages/backend/src/runtime/runtime-flags.js';

describe('applyRuntimeFlags', () => {
  const originalValue = process.env.DISCORD_SOUND_DISABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.DISCORD_SOUND_DISABLED;
      return;
    }

    process.env.DISCORD_SOUND_DISABLED = originalValue;
  });

  it('enables Discord sound suppression when --no-sound is present', () => {
    delete process.env.DISCORD_SOUND_DISABLED;

    const flags = applyRuntimeFlags(['--no-sound']);

    expect(flags.noSound).toBe(true);
    expect(process.env.DISCORD_SOUND_DISABLED).toBe('true');
  });

  it('leaves Discord sound suppression unchanged when flag is absent', () => {
    delete process.env.DISCORD_SOUND_DISABLED;

    const flags = applyRuntimeFlags([]);

    expect(flags.noSound).toBe(false);
    expect(process.env.DISCORD_SOUND_DISABLED).toBeUndefined();
  });
});
