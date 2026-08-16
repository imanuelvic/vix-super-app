import {
  doc,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { type LoginStreak as DayStreak } from './achievements';
import { hashString, weekIndex } from './core';
import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { formatDecimal } from './format';
import {
  bmiCategory,
  bmiValue,
  dayDocId,
  idealWeightRange,
  type HealthProfile,
  type WeightTarget,
} from './health';
import { alreadyCounted, nextStreak } from './streak';

// Fitness 💪 — program STRENGTH 5 hari/minggu untuk menaikkan massa otot,
// dengan fokus tambahan di perut (target sixpack). Senin/Selasa/Kamis/Jumat/
// Sabtu latihan, Rabu & Minggu istirahat. Jadwal latihan jam 17.00 (±40 menit
// termasuk pemanasan) sesudah jam kantor.
//
// Anti-bosan: program dibagi DUA BLOK (A & B) yang melatih otot sama tapi
// gerakannya beda. Blok berganti tiap 2 minggu → variasi cukup, progressive
// overload tetap terukur.
//
// Catatan: ini panduan latihan umum, bukan nasihat medis. Kalau ada keluhan
// sendi/jantung atau cedera, konsultasi ke dokter atau pelatih dulu.

export type FitBlock = 'A' | 'B';

export type Exercise = {
  id: string; // stabil — kunci untuk beban tersimpan & centang harian
  emoji: string;
  name: string;
  sets: number;
  reps: string; // "12", "10 / lengan", "40 detik"
  weight: number | null; // saran beban awal (kg); null = berat badan / tanpa beban
  video?: string; // tautan YouTube demo gerakan
  core?: boolean; // gerakan inti perut (dihitung untuk target sixpack)
};

export type FitSession = {
  weekday: number; // 1=Senin … 6=Sabtu
  emoji: string;
  title: string;
  focus: string; // otot yang dilatih
  exercises: Exercise[];
};

// ===================== BLOK A — program dasar =====================
// Diambil dari program yang sudah kamu jalani, dengan volume perut dinaikkan.

const BLOCK_A: FitSession[] = [
  {
    weekday: 1,
    emoji: '🔙',
    title: 'Back Day',
    focus: 'Punggung, lats & perut bawah',
    exercises: [
      { id: 'pullup', emoji: '💪', name: 'Pull-Ups', sets: 3, reps: '7', weight: null, video: 'https://youtu.be/eGo4IYlbE5g' },
      { id: 'latpulldown', emoji: '🏋️', name: 'Cable Lat Pulldown', sets: 3, reps: '12', weight: 8, video: 'https://youtu.be/CAwf7n6Luuc' },
      { id: 'dbrow', emoji: '🔥', name: 'Single Arm Dumbbell Row', sets: 3, reps: '12 / lengan', weight: 8, video: 'https://youtu.be/6KNmHxw-SpE' },
      { id: 'kneeraise', emoji: '😥', name: 'Knee Raise', sets: 3, reps: '12', weight: null, video: 'https://youtu.be/711U6NbJRmc', core: true },
      { id: 'deadbug', emoji: '⚡', name: 'Dead Bug Dumbbell', sets: 3, reps: '15', weight: 2, core: true },
    ],
  },
  {
    weekday: 2,
    emoji: '💥',
    title: 'Chest & Triceps',
    focus: 'Dada, trisep & perut samping',
    exercises: [
      { id: 'dips', emoji: '💪', name: 'Dips', sets: 3, reps: '10', weight: null, video: 'https://youtu.be/yN6Q1UI_xkE' },
      { id: 'machinefly', emoji: '🏋️', name: 'Machine Fly', sets: 3, reps: '10', weight: 8, video: 'https://youtu.be/bonJdLvpS2w' },
      { id: 'tricepskickback', emoji: '🔥', name: 'Triceps Cable Kickbacks', sets: 3, reps: '10', weight: 3, video: 'https://youtu.be/plk7NhrhzIE' },
      { id: 'abtwist', emoji: '💥', name: 'Abdominal Twist', sets: 3, reps: '20', weight: 4, video: 'https://youtu.be/LlccOWys8IU', core: true },
      { id: 'crunches', emoji: '🚀', name: 'Crunches', sets: 3, reps: '15', weight: null, video: 'https://youtu.be/5ER5Of4MOPI', core: true },
    ],
  },
  {
    weekday: 4,
    emoji: '🦵',
    title: 'Leg Day',
    focus: 'Paha, hamstring & perut',
    exercises: [
      { id: 'rdl', emoji: '🏋️', name: 'Dumbbell Romanian Deadlift', sets: 3, reps: '12', weight: 12, video: 'https://youtu.be/eDFAAb6vJH4' },
      { id: 'legpress', emoji: '🦵', name: 'Seated Leg Press', sets: 3, reps: '12', weight: 13, video: 'https://youtu.be/IZxyjW7MPJQ' },
      { id: 'hamcurl', emoji: '⚡', name: 'Hamstring Curl', sets: 3, reps: '12', weight: 3, video: 'https://youtu.be/NIZeAGZ_YJw' },
      { id: 'obliqueraise', emoji: '🔥', name: 'Oblique Leg Raises', sets: 3, reps: '12', weight: null, video: 'https://youtu.be/2RTwJj_CynA', core: true },
      { id: 'mountainclimber', emoji: '😥', name: 'Mountain Climbers', sets: 3, reps: '40 detik', weight: null, video: 'https://youtu.be/cOsaztSz9N4', core: true },
    ],
  },
  {
    weekday: 5,
    emoji: '🏋️',
    title: 'Shoulder & Biceps',
    focus: 'Bahu, bisep & perut',
    exercises: [
      { id: 'shoulderpress', emoji: '🔥', name: 'Dumbbell Shoulder Press', sets: 3, reps: '12', weight: 14, video: 'https://youtu.be/qEwKCR5JCog' },
      { id: 'preachercurl', emoji: '💪', name: 'Incline Bench Preacher Curls', sets: 3, reps: '12', weight: 12, video: 'https://youtu.be/7v7uldi1eLU' },
      { id: 'wristcurl', emoji: '⚡', name: 'Wrist Curls with Dumbbells', sets: 3, reps: '12', weight: 8, video: 'https://youtu.be/NoO4ol8Zw2I' },
      { id: 'bicyclecrunch', emoji: '🚴', name: 'Bicycle Crunches', sets: 3, reps: '40 detik', weight: null, video: 'https://youtu.be/lv6BT8_5iIs', core: true },
      { id: 'hangkneeraise', emoji: '😥', name: 'Hanging Knee Raise', sets: 3, reps: '12', weight: null, video: 'https://youtu.be/Pr1ieGZ5atk', core: true },
    ],
  },
  {
    weekday: 6,
    emoji: '💆',
    title: 'Neck, Traps & Core',
    focus: 'Leher, trapezius & seluruh perut',
    exercises: [
      { id: 'neckflex', emoji: '😌', name: 'Neck Flexion & Extension', sets: 3, reps: '10 / arah', weight: null },
      { id: 'shrugs', emoji: '🏋️', name: 'Dumbbell Shrugs', sets: 3, reps: '12', weight: 10, video: 'https://youtu.be/jTVbilkxSAk' },
      { id: 'plankwalkout', emoji: '🚀', name: 'Plank Walkouts', sets: 3, reps: '40 detik', weight: null, core: true },
      { id: 'russiantwist', emoji: '💥', name: 'Russian Twists', sets: 3, reps: '20', weight: 4, video: 'https://youtu.be/DJQGX2J4IVw', core: true },
      { id: 'plank', emoji: '🧘', name: 'Plank', sets: 3, reps: '45 detik', weight: null, video: 'https://youtu.be/Fcbw82ykBvY', core: true },
    ],
  },
];

// ===================== BLOK B — variasi (otot sama, gerakan beda) =====================

const BLOCK_B: FitSession[] = [
  {
    weekday: 1,
    emoji: '🔙',
    title: 'Back Day',
    focus: 'Punggung, lats & perut bawah',
    exercises: [
      { id: 'chinup', emoji: '💪', name: 'Chin-Ups (telapak menghadap badan)', sets: 3, reps: '8', weight: null },
      { id: 'seatedrow', emoji: '🏋️', name: 'Seated Cable Row', sets: 3, reps: '12', weight: 15 },
      { id: 'pullover', emoji: '🔥', name: 'Dumbbell Pullover', sets: 3, reps: '12', weight: 10 },
      { id: 'cablecrunch', emoji: '😥', name: 'Cable Crunch', sets: 3, reps: '15', weight: 10, core: true },
      { id: 'legraise', emoji: '⚡', name: 'Leg Raises (lantai)', sets: 3, reps: '15', weight: null, video: 'https://youtu.be/dGKbTKLnym4', core: true },
    ],
  },
  {
    weekday: 2,
    emoji: '💥',
    title: 'Chest & Triceps',
    focus: 'Dada, trisep & perut samping',
    exercises: [
      { id: 'dbbench', emoji: '💪', name: 'Dumbbell Bench Press', sets: 3, reps: '10', weight: 12 },
      { id: 'inclinepress', emoji: '🏋️', name: 'Incline Dumbbell Press', sets: 3, reps: '10', weight: 10 },
      { id: 'overheadext', emoji: '🔥', name: 'Overhead Triceps Extension', sets: 3, reps: '12', weight: 8 },
      { id: 'reversecrunch', emoji: '💥', name: 'Reverse Crunches', sets: 3, reps: '15', weight: null, video: 'https://youtu.be/UwRfRN5fYRg', core: true },
      { id: 'sidecrunch', emoji: '🚀', name: 'Side Crunch', sets: 3, reps: '15 / sisi', weight: null, video: 'https://youtu.be/w0OWFjfI3zM', core: true },
    ],
  },
  {
    weekday: 4,
    emoji: '🦵',
    title: 'Leg Day',
    focus: 'Paha, hamstring & perut',
    exercises: [
      { id: 'gobletsquat', emoji: '🦵', name: 'Goblet Squat', sets: 3, reps: '12', weight: 14, video: 'https://youtu.be/42bFodPahBU' },
      { id: 'lunges', emoji: '🏋️', name: 'Walking Lunges', sets: 3, reps: '10 / kaki', weight: 8, video: 'https://youtu.be/1J8mVmtyYpk' },
      { id: 'calfraise', emoji: '⚡', name: 'Calf Raises', sets: 3, reps: '15', weight: 10, video: 'https://youtu.be/GQa_N7wft7M' },
      { id: 'flutterkick', emoji: '🔥', name: 'Flutter Kicks', sets: 3, reps: '40 detik', weight: null, core: true },
      { id: 'plankjacks', emoji: '😥', name: 'Plank Jacks', sets: 3, reps: '40 detik', weight: null, video: 'https://youtu.be/9A7ZAXxMV0Q', core: true },
    ],
  },
  {
    weekday: 5,
    emoji: '🏋️',
    title: 'Shoulder & Biceps',
    focus: 'Bahu, bisep & perut',
    exercises: [
      { id: 'arnoldpress', emoji: '🔥', name: 'Arnold Press', sets: 3, reps: '10', weight: 10 },
      { id: 'lateralraise', emoji: '🏋️', name: 'Lateral Raises', sets: 3, reps: '15', weight: 5 },
      { id: 'hammercurl', emoji: '💪', name: 'Hammer Curls', sets: 3, reps: '12', weight: 10, video: 'https://youtu.be/L1bDrPlfu1Q' },
      { id: 'vup', emoji: '💥', name: 'V-Ups', sets: 3, reps: '12', weight: null, core: true },
      { id: 'sideplank', emoji: '🧘', name: 'Side Plank', sets: 3, reps: '40 detik / sisi', weight: null, core: true },
    ],
  },
  {
    weekday: 6,
    emoji: '💆',
    title: 'Neck, Traps & Core',
    focus: 'Leher, trapezius & seluruh perut',
    exercises: [
      { id: 'necksideflex', emoji: '😌', name: 'Neck Side Flexion', sets: 3, reps: '10 / sisi', weight: null },
      { id: 'barbellshrug', emoji: '🏋️', name: 'Barbell Shrugs', sets: 3, reps: '12', weight: 20 },
      { id: 'facepull', emoji: '🔥', name: 'Face Pull', sets: 3, reps: '15', weight: 10 },
      { id: 'abwheel', emoji: '🚀', name: 'Ab Wheel Rollout', sets: 3, reps: '10', weight: null, core: true },
      { id: 'hollowhold', emoji: '🧘', name: 'Hollow Body Hold', sets: 3, reps: '40 detik', weight: null, core: true },
    ],
  },
];

export const FIT_PROGRAM: Record<FitBlock, FitSession[]> = {
  A: BLOCK_A,
  B: BLOCK_B,
};

// Latihan jam 17.00; kartu reminder Dashboard tampil 16.00–20.59.
export const FIT_HOUR_LABEL = '17.00';
const FIT_FROM_HOUR = 16;
const FIT_TO_HOUR = 21;

/** Nama hari pendek untuk deretan hari (indeks = getDay(), 0 = Minggu). */
export const FIT_DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Blok yang berlaku pada tanggal ini — berganti tiap 2 minggu (A→B→A…). */
export function fitBlockOf(d: Date): FitBlock {
  return Math.floor(weekIndex(d) / 2) % 2 === 0 ? 'A' : 'B';
}

/** Sesi latihan untuk hari ini — null berarti hari istirahat (Rabu & Minggu). */
export function fitSessionFor(d: Date): FitSession | null {
  return FIT_PROGRAM[fitBlockOf(d)].find((s) => s.weekday === d.getDay()) ?? null;
}

/** Sesi hari tertentu dalam minggu yang sama (untuk deretan hari di layar). */
export function fitSessionOfWeekday(
  weekday: number,
  block: FitBlock,
): FitSession | null {
  return FIT_PROGRAM[block].find((s) => s.weekday === weekday) ?? null;
}

function isFitRestDay(d: Date): boolean {
  return fitSessionFor(d) === null;
}

/** Perkiraan durasi sesi: 10 menit pemanasan + ±6 menit per gerakan. */
export function fitSessionMinutes(session: FitSession): number {
  return 10 + session.exercises.length * 6;
}

/**
 * Kartu Gym Day / Rest Day tampil di Dashboard: hanya jam 16.00–20.59, biar
 * tidak meramaikan Dashboard sepanjang hari.
 */
export function fitReminderWindow(now: Date): boolean {
  const h = now.getHours();
  return h >= FIT_FROM_HOUR && h < FIT_TO_HOUR;
}

// ===================== Kata-kata semangat 🔥 =====================
// Acak tapi deterministik per hari — sama sepanjang hari, ganti tiap hari.

const FIT_QUOTES: string[] = [
  '🔥 Otot tidak tumbuh saat nyaman. Satu set lagi.',
  '💪 Tubuh umur 60-mu dibentuk dari keputusan hari ini.',
  '🏋️ Berat yang sama terasa ringan? Berarti waktunya naik beban.',
  '🧠 Konsisten 5 hari biasa mengalahkan 1 hari luar biasa.',
  '⏱️ 40 menit hari ini, atau penyesalan seharian. Pilih.',
  '🎯 Sixpack dibuat di dapur, dipahat di gym. Dua-duanya jalan.',
  '😤 Yang bikin capek itu mikirnya. Berangkat dulu, sisanya ngalir.',
  '📈 Naik 1 kg beban tiap 2 minggu = 26 kg setahun. Sabar itu strategi.',
  '🚫 Skip sekali jadi kebiasaan. Hari ini jangan.',
  '🥇 Kamu tidak bersaing dengan siapa pun kecuali dirimu kemarin.',
  '🍚 Latihan keras tanpa makan cukup = jalan di tempat. Isi proteinnya.',
  '😴 Otot tumbuh saat tidur. Latihan keras, istirahat serius.',
  '🪞 Perubahan tidak kelihatan tiap hari, tapi kelihatan tiap bulan.',
  '⚡ Mood tidak menentukan jadwal. Jadwal menentukan mood.',
];

export function fitQuote(dayId: string): string {
  return FIT_QUOTES[hashString(dayId + 'fitness') % FIT_QUOTES.length];
}

// ===================== Target & persiapan 🎯 =====================

/**
 * Target latihan — angkanya DIHITUNG dari Data Tubuh & Target Berat di fitur
 * Health, bukan ditulis ulang di sini. Ubah berat/lingkar perut/target di
 * Health → Summary & Habits, angka di sini ikut berubah sendiri.
 */
export function fitTargets(
  profile: HealthProfile,
  target: WeightTarget | null,
): { icon: string; label: string; desc: string }[] {
  const w = profile.weightKg;
  // Protein untuk membangun otot: 1,6–2 g per kg berat badan.
  const proteinMin = Math.round(w * 1.6);
  const proteinMax = Math.round(w * 2);
  // Lingkar perut sehat = di bawah setengah tinggi badan (rasio < 0,5).
  const waistGoal = profile.heightCm / 2;
  const waist = profile.waistCm;
  const bmi = bmiValue(w, profile.heightCm);

  // Berat: pakai target dari Health kalau sudah dipasang.
  const gap = target ? w - target.targetWeightKg : 0;
  const weeks = Math.max(1, Math.ceil(Math.abs(gap) / 0.4));
  const weightLabel = target
    ? `Berat ${formatDecimal(w)} → ${formatDecimal(target.targetWeightKg)} kg`
    : `Berat sekarang ${formatDecimal(w)} kg`;
  const weightDesc = !target
    ? 'Belum ada target berat. Pasang dulu di Health → Habits → 🎯 Target.'
    : Math.abs(gap) < 0.1
      ? 'Target berat sudah tercapai 🎉 Sekarang fokus jaga & tambah otot.'
      : `Sisa ${formatDecimal(Math.abs(gap))} kg · aman ±0,4 kg/minggu ≈ ${weeks} minggu. Lebih cepat dari itu, otot ikut hilang.`;

  return [
    { icon: '🏋️', label: '5 sesi per minggu', desc: 'Senin, Selasa, Kamis, Jumat, Sabtu — minimal 30 menit, ideal ±40 menit.' },
    { icon: '📈', label: 'Naik beban tiap 2 minggu', desc: 'Kalau set terakhir masih terasa ringan, tambah 1–2 kg saat blok berganti.' },
    { icon: '⚖️', label: weightLabel, desc: weightDesc },
    {
      icon: '📊',
      label: `BMI ${formatDecimal(bmi)} → di bawah 23`,
      desc: `${bmiCategory(bmi).label} (ambang Asia-Pasifik). Sehat untuk tinggi ${profile.heightCm} cm: ${formatDecimal(idealWeightRange(profile.heightCm).min)}–${formatDecimal(idealWeightRange(profile.heightCm).max)} kg.`,
    },
    {
      icon: '🔥',
      label: waist
        ? `Sixpack: perut ${formatDecimal(waist)} → di bawah ${formatDecimal(waistGoal)} cm`
        : `Sixpack: perut di bawah ${formatDecimal(waistGoal)} cm`,
      desc: waist
        ? waist < waistGoal
          ? 'Sudah di bawah ambang — perut mulai kelihatan. Pertahankan 💪'
          : `Sisa ${formatDecimal(waist - waistGoal)} cm. Perut sudah dilatih tiap sesi; yang bikin kelihatan adalah defisit kalori.`
        : 'Isi lingkar perut di Health → Summary → Data Tubuh biar bisa dilacak.',
    },
    {
      icon: '🥩',
      label: `Protein ${proteinMin}–${proteinMax} g/hari`,
      desc: `1,6–2 g per kg berat badanmu (${formatDecimal(w)} kg). Telur, ayam, ikan, tempe, whey.`,
    },
    { icon: '😴', label: 'Tidur 7–8 jam', desc: 'Otot tumbuh saat tidur, bukan saat latihan. Ini bagian dari program.' },
    { icon: '🚶', label: '8.000+ langkah/hari', desc: 'Aktivitas di luar gym yang paling besar efeknya untuk membakar lemak.' },
  ];
}

export const FIT_PREP: string[] = [
  '👕 Baju ganti & sepatu olahraga sudah di tas sejak pagi',
  '🍌 Makan ringan 45 menit sebelum: pisang / roti / oat',
  '💧 Botol air minimal 600 ml',
  '🧤 Sarung tangan atau strap (bantu pull-up & shrug)',
  '🎧 Earphone + playlist yang bikin semangat',
  '📱 Buka app ini, centang tiap gerakan selesai',
  '🥛 Protein dalam 1–2 jam setelah latihan',
];

export const FIT_RECOVERY: string[] = [
  '😴 Tidur 7–8 jam — ini saat otot benar-benar dibangun',
  '🧘 Stretching ringan 10 menit biar tidak kaku',
  '🚶 Jalan santai 20–30 menit, jangan diam total',
  '🥩 Protein tetap jalan walau tidak latihan',
];

// ===================== Firestore =====================
// Beban aktual per gerakan: SATU dokumen kecil users/{uid}/fitness/weights.
// Centang harian: users/{uid}/fitnessDays/{YYYY-MM-DD} → { done: {id: true} }.

export type FitWeights = Record<string, number>;

export function subscribeFitWeights(
  uid: string,
  onChange: (weights: FitWeights) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'fitness', 'weights'),
    (snapshot) => onChange((snapshot.data()?.map as FitWeights) ?? {}),
    onError,
  );
}

/** Simpan beban satu gerakan — merge, gerakan lain tidak tersentuh. */
export function saveFitWeight(uid: string, exerciseId: string, kg: number) {
  return setDoc(
    doc(db, 'users', uid, 'fitness', 'weights'),
    { map: { [exerciseId]: kg } },
    { merge: true },
  );
}

/** Beban yang dipakai: hasil simpananmu, kalau belum ada pakai saran program. */
export function weightOf(ex: Exercise, weights: FitWeights): number | null {
  const saved = weights[ex.id];
  return saved ?? ex.weight;
}

export type FitDayDone = Record<string, boolean>;

export function subscribeFitDay(
  uid: string,
  dayId: string,
  onChange: (done: FitDayDone) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'fitnessDays', dayId),
    (snapshot) => onChange((snapshot.data()?.done as FitDayDone) ?? {}),
    onError,
  );
}

export function setFitExerciseDone(
  uid: string,
  dayId: string,
  exerciseId: string,
  done: boolean,
) {
  return setDoc(
    doc(db, 'users', uid, 'fitnessDays', dayId),
    { done: { [exerciseId]: done }, date: Timestamp.fromDate(new Date()) },
    { merge: true },
  );
}

// ===================== Streak sesi 🔥 =====================
// users/{uid}/app/fitnessStreak — bentuknya sama dengan streak lain.
// Rentetan dihitung antar HARI LATIHAN: Rabu & Minggu istirahat tidak
// memutuskan streak (Selasa → Kamis tetap nyambung).

export function subscribeFitStreak(
  uid: string,
  onChange: (streak: DayStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'app', 'fitnessStreak'),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as DayStreak) : null),
    onError,
  );
}

/** dayId hari LATIHAN terakhir sebelum `d` (lewati Rabu & Minggu). */
function prevWorkoutDayId(d: Date): string {
  const p = new Date(d);
  for (let i = 0; i < 7; i++) {
    p.setDate(p.getDate() - 1);
    if (!isFitRestDay(p)) return dayDocId(p);
  }
  return '';
}

/** Panggil saat SEMUA gerakan hari ini selesai — naik maksimal 1×/hari. */
export function bumpFitStreak(uid: string, current: DayStreak | null, d: Date) {
  const todayId = dayDocId(d);
  if (alreadyCounted(current, todayId)) return Promise.resolve();
  return setDoc(
    doc(db, 'users', uid, 'app', 'fitnessStreak'),
    nextStreak(current, todayId, prevWorkoutDayId(d)),
  );
}
