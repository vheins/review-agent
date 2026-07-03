export type SpriteMood = 'idle' | 'sleeping' | 'processing' | 'completed' | 'failed';

export type PixelBitmap = readonly string[];

export interface PixelSpriteBitmapSet {
  idle: readonly PixelBitmap[];
  sleeping: readonly PixelBitmap[];
  processing: readonly PixelBitmap[];
  completed: readonly PixelBitmap[];
  failed: readonly PixelBitmap[];
}

export interface PixelSpriteTemplate {
  slug: string;
  displayName: string;
  family: 'tamagotchi';
  source: 'user-reference';
  notes?: string;
  width: number;
  height: number;
  bitmaps: PixelSpriteBitmapSet;
}
