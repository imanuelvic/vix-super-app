import { Linking } from 'react-native';

// Membuka tautan / aplikasi DI LUAR app ini.
//
// Polanya selalu sama di mana-mana: coba skema aplikasinya dulu, kalau gagal
// (app-nya belum terpasang / skemanya tak dikenali) jatuh ke alamat web atau
// halaman toko supaya tombolnya tidak terasa mati. Dulu blok try/catch yang
// sama ditulis ulang di banyak tempat — sekarang satu pintu.

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
