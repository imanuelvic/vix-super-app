// Kreator YouTube 🎬 — video terbaru dari kanal hiburan & game terkenal.
//
// ── Kenapa TANPA API key ──────────────────────────────────────────────────
// YouTube Data API v3 butuh API key, dan API key di dalam aplikasi klien BISA
// DIAMBIL orang lain — dipakai atas kuota (dan tagihan) milikmu. Selain itu
// kuotanya terbatas: 10.000 unit/hari, dan satu daftar video sudah memakan
// ratusan.
//
// Kanal YouTube menerbitkan feed publiknya sendiri:
//   https://www.youtube.com/feeds/videos.xml?channel_id=<id>
// Tanpa kunci, tanpa kuota, tanpa akun. Persis pola yang sudah dipakai fitur
// News 📰 (lihat fetchRss di lib/news.ts).
//
// ── Yang TIDAK bisa didapat dari feed ini, dan itu jujur harus disebut ────
// Feed-nya cuma memuat 15 video TERBARU tiap kanal, dan TIDAK memuat jumlah
// penonton maupun subscriber. Jadi tab ini menjawab "apa yang baru", bukan
// "mana yang paling banyak ditonton". Untuk angka penonton, satu-satunya jalan
// adalah Data API berbayar-kuota tadi — dan itu berarti API key di dalam app.

/** Satu kanal yang diikuti. */
export type Creator = {
  key: string;
  name: string;
  /**
   * Channel ID YouTube (diawali "UC…") — BUKAN @handle.
   *
   * Cara mendapatkannya kalau nanti mau menambah kanal: buka halaman kanalnya
   * di browser → menu ⋯ → Share → Copy channel ID. Feed-nya langsung bisa
   * dicoba di browser dengan menempel id-nya ke alamat di atas; kalau
   * halamannya menampilkan XML, id-nya benar.
   */
  channelId: string;
  emoji: string;
  /** Kelompok isinya — jadi chip saringan di layarnya. */
  kind: 'entertainment' | 'game';
};

export const CREATORS: Creator[] = [
  { key: 'mrbeast', name: 'MrBeast', channelId: 'UCX6OQ3DkcsbYNE6H8uQQuVA', emoji: '🎁', kind: 'entertainment' },
  { key: 'dudeperfect', name: 'Dude Perfect', channelId: 'UCRijo3ddMTht_IHyNSNXpNQ', emoji: '🎯', kind: 'entertainment' },
  { key: 'ryantrahan', name: 'Ryan Trahan', channelId: 'UCnmGIkw-KdI0W5siakKPKog', emoji: '🚶', kind: 'entertainment' },
  { key: 'markiplier', name: 'Markiplier', channelId: 'UC7_YxT-KID8kRbqZo7MyscQ', emoji: '🎮', kind: 'game' },
  { key: 'jacksepticeye', name: 'Jacksepticeye', channelId: 'UCYzPXprvl5Y-Sf0g4vX-m6g', emoji: '🕹️', kind: 'game' },
  { key: 'pewdiepie', name: 'PewDiePie', channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw', emoji: '👊', kind: 'game' },
];

export type CreatorKind = 'all' | Creator['kind'];

export const CREATOR_KINDS: { key: CreatorKind; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'entertainment', label: 'Hiburan' },
  { key: 'game', label: 'Game' },
];

export type Video = {
  id: string;
  title: string;
  link: string;
  channel: string;
  emoji: string;
  kind: Creator['kind'];
  publishedAt: Date | null;
  /** Gambar sampulnya (dari feed; kalau tak ada, dibuat dari id videonya). */
  thumb: string;
};

export const YOUTUBE_ERROR =
  'Gagal memuat video terbaru. Periksa koneksimu, lalu coba lagi.';

/** Berapa lama menunggu satu feed sebelum menyerah. */
const FETCH_TIMEOUT = 12_000;

/** Isi tag XML pertama — cukup untuk feed sesederhana ini. */
function tagValue(block: string, tag: string): string {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
  if (!m) return '';
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Video terbaru satu kanal.
 *
 * Feed YouTube itu ATOM, bukan RSS — blok isinya `<entry>` (bukan `<item>`),
 * dan tautannya ada di ATRIBUT `href`, bukan sebagai isi tag. Karena itu ia
 * tidak bisa memakai `fetchRss` milik News apa adanya; kalau dipaksa, hasilnya
 * daftar kosong tanpa pesan galat — jenis kegagalan yang paling membingungkan.
 */
export async function fetchCreatorVideos(c: Creator): Promise<Video[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  let res: Response;
  try {
    res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${c.channelId}`,
      { headers: { Accept: 'application/atom+xml' }, signal: controller.signal },
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`YouTube ${c.key}: HTTP ${res.status}`);

  const xml = await res.text();
  const blocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return blocks.map((block) => {
    const videoId = tagValue(block, 'yt:videoId');
    const published = tagValue(block, 'published');
    const waktu = published ? new Date(published) : null;
    // `<media:thumbnail url="…"/>` — atribut, bukan isi tag.
    const thumb =
      /<media:thumbnail[^>]*url="([^"]+)"/.exec(block)?.[1] ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      id: `${c.key}-${videoId}`,
      title: tagValue(block, 'title'),
      link: `https://www.youtube.com/watch?v=${videoId}`,
      channel: c.name,
      emoji: c.emoji,
      kind: c.kind,
      publishedAt: waktu && !isNaN(waktu.getTime()) ? waktu : null,
      thumb,
    };
  });
}

/** Berapa video yang ditampilkan sesudah semua kanal digabung. */
const VIDEO_LIMIT = 40;

/**
 * Video terbaru dari SEMUA kanal, digabung & diurutkan terbaru dulu.
 *
 * Diambil berbarengan dengan `allSettled`: satu kanal mati (id berubah, kanal
 * ditutup, jaringan putus) TIDAK boleh mengosongkan seluruh tab — sisanya
 * tetap tampil. Baru kalau semuanya gagal, errornya dilempar supaya layarnya
 * menampilkan "Coba lagi".
 */
export async function fetchCreatorFeed(): Promise<Video[]> {
  const hasil = await Promise.allSettled(CREATORS.map(fetchCreatorVideos));
  if (hasil.every((h) => h.status === 'rejected')) {
    throw hasil[0].status === 'rejected' && hasil[0].reason instanceof Error
      ? hasil[0].reason
      : new Error('semua kanal gagal');
  }
  return hasil
    .flatMap((h) => (h.status === 'fulfilled' ? h.value : []))
    .sort(
      (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    )
    .slice(0, VIDEO_LIMIT);
}

/** "4 jam lalu" / "2 hari lalu" — sama gayanya dengan fitur News. */
export function videoAge(at: Date | null, now: Date): string {
  if (!at) return '';
  const menit = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}
