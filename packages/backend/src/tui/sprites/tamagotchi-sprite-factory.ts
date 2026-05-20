import { PixelBitmap, PixelSpriteBitmapSet, PixelSpriteTemplate, SpriteMood } from './types.js';

function normalizeBitmap(rows: readonly string[]): PixelBitmap {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => row.padEnd(width, '.'));
}

export function bitmap(rows: readonly string[]): PixelBitmap {
  return normalizeBitmap(rows);
}

function clone(bitmapRows: PixelBitmap): string[] {
  return [...bitmapRows];
}

function padBitmap(bitmapRows: PixelBitmap, horizontal = 0, vertical = 0): PixelBitmap {
  const width = (bitmapRows[0]?.length ?? 0) + horizontal * 2;
  const emptyRow = '.'.repeat(width);
  const rows = bitmapRows.map((row) => `${'.'.repeat(horizontal)}${row}${'.'.repeat(horizontal)}`);
  return [
    ...Array.from({ length: vertical }, () => emptyRow),
    ...rows,
    ...Array.from({ length: vertical }, () => emptyRow),
  ];
}

function toMatrix(bitmapRows: PixelBitmap): string[][] {
  return bitmapRows.map((row) => row.split(''));
}

function fromMatrix(matrix: string[][]): PixelBitmap {
  return matrix.map((row) => row.join(''));
}

function findBounds(bitmapRows: PixelBitmap): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.MAX_SAFE_INTEGER;
  let maxX = -1;
  let minY = Number.MAX_SAFE_INTEGER;
  let maxY = -1;

  for (let y = 0; y < bitmapRows.length; y++) {
    const row = bitmapRows[y]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  return { minX, maxX, minY, maxY };
}

function setPixel(matrix: string[][], x: number, y: number, value: string): void {
  if (y < 0 || y >= matrix.length) return;
  if (x < 0 || x >= matrix[y]!.length) return;
  matrix[y]![x] = value;
}

function withSleepBubble(base: PixelBitmap, frame = 0): PixelBitmap {
  const rows = clone(base);
  if (rows.length > 0) {
    const bubbleX = Math.max(0, rows[0]!.length - 2 - (frame % 3));
    const bubbleChar = (['z', 'Z', 'z', '*'] as const)[frame % 4]!;
    rows[0] = rows[0]!.split('').map((cell, idx) => idx === bubbleX ? bubbleChar : cell).join('');
  }
  return rows;
}

function ensureTwinEyes(base: PixelBitmap): PixelBitmap {
  const bounds = findBounds(base);
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;

  if (width < 5 || height < 4) {
    return base;
  }

  const matrix = toMatrix(base);
  const centerX = Math.floor((bounds.minX + bounds.maxX) / 2);
  const eyeY = Math.min(bounds.maxY - 2, Math.max(bounds.minY + 2, bounds.minY + Math.floor(height / 3)));
  const eyeOffset = width >= 8 ? 2 : 1;
  const leftEyeX = Math.max(bounds.minX + 1, centerX - eyeOffset);
  const rightEyeX = Math.min(bounds.maxX - 1, centerX + eyeOffset);

  setPixel(matrix, leftEyeX, eyeY, '.');
  setPixel(matrix, rightEyeX, eyeY, '.');

  return fromMatrix(matrix);
}

function withProcessingArms(base: PixelBitmap, frame: number): PixelBitmap {
  const padded = padBitmap(base, 2, 0);
  const bounds = findBounds(padded);
  const matrix = toMatrix(padded);
  const upperRow = Math.min(bounds.maxY, bounds.minY + 2);
  const lowerRow = Math.min(bounds.maxY, bounds.minY + 4);
  const leftX = Math.max(0, bounds.minX - 1);
  const rightX = Math.min(matrix[0]!.length - 1, bounds.maxX + 1);
  const outerLeftX = Math.max(0, bounds.minX - 2);
  const outerRightX = Math.min(matrix[0]!.length - 1, bounds.maxX + 2);

  if (frame === 0) {
    setPixel(matrix, leftX, upperRow, '#');
    setPixel(matrix, rightX, upperRow, '#');
  } else if (frame === 1) {
    setPixel(matrix, leftX, upperRow, '#');
    setPixel(matrix, rightX, upperRow, '#');
    setPixel(matrix, outerLeftX, lowerRow, '#');
    setPixel(matrix, outerRightX, lowerRow, '#');
  } else if (frame === 2) {
    setPixel(matrix, outerLeftX, lowerRow, '#');
    setPixel(matrix, outerRightX, lowerRow, '#');
  } else {
    setPixel(matrix, outerLeftX, upperRow, '#');
    setPixel(matrix, outerRightX, upperRow, '#');
    setPixel(matrix, leftX, lowerRow, '#');
    setPixel(matrix, rightX, lowerRow, '#');
  }

  setPixel(matrix, Math.max(0, bounds.minX - 1 + (frame % 2)), 0, '*');
  return fromMatrix(matrix);
}

function withHappy(base: PixelBitmap, frame = 0): PixelBitmap {
  const padded = padBitmap(base, 1, 1);
  const bounds = findBounds(padded);
  const matrix = toMatrix(padded);
  const leftSparkX = Math.max(0, bounds.minX - 1 + (frame % 2));
  const rightSparkX = Math.min(matrix[0]!.length - 1, bounds.maxX + 1 - (frame % 2));
  const sparkY = Math.max(0, bounds.minY + (frame % 2));
  const cheerY = Math.min(bounds.maxY, bounds.minY + 2);

  setPixel(matrix, leftSparkX, sparkY, '*');
  setPixel(matrix, rightSparkX, sparkY, '*');
  setPixel(matrix, Math.max(0, bounds.minX - 1), cheerY, '#');
  setPixel(matrix, Math.min(matrix[0]!.length - 1, bounds.maxX + 1), cheerY, '#');

  return fromMatrix(matrix);
}

function withFailed(base: PixelBitmap, frame = 0): PixelBitmap {
  const padded = padBitmap(base, 1, 1);
  const bounds = findBounds(padded);
  const matrix = toMatrix(padded);
  const leftAlertX = Math.max(0, bounds.minX - 1);
  const rightAlertX = Math.min(matrix[0]!.length - 1, bounds.maxX + 1);
  const alertY = Math.max(0, bounds.minY + 1 + (frame % 2));
  const slumpY = Math.min(bounds.maxY, bounds.maxY - 1);

  setPixel(matrix, leftAlertX, alertY, '*');
  setPixel(matrix, rightAlertX, alertY, '*');
  if (frame % 2 === 0) {
    setPixel(matrix, Math.max(0, bounds.minX - 1), slumpY, '#');
  } else {
    setPixel(matrix, Math.min(matrix[0]!.length - 1, bounds.maxX + 1), slumpY, '#');
  }

  return fromMatrix(matrix);
}

export function createBitmapSet(base: PixelBitmap, variants?: Partial<Record<SpriteMood, readonly PixelBitmap[]>>): PixelSpriteBitmapSet {
  return {
    idle: variants?.idle ?? [base],
    sleeping: variants?.sleeping ?? [withSleepBubble(base, 0), withSleepBubble(base, 1), withSleepBubble(base, 2), withSleepBubble(base, 3)],
    processing: variants?.processing ?? [
      withProcessingArms(base, 0),
      withProcessingArms(base, 1),
      withProcessingArms(base, 2),
      withProcessingArms(base, 3),
    ],
    completed: variants?.completed ?? [withHappy(base, 0), withHappy(base, 1), withHappy(base, 2), withHappy(base, 3)],
    failed: variants?.failed ?? [withFailed(base, 0), withFailed(base, 1), withFailed(base, 2), withFailed(base, 3)],
  };
}

export function createBitmapSprite(
  displayName: string,
  slug: string,
  base: PixelBitmap,
  notes?: string,
  variants?: Partial<Record<SpriteMood, readonly PixelBitmap[]>>,
): PixelSpriteTemplate {
  const eyedBase = ensureTwinEyes(base);
  return {
    slug,
    displayName,
    family: 'tamagotchi',
    source: 'user-reference',
    notes,
    width: eyedBase[0]?.length ?? 0,
    height: eyedBase.length,
    bitmaps: createBitmapSet(eyedBase, variants),
  };
}

export function renderBitmap(bitmapRows: PixelBitmap, on = '██', off = '  '): string[] {
  return bitmapRows.map((row) =>
    row
      .split('')
      .map((cell) => {
        if (cell === '#') return on;
        if (cell === 'z' || cell === 'Z' || cell === '*') return `${cell} `;
        return off;
      })
      .join(''),
  );
}
