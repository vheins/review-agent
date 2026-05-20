# TUI Sprite Templates

Folder ini menyiapkan registry sprite pixel untuk avatar TUI.

Status saat ini:
- semua nama sprite dari referensi pengguna sudah diregistrasikan
- struktur sprite sudah dirombak ke model bitmap per karakter
- setiap sprite sekarang punya bitmap dasar sendiri dan siap dipanggil by-name atau random

File utama:
- `types.ts`: kontrak data sprite
- `tamagotchi-sprite-factory.ts`: helper bitmap, mood set, dan preview renderer
- `tamagotchi-sprite-registry.ts`: daftar semua template bitmap sprite
- `index.ts`: barrel export

Contoh pemakaian berikutnya:

```ts
import { getRandomTamagotchiSpriteTemplate, renderBitmap } from './sprites/index.js';

const sprite = getRandomTamagotchiSpriteTemplate();
console.log(sprite.displayName);
console.log(renderBitmap(sprite.bitmaps.idle[0]).join('\n'));
```
