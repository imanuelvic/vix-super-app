// ============ 🍽️ Perjalanan sebelum mengambil puasa (28 Sep 2026) ============
//
// Sampai sekarang "Tambah Puasa Baru" langsung membuka formulir: nama, pokok
// doa, peraturan, tanggal, simpan. Cepat — dan justru itu masalahnya.
//
// Puasa yang diisi dalam 30 detik gampang sekali berubah jadi rutinitas: kotak
// terisi, tanggal terpasang, tapi tidak ada satu momen pun yang memaksa
// menjawab "kenapa aku melakukan ini?". Sebulan kemudian yang tersisa cuma
// catatan yang rapi.
//
// Jadi sebelum formulirnya, ada tiga langkah yang harus dilewati, dan
// ketiganya pertanyaan, bukan isian:
//
//   1. KENAPA   — puasa itu apa, dan bukan apa. Satu ayat, satu paragraf.
//   2. FOKUS    — satu hal saja. Pilihannya sengaja sedikit & tajam.
//   3. LEPAS    — apa yang benar-benar kamu lepas selama puasa ini.
//
// Tidak ada tombol "lewati". Bukan untuk mempersulit: tiga langkah ini MEMANG
// isi puasanya, dan melewatinya sama dengan mengambil puasa tanpa tahu untuk
// apa. Yang buru-buru boleh menutup layarnya dan kembali nanti.
//
// Hasil pilihan langkah 2 & 3 mengisi formulirnya (pokok doa & peraturan),
// jadi tidak ada pekerjaan yang terbuang — ketiga langkah itu justru
// memotong waktu mengetik.

export type FastingFocus = {
  key: string;
  emoji: string;
  label: string;
  /** Kalimat pokok doa yang mengisi formulirnya. */
  prayer: string;
  /** Pertanyaan yang menemani pilihan ini — dibaca sebelum memilih. */
  ask: string;
};

/**
 * Enam fokus, dan sengaja TIDAK lebih.
 *
 * Daftar panjang membuat memilih terasa seperti belanja; enam membuatnya
 * terasa seperti memutuskan. Semuanya ditulis sebagai keadaan yang jujur
 * ("ada dosa yang berulang"), bukan sebagai target rohani yang manis.
 */
export const FASTING_FOCUSES: FastingFocus[] = [
  {
    key: 'kudus',
    emoji: '🕊️',
    label: 'Hidup kudus',
    prayer:
      'Tuhan, kuduskan hidupku. Tunjukkan yang tidak berkenan di hadapan-Mu, dan beri aku kekuatan untuk melepaskannya.',
    ask: 'Ada bagian hidupmu yang kamu tahu tidak berkenan, tapi kamu diamkan?',
  },
  {
    key: 'dosa',
    emoji: '⛓️',
    label: 'Lepas dari dosa yang berulang',
    prayer:
      'Tuhan, aku jatuh di hal yang sama berkali-kali. Aku tidak sanggup sendiri. Putuskan rantainya, dan ajar aku berjalan keluar.',
    ask: 'Dosa apa yang sudah berkali-kali kamu akui, tapi belum lepas?',
  },
  {
    key: 'arah',
    emoji: '🧭',
    label: 'Arah & keputusan besar',
    prayer:
      'Tuhan, aku butuh arah-Mu, bukan sekadar restu untuk rencanaku sendiri. Bicaralah, aku mau taat walau berat.',
    ask: 'Keputusan apa yang sedang menunggumu, dan kamu belum yakin?',
  },
  {
    key: 'keluarga',
    emoji: '🏠',
    label: 'Keluarga & orang terdekat',
    prayer:
      'Tuhan, jamah keluargaku. Pulihkan yang retak, jaga yang sehat, dan pakai aku jadi damai di rumah.',
    ask: 'Siapa di rumahmu yang paling butuh dijamah Tuhan sekarang?',
  },
  {
    key: 'pelayanan',
    emoji: '🔥',
    label: 'Pelayanan & CORE',
    prayer:
      'Tuhan, jangan biarkan pelayananku jadi rutinitas. Isi lagi hatiku, dan beri hikmat menggembalakan orang-orang yang Kau percayakan.',
    ask: 'Pelayananmu sedang mengalir, atau sedang kamu jalani karena harus?',
  },
  {
    key: 'terobosan',
    emoji: '🌄',
    label: 'Terobosan yang sedang ditunggu',
    prayer:
      'Tuhan, aku sudah lama menunggu. Aku mau tetap percaya walau belum kelihatan. Kehendak-Mu yang jadi, bukan kehendakku.',
    ask: 'Apa yang sudah lama kamu doakan tanpa jawaban?',
  },
];

export type FastingRule = {
  key: string;
  emoji: string;
  label: string;
  /** Isi kolom "Peraturan puasa saya". */
  text: string;
};

/**
 * Bentuk pantangannya. Yang dilepas harus SESUATU YANG TERASA — puasa yang
 * tidak terasa tidak mengingatkan apa pun.
 */
export const FASTING_RULES: FastingRule[] = [
  {
    key: 'makan',
    emoji: '🍽️',
    label: 'Makan',
    text: 'Makan hanya jam 12.00 sampai 19.00. Di luar itu air putih saja.',
  },
  {
    key: 'sosmed',
    emoji: '📵',
    label: 'Media sosial',
    text: 'Tanpa Instagram & TikTok sepanjang puasa. Waktu yang biasanya ke sana, dipakai berdoa.',
  },
  {
    key: 'hiburan',
    emoji: '🎬',
    label: 'Hiburan',
    text: 'Tanpa film, series, & game sepanjang puasa.',
  },
  {
    key: 'gabungan',
    emoji: '🔒',
    label: 'Makan + media sosial',
    text: 'Makan hanya jam 12.00 sampai 19.00, dan tanpa media sosial sepanjang puasa.',
  },
];

/** Ayat & kalimat pembuka langkah 1 — dibaca dulu sebelum apa pun dipilih. */
export const FASTING_WHY = {
  verseRef: 'Yesaya 58:6',
  verseText:
    'Bukankah berpuasa yang Kukehendaki, ialah supaya engkau membuka belenggu-belenggu kelaliman, dan melepaskan tali-tali kuk.',
  lines: [
    'Puasa bukan cara menukar lapar dengan jawaban doa. Tuhan tidak bisa dibayar.',
    'Puasa itu melepas sesuatu yang biasa mengisimu, supaya yang kosong itu mengingatkanmu pada Dia berkali-kali dalam sehari.',
    'Jadi kalau puasa ini cuma jadi jadwal yang dicentang, ia sudah kehilangan gunanya sejak hari pertama.',
  ],
} as const;

/** Judul otomatis periode puasa dari fokusnya, mis. "Hidup kudus - Sep 2026". */
export function fastingTitleOf(focus: FastingFocus, monthLabel: string): string {
  return `${focus.label} - ${monthLabel}`;
}
