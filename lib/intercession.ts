// Doa Syafaat (Intercessory Prayer) 🙏 — pokok doa TETAP untuk tiap hari dalam
// seminggu. Tidak disimpan di Firestore: jadwalnya sengaja dikunci di kode
// supaya ritmenya konsisten & tidak bisa "digeser" sendiri saat malas.
//
// ── Sumbernya (23 Sep 2026) ───────────────────────────────────────────────
// Jadwal ini BUKAN karangan app: ini daftar syafaat pemiliknya sendiri, yang
// sudah bertahun-tahun didoakan bergantian tiap malam (catatan "Prayer List
// 🙏 · every night"). Dulu app memakai jadwal buatan sendiri (Keluarga ·
// Kesehatan, Doa Rantai CL, dst) yang tidak pernah ia tulis. Sekarang satu
// sumber saja, dan sumbernya punya dia:
//
//   Minggu Keluarga & Saudara       Kamis  Bangsa dan Negara Indonesia
//   Senin  Teman Eben Haezar        Jumat  Teman CORE & Gereja
//   Selasa Teman PO & BASIC         Sabtu  Dunia
//   Rabu   Teman GAT & Kawanua
//
// Dipakai TIGA kali:
//   • Pagi   → langkah 🙏 Pray di Morning Journey (app/morning-journey.tsx)
//   • Siang  → kartu Doa Syafaat di layar Today
//   • Malam  → bagian ke-4 Night Prayer (app/night-prayer.tsx)
//
// Hari Sabtu isinya paling panjang (9 pokok sedunia), jadi yang ditampilkan
// BERPUTAR tiga pokok tiap pekan. Bobot tiap malam jadi setara, dan dalam tiga
// pekan seluruhnya kebagian.

import { dayNumber } from './format';

/** Kunci topik. `nation` & `church` punya lapisan berita (lib/prayerNews.ts). */
type IntercessionKey =
  | 'family'
  | 'eben'
  | 'po-basic'
  | 'gat-kawanua'
  | 'nation'
  | 'church'
  | 'world';

export type IntercessionTopic = {
  key: IntercessionKey;
  emoji: string;
  label: string;
  points: string[];
};

/**
 * Sabtu: 9 pokok doa sedunia, ditampilkan tiga-tiga per pekan.
 * Urutannya persis daftar aslinya, jadi yang ke-6 tetap membawa empat
 * turunannya sekaligus.
 */
const DUNIA: string[] = [
  'Dunia, damai & lepas dari peperangan',
  'Gereja di seluruh bumi, satu tubuh & tidak takut',
  'Rumah sakit: yang sakit, keluarganya & yang merawat',
  'Penjara: yang di dalam bertobat & dipulihkan',
  'ISIS, antikris & teroris, kuasanya dipatahkan',
  'Pergeseran dunia: percepatan teknologi, gerakan anti agama, manusia menjadi dewa, pergeseran nilai generasi',
  'Korban bencana: perlindungan, pertolongan & pemulihan',
  'Yatim piatu & panti jompo, ada yang menemani',
  'Orang yang tidak punya rumah, dicukupkan & ditolong',
];

/** Berapa pokok dunia yang didoakan tiap Sabtu. */
export const DUNIA_PER_PEKAN = 3;

/** Index = hasil `Date.getDay()`: 0 Minggu … 6 Sabtu. */
const INTERCESSION_WEEK: IntercessionTopic[] = [
  // 0 — Minggu
  {
    key: 'family',
    emoji: '👨‍👩‍👧',
    label: 'Keluarga & Saudara',
    points: [
      'Papa, mama & saudara, sebut namanya satu per satu',
      'Kesehatan, ekonomi & kesatuan hati seisi rumah',
      'Keluarga jadi mezbah doa, bukan sekadar tempat tinggal',
    ],
  },
  // 1 — Senin
  {
    key: 'eben',
    emoji: '🎓',
    label: 'Teman Eben Haezar',
    points: [
      'Teman-teman Eben Haezar, sebut yang terlintas malam ini',
      'Yang sedang bergumul: studi, kerja & keluarganya',
      'Yang belum mengenal Tuhan, dibukakan hatinya',
    ],
  },
  // 2 — Selasa
  {
    key: 'po-basic',
    emoji: '📖',
    label: 'Teman PO & BASIC',
    points: [
      'Teman-teman PO & BASIC, sebut namanya',
      'Pertumbuhan rohani & kesetiaan ikut persekutuan',
      'Pengurus & pembina yang melayani mereka',
    ],
  },
  // 3 — Rabu
  {
    key: 'gat-kawanua',
    emoji: '🤝',
    label: 'Teman GAT & Kawanua',
    points: [
      'Teman-teman GAT & Kawanua, sebut namanya',
      'Pekerjaan, studi & keluarga mereka',
      'Kesempatan jadi berkat buat mereka',
    ],
  },
  // 4 — Kamis
  {
    key: 'nation',
    emoji: '🇮🇩',
    label: 'Bangsa dan Negara Indonesia',
    points: [
      'Presiden & para pemimpin bangsa, hikmat & hati takut Tuhan',
      'Damai sejahtera, keadilan & kerukunan antarumat beragama',
      'Ekonomi bangsa, lapangan kerja & harga kebutuhan pokok',
      'Kebangunan rohani atas Indonesia',
    ],
  },
  // 5 — Jumat
  {
    key: 'church',
    emoji: '⛪',
    label: 'Teman CORE & Gereja',
    points: [
      'Teman CORE & jemaat, sebut namanya satu per satu',
      'Pendeta & para pemimpin gereja, hikmat & kemurnian hati',
      'Murid-murid Tuhan yang sedang dibangun, tetap setia',
      'Album & lagu Kristen yang sedang dikerjakan, jadi berkat',
    ],
  },
  // 6 — Sabtu (pokoknya diisi `intercessionToday`, berputar tiap pekan)
  {
    key: 'world',
    emoji: '🌏',
    label: 'Dunia',
    points: [],
  },
];

/** Tiga pokok dunia untuk pekan ini (berurutan, memutar, tidak acak). */
export function duniaPekanIni(now: Date): string[] {
  const pekan = Math.floor(dayNumber(now) / 7);
  const mulai = (pekan * DUNIA_PER_PEKAN) % DUNIA.length;
  return Array.from(
    { length: DUNIA_PER_PEKAN },
    (_, i) => DUNIA[(mulai + i) % DUNIA.length],
  );
}

/** Pokok doa syafaat untuk hari ini. */
export function intercessionToday(now: Date): IntercessionTopic {
  const topik = INTERCESSION_WEEK[now.getDay()];
  if (topik.key !== 'world') return topik;
  return { ...topik, points: duniaPekanIni(now) };
}
