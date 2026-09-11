import * as Haptics from 'expo-haptics';

// Getaran halus (haptic) saat menyentuh sesuatu — inilah yang bikin click
// terasa "nyata", bukan sekadar gambar yang berkedip. Ini juga yang bikin app
// seperti Instagram/TikTok terasa mahal walau animasinya sederhana.
//
// HANYA iOS. Getaran Android memakai motor biasa (kasar & boros baterai),
// sedangkan iPhone punya Taptic Engine yang halus. Di platform lain fungsi ini
// diam saja, jadi aman dipanggil dari mana pun tanpa pengecekan tambahan.
//
// Catatan build: `expo-haptics` SUDAH terpasang dan SUDAH ikut di binary yang
// berjalan sekarang (dipakai <HapticTab/> pada tab bar bawah), jadi memakainya
// di sini TIDAK butuh build EAS baru — cukup `eas update`.

export type HapticKind =
  | 'light' // click biasa: kartu, chip, tab, tombol kecil
  | 'medium' // aksi berbobot: tombol aksi utama, konfirmasi
  | 'success' // berhasil: kebiasaan tercentang, data tersimpan
  | 'warning' // hati-hati: membuka konfirmasi hapus
  | 'error'; // gagal

function trigger(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    default:
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Getarkan sekali. Sengaja "tembak & lupakan": kalau getarannya gagal (mis. di
 * simulator atau perangkat tanpa Taptic Engine) aksi utamanya tidak boleh ikut
 * error — makanya errornya ditelan diam-diam.
 */
export function haptic(kind: HapticKind = 'light') {
  if (process.env.EXPO_OS !== 'ios') return;
  trigger(kind).catch(() => {});
}
