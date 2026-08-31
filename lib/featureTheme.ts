import { Color } from '@/assets/style/color';
import { HOME_FEATURES } from '@/lib/homeGrid';

// Warna yang menempel pada SATU fitur, dari tile-nya di grid Home sampai ke
// dalam layarnya: pita header, tab bawah yang sedang aktif, & kartu ringkasan.
//
// Kenapa lewat RUTE, bukan lewat prop di tiap layar: sub-halaman sebuah fitur
// ada banyak (Spiritual saja punya 11 — Revive, Sermon, Puasa, Syukur, …), dan
// semuanya sudah memakai <ScreenHeader/> yang sama. Dipetakan dari nama
// rutenya, satu tabel di bawah ini sudah cukup untuk seluruh app — tak ada 55
// layar yang harus diedit satu per satu, dan layar baru cukup menambah satu
// baris di sini.
export type FeatureTheme = {
  key: string;
  /** Pastel — pita header & pil tab aktif. */
  bg: string;
  /** Gelap senada — judul, ikon, tulisan di atas pastel. */
  fg: string;
  /** Paling gelap — isian kartu ringkasan (tulisannya putih). */
  deep: string;
};

// Layar yang bukan milik fitur mana pun (Achievement, Timeline, Riwayat,
// Login) memakai warna merek. Bentuknya tetap sama dengan layar fitur, jadi
// tidak ada layar yang tampak "belum jadi".
export const BRAND_THEME: FeatureTheme = {
  key: 'brand',
  bg: Color.MAIN_LIGHT,
  fg: Color.MAIN_DARK,
  deep: Color.MAIN_DARK,
};

// Nama rute (ruas PERTAMA-nya) → kunci fitur di HOME_FEATURES.
//
// Cukup ruas pertama, jadi 'fund/[key]', 'project/edit/[id]', 'book/[key]',
// dan kawan-kawannya ikut tanpa perlu didaftarkan lagi. Yang TIDAK ada di
// sini sengaja jatuh ke warna merek.
const ROUTE_FEATURE: Record<string, string> = {
  // Reminder ✅
  tasks: 'tasks',
  'daily-priority': 'tasks',

  // Spiritual ✝️ — fitur dengan sub-halaman terbanyak.
  spiritual: 'spiritual',
  revive: 'spiritual',
  'revive-history': 'spiritual',
  sermon: 'spiritual',
  'bible-reading': 'spiritual',
  'bible-story': 'spiritual',
  fasting: 'spiritual',
  gratitude: 'spiritual',
  'morning-prayer': 'spiritual',
  'reflection-feed': 'spiritual',
  'reminder-share': 'spiritual',

  // Health ❤️
  health: 'health',
  steps: 'health',
  'checkup-status': 'health',
  diseases: 'health',
  'health-info': 'health',
  donor: 'health',

  // CORE 👥
  core: 'core',
  'core-rules': 'core',
  'core-ideas': 'core',
  'ex-leaders': 'core',
  'leader-criteria': 'core',
  visitations: 'core',
  'chat-templates': 'core',
  multiplication: 'core',
  'monthly-prayers': 'core',

  // Finance 💵
  finance: 'finance',
  funds: 'finance',
  fund: 'finance',
  debts: 'finance',

  // Sisanya: satu fitur, satu layar (plus sub-halaman ber-ruas sama).
  learning: 'learning',
  fitness: 'fitness',
  family: 'family',
  investment: 'investment',
  career: 'career',
  project: 'career',
  fun: 'fun',
  wheel: 'wheel',
  car: 'car',
  residence: 'residence',
  news: 'news',
  'news-saved': 'news',
  book: 'book',
  device: 'device',
  games: 'games',
  social: 'social',
  bill: 'social',
  married: 'married',
};

/**
 * Kunci fitur pemilik sebuah rute, atau null kalau rutenya bukan milik fitur
 * mana pun. `routeName` = nama rute dari expo-router, mis. 'spiritual',
 * 'fund/[key]', '(tabs)'.
 */
export function featureKeyForRoute(routeName: string): string | null {
  // Ruas pertama saja; tanda kurung grup rute ('(tabs)') tidak pernah cocok.
  const first = routeName.replace(/^\/+/, '').split('/')[0] ?? '';
  return ROUTE_FEATURE[first] ?? null;
}

/** Warna fitur pemilik sebuah rute — jatuh ke warna merek kalau tak ada. */
export function featureThemeForRoute(routeName: string): FeatureTheme {
  const key = featureKeyForRoute(routeName);
  if (key === null) return BRAND_THEME;
  const f = HOME_FEATURES.find((x) => x.key === key);
  // Kunci yang ditulis di tabel tapi tak ada di grid = salah ketik; jangan
  // sampai layarnya jadi tanpa warna, kembalikan warna merek saja.
  if (!f) return BRAND_THEME;
  return { key: f.key, bg: f.bg, fg: f.fg, deep: f.deep };
}
