// Palet warna utama vix-super-app — Teal & Krem (mengikuti logo).
// Semua screen WAJIB ambil warna dari sini, jangan hardcode hex di screen.
//
// Palet dasar (dari logo):
//   #0C5C50  teal paling gelap
//   #1D8D7A  teal utama
//   #9FE6D5  mint terang
//   #FFE8CC  krem
//   #5B4B3A  cokelat

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
  MAIN: '#1D8D7A',
  MAIN_DARK: '#0C5C50',
  MAIN_LIGHT: '#9FE6D5',
  MAIN_TRANSPARENT: '#1D8D7A1A',

  ACCENT: WARM_CREAM,
  ACCENT_DARK: '#5B4B3A',

  // Permukaan (netral hangat, turunan krem #FFE8CC)
  BACKGROUND: '#FDF6EC',
  CONTAINER: '#FFFFFF',
  CONTRAST_CONTAINER: '#F5E7D2',
  BORDER: '#EBDCC5',
  OVERLAY: '#00000066', // latar gelap transparan di belakang modal
  // Abu-abu "tidak berlaku" — untuk pilihan yang memang belum punya isi, mis.
  // kategori Finance yang budget-nya belum diatur (0). Sengaja SEGELAP teks
  // keterangan, bukan pucat: yang dituju "tidak ada budget", bukan "mati".
  DISABLED: '#D8D5CE',
  DISABLED_DARK: '#6B6B63',

  // Teks
  TEXT_TITLE: '#10221C',
  TEXT_PARAGRAPH: '#2E3B35',
  TEXT_LABEL: '#5C6B63',
  TEXT_PLACEHOLDER: '#9AA79F',
  TEXT_REVERSE: '#FFFFFF',
  TEXT_ON_DARK_MUTED: '#CFE0D8',
  // Putih redup NETRAL — keterangan kecil di atas kartu gelap yang warnanya
  // ikut fitur (bisa cokelat, merah tua, grafit, …). TEXT_ON_DARK_MUTED
  // bersemu mint, jadi di atas kartu cokelat/merah ia terlihat kehijauan.
  TEXT_ON_DARK_SOFT: '#FFFFFFC2',

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
    '#1D8D7A', '#0C5C50', '#5B4B3A', '#5B95F9', '#E96479', '#8989EB',
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

  // Wheel 🎡 — anggrek/plum. Dulu merah muda, satu rumpun dengan Married &
  // Health; dipindah ke ungu-magenta yang berdiri sendiri.
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

  // Games 🏆 (Tournament) — emas, sengaja paling pekat di antara tile lain
  // biar langsung terbaca sebagai "piala".
  TOURNAMENT: '#FFD24C',
  TOURNAMENT_DARK: '#7A5300',
  TOURNAMENT_DEEP: '#573C00',

  // Social 🥂 — persik hangat, suasana kumpul-kumpul.
  SOCIAL: '#FFCBB0',
  SOCIAL_DARK: '#8F4218',
  SOCIAL_DEEP: '#7A3913',

  // Married 💍 — mawar lembut.
  MARRIED: '#F3BDCC',
  MARRIED_DARK: '#85354F',
  MARRIED_DEEP: '#68283E',

  // Hijau lembut serba-guna — BUKAN warna fitur. Dulu ini warna tile Fun;
  // saat Fun pindah ke fuchsia, hijaunya tetap dibutuhkan sebagai "cukup /
  // sehat" (ring kalori & paket sarapan di Diet, kartu Temperamen di Profile).
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
  SUCCESS: '#1D8D7A',
  WARNING: '#5B4B3A',
  WARNING_TRANSPARENT: '#5B4B3A1A',
  DANGER: '#C0392B',
  // Merah samar (10%) — latar baris yang ditandai ✕ "dilewati". Pasangan merah
  // dari MAIN_TRANSPARENT yang dipakai baris tercentang.
  DANGER_TRANSPARENT: '#C0392B1A',
  // Kuning peringatan pemakaian budget (bar & latar pilihan saat ≥75%).
  BUDGET_WARN: '#EAB308',
} as const;
