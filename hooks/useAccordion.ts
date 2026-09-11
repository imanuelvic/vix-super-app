import { useState } from 'react';

// Dropdown / accordion: PALING BANYAK SATU bagian terbuka sekaligus — membuka
// satu menutup yang lain dengan sendirinya.
//
// Sengaja SATU nilai, bukan sederet boolean. Dua boolean membuat "keduanya
// terbuka" jadi keadaan yang MUNGKIN ADA, lalu harus dijaga tangan di tiap
// tombolnya; satu setter yang lupa dipanggil sudah cukup untuk merusaknya.
// Sebagai satu nilai, keadaan itu tidak bisa berbohong — dua bagian terbuka
// bersamaan mustahil, bukan sekadar "tidak sengaja terjadi".
//
// `null` = semuanya tertutup, dan itu bawaannya kecuali `awal` diisi. Bagian
// yang sedang terbuka tetap boleh di-click lagi untuk menutup: ia tidak macet
// terbuka sampai bagian lain dibuka.
//
// Kuncinya bebas asal bisa dibanding dengan `===`: nama bagian yang ditulis
// tangan ('cl' | 'mt'), id dokumen dari daftar, atau angka tier.
//
// Sebelum ini pola yang sama disalin di LIMA layar — lengkap dengan alasan di
// atas yang ikut disalin tiga kali. Menyamakannya dengan cara menyalin berarti
// kelimanya sama HANYA sampai salah satunya diubah.
export function useAccordion<K extends string | number>(awal: K | null = null) {
  const [terbuka, setTerbuka] = useState<K | null>(awal);
  return {
    /** Bagian ini yang sedang terbuka? */
    isOpen: (k: K) => terbuka === k,
    /** Buka bagian ini — atau tutup, kalau memang dia yang sedang terbuka. */
    toggle: (k: K) => setTerbuka((cur) => (cur === k ? null : k)),
  };
}
