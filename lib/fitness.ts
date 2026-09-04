import {
    doc,
    getDoc,
    setDoc,
    Timestamp,
    type FirestoreError,
} from 'firebase/firestore';

import { type LoginStreak as DayStreak } from './achievements';
import { pickOfDay, weekIndex } from './core';
import { DAYPART } from './daypart';
import { db } from './firebase';
import { dayIdToDate, formatDecimal } from './format';
import { FITNESS_HABIT_ID } from './habits';
import {
    bmiCategory,
    bmiValue,
    bumpWeekGym,
    dayDocId,
    idealWeightRange,
    setHabitDone,
    setHabitSkipped,
    type HealthProfile,
    type WeightTarget,
} from './health';
import { liveDoc } from './liveDoc';
import { EMPTY_DAY_STREAK, nextStreak } from './streak';

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

export type FitBlock = 'A' | 'B' | 'C';

/**
 * Jenis sesi — menentukan perlakuan streak 🔥:
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
//
// ALAT YANG DIPAKAI: hanya DUMBBELL & BARBEL (plus bangku datar/miring dan
// lantai). Tidak ada mesin, kabel/rope, maupun palang pull-up — gerakan yang
// dulu butuh itu (Machine Fly, Cable Lat Pulldown, Seated Cable Row, Face
// Pull, Tricep Pushdown, Leg Press, Pull-Up, Hanging Knee Raise, Ab Wheel,
// Leg Curl) sudah diganti gerakan setara yang bisa dikerjakan dengan alat di
// atas. Kalau nanti punya alat baru, tinggal ganti barisnya di sini.

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
      { id: 'dbfly', emoji: '🔥', name: 'Dumbbell Fly', sets: 3, reps: '12–15', weight: 8 },
      { id: 'shoulderpress', emoji: '⚡', name: 'Dumbbell Shoulder Press', sets: 3, reps: '10–12', weight: 14, video: 'https://youtu.be/qEwKCR5JCog' },
      { id: 'lateralraise', emoji: '🏋️', name: 'Lateral Raises', sets: 3, reps: '12–15', weight: 5 },
      { id: 'skullcrusher', emoji: '💥', name: 'Skull Crusher (Barbel)', sets: 3, reps: '10–12', weight: 15 },
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
      { id: 'barbellrow', emoji: '💪', name: 'Barbell Row (bungkuk)', sets: 4, reps: '8–10', weight: 20 },
      { id: 'dbpullover', emoji: '🏋️', name: 'Dumbbell Pullover', sets: 3, reps: '12', weight: 10 },
      { id: 'chestrow', emoji: '🔥', name: 'Chest-Supported Dumbbell Row', sets: 3, reps: '10–12', weight: 10 },
      { id: 'dbrow', emoji: '⚡', name: 'Single-Arm Dumbbell Row', sets: 3, reps: '12 / lengan', weight: 8, video: 'https://youtu.be/6KNmHxw-SpE' },
      { id: 'reardeltrow', emoji: '💥', name: 'Rear-Delt Row (Dumbbell)', sets: 3, reps: '15', weight: 6 },
      { id: 'barbellcurl', emoji: '💪', name: 'Barbell Curl', sets: 3, reps: '10–12', weight: 15 },
      { id: 'reversecrunch', emoji: '😥', name: 'Reverse Crunch', sets: 3, reps: '15', weight: null, core: true },
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
      { id: 'dbstepup', emoji: '💪', name: 'Dumbbell Step-Up (naik bangku)', sets: 3, reps: '12 / kaki', weight: 10 },
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
      { id: 'inclinedbfly', emoji: '🔥', name: 'Incline Dumbbell Fly', sets: 3, reps: '12–15', weight: 7 },
      { id: 'arnoldpress', emoji: '⚡', name: 'Arnold Press', sets: 3, reps: '10', weight: 10 },
      { id: 'leaninglateral', emoji: '🏋️', name: 'Leaning Lateral Raise (1 lengan)', sets: 3, reps: '15', weight: 5 },
      { id: 'overheadext', emoji: '💥', name: 'Overhead Triceps Extension', sets: 3, reps: '10–12', weight: 8 },
      { id: 'weightedcrunch', emoji: '😥', name: 'Weighted Crunch (peluk dumbbell)', sets: 3, reps: '15', weight: 5, core: true },
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
      { id: 'underhandrow', emoji: '💪', name: 'Barbell Row Genggaman Terbalik', sets: 4, reps: '8–10', weight: 20 },
      { id: 'dbrowtwo', emoji: '🏋️', name: 'Bent-Over Dumbbell Row (2 tangan)', sets: 3, reps: '10–12', weight: 12 },
      { id: 'pullover', emoji: '🔥', name: 'Dumbbell Pullover', sets: 3, reps: '12', weight: 10 },
      { id: 'shrug', emoji: '⚡', name: 'Barbell Shrug', sets: 3, reps: '12–15', weight: 25 },
      { id: 'reversefly', emoji: '💥', name: 'Reverse Fly', sets: 3, reps: '15', weight: 5 },
      { id: 'preachercurl', emoji: '💪', name: 'Incline Bench Preacher Curls', sets: 3, reps: '12', weight: 12, video: 'https://youtu.be/7v7uldi1eLU' },
      { id: 'weightedsitup', emoji: '🚀', name: 'Weighted Sit-Up (peluk dumbbell)', sets: 3, reps: '15', weight: 5, core: true },
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
      { id: 'singlelegrdl', emoji: '⚡', name: 'Single-Leg RDL (Dumbbell)', sets: 3, reps: '12 / kaki', weight: 8 },
      { id: 'bulgarian', emoji: '🔥', name: 'Bulgarian Split Squat', sets: 3, reps: '10 / kaki', weight: 8 },
      { id: 'hipthrust', emoji: '🏋️', name: 'Hip Thrust', sets: 3, reps: '12', weight: 20 },
      { id: 'calfraise', emoji: '💥', name: 'Calf Raises', sets: 4, reps: '20', weight: 10, video: 'https://youtu.be/GQa_N7wft7M' },
      { id: 'wristcurl', emoji: '💪', name: 'Wrist Curls with Dumbbells', sets: 3, reps: '12', weight: 8, video: 'https://youtu.be/NoO4ol8Zw2I' },
      { id: 'russiantwist', emoji: '🚀', name: 'Russian Twists', sets: 3, reps: '20', weight: 4, video: 'https://youtu.be/DJQGX2J4IVw', core: true },
    ],
  },
  WALK_SUN,
];

// ============ BLOK C — bisep & persiapan race 🏁 ============
//
// Bedanya dari A & B ada dua:
//   1. BISEP dapat porsi utama — dilatih tiga hari (Senin, Kamis, Sabtu),
//      bukan sekali seminggu sebagai gerakan penutup.
//   2. MINGGU berubah dari jalan santai jadi LONG RUN persiapan race — hari
//      terpenting kalau sedang menyiapkan lomba (lihat sub-tab Race di Health).
//
// ⚠️ Akibat yang disengaja: di blok ini Minggu jadi hari INTI (`kind: 'run'`),
// jadi sesinya MENAIKKAN streak 🔥 kalau beres dan MEMUTUSNYA kalau dilewati.
// Di blok A & B, Minggu tidak pernah menyentuh streak sama sekali. Long run
// persiapan race memang bukan bonus yang boleh dilewatkan begitu saja.
//
// Beban tersimpan ikut id gerakannya, jadi gerakan yang idnya sama dengan blok
// A/B (barbellcurl, hammercurl, …) langsung memakai beban yang sudah kamu
// setel di sana — bukan mulai dari saran awal lagi.

const BLOCK_C: FitSession[] = [
  {
    weekday: 1,
    kind: 'strength',
    emoji: '💪',
    title: 'Bisep & Punggung',
    focus: 'Bisep porsi utama, lats, perut bawah',
    minutes: 50,
    exercises: [
      { id: 'barbellcurl', emoji: '💪', name: 'Barbell Curl', sets: 4, reps: '8–10', weight: 15 },
      { id: 'inclinecurl', emoji: '🔥', name: 'Incline Dumbbell Curl', sets: 3, reps: '10–12', weight: 8 },
      { id: 'hammercurl', emoji: '⚡', name: 'Hammer Curls', sets: 3, reps: '12', weight: 10, video: 'https://youtu.be/L1bDrPlfu1Q' },
      { id: 'barbellrow', emoji: '🏋️', name: 'Barbell Row (bungkuk)', sets: 3, reps: '8–10', weight: 20 },
      { id: 'dbrow', emoji: '💥', name: 'Single-Arm Dumbbell Row', sets: 3, reps: '12 / lengan', weight: 8, video: 'https://youtu.be/6KNmHxw-SpE' },
      { id: 'reversecrunch', emoji: '😥', name: 'Reverse Crunch', sets: 3, reps: '15', weight: null, core: true },
    ],
  },
  {
    weekday: 2,
    kind: 'run',
    emoji: '🏃',
    title: 'Lari Mudah + Core',
    focus: 'Menumpuk jarak tanpa menguras tenaga untuk long run',
    minutes: 45,
    exercises: [
      { id: 'warmupwalk', emoji: '🚶', name: 'Jalan cepat pemanasan', sets: 1, reps: '5 menit', weight: null, cardio: true },
      { id: 'easyrun', emoji: '🏃', name: 'Lari santai — masih sanggup ngobrol', sets: 1, reps: '30 menit', weight: null, cardio: true },
      { id: 'plank', emoji: '🧘', name: 'Plank', sets: 3, reps: '45 detik', weight: null, video: 'https://youtu.be/Fcbw82ykBvY', core: true },
      { id: 'hollowhold', emoji: '⚡', name: 'Hollow Body Hold', sets: 3, reps: '40 detik', weight: null, core: true },
    ],
  },
  WALK_WED,
  {
    weekday: 4,
    kind: 'strength',
    emoji: '💥',
    title: 'Dada, Bahu & Bisep',
    focus: 'Dorongan atas badan, ditutup bisep satu tangan',
    minutes: 50,
    exercises: [
      { id: 'dbbench', emoji: '💪', name: 'Dumbbell Bench Press', sets: 4, reps: '10–12', weight: 12 },
      { id: 'shoulderpress', emoji: '⚡', name: 'Dumbbell Shoulder Press', sets: 3, reps: '10–12', weight: 14, video: 'https://youtu.be/qEwKCR5JCog' },
      { id: 'lateralraise', emoji: '🏋️', name: 'Lateral Raises', sets: 3, reps: '12–15', weight: 5 },
      { id: 'overheadext', emoji: '💥', name: 'Overhead Triceps Extension', sets: 3, reps: '10–12', weight: 8 },
      { id: 'concentrationcurl', emoji: '💪', name: 'Concentration Curl', sets: 3, reps: '12 / lengan', weight: 8 },
      { id: 'crunches', emoji: '🚀', name: 'Crunches', sets: 3, reps: '20', weight: null, video: 'https://youtu.be/5ER5Of4MOPI', core: true },
    ],
  },
  {
    weekday: 5,
    kind: 'run',
    emoji: '⚡',
    title: 'Lari Tempo Persiapan Race',
    focus: 'Membiasakan kecepatan race, bukan lari santai',
    minutes: 45,
    exercises: [
      { id: 'warmupjog', emoji: '🚶', name: 'Jogging pemanasan', sets: 1, reps: '8 menit', weight: null, cardio: true },
      { id: 'temporun', emoji: '⚡', name: 'Tempo — kecepatan targetmu di race', sets: 1, reps: '25 menit', weight: null, cardio: true },
      { id: 'cooldownwalk', emoji: '🚶', name: 'Jalan pendinginan', sets: 1, reps: '5 menit', weight: null, cardio: true },
      { id: 'russiantwist', emoji: '💥', name: 'Russian Twists', sets: 3, reps: '20', weight: 4, video: 'https://youtu.be/DJQGX2J4IVw', core: true },
    ],
  },
  {
    weekday: 6,
    kind: 'strength',
    emoji: '🦵',
    title: 'Kaki & Bisep',
    focus: 'Paha & betis penopang lari, ditutup bisep',
    minutes: 50,
    exercises: [
      { id: 'gobletsquat', emoji: '🦵', name: 'Goblet Squat', sets: 4, reps: '12', weight: 14, video: 'https://youtu.be/42bFodPahBU' },
      { id: 'rdl', emoji: '🏋️', name: 'Romanian Deadlift', sets: 3, reps: '10–12', weight: 12, video: 'https://youtu.be/eDFAAb6vJH4' },
      { id: 'calfraise', emoji: '⚡', name: 'Calf Raises', sets: 4, reps: '20', weight: 10, video: 'https://youtu.be/GQa_N7wft7M' },
      { id: 'zottmancurl', emoji: '🔥', name: 'Zottman Curl', sets: 3, reps: '12', weight: 8 },
      { id: 'spidercurl', emoji: '💪', name: 'Spider Curl (tengkurap di bangku miring)', sets: 3, reps: '12', weight: 7 },
      { id: 'plankwalkout', emoji: '🚀', name: 'Plank Walkouts', sets: 3, reps: '40 detik', weight: null, core: true },
    ],
  },
  {
    weekday: 0,
    kind: 'run',
    emoji: '🏁',
    title: 'Long Run Persiapan Race',
    focus: 'Jarak terjauh minggu ini — modal utama menuju hari race',
    minutes: 75,
    exercises: [
      { id: 'warmupjog', emoji: '🚶', name: 'Jogging pemanasan', sets: 1, reps: '8 menit', weight: null, cardio: true },
      { id: 'longrun', emoji: '🏁', name: 'Long run pelan — tambah ±10% tiap minggu', sets: 1, reps: '50 menit', weight: null, cardio: true },
      { id: 'cooldownwalk', emoji: '🚶', name: 'Jalan pendinginan', sets: 1, reps: '7 menit', weight: null, cardio: true },
      { id: 'stretching', emoji: '🧘', name: 'Stretching seluruh badan', sets: 1, reps: '10 menit', weight: null, cardio: true },
    ],
  },
];

export const FIT_PROGRAM: Record<FitBlock, FitSession[]> = {
  A: BLOCK_A,
  B: BLOCK_B,
  C: BLOCK_C,
};

// Jam latihan BEBAS — pagi atau sore. Pengingat & badge menyala di dua jendela
// saja supaya Dashboard tidak ditagih sepanjang jam kerja.
export const FIT_TIME_LABEL = 'olahraga pagi';
const FIT_MORNING_FROM = 5;
const FIT_MORNING_TO = 9;
const FIT_EVENING_FROM = 16;
const FIT_EVENING_TO = 21;

/** Nama hari pendek untuk deretan hari (indeks = getDay(), 0 = Minggu). */
export const FIT_DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Urutan giliran blok. Satu-satunya sumber daftar blok — tab Program ikut ini. */
export const FIT_BLOCK_ORDER: FitBlock[] = ['A', 'B', 'C'];

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

/** Hari jalan pagi (Rabu & Minggu) — tidak pernah memutus streak 🔥. */
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
  return now.getHours() < FIT_MORNING_TO
    ? `${DAYPART.morning} Sesi pagi`
    : '🌇 Sesi sore'; // sore bukan salah satu sesi DAYPART
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
 * Ambil beberapa hari latihan sekaligus (sekali baca) — untuk menandai hari
 * mana saja di deretan Sen–Min yang sesinya SUDAH beres.
 *
 * Yang diminta cuma hari-hari minggu berjalan sampai hari ini (paling banyak 7
 * dokumen kecil, sekali saat tab dibuka). Hari yang belum ada dokumennya
 * dianggap kosong — bukan error.
 */
export async function fetchFitDays(
  uid: string,
  dayIds: string[],
): Promise<Record<string, FitDay>> {
  const snaps = await Promise.all(
    dayIds.map((id) => getDoc(doc(db, 'users', uid, 'fitnessDays', id))),
  );
  const out: Record<string, FitDay> = {};
  snaps.forEach((snap, i) => {
    out[dayIds[i]] = {
      done: (snap.data()?.done as FitDayDone) ?? {},
      skipped: snap.data()?.skipped === true,
    };
  });
  return out;
}

/**
 * Sesi satu hari SUDAH beres? Yaitu semua gerakannya tercentang & harinya tidak
 * dilewati ✕. Dipakai tanda ✅ di deretan hari.
 */
export function fitDayComplete(
  day: FitDay | undefined,
  weekday: number,
  block: FitBlock,
): boolean {
  if (!day || day.skipped) return false;
  const list = fitSessionOfWeekday(weekday, block).exercises;
  return list.length > 0 && list.every((e) => day.done[e.id]);
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
// sekaligus) supaya tiap klik cuma memicu SATU tulis Firestore. Klik
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
 * Hari ini sengaja dilewati? → baris Habits bertanda ✕ dan keluar dari score
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
// Streak dihitung antar HARI INTI (beban & lari): jalan pagi Rabu & Minggu
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

// ---- Tutup buku lewat tengah malam ⏰ ----
//
// Streak & achievement TIDAK lagi naik saat gerakan terakhir dicentang.
// Alasannya sederhana: sepanjang hari centangnya masih boleh dilepas lagi, jadi
// "sudah beres" di jam 3 sore belum tentu benar jam 11 malam. Yang dihitung
// adalah keadaan hari itu SETELAH harinya habis (lewat jam 00.00).
//
// Pemeriksaannya dijalankan saat tab Exercise dibuka: hari-hari yang sudah
// lewat & belum pernah ditutup dibaca sekali, lalu yang memang tuntas dicatat.
// Tanpa server/background task — app ini memang tidak punya keduanya.

/** Paling jauh berapa hari ke belakang ikut diperiksa saat tutup buku. */
export const FIT_SETTLE_DAYS = 14;

/**
 * dayId yang perlu diperiksa: dari sesudah hari terakhir yang sudah tercatat
 * sampai KEMARIN (hari ini tidak ikut — bukunya belum tutup), maksimal
 * {@link FIT_SETTLE_DAYS} hari ke belakang. Urut naik.
 */
export function fitSettleDayIds(now: Date, lastDayId: string): string[] {
  const ids: string[] = [];
  for (let i = FIT_SETTLE_DAYS; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const id = dayDocId(d);
    if (id > lastDayId) ids.push(id);
  }
  return ids;
}

/**
 * Tutup buku hari-hari yang sudah lewat: yang sesinya tuntas dicatat sebagai
 * streak 🔥 (+ hari angkat beban ikut menambah rekap mingguan Health), yang
 * tidak tuntas dilewati begitu saja.
 *
 * Streaknya dibaca LANGSUNG dari Firestore di sini, bukan dikirim dari layar.
 * Itu disengaja: kalau memakai salinan yang masih dimuat di layar, pembukuan
 * bisa jalan sebelum data aslinya sampai dan satu hari terhitung dua kali.
 *
 * Aman dipanggil berkali-kali: `lastDayId` di dokumen streak jadi penandanya
 * sampai di mana buku sudah ditutup — termasuk untuk hitungan gym mingguan,
 * yang dulu bisa naik berulang tiap centang terakhir dilepas & dipasang lagi di
 * hari yang sama.
 *
 * Hemat baca: dokumen harian yang diambil hanya hari yang memang belum ditutup
 * (biasanya 0–2 dokumen), paling banyak {@link FIT_SETTLE_DAYS}.
 *
 * Mengembalikan berapa hari yang baru saja tercatat.
 */
export async function settleFitDays(uid: string, now: Date): Promise<number> {
  const ref = doc(db, 'users', uid, 'app', 'fitnessStreak');
  const snap = await getDoc(ref);
  let streak = (snap.data() as DayStreak | undefined) ?? EMPTY_DAY_STREAK;

  const ids = fitSettleDayIds(now, streak.lastDayId);
  if (ids.length === 0) return 0;

  const days = await fetchFitDays(uid, ids);
  let counted = 0;
  for (const id of ids) {
    const d = dayIdToDate(id);
    // Jalan pagi Rabu & Minggu memang tidak pernah dihitung sebagai sesi.
    if (isFitWalkDay(d)) continue;
    if (!fitDayComplete(days[id], d.getDay(), fitBlockOf(d))) continue;
    streak = nextStreak(streak, id, prevWorkoutDayId(d));
    counted += 1;
    // Rekap mingguan Health cuma menghitung hari ANGKAT BEBAN (anjuran:
    // strength training minimal 2 hari/minggu) — hari lari tidak ikut.
    if (fitSessionFor(d).kind === 'strength') await bumpWeekGym(uid, d);
  }
  if (counted > 0) await setDoc(ref, streak);
  return counted;
}

/**
 * Putus streak 🔥 — dipakai saat hari INTI sengaja DILEWATI.
 *
 * Yang hilang cuma streak berjalannya (`count` → 0). Rekor terbaik & total
 * sesi sengaja DIPERTAHANKAN: itu catatan sejarah yang benar-benar pernah kamu
 * capai, dan achievement "10/50/100 sesi" dihitung dari sana.
 *
 * `lastDayId` diisi HARI INI (bukan dikosongkan): dengan count = 0, sesi
 * berikutnya tetap dihitung sebagai streak ke-1 — nyambung atau tidak,
 * `nextStreak` sama-sama menghasilkan 1. Sekaligus menandai hari ini sudah
 * ditutup bukunya, jadi `settleFitDays` tidak mengulang hari-hari sebelumnya.
 */
export function breakFitStreak(
  uid: string,
  current: DayStreak | null,
  d: Date,
) {
  return setDoc(doc(db, 'users', uid, 'app', 'fitnessStreak'), {
    ...(current ?? EMPTY_DAY_STREAK),
    count: 0,
    lastDayId: dayDocId(d),
  });
}
