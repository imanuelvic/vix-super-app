import { Linking } from 'react-native';

// Helper berbagi teks ke WhatsApp tanpa nomor tujuan (user pilih chat sendiri).
// Untuk chat ke NOMOR tertentu (mis. CORE Leader), pakai `waLink` di lib/core.

/** Pesan error standar saat WhatsApp gagal dibuka. */
export const WHATSAPP_ERROR =
  'Gagal membuka WhatsApp. Pastikan WhatsApp terpasang.';

/**
 * Buka WhatsApp dengan teks siap kirim — user tinggal pilih chat tujuannya.
 * Kalau WhatsApp tak terpasang, jatuh ke tautan web wa.me. `onError` dipanggil
 * bila dua-duanya gagal.
 */
export async function shareTextToWhatsApp(text: string, onError?: () => void) {
  const encoded = encodeURIComponent(text);
  try {
    await Linking.openURL(`whatsapp://send?text=${encoded}`);
  } catch {
    Linking.openURL(`https://wa.me/?text=${encoded}`).catch(() => onError?.());
  }
}
