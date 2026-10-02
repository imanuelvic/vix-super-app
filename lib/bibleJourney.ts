import { DAYPART } from './daypart';
import { JOURNEY_NAME } from './journey';
import type { BibleSession } from './spiritual';

// Bible Journey 📖 — membaca Alkitab sebagai PERJALANAN, bukan formulir:
//   🌅/🌤️/🌙 Open → 📖 Read → ✨ Receive → 💛 Verse → 🕊️ Close
//
// Bentuknya sengaja sama dengan Morning Journey (lib/journey.ts): satu langkah
// pada satu waktu, tanpa centang, tanpa hitungan "3 dari 5", tanpa persen.
// Yang diganti bukan kotaknya, tapi pertanyaannya. Dulu layar ini satu halaman
// berisi kolom-kolom yang harus diisi, dan yang terasa adalah "sudah terisi
// belum"; sekarang yang terasa "aku baru saja membaca, dan ini yang aku
// dapat".
//
// Tiap langkah boleh dilewati kosong. Yang ditulis tetap tersimpan, dan
// streak 🔥 tetap naik di langkah terakhir, persis seperti sebelumnya.
//
// Ke mana isinya tersimpan (semuanya di dokumen yang SUDAH ADA, satu per hari,
// users/{uid}/bibleRead/{YYYY-MM-DD} — tidak ada koleksi baru):
//   • 📖 Read     → {sesi} & {sesi}Version      (acuan + terjemahan, lama)
//   • ✨ Receive  → {sesi}Note                   (baru)
//   • 💛 Verse    → {sesi}Verse & {sesi}VerseText (baru)
// Lihat `saveBibleJourney` di lib/spiritual.ts.

export type BibleStepKey = 'open' | 'read' | 'receive' | 'verse' | 'close';

export type BibleStep = {
  key: BibleStepKey;
  emoji: string;
  /** Nama langkah (eyebrow kecil di atas judul) — bahasa Inggris, Title Case. */
  label: string;
  /** Kalimat yang menjadi judul kartunya. */
  title: string;
};

/**
 * Lambang langkah pertama IKUT SESINYA (🌅 pagi · 🌤️ siang · 🌙 malam), jadi
 * jejak di atas kartu sudah memberi tahu "ini sesi yang mana" sebelum satu
 * kata pun dibaca. Keempat langkah berikutnya sama di ketiga sesi: yang
 * berbeda waktunya, bukan perjalanannya.
 */
export function bibleJourneySteps(session: BibleSession): BibleStep[] {
  return [
    {
      key: 'open',
      emoji: DAYPART[session],
      label: 'Open',
      title: 'Aku datang untuk mendengar',
    },
    { key: 'read', emoji: '📖', label: 'Read', title: 'Apa yang kamu baca?' },
    {
      key: 'receive',
      emoji: '✨',
      label: 'Receive',
      title: 'Apa yang kamu dapatkan?',
    },
    {
      key: 'verse',
      emoji: '💛',
      label: 'Verse',
      title: 'Ayat mana yang memberkatimu?',
    },
    { key: 'close', emoji: '🕊️', label: 'Close', title: 'Ada hati untuk membagikannya?' },
  ];
}

export const BIBLE_STEP_KEYS: BibleStepKey[] = [
  'open',
  'read',
  'receive',
  'verse',
  'close',
];

export function bibleStepIndex(key: BibleStepKey): number {
  return BIBLE_STEP_KEYS.indexOf(key);
}

export function bibleStepMeta(key: BibleStepKey, session: BibleSession): BibleStep {
  return bibleJourneySteps(session)[bibleStepIndex(key)];
}

/** Langkah sesudah `key`; null kalau sudah di penutup. */
export function nextBibleStep(key: BibleStepKey): BibleStepKey | null {
  const i = bibleStepIndex(key);
  return i >= 0 && i < BIBLE_STEP_KEYS.length - 1 ? BIBLE_STEP_KEYS[i + 1] : null;
}

// ---------------------------- 🌅 Open ----------------------------
// Sapaannya ikut sesi yang SEDANG dibuka, bukan jam HP. Mencatat bacaan siang
// jam 23.00 itu wajar, dan yang harus disapa sesi yang kamu pilih.

export const BIBLE_GREETING: Record<BibleSession, string> = {
  morning: `Selamat pagi, ${JOURNEY_NAME}.`,
  daytime: `Selamat siang, ${JOURNEY_NAME}.`,
  night: `Selamat malam, ${JOURNEY_NAME}.`,
};

/**
 * Undangan pembuka tiap sesi. Nadanya sengaja berbeda karena keadaannya
 * berbeda: pagi itu sebelum hari dimulai, siang di tengah hari yang ramai,
 * malam saat hari sudah selesai.
 */
export const BIBLE_INVITATION: Record<BibleSession, string> = {
  morning:
    'Sebelum hari ini menuntut apa pun darimu, dengarkan dulu suara-Nya. Tidak perlu banyak, cukup satu pasal yang kamu baca pelan-pelan.',
  daytime:
    'Di tengah hari yang ramai, berhenti sebentar. Biarkan firman-Nya menenangkan apa yang sedang berisik di kepalamu.',
  night:
    'Hari ini sudah selesai. Tutup dengan firman-Nya, bukan dengan layar yang lain, dan biarkan Dia yang berbicara terakhir.',
};

// ---------------------------- 🕊️ Close ----------------------------

/**
 * Kalimat penutup, SETELAH bacaannya tersimpan. Ia menyebut yang kamu jalani,
 * bukan yang kamu selesaikan: tidak ada "lengkap", "selesai", atau angka.
 */
export const BIBLE_CLOSING: Record<BibleSession, string> = {
  morning: '🌅 Kamu sudah mengawali hari ini bersama firman-Nya.',
  daytime: '🌤️ Kamu sudah berhenti sejenak untuk mendengar-Nya.',
  night: '🌙 Kamu menutup hari ini bersama firman-Nya.',
};

/**
 * Tawaran membagikan ke Instagram Story. Pertanyaannya, bukan tombolnya, yang
 * penting: membagikan itu soal hati hari itu, jadi "tidak" harus terasa sama
 * wajarnya dengan "ya" dan tidak boleh ada yang hilang kalau dijawab tidak.
 */
export const BIBLE_SHARE_QUESTION =
  'Kalau ada ayat yang ingin kamu bagikan, buatkan Story-nya. Kalau hari ini cukup untukmu sendiri, itu juga baik.';
