import { describe, expect, it } from 'vitest';
import { bitmap, createBitmapSprite } from '../packages/backend/src/tui/sprites/tamagotchi-sprite-factory.js';

describe('tamagotchi sprite factory', () => {
  it('separates twin eyes with a center bridge for wide face cutouts', () => {
    const sprite = createBitmapSprite(
      'Test Sprite',
      'test-sprite',
      bitmap([
        '..####..',
        '.######.',
        '##....##',
        '##....##',
        '##....##',
        '.######.',
        '..####..',
        '........',
      ]),
    );

    expect(sprite.bitmaps.idle[0]?.[2]).toBe('#..#..##');
    expect(sprite.bitmaps.sleeping[0]?.[2]).toBe('#..#..##');
  });
});
