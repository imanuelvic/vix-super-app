// Bukti /rapihin batch ini: aturan H-7 (tenggat ≤ 7 hari → otomatis P1 &
// "Dikerjakan", chip-nya terkunci) sekarang DIHITUNG SAAT RENDER, bukan
// didorong balik ke state lewat useEffect.
//
// Rumus yang diuji diambil APA ADANYA dari berkasnya lalu dijalankan — kalau
// nanti diubah, tes ikut berubah.

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const kodeSaja = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

const full = baca('components/career/FulltimeTab.tsx');
const prio = baca('components/tasks/PriorityTab.tsx');

// ================= 1. Efeknya benar-benar hilang =================
ok('FulltimeTab tidak punya useEffect lagi', !/useEffect\(/.test(full));
ok('PriorityTab tidak punya useEffect lagi', !/useEffect\(/.test(prio));
ok('impor useEffect yang nganggur ikut dibuang',
  !/import \{[^}]*useEffect/.test(full) && !/import \{[^}]*useEffect/.test(prio));
ok('tidak ada lagi setState yang mendorong balik aturannya',
  !/setFPriority\(\(p\) =>/.test(full) &&
    !/setFStatus\(\(s\) =>/.test(full) &&
    !/setFPriority\(\(p\) =>/.test(prio));

// ================= 2. Rumus FulltimeTab dijalankan =================
const rumusFull =
  /const urgent =\s*\n\s*!fBacklog &&[\s\S]*?urgent && pickStatus === 'todo' \? 'progress' : pickStatus;/.exec(
    kodeSaja(full),
  );
ok('rumus H-7 FulltimeTab ketemu', rumusFull !== null);

const CAREER_REMINDER_DAYS = 7;
function hitungFull(pickPriority, pickStatus, fBacklog, sisaHari) {
  return new Function(
    'pickPriority',
    'pickStatus',
    'fBacklog',
    'fDeadline',
    'daysBetween',
    'CAREER_REMINDER_DAYS',
    `${rumusFull[0].replace(/: 1 \| 2 \| 3/, '').replace(/: RoadmapStatus/, '')}
     return { urgent, fPriority, fStatus };`,
  )(
    pickPriority,
    pickStatus,
    fBacklog,
    null,
    () => sisaHari,
    CAREER_REMINDER_DAYS,
  );
}

// --- di dalam jendela H-7 ---
for (const sisa of [7, 3, 0, -5]) {
  const r = hitungFull(3, 'todo', false, sisa);
  ok(`sisa ${sisa} hari → mendesak`, r.urgent === true);
  ok(`sisa ${sisa} hari → naik P1`, r.fPriority === 1);
  ok(`sisa ${sisa} hari → "Rencana" jadi "Dikerjakan"`, r.fStatus === 'progress');
}
ok('yang sudah "Dikerjakan" tidak diubah lagi',
  hitungFull(2, 'progress', false, 2).fStatus === 'progress');

// --- di luar jendela: pilihanmu KEMBALI (dulu P1-nya menempel) ---
for (const sisa of [8, 30, 365]) {
  const r = hitungFull(3, 'todo', false, sisa);
  ok(`sisa ${sisa} hari → tidak mendesak`, r.urgent === false);
  ok(`sisa ${sisa} hari → prioritas balik ke pilihanmu (P3)`, r.fPriority === 3);
  ok(`sisa ${sisa} hari → status balik ke "Rencana"`, r.fStatus === 'todo');
}

// --- pengecualian yang harus tetap berlaku ---
ok('Backlog (tanpa tenggat) tidak pernah kena aturan H-7',
  hitungFull(3, 'todo', true, 0).urgent === false &&
    hitungFull(3, 'todo', true, 0).fPriority === 3);
ok('yang sudah Selesai tidak kena aturan H-7',
  hitungFull(3, 'done', false, 0).urgent === false &&
    hitungFull(3, 'done', false, 0).fStatus === 'done');
ok('batasnya tepat 7 hari (8 hari sudah aman)',
  hitungFull(2, 'todo', false, 7).urgent === true &&
    hitungFull(2, 'todo', false, 8).urgent === false);

// ================= 3. Rumus PriorityTab dijalankan =================
const rumusPrio =
  /const urgent = daysBetween\(new Date\(\), fDeadline\) <= OTHER_REMINDER_DAYS;\s*\n\s*const fPriority[^\n]*\n/.exec(
    kodeSaja(prio),
  );
ok('rumus H-7 PriorityTab ketemu', rumusPrio !== null);

function hitungPrio(pickPriority, sisaHari) {
  return new Function(
    'pickPriority',
    'fDeadline',
    'daysBetween',
    'OTHER_REMINDER_DAYS',
    `${rumusPrio[0].replace(/: 1 \| 2 \| 3/, '')}
     return { urgent, fPriority };`,
  )(pickPriority, null, () => sisaHari, 7);
}
ok('tenggat dekat → P1', hitungPrio(3, 2).fPriority === 1);
ok('tenggat lewat → tetap P1', hitungPrio(2, -9).fPriority === 1);
ok('tenggat jauh → pilihanmu dipakai', hitungPrio(3, 40).fPriority === 3);
ok('tenggat jauh & memang pilih P1 → tetap P1', hitungPrio(1, 40).fPriority === 1);

// ================= 4. Yang disimpan = nilai efektifnya =================
ok('FulltimeTab menyimpan nilai turunan itu, bukan menghitung ulang',
  /priority: fPriority,\s*\n\s*status: fStatus,/.test(kodeSaja(full)) &&
    !/priority: urgent \? 1 :/.test(full));
ok('PriorityTab menyimpan nilai turunan itu juga',
  /priority: fPriority,/.test(kodeSaja(prio)) &&
    !/\(urgent \? 1 : fPriority\)/.test(prio));

// ================= 5. Tampilannya TIDAK berubah =================
ok('chip prioritas tetap terkunci saat mendesak (FulltimeTab)',
  /onPress=\{urgent \? \(\) => \{\} : \(\) => setFPriority\(p\)\}/.test(full) &&
    /urgent && fPriority !== p && styles\.chipLocked/.test(full));
ok('chip status "Rencana" tetap terkunci saat mendesak',
  /const locked = urgent && s\.key === 'todo';/.test(full));
ok('chip prioritas tetap terkunci saat mendesak (PriorityTab)',
  /onPress=\{urgent \? \(\) => \{\} : \(\) => setFPriority\(p\)\}/.test(prio) &&
    /urgent && fPriority !== p && styles\.chipLocked/.test(prio));
ok('chip yang aktif tetap dibaca dari nilai efektif',
  /active=\{fPriority === p\}/.test(full) &&
    /active=\{fStatus === s\.key\}/.test(full) &&
    /active=\{fPriority === p\}/.test(prio));
ok('mengisi form (tambah/edit) tetap mengisi PILIHANmu',
  /setFPriority\(item\.priority\)/.test(full) &&
    /setFStatus\(item\.status\)/.test(full) &&
    /setFPriority\(item\.priority\)/.test(prio));

// ================= 6. Sisa lint yang memang belum digarap =================
// Batch ini menutup 2 dari 8 error React Compiler. Sisanya bukan pola yang
// sama (tab/param/animasi) — sengaja tidak dipaksakan sekalian.
ok('HabitsTab & SheetModal & family & tasks belum disentuh batch ini',
  /useEffect\(/.test(baca('components/habits/HabitsTab.tsx')) &&
    /useEffect\(/.test(baca('components/common/SheetModal.tsx')));

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
