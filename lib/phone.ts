// Nomor HP Indonesia — SATU tempat untuk dua bentuknya.
//
// Nomor yang sama ditulis orang dengan setidaknya empat cara, dan semuanya
// pernah masuk ke app ini lewat tempel dari kontak/WhatsApp:
//
//   +62 812-4204-3658 · 62 812 4204 3658 · 0812-4204-3658 · 081242043658
//
// Dulu tiap kolom menyimpan apa adanya, jadi tanda "+", spasi & tanda hubung
// ikut tersimpan — dan yang membacanya (tautan wa.me) tidak pernah tahu bentuk
// mana yang datang. Modul ini memisahkan dua pertanyaan yang memang berbeda:
//
//   • `localPhone` — bagaimana MENAMPILKANNYA di kolom isian: "081242043658".
//   • `waPhone`    — bagaimana MENGIRIMKANNYA ke wa.me: "6281242043658".
//
// Keduanya menerima bentuk apa pun di atas. Jadi kolom isian boleh dirapikan
// tanpa membongkar data lama: yang tersimpan bentuk apa pun tetap terbaca.

/** Buang semua yang bukan angka: "+62 812-4204" → "628124204". */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Bentuk LOKAL untuk ditampilkan & diketik: "081242043658".
 *
 * Dipakai `onChangeText` semua kolom nomor HP, jadi menempel "+62 812-4204-3658"
 * langsung berubah jadi bentuk ini di depan matamu — bukan tersimpan diam-diam
 * dengan tanda baca yang tak terbaca siapa pun.
 *
 * Dua aturan saja, dan keduanya aman ditengah pengetikan:
 *   • kode negara 62 di depan → diganti "0" (nomor lokal tak pernah mulai 62)
 *   • mulai "8" tanpa nol → dinolkan (semua nomor HP Indonesia mulai "08")
 * Selain itu apa adanya — angka setengah jadi tidak pernah dipaksa berubah.
 */
export function localPhone(raw: string): string {
  const d = phoneDigits(raw);
  if (d.startsWith('62')) return `0${d.slice(2)}`;
  if (d.startsWith('8')) return `0${d}`;
  return d;
}

/**
 * Bentuk untuk tautan wa.me: "6281242043658" — kode negara, tanpa "+".
 *
 * Menerima bentuk apa pun, termasuk yang TERSIMPAN di CORE (digit sesudah +62,
 * mis. "81242043658") maupun di Fun Sport (bentuk lokal "0812…"). Itu penting:
 * dua fitur menyimpannya dengan cara berbeda sejak lama, dan tautannya dulu
 * cuma menempelkan "62" di depan apa pun yang datang — nomor Fun Sport jadi
 * "62081242043658" dan chatnya tak pernah terbuka ke orang yang benar.
 */
export function waPhone(raw: string): string {
  let d = phoneDigits(raw);
  if (d.startsWith('62')) d = d.slice(2);
  while (d.startsWith('0')) d = d.slice(1);
  return `62${d}`;
}
