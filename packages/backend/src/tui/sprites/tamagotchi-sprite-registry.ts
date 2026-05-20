import { bitmap, createBitmapSprite } from './tamagotchi-sprite-factory.js';
import { PixelSpriteTemplate } from './types.js';

const T_BOY = bitmap([
  '.##..##.',
  '.#....#.',
  '.######.',
  '##....##',
  '########',
  '##.##.##',
  '.##..##.',
  '..#..#..',
]);
const T_GIRL = bitmap([
  '..#..#..',
  '.##..##.',
  '.######.',
  '##....##',
  '########',
  '##.##.##',
  '.##..##.',
  '..#..#..',
]);
const ROUND = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '..####..',
  '........',
]);
const ROUND_EARS = bitmap([
  '.##..##.',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const ROUND_BUN = bitmap([
  '..#..#..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '..#..#..',
  '........',
]);
const MOHI_FUZZ = bitmap([
  '.#.#.#..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.#....#.',
  '........',
]);
const ROUND_DOTS = bitmap([
  '...##...',
  '.######.',
  '##.#..##',
  '##....##',
  '##.#..##',
  '.######.',
  '..#..#..',
  '........',
]);
const OBOTCHI_FACE = bitmap([
  '...##...',
  '.######.',
  '##....##',
  '##..#.##',
  '##....##',
  '.######.',
  '..####..',
  '........',
]);
const HIDATCHI_RING = bitmap([
  '..####..',
  '.######.',
  '##.#..##',
  '##....##',
  '##..#.##',
  '.######.',
  '..#..#..',
  '........',
]);
const BEAN = bitmap([
  '...###..',
  '.######.',
  '##....#.',
  '##.##.#.',
  '##....#.',
  '.######.',
  '..#..#..',
  '........',
]);
const BEAN_WING = bitmap([
  '...###..',
  '#######.',
  '##....##',
  '##.##..#',
  '##....##',
  '.######.',
  '........',
  '........',
]);
const BEAN_SEAL = bitmap([
  '...###..',
  '.######.',
  '##....#.',
  '##.##.#.',
  '#######.',
  '.######.',
  '...##...',
  '........',
]);
const SQUARE = bitmap([
  '...##...',
  '.######.',
  '.######.',
  '.##..##.',
  '.##..##.',
  '.######.',
  '..#..#..',
  '........',
]);
const SQUARE_CROWN = bitmap([
  '.#.#.#..',
  '.######.',
  '.#....#.',
  '.##..##.',
  '.##..##.',
  '.######.',
  '.##..##.',
  '........',
]);
const MASK = bitmap([
  '...##...',
  '.######.',
  '########',
  '##.##.##',
  '##....##',
  '########',
  '..#..#..',
  '........',
]);
const TRI_SPIKE = bitmap([
  '...##...',
  '..####..',
  '.######.',
  '###..###',
  '.######.',
  '..####..',
  '...##...',
  '........',
]);
const PIRO_NEEDLE = bitmap([
  '...##...',
  '..####..',
  '.######.',
  '########',
  '.######.',
  '..####..',
  '...##...',
  '..#..#..',
]);
const HINO_FLAME = bitmap([
  '....#...',
  '...###..',
  '..####..',
  '.######.',
  '###..###',
  '.######.',
  '..####..',
  '...##...',
]);
const GHOST = bitmap([
  '...##...',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '########',
  '#.#..#.#',
  '........',
]);
const BLOB = bitmap([
  '...##...',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const DARK_WIDE = bitmap([
  '.######.',
  '########',
  '########',
  '##.##.##',
  '##.##.##',
  '########',
  '.##..##.',
  '........',
]);
const ROBOT = bitmap([
  '...##...',
  '.######.',
  '##....##',
  '########',
  '##.##.##',
  '##....##',
  '.##..##.',
  '........',
]);
const ORB_LEAF = bitmap([
  '....#...',
  '...###..',
  '.######.',
  '##....##',
  '##.##.##',
  '.######.',
  '..#..#..',
  '........',
]);
const BUNBUN_RABBIT = bitmap([
  '.##..##.',
  '..####..',
  '.######.',
  '##....##',
  '##.##.##',
  '.######.',
  '..#..#..',
  '........',
]);
const TEKE_SEED = bitmap([
  '....#...',
  '...###..',
  '..####..',
  '.##..##.',
  '##....##',
  '.######.',
  '..#..#..',
  '........',
]);
const WIDE_BIRD = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '########',
  '#.##...#',
  '.######.',
  '..####..',
  '........',
]);
const HINA_CHICK = bitmap([
  '...##...',
  '.######.',
  '##....##',
  '####..##',
  '##....##',
  '.######.',
  '...##...',
  '........',
]);
const HIKO_FLAP = bitmap([
  '.##..##.',
  '########',
  '##....##',
  '####..##',
  '#.##...#',
  '.######.',
  '..####..',
  '........',
]);
const HORN_BLOCK = bitmap([
  '.##..##.',
  '.######.',
  '########',
  '##....##',
  '##.##.##',
  '########',
  '.##..##.',
  '........',
]);
const WARUSO_HORNS = bitmap([
  '.#.#.#..',
  '########',
  '########',
  '##....##',
  '##.##.##',
  '########',
  '.##..##.',
  '........',
]);
const TSUNO_TALL = bitmap([
  '.##..##.',
  '.#....#.',
  '########',
  '##....##',
  '##.##.##',
  '########',
  '.##..##.',
  '..#..#..',
]);
const TALL_MASK = bitmap([
  '...##...',
  '.######.',
  '.######.',
  '########',
  '##.##.##',
  '########',
  '########',
  '.##..##.',
]);
const DONUT = bitmap([
  '...##...',
  '.######.',
  '##....##',
  '##.##.##',
  '##.##.##',
  '##....##',
  '.######.',
  '........',
]);
const SEAL_LONG = bitmap([
  '..####..',
  '.######.',
  '##....#.',
  '########',
  '.######.',
  '..####..',
  '...##...',
  '........',
]);
const HASHIZOU_LONG = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '####..##',
  '.######.',
  '..####..',
  '..#..#..',
  '........',
]);
const GHOST_LONG = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '########',
  '#.#..#.#',
  '........',
]);
const PATA_WIDE = bitmap([
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '########',
  '#.#..#.#',
  '..#..#..',
  '........',
]);
const HOHO_BIRD = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '####..##',
  '##....##',
  '########',
  '#.#..#.#',
  '........',
]);
const CAT_BLOCK = bitmap([
  '.##..##.',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const ALIEN = bitmap([
  '...##...',
  '.######.',
  '########',
  '##.##.##',
  '########',
  '.######.',
  '..####..',
  '........',
]);
const NINJA = bitmap([
  '.##..##.',
  '########',
  '########',
  '##....##',
  '########',
  '.######.',
  '..#..#..',
  '........',
]);
const TINY_GHOST = bitmap([
  '...##...',
  '..####..',
  '.##..##.',
  '.##..##.',
  '.######.',
  '.#.#.#..',
  '........',
  '........',
]);
const DORO_SAD = bitmap([
  '...##...',
  '..####..',
  '.##..##.',
  '.##..##.',
  '.##..##.',
  '.######.',
  '..#..#..',
  '........',
]);
const POD = bitmap([
  '...##...',
  '..####..',
  '.######.',
  '.##..##.',
  '.#....#.',
  '.######.',
  '..####..',
  '........',
]);
const SQUAT = bitmap([
  '..####..',
  '.######.',
  '########',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const MAMETCHI_GLASSES = bitmap([
  '..#..#..',
  '.######.',
  '##.##.##',
  '##.##.##',
  '##....##',
  '.######.',
  '..#..#..',
  '...##...',
]);
const MIMITCHI_BUNNY = bitmap([
  '.##..##.',
  '.#....#.',
  '.######.',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const YOUNG_MIMI = bitmap([
  '.#....#.',
  '.##..##.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const CHOMA_TWIN = bitmap([
  '.##..##.',
  '.######.',
  '.#....#.',
  '##.##.##',
  '##....##',
  '.######.',
  '.#....#.',
  '........',
]);
const MIMIYORI_LONGEARS = bitmap([
  '.#....#.',
  '.#....#.',
  '.######.',
  '##.##.##',
  '##....##',
  '.######.',
  '.##..##.',
  '........',
]);
const MEME_FLOWER = bitmap([
  '.#.#.#..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '..####..',
  '...##...',
]);
const DEBA_SPIKE = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.#....#.',
  '..#..#..',
]);
const KURO_DARK = bitmap([
  '..####..',
  '.######.',
  '########',
  '########',
  '##.##.##',
  '########',
  '.##..##.',
  '..#..#..',
]);
const BILL_TOWER = bitmap([
  '...##...',
  '.######.',
  '########',
  '########',
  '##....##',
  '##.##.##',
  '########',
  '.######.',
]);
const BILL_NOSE = bitmap([
  '..####..',
  '.######.',
  '##....#.',
  '##.##.#.',
  '########',
  '.######.',
  '..#..#..',
  '........',
]);
const UFO = bitmap([
  '...##...',
  '.######.',
  '########',
  '##.##.##',
  '.######.',
  '########',
  '.##..##.',
  '........',
]);
const SIMPLE_CAT = bitmap([
  '.##..##.',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '.#....#.',
  '........',
]);
const SAMURAI = bitmap([
  '.#....#.',
  '.######.',
  '########',
  '##....##',
  '##.##.##',
  '########',
  '.######.',
  '..#..#..',
]);
const VISOR_BOT = bitmap([
  '...##...',
  '.######.',
  '########',
  '########',
  '##....##',
  '##.##.##',
  '.######.',
  '.##..##.',
]);
const CAMERA_FACE = bitmap([
  '...##...',
  '.######.',
  '########',
  '##....##',
  '########',
  '##.##.##',
  '.######.',
  '..####..',
]);
const SUMO = bitmap([
  '..####..',
  '.######.',
  '########',
  '##.##.##',
  '########',
  '.######.',
  '##....##',
  '........',
]);
const OTOKO_BRUISER = bitmap([
  '.######.',
  '########',
  '##....##',
  '##.##.##',
  '########',
  '.######.',
  '##....##',
  '..#..#..',
]);
const OLD_MAN = bitmap([
  '..####..',
  '.######.',
  '##....##',
  '##.##.##',
  '##....##',
  '.######.',
  '..####..',
  '..#..#..',
]);
const CUBIC_DROID = bitmap([
  '...##...',
  '.######.',
  '.#....#.',
  '.######.',
  '.##..##.',
  '.#....#.',
  '.######.',
  '..#..#..',
]);

export const TAMAGOTCHI_SPRITE_TEMPLATES: readonly PixelSpriteTemplate[] = [
  createBitmapSprite('Teletchi (boy)', 'teletchi-boy', T_BOY),
  createBitmapSprite('Teletchi (girl)', 'teletchi-girl', T_GIRL),
  createBitmapSprite('Mizutamatchi', 'mizutamatchi', BEAN),
  createBitmapSprite('Mohitamatchi', 'mohitamatchi', MOHI_FUZZ),
  createBitmapSprite('Tamatchi', 'tamatchi', ROUND),
  createBitmapSprite('Kutchitamatchi', 'kutchitamatchi', WIDE_BIRD),
  createBitmapSprite('Obotchi', 'obotchi', OBOTCHI_FACE),
  createBitmapSprite('Young Mametchi', 'young-mametchi', SQUARE_CROWN),
  createBitmapSprite('Nikatchi', 'nikatchi', MASK),
  createBitmapSprite('Hinatchi', 'hinatchi', HINA_CHICK),
  createBitmapSprite('Patapatatchi', 'patapatatchi', PATA_WIDE),
  createBitmapSprite('Young Mimitchi', 'young-mimitchi', YOUNG_MIMI),
  createBitmapSprite('Pirorirotchi', 'pirorirotchi', PIRO_NEEDLE),
  createBitmapSprite('Hinotamatchi', 'hinotamatchi', HINO_FLAME),
  createBitmapSprite('Hikotchi', 'hikotchi', HIKO_FLAP),
  createBitmapSprite('Hashitamatchi', 'hashitamatchi', BEAN_SEAL),
  createBitmapSprite('Mametchi', 'mametchi', MAMETCHI_GLASSES),
  createBitmapSprite('Memetchi', 'memetchi', MEME_FLOWER),
  createBitmapSprite('Kushipatchi', 'kushipatchi', DONUT),
  createBitmapSprite('Leafchi', 'leafchi', CAT_BLOCK),
  createBitmapSprite('Mimitchi', 'mimitchi', MIMITCHI_BUNNY),
  createBitmapSprite('Chomametchi', 'chomametchi', CHOMA_TWIN),
  createBitmapSprite('Tarakotchi', 'tarakotchi', SEAL_LONG),
  createBitmapSprite('Woltchi', 'woltchi', DARK_WIDE),
  createBitmapSprite('Hanatchi', 'hanatchi', TINY_GHOST),
  createBitmapSprite('Debatchi', 'debatchi', DEBA_SPIKE),
  createBitmapSprite('Masktchi', 'masktchi', NINJA),
  createBitmapSprite('Gozarutchi', 'gozarutchi', SAMURAI),
  createBitmapSprite('Bunbuntchi', 'bunbuntchi', BUNBUN_RABBIT),
  createBitmapSprite('Warusotchi', 'warusotchi', WARUSO_HORNS),
  createBitmapSprite('Hidatchi', 'hidatchi', HIDATCHI_RING),
  createBitmapSprite('Mimiyoritchi', 'mimiyoritchi', MIMIYORI_LONGEARS),
  createBitmapSprite('Hashizoutchi', 'hashizoutchi', HASHIZOU_LONG),
  createBitmapSprite('Teketchi', 'teketchi', TEKE_SEED),
  createBitmapSprite('Tsunotchi', 'tsunotchi', TSUNO_TALL),
  createBitmapSprite('Megatchi', 'megatchi', VISOR_BOT),
  createBitmapSprite('Kurokotchi', 'kurokotchi', KURO_DARK),
  createBitmapSprite('Billotchi', 'billotchi', BILL_TOWER),
  createBitmapSprite('Dorotchi', 'dorotchi', DORO_SAD),
  createBitmapSprite('Pyonkotchi', 'pyonkotchi', ROUND_EARS),
  createBitmapSprite('Bill', 'bill', BILL_NOSE),
  createBitmapSprite('Androtchi', 'androtchi', CUBIC_DROID),
  createBitmapSprite('Sekitoritchi', 'sekitoritchi', SUMO),
  createBitmapSprite('Paparatchi', 'paparatchi', CAMERA_FACE),
  createBitmapSprite('Pipotchi', 'pipotchi', POD),
  createBitmapSprite('Nyatchi', 'nyatchi', SIMPLE_CAT),
  createBitmapSprite('Hohotchi', 'hohotchi', HOHO_BIRD),
  createBitmapSprite('Oyajitchi', 'oyajitchi', OLD_MAN),
  createBitmapSprite('Ojitchi', 'ojitchi', BLOB),
  createBitmapSprite('Otokotchi', 'otokotchi', OTOKO_BRUISER),
  createBitmapSprite('Nazotchi', 'nazotchi', UFO, 'mystery/floating variant'),
] as const;

export const TAMAGOTCHI_SPRITE_BY_SLUG = new Map(
  TAMAGOTCHI_SPRITE_TEMPLATES.map((sprite) => [sprite.slug, sprite]),
);

export function getTamagotchiSpriteTemplate(slug: string): PixelSpriteTemplate | undefined {
  return TAMAGOTCHI_SPRITE_BY_SLUG.get(slug);
}

export function getRandomTamagotchiSpriteTemplate(): PixelSpriteTemplate {
  const index = Math.floor(Math.random() * TAMAGOTCHI_SPRITE_TEMPLATES.length);
  return TAMAGOTCHI_SPRITE_TEMPLATES[index]!;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getTamagotchiSpriteTemplateBySeed(seed: string): PixelSpriteTemplate {
  const index = hashSeed(seed) % TAMAGOTCHI_SPRITE_TEMPLATES.length;
  return TAMAGOTCHI_SPRITE_TEMPLATES[index]!;
}
