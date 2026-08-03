import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// ============================== Profil tubuh ==============================
// users/{uid}/health/profile — SATU dokumen kecil (murah: 1 read per buka).
// Berat & lingkar perut disimpan di sini sebagai nilai terkini.

export type HealthProfile = {
  birthYear: number;
  heightCm: number;
  weightKg: number;
  waistCm: number | null; // null = belum pernah diisi
  bloodType: string | null; // golongan darah — info penting saat darurat
  eyeLeft: number | null; // minus mata kiri
  eyeRight: number | null; // minus mata kanan
  eyeCylLeft?: number | null; // silinder mata kiri
  eyeCylRight?: number | null; // silinder mata kanan
  updatedAt: Timestamp | null; // kapan terakhir data ini diperbarui
};

/** Pilihan golongan darah. */
export const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];

// Nilai awal sebelum dokumen pernah disimpan (data pemilik app).
export const DEFAULT_PROFILE: HealthProfile = {
  birthYear: 1998,
  heightCm: 169,
  weightKg: 71,
  waistCm: null,
  bloodType: null,
  eyeLeft: null,
  eyeRight: null,
  eyeCylLeft: null,
  eyeCylRight: null,
  updatedAt: null,
};

export function subscribeHealthProfile(
  uid: string,
  onChange: (profile: HealthProfile) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'profile');
  return onSnapshot(
    ref,
    (snapshot) => {
      // Dokumen belum ada → pakai default; field yang tersimpan menimpa default.
      onChange({
        ...DEFAULT_PROFILE,
        ...(snapshot.data() as Partial<HealthProfile> | undefined),
      });
    },
    onError,
  );
}

export function saveHealthProfile(uid: string, data: Partial<HealthProfile>) {
  const ref = doc(db, 'users', uid, 'health', 'profile');
  return setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Reminder timbang berat: setiap hari MINGGU, kalau data tubuh (berat)
 * belum diperbarui hari ini. Simpan berat tiap Minggu biar progres target
 * berat kelihatan naik/turun. (updatedAt selalu ikut ter-set saat menyimpan
 * Data Tubuh — yang wajib menyertakan berat.)
 */
export function needsWeighIn(profile: HealthProfile, now: Date): boolean {
  if (now.getDay() !== 0) return false; // 0 = Minggu
  if (!profile.updatedAt) return true;
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  return profile.updatedAt.toDate().getTime() < startOfToday;
}

/** Umur dari tahun lahir — cukup akurat untuk tampilan. */
export function ageFromBirthYear(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

// ============================== BMI ==============================
// Pakai ambang Asia-Pasifik (WHO) — lebih relevan untuk orang Indonesia
// daripada ambang umum (risiko metabolik muncul di BMI lebih rendah).

export function bmiValue(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}

export type BmiTone = 'ok' | 'warn' | 'danger';

export function bmiCategory(bmi: number): { label: string; tone: BmiTone } {
  if (bmi < 18.5) return { label: 'Berat kurang', tone: 'warn' };
  if (bmi < 23) return { label: 'Normal', tone: 'ok' };
  if (bmi < 25) return { label: 'Berlebih (berisiko)', tone: 'warn' };
  if (bmi < 30) return { label: 'Obesitas I', tone: 'danger' };
  return { label: 'Obesitas II', tone: 'danger' };
}

/** BMR pria (Mifflin-St Jeor) — kalori yang dibakar tubuh saat istirahat. */
export function bmrMale(
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
}

/** Kebutuhan air harian (liter) ≈ 35 ml per kg berat badan. */
export function dailyWaterLiters(weightKg: number): number {
  return (weightKg * 35) / 1000;
}

// ============================== Target berat ==============================
// users/{uid}/health/target — satu dokumen. startWeightKg = berat saat target
// dipasang, dipakai sebagai titik nol supaya progress dihitung konsisten.

export type WeightTarget = {
  targetWeightKg: number;
  startWeightKg: number;
};

export function subscribeWeightTarget(
  uid: string,
  onChange: (target: WeightTarget | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'target');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as WeightTarget) : null);
    },
    onError,
  );
}

export function saveWeightTarget(uid: string, target: WeightTarget) {
  return setDoc(doc(db, 'users', uid, 'health', 'target'), target);
}

export function clearWeightTarget(uid: string) {
  return deleteDoc(doc(db, 'users', uid, 'health', 'target'));
}

/** Rentang berat sehat (BMI normal Asia-Pasifik 18,5–22,9) untuk tinggi tertentu. */
export function idealWeightRange(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2;
  return { min: 18.5 * m2, max: 22.9 * m2 };
}

// ========================= Kebiasaan harian (to-do) =========================
// Daftar kebiasaan: users/{uid}/health/habits — SATU dokumen berisi array.
// Ceklis harian: users/{uid}/habitDays/{YYYY-MM-DD} — satu dokumen per hari,
// jadi otomatis "reset" tiap ganti hari tanpa perlu menghapus apa pun.

export type Habit = { id: string; label: string };

// Kebiasaan bawaan — tampil sebelum user menyimpan daftarnya sendiri.
export const DEFAULT_HABITS: Habit[] = [
  { id: 'olahraga', label: '🏃 Olahraga minimal 30 menit' },
  { id: 'makan-sehat', label: '🥗 Makan sehat, porsi terkontrol' },
  { id: 'air-putih', label: '💧 Minum air putih ±2 liter' },
  { id: 'tidur', label: '😴 Tidur 7–8 jam' },
];

export function subscribeHabits(
  uid: string,
  onChange: (habits: Habit[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'habits');
  return onSnapshot(
    ref,
    (snapshot) => {
      const list = snapshot.data()?.list as Habit[] | undefined;
      onChange(list ?? DEFAULT_HABITS);
    },
    onError,
  );
}

/** Simpan seluruh daftar kebiasaan (daftar kecil, ditulis utuh sekaligus). */
export function saveHabits(uid: string, list: Habit[]) {
  const ref = doc(db, 'users', uid, 'health', 'habits');
  return setDoc(ref, { list });
}

/** Id unik untuk kebiasaan baru. */
export function newHabitId(): string {
  return `h${Date.now().toString(36)}`;
}

/** "2026-07-23" — id dokumen ceklis harian (tanggal lokal perangkat). */
export function dayDocId(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type HabitDayMap = Record<string, boolean>;

// Satu dokumen per hari menampung ceklis + air minum + mood sekaligus —
// tiga fitur harian cukup 1 read & tetap otomatis reset tiap ganti hari.
export type HabitDay = {
  done: HabitDayMap;
  water: number; // gelas air putih hari ini
  mood: string | null; // emoji perasaan hari ini
};

/** Target gelas air putih per hari (±2 liter). */
export const WATER_GOAL = 8;

/** Pilihan mood harian — dari paling senang ke paling capek. */
export const MOODS = ['😄', '🙂', '😐', '😔', '😫'];

export function subscribeHabitDay(
  uid: string,
  dayId: string,
  onChange: (day: HabitDay) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        done: (data?.done as HabitDayMap) ?? {},
        water: (data?.water as number) ?? 0,
        mood: (data?.mood as string) ?? null,
      });
    },
    onError,
  );
}

export function setHabitDone(
  uid: string,
  dayId: string,
  habitId: string,
  done: boolean,
) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  // merge: hanya key kebiasaan ini yang berubah, centang lain tetap.
  return setDoc(ref, { done: { [habitId]: done } }, { merge: true });
}

export function setWater(uid: string, dayId: string, count: number) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return setDoc(
    ref,
    { water: Math.max(0, Math.min(count, 20)) },
    { merge: true },
  );
}

export function setMood(uid: string, dayId: string, mood: string) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return setDoc(ref, { mood }, { merge: true });
}

// ============================== Streak 🔥 ==============================
// users/{uid}/health/streak — {count, lastDayId}: berapa hari beruntun
// SEMUA kebiasaan selesai. Disimpan sebagai dokumen kecil (bukan dihitung
// dari riwayat) supaya tidak perlu membaca banyak dokumen tiap buka app.

export type Streak = { count: number; lastDayId: string };

export function subscribeStreak(
  uid: string,
  onChange: (streak: Streak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'streak');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as Streak) : null);
    },
    onError,
  );
}

function yesterdayId(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dayDocId(y);
}

/** Streak yang masih berlaku: putus kalau terakhir lengkap bukan hari ini/kemarin. */
export function activeStreak(streak: Streak | null, todayId: string): number {
  if (!streak) return 0;
  if (streak.lastDayId === todayId || streak.lastDayId === yesterdayId()) {
    return streak.count;
  }
  return 0;
}

/** Panggil saat SEMUA kebiasaan hari ini selesai — naik maksimal 1×/hari. */
export function bumpStreak(
  uid: string,
  streak: Streak | null,
  todayId: string,
) {
  if (streak?.lastDayId === todayId) return Promise.resolve(); // sudah dihitung
  const continued = streak !== null && streak.lastDayId === yesterdayId();
  return setDoc(doc(db, 'users', uid, 'health', 'streak'), {
    count: continued ? streak.count + 1 : 1,
    lastDayId: todayId,
  });
}

// ============================== Check-up ==============================
// users/{uid}/checkups/{id} — riwayat pemeriksaan tekanan darah & gula darah.

export type CheckupType = 'tensi' | 'gula';

export type Checkup = {
  id: string;
  type: CheckupType;
  value: string; // hasil, mis. "120/80 mmHg" atau "95 mg/dL"
  note: string;
  date: Timestamp;
};

export const CHECKUP_TYPES: {
  key: CheckupType;
  label: string;
  icon: string;
}[] = [
  { key: 'tensi', label: 'Tekanan Darah', icon: '🩸' },
  { key: 'gula', label: 'Gula Darah', icon: '🍬' },
];

// Nilai normal (patokan dewasa sehat, kondisi istirahat) + tips kalau hasil di
// luar normal. Dipakai di tab Check-up (evaluasi hasil terakhir) & halaman Info.
export const CHECKUP_INFO: Record<
  CheckupType,
  { normal: string; highTip: string; lowTip: string }
> = {
  tensi: {
    normal: '90/60 – 120/80 mmHg',
    highTip:
      'Kurangi garam & gorengan, kelola stres, olahraga rutin, tidur cukup. Kalau sering di atas 140/90, periksa ke dokter.',
    lowTip:
      'Cukup minum, jangan telat makan, bangun/berdiri perlahan. Kalau sering pusing atau mau pingsan, periksa ke dokter.',
  },
  gula: {
    normal: '70 – 99 mg/dL (puasa)',
    highTip:
      'Kurangi gula & karbo sederhana, perbanyak serat & gerak, jaga berat badan. Kalau gula puasa menetap ≥100, cek HbA1c ke dokter.',
    lowTip:
      'Segera makan/minum manis (jus/permen), jangan telat makan. Kalau sering gemetar & keringat dingin, periksa ke dokter.',
  },
};

export type CheckupStatus = 'low' | 'normal' | 'high' | 'unknown';

/**
 * Evaluasi hasil pemeriksaan dari teks bebas (mis. "120/80" atau "95 mg/dL").
 * Balikan: status + label singkat + tips (kosong kalau normal / tak terbaca).
 */
export function evaluateCheckup(
  type: CheckupType,
  value: string,
): { status: CheckupStatus; label: string; tip: string } {
  const info = CHECKUP_INFO[type];
  let status: CheckupStatus = 'unknown';

  if (type === 'tensi') {
    const m = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) {
      const sys = Number(m[1]);
      const dia = Number(m[2]);
      if (sys < 90 || dia < 60) status = 'low';
      else if (sys > 120 || dia > 80) status = 'high';
      else status = 'normal';
    }
  } else {
    const m = value.match(/\d+/);
    if (m) {
      const g = Number(m[0]);
      if (g < 70) status = 'low';
      else if (g >= 100) status = 'high';
      else status = 'normal';
    }
  }

  const label =
    status === 'normal'
      ? '✅ Normal'
      : status === 'high'
        ? '⚠️ Cenderung tinggi'
        : status === 'low'
          ? '⚠️ Cenderung rendah'
          : '';
  const tip =
    status === 'high' ? info.highTip : status === 'low' ? info.lowTip : '';
  return { status, label, tip };
}

/** Lewat dari ini (hari) dianggap sudah waktunya periksa lagi (≈ 6 bulan). */
export const CHECKUP_DUE_DAYS = 180;

/** Jadwal cek berikutnya = 6 bulan setelah pemeriksaan terakhir. */
export function checkupNextDate(latest: Checkup): Date {
  const next = latest.date.toDate();
  next.setMonth(next.getMonth() + 6);
  return next;
}

/** Sisa hari menuju jadwal cek berikutnya (negatif = sudah lewat). */
export function checkupDaysUntil(latest: Checkup, today: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round(
    (startOfDay(checkupNextDate(latest)) - startOfDay(today)) / 86_400_000,
  );
}

/**
 * Reminder untuk Home: jenis pemeriksaan yang PERNAH dicatat & jadwal cek
 * berikutnya (6 bulan) sudah tiba/lewat. Yang belum pernah dicatat tidak
 * diingatkan di Home (belum ada patokan tanggalnya).
 */
export function checkupDueReminders(
  checkups: Checkup[],
  today: Date,
): { type: CheckupType; label: string; icon: string; days: number }[] {
  const out: { type: CheckupType; label: string; icon: string; days: number }[] = [];
  for (const meta of CHECKUP_TYPES) {
    // checkups sudah urut tanggal desc → yang pertama = terbaru.
    const latest = checkups.find((c) => c.type === meta.key);
    if (!latest) continue;
    const days = checkupDaysUntil(latest, today);
    if (days <= 0) {
      out.push({ type: meta.key, label: meta.label, icon: meta.icon, days });
    }
  }
  return out;
}

export function subscribeCheckups(
  uid: string,
  onChange: (items: Checkup[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(
    collection(db, 'users', uid, 'checkups'),
    orderBy('date', 'desc'),
    limit(100),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Checkup, 'id'>) })),
      );
    },
    onError,
  );
}

export function addCheckup(
  uid: string,
  data: { type: CheckupType; value: string; note: string; date: Date },
) {
  return addDoc(collection(db, 'users', uid, 'checkups'), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function updateCheckup(
  uid: string,
  id: string,
  data: { value?: string; note?: string; date?: Date },
) {
  const payload: Record<string, unknown> = {};
  if (data.value !== undefined) payload.value = data.value;
  if (data.note !== undefined) payload.note = data.note;
  if (data.date !== undefined) payload.date = Timestamp.fromDate(data.date);
  return updateDoc(doc(db, 'users', uid, 'checkups', id), payload);
}

export function deleteCheckup(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'checkups', id));
}

// ============================== Riwayat sakit ==============================
// users/{uid}/diseases/{id} — seperti sheet "Disease 🤧" lama:
// kapan kena, penyakit apa, penyebab, obat/penanganan, kapan sembuh.

export type Disease = {
  id: string;
  name: string; // jenis penyakit
  cause: string; // penyebab (dugaan)
  treatment: string; // obat/penanganan, boleh kosong
  start: Timestamp; // tanggal mulai sakit
  recover: Timestamp | null; // null = belum sembuh
};

export function subscribeDiseases(
  uid: string,
  onChange: (items: Disease[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(
    collection(db, 'users', uid, 'diseases'),
    orderBy('start', 'desc'),
    limit(100),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Disease, 'id'>) })),
      );
    },
    onError,
  );
}

export function addDisease(
  uid: string,
  data: {
    name: string;
    cause: string;
    treatment: string;
    start: Date;
    recover: Date | null;
  },
) {
  return addDoc(collection(db, 'users', uid, 'diseases'), {
    ...data,
    start: Timestamp.fromDate(data.start),
    recover: data.recover ? Timestamp.fromDate(data.recover) : null,
  });
}

export function updateDisease(
  uid: string,
  id: string,
  data: {
    name?: string;
    cause?: string;
    treatment?: string;
    start?: Date;
    recover?: Date | null;
  },
) {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.cause !== undefined) payload.cause = data.cause;
  if (data.treatment !== undefined) payload.treatment = data.treatment;
  if (data.start !== undefined) payload.start = Timestamp.fromDate(data.start);
  if ('recover' in data) {
    payload.recover = data.recover ? Timestamp.fromDate(data.recover) : null;
  }
  return updateDoc(doc(db, 'users', uid, 'diseases', id), payload);
}

export function deleteDisease(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'diseases', id));
}

// ====================== Rekor langkah harian 🏆 ======================
// users/{uid}/health/steps — SATU dokumen: { days: { [YYYY-MM-DD]: langkah } }.
// Hanya menyimpan HARI YANG SUDAH SELESAI (kemarin ke belakang) yang tembus
// minimal tier terendah — diisi otomatis dari riwayat Apple Health saat app
// dibuka. Tiap hari dihitung SEKALI di tier tertinggi yang dicapainya (mis.
// 40.000 langkah masuk tier 40rb saja, tidak sekaligus di 20rb).

// Ambang langkah/hari (menaik). Ubah/ tambah di sini kalau mau tier lain.
export const STEP_TIERS = [20000, 30000, 40000, 50000];

// dayId ("YYYY-MM-DD") → langkah final hari itu.
export type StepDaysMap = Record<string, number>;

export function subscribeStepDays(
  uid: string,
  onChange: (days: StepDaysMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'steps');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.days as StepDaysMap) ?? {});
    },
    onError,
  );
}

/** Simpan langkah final beberapa hari sekaligus (merge → hari lain tetap). */
export function recordStepDays(
  uid: string,
  entries: { dayId: string; steps: number }[],
) {
  if (entries.length === 0) return Promise.resolve();
  const days: StepDaysMap = {};
  for (const e of entries) days[e.dayId] = e.steps;
  return setDoc(doc(db, 'users', uid, 'health', 'steps'), { days }, { merge: true });
}

/** Tier tertinggi yang dicapai `steps` (null kalau di bawah tier terendah). */
export function stepTierOf(steps: number): number | null {
  let tier: number | null = null;
  for (const t of STEP_TIERS) if (steps >= t) tier = t;
  return tier;
}

export type StepTierStat = {
  tier: number;
  count: number; // sudah berapa kali
  dayIds: string[]; // tanggal-tanggalnya, terbaru dulu
};

/**
 * Rekap pencapaian langkah: per tier berapa kali + tanggal-tanggalnya, plus
 * rekor terbaik. Tiap hari dihitung SEKALI di tier tertingginya.
 */
export function stepAchievements(days: StepDaysMap): {
  tiers: StepTierStat[];
  best: { dayId: string; steps: number } | null;
  totalDays: number;
} {
  const buckets = new Map<number, string[]>();
  for (const t of STEP_TIERS) buckets.set(t, []);
  let best: { dayId: string; steps: number } | null = null;
  let totalDays = 0;
  for (const [dayId, steps] of Object.entries(days)) {
    const tier = stepTierOf(steps);
    if (tier === null) continue;
    buckets.get(tier)!.push(dayId);
    totalDays += 1;
    if (!best || steps > best.steps) best = { dayId, steps };
  }
  const tiers = STEP_TIERS.map((t) => {
    const dayIds = buckets.get(t)!.sort((a, b) => (a < b ? 1 : -1)); // terbaru dulu
    return { tier: t, count: dayIds.length, dayIds };
  });
  return { tiers, best, totalDays };
}
