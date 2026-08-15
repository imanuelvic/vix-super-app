// Doa Syafaat (Intercessory Prayer) 🙏 — pokok doa TETAP untuk tiap hari dalam
// seminggu. Tidak disimpan di Firestore: jadwalnya sengaja dikunci di kode
// supaya ritmenya konsisten & tidak bisa "digeser" sendiri saat malas.
//
//   Senin  Keluarga · Kesehatan      Jumat  Keluarga · Kesatuan
//   Selasa Doa Rantai CL             Sabtu  Gereja
//   Rabu   Keluarga · Ekonomi        Minggu Negara
//   Kamis  Doa Rantai CL
//
// Dipakai DUA kali sehari:
//   • Pagi  → langkah WAJIB di Morning Gateway (app/morning-prayer.tsx)
//   • Malam → kartu pengingat di Home, biar didoakan sekali lagi sebelum tidur
//
// Hari "Doa Rantai CL" tidak punya pokok doa karangan sendiri — sumbernya
// pokok doa bulanan tiap CORE Leader (lib/core.ts), jadi kartunya mengarah ke
// CORE → Follow Up.

export type IntercessionKey =
  | 'family-health'
  | 'family-economy'
  | 'family-unity'
  | 'chain'
  | 'church'
  | 'nation';

export type IntercessionTopic = {
  key: IntercessionKey;
  emoji: string;
  label: string;
  points: string[];
};

// Selasa & Kamis memakai objek yang SAMA (satu sumber, tidak digandakan).
const CHAIN: IntercessionTopic = {
  key: 'chain',
  emoji: '🔗',
  label: 'Doa Rantai CL',
  points: [
    'Doakan pokok doa tiap CORE Leader yang giliran hari ini',
    'Tanyakan perkembangan pergumulannya — jangan cuma didoakan, di-follow up',
  ],
};

/** Index = hasil `Date.getDay()`: 0 Minggu … 6 Sabtu. */
export const INTERCESSION_WEEK: IntercessionTopic[] = [
  // 0 — Minggu
  {
    key: 'nation',
    emoji: '🇮🇩',
    label: 'Negara',
    points: [
      'Presiden & para pemimpin bangsa — hikmat, hati takut Tuhan, bersih dari korupsi',
      'Damai sejahtera, keadilan & kerukunan antarumat beragama',
      'Ekonomi bangsa, lapangan kerja & harga kebutuhan pokok',
      'Kebangunan rohani atas Indonesia — gereja jadi terang di tengah bangsa',
    ],
  },
  // 1 — Senin
  {
    key: 'family-health',
    emoji: '🩺',
    label: 'Keluarga · Kesehatan',
    points: [
      'Kesehatan papa & mama — kekuatan, umur panjang & pemulihan',
      'Perlindungan seisi rumah dari penyakit & kecelakaan',
      'Pola makan, istirahat & olahraga tiap anggota keluarga',
      'Kesehatan pasangan — fisik, jiwa & pikirannya',
    ],
  },
  // 2 — Selasa
  CHAIN,
  // 3 — Rabu
  {
    key: 'family-economy',
    emoji: '💰',
    label: 'Keluarga · Ekonomi',
    points: [
      'Kecukupan & hikmat mengelola keuangan keluarga',
      'Pekerjaan/usaha papa, mama & saudara — dibukakan pintu & diberkati',
      'Lepas dari hutang, sampai ada kelebihan untuk memberi',
      'Persiapan ekonomi menuju pernikahan bersama pasangan',
    ],
  },
  // 4 — Kamis
  CHAIN,
  // 5 — Jumat
  {
    key: 'family-unity',
    emoji: '🤝',
    label: 'Keluarga · Kesatuan',
    points: [
      'Kesatuan hati papa, mama & saudara — satu rumah, satu arah',
      'Pengampunan & pemulihan relasi yang sempat renggang',
      'Keluarga jadi mezbah doa, bukan sekadar tempat tinggal',
      'Kesatuan visi & hati dengan pasangan',
    ],
  },
  // 6 — Sabtu
  {
    key: 'church',
    emoji: '⛪',
    label: 'Gereja',
    points: [
      'Gembala & para pemimpin gereja — hikmat, kekuatan & kemurnian hati',
      'Ibadah besok: hadirat Tuhan turun & jiwa-jiwa baru dimenangkan',
      'CORE & Main Team bertumbuh, tiap anggota dipulihkan',
      'Kesatuan tubuh Kristus — tidak ada perpecahan di antara pelayan',
    ],
  },
];

/** Pokok doa syafaat untuk hari ini. */
export function intercessionToday(now: Date): IntercessionTopic {
  return INTERCESSION_WEEK[now.getDay()];
}

/** Syafaat hari ini = Doa Rantai CORE Leader? (kartunya bisa ditekan) */
export function isChainTopic(topic: IntercessionTopic): boolean {
  return topic.key === 'chain';
}

// Jendela pengingat malam: mulai jam 18.00 sampai ganti hari. Di dalam jendela
// ini kartu Home menampilkan seluruh pokok doanya (di luar itu cukup judulnya).
export const INTERCESSION_NIGHT_FROM_HOUR = 18;

export function intercessionNightWindow(now: Date): boolean {
  return now.getHours() >= INTERCESSION_NIGHT_FROM_HOUR;
}
