import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveList } from './liveDoc';
import { dayIdToDate } from './format';
import { dayDocId } from './health';

// Puasa 🍽️ — satu dokumen per PERIODE puasa: users/{uid}/fasting/{id}
//   { title, prayer, rules, answer, startId, endId, days: { dayId: {...} } }
//
// Hari-harinya tidak disimpan satu per satu sebagai dokumen: cukup satu map
// `days` di dalam dokumen periode itu (puasa paling lama pun cuma puluhan
// hari), jadi buka layar Puasa = 1 read, bukan puluhan.

/** Catatan satu hari puasa. */
export type FastingDay = {
  prayer: string; // pokok doa khusus hari itu
  done: boolean; // ✅ dicentang = puasa hari itu berhasil
  /**
   * ✗ = puasa hari itu GAGAL, dijawab tegas (22 Sep 2026). Dulu "gagal" cuma
   * berarti "tidak dicentang", jadi tak bisa dibedakan dari "belum diisi".
   * Opsional: catatan lama tanpa field ini terbaca sebagai belum dijawab.
   * `done` & `failed` tak pernah sama-sama true.
   */
  failed?: boolean;
  answer: string; // jawaban doa / catatan hari itu
};

export type FastingPlan = {
  id: string;
  title: string; // nama puasanya, mis. "Puasa Daniel 7 Hari"
  prayer: string; // pokok doa utama sepanjang puasa
  rules: string; // peraturan puasa saya (jam, jenis makanan, dll)
  answer: string; // hasil / jawaban doa keseluruhan
  startId: string; // "YYYY-MM-DD" mulai
  endId: string; // "YYYY-MM-DD" selesai (inklusif)
  days: Record<string, FastingDay>;
};

export const EMPTY_FASTING_DAY: FastingDay = {
  prayer: '',
  done: false,
  answer: '',
};

/** ID unik untuk periode puasa baru. */
export function newFastingId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Batas wajar sebuah periode puasa — menjaga daftar hari tidak meledak kalau
// tanggal selesai salah ketik jauh sekali.
const MAX_FASTING_DAYS = 400;

/** Semua dayId dari mulai sampai selesai (inklusif, urut maju). */
export function fastingDayIds(startId: string, endId: string): string[] {
  const ids: string[] = [];
  if (!startId || !endId) return ids;
  const end = dayIdToDate(endId);
  const cursor = dayIdToDate(startId);
  while (cursor <= end && ids.length < MAX_FASTING_DAYS) {
    ids.push(dayDocId(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return ids;
}

/** Catatan satu hari (kosong kalau belum pernah diisi). */
export function fastingDay(plan: FastingPlan, dayId: string): FastingDay {
  return plan.days?.[dayId] ?? EMPTY_FASTING_DAY;
}

/**
 * Hitungan satu periode puasa: berapa hari BERHASIL, berapa hari GAGAL, dari
 * berapa hari seluruhnya.
 *
 * `failed` ikut dihitung (1 Okt 2026) karena di daftar puasa "1 dari 6" saja
 * tidak menjawab pertanyaan yang sebenarnya: lima sisanya itu gagal, atau
 * memang belum dijawab? Dua angka itu dua hal yang berbeda, dan yang satu
 * tidak bisa disimpulkan dari yang lain.
 *
 * Hari yang tidak masuk keduanya = belum dijawab sama sekali.
 */
export function fastingProgress(plan: FastingPlan): {
  done: number;
  failed: number;
  total: number;
} {
  const ids = fastingDayIds(plan.startId, plan.endId);
  return {
    done: ids.filter((id) => plan.days?.[id]?.done).length,
    failed: ids.filter((id) => plan.days?.[id]?.failed).length,
    total: ids.length,
  };
}

/** Hari ini masih di dalam rentang puasa ini? */
function fastingActive(plan: FastingPlan, now: Date): boolean {
  const today = dayDocId(now);
  return today >= plan.startId && today <= plan.endId;
}

/**
 * Puasa yang SEDANG berjalan hari ini (null kalau tidak ada). Kalau kebetulan
 * ada lebih dari satu, ambil yang paling baru dimulai.
 */
export function activeFasting(
  plans: FastingPlan[],
  now: Date,
): FastingPlan | null {
  return plans.find((p) => fastingActive(p, now)) ?? null;
}

/** Hari ke berapa (1-based); 0 kalau tanggalnya di luar rentang. */
export function fastingDayNumber(plan: FastingPlan, dayId: string): number {
  return fastingDayIds(plan.startId, plan.endId).indexOf(dayId) + 1;
}

// ============ Puasa bulanan: Senin terakhir tiap bulan 🗓️ ============
//
// Ritmenya: setiap Senin di AKHIR bulan, ambil puasa baru. 28 Sep 2026,
// 26 Okt 2026, 30 Nov 2026, dan seterusnya — tanggalnya tidak dihafal, ia
// dihitung.
//
// Kenapa Senin terakhir dan bukan tanggal tetap (mis. tiap tanggal 25):
// tanggal tetap jatuh di hari yang berbeda-beda, dan puasa yang dimulai hari
// Kamis atau Sabtu langsung bertabrakan dengan acara akhir pekan. Senin selalu
// awal pekan, dan pekan yang baru mulai itu yang paling mungkin dijalani utuh.
//
// ⚠️ Yang TIDAK dilakukan di sini: membuatkan puasanya otomatis. Puasa yang
// dibuatkan mesin persis yang paling cepat jadi rutinitas kosong — dan itu
// kekhawatiran pemilik app sendiri. Yang ada cuma pengingat; keputusannya
// tetap harus lewat perjalanan 3 langkah di layar Puasa Baru.

/** dayId Senin TERAKHIR pada bulan yang memuat `d`. */
export function lastMondayId(d: Date): string {
  // Mulai dari tanggal terakhir bulan itu, lalu mundur sampai ketemu Senin.
  const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  akhir.setDate(akhir.getDate() - ((akhir.getDay() + 6) % 7));
  return dayDocId(akhir);
}

/** Ada puasa yang mulainya di bulan yang sama dengan `d`? */
export function hasFastingThisMonth(plans: FastingPlan[], d: Date): boolean {
  const bulan = dayDocId(d).slice(0, 7); // "YYYY-MM"
  return plans.some((p) => p.startId.slice(0, 7) === bulan);
}

/**
 * Hari ini saatnya mengambil puasa bulan ini?
 *
 * Jendelanya DUA hari: Senin terakhirnya sendiri, DAN hari Minggu sebelumnya.
 * Yang kedua bukan kemewahan — pengingat di app ini isinya dibekukan saat app
 * terakhir dibuka (lihat lib/notify.ts). Kalau jendelanya cuma satu hari dan
 * app kebetulan tidak dibuka hari Minggu, pengingat Senin paginya tidak pernah
 * terjadwal sama sekali, dan urusan sebulan sekali hilang begitu saja.
 * Bonusnya: diberi tahu sehari sebelumnya justru lebih enak dipersiapkan.
 *
 * Sudah ada puasa yang dimulai bulan ini → diam. Yang sudah dikerjakan tidak
 * perlu ditagih lagi.
 */
export function fastingMonthlyDue(plans: FastingPlan[], now: Date): boolean {
  if (hasFastingThisMonth(plans, now)) return false;
  const senin = lastMondayId(now);
  const hariIni = dayDocId(now);
  if (hariIni === senin) return true;
  const mingguSebelum = dayIdToDate(senin);
  mingguSebelum.setDate(mingguSebelum.getDate() - 1);
  return hariIni === dayDocId(mingguSebelum);
}

/** Keterangan singkat kapan Senin terakhirnya — untuk baris pengingatnya. */
export function fastingMonthlyLabel(now: Date): string {
  const senin = lastMondayId(now);
  return dayDocId(now) === senin
    ? 'Hari ini Senin terakhir bulan ini'
    : 'Besok Senin terakhir bulan ini';
}

// ===================== Kunci sesudah selesai 🔒 =====================
// Catatan puasa itu KESAKSIAN, bukan daftar tugas. Kalau bisa diubah kapan
// saja, hari yang dulu gagal bisa dicentang berhasil berbulan-bulan kemudian —
// dan angkanya berhenti berarti apa-apa.
//
// Tapi menguncinya PERSIS di hari terakhir juga keliru: hari terakhir baru
// bisa dinilai malamnya, dan jawaban doa sering baru terasa sehari-dua hari
// sesudahnya. Jadi ada masa tenggang.

/** Berapa hari SESUDAH tanggal selesai catatannya masih boleh diubah. */
export const FASTING_GRACE_DAYS = 2;

/** Hari terakhir puasa ini masih bisa diedit ("YYYY-MM-DD"). */
export function fastingEditableUntil(plan: FastingPlan): string {
  if (!plan.endId) return '';
  const batas = dayIdToDate(plan.endId);
  batas.setDate(batas.getDate() + FASTING_GRACE_DAYS);
  return dayDocId(batas);
}

/**
 * Sudah dikunci? Sekali true, SELAMANYA true — tanggalnya cuma maju.
 *
 * Puasa yang belum punya tanggal selesai (masih dibuat) tidak pernah terkunci.
 */
export function fastingLocked(plan: FastingPlan, now: Date): boolean {
  const batas = fastingEditableUntil(plan);
  return !!batas && dayDocId(now) > batas;
}

/**
 * Sisa hari sebelum terkunci — 0 berarti hari ini hari terakhirnya.
 * `null` = belum selesai puasanya, atau sudah telanjur terkunci.
 */
export function fastingLockDaysLeft(
  plan: FastingPlan,
  now: Date,
): number | null {
  const batas = fastingEditableUntil(plan);
  if (!batas) return null;
  const today = dayDocId(now);
  if (today > batas || today <= plan.endId) return null;
  return Math.round(
    (dayIdToDate(batas).getTime() - dayIdToDate(today).getTime()) / 86_400_000,
  );
}

// ===================== Kartu centang malam 🍽️ =====================
// Puasa dinilai SESUDAH harinya dijalani, bukan di tengahnya — jadi tagihannya
// muncul malam: jam 20.00 sampai tengah malam. Sesudah tengah malam harinya
// sudah berganti dan yang ditagih hari berikutnya.
const FASTING_CHECK_FROM_HOUR = 20;

/** Sekarang jam tayang kartu centang puasa di Home? (20.00–23.59) */
export function fastingCheckWindow(now: Date): boolean {
  return now.getHours() >= FASTING_CHECK_FROM_HOUR;
}

/**
 * Puasa yang hari ini MASIH perlu dicentang, di jam tayangnya — null kalau
 * tidak ada yang perlu ditagih.
 *
 * "Belum dicentang" sengaja berarti belum ada catatan sama sekali untuk hari
 * itu: begitu kamu menyimpan modalnya — berhasil ✅ maupun ❌ gagal — harinya
 * sudah dijawab, jadi kartunya berhenti menagih. Menagih terus sampai
 * "berhasil" cuma memaksa berbohong.
 */
export function fastingCheckDue(
  plans: FastingPlan[],
  now: Date,
  todayId: string,
): FastingPlan | null {
  if (!fastingCheckWindow(now)) return null;
  const plan = activeFasting(plans, now);
  if (!plan) return null;
  const hari = plan.days?.[todayId];
  const sudahDijawab =
    !!hari && (hari.done || !!hari.failed || !!hari.prayer.trim() || !!hari.answer.trim());
  return sudahDijawab ? null : plan;
}

function plansRef(uid: string) {
  return collection(db, 'users', uid, 'fasting');
}

/** Semua periode puasa, terbaru dulu. */
export function subscribeFastingPlans(
  uid: string,
  onChange: (plans: FastingPlan[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(plansRef(uid), orderBy('startId', 'desc'), limit(50));
  return liveList<FastingPlan>(q, onChange, onError, (d) => {
    const data = d.data();
    return {
      id: d.id,
      title: (data.title as string) ?? '',
      prayer: (data.prayer as string) ?? '',
      rules: (data.rules as string) ?? '',
      answer: (data.answer as string) ?? '',
      startId: (data.startId as string) ?? '',
      endId: (data.endId as string) ?? '',
      days: (data.days as Record<string, FastingDay>) ?? {},
    };
  });
}

/** Simpan/ubah keterangan periode puasa (tanpa menyentuh catatan harian). */
export function saveFastingPlan(
  uid: string,
  id: string,
  info: Pick<
    FastingPlan,
    'title' | 'prayer' | 'rules' | 'startId' | 'endId' | 'answer'
  >,
) {
  return setDoc(doc(plansRef(uid), id), info, { merge: true });
}

/** Simpan catatan SATU hari puasa (merge — hari lain tidak tersentuh). */
export function saveFastingDay(
  uid: string,
  id: string,
  dayId: string,
  day: FastingDay,
) {
  return setDoc(doc(plansRef(uid), id), { days: { [dayId]: day } }, { merge: true });
}

/** Hapus satu periode puasa — PERMANEN, beserta semua catatan hariannya. */
export function deleteFastingPlan(uid: string, id: string) {
  return deleteDoc(doc(plansRef(uid), id));
}
