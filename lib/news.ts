import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate, daysBetween } from './format';
import { dayDocId } from './health';
import { liveDoc } from './liveDoc';

// Fitur News 📰 — dua hal:
//   1) Berita terkini lewat RSS publik (tanpa API key).
//   2) Populasi dunia: catatan historis (dari worldometers.info) + perkiraan
//      hidup yang dihitung sendiri di perangkat.
//
// ⚠️ Fiturnya dulu bernama "World 🌏". Berkas, layar, rute & warnanya sudah
// diganti jadi News, TAPI jalur Firestore-nya SENGAJA tetap
// `users/{uid}/world/…`. Mengganti jalurnya berarti catatan populasi &
// kliping doa syafaat yang sudah tersimpan jadi yatim — tidak terbaca lagi,
// padahal datanya masih ada. Nama koleksi tak pernah kelihatan di layar;
// yang kelihatan sudah News.

// ============================ Populasi dunia ============================
// Catatan historis di bawah ini SALINAN dari catatan manual pemilik app
// (sumber angkanya: https://www.worldometers.info/world-population/).
// Sifatnya tetap — tidak pernah berubah — jadi disimpan di kode, bukan
// Firestore: gratis, selalu tersedia offline, dan nol read.

export type PopulationPoint = {
  dayId: string; // "YYYY-MM-DD"
  count: number;
  estimated?: boolean; // true = hasil hitungan app, bukan dibaca dari sumber
};

export const POPULATION_SOURCE = 'https://www.worldometers.info/world-population/';

const POPULATION_HISTORY: PopulationPoint[] = [
  { dayId: '2015-09-15', count: 7_367_170_043 },
  { dayId: '2015-10-15', count: 7_373_980_516 },
  { dayId: '2015-11-14', count: 7_380_837_378 },
  { dayId: '2015-12-15', count: 7_387_877_699 },

  { dayId: '2016-01-15', count: 7_395_016_819 },
  { dayId: '2016-02-23', count: 7_403_678_195 },
  { dayId: '2016-03-18', count: 7_409_255_038 },
  { dayId: '2016-04-18', count: 7_416_441_658 },
  { dayId: '2016-05-16', count: 7_422_828_954 },
  { dayId: '2016-07-18', count: 7_437_030_229 },
  // Catatan 9 Sep 2016 di sumber tulisannya "7.449.06.835" — kurang satu
  // digit, jadi sengaja TIDAK dimasukkan daripada menebak angka yang salah.
  { dayId: '2016-10-09', count: 7_456_110_934 },
  { dayId: '2016-11-10', count: 7_463_180_600 },
  { dayId: '2016-12-16', count: 7_471_408_191 },

  { dayId: '2017-01-16', count: 7_476_492_072 },
  { dayId: '2017-02-21', count: 7_485_778_455 },
  { dayId: '2017-03-10', count: 7_489_820_568 },
  { dayId: '2017-04-28', count: 7_500_904_736 },
  { dayId: '2017-05-10', count: 7_503_620_700 },
  { dayId: '2017-06-10', count: 7_510_590_028 },
  { dayId: '2017-07-10', count: 7_517_397_075 },
  { dayId: '2017-08-10', count: 7_524_406_731 },
  { dayId: '2017-09-10', count: 7_531_440_039 },
  { dayId: '2017-10-10', count: 7_573_129_198 },
  { dayId: '2017-11-10', count: 7_580_250_152 },
  { dayId: '2017-12-11', count: 7_587_184_464 },

  { dayId: '2018-01-10', count: 7_593_979_523 },
  { dayId: '2018-02-15', count: 7_602_215_572 },
  { dayId: '2018-03-10', count: 7_607_350_093 },
  { dayId: '2018-04-10', count: 7_614_282_925 },
  { dayId: '2018-05-10', count: 7_621_074_212 },
  { dayId: '2018-06-14', count: 7_629_009_679 },
  { dayId: '2018-07-10', count: 7_634_920_562 },
  { dayId: '2018-08-18', count: 7_643_767_359 },
  { dayId: '2018-09-10', count: 7_648_855_682 },
  { dayId: '2018-10-14', count: 7_656_604_915 },
  { dayId: '2018-11-10', count: 7_663_436_985 },
  { dayId: '2018-12-10', count: 7_669_037_485 },

  { dayId: '2019-01-10', count: 7_676_166_441 },
  { dayId: '2019-02-10', count: 7_683_136_875 },
  { dayId: '2019-03-10', count: 7_689_311_286 },
  { dayId: '2019-04-10', count: 7_696_291_264 },
  { dayId: '2019-05-10', count: 7_703_140_249 },
  { dayId: '2019-06-10', count: 7_709_761_670 },
  { dayId: '2019-07-16', count: 7_718_021_265 },
  { dayId: '2019-08-12', count: 7_724_044_195 },
  { dayId: '2019-09-10', count: 7_729_424_575 },
  { dayId: '2019-10-14', count: 7_736_908_791 },
  { dayId: '2019-11-10', count: 7_743_010_105 },
  { dayId: '2019-12-10', count: 7_749_644_212 },

  { dayId: '2020-01-10', count: 7_756_599_768 },
  { dayId: '2020-02-11', count: 7_765_138_927 },
  { dayId: '2020-03-10', count: 7_769_969_865 },
  { dayId: '2020-04-10', count: 7_776_666_242 },
  { dayId: '2020-05-22', count: 7_786_027_731 },
  { dayId: '2020-06-13', count: 7_791_042_516 },
  { dayId: '2020-07-14', count: 7_797_971_301 },
  { dayId: '2020-08-10', count: 7_804_038_986 },
  { dayId: '2020-09-10', count: 7_810_947_562 },
  // Sumber tertulis "7.817.856.3610" (11 digit); digit terakhir jelas kelebihan
  // ketik — 7.817.856.361 pas di antara nilai September & November.
  { dayId: '2020-10-12', count: 7_817_856_361 },
  { dayId: '2020-11-15', count: 7_825_616_704 },
  { dayId: '2020-12-10', count: 7_834_977_140 },

  { dayId: '2021-03-14', count: 7_852_087_042 },
  { dayId: '2021-04-11', count: 7_858_308_727 },
  { dayId: '2021-05-10', count: 7_864_793_642 },
  { dayId: '2021-06-11', count: 7_871_745_438 },
  { dayId: '2021-07-10', count: 7_878_360_126 },
  { dayId: '2021-08-11', count: 7_885_472_425 },
  { dayId: '2021-09-10', count: 7_892_210_024 },
  { dayId: '2021-10-10', count: 7_898_886_046 },
  { dayId: '2021-11-10', count: 7_905_705_963 },
  { dayId: '2021-12-10', count: 7_912_442_580 },

  { dayId: '2022-01-10', count: 7_919_169_930 },
  { dayId: '2022-02-15', count: 7_927_199_254 },
  { dayId: '2022-03-10', count: 7_932_430_842 },
  { dayId: '2022-04-16', count: 7_940_627_685 },
  { dayId: '2022-05-10', count: 7_945_970_729 },
  { dayId: '2022-06-10', count: 7_952_967_189 },
  { dayId: '2022-11-10', count: 7_999_103_819 },
  { dayId: '2022-12-10', count: 8_004_357_572 },

  { dayId: '2023-01-10', count: 8_010_232_732 },
  { dayId: '2023-04-11', count: 8_026_762_038 },
  { dayId: '2023-07-10', count: 8_043_430_413 },
  { dayId: '2023-11-10', count: 8_071_953_264 },
  { dayId: '2023-12-10', count: 8_078_164_472 },

  { dayId: '2024-01-10', count: 8_084_252_232 },
  { dayId: '2024-02-10', count: 8_090_562_573 },
  { dayId: '2024-03-10', count: 8_096_418_775 },
  { dayId: '2024-04-11', count: 8_102_786_813 },
  { dayId: '2024-05-10', count: 8_108_615_385 },
  { dayId: '2024-06-10', count: 8_114_829_598 },
  { dayId: '2024-07-10', count: 8_120_662_963 },
  { dayId: '2024-08-12', count: 8_170_091_442 },
  { dayId: '2024-09-10', count: 8_175_687_038 },
  { dayId: '2024-10-10', count: 8_181_374_133 },
  { dayId: '2024-11-10', count: 8_187_555_152 },
  { dayId: '2024-12-10', count: 8_193_070_185 },

  { dayId: '2025-01-10', count: 8_199_017_766 },
  { dayId: '2025-02-10', count: 8_204_961_204 },
  { dayId: '2025-03-10', count: 8_210_355_532 },
  { dayId: '2025-04-10', count: 8_216_284_543 },
  { dayId: '2025-05-10', count: 8_222_023_311 },
  { dayId: '2025-06-10', count: 8_227_980_261 },
  { dayId: '2025-07-10', count: 8_233_745_079 },
  { dayId: '2025-08-10', count: 8_239_676_350 },
  { dayId: '2025-09-10', count: 8_245_622_943 },
  { dayId: '2025-10-13', count: 8_252_005_073 },
  { dayId: '2025-11-12', count: 8_257_767_118 },
  { dayId: '2025-12-10', count: 8_263_080_961 },

  { dayId: '2026-01-10', count: 8_269_277_475 },
  { dayId: '2026-02-10', count: 8_274_980_377 },
  { dayId: '2026-03-10', count: 8_280_345_441 },
  { dayId: '2026-04-10', count: 8_286_290_551 },
  { dayId: '2026-07-13', count: 8_304_389_957 },
  { dayId: '2026-08-11', count: 8_309_930_650 },
];

/** Titik terakhir yang benar-benar dibaca dari sumber (bukan perkiraan). */
const LAST_KNOWN = POPULATION_HISTORY[POPULATION_HISTORY.length - 1];
const PREV_KNOWN = POPULATION_HISTORY[POPULATION_HISTORY.length - 2];

/**
 * Pertambahan penduduk per hari — dihitung dari DUA catatan terakhir, jadi
 * ikut menyesuaikan sendiri kalau catatannya ditambah. Ini juga cara
 * worldometers menampilkan angka "hidup"-nya: ekstrapolasi dari data PBB,
 * bukan sensus real-time.
 */
const POPULATION_PER_DAY = Math.round(
  (LAST_KNOWN.count - PREV_KNOWN.count) /
    Math.max(
      1,
      daysBetween(dayIdToDate(PREV_KNOWN.dayId), dayIdToDate(LAST_KNOWN.dayId)),
    ),
);

/** Perkiraan populasi dunia pada tanggal tertentu (ekstrapolasi linear). */
export function estimatePopulation(when: Date): number {
  const days = daysBetween(dayIdToDate(LAST_KNOWN.dayId), when);
  return LAST_KNOWN.count + days * POPULATION_PER_DAY;
}

/** Fakta ringkas yang diturunkan dari laju pertambahan. */
export function populationFacts(): { icon: string; label: string; value: string }[] {
  const perHour = Math.round(POPULATION_PER_DAY / 24);
  const perMinute = Math.round(POPULATION_PER_DAY / 1440);
  return [
    { icon: '📅', label: 'Bertambah per hari', value: `±${formatCount(POPULATION_PER_DAY)} orang` },
    { icon: '⏰', label: 'Per jam', value: `±${formatCount(perHour)} orang` },
    { icon: '⏱️', label: 'Per menit', value: `±${formatCount(perMinute)} orang` },
    { icon: '📈', label: 'Per tahun', value: `±${formatCount(POPULATION_PER_DAY * 365)} orang` },
  ];
}

/** 8309930650 → "8.309.930.650" (pemisah titik ala Indonesia). */
export function formatCount(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 8309930650 → "8,31 miliar" — untuk judul besar. */
export function formatBillions(n: number): string {
  return `${(n / 1_000_000_000).toFixed(2).replace('.', ',')} miliar`;
}

// ===== Catatan bulanan otomatis (Firestore) =====
// SATU dokumen kecil: users/{uid}/world/population → { points: {dayId: count} }.
// Diisi otomatis saat app dibuka pada/di atas tanggal 10 tiap bulan.

export type PopulationSaved = Record<string, number>;

/** Tanggal berapa catatan bulanan diambil. */
export const RECORD_DAY = 10;

export function subscribePopulationLog(
  uid: string,
  onChange: (points: PopulationSaved) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'world', 'population'),
    (snapshot) => onChange((snapshot.data()?.points as PopulationSaved) ?? {}),
    onError,
  );
}

/** "2026-08" — kunci bulan untuk cek "bulan ini sudah dicatat belum". */
function monthKey(dayId: string): string {
  return dayId.slice(0, 7);
}

/**
 * Catat perkiraan populasi untuk tanggal 10 bulan ini — hanya kalau hari ini
 * SUDAH tanggal 10 ke atas dan bulan ini belum tercatat (di kode maupun
 * Firestore). Aman dipanggil tiap buka layar: kalau sudah ada, tidak menulis.
 * Return dayId yang baru dicatat, atau null kalau tidak ada yang ditulis.
 */
export function recordMonthlyPopulation(
  uid: string,
  saved: PopulationSaved,
  now: Date,
): Promise<string | null> {
  if (now.getDate() < RECORD_DAY) return Promise.resolve(null);
  const target = new Date(now.getFullYear(), now.getMonth(), RECORD_DAY);
  const targetId = dayDocId(target);
  const month = monthKey(targetId);
  const already =
    Object.keys(saved).some((d) => monthKey(d) === month) ||
    POPULATION_HISTORY.some((p) => monthKey(p.dayId) === month);
  if (already) return Promise.resolve(null);

  return setDoc(
    doc(db, 'users', uid, 'world', 'population'),
    { points: { [targetId]: estimatePopulation(target) } },
    { merge: true },
  ).then(() => targetId);
}

/** Gabungan catatan tetap + catatan otomatis, terbaru di atas. */
export function allPopulationPoints(
  saved: PopulationSaved,
): PopulationPoint[] {
  const fixed = POPULATION_HISTORY.map((p) => ({ ...p }));
  const extra = Object.entries(saved).map(([dayId, count]) => ({
    dayId,
    count,
    estimated: true,
  }));
  return [...fixed, ...extra].sort((a, b) => b.dayId.localeCompare(a.dayId));
}

/** Selisih dengan catatan sebelumnya (untuk kolom "+x juta"). */
export function pointGrowth(
  points: PopulationPoint[],
  index: number,
): number | null {
  const next = points[index + 1]; // list urut terbaru → terlama
  return next ? points[index].count - next.count : null;
}

// ============================== Berita dunia ==============================
// RSS publik Google News — gratis, tanpa API key, sama pendekatannya dengan
// harga pasar Yahoo di lib/market.ts.
//
// ⚠️ Endpoint TIDAK RESMI: bisa berubah/dibatasi sewaktu-waktu. Pemanggil
// wajib menyiapkan pesan error + tombol coba lagi, jangan sampai layar mati.
// Yang diambil hanya JUDUL + TAUTAN (bukan isi artikel) — isi artikel milik
// penerbitnya, dibuka di browser lewat tautan aslinya.

export type NewsSource =
  | 'bloomberg'
  | 'world'
  | 'indonesia'
  | 'tech'
  | 'dev';

export const NEWS_SOURCES: {
  key: NewsSource;
  label: string;
  emoji: string;
  sub: string;
}[] = [
  { key: 'tech', label: 'Tech', emoji: '🤖', sub: 'AI, robotika & gadget' },
  { key: 'dev', label: 'Dev', emoji: '📱', sub: 'Expo, RN, iOS & Android' },
  { key: 'indonesia', label: 'Indo', emoji: '🇮🇩', sub: 'Indonesia · dalam negeri' },
  { key: 'world', label: 'Dunia', emoji: '🌏', sub: 'berita umum' },
  { key: 'bloomberg', label: 'Bisnis', emoji: '📈', sub: 'Bloomberg · bisnis & pasar' },
];

/**
 * Sumber yang terbuka duluan saat tab Berita dibuka.
 *
 * Tech — bukan Bloomberg seperti dulu. Dua alasannya: ini yang paling sering
 * dibaca pemilik app, dan karena ia yang PALING KIRI, barisnya mulai dari
 * awal sehingga chip pertama utuh, tidak setengah terpotong di tepi layar.
 */
export const NEWS_SOURCE_DEFAULT: NewsSource = NEWS_SOURCES[0].key;

/**
 * Satu alamat RSS beserta nama sumbernya.
 *
 * `source` dipakai kalau feed-nya tidak menyebutkan penerbitnya sendiri. Feed
 * Google News selalu menyebutkannya (lewat tag `<source>` atau ekor judul
 * " - Nama Media"), tapi blog resmi seperti reactnative.dev tidak — tanpa ini
 * semuanya akan tertulis "Google News", yang jelas salah.
 */
type Feed = { url: string; source?: string };

// Sebagian sumber menggabung BEBERAPA feed. Alasannya beda-beda:
//   tech → satu topik resmi (gadget & industri) + satu pencarian AI/robotika,
//          karena topik TECHNOLOGY sendiri jarang memuat riset AI.
//   dev  → tak ada satu pun feed yang memuat Expo, React Native, iOS, Android
//          & web sekaligus; yang ada blog RESMI masing-masing, dan itu justru
//          jauh lebih bermutu daripada hasil pencarian Google News (pencarian
//          "Expo" malah memungut berita pameran dagang & D23 Expo).
const NEWS_FEEDS: Record<NewsSource, Feed[]> = {
  bloomberg: [
    {
      url: 'https://news.google.com/rss/search?q=site:bloomberg.com+when:7d&hl=en-US&gl=US&ceid=US:en',
    },
  ],
  world: [
    {
      url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en',
    },
  ],
  // hl/gl/ceid Indonesia → judulnya berbahasa Indonesia, medianya media lokal.
  indonesia: [
    {
      url: 'https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id',
    },
  ],
  tech: [
    {
      url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',
    },
    // Kata kuncinya sengaja TANPA tanda kutip: frasa berkutip di dalam grup OR
    // pernah mengembalikan nol hasil di feed ini (kasus "harga pangan" di
    // lib/prayerNews.ts). Ketiga kata ini sudah cukup tanpa dikutip.
    {
      url: 'https://news.google.com/rss/search?q=artificial+intelligence+OR+AI+OR+robotics+when:7d&hl=en-US&gl=US&ceid=US:en',
    },
  ],
  dev: [
    { url: 'https://reactnative.dev/blog/rss.xml', source: 'React Native' },
    { url: 'https://expo.dev/changelog/rss.xml', source: 'Expo' },
    {
      url: 'https://developer.apple.com/news/rss/news.rss',
      source: 'Apple Developer',
    },
    {
      url: 'https://android-developers.googleblog.com/feeds/posts/default?alt=rss',
      source: 'Android Developers',
    },
    { url: 'https://web.dev/static/blog/feed.xml', source: 'web.dev' },
  ],
};

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: Date | null;
};

export const NEWS_ERROR =
  'Gagal memuat berita. Cek koneksi lalu coba lagi.';

const FETCH_TIMEOUT = 12_000;

/** Buang escape HTML & bungkus CDATA dari teks RSS. */
function decodeXml(raw: string): string {
  return raw
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function tagValue(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? decodeXml(m[1]) : '';
}

/**
 * Ambil judul berita terbaru dari SATU alamat RSS. Judul Google News berformat
 * "Judul berita - Nama Media" → bagian medianya dipisah supaya rapi.
 *
 * Dipakai bersama: tab News (lewat `fetchNews`) & rangkuman doa syafaat
 * mingguan (lib/prayerNews.ts) — satu pembaca RSS, bukan dua salinan.
 */
export async function fetchRss(
  url: string,
  tag: string,
  fallbackSource = 'Google News',
): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`RSS ${tag}: HTTP ${res.status}`);

  const xml = await res.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.slice(0, 30).map((block, i) => {
    const rawTitle = tagValue(block, 'title');
    const feedSource = tagValue(block, 'source');
    // Pisahkan " - Nama Media" di ekor judul (format khas Google News).
    const cut = rawTitle.lastIndexOf(' - ');
    const hasTail = cut > 20 && cut > rawTitle.length - 40;
    const pubDate = tagValue(block, 'pubDate');
    const parsed = pubDate ? new Date(pubDate) : null;
    return {
      id: `${tag}-${i}-${tagValue(block, 'guid') || rawTitle.slice(0, 40)}`,
      title: hasTail ? rawTitle.slice(0, cut) : rawTitle,
      link: tagValue(block, 'link'),
      source:
        feedSource || (hasTail ? rawTitle.slice(cut + 3) : fallbackSource),
      publishedAt: parsed && !isNaN(parsed.getTime()) ? parsed : null,
    };
  });
}

/** Berapa berita yang ditampilkan per sumber sesudah digabung & diurutkan. */
const NEWS_LIMIT = 40;

/**
 * Judul berita terbaru untuk satu sumber di tab News.
 *
 * Sumber yang punya beberapa feed diambil BERBARENGAN dengan `allSettled`:
 * satu feed mati (blog dipindah, jaringan putus) tidak boleh mengosongkan
 * seluruh tab — sisanya tetap tampil. Baru kalau SEMUANYA gagal, errornya
 * dilempar supaya layarnya menampilkan "Coba lagi".
 *
 * Hasilnya diurutkan terbaru dulu, dan judul yang sama (satu berita dimuat
 * dua feed) cuma tampil sekali.
 */
export async function fetchNews(source: NewsSource): Promise<NewsItem[]> {
  const feeds = NEWS_FEEDS[source];
  const hasil = await Promise.allSettled(
    feeds.map((f, i) => fetchRss(f.url, `${source}-${i}`, f.source)),
  );
  if (hasil.every((h) => h.status === 'rejected')) {
    throw hasil[0].reason instanceof Error
      ? hasil[0].reason
      : new Error(NEWS_ERROR);
  }

  const seen = new Set<string>();
  return hasil
    .flatMap((h) => (h.status === 'fulfilled' ? h.value : []))
    .filter((n) => {
      const kunci = n.title.toLowerCase();
      if (!kunci || seen.has(kunci)) return false;
      seen.add(kunci);
      return true;
    })
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, NEWS_LIMIT);
}

/** "3 jam lalu" / "2 hari lalu" — umur berita, ringkas. */
export function newsAge(when: Date | null, now: Date): string {
  if (!when) return '';
  const mins = Math.max(0, Math.round((now.getTime() - when.getTime()) / 60_000));
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}
