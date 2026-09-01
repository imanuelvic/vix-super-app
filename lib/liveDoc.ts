import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onSnapshot,
  queryEqual,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';

// Lapisan bersama untuk semua langganan DOKUMEN Firestore. Dua masalah yang
// diselesaikan sekaligus:
//
// 1. LANGGANAN KEMBAR. Dokumen yang sama dipasang berkali-kali oleh layar
//    berbeda — `health/profile` dipasang 7 layar, `core/leaders` 7 layar,
//    `habitDays/{hari ini}` 5 layar. Karena tab tetap terpasang setelah
//    dibuka, semuanya hidup berbarengan: 7 koneksi, 7 salinan data di memori,
//    dan 7× biaya baca Firestore untuk isi yang persis sama.
//    Di sini semuanya digabung jadi SATU listener per dokumen, hasilnya
//    dibagikan ke semua pemakai (dihitung dengan ref-count).
//
// 2. LAYAR KOSONG SAAT DIBUKA. Firebase JS SDK TIDAK punya cache disk di
//    React Native (butuh IndexedDB yang tidak ada di RN), jadi tiap kali app
//    dibuka semua data harus ditunggu dari server dulu. Di sini nilai terakhir
//    tiap dokumen ditulis ke AsyncStorage, lalu ditampilkan LEBIH DULU sambil
//    menunggu server — layar langsung terisi, bukan berkedip kosong.
//    Nilai dari server selalu menimpa nilai cache begitu tiba.
//
// Catatan tipe: yang di-cache hanya string/angka/boolean/array/map/Timestamp —
// itu semua yang dipakai app ini. Tipe Firestore lain (GeoPoint, Bytes,
// DocumentReference) TIDAK ditangani; kalau nanti dipakai, tambahkan di
// encode/decode di bawah.

/** Isi dokumen apa adanya. `undefined` = dokumennya memang belum ada. */
export type DocData = DocumentData | undefined;

/**
 * Bentuk minimal yang dipakai semua pemanggil: `.data()` & `.exists()`.
 * Snapshot asli dari Firestore sudah memenuhi bentuk ini, jadi mengganti
 * `onSnapshot(` menjadi `liveDoc(` TIDAK menuntut isi callback-nya diubah —
 * dan saat data datang dari disk, dibuatkan tiruannya dengan bentuk sama.
 */
export type DocLike = {
  data(): DocData;
  exists(): boolean;
  readonly id: string;
};

/** Snapshot tiruan dari cache disk. */
function fromCache(id: string, data: DocData): DocLike {
  return { id, data: () => data, exists: () => data !== undefined };
}

// Jeda sebelum listener benar-benar dilepas setelah pemakai terakhir pergi.
// Gunanya supaya pindah-pindah layar tidak memasang & melepas terus-menerus.
const IDLE_MS = 30_000;

const CACHE_PREFIX = 'fs1:';
const INDEX_KEY = 'fs1:index';
// Batas jumlah dokumen yang disimpan di disk. Dokumen harian (habitDays,
// bibleRead, dst) bertambah satu tiap hari, jadi harus ada batas.
const MAX_CACHED = 200;

// ===================== Penyandian Timestamp =====================
// JSON tidak mengenal Timestamp Firestore, padahal banyak kode memanggil
// `.toDate()` pada field tanggal. Jadi Timestamp diubah jadi penanda khusus
// saat disimpan, dan dibentuk kembali saat dibaca.

const TS_KEY = '__ts__';

function encode(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { [TS_KEY]: [value.seconds, value.nanoseconds] };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        encode(v),
      ]),
    );
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const ts = obj[TS_KEY];
    if (Array.isArray(ts) && ts.length === 2) {
      return new Timestamp(Number(ts[0]), Number(ts[1]));
    }
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, decode(v)]),
    );
  }
  return value;
}

// ===================== Cache disk =====================
// Semua operasi disk sengaja "tembak & lupakan": cache cuma mempercepat, jadi
// kalau gagal sekalipun app harus tetap jalan normal dari data server.

/** Urutan pemakaian dokumen (paling lama di depan) — untuk membuang yang basi. */
let index: string[] | null = null;

async function loadIndex(): Promise<string[]> {
  if (index) return index;
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    index = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    index = [];
  }
  return index;
}

async function touchIndex(path: string) {
  const list = await loadIndex();
  const at = list.indexOf(path);
  if (at >= 0) list.splice(at, 1);
  list.push(path);
  // Lewat batas → buang yang paling lama tidak dipakai.
  const dropped = list.length > MAX_CACHED ? list.splice(0, list.length - MAX_CACHED) : [];
  try {
    if (dropped.length > 0) {
      await AsyncStorage.multiRemove(dropped.map((p) => CACHE_PREFIX + p));
    }
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    // Diamkan — cache hanya mempercepat, bukan sumber kebenaran.
  }
}

async function readCache(path: string): Promise<{ data: DocData } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + path);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x: boolean; d: unknown };
    return { data: parsed.x ? (decode(parsed.d) as DocumentData) : undefined };
  } catch {
    // Format lama / rusak → anggap tidak ada cache.
    return null;
  }
}

function writeCache(path: string, data: DocData) {
  const payload = JSON.stringify({
    x: data !== undefined,
    d: data === undefined ? null : encode(data),
  });
  AsyncStorage.setItem(CACHE_PREFIX + path, payload)
    .then(() => touchIndex(path))
    .catch(() => {});
}

/**
 * Buang seluruh cache dokumen + lepas semua listener — dipanggil saat keluar
 * akun, supaya data akun lama tidak tertinggal di HP maupun di memori.
 */
export async function clearLiveCache(): Promise<void> {
  // Lepas dulu listener-nya, jangan cuma dibuang dari peta (nanti menggantung).
  entries.forEach((e) => {
    if (e.idle) clearTimeout(e.idle);
    e.stop?.();
  });
  entries.clear();
  // Langganan KOLEKSI ikut dilepas — kalau tidak, daftar akun lama masih
  // mengalir ke layar sesudah akun berikutnya masuk.
  lists.forEach((e) => {
    if (e.idle) clearTimeout(e.idle);
    e.stop?.();
  });
  lists.length = 0;
  try {
    const list = await loadIndex();
    await AsyncStorage.multiRemove([
      INDEX_KEY,
      ...list.map((p) => CACHE_PREFIX + p),
    ]);
  } catch {
    // Diamkan — gagal membersihkan cache tidak boleh menggagalkan logout.
  } finally {
    index = [];
  }
}

// ===================== Langganan bersama =====================

type Entry = {
  subs: Set<(snapshot: DocLike) => void>;
  errs: Set<(error: FirestoreError) => void>;
  stop: (() => void) | null;
  last: DocLike | null;
  /** true = sudah pernah dapat data dari SERVER (bukan sekadar dari disk). */
  live: boolean;
  idle: ReturnType<typeof setTimeout> | null;
};

const entries = new Map<string, Entry>();

/**
 * Langganan satu dokumen — pengganti langsung `onSnapshot(ref, …)`.
 * Isi callback TIDAK perlu diubah: yang dioper tetap punya `.data()` dan
 * `.exists()` seperti snapshot asli.
 *
 * Bedanya: dokumen yang sama hanya dipasang SEKALI walau dipakai banyak layar,
 * dan nilai terakhirnya tersimpan di disk sehingga muncul seketika saat dibuka.
 */
export function liveDoc(
  ref: DocumentReference,
  onChange: (snapshot: DocLike) => void,
  onError?: (error: FirestoreError) => void,
): () => void {
  const path = ref.path;
  let entry = entries.get(path);
  if (!entry) {
    entry = { subs: new Set(), errs: new Set(), stop: null, last: null, live: false, idle: null };
    entries.set(path, entry);
  }
  const e = entry;

  // Ada pemakai baru → batalkan rencana pelepasan.
  if (e.idle) {
    clearTimeout(e.idle);
    e.idle = null;
  }
  e.subs.add(onChange);
  if (onError) e.errs.add(onError);

  if (e.live && e.last) {
    // Layar lain sudah memegang datanya → langsung pakai, tanpa baca apa pun.
    onChange(e.last);
  } else {
    // Belum ada yang punya → tampilkan simpanan disk dulu supaya tidak kosong.
    // Kalau server keburu menjawab, hasil disk diabaikan (cek `e.live`).
    readCache(path)
      .then((cached) => {
        if (cached && !e.live && e.subs.has(onChange)) {
          onChange(fromCache(ref.id, cached.data));
        }
      })
      .catch(() => {});
  }

  if (!e.stop) {
    e.stop = onSnapshot(
      ref,
      (snapshot) => {
        e.last = snapshot;
        e.live = true;
        writeCache(path, snapshot.exists() ? snapshot.data() : undefined);
        e.subs.forEach((fn) => fn(snapshot));
      },
      (error) => e.errs.forEach((fn) => fn(error)),
    );
  }

  return () => {
    e.subs.delete(onChange);
    if (onError) e.errs.delete(onError);
    if (e.subs.size > 0 || e.idle) return;
    // Pemakai terakhir pergi — tunggu sebentar, siapa tahu cuma pindah layar.
    e.idle = setTimeout(() => {
      if (e.subs.size > 0) return;
      e.stop?.();
      entries.delete(path);
    }, IDLE_MS);
  };
}

/**
 * Langganan satu KOLEKSI/kueri — pengganti langsung untuk blok yang sebelumnya
 * disalin 20 kali di 15 berkas lib:
 *
 *   return onSnapshot(
 *     q,
 *     (snapshot) => {
 *       onChange(
 *         snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<X, 'id'>) })),
 *       );
 *     },
 *     onError,
 *   );
 *
 * ── Digabung, sama seperti `liveDoc` ──────────────────────────────────────
 * Kueri yang SAMA hanya dipasang sekali walau diminta beberapa layar. Ini
 * penting justru untuk koleksi: `tasks` didengarkan Home, Dashboard, DAN layar
 * Reminder sekaligus — dan karena tab tetap terpasang setelah dibuka,
 * ketiganya hidup berbarengan. Tanpa penggabungan itu 3 koneksi & 3× biaya
 * baca untuk isi yang persis sama; makin banyak task, makin mahal.
 *
 * Yang dibagikan snapshot MENTAHnya, bukan hasil jadinya: tiap pemanggil tetap
 * memakai `row`-nya sendiri, jadi dua layar boleh membentuk barisnya berbeda
 * dari kueri yang sama.
 *
 * Bedanya dengan `liveDoc`: TANPA cache disk. Isi koleksi tidak bisa disimpan
 * apa adanya seperti satu dokumen (jumlahnya tak tentu & bisa besar), dan
 * itulah yang membuat daftar masih sempat kosong sekejap saat app dibuka.
 *
 * `row` mengubah satu dokumen jadi satu barisnya. Bawaannya `{ id, ...data }`
 * — bentuk yang dipakai sepuluh langganan. Yang datanya perlu dirapikan dulu
 * (nilai bawaan untuk dokumen lama, nama kolom yang berganti) mengirim
 * mappernya sendiri; yang perlu diurutkan/disaring melakukannya di `onChange`,
 * karena itu urusan DAFTARNYA, bukan barisnya.
 *
 * Soal `as T` pada bawaannya: isi dokumen Firestore memang tak bisa diperiksa
 * TypeScript, jadi paksaan tipe itu tidak terhindarkan — tiap pemanggil dulu
 * menuliskannya sendiri (`as Omit<X, 'id'>`). Yang berubah cuma tempatnya:
 * sekarang satu, jadi kalau suatu hari mau diganti pemeriksaan sungguhan,
 * cukup satu tempat yang disentuh.
 */
export function liveList<T>(
  q: Query,
  onChange: (items: T[]) => void,
  onError?: (error: FirestoreError) => void,
  row?: (d: QueryDocumentSnapshot) => T,
): () => void {
  // `id` ditaruh SESUDAH sebaran isinya, bukan sebelum. Kalau sebelum, dokumen
  // yang kebetulan menyimpan field bernama `id` akan menimpa id dokumen
  // aslinya — dan baris itu lalu menyamar jadi baris lain, jadi
  // menghapus/mengubahnya bisa mengenai dokumen yang salah.
  //
  // Hari ini tak ada koleksi yang menyimpannya (tiap penulisan sudah membuang
  // `id` lebih dulu), jadi urutan ini tidak mengubah apa pun sekarang — ia
  // menjaga supaya penulisan berikutnya yang lupa membuang `id` tidak
  // diam-diam merusak daftarnya.
  const bentuk = row ?? ((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id }) as T);
  const terima = (snapshot: QuerySnapshot) => onChange(snapshot.docs.map(bentuk));

  // queryEqual = perbandingan resmi Firestore (koleksi + where + orderBy +
  // limit). Dipakai supaya "kueri yang sama" berarti sama menurut Firestore,
  // bukan menurut tebakan kita sendiri atas isi objeknya.
  let e = lists.find((x) => queryEqual(x.q, q));
  if (!e) {
    e = { q, subs: new Set(), errs: new Set(), stop: null, last: null, idle: null };
    lists.push(e);
  }
  const entry = e;

  if (entry.idle) {
    clearTimeout(entry.idle);
    entry.idle = null;
  }
  entry.subs.add(terima);
  if (onError) entry.errs.add(onError);

  // Layar lain sudah memegang hasilnya → langsung pakai, tanpa baca apa pun.
  if (entry.last) terima(entry.last);

  if (!entry.stop) {
    entry.stop = onSnapshot(
      q,
      (snapshot) => {
        entry.last = snapshot;
        entry.subs.forEach((fn) => fn(snapshot));
      },
      (error) => entry.errs.forEach((fn) => fn(error)),
    );
  }

  return () => {
    entry.subs.delete(terima);
    if (onError) entry.errs.delete(onError);
    if (entry.subs.size > 0 || entry.idle) return;
    // Pemakai terakhir pergi — tunggu sebentar, siapa tahu cuma pindah layar.
    entry.idle = setTimeout(() => {
      if (entry.subs.size > 0) return;
      entry.stop?.();
      const at = lists.indexOf(entry);
      if (at >= 0) lists.splice(at, 1);
    }, IDLE_MS);
  };
}

/**
 * Langganan koleksi yang sedang hidup. Array, bukan Map: kuncinya sebuah
 * Query yang cuma bisa dibandingkan lewat `queryEqual`, bukan string. Isinya
 * belasan sekaligus paling banyak, jadi pencarian lurus sudah cukup.
 */
type ListEntry = {
  q: Query;
  subs: Set<(snapshot: QuerySnapshot) => void>;
  errs: Set<(error: FirestoreError) => void>;
  stop: (() => void) | null;
  last: QuerySnapshot | null;
  idle: ReturnType<typeof setTimeout> | null;
};

const lists: ListEntry[] = [];

/**
 * Lepaskan sekumpulan langganan sekaligus — dipakai sebagai nilai kembalian
 * `useEffect` yang memasang beberapa listener:
 *
 *   useEffect(() => {
 *     if (!user) return;
 *     const fail = () => setError(LOAD_ERROR);
 *     return unsubscribeAll([
 *       subscribeA(user.uid, setA, fail),
 *       subscribeB(user.uid, setB, fail),
 *     ]);
 *   }, [user]);
 *
 * Sebelumnya blok ini disalin apa adanya di 24 layar (`const unsubs = […]`
 * lalu `return () => unsubs.forEach((unsub) => unsub())`). Selain jadi
 * panjang, bentuk lama itu memungkinkan seseorang menulis daftarnya tapi lupa
 * mengembalikan pembersihnya — listenernya menggantung tanpa ada yang sadar.
 * Dengan bentuk ini daftar & pembersihnya jadi satu ekspresi, jadi tidak bisa
 * terpisah. Perilakunya sama persis dengan yang lama.
 */
export function unsubscribeAll(unsubs: (() => void)[]): () => void {
  return () => unsubs.forEach((unsub) => unsub());
}
