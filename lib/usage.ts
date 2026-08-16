import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  where,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { MONTH_NAMES } from './format';
import { dayDocId } from './health';

// Pelacakan pemakaian fitur 📊 — berapa kali tiap tile/fitur DIBUKA per hari,
// untuk laporan "aku paling sering pakai apa". SATU dokumen kecil per hari:
// users/{uid}/usage/{YYYY-MM-DD} → { dayId, counts:{key:n}, labels:{key:label} }.
//
// Anti-spam & hemat biaya: tiap fitur dihitung MAKSIMAL sekali per COOLDOWN
// (mencegah double-tap / bolak-balik cepat membanjiri hitungan & tulisan
// Firestore). Cooldown disimpan di memori (reset saat app dimulai ulang — cukup).

export type UsageDay = {
  dayId: string;
  counts: Record<string, number>;
  labels: Record<string, string>;
};

export type FeatureCount = { key: string; label: string; count: number };

const COOLDOWN_MS = 3 * 60 * 1000; // 3 menit per fitur
const lastLogged = new Map<string, number>();

/**
 * Catat satu pembukaan fitur (dipanggil saat tile grid ditekan). Throttled &
 * fire-and-forget — tidak boleh mengganggu navigasi walau offline/gagal.
 */
export function logFeatureUse(uid: string, key: string, label: string) {
  const now = Date.now();
  if (now - (lastLogged.get(key) ?? 0) < COOLDOWN_MS) return; // masih cooldown
  lastLogged.set(key, now);
  const ref = doc(db, 'users', uid, 'usage', dayDocId(new Date()));
  setDoc(
    ref,
    {
      dayId: dayDocId(new Date()),
      counts: { [key]: increment(1) },
      labels: { [key]: label },
    },
    { merge: true },
  ).catch(() => {});
}

/** Dengarkan pemakaian SATU hari (live) — untuk laporan "hari ini". */
export function subscribeUsageDay(
  uid: string,
  dayId: string,
  onChange: (day: UsageDay) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'usage', dayId);
  return liveDoc(
    ref,
    (snap) => {
      const d = snap.data();
      onChange({
        dayId,
        counts: (d?.counts as Record<string, number>) ?? {},
        labels: (d?.labels as Record<string, string>) ?? {},
      });
    },
    onError,
  );
}

/** Ambil beberapa hari sekaligus (sekali baca) — untuk ringkasan mingguan. */
export async function fetchUsageDays(
  uid: string,
  dayIds: string[],
): Promise<UsageDay[]> {
  const snaps = await Promise.all(
    dayIds.map((id) => getDoc(doc(db, 'users', uid, 'usage', id))),
  );
  return snaps.map((snap, i) => {
    const d = snap.data();
    return {
      dayId: dayIds[i],
      counts: (d?.counts as Record<string, number>) ?? {},
      labels: (d?.labels as Record<string, string>) ?? {},
    };
  });
}

// ===== Minggu berjalan (Senin–Minggu) =====
// Laporan pemakaian bersifat MINGGUAN: hanya menampilkan minggu ini. Saat masuk
// Senin baru, data minggu-minggu sebelumnya DIHAPUS permanen (resetPastWeeks)
// supaya mulai dari nol lagi — hemat & selalu fokus ke minggu berjalan.

/** Tanggal Senin 00:00 dari minggu yang memuat `now` (waktu lokal). */
export function weekStart(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (d.getDay() + 6) % 7; // Sen→0, Sel→1, …, Min→6
  d.setDate(d.getDate() - diff);
  return d;
}

/** dayId Senin s/d HARI INI (kronologis) untuk minggu berjalan. */
export function weekDayIds(now = new Date()): string[] {
  const start = weekStart(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ids: string[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    ids.push(dayDocId(d));
  }
  return ids;
}

/** Rentang minggu berjalan, mis. "10–16 Agustus" atau "29 September – 5 Oktober". */
export function formatWeekRange(now = new Date()): string {
  const start = weekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Minggu
  const sm = MONTH_NAMES[start.getMonth()];
  const em = MONTH_NAMES[end.getMonth()];
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${sm}`
    : `${start.getDate()} ${sm} – ${end.getDate()} ${em}`;
}

/**
 * Hapus PERMANEN semua dokumen pemakaian sebelum Senin minggu ini (reset
 * mingguan). Dipanggil saat membuka tab System; umumnya tak ada yang terhapus
 * (1 query murah), tapi begitu masuk Senin baru, data minggu lalu ikut hilang.
 */
export async function resetPastWeeks(
  uid: string,
  now = new Date(),
): Promise<void> {
  const boundary = dayDocId(weekStart(now)); // Senin minggu ini (batas simpan)
  const col = collection(db, 'users', uid, 'usage');
  const snap = await getDocs(query(col, where('dayId', '<', boundary)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

/** Fitur terbanyak di satu hari (urut menurun). */
export function topFeatures(day: UsageDay, limit = 5): FeatureCount[] {
  return Object.entries(day.counts)
    .map(([key, count]) => ({ key, label: day.labels[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Gabungkan beberapa hari jadi satu total. */
export function aggregateDays(days: UsageDay[]): UsageDay {
  const counts: Record<string, number> = {};
  const labels: Record<string, string> = {};
  for (const d of days) {
    for (const [k, v] of Object.entries(d.counts)) {
      counts[k] = (counts[k] ?? 0) + v;
      labels[k] = d.labels[k] ?? labels[k] ?? k;
    }
  }
  return { dayId: 'range', counts, labels };
}

/** Total seluruh hitungan di satu hari. */
export function dayTotal(day: UsageDay): number {
  return Object.values(day.counts).reduce((a, b) => a + b, 0);
}
