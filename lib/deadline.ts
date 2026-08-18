// Aturan TUNGGAL untuk semua yang punya tenggat di app ini — sparepart mobil,
// perawatan rumah, pinjaman, dan daftar lain yang menyusul.
//
// Sebelumnya tiap fitur menghitung & mewarnai sendiri, jadi "besok" di satu
// layar bisa terlihat beda dengan "besok" di layar lain. Sekarang satu aturan,
// satu warna, di mana pun.

/**
 * Nada tenggat:
 *   over    🔴 hari-H atau sudah lewat  — harus dikerjakan sekarang
 *   warn    🟡 tinggal 1 hari (H-1)     — bersiap dari sekarang
 *   ok      🟢 masih ≥ 2 hari           — aman
 *   unknown ⚪ belum ada tanggalnya     — tidak bisa dinilai
 */
export type DeadlineTone = 'over' | 'warn' | 'ok' | 'unknown';

/** Batas H-1: inilah yang memisahkan "besok" (kuning) dari "2 hari lagi" (hijau). */
const WARN_DAYS = 1;

/** Nada dari sisa hari. Negatif = sudah lewat. */
export function deadlineTone(daysLeft: number): DeadlineTone {
  if (daysLeft <= 0) return 'over';
  return daysLeft <= WARN_DAYS ? 'warn' : 'ok';
}

/** Perlu perhatian sekarang? (dasar semua badge merah bertenggat) */
export function deadlineDue(tone: DeadlineTone): boolean {
  return tone === 'over' || tone === 'warn';
}

/**
 * Label sisa waktu yang MEMBEDAKAN tiap jarak dengan jelas — inti keluhannya
 * dulu: "1 hari lagi" dan "2 hari lagi" harus langsung kelihatan bedanya.
 *
 *   -3 → "⚠️ Lewat 3 hari"
 *    0 → "🔴 Hari ini"
 *    1 → "🟡 Besok"
 *    5 → "🟢 5 hari lagi"
 */
export function deadlineLabel(daysLeft: number): string {
  if (daysLeft < 0) return `⚠️ Lewat ${-daysLeft} hari`;
  if (daysLeft === 0) return '🔴 Hari ini';
  if (daysLeft === 1) return '🟡 Besok';
  return `🟢 ${daysLeft} hari lagi`;
}
