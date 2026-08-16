import { Linking } from 'react-native';

// Deeplink ke aplikasi bank / dompet / investasi per kategori transaksi.
// Alur: buka vix → isi transaksi → tekan tombol ini → lompat ke app tujuan.
//
// CATATAN PENTING: skema URL banyak app fintech Indonesia TIDAK terdokumentasi
// resmi, jadi sebagian di sini best-effort. Kalau skema salah / app belum
// terpasang, tombol JATUH ke pencarian App Store (aman, tidak salah buka app).
// Semua gampang diganti di satu tempat ini kalau ada yang belum pas.
//
// `color`/`fg` = warna brand tiap app (pengecualian dari palet aplikasi karena
// ini memang warna eksternal, seperti tombol WhatsApp).

export type PayApp = {
  key: string;
  label: string;
  scheme: string; // deeplink utama, mis. "jago://"
  color: string; // warna brand (latar tombol)
  fg: string; // warna teks/ikon di atas latar itu
};

const WHITE = '#FFFFFF';
const DARK = '#181A20';

const PAY_APPS: Record<string, PayApp> = {
  jago: { key: 'jago', label: 'Bank JAGO', scheme: 'jago://', color: '#FF6D00', fg: WHITE },
  gopay: { key: 'gopay', label: 'GoPay', scheme: 'gojek://', color: '#00AAD2', fg: WHITE },
  bca: { key: 'bca', label: 'BCA Mobile', scheme: 'bca://', color: '#0060AF', fg: WHITE },
  jenius: { key: 'jenius', label: 'Jenius', scheme: 'jenius://', color: '#00B7C3', fg: WHITE },
  neobank: { key: 'neobank', label: 'Neobank', scheme: 'neobank://', color: '#FFC400', fg: DARK },
  superbank: { key: 'superbank', label: 'Superbank', scheme: 'superbank://', color: '#17A398', fg: WHITE },
  saqu: { key: 'saqu', label: 'Bank Saqu', scheme: 'saqu://', color: '#6D28D9', fg: WHITE },
  krom: { key: 'krom', label: 'Krom', scheme: 'krom://', color: '#7C3AED', fg: WHITE },
  tokocrypto: { key: 'tokocrypto', label: 'Tokocrypto', scheme: 'tokocrypto://', color: '#0AB39C', fg: WHITE },
  bibit: { key: 'bibit', label: 'Bibit', scheme: 'bibit://', color: '#159E5B', fg: WHITE },
  pluang: { key: 'pluang', label: 'Pluang', scheme: 'pluang://', color: '#6B2FBD', fg: WHITE },
  tring: { key: 'tring', label: 'Tring!', scheme: 'tring://', color: '#FF5A5F', fg: WHITE },
  pintu: { key: 'pintu', label: 'Pintu', scheme: 'pintu://', color: '#2A5BF0', fg: WHITE },
  binance: { key: 'binance', label: 'Binance', scheme: 'bnc://', color: '#F0B90B', fg: DARK },
};

// Kategori (key) → app. Kategori yang TIDAK ada di sini (mis. Insurance,
// Gathering CORE, Rent) tidak menampilkan tombol apa pun.
const CATEGORY_APP: Record<string, string> = {
  // 💳 Bank JAGO
  'food-drink': 'jago',
  travel: 'jago',
  snacks: 'jago',
  groceries: 'jago',
  'mobile-data-admin': 'jago',
  'fun-recreation': 'jago',
  'personal-services': 'jago',
  parents: 'jago',
  'sinking-fund': 'jago',
  'vacation-fund': 'jago',
  'impulsive-fund': 'jago',
  'learning-fund': 'jago',
  'health-fund': 'jago',
  'core-fund': 'jago',
  'birthday-fund': 'jago',
  'unexpected-fund': 'jago',
  'mamse-birthday': 'jago',
  'papse-birthday': 'jago',
  // 💳 GoPay
  transportation: 'gopay',
  electricity: 'gopay',
  // 💳 BCA Mobile
  water: 'bca',
  // 💳 Jenius
  wifi: 'jenius',
  maintenance: 'jenius',
  'car-fund': 'jenius',
  // 💳 Neobank
  'emergency-fund': 'neobank',
  // 💳 Superbank
  'self-reward-fund': 'superbank',
  'christmas-gifts': 'superbank',
  // 💳 Bank Saqu
  'medical-check-up-2026': 'saqu',
  'vaccination-2026': 'saqu',
  // 💳 Krom
  'business-capital': 'krom',
  'laptop-mining': 'krom',
  'nvidia-rtx-3080': 'krom',
  // 💳 Tokocrypto
  'home-purchase': 'tokocrypto',
  'car-purchase': 'tokocrypto',
  'rent-apartment': 'tokocrypto',
  // 💳 Bibit
  'wedding-savings': 'bibit',
  'birth-fund': 'bibit',
  'childrens-education': 'bibit',
  // 💳 Pluang
  honeymoon: 'pluang',
  thailand: 'pluang',
  'skydiving-freefall': 'pluang',
  uae: 'pluang',
  japan: 'pluang',
  turkey: 'pluang',
  greece: 'pluang',
  // 💳 Tring!
  'pension-fund': 'tring',
  // 💳 Pintu
  'harmony-fund': 'pintu',
  // 💳 Binance
  'heirs-savings': 'binance',
};

/**
 * App tujuan untuk sebuah SAKU — memakai peta yang sama dengan kategori
 * Finance (key saku + "-fund"), jadi banknya tidak perlu didaftar dua kali.
 * null = saku itu belum punya bank di daftar kategori.
 */
export function payAppForFund(fundKey: string): PayApp | null {
  return payAppForCategory(`${fundKey}-fund`);
}

/** App tujuan untuk sebuah kategori — null kalau kategori tidak dipetakan. */
export function payAppForCategory(categoryKey: string): PayApp | null {
  const appKey = CATEGORY_APP[categoryKey];
  return appKey ? PAY_APPS[appKey] : null;
}

/**
 * Buka app tujuan lewat deeplink. Kalau gagal (app belum terpasang / skema
 * salah), jatuh ke pencarian App Store supaya tombol tetap berguna.
 */
export async function openPayApp(app: PayApp) {
  try {
    await Linking.openURL(app.scheme);
  } catch {
    const store = `https://apps.apple.com/id/search?term=${encodeURIComponent(
      app.label,
    )}`;
    Linking.openURL(store).catch(() => {});
  }
}
