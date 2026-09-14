import { Linking } from 'react-native';

// Membuka tautan / aplikasi DI LUAR app ini.
//
// Polanya selalu sama di mana-mana: coba skema aplikasinya dulu, kalau gagal
// (app-nya belum terpasang / skemanya tak dikenali) jatuh ke alamat web atau
// halaman toko supaya tombolnya tidak terasa mati. Dulu blok try/catch yang
// sama ditulis ulang di banyak tempat — sekarang satu pintu.

// ChatGPT 💬 — dipakai sub-tab Discussion di Learning untuk melatih topik
// minggu ini dengan bicara, bukan mengetik.
//
// ⚠️ YANG DIBUKA APLIKASINYA, BUKAN MODE VOICE-NYA.
//
// OpenAI belum membuka tautan yang menembus langsung ke Voice: skema
// `chatgpt://` cuma membuka app-nya, dan permintaan untuk `chatgpt://voice`
// masih berstatus usulan di forum mereka. Menebak alamat yang tidak ada cuma
// menghasilkan tombol yang terasa mati, jadi yang dipakai skema yang MEMANG
// jalan — sesampainya di sana, lambang gelombang suaranya tinggal di-click.
//
// (Kalau mau benar-benar satu tekan ke Voice: iOS punya pintasan ChatGPT
// untuk tombol Aksi & Pusat Kontrol — itulah layar yang kamu potret.)
const CHATGPT_SCHEME = 'chatgpt://';
const CHATGPT_WEB = 'https://chatgpt.com/';

export function openChatGpt() {
  return openExternalUrl(CHATGPT_SCHEME, { fallback: CHATGPT_WEB });
}

// Project ChatGPT pribadi (mis. "Business - vix Super App") — tujuan tombol ✨
// di sheet Catatan Hari Ini (Habits), supaya catatannya langsung dirapikan di
// obrolan yang memang sudah tahu konteksnya.
//
// CARA MENGISI: buka chatgpt.com di browser laptop › sidebar › click
// project-nya › salin alamat di bilah alamat. Bentuknya:
//   https://chatgpt.com/g/g-p-xxxxxxxxxxxxxxxxxxxxxxxx-business-vix-super-app/project
// Kosong → tombolnya membuka ChatGPT saja (obrolan baru).
//
// Ini UNIVERSAL LINK: app ChatGPT iOS mengklaim jalur chatgpt.com/g/* di
// apple-app-site-association-nya, jadi iOS membuka app-nya langsung di project
// itu (tanpa app → Safari). Alamatnya bukan rahasia: project pribadi hanya
// terbuka untuk akun pemiliknya, orang lain cuma dapat "tidak ditemukan".
//
// Isi catatannya TIDAK dititipkan lewat ?q= : OpenAI hanya menjamin ?q= untuk
// obrolan baru di web, dan di app iOS-nya tidak diproses. Karena itu tombol ✨
// menyalin catatan ke papan klip dulu, lalu tinggal tempel di sana.
//
// Diisi 14 Sep 2026 dengan halaman PROJECT-nya (…/project), bukan salah satu
// obrolan di dalamnya (…/c/<id>): tiap catatan harian memang sebaiknya jadi
// obrolan baru yang masih membawa instruksi & berkas project-nya.
export const CHATGPT_PROJECT_URL =
  'https://chatgpt.com/g/g-p-6a9d2d0b760c8191944d6c0a8f252e09/project';

export function openChatGptProject() {
  if (!CHATGPT_PROJECT_URL) return openChatGpt();
  return openExternalUrl(CHATGPT_PROJECT_URL, { fallback: CHATGPT_WEB });
}

/**
 * Buka `url`. Kalau gagal & `fallback` diisi, tautan cadangannya yang dibuka.
 * `onError` hanya dipanggil kalau SEMUA percobaan gagal.
 *
 * Tidak pernah melempar: pemanggilnya tak perlu membungkus try/catch sendiri,
 * dan tidak ada Promise gagal yang menggantung tanpa penangan.
 */
export async function openExternalUrl(
  url: string,
  { fallback, onError }: { fallback?: string; onError?: () => void } = {},
): Promise<void> {
  try {
    await Linking.openURL(url);
    return;
  } catch {
    // Lanjut ke cadangan di bawah.
  }
  if (!fallback) {
    onError?.();
    return;
  }
  try {
    await Linking.openURL(fallback);
  } catch {
    onError?.();
  }
}
