import Constants, { ExecutionEnvironment } from 'expo-constants';

// Membaca isi NOTA dari foto — OCR di HP sendiri, tanpa server & tanpa biaya.
// Android memakai Google ML Kit, iOS memakai Apple Vision (expo-text-extractor).
//
// Modulnya NATIVE: ia tidak ada di Expo Go, dan tidak ada juga di binary lama
// yang belum memuatnya. Karena itu di-require secara LAZY di dalam try/catch —
// pola yang sama persis dengan lib/healthkit.ts. Akibatnya Split Bill tetap
// jalan penuh (ketik item sendiri) di build yang belum punya modulnya, bukan
// crash saat dibuka.
//
// Fotonya TIDAK pergi ke mana pun: seluruh pembacaan terjadi di HP.

type ExtractorModule = typeof import('expo-text-extractor');

let cached: ExtractorModule | null | undefined;

function getModule(): ExtractorModule | null {
  if (cached !== undefined) return cached;
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (inExpoGo) {
    cached = null;
    return cached;
  }
  try {
    cached = require('expo-text-extractor') as ExtractorModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Bisa memindai nota di build & perangkat ini? false = ketik manual saja. */
export function canScanReceipt(): boolean {
  const mod = getModule();
  return !!mod && mod.isSupported;
}

// ===================== Membaca baris jadi item =====================

/** Satu baris nota yang berhasil dikenali. */
export type ScannedItem = { name: string; qty: number; price: number };

// Baris yang JELAS bukan item belanjaan. Dibuang lebih dulu supaya "Total",
// "Tunai", & "Kembalian" tidak ikut jadi menu — itu kesalahan yang paling
// mengganggu, karena angkanya besar dan langsung merusak pembagian.
const BUKAN_ITEM =
  /^(sub\s*-?\s*total|total|grand\s*total|tunai|cash|kembali(an)?|change|pajak|ppn|pb\s*1|service|svc|charge|diskon|discount|potongan|npwp|struk|bill|invoice|no\.?\s*meja|table|kasir|cashier|pelanggan|customer|terima\s*kasih|thank|qris|debit|kredit|credit|e-?wallet|gopay|ovo|dana|shopeepay|pembulatan|rounding)/i;

/**
 * Ubah angka rupiah dari nota jadi bilangan.
 * "50.000" / "50,000" / "50.000,00" / "Rp 50.000" → 50000.
 *
 * Aturan pemisah desimal: dua digit di belakang koma/titik TERAKHIR dianggap
 * sen dan dibuang. Nota Indonesia jarang memakai sen, tapi mesin kasir sering
 * mencetaknya — tanpa aturan ini "50.000,00" terbaca lima juta.
 */
export function parseReceiptAmount(raw: string): number {
  const teks = raw.replace(/[^0-9.,]/g, '');
  if (!teks) return 0;
  const desimal = /[.,]\d{2}$/.test(teks) && /[.,]\d{3}/.test(teks);
  const inti = desimal ? teks.slice(0, -3) : teks;
  const angka = Number(inti.replace(/[.,]/g, ''));
  return Number.isFinite(angka) ? angka : 0;
}

/**
 * Satu baris teks nota → item, atau null kalau barisnya bukan item.
 *
 * Bentuk yang dikenali (sengaja longgar — tiap kasir mencetak beda-beda):
 *   "2 Nasi Goreng      50.000"
 *   "2x Es Teh          8.000"
 *   "Ayam Bakar         35.000"
 */
export function parseReceiptLine(line: string): ScannedItem | null {
  const teks = line.trim();
  if (teks.length < 3) return null;
  if (BUKAN_ITEM.test(teks)) return null;

  // Harga = gugus angka TERAKHIR di baris, dan harus ≥ 3 digit. Angka pendek
  // biasanya jumlah/nomor meja, bukan rupiah.
  const cocok = teks.match(/([\d.,]{3,})\s*$/);
  if (!cocok) return null;
  const price = parseReceiptAmount(cocok[1]);
  if (price <= 0) return null;

  let sisa = teks.slice(0, cocok.index).trim();

  // Jumlah di depan: "2 " atau "2x " atau "2 x ".
  let qty = 1;
  const qtyCocok = sisa.match(/^(\d{1,2})\s*[xX]?\s+/);
  if (qtyCocok) {
    qty = Number(qtyCocok[1]) || 1;
    sisa = sisa.slice(qtyCocok[0].length).trim();
  }

  // Sisa pemisah kolom yang ikut terbaca ("Nasi Goreng ....." → dirapikan).
  const name = sisa.replace(/[.\-_·]{2,}/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!name || /^\d+$/.test(name)) return null;

  return { name, qty, price };
}

/** Semua baris nota → daftar item. Baris yang tidak dikenali dilewati. */
export function parseReceiptLines(lines: string[]): ScannedItem[] {
  const out: ScannedItem[] = [];
  for (const l of lines) {
    const item = parseReceiptLine(l);
    if (item) out.push(item);
  }
  return out;
}

export type ScanResult =
  | { ok: true; items: ScannedItem[]; lines: number }
  | { ok: false; reason: 'no-module' | 'failed' };

/**
 * Baca foto nota jadi daftar item.
 *
 * PENTING — hasilnya WAJIB diperiksa & dibetulkan sendiri. Struk thermal
 * Indonesia itu musuh terberat OCR: tinta pudar, nama menu disingkat, tata
 * letak beda tiap tempat. Ini menghemat mengetik, bukan menghilangkannya.
 */
export async function scanReceipt(uri: string): Promise<ScanResult> {
  const mod = getModule();
  if (!mod || !mod.isSupported) return { ok: false, reason: 'no-module' };
  try {
    const lines = await mod.extractTextFromImage(uri);
    return { ok: true, items: parseReceiptLines(lines), lines: lines.length };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
