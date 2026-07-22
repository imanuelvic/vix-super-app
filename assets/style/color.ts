// Palet warna utama vix-super-app — Emerald.
// Semua screen WAJIB ambil warna dari sini, jangan hardcode hex di screen.
//
// Palet dasar:
//   #0B3D2E  emerald paling gelap
//   #0F6A4B  emerald utama
//   #1BAA78  emerald terang
//   #C9B27C  emas/gold
//   #F3EFE6  ivory (latar)

export const Color = {
  // Brand
  MAIN: '#0F6A4B',
  MAIN_DARK: '#0B3D2E',
  MAIN_LIGHT: '#1BAA78',
  MAIN_TRANSPARENT: '#0F6A4B1A',
  ACCENT: '#C9B27C',

  // Permukaan
  BACKGROUND: '#F3EFE6',
  CONTAINER: '#FFFFFF',
  CONTRAST_CONTAINER: '#EAE4D6',
  BORDER: '#E0D9CA',

  // Teks
  TEXT_TITLE: '#10221C',
  TEXT_PARAGRAPH: '#2E3B35',
  TEXT_LABEL: '#5C6B63',
  TEXT_PLACEHOLDER: '#9AA79F',
  TEXT_REVERSE: '#FFFFFF',
  TEXT_ON_DARK_MUTED: '#CFE0D8',

  // Status
  SUCCESS: '#1BAA78',
  SUCCESS_TRANSPARENT: '#1BAA781A',
  WARNING: '#C9B27C',
  WARNING_TRANSPARENT: '#C9B27C26',
  DANGER: '#C0392B',
  DANGER_TRANSPARENT: '#C0392B1A',
  DISABLED: '#D8D2C6',
} as const;
