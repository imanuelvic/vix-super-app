// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Uji: nama kebiasaan Rhema, centang otomatis dari catatan, kartu Rhema di
// Home, dan tab sesi ditekan 2× melompat ke baris pertama yang belum dicentang.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

const hSrc = baca('lib/habits.ts');
function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(mod.exports, mod, ...nama.map((n) => luar[n]));
  return mod.exports;
}
// Blok rename + catatan + jendela rhema, diambil apa adanya dari sumbernya.
const a = hSrc.indexOf('const HABIT_RENAMES');
const b = hSrc.indexOf('export function habitArea');
const hab = muat(
  'type ScheduledHabit = any;\n' + hSrc.slice(a, b).replace(/^export /gm, '') +
    '\nexport { HABIT_RENAMES, renamedHabit, HABIT_NOTE_MIN, habitNoteDone, isNoteDrivenHabit, rhemaWindowNow };',
);

console.log('=== Nama kebiasaan diganti ===');
const lama = { id: 'r1', label: '✍️ 1 Kalimat Rhema', slot: 'morning', note: true };
c('"1 Kalimat Rhema" → "Daily Reflection Journal"',
  hab.renamedHabit(lama).label === '📓 Daily Reflection Journal');
c('nama perantaranya ("1 Rhema before Activities") juga ikut diganti',
  hab.renamedHabit({ id: 'r2', label: '✍️ 1 Rhema before Activities', slot: 'morning' })
    .label === '📓 Daily Reflection Journal');
c('id-nya TIDAK ikut berubah → centang harian yang lama tetap kepakai',
  hab.renamedHabit(lama).id === 'r1');
c('kebiasaan lain tidak tersentuh sama sekali', (() => {
  const lain = { id: 'x', label: '💊 Take Vitamin C & D', slot: 'daytime' };
  return hab.renamedHabit(lain) === lain;
})());
c('penggantian dipasang saat daftar DIBACA (bukan menulis ulang Firestore)',
  /\(\(snapshot\.data\(\)\?\.habits as ScheduledHabit\[\]\) \?\? \[\]\)\.map\(renamedHabit\)/.test(hSrc) &&
    !/setDoc[\s\S]{0,200}renamedHabit/.test(hSrc));

console.log('\n=== Centang otomatis dari catatan (minimal 10 huruf) ===');
c('batasnya 10', hab.HABIT_NOTE_MIN === 10);
c('9 huruf → BELUM tercentang', !hab.habitNoteDone('sembilan9'.slice(0, 9)));
c('tepat 10 huruf → tercentang', hab.habitNoteDone('1234567890'));
c('lebih dari 10 → tercentang', hab.habitNoteDone('Tuhan mengingatkanku untuk sabar'));
c('spasi saja tidak dihitung', !hab.habitNoteDone('          '));
c('spasi di ujung dipangkas dulu', !hab.habitNoteDone('   halo    '));
c('kosong → lepas lagi', !hab.habitNoteDone(''));

console.log('\n=== Yang dikunci hanya baris Rhema ===');
c('baris Rhema dikenali dari namanya (nama lama & baru sama-sama kena)',
  hab.isNoteDrivenHabit({ label: '✍️ 1 Rhema before Activities' }) &&
    hab.isNoteDrivenHabit({ label: '✍️ 1 Kalimat Rhema' }));
c('kebiasaan bercatatan LAIN tidak ikut terkunci',
  !hab.isNoteDrivenHabit({ label: '🙏 Ucap syukur 3 hal' }));
const ht = baca('components/habits/HabitsTab.tsx');
// `fromFitness` sekarang bernama `mirrored` — baris cermin bukan cuma
// olahraga lagi (Top 3 Priorities & ketiga Bible Reading ikut). Sifat baris
// Rhema sendiri tidak berubah.
// Syaratnya bertambah: baris cermin yang SUDAH tercentang ikut dimatikan
// (mis. Bible Reading yang sudah diisi / jendelanya lewat). Yang diuji di sini
// tetap sifat baris Rhema: `fromNote` mematikannya, apa pun keadaan lainnya.
c('lingkarannya tidak bisa dipencet manual',
  /disabled=\{fromNote \|\| skipped \|\| \(mirrored && checked\)\}/.test(ht));
c('lingkarannya tampil abu-abu (locked), sama seperti baris cermin',
  /locked=\{mirrored \|\| fromNote\}/.test(ht));
c('centangnya ditulis dari handleNote, bukan dari ketukan',
  /if \(isNoteDrivenHabit\(habit\)\) \{[\s\S]*?setHabitDone\(user\.uid, dayId, habit\.id, selesai\)/.test(ht));
// 31 Agu 2026: aturannya beda per kebiasaan (🙏 Bersyukur 3 Hal minta KETIGA
// butirnya terisi), jadi lewat habitNoteFilled — bukan habitNoteDone langsung.
c('kosongkan catatannya → centangnya ikut lepas',
  /const selesai = habitNoteFilled\(habit, text\);/.test(ht) &&
    /if \(selesai !== !!day\.done\[habit\.id\]\)/.test(ht));
c('angka sesi & area tetap satu sumber (day.done), tidak bisa beda',
  /const checked = !skipped && !!day\.done\[habit\.id\]/.test(ht));
// Petunjuk "Tulis minimal 10 huruf" DIHAPUS sendiri oleh pemilik app —
// sekarang yang menuntun cuma placeholder dari notePrompt tiap kebiasaan.
c('kolom catatannya masih punya penuntun (notePrompt)',
  /placeholder=\{habit\.notePrompt \?\? 'Tulis singkat saja…'\}/.test(ht));

console.log('\n=== Kartu "Rhema Pagi Ini" di Home ===');
const jam = (h) => new Date(2026, 7, 20, h, 30);
c('12.30 → tampil', hab.rhemaWindowNow(jam(12)));
c('17.30 → tampil', hab.rhemaWindowNow(jam(17)));
c('21.30 → tampil', hab.rhemaWindowNow(jam(21)));
for (const h of [8, 11, 14, 16, 19, 20, 23]) {
  c(`${String(h).padStart(2, '0')}.30 → tidak tampil`, !hab.rhemaWindowNow(jam(h)));
}
c('tepat 13.00 sudah lewat jendelanya', !hab.rhemaWindowNow(new Date(2026, 7, 20, 13, 0)));
c('tepat 12.00 sudah masuk', hab.rhemaWindowNow(new Date(2026, 7, 20, 12, 0)));

// 22 Sep 2026: kartu Refleksi Home → blok Refleksi Today (mesin + tampilan + langganan).
const home = baca('lib/today.ts') + baca('components/today/ReflectionBlock.tsx') + baca('hooks/useTodayData.ts');
c('judulnya "Refleksi hari ini"', /Refleksi hari ini/.test(home));
// Kartunya sekarang punya DUA baris tombol: rhema-nya sendiri (→ Habits) dan
// "Bagikan ke Instagram Story" (→ layar rancangan). Mode per-baris ReminderCard
// dipakai supaya keduanya jadi tombol sendiri, tanpa Pressable bersarang.
c('isinya rhema yang kamu tulis sendiri',
  /\{reflection\.text\}/.test(home) && /text: teks,/.test(home));
c('ditambah tombol Feed (menggantikan tombol Story)',
  /label="🖼️ Feed"/.test(home) &&
  /router\.push\('\/reflection-feed'\)/.test(home));
c('rhema-nya tetap menuju baris Rhema di Habits',
  /params: \{ focus: 'rhema' \}/.test(home));
c('bloknya berwarna Spiritual seperti baris With God',
  /backgroundColor: Color\.SPIRITUAL,/.test(home));
// Syaratnya bertambah: kartunya juga BERTAHAN di luar jam baca-ulang selama
// tombol Generate Feed masih perlu dijangkau. Belum ditulis = tetap tak muncul.
c('belum ditulis / kurang 10 huruf → siang hari cuma satu baris kecil, tulisannya tak dipajang',
  /const written = habitNoteDone\(teks\);/.test(home) &&
  /if \(!reflection\.emphasis && !reflection\.written\)/.test(home));
c('Today membaca catatannya lewat daftar kebiasaan (bukan id tebakan)',
  /const jurnal = input\.habits\.find\(isNoteDrivenHabit\);/.test(home) &&
    /subscribeHabitSchedule\(uid, mark\('habits', setHabits\), fail\)/.test(home));
c('jam Today memang berjalan (useNow), jadi bloknya membesar/mengecil sendiri',
  /const \{ now, todayId \} = useNow\(\)/.test(home));

console.log('\n=== Tab sesi ditekan 2× → lompat ke yang belum dicentang ===');
c('tekanan pertama cuma pindah sesi', /if \(next !== activeSlot\) \{\s*\n\s*setActiveSlot\(next\);\s*\n\s*return;/.test(ht));
c('tekanan kedua mencari baris pertama yang belum dicentang & belum dilewati',
  /activeList\.find\(\s*\n?\s*\(h\) => !day\.done\[h\.id\] && !day\.skipped\[h\.id\],?\s*\n?\s*\)/.test(ht));
c('posisi baris dicatat lewat onLayout (tak perlu ukur ulang saat ditekan)',
  /rowY\.current\[habit\.id\] = e\.nativeEvent\.layout\.y/.test(ht) &&
    /blockY\.current = e\.nativeEvent\.layout\.y/.test(ht));
c('menggulungnya lewat ref ScrollView', /scrollRef\.current\?\.scrollTo\(\{/.test(ht) &&
  /<KeyboardAwareScrollView\s+ref=\{scrollRef\}/.test(ht));
c('semua sudah beres → kembali ke atas, bukan diam saja',
  /y: y === undefined \? 0 : Math\.max\(0, blockY\.current \+ y - 8\)/.test(ht));
c('SegmentTabs memang memanggil onChange walau tabnya sudah aktif',
  /onPress=\{\(\) => onChange\(t\.key\)\}/.test(baca('components/common/SegmentTabs.tsx')));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
