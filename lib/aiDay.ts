import AsyncStorage from '@react-native-async-storage/async-storage';

// 🗓️ Catatan harian fitur AI, disimpan di HP sendiri (AsyncStorage).
//
// Tiap fitur AI di app ini punya dua hal yang perlu diingat SEHARIAN:
//   • sudah berapa kali dipanggil hari itu (jatahnya sendiri), dan
//   • hasil yang sudah didapat, supaya membuka layarnya lagi tidak memanggil
//     AI lagi.
//
// Keduanya tersimpan di satu kunci per fitur per hari: "ai:<fitur>:<dayId>".
// Kunci hari itu yang membuatnya bersih sendiri: besok kuncinya sudah lain,
// jadi tidak ada yang perlu dihapus dan tidak ada hitungan yang perlu direset.
//
// ── Kenapa jadi satu tempat ───────────────────────────────────────────────
// Empat fitur (Refleksi harian, Vix Financial Coach, Analysis pasar,
// Rekomendasi Budget) masing-masing menulis blok yang sama persis: awalan
// kunci, try/catch baca, JSON.parse, normalisasi field, try/catch tulis.
// Yang paling penting dari blok itu justru bagian yang paling gampang lupa
// disalin: **menulis yang gagal TIDAK BOLEH menggagalkan apa pun.** Kalau
// penyimpanannya penuh atau ditolak, paling buruk jatah hari ini terbaca ulang
// dari nol, dan pagar umum lib/aiGuard.ts (cooldown, kunci 429, batas 30 per
// hari) masih berdiri di bawahnya. Aturan itu sekarang ditulis SEKALI.
//
// Yang SENGAJA tidak disatukan: bentuk catatannya. Tiap fitur punya nama field
// sendiri (`attempts` vs `calls`, `hasil` vs `answers` vs `result`), dan nama
// itu sudah ada di dalam data yang tersimpan di HP pemiliknya. Menyeragamkannya
// berarti catatan hari ini terbaca kosong sekali, dan jatah yang sudah terpakai
// jadi gratis lagi. Jadi tiap fitur tetap membawa `bentuk`-nya sendiri.

/** Gudang catatan harian untuk SATU fitur AI. */
export type AiDayStore<T> = {
  /** Catatan hari yang belum tersentuh sama sekali. */
  KOSONG: T;
  /** Baca catatan hari itu. Tidak pernah melempar; gagal = dianggap kosong. */
  load: (dayId: string) => Promise<T>;
  /** Simpan catatan hari itu. Tidak pernah melempar. */
  save: (dayId: string, day: T) => Promise<void>;
};

/**
 * Buat gudang catatan harian satu fitur.
 *
 * `fitur` jadi awalan kunci ("market" → "ai:market:2026-10-01"), dan karena ia
 * cuma ditulis DI SINI, mustahil ada satu pemanggil yang menyimpan dengan
 * awalan lain dari yang dibacanya.
 *
 * `bentuk` membentuk ulang isi tersimpan jadi catatan yang utuh. Ia menerima
 * apa saja yang kebetulan ada di penyimpanan (versi app lama, isi separuh,
 * field yang tipenya berubah), jadi ia harus memeriksa tiap field, bukan
 * memercayainya.
 */
export function aiDayStore<T>(
  fitur: string,
  kosong: T,
  bentuk: (tersimpan: Partial<T>) => T,
): AiDayStore<T> {
  const awalan = `ai:${fitur}:`;
  return {
    KOSONG: kosong,
    load: async (dayId) => {
      try {
        const raw = await AsyncStorage.getItem(awalan + dayId);
        if (!raw) return kosong;
        return bentuk(JSON.parse(raw) as Partial<T>);
      } catch {
        return kosong;
      }
    },
    save: async (dayId, day) => {
      try {
        await AsyncStorage.setItem(awalan + dayId, JSON.stringify(day));
      } catch {
        // Tidak tersimpan = paling buruk boleh dipanggil lagi hari ini; pagar
        // umum lib/aiGuard.ts masih berdiri.
      }
    },
  };
}

/** Sisa jatah hari ini. Tidak pernah minus, berapa pun yang sudah terpakai. */
export function sisaJatah(jatah: number, terpakai: number): number {
  return Math.max(0, jatah - terpakai);
}
