// Bukti: (1) ganti topik Learning cuma boleh Senin, (2) badge sub-tab Target
// memakai rumus yang SAMA PERSIS dengan badge tile Learning di Home.
//
// lib/learning.ts dijalankan beneran (di-compile lalu di-require dengan modul
// native distub), bukan cuma dibaca teksnya.

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(os.tmpdir(), 'cek-learning-senin-out');

let lulus = 0;
const gagal = [];
function ok(nama, syarat) {
  if (syarat) lulus++;
  else gagal.push(nama);
}

// ---------- compile lib/learning.ts ----------
try {
  execFileSync(
    'npx',
    [
      'tsc',
      path.join(ROOT, 'lib/learning.ts'),
      '--ignoreConfig',
      '--outDir',
      OUT,
      '--module',
      'commonjs',
      '--target',
      'es2020',
      '--skipLibCheck',
      '--esModuleInterop',
      '--moduleResolution',
      'bundler',
    ],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch {
  // tsc mengeluh soal tipe modul native — file .js-nya tetap ditulis.
}

// ---------- stub modul native / firebase ----------
const aslinya = Module._load;
Module._load = function (permintaan, induk, isMain) {
  if (permintaan === './firebase') return { db: {} };
  if (permintaan === './liveDoc') return { liveDoc: () => () => {} };
  if (permintaan.startsWith('firebase/')) {
    return {
      doc: (...a) => ({ path: a.slice(1).join('/') }),
      setDoc: async () => {},
      deleteField: () => '__delete__',
    };
  }
  if (/^expo-|^@react-native|^react-native/.test(permintaan)) return {};
  return aslinya(permintaan, induk, isMain);
};

const L = require(path.join(OUT, 'learning.js'));
Module._load = aslinya;

// ================= 1. Ganti topik: SENIN saja =================
// 2026-08-24 adalah hari Senin. Tujuh hari berturut-turut dari situ.
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const senin = new Date(2026, 7, 24, 10, 0, 0);
ok('24 Agu 2026 memang Senin', senin.getDay() === 1);

for (let i = 0; i < 7; i++) {
  const d = new Date(senin.getTime() + i * 86400000);
  const boleh = L.canChangeWeekSkill(d);
  ok(
    `canChangeWeekSkill ${HARI[d.getDay()]} = ${d.getDay() === 1}`,
    boleh === (d.getDay() === 1),
  );
}

// Jam berapa pun di hari Senin tetap boleh (bukan cuma jam tertentu).
for (const jam of [0, 6, 12, 23]) {
  ok(
    `Senin jam ${jam} tetap boleh`,
    L.canChangeWeekSkill(new Date(2026, 7, 24, jam, 30)) === true,
  );
}

// Senin minggu-minggu lain juga boleh (bukan cuma tanggal itu).
for (const minggu of [1, 2, 5, 20]) {
  const d = new Date(senin.getTime() + minggu * 7 * 86400000);
  ok(`Senin +${minggu} minggu boleh`, L.canChangeWeekSkill(d) === true);
}

// ================= 2. Badge: sub-tab Target == tile Home =================
// Rumus Home = learningPending(steps, topicsDone, now).
// Rumus lama sub-tab = dueStep(...) ? 1 : 0 — di bawah dibuktikan BEDA, jadi
// perubahannya memang perlu.

const minggu0 = L.weekDocId(senin); // Senin = awal minggu
ok('weekDocId(Senin) = tanggal Senin itu', minggu0 === '2026-08-24');

const topikMinggu = L.topicsOfWeek(senin);
ok('topicsOfWeek = 3 topik', topikMinggu.length === 3);

// Hari Minggu (akhir minggu), belum apa-apa dikerjakan:
// 4 langkah tertagih + 3 topik belum diobrolkan = 7.
const akhirMinggu = new Date(senin.getTime() + 6 * 86400000);
ok('hari ke-7 memang Minggu', akhirMinggu.getDay() === 0);
ok(
  'learningPending kosong di hari Minggu = 7',
  L.learningPending({}, {}, akhirMinggu) === 7,
);
ok(
  'rumus LAMA cuma 1 → memang beda dengan Home',
  (L.dueStep({}, akhirMinggu) ? 1 : 0) === 1,
);

// Setelah semua langkah + semua topik beres → 0 (badge hilang).
const semuaLangkah = { discover: true, dig: true, summarize: true, share: true };
const semuaTopik = Object.fromEntries(topikMinggu.map((t) => [t.key, true]));
ok(
  'semua beres → 0',
  L.learningPending(semuaLangkah, semuaTopik, akhirMinggu) === 0,
);

// Campuran: 2 langkah beres, 1 topik beres, hari Minggu → 2 + 2 = 4.
const sebagian = { discover: true, dig: true };
const satuTopik = { [topikMinggu[0].key]: true };
ok(
  'campuran → 4',
  L.learningPending(sebagian, satuTopik, akhirMinggu) === 4,
);

// Hari Senin pagi belum apa-apa: baru langkah "Kenali" yang jatuh tempo,
// tapi 3 topik sudah berlaku sepanjang minggu → 1 + 3 = 4.
ok('Senin kosong → 4', L.learningPending({}, {}, senin) === 4);
ok('pendingSteps Senin kosong → 1', L.pendingSteps({}, senin) === 1);
ok(
  'pendingTopicsOfWeek Senin kosong → 3',
  L.pendingTopicsOfWeek({}, senin).length === 3,
);

// Rumus badge = penjumlahan dua bagian itu, di HARI MANA PUN dalam minggu itu.
for (let i = 0; i < 7; i++) {
  const d = new Date(senin.getTime() + i * 86400000);
  const jumlah =
    L.pendingSteps(sebagian, d) + L.pendingTopicsOfWeek(satuTopik, d).length;
  ok(
    `learningPending = pendingSteps + pendingTopics (${HARI[d.getDay()]})`,
    L.learningPending(sebagian, satuTopik, d) === jumlah,
  );
}

// ================= 3. Cek kode terpasang =================
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// Buang komentar dulu — jangan sampai lolos gara-gara kalimat penjelasan.
const kodeSaja = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const weekTab = kodeSaja(baca('components/learning/WeekTab.tsx'));
ok('WeekTab impor canChangeWeekSkill', /canChangeWeekSkill/.test(weekTab));
ok(
  'WeekTab: bisaGanti = canChangeWeekSkill(now)',
  /const bisaGanti = canChangeWeekSkill\(now\)/.test(weekTab),
);
ok(
  'WeekTab: tombol 🔀 dibungkus bisaGanti',
  /\{bisaGanti && \([\s\S]{0,400}Acak topik minggu ini/.test(weekTab),
);

const skillsTab = kodeSaja(baca('components/learning/SkillsTab.tsx'));
ok('SkillsTab impor canChangeWeekSkill', /canChangeWeekSkill/.test(skillsTab));
ok(
  'SkillsTab: tombol "Jadikan Topik" ikut dibatasi',
  /\{bisaGanti && open\.key !== current\.key &&/.test(skillsTab),
);
// Satu-satunya pintu penulisan topik minggu ini = setWeekSkill. Pastikan yang
// MEMANGGILNYA cuma dua file itu — kalau nanti ada pintu ketiga, tes ini gagal
// dan aturan Senin tidak diam-diam bocor.
function semuaFile(dir, hasil = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && !e.name.startsWith('.')) semuaFile(rel, hasil);
    } else if (/\.tsx?$/.test(e.name)) hasil.push(rel);
  }
  return hasil;
}
const pemanggil = [...semuaFile('app'), ...semuaFile('components')].filter((f) =>
  /setWeekSkill\(/.test(kodeSaja(baca(f))),
);
ok(
  'setWeekSkill cuma dipanggil WeekTab & SkillsTab (dua-duanya dibatasi)',
  pemanggil.length === 2 &&
    pemanggil.some((f) => f.endsWith('WeekTab.tsx')) &&
    pemanggil.some((f) => f.endsWith('SkillsTab.tsx')),
);

const learningScreen = kodeSaja(baca('app/learning.tsx'));
// 28 Agu 2026: "💬 Discussion This Week" pindah ke sub-tab Discussion, jadi
// badge-nya ikut dipecah ke sub-tab masing-masing. Yang tetap dijaga: JUMLAH
// keduanya = angka badge tile Home. Itu dibuktikan dengan dijalankan di
// cek-lima.js; di sini cukup dipastikan rumus yang dipakai memang pecahan
// resmi dari learningPending, bukan hitungan baru.
ok(
  'badge pakai pecahan resmi learningPending (pendingSteps + pendingTopicsOfWeek)',
  /pendingSteps\(week\.steps, now\)/.test(learningScreen) &&
    /pendingTopicsOfWeek\(topicsDone, now\)\.length/.test(learningScreen),
);
ok('learning.tsx tidak lagi pakai dueStep', !/dueStep/.test(learningScreen));
ok(
  'badge menunggu week & topicsDone termuat',
  /week === null \? 0 : pendingSteps/.test(learningScreen) &&
    /topicsDone === null \? 0 : pendingTopicsOfWeek/.test(learningScreen),
);
ok(
  'topicsDone bertipe TopicsDone | null',
  /useState<TopicsDone \| null>\(null\)/.test(learningScreen),
);
ok(
  'LoadingCenter juga menunggu topicsDone',
  /week === null \|\| topicsDone === null \? \(\s*<LoadingCenter/.test(
    learningScreen,
  ),
);

// 22 Sep 2026: badge tile Home → baris Today Engine (langkah hari ini + topik minggu ini).
const home = kodeSaja(baca('lib/today.ts'));
ok(
  'Today pakai dueStep & pendingTopicsOfWeek yang sama (sumber learningPending)',
  /dueStep\(input\.learningWeek\.steps, now\)/.test(home) && /pendingTopicsOfWeek\(input\.topicsDone, now\)/.test(home),
);

// Dead code yang dilaporkan lint sudah dibuang.
ok(
  'monthlyPdf.ts: variabel `terisi` tak terpakai sudah dihapus',
  !/const terisi\b/.test(baca('lib/monthlyPdf.ts')),
);

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
