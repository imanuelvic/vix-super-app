import { doc, setDoc, Timestamp, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { dayId, sameDay, sameMonth } from './format';

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

// ===================== Riwayat harian =====================

/**
 * Satu catatan meteran beserta apa yang terjadi SESUDAHNYA sampai catatan
 * berikutnya.
 */
export type DayLogEntry = {
  reading: MeterReading;
  /**
   * Selang pemakaian yang DIMULAI catatan ini. null = catatan terakhir (belum
   * ada catatan berikutnya) atau token diisi di antaranya (lihat `refill`).
   */
  span: UsageSpan | null;
  /** Angka meteran NAIK di catatan berikutnya = token diisi di antaranya. */
  refill: boolean;
};

export type DayLog = {
  /** "2026-09-15" — kunci & key daftar. */
  dayId: string;
  date: Date;
  /** Urut jam NAIK — pagi dulu, lalu malam: dibaca seperti buku harian. */
  entries: DayLogEntry[];
  /** kWh terpakai dari semua selang yang DIMULAI hari ini. */
  kwh: number;
};

/**
 * Riwayat per HARI, terbaru di atas.
 *
 * Tiap hari memuat catatan meteran hari itu (urut jam) dan, di bawah tiap
 * catatan, selang pemakaian yang dimulainya sampai catatan berikutnya — walau
 * catatan berikutnya baru besok pagi. Jadi "Sel, 15 Sep" = seluruh pemakaian
 * sejak catatan pertama hari itu sampai catatan pertama hari berikutnya, dan
 * angka kWh di kepalanya adalah jumlah selang-selang itu.
 *
 * Dulu (sampai 15 Sep 2026) selang & catatan meteran dua daftar terpisah:
 * yang satu bilang "9,5 jam · 2,1 kWh", yang lain "07.30 · 118,6 kWh", dan
 * mencocokkan keduanya harus bolak-balik menggulung. Di sini satu hari dibaca
 * sekali jalan: jam berapa dicatat berapa, lalu sampai catatan berikutnya
 * habis berapa & kira-kira berapa rupiah.
 */
export function dailyLog(readings: MeterReading[]): DayLog[] {
  const urut = sortedReadings(readings);
  // Selang dicari dari id catatan PEMBUKANYA — usageSpans sudah membuang
  // selang yang meterannya naik (token diisi) & yang jamnya nol.
  const spanDari = new Map<string, UsageSpan>();
  for (const s of usageSpans(readings)) spanDari.set(s.from.id, s);

  const hari = new Map<string, DayLog>();
  urut.forEach((r, i) => {
    const berikut: MeterReading | undefined = urut[i + 1];
    const at = r.at.toDate();
    const id = dayId(at);
    let h = hari.get(id);
    if (!h) {
      h = {
        dayId: id,
        date: new Date(at.getFullYear(), at.getMonth(), at.getDate()),
        entries: [],
        kwh: 0,
      };
      hari.set(id, h);
    }
    const span = spanDari.get(r.id) ?? null;
    h.entries.push({
      reading: r,
      span,
      refill: berikut !== undefined && berikut.kwh > r.kwh,
    });
    if (span) h.kwh += span.kwh;
  });
  // Map menjaga urutan penyisipan (naik) → dibalik supaya terbaru di atas.
  return [...hari.values()].reverse();
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
 * Apa yang masih kurang dari catatan meteran HARI INI.
 *
 * Badge sub-tab Token dan kartu penjelasnya di dalam sub-tab itu sama-sama
 * berangkat dari sini — kalau tidak, badge bisa menyala sementara kartunya
 * bilang semuanya beres, dan badge yang begitu berhenti dipercaya.
 */
export function readingTodo(
  readings: MeterReading[],
  now: Date,
): {
  /** Sudah tercatat berapa kali hari ini. */
  count: number;
  /** Jenis catatan yang belum ada hari ini (🚪 Berangkat / 🏠 Sampai rumah). */
  missing: (typeof READING_KINDS)[number][];
  /** Badge ⚡ menyala? */
  due: boolean;
} {
  const hariIni = readings.filter((r) => sameDay(r.at.toDate(), now));
  return {
    count: hariIni.length,
    missing: READING_KINDS.filter(
      (k) => !hariIni.some((r) => r.kind === k.key),
    ),
    // Dihitung dari JUMLAHNYA, bukan dari `missing`: mencatat dua kali dengan
    // jenis yang sama tetap dua titik ukur, dan dari dua titik itulah
    // pemakaiannya bisa dihitung. Itu yang sebenarnya ditagih.
    due: hariIni.length < 2,
  };
}

/**
 * Sudah waktunya mencatat meteran? true kalau catatan TERAKHIR bukan hari ini,
 * atau hari ini baru satu kali dicatat (pagi saja / malam saja).
 *
 * Dipakai badge sub-tab Token: mengingatkan tanpa perlu jadwal atau notifikasi
 * — app ini memang tidak punya keduanya.
 */
export function readingDue(readings: MeterReading[], now: Date): boolean {
  return readingTodo(readings, now).due;
}
