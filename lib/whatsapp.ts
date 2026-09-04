import { openExternalUrl } from './linking';
import { waPhone } from './phone';

// Semua urusan WhatsApp ada di sini: menyusun tautannya & membukanya.
// (`waLink` dulu menumpang di lib/core.ts — padahal ia bukan soal fitur CORE.)

/** Pesan error standar saat WhatsApp gagal dibuka. */
export const WHATSAPP_ERROR =
  'Gagal membuka WhatsApp. Pastikan WhatsApp terpasang.';

/**
 * Link chat WhatsApp (wa.me) ke satu nomor, dengan pesan awal opsional.
 *
 * Nomornya dirapikan dulu lewat `waPhone`, bukan sekadar ditempeli "62" di
 * depan. Dua fitur menyimpannya dengan cara berbeda sejak lama — CORE menyimpan
 * digit SESUDAH +62 ("812…"), Fun Futsal menyimpan bentuk lokal ("0812…") — dan
 * penempelan buta membuat nomor Fun Futsal jadi "62 0812…", yang tidak pernah
 * membuka chat ke orang yang benar.
 */
export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/${waPhone(phone)}`;
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
