import {
  doc,
  getDoc,
  increment,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
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
  return onSnapshot(
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

/** dayId N hari terakhir (termasuk hari ini), terbaru dulu. */
export function recentDayIds(days: number, now = new Date()): string[] {
  const ids: string[] = [];
  for (let i = 0; i < days; i++) {
    ids.push(dayDocId(new Date(now.getTime() - i * 86_400_000)));
  }
  return ids;
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
