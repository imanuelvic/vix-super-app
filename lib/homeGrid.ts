import { type Href } from 'expo-router';

import { Color } from '@/assets/style/color';
import { type GlyphName } from '@/components/ui/icon-glyph';

// Grid fitur di Home 🏠 — SATU sumber urutan & warnanya.
//
// Dipakai dua tempat, dan itulah sebabnya daftar ini pindah ke lib:
//   • app/(tabs)/index.tsx — menggambar gridnya apa adanya, berurutan.
//   • lib/achievements.ts  — mengurutkan kategori pencapaian mengikuti grid
//                            ini, supaya "Alkitab" tidak nyasar di bawah "Gym"
//                            padahal di Home Spiritual ada jauh di atas Fitness.
//
// Tambah fitur baru = tambah 1 baris di sini. Urutan barisnya = urutan tile-nya
// (4 per baris di layar; baris kosong di bawah cuma pemisah baca).

export type HomeFeature = {
  key: string;
  label: string;
  /**
   * Lambang di luar SF Symbols — lihat `components/ui/icon-glyph.tsx`.
   *
   * Dipakai dua tile: Friends (jabat tangan) & Married (cincin). Keduanya tidak
   * ada di katalog Apple padahal justru itulah lambang fiturnya, jadi glifnya
   * diambil dari @expo/vector-icons. Tetap satu warna & seukuran ikon lain —
   * jadi barisnya rata, tidak seperti emoji yang warnanya diatur sistem.
   */
  glyph?: GlyphName;
  /** Wajib kalau `glyph` tidak diisi. */
  icon?:
    | 'checklist'
    | 'banknote'
    | 'heart.fill'
    | 'person.2.fill'
    | 'chart.line.uptrend.xyaxis'
    | 'car.fill'
    | 'target'
    | 'book.closed.fill'
    | 'books.vertical.fill'
    | 'house.fill'
    | 'briefcase.fill'
    | 'person.3.fill'
    | 'party.popper.fill'
    | 'dumbbell.fill'
    | 'globe'
    | 'newspaper.fill'
    | 'bird.fill'
    | 'trophy.fill'
    | 'graduationcap.fill'
    | 'iphone';
  route: Href;
  /** Latar pastel tile — dipakai lagi jadi pita header & pil tab di dalam fitur. */
  bg: string;
  /** Gelap senada — ikon & tulisan di atas pastel itu. */
  fg: string;
  /**
   * Paling gelap — isian kartu ringkasan di dalam fitur (tulisannya putih).
   *
   * Perlu warna KETIGA karena `fg` dipilih agar terbaca di atas pastel, bukan
   * agar putih terbaca di atasnya. Beberapa `fg` (hijau Finance, madu Family)
   * masih terlalu terang untuk jadi latar kartu, jadi versi tergelapnya
   * dipisah sendiri.
   */
  deep: string;
};

export const HOME_FEATURES: HomeFeature[] = [
  { key: 'tasks', label: 'Reminder', icon: 'checklist', route: '/tasks', bg: Color.MAIN_LIGHT, fg: Color.MAIN_DARK, deep: Color.MAIN_DARK },
  { key: 'spiritual', label: 'Spiritual', icon: 'bird.fill', route: '/spiritual', bg: Color.SPIRITUAL, fg: Color.SPIRITUAL_DARK, deep: Color.SPIRITUAL_DEEP },
  { key: 'health', label: 'Health', icon: 'heart.fill', route: '/health', bg: Color.HEALTH, fg: Color.HEALTH_DARK, deep: Color.HEALTH_DEEP },
  { key: 'core', label: 'CORE', icon: 'person.2.fill', route: '/core', bg: Color.CORE, fg: Color.CORE_DARK, deep: Color.CORE_DEEP },

  { key: 'finance', label: 'Finance', icon: 'banknote', route: '/finance', bg: Color.FINANCE, fg: Color.FINANCE_DARK, deep: Color.FINANCE_DEEP },
  { key: 'learning', label: 'Learning', icon: 'graduationcap.fill', route: '/learning', bg: Color.LEARNING, fg: Color.LEARNING_DARK, deep: Color.LEARNING_DEEP },
  { key: 'fitness', label: 'Fitness', icon: 'dumbbell.fill', route: '/fitness', bg: Color.FITNESS, fg: Color.FITNESS_DARK, deep: Color.FITNESS_DEEP },
  { key: 'family', label: 'Family', icon: 'person.3.fill', route: '/family', bg: Color.FAMILY, fg: Color.FAMILY_DARK, deep: Color.FAMILY_DEEP },

  { key: 'investment', label: 'Invest', icon: 'chart.line.uptrend.xyaxis', route: '/investment', bg: Color.INVEST, fg: Color.INVEST_DARK, deep: Color.INVEST_DEEP },
  { key: 'career', label: 'Career', icon: 'briefcase.fill', route: '/career', bg: Color.CAREER, fg: Color.CAREER_DARK, deep: Color.CAREER_DEEP },
  { key: 'fun', label: 'Fun', icon: 'party.popper.fill', route: '/fun', bg: Color.FUN, fg: Color.FUN_DARK, deep: Color.FUN_DEEP },
  { key: 'wheel', label: 'Wheel', icon: 'target', route: '/wheel', bg: Color.WHEEL, fg: Color.WHEEL_DARK, deep: Color.WHEEL_DEEP },

  { key: 'car', label: 'Car', icon: 'car.fill', route: '/car', bg: Color.CAR, fg: Color.CAR_DARK, deep: Color.CAR_DEEP },
  { key: 'residence', label: 'Residence', icon: 'house.fill', route: '/residence', bg: Color.HOUSE, fg: Color.HOUSE_DARK, deep: Color.HOUSE_DEEP },
  { key: 'news', label: 'News', icon: 'newspaper.fill', route: '/news', bg: Color.NEWS, fg: Color.NEWS_DARK, deep: Color.NEWS_DEEP },
  { key: 'book', label: 'Book', icon: 'books.vertical.fill', route: '/book', bg: Color.BOOK, fg: Color.BOOK_DARK, deep: Color.BOOK_DEEP },

  // Device 📱 — paket kuota iPhone/iPad & seluruh biaya perangkat.
  { key: 'device', label: 'Device', icon: 'iphone', route: '/device', bg: Color.DEVICE, fg: Color.DEVICE_DARK, deep: Color.DEVICE_DEEP },
  { key: 'games', label: 'Games', icon: 'trophy.fill', route: '/games', bg: Color.TOURNAMENT, fg: Color.TOURNAMENT_DARK, deep: Color.TOURNAMENT_DEEP },
  // Friends 🤝 — futsal rutin, patungan (Split Bill) & tempat nongkrong.
  { key: 'friends', label: 'Friends', glyph: 'handshake', route: '/friends', bg: Color.FRIENDS, fg: Color.FRIENDS_DARK, deep: Color.FRIENDS_DEEP },
  // Married 💍 — masih Coming Soon. Ditaruh paling belakang supaya urutan tile
  // yang sudah kamu hafal tidak bergeser sama sekali.
  { key: 'married', label: 'Married', glyph: 'ring', route: '/married', bg: Color.MARRIED, fg: Color.MARRIED_DARK, deep: Color.MARRIED_DEEP },
];

/**
 * Posisi tile sebuah fitur di grid (0 = paling kiri-atas). Fitur yang tidak
 * ada di grid ditaruh paling belakang, bukan di depan — supaya menambah
 * kategori yang lupa dipetakan tidak diam-diam melompat ke atas.
 */
export function homeFeatureIndex(key: string): number {
  const i = HOME_FEATURES.findIndex((f) => f.key === key);
  return i === -1 ? HOME_FEATURES.length : i;
}
