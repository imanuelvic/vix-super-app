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
// jalan — sesampainya di sana, lambang gelombang suaranya tinggal diklik.
//
// (Kalau mau benar-benar satu tekan ke Voice: iOS punya pintasan ChatGPT
// untuk tombol Aksi & Pusat Kontrol — itulah layar yang kamu potret.)
const CHATGPT_SCHEME = 'chatgpt://';
const CHATGPT_WEB = 'https://chatgpt.com/';

export function openChatGpt() {
  return openExternalUrl(CHATGPT_SCHEME, { fallback: CHATGPT_WEB });
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
