import { pickOfDay } from './core';
import { greetingOfHour, type Greeting } from './daypart';
import { fitKindMeta, fitPace, type FitKind } from './fitness';
import { formatClock, formatDecimal } from './format';
import {
  ARCHIVE_NAME,
  layoutText,
  type TextLayout,
  type TextStep,
} from './shareImage';

// Sesi olahraga 💪 → kartu PERSEGI untuk grup WhatsApp (2 Okt 2026).
//
// Isinya tiga hal yang memang dikirim bersamaan ke grup keluarga: sapaan jamnya
// (selamat pagi / selamat malam), apa yang barusan dijalani, dan satu kalimat
// penyemangat. Ditutup "Salam sehat 💪".
//
// Kenapa PERSEGI, bukan 4:5 atau 9:16 seperti kartu Instagram yang sudah ada:
// alasan yang sama dengan kartu Reminder 🕊️ — WhatsApp menampilkan gambar
// sebagai pratinjau kecil di dalam gelembung pesan, dan gambar tinggi terpotong
// di situ. Persegi tampil utuh, jadi kalimatnya terbaca tanpa harus dibuka.
//
// ── Yang TIDAK bisa dijanjikan app ini ────────────────────────────────────
// WhatsApp tidak punya tautan "kirim ke grup X". Grup cuma bisa dipilih dari
// lembar berbagi iOS, dengan jarimu sendiri. Jadi tombolnya membuka lembar itu
// dengan gambarnya sudah siap; grup keluarga kamu pilih di sana (dan sesudah
// sekali, WhatsApp menaruhnya di deretan paling atas).

/** Kanvas persegi — ukuran yang sama dengan gambar lain di app ini. */
export const WORKOUT_W = 1080;
export const WORKOUT_H = 1080;

/** Tepi kiri-kanan (px). Lebar tulisan = 1080 − 2×110 = 860. */
export const WORKOUT_MARGIN = 110;

/** Garis alas tiap bagian tetap (px dari atas kanvas). */
export const WORKOUT_HEAD_Y = 170;
export const WORKOUT_RULE_TOP_Y = 220;
export const WORKOUT_EMOJI_Y = 370;
export const WORKOUT_TITLE_Y = 480;
export const WORKOUT_STATS_Y = 548;
export const WORKOUT_PLACE_Y = 606;
export const WORKOUT_SALAM_Y = 852;
export const WORKOUT_RULE_BOTTOM_Y = 892;
export const WORKOUT_FOOT_Y = 952;

/** Batas atas & bawah kalimat penyemangat. */
const CHEER_TOP = 650;
const CHEER_BOTTOM = 800;

// `maxChars` dihitung dari lebar 860 px dibagi lebar rata-rata huruf Inter
// (±0,52 × ukuran huruf). Kalimat pendek jadi besar; yang panjang mengecil
// sendiri sampai muat, tidak pernah terpotong di tengah jalan.
const CHEER_STEPS: TextStep[] = [
  { maxChars: 30, fontSize: 48, perLine: 68 },
  { maxChars: 38, fontSize: 40, perLine: 58 },
  { maxChars: 46, fontSize: 34, perLine: 48 },
  { maxChars: 58, fontSize: 28, perLine: 40 },
];

export function layoutCheer(text: string): TextLayout {
  return layoutText(text, CHEER_STEPS, CHEER_TOP, CHEER_BOTTOM);
}

/** Penutup kartu & pesannya. Disebut sekali, di satu tempat. */
export const WORKOUT_SALAM = 'Salam sehat 💪';

// ===================== Kalimat penyemangat =====================
//
// Ditulis untuk GRUP KELUARGA, bukan untuk diri sendiri: nadanya mengajak,
// tidak menggurui, dan tidak satu pun memamerkan angka. Yang dikirim ke grup
// seharusnya membuat yang membaca ingin ikut bergerak, bukan merasa tertinggal.
//
// Sengaja tidak ada yang menyebut berat badan, bentuk tubuh, atau "harus".
export const WORKOUT_CHEERS: string[] = [
  'Badan yang digerakkan hari ini adalah terima kasih yang paling jujur.',
  'Tidak perlu cepat. Yang penting hari ini tidak dilewatkan.',
  'Sehat itu bukan hadiah sekali jadi, ia dikumpulkan sedikit-sedikit.',
  'Pagi yang dimulai dengan bergerak biasanya pulang dengan hati lebih ringan.',
  'Yang kita rawat hari ini, kita pakai sepuluh tahun lagi.',
  'Satu langkah hari ini lebih baik daripada rencana sempurna besok.',
  'Tubuh ini titipan. Merawatnya bagian dari bersyukur.',
  'Capek yang ini jenis yang baik: ia menabung, bukan menghabiskan.',
  'Bergerak sebentar hari ini, tidur lebih nyenyak nanti malam.',
  'Konsisten mengalahkan semangat yang cuma sehari.',
  'Yang kita kejar bukan rekor, tapi kebiasaan yang bertahan.',
  'Mulai saja dulu. Badan biasanya menyusul setelah kaki melangkah.',
  'Sehat itu supaya kuat menemani yang kita sayangi lebih lama.',
  'Hari ini sudah bergerak. Besok tinggal mengulangi.',
  'Tidak ada olahraga yang sia-sia, sekecil apa pun porsinya.',
  'Yang paling berat biasanya bukan larinya, tapi keluar dari pintu.',
];

/**
 * Kalimat hari ini. `putar` menggeser pilihannya satu per satu, jadi kamu bisa
 * mencari yang paling pas tanpa app ini mengundi ulang semaunya sendiri.
 */
export function workoutCheer(dayId: string, putar: number = 0): string {
  const awal = WORKOUT_CHEERS.indexOf(pickOfDay(WORKOUT_CHEERS, dayId, 'cheer'));
  const n = WORKOUT_CHEERS.length;
  return WORKOUT_CHEERS[(((awal + putar) % n) + n) % n];
}

// ===================== Isi kartunya =====================

/** Sapaan untuk jam itu — satu aturan bersama seluruh app (lib/daypart.ts). */
export function workoutGreeting(now: Date): Greeting {
  return greetingOfHour(now.getHours());
}

/** "Lari 4,15 km" · "Angkat Beban". Jarak ikut hanya kalau memang dicatat. */
export function workoutHeadline(kind: FitKind, km: number): string {
  const { label } = fitKindMeta(kind);
  return km > 0 ? `${label} ${formatDecimal(km)} km` : label;
}

/**
 * "31:01" atau "31:01 · 7:28 /km".
 *
 * Jamnya memakai `formatClock` yang SAMA dengan stopwatch di layarnya — dulu
 * modul ini punya salinannya sendiri (`clockOf`) supaya bisa jalan tanpa
 * React. Sejak pemformatnya pindah ke lib/format.ts yang tidak mengimpor apa
 * pun, salinan itu tidak perlu lagi.
 */
export function workoutStats(seconds: number, km: number): string {
  const pace = fitPace(km, seconds / 60);
  return pace ? `${formatClock(seconds)} · ${pace}` : formatClock(seconds);
}

/** Satu sesi, sebatas yang dibutuhkan kartunya. */
export type WorkoutShare = {
  kind: FitKind;
  seconds: number;
  km: number;
  place: string;
  /** Tanggal yang tercetak di kaki, mis. "Jumat, 2 Oktober 2026". */
  dateLabel: string;
  greeting: Greeting;
  cheer: string;
};

/**
 * Pesan untuk ditempel sebagai keterangan foto, atau dikirim sendiri tanpa
 * gambar. Isinya SAMA PERSIS dengan kartunya — kalau keduanya berbeda, yang
 * membaca di grup akan melihat dua versi dari satu pagi yang sama.
 */
export function workoutCaption(s: WorkoutShare): string {
  const { emoji } = fitKindMeta(s.kind);
  const baris = [
    `${s.greeting.label} ${s.greeting.emoji}`,
    '',
    `${emoji} ${workoutHeadline(s.kind, s.km)}`,
    `⏱️ ${workoutStats(s.seconds, s.km)}`,
  ];
  if (s.place.trim()) baris.push(`📍 ${s.place.trim()}`);
  baris.push('', `"${s.cheer}"`, '', WORKOUT_SALAM);
  return baris.join('\n');
}

/** Nama berkas yang enak dibaca di Foto/Files. */
export function workoutFileName(dayId: string, kind: FitKind): string {
  return `${ARCHIVE_NAME} ${dayId} ${kind}.png`;
}
