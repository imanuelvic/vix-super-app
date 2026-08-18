// Palet warna utama vix-super-app — Teal & Krem (mengikuti logo).
// Semua screen WAJIB ambil warna dari sini, jangan hardcode hex di screen.
//
// Palet dasar (dari logo):
//   #0C5C50  teal paling gelap
//   #1D8D7A  teal utama
//   #9FE6D5  mint terang
//   #FFE8CC  krem
//   #5B4B3A  cokelat

export const Color = {
  // Brand
  MAIN: '#1D8D7A',
  MAIN_DARK: '#0C5C50',
  MAIN_LIGHT: '#9FE6D5',
  MAIN_TRANSPARENT: '#1D8D7A1A',

  ACCENT: '#FFE8CC',
  ACCENT_DARK: '#5B4B3A',

  // Permukaan (netral hangat, turunan krem #FFE8CC)
  BACKGROUND: '#FDF6EC',
  CONTAINER: '#FFFFFF',
  CONTRAST_CONTAINER: '#F5E7D2',
  BORDER: '#EBDCC5',
  OVERLAY: '#00000066', // latar gelap transparan di belakang modal

  // Teks
  TEXT_TITLE: '#10221C',
  TEXT_PARAGRAPH: '#2E3B35',
  TEXT_LABEL: '#5C6B63',
  TEXT_PLACEHOLDER: '#9AA79F',
  TEXT_REVERSE: '#FFFFFF',
  TEXT_ON_DARK_MUTED: '#CFE0D8',

  // Warna jenis transaksi Finance (pastel, selaras spreadsheet keuangan lama)
  FINANCE_INCOME: '#D4EDBC',
  FINANCE_EXPENSE: '#FFCFC9',
  FINANCE_SAVING: '#FFE5A0',
  FINANCE_INVESTMENT: '#BFE1F6',
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

  // Fitur Spiritual (tile Home + aksennya)
  SPIRITUAL: '#E4D7F5', // ungu pastel
  SPIRITUAL_DARK: '#6B4E9B',

  WHEEL: '#F7D6E6', // merah muda pastel
  WHEEL_DARK: '#A64D79',

  CAREER: '#E3CBB4', // coklat pastel (fitur Career)
  CAREER_DARK: '#E4E2DC', // abu-abu pastel (tile Trading)

  FUN: '#C7E9C0', // hijau muda (fitur Fun & Recreation)
  FUN_DARK: '#3E7A3A',

  FITNESS: '#FBD9B8', // oranye lembut (fitur Fitness — coming soon)
  FITNESS_DARK: '#B5651D',

  BOOK: '#DAD8F7', // ungu-nila pastel (fitur Book)
  BOOK_DARK: '#4B3F8F',

  HOUSE: '#D3DEE9', // biru-abu slate (fitur Home/rumah)
  HOUSE_DARK: '#3F5A73',

  WORLD: '#BFE3E0', // teal pastel (fitur World — populasi & berita dunia)
  WORLD_DARK: '#1F6F6A',

  // Learning dipindah dari kuning-madu ke periwinkle (biru-ungu) supaya tidak
  // bertabrakan dengan emas Tournament & kuning Family.
  LEARNING: '#C6CFF2', // periwinkle pastel (fitur Learning — coming soon)
  LEARNING_DARK: '#3B4C9E',

  // Tournament 🏆 — emas, sengaja paling pekat di antara tile lain biar
  // langsung terbaca sebagai "piala".
  TOURNAMENT: '#FFD24C',
  TOURNAMENT_DARK: '#7A5300',

  // Merek luar (tombol chat WhatsApp di fitur CORE)
  WHATSAPP: '#25D366',

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
