import { doc, setDoc, Timestamp, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { sameDay, sameMonth } from './format';

// Token listrik ⚡ — versi aplikasi dari spreadsheet "Electric Token".
//
// CARA KERJANYA, sesederhana kebiasaanmu sendiri:
// kamu mencatat ANGKA SISA kWh di meteran dua kali sehari —
//   🚪 pagi sebelum berangkat kerja, dan
//   🏠 sore/malam saat sampai rumah.
// Itu saja. Semua sisanya dihitung app: berapa kWh terpakai tiap selang waktu,
// berapa jam, berapa kWh per jam, berapa rupiahnya, dan sisa tokennya cukup
// sampai kapan.
//
// Kenapa dua kali sehari, bukan sekali: dari dua titik itu app bisa memisahkan
// pemakaian SAAT KAMU DI RUMAH (malam — AC & lampu) dari SAAT DITINGGAL (siang
// — kulkas & alat yang menyala terus). Persis dua kolom "Di Kamar" & "Tidak Di
// Kamar" di spreadsheet-mu, dan di situlah pemborosan biasanya ketahuan.
//
// Dua dokumen array kecil:
//   users/{uid}/house/tokenPurchases -> { list: TokenPurchase[] }
//   users/{uid}/house/tokenReadings  -> { list: MeterReading[] }

// ===================== Pembelian token =====================

export type TokenPurchase = {
  id: string;
  date: Timestamp;
  /** Yang dibayar, termasuk admin (mis. Rp200.300). */
  cost: number;
  /** kWh yang masuk ke meteran (mis. 114,96). */
  kwh: number;
  /** Beli lewat mana — Shopee, GoPay, dst. */
  platform: string;
  note: string;
};

export const TOKEN_PLATFORMS = ['Shopee', 'GoPay', 'PLN Mobile', 'Lainnya'];

export const newPurchaseId = () => `tp-${Date.now().toString(36)}`;

/**
 * Harga per kWh dari satu pembelian — angka inilah yang mengubah "berapa kWh
 * terpakai" jadi "berapa rupiah". 0 = belum bisa dihitung.
 */
export function ratePerKwh(p: TokenPurchase): number {
  return p.kwh > 0 ? p.cost / p.kwh : 0;
}

// ===================== Catatan meteran =====================

/**
 * Sedang apa saat mencatat. Inilah yang menentukan selang waktunya dihitung
 * "di rumah" atau "ditinggal" — jauh lebih jujur daripada menebak dari jam,
 * karena jam pulangmu tidak selalu sama.
 */
export type ReadingKind = 'home' | 'out';

export const READING_KINDS: {
  key: ReadingKind;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { key: 'home', label: 'Sampai rumah', icon: '🏠', hint: 'Sore/malam, baru sampai' },
  { key: 'out', label: 'Berangkat', icon: '🚪', hint: 'Pagi, sebelum pergi' },
];

export function readingKindMeta(key: string) {
  return READING_KINDS.find((k) => k.key === key) ?? READING_KINDS[0];
}

export type MeterReading = {
  id: string;
  at: Timestamp;
  /** Angka SISA kWh yang terbaca di meteran. */
  kwh: number;
  kind: ReadingKind;
  note: string;
};

export const newReadingId = () =>
  `mr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ===================== Firestore =====================

function purchasesRef(uid: string) {
  return doc(db, 'users', uid, 'house', 'tokenPurchases');
}

function readingsRef(uid: string) {
  return doc(db, 'users', uid, 'house', 'tokenReadings');
}

export function subscribeTokenPurchases(
  uid: string,
  onChange: (list: TokenPurchase[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    purchasesRef(uid),
    (snapshot) => onChange((snapshot.data()?.list as TokenPurchase[]) ?? []),
    onError,
  );
}

export function subscribeMeterReadings(
  uid: string,
  onChange: (list: MeterReading[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    readingsRef(uid),
    (snapshot) => onChange((snapshot.data()?.list as MeterReading[]) ?? []),
    onError,
  );
}

/** Tulis ulang seluruh daftar pembelian — termasuk HAPUS permanen. */
export function saveTokenPurchases(uid: string, list: TokenPurchase[]) {
  return setDoc(purchasesRef(uid), { list });
}

/** Tulis ulang seluruh daftar catatan meteran — termasuk HAPUS permanen. */
export function saveMeterReadings(uid: string, list: MeterReading[]) {
  return setDoc(readingsRef(uid), { list });
}

// ===================== Hitungan =====================

/** Urut waktu NAIK — dasar semua perhitungan selang waktu di bawah. */
export function sortedReadings(list: MeterReading[]): MeterReading[] {
  return [...list].sort((a, b) => a.at.toMillis() - b.at.toMillis());
}

/** Catatan terbaru (sisa kWh sekarang). null = belum pernah mencatat. */
export function latestReading(list: MeterReading[]): MeterReading | null {
  const urut = sortedReadings(list);
  return urut.length > 0 ? urut[urut.length - 1] : null;
}

/**
 * Satu selang waktu antara dua catatan berurutan.
 *
 * `atHome` = selang ini kamu ADA di rumah. Ditentukan catatan PEMBUKANYA:
 * dari "🏠 sampai rumah" sampai "🚪 berangkat" berarti kamu di rumah;
 * kebalikannya berarti rumahnya ditinggal.
 */
export type UsageSpan = {
  from: MeterReading;
  to: MeterReading;
  atHome: boolean;
  /** Lama selang, dalam jam. */
  hours: number;
  /** kWh yang terpakai. Bisa NEGATIF kalau ada pengisian token di tengahnya. */
  kwh: number;
  /** Rata-rata kWh per jam. 0 kalau selangnya nol jam. */
  perHour: number;
};

/**
 * Ubah deretan catatan jadi selang-selang pemakaian.
 *
 * Selang yang kWh-nya NAIK (angka meteran bertambah) sengaja DIBUANG: itu
 * bukan pemakaian, itu tanda token baru diisi di tengah-tengah. Kalau ikut
 * dihitung, pemakaiannya jadi minus dan semua rata-rata jadi ngawur —
 * persis yang terjadi di baris-baris terakhir spreadsheet-mu.
 */
export function usageSpans(list: MeterReading[]): UsageSpan[] {
  const urut = sortedReadings(list);
  const out: UsageSpan[] = [];
  for (let i = 1; i < urut.length; i++) {
    const from = urut[i - 1];
    const to = urut[i];
    const kwh = from.kwh - to.kwh;
    if (kwh < 0) continue; // token diisi di antara dua catatan ini
    const hours = (to.at.toMillis() - from.at.toMillis()) / 3_600_000;
    if (hours <= 0) continue;
    out.push({
      from,
      to,
      atHome: from.kind === 'home',
      hours,
      kwh,
      perHour: kwh / hours,
    });
  }
  return out;
}

/** Selang yang berakhir di dalam bulan `month` (0–11) tahun `year`. */
export function spansOfMonth(
  spans: UsageSpan[],
  year: number,
  month: number,
): UsageSpan[] {
  // Tanggal acuannya dibuat SEKALI di luar penyaring, bukan tiap entri.
  const acuan = new Date(year, month, 1);
  return spans.filter((s) => sameMonth(s.to.at.toDate(), acuan));
}

export type UsageSummary = {
  /** Total kWh terpakai. */
  kwh: number;
  /** Bagian yang terpakai saat kamu di rumah. */
  homeKwh: number;
  /** Bagian yang terpakai saat rumahnya ditinggal. */
  awayKwh: number;
  /** Total jam yang tercatat. */
  hours: number;
  /** Rata-rata kWh per HARI (dihitung dari jam, bukan jumlah catatan). */
  perDay: number;
};

export function summarize(spans: UsageSpan[]): UsageSummary {
  let kwh = 0;
  let homeKwh = 0;
  let awayKwh = 0;
  let hours = 0;
  for (const s of spans) {
    kwh += s.kwh;
    hours += s.hours;
    if (s.atHome) homeKwh += s.kwh;
    else awayKwh += s.kwh;
  }
  return {
    kwh,
    homeKwh,
    awayKwh,
    hours,
    // Per hari = per jam × 24. Memakai jam, bukan "jumlah hari yang ada
    // catatannya" — hari yang cuma tercatat separuh tidak boleh dihitung
    // sebagai satu hari penuh, nanti angkanya terlalu kecil.
    perDay: hours > 0 ? (kwh / hours) * 24 : 0,
  };
}

/**
 * Harga per kWh yang BERLAKU sekarang = pembelian terakhir. Kalau belum pernah
 * mencatat pembelian, 0 — dan semua rupiah di layar ditampilkan sebagai "—",
 * bukan Rp0 yang menyesatkan.
 */
export function currentRate(purchases: TokenPurchase[]): number {
  let terbaru: TokenPurchase | null = null;
  for (const p of purchases) {
    if (!terbaru || p.date.toMillis() > terbaru.date.toMillis()) terbaru = p;
  }
  return terbaru ? ratePerKwh(terbaru) : 0;
}

/** Pembelian di dalam bulan tertentu — "keluar duit token bulan ini". */
export function purchasesOfMonth(
  purchases: TokenPurchase[],
  year: number,
  month: number,
): TokenPurchase[] {
  const acuan = new Date(year, month, 1);
  return purchases.filter((p) => sameMonth(p.date.toDate(), acuan));
}

export function totalCost(purchases: TokenPurchase[]): number {
  return purchases.reduce((sum, p) => sum + p.cost, 0);
}

/**
 * Perkiraan sisa token cukup berapa HARI lagi, dari sisa kWh terakhir dibagi
 * rata-rata pemakaian harian. null = belum cukup data untuk menebak.
 */
export function daysLeft(
  readings: MeterReading[],
  perDay: number,
): number | null {
  const terakhir = latestReading(readings);
  if (!terakhir || perDay <= 0) return null;
  return terakhir.kwh / perDay;
}

/** Berapa hari lagi sebelum dianggap "hampir habis" & perlu ditagih. */
export const TOKEN_LOW_DAYS = 3;

/**
 * Sudah waktunya mencatat meteran? true kalau catatan TERAKHIR bukan hari ini,
 * atau hari ini baru satu kali dicatat (pagi saja / malam saja).
 *
 * Dipakai badge sub-tab Token: mengingatkan tanpa perlu jadwal atau notifikasi
 * — app ini memang tidak punya keduanya.
 */
export function readingDue(readings: MeterReading[], now: Date): boolean {
  const hariIni = readings.filter((r) => sameDay(r.at.toDate(), now));
  return hariIni.length < 2;
}
