import { Schema } from 'firebase/ai';

import { aiDayStore, sisaJatah } from './aiDay';
import { guardedAiCall } from './aiGuard';
import { GAYA_BAHASA, tanpaEmoji } from './aiStyle';
import {
  AiAnswerError,
  geminiErrorMessage,
  geminiModel,
  parseJsonAnswer,
  stripEmDash,
  withModelFallback,
} from './gemini';
import type { MarketPoint } from './market';

// ✨ Analysis — pembaca pasar untuk fitur Investment 📈.
//
// Yang dilakukannya: mengambil deret harga enam bulan yang MEMANG SUDAH ada di
// app (emas, Bitcoin, IHSG, kurs USD/IDR), memerasnya jadi belasan angka,
// menambahkan judul berita kripto & bisnis terbaru, lalu meminta Gemini
// membaca keduanya bersama-sama dan menjawab dalam bentuk tetap: arah,
// seberapa yakin, alasan, apa yang dicermati, dan apa yang masuk akal
// disiapkan.
//
// ── SATU aset per permintaan (1 Okt 2026) ─────────────────────────────────
// Semula satu jawaban memuat emas DAN Bitcoin sekaligus, dan itu terlalu
// panjang: Gemini 3.x menghitung token "berpikir" ke dalam maxOutputTokens,
// jadi jawabannya rutin terpotong di tengah ("MAX_TOKENS") dan yang sampai ke
// layar cuma pesan galat. Sekarang tiap sub-tab bertanya tentang ASETNYA
// SENDIRI, jawabannya seperempat panjangnya, dan jatah tokennya dinaikkan dua
// kali lipat. Angkanya tetap dikirim lengkap keempat aset, karena membaca satu
// aset tanpa melihat kursnya memang gampang salah kesimpulan.
//
// ── Kenapa angkanya diperas dulu, bukan dikirim mentah ────────────────────
// Deret enam bulan itu ±130 titik per aset. Dikirim apa adanya, satu
// permintaan bisa belasan ribu token, dan itulah cara tercepat menghabiskan
// kuota gratis. Yang benar-benar dipakai untuk membaca tren cuma ringkasannya:
// harga sekarang, perubahan 1 / 7 / 30 / 180 hari, titik tertinggi & terendah,
// dan posisi harga sekarang di dalam rentang itu. Belasan angka, bukan ratusan.
//
// ── Uang ──────────────────────────────────────────────────────────────────
// Sama seperti seluruh AI di app ini: Firebase AI Logic + Gemini Developer API
// di paket Spark, jadi lewat kuota = ditolak 429, BUKAN ditagih. Beritanya RSS
// publik tanpa kunci, harganya Yahoo publik tanpa kunci. Tidak ada satu pun
// layanan berbayar di jalur ini.
//
// Tiga lapis penahan pemakaian:
//   1. Hasilnya DISIMPAN per hari per aset per rentang (AsyncStorage).
//      Membuka tabnya lagi tidak memanggil AI lagi, seharian.
//   2. Jatah sendiri: MARKET_DAILY_CAP panggilan per hari untuk fitur ini.
//   3. Pagar umum lib/aiGuard.ts di bawahnya (dedupe, cooldown, kunci 429,
//      batas harian seluruh app).
//
// ── Yang TIDAK dilakukan ──────────────────────────────────────────────────
// Ini bukan nasihat keuangan dan tidak boleh berlagak tahu. Promptnya melarang
// angka ramalan yang pasti ("besok Rp2.500.000"), melarang ajakan beli/jual,
// dan mewajibkan menyebut apa yang bisa membuat bacaannya meleset.

export type MarketHorizon = 'harian' | 'mingguan';

/** Aset yang bisa dibacakan — satu per sub-tab Investment. */
export type MarketAsset = 'emas' | 'btc' | 'saham' | 'forex';

export const MARKET_ASSET_LABEL: Record<MarketAsset, string> = {
  emas: 'EMAS (per gram, Rupiah)',
  btc: 'BITCOIN (1 BTC, Rupiah)',
  saham: 'IHSG (poin indeks)',
  forex: 'KURS USD ke IDR (Rupiah per 1 USD)',
};

export type MarketArah = 'naik' | 'turun' | 'sideways';
export type MarketKeyakinan = 'rendah' | 'sedang' | 'tinggi';

/** Bacaan satu aset. */
export type MarketSignal = {
  arah: MarketArah;
  keyakinan: MarketKeyakinan;
  /** Satu kalimat inti. */
  ringkas: string;
  /** 2 sampai 4 alasan pendek, masing-masing satu baris. */
  alasan: string[];
  /** Apa yang membuat bacaan ini bisa meleset / angka yang perlu dilihat. */
  cermati: string;
  /** Apa yang masuk akal dilakukan, tanpa menyuruh beli atau jual. */
  aksi: string;
  /** Satu kalimat penutup yang jujur soal batas bacaan ini. */
  catatan: string;
};

/**
 * Jatah panggilan AI Analysis per hari.
 *
 * Enam, bukan tiga: sejak bacaannya per aset, satu hari yang wajar = emas &
 * Bitcoin di rentang harian (2) plus satu dua bacaan mingguan atau aset lain.
 * Masih jauh di bawah batas 30 per hari milik pagar umum lib/aiGuard.ts.
 */
export const MARKET_DAILY_CAP = 6;

/** Berapa judul berita yang ikut dikirim. Cukup untuk konteks, bukan kliping. */
export const MARKET_NEWS_LIMIT = 12;

// ===================== Peras deret harga jadi angka =====================

/** Ringkasan satu deret harga. */
export type SeriesStat = {
  now: number;
  /** Perubahan persen terhadap N hari perdagangan sebelumnya. null = deret pendek. */
  d1: number | null;
  d7: number | null;
  d30: number | null;
  d180: number | null;
  high: number;
  low: number;
  /** Posisi harga sekarang di rentang tertinggi-terendah, 0 sampai 100. */
  pos: number;
};

function ubah(series: MarketPoint[], mundur: number): number | null {
  const i = series.length - 1 - mundur;
  if (i < 0) return null;
  const lama = series[i].price;
  if (!lama) return null;
  return ((series[series.length - 1].price - lama) / lama) * 100;
}

/**
 * Peras deret harga jadi ringkasan yang bisa dibaca model. MURNI: tidak
 * menyentuh jaringan maupun jam sistem, jadi bisa diuji apa adanya.
 *
 * `mundur` dihitung dalam TITIK deret, bukan hari kalender. Untuk emas & saham
 * deretnya cuma hari perdagangan, jadi 30 titik itu kira-kira 6 minggu. Itu
 * disebut apa adanya di dalam prompt supaya modelnya tidak salah membacanya
 * sebagai sebulan persis.
 */
export function seriesStat(series: MarketPoint[]): SeriesStat | null {
  if (series.length < 2) return null;
  const harga = series.map((s) => s.price);
  const high = Math.max(...harga);
  const low = Math.min(...harga);
  const now = harga[harga.length - 1];
  return {
    now,
    d1: ubah(series, 1),
    d7: ubah(series, 7),
    d30: ubah(series, 30),
    d180: ubah(series, series.length - 1),
    high,
    low,
    pos: high === low ? 50 : ((now - low) / (high - low)) * 100,
  };
}

const pct = (n: number | null): string =>
  n === null ? 'belum ada data' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const bulat = (n: number): string => Math.round(n).toLocaleString('id-ID');

function blok(nama: string, s: SeriesStat): string {
  return [
    `${nama}:`,
    `- sekarang ${bulat(s.now)}`,
    `- 1 titik terakhir ${pct(s.d1)}, 7 titik ${pct(s.d7)}, 30 titik ${pct(s.d30)}, seluruh 6 bulan ${pct(s.d180)}`,
    `- tertinggi 6 bulan ${bulat(s.high)}, terendah ${bulat(s.low)}`,
    `- posisi sekarang ${s.pos.toFixed(0)} dari 100 di rentang itu (0 = terendah, 100 = tertinggi)`,
  ].join('\n');
}

/** Bahan angka untuk promptnya. MURNI, jadi suite bisa memeriksanya langsung. */
export function marketBrief(input: Partial<Record<MarketAsset, SeriesStat | null>>): string {
  const bagian: string[] = [
    'Data harga 6 bulan terakhir (satu titik = satu hari perdagangan, jadi 30 titik kira-kira 6 minggu kalender):',
  ];
  for (const aset of ['emas', 'btc', 'saham', 'forex'] as MarketAsset[]) {
    const s = input[aset];
    if (s) bagian.push(blok(MARKET_ASSET_LABEL[aset], s));
  }
  return bagian.join('\n\n');
}

// ===================== Prompt =====================

const RENTANG_TEKS: Record<MarketHorizon, string> = {
  harian: 'satu sampai tiga hari ke depan',
  mingguan: 'satu sampai dua pekan ke depan',
};

const SYSTEM = `Kamu membantu satu orang Indonesia (bukan pedagang profesional) MEMBACA pasar dari data yang dia punya sendiri. Dia memantau harganya lewat aplikasi pribadinya dan sedang belajar mengenali kapan harga sedang murah dan kapan sedang mahal.

Kamu diberi angka EMPAT aset sekaligus, tapi yang kamu jawab HANYA SATU aset yang disebut di pertanyaannya. Tiga lainnya cuma konteks.

Yang kamu kerjakan: membaca angka yang diberikan, menghubungkannya dengan judul berita yang diberikan, lalu menyebut arah yang PALING MASUK AKAL untuk aset itu beserta alasannya.

Aturan yang tidak boleh dilanggar:
- JANGAN menyebut angka ramalan yang pasti. Dilarang menulis "besok Rp2.500.000" atau "akan naik 5%". Yang boleh: arah, dan kira-kira seberapa kuat.
- JANGAN menyuruh membeli atau menjual. Kolom aksi berisi hal yang bisa dia SIAPKAN atau PERHATIKAN, misalnya menunggu harga menyentuh rentang tertentu, mencicil pembelian, atau menahan diri sampai arahnya lebih jelas.
- JANGAN mengarang berita. Kalau judul berita yang diberikan tidak menjelaskan gerakan harganya, katakan begitu, jangan diisi tebakan.
- Kalau datanya campur aduk dan tidak ada arah yang jelas, jawab "sideways" dengan keyakinan "rendah". Itu jawaban yang benar, bukan kegagalan.
- Emas dan Bitcoin dihargai dalam Rupiah di sini, jadi KURS USD ke IDR ikut menggerakkannya. Kalau kurs sedang bergerak kencang, sebut itu.
- Keyakinan "tinggi" hanya kalau beberapa hal menunjuk arah yang sama sekaligus. Kalau ragu, pilih yang lebih rendah.

Bentuk tiap kolom. JAWABLAH PENDEK, ini dibaca di layar HP:
- arah: persis salah satu dari "naik", "turun", "sideways".
- keyakinan: persis salah satu dari "rendah", "sedang", "tinggi".
- ringkas: SATU kalimat, maksimal 15 kata.
- alasan: 2 sampai 3 baris, satu kalimat per baris, maksimal 15 kata per baris. Sebut angkanya kalau ada.
- cermati: SATU kalimat, maksimal 20 kata: apa yang bisa membuat bacaan ini meleset atau angka yang perlu dia lihat.
- aksi: SATU kalimat, maksimal 20 kata: hal yang bisa dia siapkan. Bukan perintah beli atau jual.
- catatan: SATU kalimat pendek yang jujur bahwa ini bacaan dari data terbatas, bukan nasihat keuangan.

${GAYA_BAHASA}

Aturan emoji: JANGAN memakai emoji sama sekali. Aplikasinya sendiri yang memasang lambang arah dan warnanya.

Kembalikan JSON dengan kunci: arah, keyakinan, ringkas, alasan, cermati, aksi, catatan.`;

const SKEMA = Schema.object({
  properties: {
    arah: Schema.enumString({ enum: ['naik', 'turun', 'sideways'] }),
    keyakinan: Schema.enumString({ enum: ['rendah', 'sedang', 'tinggi'] }),
    ringkas: Schema.string(),
    alasan: Schema.array({ items: Schema.string() }),
    cermati: Schema.string(),
    aksi: Schema.string(),
    catatan: Schema.string(),
  },
});

function model(nama: string) {
  return geminiModel(nama, {
    systemInstruction: SYSTEM,
    generationConfig: {
      // Rendah: ini membaca angka, bukan menulis puisi. Jawaban yang "kreatif"
      // di sini justru berarti mengarang.
      temperature: 0.3,
      // 4096, bukan 2048: Gemini 3.x menghitung token "berpikir" ke dalam
      // jatah ini, dan dengan 2048 jawabannya rutin terpotong di tengah
      // (finishReason MAX_TOKENS) sehingga yang sampai ke layar cuma pesan
      // galat. Jawabannya sendiri cuma ±80 kata; sisanya ruang berpikir.
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: SKEMA,
    },
  });
}

// ===================== Baca jawabannya =====================

const ARAH: MarketArah[] = ['naik', 'turun', 'sideways'];
const KEYAKINAN: MarketKeyakinan[] = ['rendah', 'sedang', 'tinggi'];

/** Bersihkan satu kalimat: tanpa tanda pisah panjang, tanpa emoji, tanpa kutip. */
function kalimat(v: unknown): string {
  if (typeof v !== 'string') return '';
  return tanpaEmoji(stripEmDash(v).replace(/^["“”']+|["“”']+$/g, '')).trim();
}

/** Jawaban mentah Gemini → bentuk yang dipakai layar. Melempar kalau rusak. */
export function finalizeMarketAnalysis(jawaban: unknown): MarketSignal {
  const o = (jawaban ?? {}) as Record<string, unknown>;
  const arah = ARAH.find((a) => a === o.arah);
  const keyakinan = KEYAKINAN.find((k) => k === o.keyakinan);
  const ringkas = kalimat(o.ringkas);
  if (!arah || !keyakinan || !ringkas) {
    throw new AiAnswerError('Jawaban AI tidak terbaca. Coba lagi.');
  }
  const alasan = (Array.isArray(o.alasan) ? o.alasan : [])
    .map(kalimat)
    .filter(Boolean)
    .slice(0, 4);
  return {
    arah,
    keyakinan,
    ringkas,
    alasan,
    cermati: kalimat(o.cermati),
    aksi: kalimat(o.aksi),
    catatan:
      kalimat(o.catatan) ||
      'Ini bacaan dari data terbatas, bukan nasihat keuangan.',
  };
}

/**
 * Minta satu bacaan pasar untuk SATU aset. `brief` dari `marketBrief`, `judul`
 * dari RSS berita.
 *
 * `aset`, `dayId` & `rentang` ikut jadi kunci pagar, jadi permintaan yang sama
 * di hari yang sama tidak pernah dikirim dua kali; `attempt` dinaikkan kalau
 * memang sengaja minta bacaan baru.
 */
export async function generateMarketAnalysis(
  aset: MarketAsset,
  brief: string,
  judul: string[],
  rentang: MarketHorizon,
  dayId: string,
  attempt = 1,
): Promise<MarketSignal> {
  if (!brief.includes(MARKET_ASSET_LABEL[aset])) {
    throw new AiAnswerError('Harga belum termuat. Perbarui harganya dulu.');
  }
  const berita = judul.slice(0, MARKET_NEWS_LIMIT);
  const bagianBerita = berita.length
    ? `Judul berita terbaru (kripto, bisnis, dan pasar). Pakai hanya yang relevan; abaikan sisanya:\n${berita
        .map((t) => `- ${t}`)
        .join('\n')}`
    : 'Tidak ada judul berita yang bisa diambil kali ini. Baca dari angkanya saja, dan sebut keterbatasan itu di kolom cermati.';

  const pertanyaan = `Baca arah ${MARKET_ASSET_LABEL[aset]} untuk ${RENTANG_TEKS[rentang]}. Aset lain di bawah cuma konteks, jangan ikut dijawab.\n\n${brief}\n\n${bagianBerita}`;

  return guardedAiCall(`market|${aset}|${rentang}|${dayId}|${attempt}|${brief}`, () =>
    withModelFallback(async (nama) => {
      const hasil = await model(nama).generateContent(pertanyaan);
      return finalizeMarketAnalysis(parseJsonAnswer(hasil));
    }),
  );
}

export function marketAiErrorMessage(e: unknown): string {
  return geminiErrorMessage(
    e,
    'AI belum bisa membaca pasar sekarang. Harga & grafiknya tetap bisa dilihat seperti biasa.',
  );
}

// ===================== Jatah & hasil per hari (AsyncStorage) =====================

/** Kunci bacaan tersimpan: "emas|harian". */
type KunciBacaan = `${MarketAsset}|${MarketHorizon}`;

export type MarketAiDay = {
  /** Berapa kali AI dipanggil hari itu (semua aset & rentang digabung). */
  attempts: number;
  /** Bacaan terakhir per aset+rentang, supaya membuka tabnya lagi tidak memanggil AI. */
  hasil: Partial<Record<KunciBacaan, MarketSignal>>;
};

export const EMPTY_MARKET_AI_DAY: MarketAiDay = { attempts: 0, hasil: {} };

export const kunciBacaan = (
  aset: MarketAsset,
  rentang: MarketHorizon,
): KunciBacaan => `${aset}|${rentang}`;

const HARI = aiDayStore<MarketAiDay>('market', EMPTY_MARKET_AI_DAY, (v) => ({
  attempts: typeof v.attempts === 'number' ? v.attempts : 0,
  hasil: v.hasil && typeof v.hasil === 'object' ? v.hasil : {},
}));

export const loadMarketAiDay = HARI.load;
export const saveMarketAiDay = HARI.save;

/** Masih boleh minta lagi hari ini? */
export function marketAttemptsLeft(day: MarketAiDay): number {
  return sisaJatah(MARKET_DAILY_CAP, day.attempts);
}
