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
  kind: CreatorKind;
};

/**
 * Tiga kelompok isi, dan ketiganya sengaja sejalan dengan fitur ini sendiri:
 * Summit ⛰️ punya pasangan tontonannya (Mountain), Recreation 🏝️ juga
 * (Recreation), dan Mr. Beast berdiri sendiri karena memang itu yang dicari.
 *
 * Tidak ada lagi chip "Semua": tiga kelompok ini isinya berbeda jauh, dan
 * digabung jadi satu daftar yang paling sering menerbitkan video (kanal Beast)
 * selalu menenggelamkan sisanya.
 */
export type CreatorKind = 'mrbeast' | 'mountain' | 'recreation';

export const CREATOR_KINDS: { key: CreatorKind; label: string }[] = [
  { key: 'mrbeast', label: 'Mr. Beast' },
  { key: 'mountain', label: 'Mountain' },
  { key: 'recreation', label: 'Recreation' },
];

// ⚠️ Tiap `channelId` di bawah SUDAH DIBUKTIKAN: feed-nya diambil sungguhan
// lalu nama pemiliknya (<author><name> di dalam feed) dicocokkan dengan nama
// di sini. Ini bukan kehati-hatian berlebihan — id yang salah TIDAK
// menimbulkan pesan galat apa pun (fetchCreatorFeed memakai allSettled), ia
// cuma membuat satu kanal diam-diam menghilang dari daftar. Kalau nanti
// menambah kanal, buktikan dengan cara yang sama.
export const CREATORS: Creator[] = [
  // --- Mr. Beast & saudara-saudara kanalnya ---
  { key: 'mrbeast', name: 'MrBeast', channelId: 'UCX6OQ3DkcsbYNE6H8uQQuVA', emoji: '🎁', kind: 'mrbeast' },
  { key: 'beastreacts', name: 'Beast Reacts', channelId: 'UCUaT_39o1x6qWjz7K2pWcgw', emoji: '😱', kind: 'mrbeast' },
  { key: 'mrbeastgaming', name: 'MrBeast Gaming', channelId: 'UCIPPMRA040LQr5QPyJEbmXA', emoji: '🎮', kind: 'mrbeast' },
  { key: 'beastphilanthropy', name: 'Beast Philanthropy', channelId: 'UCAiLfjNXkNv24uhpzUgPa6A', emoji: '💚', kind: 'mrbeast' },
  // --- Gunung & pendakian ---
  { key: 'kraigadams', name: 'Kraig Adams', channelId: 'UCpnuadQ_w3r6f4Q_NRlqd-w', emoji: '🏔️', kind: 'mountain' },
  { key: 'chasemountains', name: 'Chase Mountains', channelId: 'UCTEopVgqNCUhJq57CxTc4aw', emoji: '🥾', kind: 'mountain' },
  { key: 'homemadewanderlust', name: 'Homemade Wanderlust', channelId: 'UCQhqmV26773qZhzqJz4VFcw', emoji: '🎒', kind: 'mountain' },
  // --- Jalan-jalan & rekreasi ---
  { key: 'yestheory', name: 'Yes Theory', channelId: 'UCvK4bOhULCpmLabd2pDMtnA', emoji: '🌍', kind: 'recreation' },
  { key: 'karaandnate', name: 'Kara and Nate', channelId: 'UC4ijq8Cg-8zQKx8OH12dUSw', emoji: '✈️', kind: 'recreation' },
  { key: 'lostleblanc', name: 'Lost LeBlanc', channelId: 'UCt_NLJ4McJlCyYM-dSPRo7Q', emoji: '🏝️', kind: 'recreation' },
];

export type Video = {
  id: string;
  title: string;
  link: string;
  channel: string;
  emoji: string;
  kind: CreatorKind;
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

/**
 * Berapa video yang disimpan PER KELOMPOK (bukan untuk seluruh daftar).
 *
 * Per kelompok, dan itu penting: kanal Beast menerbitkan jauh lebih sering
 * daripada kanal gunung. Kalau batasnya dipasang pada daftar gabungan, video
 * Beast yang lebih baru akan memakan seluruh jatahnya lebih dulu — dan chip
 * Mountain bisa tampil KOSONG padahal kanalnya baik-baik saja. Dulu itu tak
 * terasa karena masih ada chip "Semua"; sekarang tiap chip berdiri sendiri.
 */
const VIDEO_PER_KIND = 15;

/**
 * Ambil paling banyak `VIDEO_PER_KIND` video TIAP KELOMPOK, urutannya tetap
 * seperti masukannya (terbaru dulu).
 *
 * Berdiri sendiri supaya bisa diuji tanpa jaringan — inilah satu-satunya
 * bagian fetchCreatorFeed yang punya aturan, sisanya cuma mengambil & mengurut.
 */
export function capPerKind(videos: Video[]): Video[] {
  const terpakai: Record<string, number> = {};
  return videos.filter((v) => {
    const n = (terpakai[v.kind] ?? 0) + 1;
    terpakai[v.kind] = n;
    return n <= VIDEO_PER_KIND;
  });
}

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
  return capPerKind(
    hasil
      .flatMap((h) => (h.status === 'fulfilled' ? h.value : []))
      .sort(
        (a, b) =>
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      ),
  );
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
