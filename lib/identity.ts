import { dayIdToDate, dayNumber } from './format';

// ======================= 🪞 Kalimat identitas =======================
//
// "Kamu adalah Gembala 10 CORE." — bukan "kamu harus menggembalakan 10 CORE".
//
// Idenya dari Atomic Habits: kebiasaan yang bertahan bukan yang dikejar dengan
// target, melainkan yang mengalir dari IDENTITAS. Orang yang berhenti merokok
// karena "saya sedang mencoba berhenti" berbeda dengan orang yang menjawab
// "saya bukan perokok". Yang pertama sedang melawan dirinya; yang kedua sedang
// menjadi dirinya.
//
// App ini sudah penuh tagihan: baris hari ini, badge, streak, pengingat. Semua
// itu bicara tentang APA YANG HARUS DIKERJAKAN. Satu kalimat ini satu-satunya
// yang bicara tentang SIAPA YANG MENGERJAKANNYA, dan ia ditaruh di puncak
// layar Today, tepat sebelum semua daftar itu.
//
// ── Aturan kalimatnya ─────────────────────────────────────────────────────
//   • Selalu "Kamu <sesuatu>", tanpa kata "harus"/"coba"/"semoga".
//   • Menyebut yang sudah BENAR hari ini, bukan yang dicita-citakan. Kalimat
//     yang belum jadi kenyataan tidak membentuk identitas, ia cuma jadi beban.
//   • Berganti tiap hari, tapi TIDAK acak: dipilih dari tanggalnya, jadi
//     membuka app sepuluh kali dalam sehari memberi kalimat yang sama.
//     (Kalimat yang berubah tiap kali layar digambar bukan identitas, itu
//     dekorasi.)

/** Bahan yang dipakai kalimat identitas — semuanya sudah ada di Today Engine. */
export type IdentityInput = {
  /** Berapa CORE Leader yang terdaftar (0 = belum ada). */
  leaders: number;
  /** Streak Morning Journey yang sedang berjalan. */
  streak: number;
};

/**
 * Kalimat TETAP — berlaku hari apa pun, tidak bergantung data.
 *
 * Ini inti daftarnya, dan sengaja sebagian besar berupa identitas ROHANI:
 * peran bisa berganti (CORE bisa bubar, pekerjaan bisa pindah), yang ini
 * tidak.
 */
const TETAP: string[] = [
  'Kamu Anak Tuhan Yesus',
  'Kamu True Follower, bukan penonton',
  'Kamu Ciptaan baru, yang lama sudah berlalu',
  'Kamu Dipilih, bukan kebetulan ada di sini',
  'Kamu Rumah Roh Kudus',
  'Kamu Garam dan Terang di tempatmu berdiri',
  'Kamu Murid yang dimuridkan, dan memuridkan',
  'Kamu Anak Raja, bukan anak rantau',
  'Kamu Sedang dikuduskan, dan itu belum selesai',
  'Kamu Pelari yang belum sampai garis akhir',
  'Kamu Diampuni, jadi berhenti menghukum dirimu',
  'Kamu Karya Tuhan yang sedang Dia kerjakan',
  'Kamu Dipercaya, bukan cuma dipekerjakan',
  'Kamu Orang yang mengerjakan segenap hati',
];

/**
 * Kalimat yang butuh ANGKA — ikut keadaan hari ini, jadi ia tidak pernah
 * bohong. Yang angkanya 0 tidak ikut diundi sama sekali (lihat `identityLine`):
 * "Kamu Gembala 0 CORE" bukan identitas, itu ejekan.
 */
function berangka({ leaders, streak }: IdentityInput): string[] {
  const out: string[] = [];
  if (leaders > 0) {
    out.push(`Kamu Gembala ${leaders} CORE`);
    out.push(`Kamu Orang yang mendoakan ${leaders} nama tiap bulan`);
  }
  if (streak > 2) {
    out.push(`Kamu Orang yang datang ke Tuhan ${streak} hari berturut`);
  }
  return out;
}

/**
 * Kalimat identitas hari ini.
 *
 * Murni: hasilnya cuma bergantung `input` & `todayId`, jadi ia bisa diuji apa
 * adanya dan tidak pernah berubah di tengah hari.
 */
export function identityLine(input: IdentityInput, todayId: string): string {
  const kolam = [...TETAP, ...berangka(input)];
  return kolam[dayNumber(dayIdToDate(todayId)) % kolam.length];
}
