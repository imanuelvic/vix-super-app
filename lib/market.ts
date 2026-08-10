// Data pasar LIVE dari Yahoo Finance (endpoint chart publik, tanpa API key).
// Dipakai fitur Investment: harga EMAS (Rupiah/gram) & BITCOIN (Rupiah).
//
// ⚠️ API tidak resmi — bisa berubah/diblokir Yahoo sewaktu-waktu. Semua pemanggil
// WAJIB menyiapkan fallback (tampilkan pesan error + tombol coba lagi), jangan
// sampai layar crash. Harga emas di sini = emas INTERNASIONAL (COMEX GC=F),
// bukan harga Antam/Logam Mulia (yang punya premium), jadi angkanya bisa beda.

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

const GOLD_SYMBOL = 'GC=F'; // COMEX Gold futures — USD per troy ounce
const FX_SYMBOL = 'USDIDR=X'; // kurs USD → IDR
const BTC_SYMBOL = 'BTC-USD'; // Bitcoin — USD
const IHSG_SYMBOL = '^JKSE'; // Indeks Harga Saham Gabungan (Bursa Efek Indonesia) — poin

const TROY_OUNCE_G = 31.1034768; // 1 troy ounce = 31,1034768 gram
const CACHE_TTL = 5 * 60 * 1000; // 5 menit — hindari terlalu sering menembak Yahoo
const FETCH_TIMEOUT = 12_000; // 12 detik

/** Satu titik harga untuk grafik: tanggal "YYYY-MM-DD" + harga (Rupiah). */
export type MarketPoint = { date: string; price: number };

type RawPoint = { t: number; close: number };
type ChartData = { price: number; points: RawPoint[] };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Epoch detik → "YYYY-MM-DD" (zona waktu perangkat). */
function isoDate(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Ambil 1 simbol dari Yahoo (harga sekarang + deret harian). Melempar bila gagal. */
async function fetchChart(
  symbol: string,
  range: string,
  interval: string,
): Promise<ChartData> {
  const url = `${YAHOO_BASE}${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);

  const json = (await res.json()) as YahooChartResponse;
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!result || !meta || typeof meta.regularMarketPrice !== 'number') {
    throw new Error(`Yahoo ${symbol}: data kosong`);
  }
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const points: RawPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === 'number') points.push({ t: ts[i], close: c });
  }
  return { price: meta.regularMarketPrice, points };
}

/**
 * Gabungkan deret harga (USD) dengan deret kurs USD→IDR memakai kurs terdekat
 * yang ≤ tanggal harga (carry-forward), lalu bagi `divisor` (mis. gram/oz untuk
 * emas, 1 untuk BTC). Hasil: deret harga dalam Rupiah.
 */
function toIdrSeries(
  base: RawPoint[],
  fx: RawPoint[],
  divisor: number,
): MarketPoint[] {
  const out: MarketPoint[] = [];
  let j = 0;
  let rate = fx[0]?.close ?? null;
  for (const p of base) {
    while (j < fx.length && fx[j].t <= p.t) {
      rate = fx[j].close;
      j++;
    }
    if (rate == null) continue;
    out.push({ date: isoDate(p.t), price: (p.close * rate) / divisor });
  }
  return out;
}

/** Deret harga langsung dari satu simbol (tanpa konversi kurs) — untuk aset yang
 *  memang sudah dalam Rupiah (kurs USD→IDR) atau berupa poin indeks (IHSG). */
function plainSeries(points: RawPoint[]): MarketPoint[] {
  return points.map((p) => ({ date: isoDate(p.t), price: p.close }));
}

/** Sisipkan/timpa titik "hari ini" dengan harga live supaya grafik & angka utama seragam. */
function withLiveLast(series: MarketPoint[], current: number): MarketPoint[] {
  const today = isoDate(Math.floor(Date.now() / 1000));
  const next = [...series];
  if (next.length > 0 && next[next.length - 1].date === today) {
    next[next.length - 1] = { date: today, price: current };
  } else {
    next.push({ date: today, price: current });
  }
  return next;
}

export type GoldData = {
  series: MarketPoint[]; // Rupiah/gram, harian ~6 bulan (titik terakhir = live)
  current: number; // Rupiah/gram sekarang
  usdPerOz: number; // harga emas COMEX (USD/oz)
  usdIdr: number; // kurs USD→IDR
  updatedAt: number; // epoch ms saat diambil
};

export type BtcData = {
  series: MarketPoint[]; // Rupiah, harian ~6 bulan (titik terakhir = live)
  idr: number; // harga BTC sekarang (Rupiah)
  usd: number; // harga BTC sekarang (USD)
  usdIdr: number; // kurs USD→IDR
  updatedAt: number;
};

let goldCache: { data: GoldData; at: number } | null = null;
let btcCache: { data: BtcData; at: number } | null = null;

/** Harga emas (Rupiah/gram) + deret 6 bulan. `force` = abaikan cache. */
export async function loadGold(force = false): Promise<GoldData> {
  if (!force && goldCache && Date.now() - goldCache.at < CACHE_TTL) {
    return goldCache.data;
  }
  const [gold, fx] = await Promise.all([
    fetchChart(GOLD_SYMBOL, '6mo', '1d'),
    fetchChart(FX_SYMBOL, '6mo', '1d'),
  ]);
  const usdPerOz = gold.price;
  const usdIdr = fx.price;
  const current = (usdPerOz * usdIdr) / TROY_OUNCE_G;
  const series = withLiveLast(
    toIdrSeries(gold.points, fx.points, TROY_OUNCE_G),
    current,
  );
  const data: GoldData = {
    series,
    current,
    usdPerOz,
    usdIdr,
    updatedAt: Date.now(),
  };
  goldCache = { data, at: Date.now() };
  return data;
}

/** Harga Bitcoin (Rupiah + USD) + deret 6 bulan. `force` = abaikan cache. */
export async function loadBtc(force = false): Promise<BtcData> {
  if (!force && btcCache && Date.now() - btcCache.at < CACHE_TTL) {
    return btcCache.data;
  }
  const [btc, fx] = await Promise.all([
    fetchChart(BTC_SYMBOL, '6mo', '1d'),
    fetchChart(FX_SYMBOL, '6mo', '1d'),
  ]);
  const usd = btc.price;
  const usdIdr = fx.price;
  const idr = usd * usdIdr;
  const series = withLiveLast(toIdrSeries(btc.points, fx.points, 1), idr);
  const data: BtcData = {
    series,
    idr,
    usd,
    usdIdr,
    updatedAt: Date.now(),
  };
  btcCache = { data, at: Date.now() };
  return data;
}

export type StockData = {
  series: MarketPoint[]; // poin indeks, harian ~6 bulan (titik terakhir = live)
  current: number; // poin IHSG sekarang
  updatedAt: number;
};

export type ForexData = {
  series: MarketPoint[]; // Rupiah per 1 USD, harian ~6 bulan (titik terakhir = live)
  idr: number; // kurs sekarang (Rupiah per 1 USD)
  updatedAt: number;
};

let ihsgCache: { data: StockData; at: number } | null = null;
let forexCache: { data: ForexData; at: number } | null = null;

/** IHSG (poin indeks) + deret 6 bulan. `force` = abaikan cache. */
export async function loadIhsg(force = false): Promise<StockData> {
  if (!force && ihsgCache && Date.now() - ihsgCache.at < CACHE_TTL) {
    return ihsgCache.data;
  }
  const idx = await fetchChart(IHSG_SYMBOL, '6mo', '1d');
  const current = idx.price;
  const series = withLiveLast(plainSeries(idx.points), current);
  const data: StockData = { series, current, updatedAt: Date.now() };
  ihsgCache = { data, at: Date.now() };
  return data;
}

/** Kurs Rupiah (USD→IDR, Rupiah per 1 USD) + deret 6 bulan. `force` = abaikan cache. */
export async function loadForex(force = false): Promise<ForexData> {
  if (!force && forexCache && Date.now() - forexCache.at < CACHE_TTL) {
    return forexCache.data;
  }
  const fx = await fetchChart(FX_SYMBOL, '6mo', '1d');
  const idr = fx.price;
  const series = withLiveLast(plainSeries(fx.points), idr);
  const data: ForexData = { series, idr, updatedAt: Date.now() };
  forexCache = { data, at: Date.now() };
  return data;
}

// Bentuk minimal respons Yahoo yang kita pakai (bagian lain diabaikan).
type YahooChartResponse = {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
};
