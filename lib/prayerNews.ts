import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { type IntercessionTopic } from './intercession';
import { weekDocId } from './learning';
import { liveDoc } from './liveDoc';
import { fetchRss } from './world';

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

export type PrayerNews = {
  /** Tanggal Senin minggu catatan ini diambil ("YYYY-MM-DD"). */
  weekId: string;
  points: Record<PrayerNewsTopic, string[]>;
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
          ? { weekId: String(data.weekId), points: readPoints(data.points) }
          : null,
      );
    },
    onError,
  );
}

/** Catatan minggu ini sudah ada? (kalau ya, jangan ambil ulang) */
export function prayerNewsFresh(news: PrayerNews | null, now: Date): boolean {
  return news?.weekId === weekDocId(now);
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

  const titles = async (topic: PrayerNewsTopic) => {
    try {
      const items = await fetchRss(FEEDS[topic], `doa-${topic}`);
      return items.slice(0, PER_TOPIC).map((n) => n.title);
    } catch {
      // Satu topik gagal tidak boleh menjatuhkan yang lain.
      return [];
    }
  };
  const [church, nation] = await Promise.all([
    titles('church'),
    titles('nation'),
  ]);
  if (church.length === 0 && nation.length === 0) return false;

  await setDoc(doc(db, 'users', uid, 'world', 'prayerNews'), {
    weekId: weekDocId(now),
    points: { church, nation },
  });
  return true;
}

/** Kliping topik ini — kosong kalau topiknya bukan Gereja/Negara. */
export function prayerNewsFor(
  news: PrayerNews | null,
  topic: IntercessionTopic,
): string[] {
  if (!news) return [];
  if (topic.key !== 'church' && topic.key !== 'nation') return [];
  return (news.points ?? EMPTY)[topic.key];
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
  return {
    ...topic,
    // 📰 = penanda "ini kejadian nyata minggu ini", beda dari pokok doa tetap.
    points: [...topic.points, ...extra.map((t) => `📰 ${t}`)],
  };
}
