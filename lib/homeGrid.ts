import { type Href } from 'expo-router';

import { Color } from '@/assets/style/color';

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
  icon:
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
    | 'diamond.fill'
    | 'iphone'
    | 'wineglass.fill';
  route: Href;
  /** Warna tile + warna ikon/tulisannya. */
  bg: string;
  fg: string;
};

export const HOME_FEATURES: HomeFeature[] = [
  { key: 'tasks', label: 'Reminder', icon: 'checklist', route: '/tasks', bg: Color.MAIN_LIGHT, fg: Color.MAIN_DARK },
  { key: 'spiritual', label: 'Spiritual', icon: 'bird.fill', route: '/spiritual', bg: Color.SPIRITUAL, fg: Color.SPIRITUAL_DARK },
  { key: 'health', label: 'Health', icon: 'heart.fill', route: '/health', bg: Color.FINANCE_EXPENSE, fg: Color.DANGER },
  { key: 'core', label: 'CORE', icon: 'person.2.fill', route: '/core', bg: Color.FINANCE_INVESTMENT, fg: Color.TEXT_TITLE },

  { key: 'finance', label: 'Finance', icon: 'banknote', route: '/finance', bg: Color.FINANCE_INCOME, fg: Color.FINANCE_INCOME_DARK },
  { key: 'learning', label: 'Learning', icon: 'graduationcap.fill', route: '/learning', bg: Color.LEARNING, fg: Color.LEARNING_DARK },
  { key: 'fitness', label: 'Fitness', icon: 'dumbbell.fill', route: '/fitness', bg: Color.FITNESS, fg: Color.FITNESS_DARK },
  { key: 'family', label: 'Family', icon: 'person.3.fill', route: '/family', bg: Color.FINANCE_SAVING, fg: Color.ACCENT_DARK },

  { key: 'investment', label: 'Invest', icon: 'chart.line.uptrend.xyaxis', route: '/investment', bg: Color.CAREER_DARK, fg: Color.TEXT_LABEL },
  { key: 'career', label: 'Career', icon: 'briefcase.fill', route: '/career', bg: Color.CAREER, fg: Color.ACCENT_DARK },
  { key: 'fun', label: 'Fun', icon: 'party.popper.fill', route: '/fun', bg: Color.FUN, fg: Color.FUN_DARK },
  { key: 'wheel', label: 'Wheel', icon: 'target', route: '/wheel', bg: Color.WHEEL, fg: Color.WHEEL_DARK },

  { key: 'car', label: 'Car', icon: 'car.fill', route: '/car', bg: Color.ACCENT, fg: Color.ACCENT_DARK },
  { key: 'residence', label: 'Residence', icon: 'house.fill', route: '/residence', bg: Color.HOUSE, fg: Color.HOUSE_DARK },
  { key: 'news', label: 'News', icon: 'newspaper.fill', route: '/news', bg: Color.NEWS, fg: Color.NEWS_DARK },
  { key: 'book', label: 'Book', icon: 'books.vertical.fill', route: '/book', bg: Color.BOOK, fg: Color.BOOK_DARK },

  // Device 📱 — paket kuota iPhone/iPad & seluruh biaya perangkat.
  { key: 'device', label: 'Device', icon: 'iphone', route: '/device', bg: Color.LEARNING, fg: Color.LEARNING_DARK },
  { key: 'games', label: 'Games', icon: 'trophy.fill', route: '/games', bg: Color.TOURNAMENT, fg: Color.TOURNAMENT_DARK },
  // Social 🥂 — patungan (Split Bill) & tempat nongkrong bareng teman.
  { key: 'social', label: 'Social', icon: 'wineglass.fill', route: '/social', bg: Color.SOCIAL, fg: Color.SOCIAL_DARK },
  // Married 💍 — masih Coming Soon. Ditaruh paling belakang supaya urutan tile
  // yang sudah kamu hafal tidak bergeser sama sekali.
  { key: 'married', label: 'Married', icon: 'diamond.fill', route: '/married', bg: Color.MARRIED, fg: Color.MARRIED_DARK },
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
