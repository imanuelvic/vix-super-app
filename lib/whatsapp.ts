import { openExternalUrl } from './linking';

// Semua urusan WhatsApp ada di sini: menyusun tautannya & membukanya.
// (`waLink` dulu menumpang di lib/core.ts — padahal ia bukan soal fitur CORE.)

/** Pesan error standar saat WhatsApp gagal dibuka. */
export const WHATSAPP_ERROR =
  'Gagal membuka WhatsApp. Pastikan WhatsApp terpasang.';

/** Link chat WhatsApp (wa.me) ke satu nomor, dengan pesan awal opsional. */
export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/62${phone}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Buka WhatsApp dengan teks siap kirim TANPA nomor tujuan — user memilih
 * chat/grupnya sendiri. Kalau WhatsApp tak terpasang, jatuh ke tautan web
 * wa.me. `onError` dipanggil bila dua-duanya gagal.
 */
export function shareTextToWhatsApp(text: string, onError?: () => void) {
  const encoded = encodeURIComponent(text);
  return openExternalUrl(`whatsapp://send?text=${encoded}`, {
    fallback: `https://wa.me/?text=${encoded}`,
    onError,
  });
}

/** Buka chat WhatsApp ke NOMOR tertentu, pesannya sudah terisi. */
export function openWhatsAppChat(
  phone: string,
  text: string,
  onError?: () => void,
) {
  return openExternalUrl(waLink(phone, text), { onError });
}
