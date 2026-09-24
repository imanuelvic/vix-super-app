// Palet warna utama vix-super-app — Evergreen & Pasir (versi 2.0, 22 Sep
// 2026). Semua screen WAJIB ambil warna dari sini, jangan hardcode hex.
//
// Arahnya: calm, intentional, mature — teal yang lebih dalam & tenang, krem
// yang jadi pasir hangat, latar gading yang lebih netral. Logo lama (teal &
// krem) tetap nyambung; yang berubah kepekatannya, bukan keluarganya.
//
// Palet dasar:
//   #0B3D36  evergreen paling gelap   (dulu #0C5C50)
//   #176B5D  teal utama                (dulu #1D8D7A)
//   #C9E3DC  mint kabut                (dulu #9FE6D5, terlalu neon)
//   #E6D3B3  pasir hangat              (dulu #FFE8CC krem)
//   #6E5030  perunggu                  (dulu #5B4B3A cokelat)

// Beberapa pastel dipakai DUA arti sekaligus: sebagai jenis transaksi Finance
// (hijau pemasukan, merah pengeluaran, …) dan sebagai warna fitur di grid Home
// (Finance, Health, Family, Car). Warnanya memang sengaja satu — tapi
// artinya dua, jadi masing-masing punya nama sendiri di bawah. Kalau salah satu
// arti nanti mau digeser, cukup lepas dari tetapan bersama ini; yang satunya
// tidak ikut berubah diam-diam.
const MONEY_GREEN = '#D4EDBC';
const SOFT_RED = '#FFCFC9';
const SOFT_AMBER = '#FFE5A0';
const SOFT_BLUE = '#BFE1F6';
const WARM_CREAM = '#FFE8CC';

export const Color = {
  // Brand
  MAIN: '#176B5D',
  MAIN_DARK: '#0B3D36',
  MAIN_LIGHT: '#C9E3DC',
  MAIN_TRANSPARENT: '#176B5D1A',

  // Sekunder: pasir hangat + perunggu (bukan lagi krem #FFE8CC — krem itu
  // tetap hidup sebagai warna tile Car lewat WARM_CREAM).
  ACCENT: '#E6D3B3',
  ACCENT_DARK: '#6E5030',

  // Permukaan (gading netral, sedikit lebih teduh dari krem lama)
  BACKGROUND: '#F7F3EC',
  CONTAINER: '#FFFFFF',
  CONTRAST_CONTAINER: '#EFE6D8',
  BORDER: '#E6DDCF',
  OVERLAY: '#00000066', // latar gelap transparan di belakang modal
  // Abu-abu "tidak berlaku" — untuk pilihan yang memang belum punya isi, mis.
  // kategori Finance yang budget-nya belum diatur (0). Sengaja SEGELAP teks
  // keterangan, bukan pucat: yang dituju "tidak ada budget", bukan "mati".
  DISABLED: '#D8D5CE',
  DISABLED_DARK: '#6B6B63',

  // Teks
  TEXT_TITLE: '#0F1F1A',
  TEXT_PARAGRAPH: '#2B3833',
  TEXT_LABEL: '#5A6962',
  TEXT_PLACEHOLDER: '#98A59D',
  TEXT_REVERSE: '#FFFFFF',
  TEXT_ON_DARK_MUTED: '#CFE0D8',
  // Putih redup NETRAL — keterangan kecil di atas kartu gelap yang warnanya
  // ikut fitur (bisa cokelat, merah tua, grafit, …). TEXT_ON_DARK_MUTED
  // bersemu mint, jadi di atas kartu cokelat/merah ia terlihat kehijauan.
  TEXT_ON_DARK_SOFT: '#FFFFFFC2',
  // Latar chip kecil DI ATAS kartu gelap (jadwal main terdekat, dst). Putih
  // sangat redup, jadi ia mengambang di atas warna apa pun yang sedang dipakai
  // fitur itu — cokelat, merah tua, grafit — tanpa membawa semunya sendiri.
  SURFACE_ON_DARK: '#FFFFFF1F',

  // Warna jenis transaksi Finance (pastel, selaras spreadsheet keuangan lama)
  FINANCE_INCOME: MONEY_GREEN,
  FINANCE_EXPENSE: SOFT_RED,
  FINANCE_SAVING: SOFT_AMBER,
  FINANCE_INVESTMENT: SOFT_BLUE,
  // Versi gelap tiap warna di atas — dipakai jadi borderColor tombol Finance
  // biar tiap jenis tetap jelas dikenali walau pastelnya lembut.
  FINANCE_INCOME_DARK: '#4C8C3A',
  FINANCE_EXPENSE_DARK: '#C4553F',
  FINANCE_SAVING_DARK: '#B8901F',
  FINANCE_INVESTMENT_DARK: '#3D82B5',

  // Warna irisan grafik donat di Dashboard Finance (dipakai bergiliran)
  CHART_COLORS: [
    '#176B5D', '#0B3D36', '#6E5030', '#5B95F9', '#E96479', '#8989EB',
    '#F7CB4D', '#63D297', '#978070', '#26A69A', '#FF8A65', '#7DB9B6',
  ],

  // ══════════════════════════════════════════════════════════════════════
  // WARNA 20 FITUR — tiap fitur punya TIGA warna, bukan dua:
  //
  //   X        pastel      → pita header layar, pil tab aktif, tile grid Home
  //   X_DARK   gelap       → judul, ikon, & tulisan DI ATAS pastel itu
  //   X_DEEP   paling gelap→ isian kartu ringkasan (tulisannya putih)
  //
  // Ketiganya dirangkai jadi satu di lib/homeGrid.ts, lalu dipetakan ke tiap
  // rute oleh lib/featureTheme.ts. Jadi begitu satu warna di sini diubah,
  // tile Home, header, tab bawah, & kartu ringkasan fitur itu ikut berubah
  // bersamaan — tidak ada lagi yang perlu disamakan manual satu per satu.
  //
  // NADA WARNANYA DISEBAR: 20 tile itu banyak, jadi selisih rona saja tidak
  // cukup — beberapa fitur sengaja dibuat lebih PEKAT (Fitness, Games, Wheel,
  // Invest) supaya tetangga serona tidak terbaca sebagai warna yang sama.
  // ══════════════════════════════════════════════════════════════════════

  // Air putih 💧 — biru air untuk tombol gelas mengambang (WaterFloat):
  // isi gelas, cincin kemajuan, & angkanya. Bukan warna fitur mana pun.
  WATER: '#5FB4E5',
  WATER_DARK: '#1F6FA3',
  WATER_LIGHT: '#D6ECF9',

  // Reminder ✅ (tasks) — mint tersendiri. Dulu menumpang MAIN_LIGHT; sejak
  // palet 2.0 MAIN_LIGHT jadi mint kabut yang terlalu mirip News, jadi tile
  // ini dapat pastelnya sendiri (ΔE ≥ 10 dari semua tetangganya).
  TASKS: '#A8DCCB',
  TASKS_DARK: '#0B3D36',
  TASKS_DEEP: '#0B3D36',

  // Spiritual ✝️ — ungu, warna keagungan.
  SPIRITUAL: '#E4D7F5',
  SPIRITUAL_DARK: '#6B4E9B',
  SPIRITUAL_DEEP: '#4A3273',

  // Health ❤️ — merah jantung. Pastelnya sama dengan FINANCE_EXPENSE, tapi
  // namanya sendiri: kalau nanti merah "pengeluaran" digeser, tile Health
  // tidak ikut berubah diam-diam.
  HEALTH: SOFT_RED,
  HEALTH_DARK: '#A62F21',
  HEALTH_DEEP: '#8C2A1F',

  // CORE 👥 — biru langit, warna komunitas. Dulu tulisannya nyaris hitam
  // (TEXT_TITLE) sehingga satu-satunya tile tanpa warna khasnya sendiri.
  CORE: '#A9D4F2',
  CORE_DARK: '#1B5378',
  CORE_DEEP: '#14456A',

  // Finance 💵 — hijau uang (senada FINANCE_INCOME).
  FINANCE: MONEY_GREEN,
  FINANCE_DARK: '#3B6E2B',
  FINANCE_DEEP: '#2E6626',

  // Learning 🎓 — periwinkle/nila. Digeser sedikit lebih biru & pekat supaya
  // beda jelas dari Book (ungu-nila) yang bersebelahan ronanya.
  LEARNING: '#B3C4F5',
  LEARNING_DARK: '#2F44A0',
  LEARNING_DEEP: '#212F73',

  // Fitness 💪 — JINGGA sungguhan. Dulu persik pucat (#FBD9B8) yang nyaris
  // tak bisa dibedakan dari Social & Car; sekarang paling pekat di rona itu.
  FITNESS: '#FFBE85',
  FITNESS_DARK: '#88390A',
  FITNESS_DEEP: '#632D04',

  // Family 👨‍👩‍👧 — kuning madu (senada FINANCE_SAVING), tapi tulisannya tak
  // lagi menumpang cokelat ACCENT_DARK milik Car & Career.
  FAMILY: SOFT_AMBER,
  FAMILY_DARK: '#7A5D0E',
  FAMILY_DEEP: '#644D0A',

  // Invest 📈 — hijau zamrud "bertumbuh". Dulu abu-abu pucat dengan tulisan
  // abu-abu juga: satu-satunya tile yang tak menandakan apa pun.
  INVEST: '#9DD9AE',
  INVEST_DARK: '#145B36',
  INVEST_DEEP: '#124C2E',

  // Career 💼 — cokelat kayu. CAREER_DARK dulu berisi ABU-ABU PUCAT (#E4E2DC)
  // padahal dipakai sebagai warna TULISAN di dua tab Career — praktis tak
  // terbaca di atas kartu terang. Sekarang cokelat betulan.
  CAREER: '#E3CBB4',
  CAREER_DARK: '#6B472A',
  CAREER_DEEP: '#573A20',

  // Fun 🎉 — fuchsia pesta. Dulu hijau muda, kembar dengan hijau Finance.
  FUN: '#F7B8E0',
  FUN_DARK: '#922566',
  FUN_DEEP: '#7A1D55',

  // Wheel 🎡 — anggrek/plum. Dulu merah muda, satu rumpun dengan Health;
  // dipindah ke ungu-magenta yang berdiri sendiri.
  WHEEL: '#E3BDF0',
  WHEEL_DARK: '#7B2E96',
  WHEEL_DEEP: '#59206E',

  // Car 🚗 — krem (senada ACCENT, warna aksen merek).
  CAR: WARM_CREAM,
  CAR_DARK: '#5B4B3A',
  CAR_DEEP: '#403426',

  // Residence 🏠 — biru-abu slate.
  HOUSE: '#C9D9E8',
  HOUSE_DARK: '#3F5A73',
  HOUSE_DEEP: '#2B3F53',

  // News 📰 — teal pastel (berita terkini & populasi dunia).
  NEWS: '#BFE3E0',
  NEWS_DARK: '#1A5E5A',
  NEWS_DEEP: '#14514D',

  // Book 📚 — ungu-nila pastel.
  BOOK: '#CFC7F2',
  BOOK_DARK: '#4B3F8F',
  BOOK_DEEP: '#352B69',

  // Device 📱 — grafit/aluminium, warna bodi gawai. Dulu MEMAKAI WARNA
  // LEARNING PERSIS SAMA, jadi dua tile itu benar-benar kembar di grid.
  DEVICE: '#AFB8C2',
  DEVICE_DARK: '#3D4855',
  DEVICE_DEEP: '#2A323C',

  // Games 🎮 (Tournament, Snake, Tetris) — kuning arcade, sengaja paling pekat
  // di antara tile lain biar langsung terbaca sebagai "main".
  TOURNAMENT: '#FFD24C',
  TOURNAMENT_DARK: '#7A5300',
  TOURNAMENT_DEEP: '#573C00',

  // Reward 🏆 — madu emas. Dulu memakai warna Games persis (dua tile kembar
  // bersebelahan), lalu sempat perunggu #D9A441 yang ternyata terlalu gelap
  // untuk pita header. Yang sekarang tetap keluarga medali, lebih terang, dan
  // masih berjarak ΔE 16 dari Fitness & 20 dari kuning Games
  // (scratchpad/warna-reward2.js).
  REWARD: '#F0C36B',
  REWARD_DARK: '#4A3205',
  REWARD_DEEP: '#3A2704',

  // Social 🥂 — persik hangat, suasana kumpul-kumpul.
  FRIENDS: '#FFCBB0',
  FRIENDS_DARK: '#8F4218',
  FRIENDS_DEEP: '#7A3913',

  // Hijau lembut serba-guna — BUKAN warna fitur. Dulu ini warna tile Fun;
  // saat Fun pindah ke fuchsia, hijaunya tetap dibutuhkan sebagai "cukup /
  // sehat" (kartu Temperamen di Profile).
  GREEN_SOFT: '#C7E9C0',
  GREEN_SOFT_DARK: '#3E7A3A',

  // Merek luar (tombol chat WhatsApp di fitur CORE, pintasan IG di Habits)
  WHATSAPP: '#25D366',
  INSTAGRAM: '#E1306C',
  // Hijau Duolingo yang DIGELAPKAN. Hijau aslinya (#58CC02) cuma 2,1:1 di atas
  // kartu putih — terbaca jelas sebagai logo besar, tapi tidak sebagai teks
  // kecil "Buka Duolingo" di baris kebiasaan. Yang ini 5,2:1 (lolos WCAG AA)
  // dan hijaunya masih hijau Duolingo, bukan hijau app.
  DUOLINGO: '#437A00',

  // Status
  SUCCESS: '#176B5D',
  WARNING: '#6E5030',
  WARNING_TRANSPARENT: '#6E50301A',
  DANGER: '#C0392B',
  // Merah samar (10%) — latar baris yang ditandai ✕ "dilewati". Pasangan merah
  // dari MAIN_TRANSPARENT yang dipakai baris tercentang.
  DANGER_TRANSPARENT: '#C0392B1A',
  // Kuning peringatan pemakaian budget (bar & latar pilihan saat ≥75%).
  BUDGET_WARN: '#EAB308',

  // ===================== Kaki layar (24 Sep 2026) =====================
  //
  // Tab bar utama & baris sub-tab tiap fitur: BAR EMERALD GELAP dengan pil
  // lebih terang di belakang ikon yang sedang aktif.
  //
  // Sengaja punya nama sendiri walau nilainya sama dengan MAIN_DARK & MAIN.
  // Alasannya sama dengan pastel Finance di atas: artinya dua. Kalau suatu
  // saat warna kaki layar mau digeser sendiri, cukup ubah di sini tanpa
  // menyeret seluruh warna merek app ikut berubah.
  TABBAR_BG: '#0B3D36',
  /** Garis tipis pemisah bar dari isi layar. */
  TABBAR_LINE: '#176B5D',
  /** Pil di belakang ikon yang aktif. */
  TABBAR_PILL: '#176B5D',
  /** Ikon aktif di atas pil (mint, 4,5:1 di atas pil). */
  TABBAR_ACTIVE: '#C9E3DC',
  /**
   * Ikon & tulisan tab yang TIDAK aktif.
   *
   * Sengaja bukan TEXT_ON_DARK_MUTED (#CFE0D8): warna itu hampir seterang
   * ikon aktif, jadi tab yang tidak aktif ikut terlihat menyala dan bedanya
   * hilang. Yang ini 5,4:1 di atas bar — terbaca jelas, tapi jelas sekunder.
   */
  TABBAR_INACTIVE: '#8FB3AA',
} as const;
