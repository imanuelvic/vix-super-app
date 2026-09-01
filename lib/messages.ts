// Pesan status yang dipakai berulang di banyak layar/fitur. Dikumpulkan di
// sini supaya seragam & gampang diubah sekali untuk semua tempat.

/** Gagal memuat/subscribe data dari Firestore (biasanya masalah koneksi). */
export const LOAD_ERROR = 'Gagal memuat data. Coba lagi.';

/** Gagal menyimpan (tambah/ubah) data ke Firestore. */
export const SAVE_ERROR = 'Gagal menyimpan. Coba lagi.';

/** Gagal menghapus data dari Firestore. */
export const DELETE_ERROR = 'Gagal menghapus. Coba lagi.';

/** Gagal mengambil/memilih foto (kamera atau galeri). */
export const PHOTO_ERROR = 'Gagal mengambil foto. Coba lagi.';

// ---------- Versi yang menyebut APA yang gagal ----------
// Beberapa layar sengaja menyebut isinya ("Gagal memuat mutasi") — di layar
// yang memuat beberapa hal sekaligus, "Gagal memuat data" tidak memberi tahu
// yang mana. Dulu tiap layar merangkai kalimatnya sendiri, jadi akhirannya
// sempat beragam ("Coba lagi." vs "Coba lagi ya."). Sekarang bentuknya satu.
//
// ⚠️ Akhirannya memang beda dari LOAD_ERROR di atas ("Cek koneksi internet."
// vs "Coba lagi.") — itu warisan, bukan keputusan. Teksnya dipertahankan persis
// supaya tidak ada tampilan yang berubah diam-diam.

/** "Gagal memuat mutasi. Cek koneksi internet." */
export function loadErrorOf(apa: string): string {
  return `Gagal memuat ${apa}. Cek koneksi internet.`;
}

/** "Gagal menyimpan budget. Coba lagi." */
export function saveErrorOf(apa: string): string {
  return `Gagal menyimpan ${apa}. Coba lagi.`;
}

/** "Gagal menghapus target. Coba lagi." */
export function deleteErrorOf(apa: string): string {
  return `Gagal menghapus ${apa}. Coba lagi.`;
}
