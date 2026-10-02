import { pickOfDay } from './core';
import { OWNER_NAME } from './family';
import { openExternalUrl } from './linking';

// Morning Journey 🌅 — pagi bersama Tuhan, SATU langkah pada satu waktu:
//   🌅 Arrive → 📖 Receive → 💭 Reflect → ❤️ Respond → 🎵 Worship → 🙏 Pray → 🌤️ Close
//
// Ini pengganti gerbang doa pagi yang dulu berbentuk daftar centang. Yang
// diganti bukan bentuk kotaknya, tapi cara berpikirnya: bukan "selesaikan 5
// tugas", melainkan "sediakan waktu untuk Tuhan sebelum memulai hari". Karena
// itu di sini TIDAK ADA hitungan langkah, persen, atau centang. Tiap langkah
// boleh dilewati kosong, dan yang ditulis tetap tersimpan.
//
// Tulisannya sengaja menumpang ke data yang SUDAH ADA, bukan koleksi baru:
//   • 📖 Receive  → Revive hari ini (judul, bacaan, ✨ rhema)   users/{uid}/revive/{hari}
//   • 💭 Reflect  → 📓 Daily Reflection Journal di Habits       habitDays/{hari}.notes[id]
//   • ❤️ Respond  → 🏃 Aplikasi Revive + respons hati            users/{uid}/revive/{hari}
//   • 🙏 Pray     → doa pribadi pagi                              users/{uid}/revive/{hari}
// Jadi riwayat Revive, kartu Refleksi di Home, feed, dan AI Reflection semuanya
// tetap membaca tempat yang sama seperti sebelumnya. Lihat lib/spiritual.ts
// (saveJourneyFields) untuk cara menulisnya.

export type JourneyStepKey =
  | 'arrive'
  | 'receive'
  | 'reflect'
  | 'respond'
  | 'worship'
  | 'pray'
  | 'close';

export type JourneyStep = {
  key: JourneyStepKey;
  emoji: string;
  /** Nama langkah (eyebrow kecil di atas judul). */
  label: string;
  /** Kalimat yang menjadi judul kartunya. */
  title: string;
};

export const JOURNEY_STEPS: JourneyStep[] = [
  { key: 'arrive', emoji: '🌅', label: 'Arrive', title: 'Aku hadir' },
  { key: 'receive', emoji: '📖', label: 'Receive', title: 'Apa yang Tuhan mau sampaikan?' },
  { key: 'reflect', emoji: '💭', label: 'Reflect', title: 'Apa yang sedang terjadi dalam diriku?' },
  { key: 'respond', emoji: '❤️', label: 'Respond', title: 'Apa yang ingin aku bawa hari ini?' },
  { key: 'worship', emoji: '🎵', label: 'Worship', title: 'Mau tinggal bersama Tuhan sebentar?' },
  { key: 'pray', emoji: '🙏', label: 'Pray', title: 'Apa yang ingin kamu doakan?' },
  { key: 'close', emoji: '🌤️', label: 'Close', title: 'Aku menyerahkan hari ini' },
];

export function journeyStepIndex(key: JourneyStepKey): number {
  return JOURNEY_STEPS.findIndex((s) => s.key === key);
}

export function journeyStepMeta(key: JourneyStepKey): JourneyStep {
  return JOURNEY_STEPS[journeyStepIndex(key)];
}

/** Langkah sesudah `key`; null kalau sudah di penutup. */
export function nextJourneyStep(key: JourneyStepKey): JourneyStepKey | null {
  const i = journeyStepIndex(key);
  return i >= 0 && i < JOURNEY_STEPS.length - 1 ? JOURNEY_STEPS[i + 1].key : null;
}

/** Nama depan pemilik app untuk sapaan "Selamat pagi, Imanuel." */
export const JOURNEY_NAME = OWNER_NAME.split(' ')[0];

// ---------------------------- 💭 Reflect ----------------------------
// Satu pertanyaan per hari, diundi dari tanggalnya (sama sepanjang hari itu),
// jadi tiap pagi pertanyaannya berganti tapi tidak berubah di tengah menulis.
export const REFLECT_PROMPTS: string[] = [
  'Apa yang sedang kamu syukuri hari ini?',
  'Apa yang sedang kamu takutkan dan ingin kamu serahkan kepada Tuhan?',
  'Apa yang Tuhan mungkin sedang ajarkan kepadamu melalui keadaanmu saat ini?',
  'Bagaimana keadaan hatimu pagi ini, sejujurnya?',
  'Siapa yang sedang ada di pikiranmu, dan apa yang ingin kamu doakan untuknya?',
  'Apa yang kemarin terasa berat, dan bagaimana kamu melihatnya pagi ini?',
  'Di bagian mana hidupmu kamu paling membutuhkan Tuhan hari ini?',
];

export function reflectPromptOfDay(dayId: string): string {
  return pickOfDay(REFLECT_PROMPTS, dayId, 'reflect');
}

// ---------------------------- ❤️ Respond ----------------------------
// Chip yang boleh dipilih lebih dari satu. Yang disimpan KUNCI-nya, jadi
// label boleh dirapikan kapan saja tanpa menyentuh data lama.
export type ResponseKey =
  | 'grateful'
  | 'surrender'
  | 'brave'
  | 'forgive'
  | 'grow'
  | 'trust'
  | 'repent'
  | 'hope'
  | 'calm'
  | 'love';

export const RESPONSE_OPTIONS: { key: ResponseKey; emoji: string; label: string }[] = [
  // 💚 (bukan ❤️): hati merah sudah jadi lambang langkah Respond di jejak
  // journey, jadi chip Bersyukur pakai hati hijau supaya tidak kembar (22 Sep 2026).
  { key: 'grateful', emoji: '💚', label: 'Bersyukur' },
  { key: 'surrender', emoji: '🕊️', label: 'Menyerahkan' },
  { key: 'brave', emoji: '💪', label: 'Berani melangkah' },
  { key: 'forgive', emoji: '🤝', label: 'Mengampuni' },
  { key: 'grow', emoji: '🌱', label: 'Bertumbuh' },
  // Lima tambahan (2 Okt 2026). Ditaruh SESUDAH yang lama, bukan disisipkan
  // di antaranya: lima chip pertama sudah hafal di tangan, dan menggesernya
  // membuat jari memilih yang salah selama berminggu-minggu.
  //
  // Tiap tambahan mengisi keadaan hati yang memang belum punya tempatnya, dan
  // sengaja tidak bertumpang tindih dengan yang sudah ada:
  //   🤲 Percaya    ≠ 🕊️ Menyerahkan — melepaskan kendali vs mempercayakan
  //   ⚓ Berharap   — menanti yang belum kelihatan (Ibrani 6:19)
  //   🙇 Bertobat   — satu-satunya yang mengakui kesalahan
  //   🕯️ Ditenangkan— hasil paling sering dari pagi yang tidak menghasilkan
  //                   keputusan apa pun, dan dulu tidak bisa dicatat
  //   🫶 Mengasihi  — satu-satunya yang arahnya KELUAR, ke orang lain
  { key: 'trust', emoji: '🤲', label: 'Percaya' },
  { key: 'repent', emoji: '🙇', label: 'Bertobat' },
  { key: 'hope', emoji: '⚓', label: 'Berharap' },
  { key: 'calm', emoji: '🕯️', label: 'Ditenangkan' },
  { key: 'love', emoji: '🫶', label: 'Mengasihi' },
];

/** "💚 Bersyukur" untuk kunci yang dikenal; kunci asing dicetak apa adanya. */
export function responseLabel(key: string): string {
  const o = RESPONSE_OPTIONS.find((r) => r.key === key);
  return o ? `${o.emoji} ${o.label}` : key;
}

/** "💚 Bersyukur · 🌱 Bertumbuh" — untuk arsip Revive & teks yang dibagikan. */
export function responsesLine(keys: string[] | undefined): string {
  return (keys ?? []).map(responseLabel).join(' · ');
}

// ---------------------- Dibagikan ke WhatsApp ----------------------
// Bentuknya mengikuti share Revive yang sudah lama ada (app/revive.tsx):
// pembuka, isinya, lalu satu kalimat berkat. Bedanya yang dibagikan di sini
// RESPONS HATINYA, bukan seluruh catatan Revive — itu sebabnya ia berdiri di
// langkah ❤️ Respond, sebelum 🎵 Worship.
//
// Bagian yang kosong DILEWATI seluruhnya, bukan dikirim sebagai label tanpa
// isi: pagi yang cuma menandai satu chip tetap layak dibagikan, dan "✨" yang
// menggantung tanpa kalimat cuma membuat pesannya terbaca seperti formulir
// yang belum selesai.

export const JOURNEY_SHARE_CLOSING = 'God bless, have a nice day!';

export function respondShareText(input: {
  /** "Jumat, 2 Oktober 2026" */
  dateLabel: string;
  title: string;
  passage: string;
  rhema: string;
  responses: string[];
  /** Satu hal yang ingin dibawa ke dalam hari ini. */
  carry: string;
}): string {
  const isi = (s: string) => s.trim();
  const bacaan = [isi(input.title), isi(input.passage)].filter(Boolean).join(' · ');
  const respons = responsesLine(input.responses.filter((r) => r.trim()));

  // Tiap kelompok dipisah baris kosong; kelompok yang kosong tidak ikut, jadi
  // tidak pernah ada dua baris kosong berurutan.
  const kelompok: string[][] = [
    [`🌅 Morning Journey`, input.dateLabel],
    [bacaan ? `📖 ${bacaan}` : '', isi(input.rhema) ? `✨ ${isi(input.rhema)}` : ''],
    [
      respons ? `❤️ Respons hatiku: ${respons}` : '',
      isi(input.carry) ? `🏃 Yang aku bawa hari ini: ${isi(input.carry)}` : '',
    ],
    [JOURNEY_SHARE_CLOSING],
  ];

  return kelompok
    .map((baris) => baris.filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

// ---------------------------- 🙏 Pray ----------------------------
// Kategori pokok doa, bentuknya sama persis dengan chip ❤️ Respond (27 Sep
// 2026). Kenapa ditambahkan: kolom doa pagi selalu dimulai dari halaman
// kosong, dan halaman kosong jam 5 pagi paling gampang dilewati begitu saja.
// Memilih satu kategori tidak menggantikan doanya, tapi memberi titik mulai
// ("hari ini untuk siapa?") sebelum menulis.
//
// Yang disimpan KUNCI-nya, sama seperti Respond, jadi labelnya boleh dirapikan
// kapan saja tanpa menyentuh data lama. Kategorinya sengaja tujuh dan berhenti
// di situ: ia harus muat dua baris di layar HP, bukan jadi daftar yang harus
// dibaca dulu.
export type PrayerTopicKey =
  | 'family'
  | 'ministry'
  | 'work'
  | 'health'
  | 'money'
  | 'future'
  | 'nation';

export const PRAYER_TOPICS: { key: PrayerTopicKey; emoji: string; label: string }[] = [
  { key: 'family', emoji: '🏠', label: 'Keluarga' },
  { key: 'ministry', emoji: '🔥', label: 'Pelayanan' },
  { key: 'work', emoji: '💼', label: 'Kerja' },
  { key: 'health', emoji: '🩺', label: 'Kesehatan' },
  { key: 'money', emoji: '💰', label: 'Keuangan' },
  { key: 'future', emoji: '🌄', label: 'Masa depan' },
  { key: 'nation', emoji: '🇮🇩', label: 'Bangsa' },
];

/** "🏠 Keluarga" untuk kunci yang dikenal; kunci asing dicetak apa adanya. */
export function prayerTopicLabel(key: string): string {
  const o = PRAYER_TOPICS.find((t) => t.key === key);
  return o ? `${o.emoji} ${o.label}` : key;
}

/** "🏠 Keluarga · 🔥 Pelayanan" — untuk baris riwayat & arsip Revive. */
export function prayerTopicsLine(keys: string[] | undefined): string {
  return (keys ?? []).map(prayerTopicLabel).join(' · ');
}

// ---------------------------- 🎵 Worship ----------------------------
// Satu lagu per hari, dibuka lewat PENCARIAN YouTube (judul + penyanyi), bukan
// id video: tautan pencarian tidak pernah basi walau videonya dihapus atau
// diunggah ulang. Daftarnya kurasi lagu penyembahan yang memang dikenal luas.
export type WorshipSong = { title: string; artist: string };

export const WORSHIP_SONGS: WorshipSong[] = [
  { title: 'Kau Yang Terindah', artist: 'True Worshippers' },
  { title: 'Bapa Engkau Sungguh Baik', artist: 'Franky Sihombing' },
  { title: 'Sampai Akhir Hidupku', artist: 'Franky Sihombing' },
  { title: 'Bapa Yang Kekal', artist: 'Franky Sihombing' },
  { title: 'Semua Baik', artist: 'Nikita' },
  { title: 'Bagai Rajawali', artist: 'Nikita' },
  { title: 'Mujizat Itu Nyata', artist: 'Nikita' },
  { title: 'Kaulah Harapan', artist: 'Sari Simorangkir' },
  { title: 'Tuhan Pasti Sanggup', artist: 'Maria Shandi' },
  { title: 'Betapa Hatiku', artist: 'Sidney Mohede' },
  { title: 'What A Beautiful Name', artist: 'Hillsong Worship' },
  { title: 'Cornerstone', artist: 'Hillsong Worship' },
  { title: 'King of Kings', artist: 'Hillsong Worship' },
  { title: 'Oceans (Where Feet May Fail)', artist: 'Hillsong UNITED' },
  { title: 'Goodness of God', artist: 'Bethel Music' },
  { title: 'Way Maker', artist: 'Sinach' },
  { title: '10,000 Reasons (Bless the Lord)', artist: 'Matt Redman' },
  { title: 'How Great Is Our God', artist: 'Chris Tomlin' },
  { title: 'Great Are You Lord', artist: 'All Sons & Daughters' },
  { title: 'Build My Life', artist: 'Housefires' },
  { title: 'Gratitude', artist: 'Brandon Lake' },
  { title: 'Yes I Will', artist: 'Vertical Worship' },
];

export function worshipSongOfDay(dayId: string): WorshipSong {
  return pickOfDay(WORSHIP_SONGS, dayId, 'worship-song');
}

export function worshipSongUrl(song: WorshipSong): string {
  const q = encodeURIComponent(`${song.title} ${song.artist}`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

/** Buka lagunya di YouTube (app kalau terpasang, kalau tidak browser). */
export function openWorshipSong(song: WorshipSong, onError?: () => void) {
  return openExternalUrl(worshipSongUrl(song), { onError });
}

export const WORSHIP_SONG_ERROR = 'YouTube tidak bisa dibuka. Coba lagi ya.';

// ---------------------------- 🌤️ Close ----------------------------
// Doa Bapa Kami (Matius 6:9–13).
export const BAPA_KAMI = `Bapa kami yang di sorga,
Dikuduskanlah nama-Mu,
datanglah Kerajaan-Mu,
jadilah kehendak-Mu di bumi seperti di sorga.

Berikanlah kami pada hari ini makanan kami yang secukupnya, dan ampunilah kami akan kesalahan kami, seperti kami juga mengampuni orang yang bersalah kepada kami;

dan janganlah membawa kami ke dalam pencobaan, tetapi lepaskanlah kami dari pada yang jahat.

Karena Engkaulah yang empunya Kerajaan dan kuasa dan kemuliaan sampai selama-lamanya. Amin.`;

export const JOURNEY_CLOSING = '🌤️ Kamu sudah memulai harimu bersama Tuhan.';
