// Lambang sesi hari — SATU sumber untuk seluruh app.
//
// Dulu tiap fitur memilih sendiri: Habits memakai 🌤️ untuk Siang,
// sedangkan Bacaan Alkitab & Reward memakai ☀️. Karena ☀️ juga dipakai
// sapaan "Selamat pagi", lambang yang sama akhirnya berarti dua waktu berbeda
// tergantung layarnya.
//
// Pakai konstanta ini di mana pun ada label Pagi/Siang/Malam. Ubah di sini =
// seluruh app ikut berubah, tak ada lagi yang tertinggal.
export const DAYPART = {
  morning: '🌅',
  daytime: '🌤️',
  night: '🌙',
} as const;

// ===================== Sapaan menurut jam =====================
//
// SATU aturan untuk seluruh app: layar Masuk, kepala layar berdate, dan kartu
// olahraga yang dikirim ke grup keluarga. Yang terakhir itu alasan ia pindah
// ke sini (2 Okt 2026): kartunya butuh kata & lambangnya TERPISAH (kop kartu
// memakai huruf besar berjarak, dan lambang yang ikut diberi jarak huruf
// terlihat rusak), sedangkan `greetingText` memberi keduanya sudah menyatu.
//
// Sore memang bukan salah satu sesi DAYPART, jadi lambangnya tetap 🌇.

export type Greeting = { label: string; emoji: string };

/** Sapaan untuk jam `h` (0–23). Batasnya: pagi <11, siang <15, sore <19. */
export function greetingOfHour(h: number): Greeting {
  if (h < 11) return { label: 'Selamat pagi', emoji: DAYPART.morning };
  if (h < 15) return { label: 'Selamat siang', emoji: DAYPART.daytime };
  if (h < 19) return { label: 'Selamat sore', emoji: '🌇' };
  return { label: 'Selamat malam', emoji: DAYPART.night };
}
