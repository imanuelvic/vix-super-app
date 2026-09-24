// Uji Multiplication 🌱: status "❌ Batal", kartu ringkasan atas dihapus, dan
// tombol 🧭 Pedoman Calon CORE Leader.
//
// Statusnya diuji dengan MENJALANKAN kode yang dikirim (lib/multiplication.ts
// dikompilasi sungguhan), bukan mencocokkan regex — termasuk pada data seed
// aslimu, supaya jelas kartu mana yang berubah tulisannya dan mana yang tidak.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi kode aslinya ----------
const OUT = path.join(__dirname, 'keluar-multi');
fs.rmSync(OUT, { recursive: true, force: true });
// tsc dijalankan lepas dari tsconfig proyek, jadi ia mengeluh soal tipe di
// berkas tetangga (mis. `process` di lib/firebase.ts). Keluhan TIPE tidak
// menghentikan emit — yang kita butuhkan JS-nya. Kalau berkasnya benar-benar
// gagal terbentuk, uji di bawah yang akan gagal, bukan didiamkan.
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc',
      R + 'lib/multiplication.ts',
      R + 'lib/multiplicationSeed.ts',
      '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch {
  /* keluhan tipe diabaikan — hasil emit-nya diperiksa di bawah */
}
for (const f of ['multiplication.js', 'multiplicationSeed.js']) {
  if (!fs.existsSync(path.join(OUT, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

// Hasil kompilasinya duduk di luar proyek, jadi jalur modulnya diarahkan
// ulang di sini:
//   • `./firebase` menarik modul native (AsyncStorage) → diganti boneka.
//     Tidak ada satu pun uji di bawah yang menyentuh Firestore.
//   • `./format` cuma dipakai untuk nama bulan → diambil apa adanya dari
//     berkas aslinya, bukan disalin tangan (biar tak bisa melenceng).
//   • `firebase/firestore` diarahkan ke paket asli di node_modules proyek.
const MONTH_NAMES = new Function(
  `return ${baca('lib/format.ts').match(/MONTH_NAMES = (\[[\s\S]*?\]);/)[1]}`,
)();
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (/[/\\]firebase$/.test(req)) return { db: {} };
  if (/[/\\]format$/.test(req)) return { MONTH_NAMES };
  if (req.startsWith('firebase/')) {
    return asli.call(this, R + 'node_modules/' + req, parent, isMain);
  }
  return asli.call(this, req, parent, isMain);
};
const M = require(path.join(OUT, 'multiplication.js'));
const SEED = require(path.join(OUT, 'multiplicationSeed.js'));
Module._load = asli;

// ---------- Data buatan ----------
const langkah = (done, cancelled) => ({
  id: Math.random().toString(36),
  date: { toMillis: () => 0, toDate: () => new Date(2026, 0, 1) },
  title: 't',
  notes: [],
  done,
  cancelled,
});
const multi = (steps) => ({ steps, members: [] });
const label = (steps) => M.multiStatusLabel(M.multiStatus(multi(steps)));

console.log('=== Status kartu multiplikasi ===');
c('semua langkah beres, tak ada yang batal → ✅ Selesai',
  label([langkah(true, false), langkah(true, false)]) === '✅ Selesai');
c('SISANYA beres tapi ADA yang batal → ❌ Batal (dulu tertulis "Selesai")',
  label([langkah(true, false), langkah(true, false), langkah(false, true)]) === '❌ Batal');
c('SEMUA langkahnya batal → ❌ Batal (dulu tertulis "Rencana")',
  label([langkah(false, true), langkah(false, true)]) === '❌ Batal');
c('masih ada langkah menggantung + ada yang batal → ⏳ Berjalan',
  label([langkah(true, false), langkah(false, false), langkah(false, true)]) === '⏳ Berjalan');
c('baru sebagian beres, tanpa batal → ⏳ Berjalan',
  label([langkah(true, false), langkah(false, false)]) === '⏳ Berjalan');
c('belum ada yang dikerjakan → 🗓️ Rencana',
  label([langkah(false, false), langkah(false, false)]) === '🗓️ Rencana');
c('timeline masih kosong → 🗓️ Rencana', label([]) === '🗓️ Rencana');
c('satu langkah beres & itu satu-satunya → ✅ Selesai',
  label([langkah(true, false)]) === '✅ Selesai');

console.log('\n=== Hitungan kemajuan TIDAK berubah ===');
// Aturan lama: langkah batal tidak masuk pembilang maupun penyebut.
const p = M.multiProgress(multi([
  langkah(true, false), langkah(true, false),
  langkah(false, false), langkah(false, true), langkah(true, true),
]));
c('langkah batal tetap tak ikut dihitung', p.done === 2 && p.total === 3,
  `${p.done}/${p.total}`);
c('langkah batal yang terlanjur ditandai beres pun tak ikut',
  M.multiProgress(multi([langkah(true, true)])).total === 0);

console.log('\n=== Pada data seed aslimu ===');
const seeds = SEED.seedMultiplications(new Date(2026, 7, 26));
c(`seed-nya termuat (${seeds.length} multiplikasi)`, seeds.length === 5);
// Perhitungan versi LAMA, disalin apa adanya dari kode sebelum perubahan —
// dipakai untuk menunjukkan persis apa yang berubah.
const statusLama = (m) => {
  const live = m.steps.filter((s) => !s.cancelled);
  const done = live.filter((s) => s.done).length;
  if (live.length > 0 && done === live.length) return 'done';
  return done > 0 ? 'running' : 'planned';
};
const berubah = [];
for (const m of seeds) {
  const lama = statusLama(m);
  const baru = M.multiStatus(m);
  const nama = `${m.fromName}→${m.toName}`;
  const batal = m.steps.filter((s) => s.cancelled).length;
  if (lama !== baru) berubah.push(`${nama} (${batal} batal): ${lama} → ${baru}`);
  else console.log(`      · ${nama}: tetap ${M.multiStatusLabel(baru)}`);
}
for (const b of berubah) console.log(`      ↻ ${b}`);
const reyki = seeds.find((m) => m.toName === 'Reyki');
c('CORE Sarah → Reyki (5 langkah dicoret) sekarang ❌ Batal, dulu ✅ Selesai',
  statusLama(reyki) === 'done' && M.multiStatus(reyki) === 'cancelled',
  `${reyki.steps.filter((s) => s.cancelled).length} dari ${reyki.steps.length} langkah dicoret`);
c('yang tidak punya langkah batal TIDAK ikut berubah', (() => {
  return seeds
    .filter((m) => !m.steps.some((s) => s.cancelled))
    .every((m) => statusLama(m) === M.multiStatus(m));
})(), `${berubah.length} dari ${seeds.length} kartu berubah tulisannya`);
c('Theofilus → Riky masih ⏳ Berjalan (1 batal, tapi 3 langkah belum beres)', (() => {
  const m = seeds.find((x) => x.toName === 'Riky');
  return M.multiStatus(m) === 'running';
})());

console.log('\n=== Kartu ringkasan atas dihapus ===');
const tab = baca('components/core/MultiplicationTab.tsx');
c('SummaryCard tidak lagi dipakai di sub-tab ini', !/<SummaryCard/.test(tab));
c('impornya ikut dibuang (tidak jadi dead code)',
  !/import \{ SummaryCard \}/.test(tab));
c('hitungan selesai/berjalan yang cuma untuk kartu itu ikut dibuang',
  !/const running = /.test(tab) && !/const done = \(list/.test(tab));
c('tombol "Buat Rencana Multiplikasi" tetap ada',
  /label="Buat Rencana Multiplikasi"/.test(tab));
c('daftar kartunya sendiri tidak tersentuh',
  /multiStatusLabel\(status\)/.test(tab) && /<ProgressBar/.test(tab));
c('kartu ❌ Batal diberi warna DANGER, bukan hijau "selesai"',
  /statusCancel: \{ color: Color\.DANGER \}/.test(tab) &&
    /status === 'cancelled'\s*\?\s*styles\.statusCancel/.test(tab.replace(/\s+/g, ' ')));

console.log('\n=== Tombol 🧭 Pedoman Calon CORE Leader ===');
const core = baca('app/(tabs)/core.tsx');
// Lambangnya boleh diganti pemiliknya (2 Sep 2026: 🧭 → 📄). Yang dijaga:
// pintunya ADA di pojok kanan sub-tab Multiplication & menuju layar pedoman.
const cabangMulti = core.slice(
  core.indexOf("tab === 'multiplication' ? ("),
  core.indexOf(') : undefined'),
);
c('muncul di pojok kanan sub-tab Multiplication',
  cabangMulti.length > 0 && /router\.push\('\/leader-criteria'\)/.test(cabangMulti));
// 16 Sep 2026: 📜 Rules pindah ke samping judul "Jadwal Visitasi" (di dalam
// VisitationTab); tempatnya di header diisi 📆 Kalender.
c('tombol sub-tab lain tidak ada yang hilang',
  /emoji="📆"/.test(core) && /emoji="🕘"/.test(core) &&
    /emoji="📜"/.test(baca('components/core/VisitationTab.tsx')) &&
    /emoji="💬"/.test(core) && /emoji="🙏"/.test(core) && /emoji="🗂️"/.test(core));
c('bentuknya EmojiButton, sama seperti tombol pojok kanan lain',
  /<EmojiButton\s+emoji="/.test(cabangMulti));
c('rutenya terdaftar di _layout', /name="leader-criteria"/.test(baca('app/_layout.tsx')));
c('typed routes sudah di-regen',
  /leader-criteria/.test(baca('.expo/types/router.d.ts')));

console.log('\n=== Isi pedomannya (DUA lembar) ===');
const isi = baca('lib/leaderCriteria.ts');
const layar = baca('app/leader-criteria.tsx');
// Komentar dibuang dulu, lalu dipisah per daftar — kalau tidak, butir kedua
// lembar tercampur jadi satu angka.
const dataOnly = isi.replace(/^\s*\/\/.*$/gm, '');
const potong = dataOnly.indexOf('export const LEADER_DUTIES');
// CRITERIA_SHEETS di bawahnya juga punya `title:` (judul lembar = nama berkas
// PDF-nya), jadi pemindaian bagian harus berhenti sebelum itu.
const akhirTugas = dataOnly.indexOf('export const CRITERIA_SHEETS');
c('kedua lembar ada di satu berkas', potong > 0 && akhirTugas > potong);
const lembar = {
  'Calon CL': dataOnly.slice(0, potong),
  'Tugas CL': dataOnly.slice(potong, akhirTugas),
};
const bagianOf = (s) => [...s.matchAll(/^\s{4}title: '([^']+)'/gm)].map((m) => m[1]);
const butirOf = (s) =>
  [...s.matchAll(/points: \[([\s\S]*?)\],\s*\n\s*\}/g)].map(
    (m) => (m[1].match(/'(?:[^'\\]|\\.)*'/g) || []).length,
  );

const bagian = bagianOf(lembar['Calon CL']);
c('Calon CL: 6 bagian sesuai lembar aslimu', bagian.length === 6, bagian.join(' · '));
for (const t of ['Yang Harus Disiapkan', '1 Timotius 3:1-7', 'Titus 1:1-9',
  'MCL Imanuel Victory']) {
  c(`  bagian "${t}" ada`, bagian.includes(t));
}
const perCalon = butirOf(lembar['Calon CL']);
c('Calon CL: butirnya 8+6+4+1+1+1 = 21',
  perCalon.reduce((a, b) => a + b, 0) === 21, `${perCalon.join('+')}`);

const bagianTugas = bagianOf(lembar['Tugas CL']);
c('Tugas CL: 7 bagian sesuai lembar aslimu', bagianTugas.length === 7,
  bagianTugas.join(' · '));
c('  urut mengikuti ritme CORE: sebelum → hari-H → sesudah',
  bagianTugas[0] === 'Sebelum Hari Pertemuan CORE' &&
    bagianTugas[1] === 'Hari Pertemuan CORE' &&
    bagianTugas[2] === 'Setelah Hari Pertemuan CORE');
c('  Peringatan ditaruh PALING BAWAH', bagianTugas.at(-1) === 'Peringatan');
const perTugas = butirOf(lembar['Tugas CL']);
c('Tugas CL: butirnya 6+6+5+4+3+9+9 = 42',
  JSON.stringify(perTugas) === JSON.stringify([6, 6, 5, 4, 3, 9, 9]),
  `${perTugas.join('+')} = ${perTugas.reduce((a, b) => a + b, 0)}`);
c('bagian Peringatan ditandai supaya tampil beda (bukan butir biasa)',
  /tone: 'warn'/.test(lembar['Tugas CL']) &&
    /cardWarn: \{[\s\S]*?backgroundColor: Color\.DANGER_TRANSPARENT/.test(layar));
c('kalimat kunci lembar Tugas tersalin utuh', (() => {
  const contoh = [
    'Persiapan Materi CDG.',
    'Doa Persiapan Hati Pelayan sebelum mulai CORE.',
    'Comment & like Social Media Member.',
    'Doakan Member setiap hari.',
    'Mengajukan CCL.',
    'sudah 8× pertemuan tidak hadir CORE',
    'Disarankan jangan ada uang kas CORE.',
    'Welcome, Worship, Warmth, Word, Works',
    'CORE Leader harus berjuang sendiri',
  ];
  return contoh.every((k) => isi.includes(k));
})());
c('salah ketik lembar Tugas dibetulkan (Daftarkkan / di rekomendasikan)',
  /'Daftarkan RL PM\.'/.test(dataOnly) && !/Daftarkkan RL/.test(dataOnly) &&
    /direkomendasikan oleh CORE Leader/.test(dataOnly) &&
    !/di rekomendasikan/.test(dataOnly));
c('visi NDC ikut, apa adanya',
  /Menjadikan setiap jemaat murid Yesus dengan cara yang relevan sehingga berdampak bagi lingkungan/
    .test(isi));
c('CARE OPEN REACH EQUIP ikut, urutannya sama',
  /'CARE'[\s\S]*'OPEN'[\s\S]*'REACH'[\s\S]*'EQUIP'/.test(isi));
c('kalimat kunci tiap sumber tersalin utuh', (() => {
  const contoh = [
    'Harus menjadi Main Team minimal sudah 3 bulan',
    'Setia kepada pasangannya, menunjukkan komitmen dan kesetiaan',
    'Berpegang teguh pada ajaran yang benar',
    'Pemimpin harus tunduk kepada orang tua dan pemerintah (gereja).',
    'bukan hanya tentang posisi atau gelar',
    'perlombaan ini adalah perlombaan sendiri-sendiri',
  ];
  return contoh.every((k) => isi.includes(k));
})());
// Dicek pada ISI-nya saja; komentar di berkas itu memang menyebut kata
// salahnya untuk menjelaskan perbaikannya.
c('salah ketik "dihakmi" dibetulkan jadi "dihakimi"',
  dataOnly.includes('mudah dihakimi') && !dataOnly.includes('dihakmi'));

console.log('\n=== Aturan wajib ===');
// Yang dinilai IMPOR-nya, bukan kata "Firestore" yang memang disebut di
// komentar ("sengaja statis, bukan Firestore"). `useState` DIPAKAI — untuk
// segmen Calon/Tugas — dan itu bukan pembacaan data; yang dilarang di sini
// langganan & efeknya.
c('layar pedoman tidak menyentuh Firestore sama sekali', (() => {
  const impor = (s) => (s.match(/^import .*$/gm) || []).join('\n');
  return !/firebase|firestore|@\/lib\/(firebase|liveDoc)/i.test(impor(layar) + impor(isi)) &&
    !/useEffect|subscribe\w*\(/.test(layar);
})());
c('warnanya dari Color, tak ada hex mentah',
  !/#[0-9A-Fa-f]{6}/.test(layar) && !/#[0-9A-Fa-f]{6}/.test(isi));
c('memakai komponen bersama (ScreenHeader, VixText, SegmentTabs)',
  /ScreenHeader/.test(layar) && /VixText/.test(layar) &&
    /<SegmentTabs/.test(layar) && !/<Text[ >]/.test(layar));
c('dua lembar jadi SATU tombol pojok kanan, bukan dua', (() => {
  // Kalau kelak ditambah tombol pedoman kedua, uji ini yang menegur.
  return (cabangMulti.match(/<EmojiButton/g) || []).length === 1 &&
    (core.match(/router\.push\('\/leader-criteria'\)/g) || []).length === 1;
})());
c('tidak ada dependency/modul native baru',
  !/expo-|react-native-(?!safe-area)/.test(isi));
c('tidak ada soft-delete diselundupkan',
  !/isDeleted|archived: true/.test(tab + baca('lib/multiplication.ts')));
c('hapus multiplikasi tetap permanen',
  /export function deleteMultiplication[\s\S]*?deleteDoc\(/.test(baca('lib/multiplication.ts')));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
