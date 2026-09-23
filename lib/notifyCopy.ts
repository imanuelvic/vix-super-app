// ====================== Kalimat pengingat (ala Duolingo) ======================
//
// Notifikasi yang kalimatnya SAMA tiap hari berhenti dibaca dalam seminggu: ia
// jadi wallpaper. Duolingo menang bukan karena burungnya lucu, tapi karena
// kalimatnya berganti, pendek, sedikit menggoda, dan selalu menyebut satu hal
// yang mau kamu jaga (streak, angka yang tinggal sedikit lagi).
//
// Di sini semua kalimatnya dikumpulkan sebagai KOLAM: satu kolam per pengingat,
// dan yang dipakai hari ini dipilih dari tanggalnya (`pilihKalimat`). Jadi:
//   • tiap hari terasa berbeda tanpa ada yang acak (hasilnya bisa diuji),
//   • satu hari yang sama selalu memilih kalimat yang sama, jadi penjadwalan
//     ulang berkali-kali (tiap layar Today digambar) tidak menghasilkan
//     notifikasi yang isinya berubah-ubah,
//   • menambah kalimat baru = menambah satu baris di sini, bukan menyentuh
//     mesin penjadwalnya.
//
// Gaya bahasanya mengikuti aturan yang sama dengan jawaban AI (lib/aiStyle.ts):
// kalimat pendek, hangat, gaya anak muda, emoji secukupnya di ujung. Tanpa
// tanda pisah panjang, dan tanpa kata perintah menyentuh layar (istilah app
// ini "click", lihat suite cek-click.js).

/** Pilih satu isi kolam dari tanggalnya. Sama hari = sama kalimat. */
export function pilihKalimat<T>(kolam: T[], dayId: string, garam: string): T {
  const teks = `${dayId}|${garam}`;
  let h = 5381;
  for (let i = 0; i < teks.length; i++) h = ((h << 5) + h + teks.charCodeAt(i)) | 0;
  return kolam[Math.abs(h) % kolam.length];
}

export type Kalimat = { title: string; body: string };

/** 🌅 Undangan pagi. `{streak}` diisi mesinnya kalau streaknya sedang jalan. */
export const KOLAM_JOURNEY: Kalimat[] = [
  { title: 'Yoo hoo, waktunya bareng Yesus 🙏', body: 'Lima menit pertama hari ini punya Dia.' },
  { title: 'Pagi ini ada jendela hening ✨', body: 'Sebelum yang lain ramai, temui Dia dulu.' },
  { title: 'Hari baru, halaman baru 🌅', body: 'Mulai Hariku dulu, sisanya menyusul.' },
  { title: 'Dia sudah menunggu dari tadi 💛', body: 'Morning Journey cuma butuh beberapa menit.' },
  { title: 'Satu langkah kecil, pagi ini 🌱', body: 'Bukan soal lama, soal datang.' },
];

/** 😱 Penyelamat streak: cuma dipakai kalau journey belum & streaknya hidup. */
export const KOLAM_RESCUE: Kalimat[] = [
  { title: 'Streak {streak} hari hilang tengah malam 😱', body: 'Morning Journey hari ini belum dijalani. Masih sempat.' },
  { title: 'Jangan balik ke nol 🔥', body: 'Streak {streak} hari nunggu satu langkah kecil hari ini.' },
  { title: '{streak} hari itu sayang kalau putus 💛', body: 'Buka Morning Journey sebentar, lalu tidur tenang.' },
];

export const KOLAM_BIBLE_PAGI: Kalimat[] = [
  { title: '🌅 Bacaan pagi', body: 'Satu pasal dulu sebelum hari ini dimulai.' },
  { title: '📖 Firman dulu, kopi kemudian', body: 'Jendela paginya 05.00 sampai 10.00.' },
  { title: '🌅 Isi dulu, baru dituang', body: 'Satu pasal pagi ini sudah cukup.' },
];

export const KOLAM_BIBLE_SIANG: Kalimat[] = [
  { title: '🌤️ Jeda siang', body: 'Satu pasal di sela kerja, jendelanya 12.00 sampai 14.00.' },
  { title: '📖 Istirahat yang benar-benar mengisi', body: 'Dua menit untuk firman, lalu lanjut lagi.' },
  { title: '🌤️ Bacaan siang masih kosong', body: 'Satu pasal saja, sebelum jendelanya tutup jam 14.00.' },
];

export const KOLAM_BIBLE_MALAM: Kalimat[] = [
  { title: '🌙 Tutup harinya dengan firman', body: 'Jendelanya 21.00 sampai 24.00.' },
  { title: '📖 Sebelum layar terakhir malam ini', body: 'Satu pasal, lalu tidur.' },
  { title: '🌙 Hari ini belum ditutup', body: 'Bacaan malam menunggu, jendelanya sampai tengah malam.' },
];

export const KOLAM_CORE: string[] = [
  '👥 CORE menunggu kamu',
  '👥 Gembalakan dulu hari ini',
  '👥 Ada yang perlu disapa',
  '👥 CORE hari ini',
];

export const KOLAM_WORK: string[] = [
  '💼 Yang penting duluan',
  '💼 Work hari ini',
  '💼 Satu yang paling berat, sekarang',
  '💼 Tenggat tidak menunggu',
];

export const KOLAM_LIFE: string[] = [
  '🌿 Sisa hari ini',
  '🌿 Yang kecil kecil, sekarang',
  '🌿 Life hari ini',
  '🌿 Tinggal sedikit lagi',
];

export const KOLAM_FINANCE_MALAM: Kalimat[] = [
  { title: '📝 Catat pengeluaran hari ini', body: 'Ada jajan atau ojek tadi? Catat sekarang, besok Safe to Spend jujur.' },
  { title: '💰 Dua menit, biar besok tenang', body: 'Catat yang keluar hari ini selagi masih ingat.' },
  { title: '📝 Sebelum lupa', body: 'Pengeluaran hari ini dicatat dulu, baru istirahat.' },
];

export const KOLAM_REFLEKSI: Kalimat[] = [
  { title: '📝 Refleksi hari ini', body: 'Apa yang terjadi, apa yang Tuhan ajarkan, apa yang kubawa ke besok?' },
  { title: '🌙 Sebelum hari ini ditutup', body: 'Tulis satu paragraf jujur. Tiga menit saja.' },
  { title: '💭 Hari ini mau diingat apa?', body: 'Satu hal yang kamu syukuri, satu hal yang kamu pelajari.' },
];

/** 🏆 Pencapaian yang tinggal sedikit lagi. `{sisa}` diisi mesinnya. */
export const KOLAM_ACHIEVEMENT: string[] = [
  '🏆 Tinggal sedikit lagi',
  '🏅 Hampir kebuka',
  '🏆 Satu langkah lagi',
  '🎯 Dekat banget',
];

/** Ganti penanda `{streak}` / `{sisa}` di dalam kalimat kolam. */
export function isi(teks: string, nilai: Record<string, string>): string {
  let hasil = teks;
  for (const [k, v] of Object.entries(nilai)) hasil = hasil.split(`{${k}}`).join(v);
  return hasil;
}
