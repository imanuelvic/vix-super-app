// Pesan status yang dipakai berulang di banyak layar/fitur. Dikumpulkan di
// sini supaya seragam & gampang diubah sekali untuk semua tempat.

/** Gagal memuat/subscribe data dari Firestore (biasanya masalah koneksi). */
export const LOAD_ERROR = 'Gagal memuat data. Cek koneksi internet.';

/** Gagal menyimpan (tambah/ubah) data ke Firestore. */
export const SAVE_ERROR = 'Gagal menyimpan. Cek koneksi internet.';

/** Gagal menghapus data dari Firestore. */
export const DELETE_ERROR = 'Gagal menghapus. Coba lagi.';
