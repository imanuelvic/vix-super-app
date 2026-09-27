// =================== ✝️ God's Big Story (28 Sep 2026) ===================
//
// Lima babak cerita besar Alkitab, dari Understanding God's Story · Gospel
// Practices · Discover Church:
//
//   CREATION → FALL → REDEMPTION → RENEWAL → RESTORATION
//                      ‾‾‾‾‾‾‾‾‾   ‾‾‾‾‾‾‾   ‾‾‾‾‾‾‾‾‾‾‾
//                    Justification Sanctification Glorification
//
// ── Kenapa ini ada di app ───────────────────────────────────────────────
// Seluruh app ini mengurus HARI INI: baris hari ini, streak hari ini, badge
// hari ini. Yang tidak pernah disebut di mana pun: hari ini itu bagian dari
// apa. Dan kalau satu-satunya yang terlihat cuma daftar harian, gagal sehari
// terasa seperti gagal total.
//
// Babak yang sedang kamu jalani adalah RENEWAL, dan namanya **pengudusan**:
// sebuah proses yang memang BELUM selesai, dan tidak seharusnya selesai
// sekarang. Itu bukan penghiburan murahan, itu letak yang benar. Pembenaran
// (justification) sudah SELESAI dikerjakan Yesus, pemuliaan (glorification)
// belum tiba, dan di antara keduanya tugasnya satu: terus hidup kudus, terus
// hidup berkenan, terus melayani.
//
// Isinya statis di kode, bukan Firestore: ia tidak berubah-ubah dan tidak
// perlu disinkronkan antar-perangkat — jadi nol pembacaan.

export type GospelAct = {
  key: string;
  /** Nama babaknya dalam bahasa aslinya — istilah ini yang dipakai di gereja. */
  title: string;
  /** Terjemahan singkatnya, supaya tidak jadi istilah yang cuma dihafal. */
  titleId: string;
  emoji: string;
  /** Kalimat inti babak ini. */
  summary: string;
  /** Acuan ayatnya, siap dibuka di YouVersion. */
  verseRef: string;
  /** Kutipan ayatnya (TB, dipendekkan seperlunya). */
  verseText: string;
  /**
   * Nama tahap keselamatan yang jatuh di babak ini (Justification ·
   * Sanctification · Glorification). Kosong = babak itu memang tidak punya.
   */
  stage: string;
  stageId: string;
  /** Apa artinya untuk hidupmu hari ini. */
  now: string;
};

/** Babak yang SEDANG dijalani setiap pengikut Kristus hari ini. */
export const GOSPEL_HERE = 'renewal';

export const GOSPEL_ACTS: GospelAct[] = [
  {
    key: 'creation',
    title: 'Creation',
    titleId: 'Penciptaan',
    emoji: '🌍',
    summary: 'Tuhan menjadikan segala sesuatu, dan semuanya amat baik.',
    verseRef: 'Kejadian 1:31',
    verseText:
      'Maka Allah melihat segala yang dijadikan-Nya itu, sungguh amat baik.',
    stage: '',
    stageId: '',
    now: 'Kamu bukan kecelakaan. Kamu dirancang, dan rancangan itu baik sejak awal.',
  },
  {
    key: 'fall',
    title: 'Fall',
    titleId: 'Kejatuhan',
    emoji: '🌑',
    summary: 'Dosa masuk, dan semua orang kehilangan kemuliaan Allah.',
    verseRef: 'Roma 3:23',
    verseText:
      'Karena semua orang telah berbuat dosa dan telah kehilangan kemuliaan Allah.',
    stage: '',
    stageId: '',
    now: 'Yang rusak bukan cuma dunia di luar sana. Termasuk aku, termasuk kamu.',
  },
  {
    key: 'redemption',
    title: 'Redemption',
    titleId: 'Penebusan',
    emoji: '✝️',
    summary:
      'Dibenarkan dengan cuma-cuma oleh kasih karunia, lewat penebusan Kristus Yesus.',
    verseRef: 'Roma 3:24',
    verseText:
      'Dan oleh kasih karunia telah dibenarkan dengan cuma-cuma karena penebusan dalam Kristus Yesus.',
    stage: 'Justification',
    stageId: 'Pembenaran',
    now: 'Sudah SELESAI, bukan sedang diusahakan. Tidak ada yang bisa kamu tambahkan.',
  },
  {
    key: 'renewal',
    title: 'Renewal',
    titleId: 'Pembaruan',
    emoji: '🔥',
    summary: 'Dia yang duduk di atas takhta berkata: Aku menjadikan semuanya baru.',
    verseRef: 'Wahyu 21:5',
    verseText:
      'Ia yang duduk di atas takhta itu berkata: Lihatlah, Aku menjadikan segala sesuatu baru!',
    stage: 'Sanctification',
    stageId: 'Pengudusan',
    now: 'Di sinilah kamu sekarang. Belum selesai, dan memang belum waktunya selesai. Tugasnya satu: terus hidup kudus, terus berkenan, terus melayani.',
  },
  {
    key: 'restoration',
    title: 'Restoration',
    titleId: 'Pemulihan',
    emoji: '👑',
    summary:
      'Sorga menyimpan Dia sampai tiba waktunya Allah memulihkan segala sesuatu.',
    verseRef: 'Kisah Para Rasul 3:21',
    verseText:
      'Kristus itu harus tinggal di sorga sampai waktu pemulihan segala sesuatu.',
    stage: 'Glorification',
    stageId: 'Pemuliaan',
    now: 'Belum tiba. Jadi kalau hari ini masih berat, itu bukan tanda ceritanya gagal.',
  },
];

/** Babak yang sedang dijalani — dipakai penanda 📍 "kamu di sini". */
export function gospelHereAct(): GospelAct {
  return GOSPEL_ACTS.find((a) => a.key === GOSPEL_HERE) ?? GOSPEL_ACTS[0];
}
