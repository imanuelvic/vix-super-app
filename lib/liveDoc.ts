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

// Lapisan bersama semua langganan Firestore. Dua gunanya:
//
// 1. SATU listener per dokumen/kueri walau dipakai banyak layar (ref-count).
//    health/profile dipasang 7 layar, core/leaders 7, habitDays hari ini 5 —
//    dan tab tetap hidup setelah dibuka, jadi tanpa ini biayanya 7× lipat.
// 2. NILAI TERAKHIR disimpan ke AsyncStorage & ditampilkan lebih dulu.
//    Firebase JS SDK tidak punya cache disk di RN, jadi tanpa ini tiap layar
//    berkedip kosong menunggu server.
//
// Yang di-cache cuma string/angka/boolean/array/map/Timestamp. Tipe Firestore
// lain (GeoPoint, Bytes, DocumentReference) belum ditangani encode/decode.

/** Isi dokumen apa adanya. `undefined` = dokumennya memang belum ada. */
export type DocData = DocumentData | undefined;

/**
 * Bentuk minimal yang dipakai pemanggil: `.data()` & `.exists()`. Snapshot
 * asli sudah memenuhinya, jadi `onSnapshot(` → `liveDoc(` tak menuntut isi
 * callback diubah.
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

// Jeda pemasangan ulang sesudah listener mati (makin lebar; sesudah habis,
// galatnya baru dilaporkan ke layar). Lihat `pulihkan`.
const RETRY_MS = [1_000, 4_000, 10_000];

const CACHE_PREFIX = 'fs1:';
const INDEX_KEY = 'fs1:index';
// Batas jumlah dokumen yang disimpan di disk. Dokumen harian (habitDays,
// bibleRead, dst) bertambah satu tiap hari, jadi harus ada batas.
const MAX_CACHED = 200;

// ===================== Penyandian Timestamp =====================
// JSON tak mengenal Timestamp, padahal banyak kode memanggil `.toDate()`.
// Jadi disandikan jadi penanda khusus saat disimpan & dibentuk lagi saat baca.

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
// Semua operasi disk "tembak & lupakan": cache cuma mempercepat, jadi gagal
// pun app tetap jalan dari data server.

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
    if (e.retry) clearTimeout(e.retry);
    e.stop?.();
  });
  entries.clear();
  // Langganan KOLEKSI ikut dilepas — kalau tidak, daftar akun lama masih
  // mengalir ke layar sesudah akun berikutnya masuk.
  lists.forEach((e) => {
    if (e.idle) clearTimeout(e.idle);
    if (e.retry) clearTimeout(e.retry);
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

// ===================== Listener yang mati =====================
// `onSnapshot` memanggil callback galatnya paling banyak SEKALI, lalu diam
// selamanya. Akibatnya dulu: pesan merah "Gagal memuat" menempel permanen,
// dan mayat listenernya bikin layar berikutnya mengira masih hidup.
//
// Sekarang dipasang ulang tiga kali, jaraknya makin lebar. Batasnya penting:
// galat yang memang menetap (rules menolak, kuota habis) tidak boleh jadi
// pemasangan ulang tanpa henti — itu justru yang menghabiskan kuota baca.

/** Bagian Entry/ListEntry yang dipakai `pulihkan` — sengaja seminimal itu. */
type Pulih = {
  errs: Set<(error: FirestoreError) => void>;
  stop: (() => void) | null;
  /** Berapa kali berturut-turut listenernya mati. Nol lagi begitu data datang. */
  gagal: number;
  retry: ReturnType<typeof setTimeout> | null;
};

function pulihkan(e: Pulih, error: FirestoreError, pasang: () => void) {
  e.stop = null;
  const jeda = RETRY_MS[e.gagal];
  e.gagal += 1;
  if (jeda === undefined) {
    // Jatah habis — sekarang barulah layar berhak bilang gagal.
    e.errs.forEach((fn) => fn(error));
    return;
  }
  e.retry = setTimeout(() => {
    e.retry = null;
    pasang();
  }, jeda);
}

// ===================== Langganan bersama =====================

type Entry = Pulih & {
  subs: Set<(snapshot: DocLike) => void>;
  last: DocLike | null;
  /** true = sudah pernah dapat data dari SERVER (bukan sekadar dari disk). */
  live: boolean;
  idle: ReturnType<typeof setTimeout> | null;
};

const entries = new Map<string, Entry>();

/** Pasang listener dokumennya. Dipanggil sekali di awal, lalu tiap coba-lagi. */
function pasangDoc(path: string, ref: DocumentReference, e: Entry) {
  e.stop = onSnapshot(
    ref,
    (snapshot) => {
      e.gagal = 0;
      e.last = snapshot;
      e.live = true;
      writeCache(path, snapshot.exists() ? snapshot.data() : undefined);
      e.subs.forEach((fn) => fn(snapshot));
    },
    (error) => pulihkan(e, error, () => pasangDoc(path, ref, e)),
  );
}

/**
 * Langganan satu dokumen — pengganti langsung `onSnapshot(ref, …)`.
 *
 * Dipasang SEKALI walau dipakai banyak layar, dan nilai terakhirnya dari disk
 * muncul seketika saat dibuka.
 */
export function liveDoc(
  ref: DocumentReference,
  onChange: (snapshot: DocLike) => void,
  onError?: (error: FirestoreError) => void,
): () => void {
  const path = ref.path;
  let entry = entries.get(path);
  if (!entry) {
    entry = {
      subs: new Set(),
      errs: new Set(),
      stop: null,
      last: null,
      live: false,
      gagal: 0,
      retry: null,
      idle: null,
    };
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

  // `e.retry` = pemasangan ulang sedang dijadwalkan; jangan pasang yang kedua.
  // Kalau jatah coba-laginya habis (stop & retry sama-sama kosong), pemakai
  // baru mengisinya penuh lagi — membuka layarnya lagi memang berarti "coba lagi".
  if (!e.stop && !e.retry) {
    e.gagal = 0;
    pasangDoc(path, ref, e);
  }

  return () => {
    e.subs.delete(onChange);
    if (onError) e.errs.delete(onError);
    if (e.subs.size > 0 || e.idle) return;
    // Pemakai terakhir pergi — tunggu sebentar, siapa tahu cuma pindah layar.
    e.idle = setTimeout(() => {
      if (e.subs.size > 0) return;
      if (e.retry) clearTimeout(e.retry);
      e.stop?.();
      entries.delete(path);
    }, IDLE_MS);
  };
}

/**
 * Langganan satu KOLEKSI/kueri — pengganti blok `onSnapshot` + `docs.map`
 * yang dulu disalin 20 kali di 15 berkas lib.
 *
 * Kueri yang sama dipasang sekali walau diminta beberapa layar sekaligus
 * (`tasks` didengarkan Home, Dashboard & Reminder bersamaan). Yang dibagikan
 * snapshot MENTAH-nya, jadi tiap pemanggil tetap boleh membentuk barisnya
 * sendiri lewat `row` (bawaan: `{ ...data, id }`).
 *
 * Bedanya dengan `liveDoc`: TANPA cache disk — isi koleksi tak tentu besarnya,
 * jadi daftar masih sempat kosong sekejap saat app dibuka.
 */
export function liveList<T>(
  q: Query,
  onChange: (items: T[]) => void,
  onError?: (error: FirestoreError) => void,
  row?: (d: QueryDocumentSnapshot) => T,
): () => void {
  // `id` ditaruh SESUDAH sebaran isinya: kalau sebelum, dokumen yang kebetulan
  // punya field `id` akan menimpa id aslinya — barisnya lalu menyamar jadi baris
  // lain, dan menghapusnya bisa mengenai dokumen yang salah.
  const bentuk = row ?? ((d: QueryDocumentSnapshot) => ({ ...d.data(), id: d.id }) as T);
  const terima = (snapshot: QuerySnapshot) => onChange(snapshot.docs.map(bentuk));

  // queryEqual = perbandingan resmi Firestore (koleksi + where + orderBy +
  // limit). Dipakai supaya "kueri yang sama" berarti sama menurut Firestore,
  // bukan menurut tebakan kita sendiri atas isi objeknya.
  let e = lists.find((x) => queryEqual(x.q, q));
  if (!e) {
    e = {
      q,
      subs: new Set(),
      errs: new Set(),
      stop: null,
      last: null,
      gagal: 0,
      retry: null,
      idle: null,
    };
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

  // Sama seperti `liveDoc`: listener yang mati dipasang ulang, dan pemakai
  // baru mengembalikan jatah coba-laginya.
  if (!entry.stop && !entry.retry) {
    entry.gagal = 0;
    pasangList(entry);
  }

  return () => {
    entry.subs.delete(terima);
    if (onError) entry.errs.delete(onError);
    if (entry.subs.size > 0 || entry.idle) return;
    // Pemakai terakhir pergi — tunggu sebentar, siapa tahu cuma pindah layar.
    entry.idle = setTimeout(() => {
      if (entry.subs.size > 0) return;
      if (entry.retry) clearTimeout(entry.retry);
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
type ListEntry = Pulih & {
  q: Query;
  subs: Set<(snapshot: QuerySnapshot) => void>;
  last: QuerySnapshot | null;
  idle: ReturnType<typeof setTimeout> | null;
};

const lists: ListEntry[] = [];

/** Pasang listener kuerinya. Dipanggil sekali di awal, lalu tiap coba-lagi. */
function pasangList(e: ListEntry) {
  e.stop = onSnapshot(
    e.q,
    (snapshot) => {
      e.gagal = 0;
      e.last = snapshot;
      e.subs.forEach((fn) => fn(snapshot));
    },
    (error) => pulihkan(e, error, () => pasangList(e)),
  );
}

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
