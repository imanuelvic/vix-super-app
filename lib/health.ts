import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    documentId,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    type FirestoreError,
} from 'firebase/firestore';

import { type LoginStreak as DayStreak } from './achievements';
import { db } from './firebase';
import { dayId, daysBetween } from './format';
import { liveDoc, liveList } from './liveDoc';
import { alreadyCounted, nextStreak } from './streak';

// ============================== Profil tubuh ==============================
// users/{uid}/health/profile — SATU dokumen kecil (murah: 1 read per buka).
// Berat & lingkar perut disimpan di sini sebagai nilai terkini.

export type HealthProfile = {
  birthYear: number;
  heightCm: number;
  weightKg: number;
  waistCm: number | null; // lingkar perut — null = belum pernah diisi
  bloodType: string | null; // golongan darah — info penting saat darurat
  eyeLeft: number | null; // minus mata kiri
  eyeRight: number | null; // minus mata kanan
  eyeCylLeft?: number | null; // silinder mata kiri
  eyeCylRight?: number | null; // silinder mata kanan
  // Ukuran badan lain — semua opsional. Leher + pinggang dipakai menghitung
  // persen lemak tubuh (metode US Navy); sisanya untuk membayangkan postur
  // & melihat perubahan bentuk badan walau berat tidak banyak berubah.
  neckCm?: number | null; // lingkar leher
  hipCm?: number | null; // lingkar pinggang/pinggul
  chestCm?: number | null; // lingkar dada
  armCm?: number | null; // lingkar lengan atas
  thighCm?: number | null; // lingkar paha
  shirtSize?: string | null; // ukuran baju (S/M/L/XL)
  pantsSize?: string | null; // ukuran celana
  shoeSize?: number | null; // ukuran sepatu (EU)
  updatedAt: Timestamp | null; // kapan terakhir data ini diperbarui
};

/** Pilihan golongan darah. */
export const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];

// Nilai awal sebelum dokumen pernah disimpan (data pemilik app).
const DEFAULT_PROFILE: HealthProfile = {
  birthYear: 1998,
  heightCm: 169,
  weightKg: 71,
  waistCm: null,
  bloodType: null,
  eyeLeft: null,
  eyeRight: null,
  eyeCylLeft: null,
  eyeCylRight: null,
  neckCm: null,
  hipCm: null,
  chestCm: null,
  armCm: null,
  thighCm: null,
  shirtSize: null,
  pantsSize: null,
  shoeSize: null,
  updatedAt: null,
};

export function subscribeHealthProfile(
  uid: string,
  onChange: (profile: HealthProfile) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'profile');
  return liveDoc(
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

// ==================== Ukuran badan & rekomendasi ====================
// Semua dihitung dari Data Tubuh — tidak ada data tambahan yang disimpan.

/**
 * Persen lemak tubuh PRIA — metode US Navy (butuh lingkar pinggang & leher +
 * tinggi). Perkiraan, bukan pengganti alat ukur; tapi jauh lebih menggambarkan
 * bentuk badan daripada BMI saja. null = ukurannya belum lengkap.
 */
export function bodyFatMale(
  waistCm: number | null | undefined,
  neckCm: number | null | undefined,
  heightCm: number,
): number | null {
  if (!waistCm || !neckCm || heightCm <= 0 || waistCm <= neckCm) return null;
  const pct =
    495 /
      (1.0324 -
        0.19077 * Math.log10(waistCm - neckCm) +
        0.15456 * Math.log10(heightCm)) -
    450;
  return pct > 0 && pct < 70 ? pct : null;
}

/** Kategori persen lemak tubuh pria (ACE). */
export function bodyFatCategory(pct: number): { label: string; tone: BmiTone } {
  if (pct < 6) return { label: 'Sangat rendah', tone: 'warn' };
  if (pct < 14) return { label: 'Atletis', tone: 'ok' };
  if (pct < 18) return { label: 'Bugar', tone: 'ok' };
  if (pct < 25) return { label: 'Rata-rata', tone: 'warn' };
  return { label: 'Berlebih', tone: 'danger' };
}

/** Rasio pinggang/pinggul pria — sehat < 0,90. null bila belum lengkap. */
export function waistHipRatio(
  waistCm: number | null | undefined,
  hipCm: number | null | undefined,
): number | null {
  if (!waistCm || !hipCm) return null;
  return waistCm / hipCm;
}

/**
 * Saran praktis dari Data Tubuh — apa yang perlu dikejar supaya badan makin
 * sehat & mendekati bentuk ideal. Urut dari yang paling berdampak.
 */
export function bodyAdvice(profile: HealthProfile, age: number): string[] {
  const out: string[] = [];
  const bmi = bmiValue(profile.weightKg, profile.heightCm);
  const ideal = idealWeightRange(profile.heightCm);
  const fat = bodyFatMale(profile.waistCm, profile.neckCm, profile.heightCm);
  const whtr = profile.waistCm ? profile.waistCm / profile.heightCm : null;

  if (bmi >= 23) {
    const turun = profile.weightKg - ideal.max;
    out.push(
      `⚖️ Turun ±${formatKg(turun)} kg lagi supaya BMI masuk rentang sehat (${formatKg(ideal.min)}–${formatKg(ideal.max)} kg).`,
    );
  } else if (bmi < 18.5) {
    out.push(
      `⚖️ Naik ±${formatKg(ideal.min - profile.weightKg)} kg supaya berat masuk rentang sehat.`,
    );
  } else {
    out.push(`✅ Berat sudah di rentang sehat (${formatKg(ideal.min)}–${formatKg(ideal.max)} kg). Pertahankan.`);
  }

  if (whtr != null && whtr >= 0.5) {
    const target = profile.heightCm * 0.49;
    out.push(
      `📏 Lingkar perut ideal di bawah ${Math.round(target)} cm — lemak perut paling berisiko untuk jantung.`,
    );
  }

  if (fat != null) {
    if (fat >= 18) {
      out.push(
        `🔥 Lemak tubuh ±${formatKg(fat)}%. Untuk sixpack biasanya perlu di bawah 15% — defisit kalori pelan + latihan beban.`,
      );
    } else {
      out.push(`💪 Lemak tubuh ±${formatKg(fat)}% — sudah bagus, jaga massa otot dengan latihan beban.`);
    }
  } else {
    out.push('📐 Isi lingkar leher & pinggang untuk melihat perkiraan persen lemak tubuh.');
  }

  const bmr = bmrMale(profile.weightKg, profile.heightCm, age);
  out.push(
    `🍽️ Kebutuhan harian ±${Math.round(bmr * 1.4)} kkal (aktivitas ringan). Defisit sehat = kurangi ±400 kkal.`,
  );
  out.push('💧 Minum 8 gelas air & tidur 7–8 jam.');
  return out;
}

/** 1 desimal, koma ala Indonesia — dipakai di teks saran. */
function formatKg(n: number): string {
  const s = Math.abs(n).toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',');
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
  return liveDoc(
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

// ===================== Target jarak MINGGUAN 🎯 =====================
// users/{uid}/health/weekTarget — satu dokumen, satu angka.
//
// Beda dari WEEK_STEP_GOAL (70.000 langkah) yang merupakan ANJURAN kesehatan
// untuk orang dewasa pada umumnya: yang ini targetmu SENDIRI, kamu yang
// menentukan, dan ia mulai dari nol lagi tiap Senin jam 00.00 — sama seperti
// akumulasi minggunya (lihat weekDayIds).

export type WeekDistanceTarget = { km: number };

/** Usul awal saat kolomnya masih kosong (≈ 5 km × 5 hari). */
export const WEEK_TARGET_DEFAULT_KM = 25;

function weekTargetRef(uid: string) {
  return doc(db, 'users', uid, 'health', 'weekTarget');
}

export function subscribeWeekTarget(
  uid: string,
  onChange: (target: WeekDistanceTarget | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    weekTargetRef(uid),
    (snapshot) => {
      const km = snapshot.data()?.km;
      onChange(typeof km === 'number' && km > 0 ? { km } : null);
    },
    onError,
  );
}

export function saveWeekTarget(uid: string, km: number) {
  return setDoc(weekTargetRef(uid), { km });
}

export function clearWeekTarget(uid: string) {
  return deleteDoc(weekTargetRef(uid));
}

/**
 * Sisa jarak minggu ini — 0 berarti targetnya sudah tercapai.
 *
 * Sengaja tidak pernah negatif: yang ingin dibaca "kurang berapa lagi", bukan
 * "kelebihan berapa". Kelebihannya sudah terlihat dari angka jaraknya sendiri.
 */
export function weekTargetLeft(km: number, targetKm: number): number {
  return Math.max(0, targetKm - km);
}

/** Rentang berat sehat (BMI normal Asia-Pasifik 18,5–22,9) untuk tinggi tertentu. */
export function idealWeightRange(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2;
  return { min: 18.5 * m2, max: 22.9 * m2 };
}

// ========================= Ceklis kebiasaan harian =========================
// Definisi kebiasaan (terjadwal per jenis hari, sesi Pagi/Siang/Malam) ada di
// lib/habits.ts. Ceklis harian: users/{uid}/habitDays/{YYYY-MM-DD} — satu
// dokumen per hari, jadi otomatis "reset" tiap ganti hari.

/** "2026-07-23" — id dokumen ceklis harian (tanggal lokal perangkat). */
export function dayDocId(d: Date): string {
  return dayId(d);
}

export type HabitDayMap = Record<string, boolean>;

// Satu dokumen per hari menampung ceklis + air minum — cukup 1 read & tetap
// otomatis reset tiap ganti hari.
export type HabitDay = {
  done: HabitDayMap;
  /**
   * Kebiasaan yang sengaja DILEWATI hari ini (✗) — id kebiasaan → true.
   * Bukan "selesai" dan bukan "gagal": hari ini kebiasaan itu dianggap TIDAK
   * BERLAKU, jadi ia keluar dari semua hitungan harian (score, area, badge tab
   * Habits, kartu reminder Dashboard). Ikut kereset tiap ganti hari karena
   * disimpan di dokumen harian yang sama.
   */
  skipped: HabitDayMap;
  water: number;
  /**
   * Catatan singkat untuk kebiasaan yang memintanya (refleksi harian,
   * syukur, 1 kalimat rhema) — id kebiasaan → isi tulisannya.
   */
  notes: Record<string, string>;
};

export const WATER_GOAL = 8;

export function subscribeHabitDay(
  uid: string,
  dayId: string,
  onChange: (day: HabitDay) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return liveDoc(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        done: (data?.done as HabitDayMap) ?? {},
        skipped: (data?.skipped as HabitDayMap) ?? {},
        water: (data?.water as number) ?? 0,
        notes: (data?.notes as Record<string, string>) ?? {},
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

/**
 * Tandai satu kebiasaan DILEWATI hari ini (✗), atau batalkan lagi.
 * Melewati sekaligus melepas centangnya — supaya tidak pernah ada baris yang
 * tercentang tapi juga dilewati. Keduanya ditulis dalam satu `setDoc` merge,
 * jadi tetap satu kali tulis Firestore.
 */
export function setHabitSkipped(
  uid: string,
  dayId: string,
  habitId: string,
  skipped: boolean,
) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return setDoc(
    ref,
    skipped
      ? { skipped: { [habitId]: true }, done: { [habitId]: false } }
      : { skipped: { [habitId]: false } },
    { merge: true },
  );
}

export type HabitNoteDay = { dayId: string; text: string };

export type HabitNotes = {
  /** Hari yang catatannya terisi, terbaru dulu. */
  days: HabitNoteDay[];
  /** true = jendelanya penuh, jadi mungkin masih ada hari yang lebih lama. */
  more: boolean;
};

/**
 * Berapa hari dibaca sekali angkat. Bukan batas penyimpanan — catatanmu
 * tersimpan selamanya, satu dokumen per hari; ini cuma sejauh apa yang
 * ditarik dalam satu tarikan.
 */
export const HABIT_NOTES_PAGE = 120;

/**
 * Riwayat catatan SATU kebiasaan — hari terbaru dulu, hari yang catatannya
 * kosong tidak ikut. Dipakai layar Riwayat Syukur 🙏.
 *
 * Diurutkan lewat `documentId()` karena id dokumennya sendiri "YYYY-MM-DD":
 * urutan abjadnya = urutan tanggalnya, jadi tidak perlu field `date` tambahan
 * dan tidak perlu composite index.
 *
 * `max` sengaja bisa DINAIKKAN pemanggilnya, bukan angka mati. Membaca seluruh
 * riwayat tiap layar dibuka berarti biayanya naik terus selama app dipakai —
 * padahal yang hampir selalu dilihat cuma yang terbaru. Jadi: bacanya sejendela
 * dulu, dan `more` memberi tahu layarnya apakah masih ada yang lebih lama untuk
 * ditawarkan. Tidak ada catatan yang hilang — cuma belum ditarik.
 */
export function subscribeHabitNotes(
  uid: string,
  habitId: string,
  onChange: (notes: HabitNotes) => void,
  onError?: (error: FirestoreError) => void,
  max = HABIT_NOTES_PAGE,
) {
  const q = query(
    collection(db, 'users', uid, 'habitDays'),
    orderBy(documentId(), 'desc'),
    limit(max),
  );
  // Penyaringannya di DAFTAR (hari tanpa catatan dibuang), pemetaannya per
  // baris — dua urusan berbeda, jadi ditulis di dua tempat berbeda.
  //
  // `more` dihitung dari jumlah SEBELUM disaring: hari tanpa catatan tetap
  // memakan jatah jendelanya, jadi daftar yang tinggal 3 baris pun bisa saja
  // sudah menyentuh batas.
  return liveList<HabitNoteDay>(
    q,
    (days) =>
      onChange({
        days: days.filter((d) => d.text.trim().length > 0),
        more: days.length >= max,
      }),
    onError,
    (d) => {
      const notes = (d.data().notes as Record<string, string>) ?? {};
      return { dayId: d.id, text: notes[habitId] ?? '' };
    },
  );
}

/** Simpan catatan singkat satu kebiasaan hari itu (refleksi, syukur, rhema). */
export function setHabitNote(
  uid: string,
  dayId: string,
  habitId: string,
  text: string,
) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return setDoc(ref, { notes: { [habitId]: text } }, { merge: true });
}

export function setWater(uid: string, dayId: string, count: number) {
  const ref = doc(db, 'users', uid, 'habitDays', dayId);
  return setDoc(
    ref,
    { water: Math.max(0, Math.min(count, 20)) },
    { merge: true },
  );
}

// ===== Streak air putih 💧 — SATU dokumen: users/{uid}/app/waterStreak =====
// Jumlah gelas HARI INI tersimpan di habitDays/{dayId} (otomatis 0 tiap ganti
// hari). Yang disimpan di sini cuma streaknya: naik SEKALI per hari, tepat
// saat gelas ke-8 (WATER_GOAL) tercapai.

export function subscribeWaterStreak(
  uid: string,
  onChange: (streak: DayStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'app', 'waterStreak'),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as DayStreak) : null),
    onError,
  );
}

/** Panggil saat air hari ini mencapai target — naik maksimal 1×/hari. */
export function bumpWaterStreak(
  uid: string,
  current: DayStreak | null,
  todayId: string,
) {
  if (alreadyCounted(current, todayId)) return Promise.resolve();
  return setDoc(
    doc(db, 'users', uid, 'app', 'waterStreak'),
    nextStreak(current, todayId, yesterdayId()),
  );
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
  return liveDoc(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as Streak) : null);
    },
    onError,
  );
}

/** dayId kemarin — dipakai semua streak harian untuk cek "bersambung". */
export function yesterdayId(): string {
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

/** Jadwal cek berikutnya = 6 bulan setelah pemeriksaan terakhir. */
export function checkupNextDate(latest: Checkup): Date {
  const next = latest.date.toDate();
  next.setMonth(next.getMonth() + 6);
  return next;
}

/** Sisa hari menuju jadwal cek berikutnya (negatif = sudah lewat). */
export function checkupDaysUntil(latest: Checkup, today: Date): number {
  return daysBetween(today, checkupNextDate(latest));
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
  return liveList<Checkup>(q, onChange, onError);
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
  return liveList<Disease>(q, onChange, onError);
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
  return liveDoc(
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

// ===================== Langkah yang dicatat SENDIRI =====================
// Tidak semua jalan kaki lewat iPhone. Jam tangan Huawei tidak tersambung ke
// Apple Health, jadi langkah dari jalan tanpa HP hilang begitu saja.
//
// Angkanya disimpan TERPISAH dari `days`, bukan ditambahkan ke dalamnya, dan
// itu bukan sekadar kerapian: tiap kali layar Steps dibuka, riwayat 60 hari
// dari Apple Health ditulis ulang ke `days` (recordStepDays). Kalau tambahan
// manualnya menumpang di sana, ia terhapus diam-diam pada sinkron berikutnya —
// dan yang paling buruk, terhapusnya tanpa jejak. Terpisah begini, angka Apple
// Health tetap murni angka Apple Health, dan tambahanmu tetap tambahanmu.
//
// Dokumennya sama (`health/steps`), jadi langganan keduanya digabung jadi satu
// listener oleh liveDoc — tidak ada pembacaan Firestore tambahan sama sekali.

/** dayId → langkah yang kamu tambahkan sendiri hari itu. */
export type StepManualMap = Record<string, number>;

/** Batas satu kali tambah. Bukan curiga — pagar supaya salah ketik nol
 *  (90000 padahal 9000) tidak diam-diam merusak semua rekapmu. */
export const STEP_MANUAL_MAX = 60_000;

export function subscribeManualSteps(
  uid: string,
  onChange: (manual: StepManualMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'health', 'steps');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.manual as StepManualMap) ?? {});
    },
    onError,
  );
}

/**
 * Tetapkan jumlah langkah manual hari itu. Yang ditulis TOTALNYA, bukan
 * selisihnya — jadi salah ketik cukup diperbaiki dengan mengisi ulang, dan
 * menekan simpan dua kali tidak pernah menghitung dua kali.
 *
 * 0 = tambahan hari itu dihapus (hard delete, sama seperti hapus di mana pun
 * di app ini — angkanya benar-benar hilang, bukan disembunyikan).
 */
export function setManualSteps(uid: string, dayId: string, steps: number) {
  return setDoc(
    doc(db, 'users', uid, 'health', 'steps'),
    { manual: { [dayId]: Math.max(0, Math.round(steps)) } },
    { merge: true },
  );
}

/** Jumlah langkah manual pada sekumpulan hari — untuk rekap minggu & bulan. */
export function manualInDays(manual: StepManualMap, ids: string[]): number {
  return ids.reduce((n, id) => n + (manual[id] ?? 0), 0);
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

/**
 * Untuk tiap tier: tanggal TERAKHIR (dayId) yang langkahnya ≥ tier (mencakup
 * hari yang menembus tier lebih tinggi). null kalau tier itu belum pernah
 * tercapai. Dipakai di Achievement untuk "terakhir tercapai kapan".
 */
export function stepTierLastDates(
  days: StepDaysMap,
): Record<number, string | null> {
  const result: Record<number, string | null> = {};
  for (const tier of STEP_TIERS) {
    let last: string | null = null;
    for (const [dayId, steps] of Object.entries(days)) {
      if (steps >= tier && (last === null || dayId > last)) last = dayId;
    }
    result[tier] = last;
  }
  return result;
}

// ============ Jarak tempuh 🏃 — mingguan, bulanan & istilah pelari ============
// Langkah dari Apple Health diubah jadi KILOMETER supaya bisa dibandingkan
// dengan patokan yang dikenal pelari (5K, 10K, Half Marathon, dst).
// Panjang langkah ≈ 0,415 × tinggi badan (rumus umum jalan kaki pria).

/** Panjang satu langkah dalam meter, dari tinggi badan. */
export function strideMeters(heightCm: number): number {
  return (heightCm > 0 ? heightCm : 170) * 0.415 / 100;
}

/** Langkah → kilometer (butuh tinggi badan untuk panjang langkah). */
export function stepsToKm(steps: number, heightCm: number): number {
  return (steps * strideMeters(heightCm)) / 1000;
}

/**
 * Patokan jarak SEHARI memakai istilah yang dipakai pelari. Easy Run =
 * lari santai; Long Run = latihan jarak jauh mingguan; sisanya nama lomba.
 */
export const RUN_DAY_MILESTONES: { km: number; emoji: string; label: string }[] =
  [
    { km: 3, emoji: '🚶', label: 'Shakeout' },
    { km: 5, emoji: '🏃', label: 'Easy Run · 5K' },
    { km: 10, emoji: '⚡', label: 'Tempo Run · 10K' },
    { km: 15, emoji: '🔥', label: 'Long Run · 15K' },
    { km: 21.1, emoji: '🏅', label: 'Half Marathon' },
    { km: 42.2, emoji: '👑', label: 'Full Marathon' },
  ];

/** Patokan AKUMULASI Senin–Minggu (mileage mingguan ala buku latihan lari). */
export const RUN_WEEK_MILESTONES: { km: number; emoji: string; label: string }[] =
  [
    { km: 21.1, emoji: '✨', label: 'Base Week' },
    { km: 42.2, emoji: '🔥', label: 'Marathon Week' },
    { km: 70, emoji: '🏅', label: 'Peak Week' },
    { km: 100, emoji: '👑', label: 'Century Week' },
  ];

export const RUN_MONTH_MILESTONES: { km: number; emoji: string; label: string }[] =
  [
    { km: 100, emoji: '🎽', label: '100K Bulanan' },
    { km: 200, emoji: '🏆', label: '200K Bulanan' },
    { km: 300, emoji: '💎', label: '300K Bulanan' },
  ];

/** Patokan tertinggi yang sudah dilewati `km` (null kalau belum ada). */
export function runMilestoneOf(
  km: number,
  list: { km: number; emoji: string; label: string }[],
): { km: number; emoji: string; label: string } | null {
  let hit: { km: number; emoji: string; label: string } | null = null;
  for (const m of list) if (km >= m.km) hit = m;
  return hit;
}

/** dayId Senin pada minggu yang memuat `d` (minggu = Senin–Minggu). */
export function weekStartId(d: Date): string {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0 = Minggu → mundur 6 hari; selainnya mundur (hari − 1).
  start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
  return dayDocId(start);
}

/** Tujuh dayId Senin→Minggu untuk minggu yang memuat `d`. */
export function weekDayIds(d: Date): string[] {
  const start = dayIdToDateLocal(weekStartId(d));
  const ids: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    ids.push(dayDocId(day));
  }
  return ids;
}

/** Semua dayId dalam bulan yang memuat `d`. */
export function monthDayIds(d: Date): string[] {
  const total = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const ids: string[] = [];
  for (let i = 1; i <= total; i += 1) {
    ids.push(dayDocId(new Date(d.getFullYear(), d.getMonth(), i)));
  }
  return ids;
}

/** Total langkah pada sekumpulan hari (hari tanpa data dihitung 0). */
export function stepsInDays(days: StepDaysMap, ids: string[]): number {
  return ids.reduce((sum, id) => sum + (days[id] ?? 0), 0);
}

/**
 * Rekor jarak: hari / minggu / bulan terbaik sepanjang data tersimpan (km).
 * Dipakai fitur Achievement supaya patokan lari ikut terhitung di sana.
 */
export function runRecords(
  days: StepDaysMap,
  heightCm: number,
): { bestDayKm: number; bestWeekKm: number; bestMonthKm: number } {
  const weeks = new Map<string, number>();
  const months = new Map<string, number>();
  let bestDay = 0;
  for (const [dayId, steps] of Object.entries(days)) {
    const km = stepsToKm(steps, heightCm);
    if (km > bestDay) bestDay = km;
    const wk = weekStartId(dayIdToDateLocal(dayId));
    weeks.set(wk, (weeks.get(wk) ?? 0) + km);
    const mo = dayId.slice(0, 7); // "YYYY-MM"
    months.set(mo, (months.get(mo) ?? 0) + km);
  }
  return {
    bestDayKm: bestDay,
    bestWeekKm: Math.max(0, ...weeks.values()),
    bestMonthKm: Math.max(0, ...months.values()),
  };
}

/** "2026-08-13" → Date lokal (salinan lokal biar lib ini tidak saling impor). */
function dayIdToDateLocal(dayId: string): Date {
  const [y, m, d] = dayId.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ================== Rekap MINGGUAN 📅 (langkah + gym) ==================
// users/{uid}/health/weeks — { weeks: { [dayId Senin]: { steps, gym } } }.
//
// Kenapa disimpan terpisah padahal bisa dihitung dari `health/steps`?
// Riwayat Apple Health yang ditarik hanya 60 hari terakhir; rekap mingguan ini
// membuat pencapaian minggu-minggu lama tetap tersimpan selamanya. Satu
// dokumen kecil (52 baris per tahun) → tetap 1 read.
//
// Patokan mengikuti anjuran umum kesehatan dewasa: ±150 menit aktivitas
// aerobik sedang per minggu (≈ 70.000 langkah) DAN strength training minimal
// 2 hari per minggu.
export const WEEK_STEP_GOAL = 70_000;
export const WEEK_GYM_GOAL = 2;

export type WeekStat = { steps: number; gym: number };
export type WeekStatsMap = Record<string, WeekStat>;

export function subscribeWeekStats(
  uid: string,
  onChange: (weeks: WeekStatsMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'health', 'weeks'),
    (snapshot) => onChange((snapshot.data()?.weeks as WeekStatsMap) ?? {}),
    onError,
  );
}

/**
 * Simpan total langkah tiap minggu dari riwayat harian — dipanggil saat tab
 * Steps dibuka. Hanya menulis kalau ada angka yang berubah (hemat tulis).
 */
export function recordStepWeeks(
  uid: string,
  days: StepDaysMap,
  saved: WeekStatsMap,
) {
  const totals = new Map<string, number>();
  for (const [dayId, steps] of Object.entries(days)) {
    const wk = weekStartId(dayIdToDateLocal(dayId));
    totals.set(wk, (totals.get(wk) ?? 0) + steps);
  }
  const patch: Record<string, { steps: number }> = {};
  for (const [wk, steps] of totals) {
    if ((saved[wk]?.steps ?? 0) !== steps) patch[wk] = { steps };
  }
  if (Object.keys(patch).length === 0) return Promise.resolve();
  return setDoc(
    doc(db, 'users', uid, 'health', 'weeks'),
    { weeks: patch },
    { merge: true },
  );
}

/** Tambah 1 hari strength training pada minggu yang memuat `d`. */
export function bumpWeekGym(uid: string, d: Date) {
  return setDoc(
    doc(db, 'users', uid, 'health', 'weeks'),
    { weeks: { [weekStartId(d)]: { gym: increment(1) } } },
    { merge: true },
  );
}

/**
 * Rekap pencapaian mingguan untuk fitur Achievement:
 * - stepHits  : berapa minggu langkahnya ≥ WEEK_STEP_GOAL
 * - gymHits   : berapa minggu strength training ≥ WEEK_GYM_GOAL
 * - bothHits  : berapa minggu KEDUANYA tercapai (minggu sempurna)
 */
export function weekGoalStats(weeks: WeekStatsMap): {
  stepHits: number;
  gymHits: number;
  bothHits: number;
} {
  let stepHits = 0;
  let gymHits = 0;
  let bothHits = 0;
  for (const w of Object.values(weeks)) {
    const step = (w.steps ?? 0) >= WEEK_STEP_GOAL;
    const gym = (w.gym ?? 0) >= WEEK_GYM_GOAL;
    if (step) stepHits += 1;
    if (gym) gymHits += 1;
    if (step && gym) bothHits += 1;
  }
  return { stepHits, gymHits, bothHits };
}
