import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { type IntercessionTopic } from './intercession';
import { weekDocId } from './learning';
import { liveDoc } from './liveDoc';
import { fetchRss } from './news';

// Pokok doa syafaat yang MENGIKUTI berita 📰🙏
//
// Syafaat Sabtu (⛪ Gereja) & Minggu (🇮🇩 Negara) pokok doanya tetap — bagus
// untuk ritme, tapi tidak pernah tahu apa yang sedang terjadi minggu ini.
// Berkas ini menambahkan lapisan KEDUA: judul berita sepekan terakhir tentang
// gereja & Indonesia, dipakai jadi pokok doa tambahan di kartu Doa Syafaat
// (Home) dan langkah syafaat di Morning Gateway.
//
// ⚠️ JUJUR soal kata "rangkum": tidak ada AI di sini. Yang ditampilkan adalah
// JUDUL asli beritanya, apa adanya, disaring per topik lewat kata kunci di
// alamat RSS-nya. Jadi ini "kliping mingguan", bukan ringkasan tulisan baru —
// dan itu justru yang diinginkan: doakan kejadian sebenarnya, bukan tafsiran
// app tentang kejadian itu.
//
// "Cron"-nya: sekali seminggu, dipicu saat Home dibuka.
//   • Sudah ada catatan minggu ini → TIDAK mengambil apa pun, TIDAK menulis.
//   • Ganti minggu (tiap Senin, ikut weekDocId) → ambil sekali, simpan sekali.
// Jadi biayanya 2 permintaan RSS + 1 tulis Firestore per minggu, berapa kali
// pun app dibuka. Tanpa server, tanpa notifikasi latar — app ini memang tidak
// punya keduanya.

/** Topik syafaat yang punya lapisan berita (sama kuncinya dgn lib/intercession). */
export type PrayerNewsTopic = 'church' | 'nation';

/** Satu kliping: judulnya + tautan ke beritanya. */
export type PrayerNewsItem = { title: string; url: string };

export type PrayerNews = {
  /** Tanggal Senin minggu catatan ini diambil ("YYYY-MM-DD"). */
  weekId: string;
  /**
   * Judul saja. Bentuk LAMA, tetap dibaca supaya dokumen yang sudah ada di
   * Firestore tidak jadi kosong (judulnya muncul, cuma belum bisa di-click).
   */
  points: Record<PrayerNewsTopic, string[]>;
  /**
   * Bentuk BARU (26 Sep 2026): judul + tautannya, supaya baris beritanya bisa
   * di-click langsung ke artikel aslinya. Belum ada di dokumen lama, dan itu
   * sebabnya dokumen tanpa `items` dianggap basi (lihat `prayerNewsFresh`) —
   * sekali ambil ulang, tautannya langsung ada tanpa menunggu Senin.
   */
  items?: Record<PrayerNewsTopic, PrayerNewsItem[]>;
};

/** Berapa judul yang disimpan per topik — cukup untuk didoakan, tidak melelahkan. */
const PER_TOPIC = 4;

function feed(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${query} when:7d`,
  )}&hl=id&gl=ID&ceid=ID:id`;
}

// Kata kuncinya sengaja lebar tapi tetap Indonesia-sentris: yang dicari adalah
// hal yang benar-benar bisa didoakan, bukan sekadar berita apa saja.
const FEEDS: Record<PrayerNewsTopic, string> = {
  church: feed(
    'Indonesia (gereja OR "umat kristen" OR "kerukunan umat beragama" OR "rumah ibadah" OR misionaris)',
  ),
  nation: feed(
    'Indonesia (presiden OR pemerintah OR ekonomi OR bencana OR "harga pangan" OR korupsi)',
  ),
};

const EMPTY: PrayerNews['points'] = { church: [], nation: [] };

function readPoints(raw: unknown): PrayerNews['points'] {
  const data = (raw ?? {}) as Partial<Record<PrayerNewsTopic, unknown>>;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return { church: list(data.church), nation: list(data.nation) };
}

function readItems(raw: unknown): PrayerNews['items'] | undefined {
  const data = raw as Partial<Record<PrayerNewsTopic, unknown>> | undefined;
  if (!data) return undefined;
  const list = (v: unknown): PrayerNewsItem[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({ title: String(x.title ?? ''), url: String(x.url ?? '') }))
          .filter((x) => x.title.length > 0)
      : [];
  return { church: list(data.church), nation: list(data.nation) };
}

export function subscribePrayerNews(
  uid: string,
  onChange: (news: PrayerNews | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'world', 'prayerNews'),
    (snapshot) => {
      const data = snapshot.data();
      onChange(
        data?.weekId
          ? {
              weekId: String(data.weekId),
              points: readPoints(data.points),
              items: readItems(data.items),
            }
          : null,
      );
    },
    onError,
  );
}

/**
 * Catatan minggu ini sudah ada? (kalau ya, jangan ambil ulang)
 *
 * Dokumen minggu ini yang BELUM punya `items` tetap dianggap basi: itu catatan
 * bentuk lama yang cuma menyimpan judul, jadi baris beritanya belum bisa
 * di-click. Sekali ambil ulang, tautannya langsung ada — tanpa menunggu Senin
 * berikutnya.
 */
export function prayerNewsFresh(news: PrayerNews | null, now: Date): boolean {
  if (news?.weekId !== weekDocId(now)) return false;
  return !!news.items;
}

/**
 * Ambil kliping minggu ini kalau memang belum ada, lalu simpan SATU dokumen
 * kecil. Aman dipanggil tiap Home dibuka: kalau minggu ini sudah tercatat, ia
 * langsung berhenti tanpa menyentuh jaringan maupun Firestore.
 *
 * Return true kalau baru saja menulis.
 *
 * Kalau kedua topik pulang kosong (jaringan bermasalah / RSS berubah), sengaja
 * TIDAK menulis apa pun — menyimpan kliping kosong berarti minggu ini dianggap
 * "sudah diambil" dan tidak akan pernah dicoba lagi sampai Senin berikutnya.
 */
export async function refreshPrayerNews(
  uid: string,
  news: PrayerNews | null,
  now: Date,
): Promise<boolean> {
  if (prayerNewsFresh(news, now)) return false;

  const kliping = async (topic: PrayerNewsTopic): Promise<PrayerNewsItem[]> => {
    try {
      const items = await fetchRss(FEEDS[topic], `doa-${topic}`);
      return items
        .slice(0, PER_TOPIC)
        .map((n) => ({ title: n.title, url: n.link }));
    } catch {
      // Satu topik gagal tidak boleh menjatuhkan yang lain.
      return [];
    }
  };
  const [church, nation] = await Promise.all([
    kliping('church'),
    kliping('nation'),
  ]);
  if (church.length === 0 && nation.length === 0) return false;

  // `points` ikut ditulis walau `items` sudah memuat judulnya: kalau suatu saat
  // ada versi app lama yang masih membaca bentuk lama, ia tetap mendapat
  // judulnya, bukan kartu kosong.
  await setDoc(doc(db, 'users', uid, 'world', 'prayerNews'), {
    weekId: weekDocId(now),
    points: { church: church.map((n) => n.title), nation: nation.map((n) => n.title) },
    items: { church, nation },
  });
  return true;
}

/**
 * Kliping topik ini — kosong kalau topiknya bukan Gereja/Negara.
 *
 * Dokumen bentuk lama (judul saja) tetap terbaca: judulnya keluar dengan
 * `url` kosong, jadi barisnya muncul apa adanya dan cuma tidak bisa di-click.
 */
export function prayerNewsFor(
  news: PrayerNews | null,
  topic: IntercessionTopic,
): PrayerNewsItem[] {
  if (!news) return [];
  if (topic.key !== 'church' && topic.key !== 'nation') return [];
  const baru = news.items?.[topic.key];
  if (baru && baru.length > 0) return baru;
  return (news.points ?? EMPTY)[topic.key].map((title) => ({ title, url: '' }));
}

/**
 * Pokok doa tetap + kliping minggu ini, jadi satu topik utuh.
 *
 * Sengaja berupa fungsi murni yang mengembalikan topik BARU: pemakainya
 * (kartu Home & Morning Gateway) tidak perlu tahu soal berita sama sekali —
 * mereka tetap cuma menggambar `topic.points`.
 */
export function withWeeklyNews(
  topic: IntercessionTopic,
  news: PrayerNews | null,
): IntercessionTopic {
  const extra = prayerNewsFor(news, topic);
  if (extra.length === 0) return topic;
  // 📰 = penanda "ini kejadian nyata minggu ini", beda dari pokok doa tetap.
  const baris = extra.map((n) => `📰 ${n.title}`);
  // Tautannya dititipkan di `links`, dikunci TEKS BARISNYA sendiri. Dengan
  // begitu penggambar yang tidak peduli tautan tetap cukup membaca `points`
  // seperti biasa, dan yang peduli tinggal mencarinya di sini.
  const links: Record<string, string> = {};
  extra.forEach((n, i) => {
    if (n.url) links[baris[i]] = n.url;
  });
  return {
    ...topic,
    points: [...topic.points, ...baris],
    links: Object.keys(links).length > 0 ? links : undefined,
  };
}
