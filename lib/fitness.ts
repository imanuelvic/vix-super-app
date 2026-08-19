import {
  doc,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { type LoginStreak as DayStreak } from './achievements';
import { pickOfDay, weekIndex } from './core';
import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { formatDecimal } from './format';
import { FITNESS_HABIT_ID } from './habits';
import {
  bmiCategory,
  bmiValue,
  dayDocId,
  idealWeightRange,
  setHabitDone,
  setHabitSkipped,
  type HealthProfile,
  type WeightTarget,
} from './health';
import { alreadyCounted, EMPTY_DAY_STREAK, nextStreak } from './streak';

// Fitness 💪 — program LEAN-ATLETIS: menaikkan otot dada, lengan & perut
// sambil menjaga lemak tetap rendah, supaya proporsinya bagus (bukan besar
// tapi tenggelam). Angkat beban membangun ototnya, lari membakar lapisan yang
// menutupinya — dua-duanya harus jalan, itu sebabnya digabung dalam satu
// jadwal, bukan dipilih salah satu.
//
// SEMINGGU (3 beban · 2 lari · 2 jalan):
//   Sen  💪 Dada, Bahu & Trisep   + perut
//   Sel  🏃 Lari santai            + core
//   Rab  🚶 Jalan pagi             (pemulihan)
//   Kam  💪 Punggung & Bisep       + perut
//   Jum  ⚡ Lari cepat (interval)  + core
//   Sab  💪 Kaki & Full-Body       + perut
//   Min  🚶 Jalan pagi santai
//
// JAMNYA BEBAS — pagi atau sore, mana yang sempat. Pengingatnya muncul di dua
// jendela (05.00–09.00 & 16.00–21.00), tidak lagi dipatok jam 17.00.
//
// Anti-bosan: program dibagi DUA BLOK (A & B) yang melatih otot sama tapi
// gerakannya beda. Blok berganti tiap 2 minggu → variasi cukup, progressive
// overload tetap terukur.
//
// Catatan: ini panduan latihan umum, bukan nasihat medis. Kalau ada keluhan
// sendi/jantung atau cedera, konsultasi ke dokter atau pelatih dulu.

export type FitBlock = 'A' | 'B';

/**
 * Jenis sesi — menentukan perlakuan rentetan 🔥:
 * - `strength` & `run` = hari INTI. Selesai → streak naik; bolos → streak putus.
 * - `walk`             = pemulihan. Boleh dicentang (bonus), tapi tidak pernah
 *                        menaikkan maupun memutus streak.
 */
export type FitKind = 'strength' | 'run' | 'walk';

export type Exercise = {
  id: string; // stabil — kunci untuk beban tersimpan & centang harian
  emoji: string;
  name: string;
  sets: number;
  reps: string; // "12", "10 / lengan", "40 detik", "30 menit"
  weight: number | null; // saran beban awal (kg); null = berat badan / tanpa beban
  video?: string; // tautan YouTube demo gerakan
  core?: boolean; // gerakan inti perut (dihitung untuk target sixpack)
  cardio?: boolean; // lari/jalan — tidak punya beban, jadi chip kg disembunyikan
};

export type FitSession = {
  weekday: number; // 0=Minggu … 6=Sabtu
  kind: FitKind;
  emoji: string;
  title: string;
  focus: string; // otot / tujuan sesi
  minutes: number; // perkiraan durasi termasuk pemanasan
  exercises: Exercise[];
};

// ===================== Hari jalan pagi 🚶 (Rabu & Minggu) =====================
// Sama di kedua blok: hari pemulihan tidak perlu divariasikan, justru harus
// gampang ditebak supaya benar-benar dijalani.

const WALK_WED: FitSession = {
  weekday: 3,
  kind: 'walk',
  emoji: '🚶',
  title: 'Jalan Pagi Pemulihan',
  focus: 'Melancarkan peredaran darah di tengah minggu',
  minutes: 40,
  exercises: [
    { id: 'morningwalk', emoji: '🚶', name: 'Jalan pagi santai', sets: 1, reps: '30 menit', weight: null, cardio: true },
    { id: 'stretching', emoji: '🧘', name: 'Stretching seluruh badan', sets: 1, reps: '10 menit', weight: null, cardio: true },
  ],
};

const WALK_SUN: FitSession = {
  weekday: 0,
  kind: 'walk',
  emoji: '🚶',
  title: 'Jalan Pagi Santai',
  focus: 'Menutup pekan tanpa membebani sendi',
  minutes: 40,
  exercises: [
    { id: 'morningwalk', emoji: '🚶', name: 'Jalan pagi santai', sets: 1, reps: '30 menit', weight: null, cardio: true },
    { id: 'mobility', emoji: '🧘', name: 'Mobility bahu & pinggul', sets: 1, reps: '10 menit', weight: null, cardio: true },
  ],
};

// ===================== BLOK A =====================

const BLOCK_A: FitSession[] = [
  {
    weekday: 1,
    kind: 'strength',
    emoji: '💥',
    title: 'Dada, Bahu & Trisep',
    focus: 'Dada tengah & atas, bahu samping, trisep, perut',
    minutes: 50,
    exercises: [
      { id: 'flatbench', emoji: '🏋️', name: 'Flat Bench Press', sets: 4, reps: '8–12', weight: 20 },
      { id: 'inclinepress', emoji: '💪', name: 'Incline Dumbbell Press', sets: 3, reps: '10–12', weight: 10 },
      { id: 'machinefly', emoji: '🔥', name: 'Machine Fly', sets: 3, reps: '12–15', weight: 8, video: 'https://youtu.be/bonJdLvpS2w' },
      { id: 'shoulderpress', emoji: '⚡', name: 'Dumbbell Shoulder Press', sets: 3, reps: '10–12', weight: 14, video: 'https://youtu.be/qEwKCR5JCog' },
      { id: 'lateralraise', emoji: '🏋️', name: 'Lateral Raises', sets: 3, reps: '12–15', weight: 5 },
      { id: 'triceppushdown', emoji: '💥', name: 'Tricep Pushdown', sets: 3, reps: '12–15', weight: 10 },
      { id: 'crunches', emoji: '🚀', name: 'Crunches', sets: 3, reps: '20', weight: null, video: 'https://youtu.be/5ER5Of4MOPI', core: true },
    ],
  },
  {
    weekday: 2,
    kind: 'run',
    emoji: '🏃',
    title: 'Lari Santai + Core',
    focus: 'Daya tahan dasar & pembakaran lemak, ditutup perut',
    minutes: 45,
    exercises: [
      { id: 'warmupwalk', emoji: '🚶', name: 'Jalan cepat pemanasan', sets: 1, reps: '5 menit', weight: null, cardio: true },
      { id: 'easyrun', emoji: '🏃', name: 'Lari santai — masih sanggup ngobrol', sets: 1, reps: '30 menit', weight: null, cardio: true },
      { id: 'plank', emoji: '🧘', name: 'Plank', sets: 3, reps: '45 detik', weight: null, video: 'https://youtu.be/Fcbw82ykBvY', core: true },
      { id: 'bicyclecrunch', emoji: '🚴', name: 'Bicycle Crunches', sets: 3, reps: '40 detik', weight: null, video: 'https://youtu.be/lv6BT8_5iIs', core: true },
      { id: 'legraise', emoji: '⚡', name: 'Leg Raises', sets: 3, reps: '15', weight: null, video: 'https://youtu.be/dGKbTKLnym4', core: true },
    ],
  },
  WALK_WED,
  {
    weekday: 4,
    kind: 'strength',
    emoji: '🔙',
    title: 'Punggung & Bisep',
    focus: 'Lats (pelebar punggung), bisep, perut bawah',
    minutes: 50,
    exercises: [
      { id: 'pullup', emoji: '💪', name: 'Pull-Ups', sets: 3, reps: '6–10', weight: null, video: 'https://youtu.be/eGo4IYlbE5g' },
      { id: 'latpulldown', emoji: '🏋️', name: 'Cable Lat Pulldown', sets: 4, reps: '8–12', weight: 8, video: 'https://youtu.be/CAwf7n6Luuc' },
      { id: 'seatedrow', emoji: '🔥', name: 'Seated Cable Row', sets: 3, reps: '10–12', weight: 15 },
      { id: 'dbrow', emoji: '⚡', name: 'Single-Arm Dumbbell Row', sets: 3, reps: '12 / lengan', weight: 8, video: 'https://youtu.be/6KNmHxw-SpE' },
      { id: 'facepull', emoji: '💥', name: 'Face Pulls', sets: 3, reps: '15', weight: 10 },
      { id: 'barbellcurl', emoji: '💪', name: 'Barbell Curl', sets: 3, reps: '10–12', weight: 15 },
      { id: 'hangkneeraise', emoji: '😥', name: 'Hanging Knee Raise', sets: 3, reps: '12–15', weight: null, video: 'https://youtu.be/Pr1ieGZ5atk', core: true },
    ],
  },
  {
    weekday: 5,
    kind: 'run',
    emoji: '⚡',
    title: 'Lari Cepat (Interval) + Core',
    focus: 'Pembakaran lemak paling efisien & napas lebih kuat',
    minutes: 40,
    exercises: [
      { id: 'warmupjog', emoji: '🚶', name: 'Jogging pemanasan', sets: 1, reps: '8 menit', weight: null, cardio: true },
      { id: 'intervalrun', emoji: '⚡', name: 'Interval 8× (1 mnt cepat / 2 mnt jalan)', sets: 1, reps: '24 menit', weight: null, cardio: true },
      { id: 'cooldownwalk', emoji: '🚶', name: 'Jalan pendinginan', sets: 1, reps: '5 menit', weight: null, cardio: true },
      { id: 'russiantwist', emoji: '💥', name: 'Russian Twists', sets: 3, reps: '20', weight: 4, video: 'https://youtu.be/DJQGX2J4IVw', core: true },
      { id: 'hollowhold', emoji: '🧘', name: 'Hollow Body Hold', sets: 3, reps: '40 detik', weight: null, core: true },
    ],
  },
  {
    weekday: 6,
    kind: 'strength',
    emoji: '🦵',
    title: 'Kaki & Full-Body',
    focus: 'Paha, betis, plus lengan & perut penutup pekan',
    minutes: 50,
    exercises: [
      { id: 'gobletsquat', emoji: '🦵', name: 'Goblet Squat', sets: 4, reps: '12', weight: 14, video: 'https://youtu.be/42bFodPahBU' },
      { id: 'rdl', emoji: '🏋️', name: 'Romanian Deadlift', sets: 3, reps: '10–12', weight: 12, video: 'https://youtu.be/eDFAAb6vJH4' },
      { id: 'legpress', emoji: '💪', name: 'Leg Press', sets: 3, reps: '12–15', weight: 13, video: 'https://youtu.be/IZxyjW7MPJQ' },
      { id: 'lunges', emoji: '🔥', name: 'Walking Lunges', sets: 3, reps: '10 / kaki', weight: 8, video: 'https://youtu.be/1J8mVmtyYpk' },
      { id: 'calfraise', emoji: '⚡', name: 'Calf Raises', sets: 3, reps: '15–20', weight: 10, video: 'https://youtu.be/GQa_N7wft7M' },
      { id: 'hammercurl', emoji: '💥', name: 'Hammer Curls', sets: 3, reps: '12', weight: 10, video: 'https://youtu.be/L1bDrPlfu1Q' },
      { id: 'plankwalkout', emoji: '🚀', name: 'Plank Walkouts', sets: 3, reps: '40 detik', weight: null, core: true },
    ],
  },
  WALK_SUN,
];

// ===================== BLOK B — otot sama, gerakan beda =====================

const BLOCK_B: FitSession[] = [
  {
    weekday: 1,
    kind: 'strength',
    emoji: '💥',
    title: 'Dada, Bahu & Trisep',
    focus: 'Dada tengah & atas, bahu samping, trisep, perut',
    minutes: 50,
    exercises: [
      { id: 'dbbench', emoji: '💪', name: 'Dumbbell Bench Press', sets: 4, reps: '10–12', weight: 12 },
      { id: 'inclinebarbell', emoji: '🏋️', name: 'Incline Barbell Press', sets: 3, reps: '8–10', weight: 18 },
      { id: 'cablefly', emoji: '🔥', name: 'Cable Crossover', sets: 3, reps: '12–15', weight: 6 },
      { id: 'arnoldpress', emoji: '⚡', name: 'Arnold Press', sets: 3, reps: '10', weight: 10 },
      { id: 'cablelateral', emoji: '🏋️', name: 'Cable Lateral Raise', sets: 3, reps: '15', weight: 4 },
      { id: 'overheadext', emoji: '💥', name: 'Overhead Triceps Extension', sets: 3, reps: '10–12', weight: 8 },
      { id: 'cablecrunch', emoji: '😥', name: 'Cable Crunch', sets: 3, reps: '15', weight: 10, core: true },
    ],
  },
  {
    weekday: 2,
    kind: 'run',
    emoji: '🏃',
    title: 'Lari Santai + Core',
    focus: 'Daya tahan dasar & pembakaran lemak, ditutup perut',
    minutes: 50,
    exercises: [
      { id: 'warmupwalk', emoji: '🚶', name: 'Jalan cepat pemanasan', sets: 1, reps: '5 menit', weight: null, cardio: true },
      { id: 'easyrun', emoji: '🏃', name: 'Lari santai — masih sanggup ngobrol', sets: 1, reps: '35 menit', weight: null, cardio: true },
      { id: 'sideplank', emoji: '🧘', name: 'Side Plank', sets: 3, reps: '40 detik / sisi', weight: null, core: true },
      { id: 'deadbug', emoji: '⚡', name: 'Dead Bug Dumbbell', sets: 3, reps: '15', weight: 2, core: true },
      { id: 'flutterkick', emoji: '🔥', name: 'Flutter Kicks', sets: 3, reps: '40 detik', weight: null, core: true },
    ],
  },
  WALK_WED,
  {
    weekday: 4,
    kind: 'strength',
    emoji: '🔙',
    title: 'Punggung & Bisep',
    focus: 'Lats (pelebar punggung), bisep, perut bawah',
    minutes: 50,
    exercises: [
      { id: 'chinup', emoji: '💪', name: 'Chin-Ups (telapak menghadap badan)', sets: 3, reps: '8', weight: null },
      { id: 'tbarrow', emoji: '🏋️', name: 'T-Bar / Barbell Row', sets: 4, reps: '8–10', weight: 20 },
      { id: 'pullover', emoji: '🔥', name: 'Dumbbell Pullover', sets: 3, reps: '12', weight: 10 },
      { id: 'straightarmpulldown', emoji: '⚡', name: 'Straight-Arm Pulldown', sets: 3, reps: '12–15', weight: 8 },
      { id: 'reversefly', emoji: '💥', name: 'Reverse Fly', sets: 3, reps: '15', weight: 5 },
      { id: 'preachercurl', emoji: '💪', name: 'Incline Bench Preacher Curls', sets: 3, reps: '12', weight: 12, video: 'https://youtu.be/7v7uldi1eLU' },
      { id: 'abwheel', emoji: '🚀', name: 'Ab Wheel Rollout', sets: 3, reps: '10–12', weight: null, core: true },
    ],
  },
  {
    weekday: 5,
    kind: 'run',
    emoji: '⚡',
    title: 'Lari Cepat (Interval) + Core',
    focus: 'Pembakaran lemak paling efisien & napas lebih kuat',
    minutes: 40,
    exercises: [
      { id: 'warmupjog', emoji: '🚶', name: 'Jogging pemanasan', sets: 1, reps: '8 menit', weight: null, cardio: true },
      { id: 'hillsprint', emoji: '⚡', name: 'Sprint tanjakan 10× (30 dtk / jalan 90 dtk)', sets: 1, reps: '20 menit', weight: null, cardio: true },
      { id: 'cooldownwalk', emoji: '🚶', name: 'Jalan pendinginan', sets: 1, reps: '5 menit', weight: null, cardio: true },
      { id: 'vup', emoji: '💥', name: 'V-Ups', sets: 3, reps: '12–15', weight: null, core: true },
      { id: 'mountainclimber', emoji: '😥', name: 'Mountain Climbers', sets: 3, reps: '40 detik', weight: null, video: 'https://youtu.be/cOsaztSz9N4', core: true },
    ],
  },
  {
    weekday: 6,
    kind: 'strength',
    emoji: '🦵',
    title: 'Kaki & Full-Body',
    focus: 'Paha, betis, plus lengan & perut penutup pekan',
    minutes: 50,
    exercises: [
      { id: 'barbellsquat', emoji: '🦵', name: 'Barbell Squat', sets: 4, reps: '8–12', weight: 20 },
      { id: 'hamcurl', emoji: '⚡', name: 'Leg Curls', sets: 3, reps: '12', weight: 3, video: 'https://youtu.be/NIZeAGZ_YJw' },
      { id: 'bulgarian', emoji: '🔥', name: 'Bulgarian Split Squat', sets: 3, reps: '10 / kaki', weight: 8 },
      { id: 'hipthrust', emoji: '🏋️', name: 'Hip Thrust', sets: 3, reps: '12', weight: 20 },
      { id: 'calfraise', emoji: '💥', name: 'Calf Raises', sets: 4, reps: '20', weight: 10, video: 'https://youtu.be/GQa_N7wft7M' },
      { id: 'wristcurl', emoji: '💪', name: 'Wrist Curls with Dumbbells', sets: 3, reps: '12', weight: 8, video: 'https://youtu.be/NoO4ol8Zw2I' },
      { id: 'russiantwist', emoji: '🚀', name: 'Russian Twists', sets: 3, reps: '20', weight: 4, video: 'https://youtu.be/DJQGX2J4IVw', core: true },
    ],
  },
  WALK_SUN,
];

export const FIT_PROGRAM: Record<FitBlock, FitSession[]> = {
  A: BLOCK_A,
  B: BLOCK_B,
};

// Jam latihan BEBAS — pagi atau sore. Pengingat & badge menyala di dua jendela
// saja supaya Dashboard tidak ditagih sepanjang jam kerja.
export const FIT_TIME_LABEL = 'pagi / sore — bebas';
const FIT_MORNING_FROM = 5;
const FIT_MORNING_TO = 9;
const FIT_EVENING_FROM = 16;
const FIT_EVENING_TO = 21;

/** Nama hari pendek untuk deretan hari (indeks = getDay(), 0 = Minggu). */
export const FIT_DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Urutan giliran blok. Satu-satunya sumber daftar blok — tab Program ikut ini. */
export const FIT_BLOCK_ORDER: FitBlock[] = ['A', 'B'];

/** Blok yang berlaku pada tanggal ini — berganti tiap 2 minggu (A→B→A…). */
export function fitBlockOf(d: Date): FitBlock {
  return FIT_BLOCK_ORDER[Math.floor(weekIndex(d) / 2) % FIT_BLOCK_ORDER.length];
}

/**
 * Sesi hari tertentu. Tiap blok memuat KETUJUH hari (tidak ada hari kosong
 * lagi — Rabu & Minggu diisi jalan pagi), jadi pencarian ini selalu ketemu;
 * fallback ke hari pertama hanya supaya tipenya tetap non-null.
 */
export function fitSessionOfWeekday(
  weekday: number,
  block: FitBlock,
): FitSession {
  const list = FIT_PROGRAM[block];
  return list.find((s) => s.weekday === weekday) ?? list[0];
}

/** Sesi latihan untuk tanggal ini. */
export function fitSessionFor(d: Date): FitSession {
  return fitSessionOfWeekday(d.getDay(), fitBlockOf(d));
}

/** Hari jalan pagi (Rabu & Minggu) — tidak pernah memutus rentetan 🔥. */
function isFitWalkDay(d: Date): boolean {
  return fitSessionFor(d).kind === 'walk';
}

/** Perkiraan durasi sesi, termasuk pemanasan. */
export function fitSessionMinutes(session: FitSession): number {
  return session.minutes;
}

/**
 * Kartu reminder & badge Fitness tampil di DUA jendela: 05.00–08.59 (sesi
 * pagi) dan 16.00–20.59 (sesi sore). Latihannya boleh kapan saja; jendela ini
 * cuma menentukan kapan app mengingatkan, supaya jam kerja tidak ikut ditagih.
 */
export function fitReminderWindow(now: Date): boolean {
  const h = now.getHours();
  return (
    (h >= FIT_MORNING_FROM && h < FIT_MORNING_TO) ||
    (h >= FIT_EVENING_FROM && h < FIT_EVENING_TO)
  );
}

/** "🌅 Sesi pagi" / "🌇 Sesi sore" — untuk kartu reminder Dashboard. */
export function fitWindowLabel(now: Date): string {
  return now.getHours() < FIT_MORNING_TO ? '🌅 Sesi pagi' : '🌇 Sesi sore';
}

// ===================== Kata-kata semangat 🔥 =====================
// Acak tapi deterministik per hari — sama sepanjang hari, ganti tiap hari.

const FIT_QUOTES: string[] = [
  '🔥 Otot tidak tumbuh saat nyaman. Satu set lagi.',
  '💪 Tubuh umur 60-mu dibentuk dari keputusan hari ini.',
  '🏋️ Berat yang sama terasa ringan? Berarti waktunya naik beban.',
  '🧠 Konsisten 5 hari biasa mengalahkan 1 hari luar biasa.',
  '⏱️ 45 menit hari ini, atau penyesalan seharian. Pilih.',
  '🎯 Sixpack dibuat di dapur, dipahat di gym. Dua-duanya jalan.',
  '😤 Yang bikin capek itu mikirnya. Berangkat dulu, sisanya ngalir.',
  '📈 Naik 1 kg beban tiap 2 minggu = 26 kg setahun. Sabar itu strategi.',
  '🚫 Skip sekali jadi kebiasaan. Hari ini jangan.',
  '🥇 Kamu tidak bersaing dengan siapa pun kecuali dirimu kemarin.',
  '🍚 Latihan keras tanpa makan cukup = jalan di tempat. Isi proteinnya.',
  '😴 Otot tumbuh saat tidur. Latihan keras, istirahat serius.',
  '🪞 Perubahan tidak kelihatan tiap hari, tapi kelihatan tiap bulan.',
  '⚡ Mood tidak menentukan jadwal. Jadwal menentukan mood.',
  '🏃 Beban membentuk ototnya, lari membuka tutupnya. Dua-duanya perlu.',
  '🌅 Pagi atau sore sama saja — yang tidak sama itu jadi atau tidak.',
  '🫁 Napas ngos-ngosan hari ini = napas panjang tahun depan.',
];

export function fitQuote(dayId: string): string {
  return pickOfDay(FIT_QUOTES, dayId, 'fitness');
}

// ===================== Target & persiapan 🎯 =====================

/**
 * Target latihan — angkanya DIHITUNG dari Data Tubuh & Target Berat, bukan
 * ditulis ulang di sini. Ubah berat/lingkar perut/target di Profile → Data
 * Tubuh & tab Habits, angka di sini ikut berubah sendiri.
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
    ? 'Belum ada target berat. Pasang dulu di tab Habits → 🎯 Target.'
    : Math.abs(gap) < 0.1
      ? 'Target berat sudah tercapai 🎉 Sekarang fokus jaga & tambah otot.'
      : `Sisa ${formatDecimal(Math.abs(gap))} kg · aman ±0,4 kg/minggu ≈ ${weeks} minggu. Lebih cepat dari itu, otot ikut hilang.`;

  return [
    { icon: '🏋️', label: '3 beban + 2 lari per minggu', desc: 'Beban: Sen, Kam, Sab. Lari: Sel (santai) & Jum (interval). Rabu & Minggu jalan pagi.' },
    { icon: '💥', label: 'Dada & lengan naik duluan', desc: 'Dada dilatih tiap Senin dengan 3 sudut, lengan kebagian Kamis & Sabtu. Ini yang paling kelihatan di cermin.' },
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
          : `Sisa ${formatDecimal(waist - waistGoal)} cm. Perut dilatih tiap sesi & lari membakar lapisannya — sisanya ditentukan defisit kalori.`
        : 'Isi lingkar perut di Profile → 🧍 Data Tubuh biar bisa dilacak.',
    },
    {
      icon: '🥩',
      label: `Protein ${proteinMin}–${proteinMax} g/hari`,
      desc: `1,6–2 g per kg berat badanmu (${formatDecimal(w)} kg). Telur, ayam, ikan, tempe, whey.`,
    },
    { icon: '😴', label: 'Tidur 7–8 jam', desc: 'Otot tumbuh saat tidur, bukan saat latihan. Ini bagian dari program.' },
    { icon: '🚶', label: '8.000+ langkah/hari', desc: 'Aktivitas di luar sesi latihan yang paling besar efeknya untuk membakar lemak.' },
  ];
}

export const FIT_PREP: string[] = [
  '👕 Baju ganti & sepatu olahraga sudah di tas sejak malam sebelumnya',
  '🍌 Makan ringan 45 menit sebelum: pisang / roti / oat',
  '💧 Botol air minimal 600 ml (hari lari: 750 ml)',
  '🧤 Sarung tangan atau strap (bantu pull-up & row)',
  '👟 Hari lari: sepatu lari, bukan sepatu angkat beban',
  '🎧 Earphone + playlist yang bikin semangat',
  '📱 Buka app ini, centang tiap gerakan selesai',
  '🥛 Protein dalam 1–2 jam setelah latihan',
];

export const FIT_RECOVERY: string[] = [
  '😴 Tidur 7–8 jam — ini saat otot benar-benar dibangun',
  '🧘 Stretching ringan 10 menit biar tidak kaku',
  '🚶 Jalan pagi 20–30 menit, jangan diam total',
  '🥩 Protein tetap jalan walau tidak angkat beban',
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

/**
 * Satu hari latihan: gerakan yang sudah dicentang + apakah harinya sengaja
 * DILEWATI. `skipped` disimpan di dokumen harian yang sama, jadi ia ikut
 * kereset sendiri lewat tengah malam — persis seperti tanda ⏭️ di Habits.
 */
export type FitDay = { done: FitDayDone; skipped: boolean };

export const EMPTY_FIT_DAY: FitDay = { done: {}, skipped: false };

export function subscribeFitDay(
  uid: string,
  dayId: string,
  onChange: (day: FitDay) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'fitnessDays', dayId),
    (snapshot) =>
      onChange({
        done: (snapshot.data()?.done as FitDayDone) ?? {},
        skipped: snapshot.data()?.skipped === true,
      }),
    onError,
  );
}

/**
 * Angka badge Fitness 💪 — berapa gerakan HARI INI yang belum dicentang.
 *
 * Menyala di dua jendela pengingat (05.00–08.59 & 16.00–20.59) — jendela yang
 * sama persis dengan kartu reminder di Dashboard, jadi badge & kartunya tidak
 * mungkin berbeda pendapat.
 *
 * 0 = tidak usah ditampilkan: belum waktunya, hari ini sengaja dilewati ✕,
 * atau memang sudah beres semua 🎉
 */
export function fitPendingToday(day: FitDay, now: Date): number {
  if (!fitReminderWindow(now)) return 0;
  if (day.skipped) return 0;
  return fitSessionFor(now).exercises.filter((e) => !day.done[e.id]).length;
}

/**
 * Tandai hari ini DILEWATI (atau batalkan lagi). Bukan "selesai": semua
 * gerakan tampil bertanda ✕ dan hari ini tidak dihitung sebagai sesi latihan.
 */
export function setFitDaySkipped(uid: string, dayId: string, skipped: boolean) {
  return setDoc(
    doc(db, 'users', uid, 'fitnessDays', dayId),
    { skipped, date: Timestamp.fromDate(new Date()) },
    { merge: true },
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

// ---- Cermin ke baris "🏋️ Morning Exercise" di Habits ----
// Olahraga cukup dikerjakan di SATU tempat — di sini — lalu baris di Habits
// ikut sendiri, jadi tidak ada lagi centang dobel.
//
// Keduanya sengaja dipisah jadi dua fungsi (bukan satu yang menulis dua-duanya
// sekaligus) supaya tiap ketukan cuma memicu SATU tulis Firestore. Ketukan
// gerakan terjadi berkali-kali tiap sesi; tanda lewati jarang.
//
// Sengaja tidak melempar error ke pemanggil: gagal menyinkronkan baris cermin
// tidak boleh membatalkan centang latihan yang sebenarnya.

/**
 * Keadaan yang SEHARUSNYA tampil di baris cermin Habits untuk hari ini,
 * dihitung langsung dari dokumen harian Fitness.
 *
 * Dipakai untuk menyelaraskan ulang: cerminnya ditulis saat gerakan dicentang,
 * jadi sesi yang beres SEBELUM fitur cermin ini ada (atau tulis yang gagal)
 * tidak akan pernah tercermin sendiri. Layar Habits memakai ini untuk
 * membetulkan begitu dibuka.
 */
export function fitMirrorState(
  day: FitDay,
  now: Date,
): { done: boolean; skipped: boolean } {
  const list = fitSessionFor(now).exercises;
  return {
    done: !day.skipped && list.length > 0 && list.every((e) => day.done[e.id]),
    skipped: day.skipped,
  };
}

/** Sesi hari ini beres semua? → baris Habits ikut tercentang. */
export function syncFitnessHabit(uid: string, dayId: string, done: boolean) {
  return setHabitDone(uid, dayId, FITNESS_HABIT_ID, done).catch(() => undefined);
}

/**
 * Hari ini sengaja dilewati? → baris Habits bertanda ✕ dan keluar dari skor
 * harian, sama seperti kebiasaan lain yang dilewati. (`setHabitSkipped`
 * sekalian melepas centangnya, jadi tidak perlu tulis kedua.)
 */
export function syncFitnessHabitSkipped(
  uid: string,
  dayId: string,
  skipped: boolean,
) {
  return setHabitSkipped(uid, dayId, FITNESS_HABIT_ID, skipped).catch(
    () => undefined,
  );
}

// ===================== Streak sesi 🔥 =====================
// users/{uid}/app/fitnessStreak — bentuknya sama dengan streak lain.
// Rentetan dihitung antar HARI INTI (beban & lari): jalan pagi Rabu & Minggu
// tidak memutus streak (Selasa → Kamis tetap nyambung).

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

/** dayId hari INTI terakhir sebelum `d` (lewati hari jalan pagi). */
function prevWorkoutDayId(d: Date): string {
  const p = new Date(d);
  for (let i = 0; i < 7; i++) {
    p.setDate(p.getDate() - 1);
    if (!isFitWalkDay(p)) return dayDocId(p);
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

/**
 * Putus rentetan 🔥 — dipakai saat hari INTI sengaja DILEWATI.
 *
 * Yang hilang cuma rentetan berjalannya (`count` → 0). Rekor terbaik & total
 * sesi sengaja DIPERTAHANKAN: itu catatan sejarah yang benar-benar pernah kamu
 * capai, dan achievement "10/50/100 sesi" dihitung dari sana.
 *
 * `lastDayId` dikosongkan supaya hitungannya benar-benar mulai dari awal:
 * sesi berikutnya (termasuk kalau tanda lewatinya dibatalkan lagi hari ini)
 * kembali dihitung sebagai rentetan ke-1.
 */
export function breakFitStreak(uid: string, current: DayStreak | null) {
  return setDoc(doc(db, 'users', uid, 'app', 'fitnessStreak'), {
    ...(current ?? EMPTY_DAY_STREAK),
    count: 0,
    lastDayId: '',
  });
}
