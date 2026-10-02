// Sepuluh permintaan 27 Sep 2026 — dibuktikan satu per satu.
//
//  1. Garis tegak Σ di Rekap Visitasi lurus ke bawah di iPhone 15
//  2. Lambang jenis acara bisa di-click → penjelasannya
//  3. Hati CORE bisa di-click → nama CL & data umumnya
//  4. Keterangan nama CL di sheet Share dibuang; kaki sheet tidak tertutup
//     batang beranda iPhone
//  5. Tanggal ekspor terakhir dicatat + ditagih sesudah sebulan
//  6. Tab Steps dipisah per periode + kartu 3 bulan & setahun
//  7. Target Learning dapat notifikasi sesuai hari & jamnya
//  8. Family ↔ News ↔ Book berputar di grid
//  9. Lencana Distance dipisah per periode
// 10. Streak baca Alkitab yang putus kelihatan, di Walk maupun Habits
//
// Yang dijalankan SUNGGUHAN: lib/backup.ts (umur cadangan & ajakannya),
// lib/streak.ts (streak yang masih hidup), lib/reward.ts (pengelompokan
// lencana), lib/health.ts (kuartal & tahun). Sisanya bentuk kode.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-sepuluh-27sep');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Sumber tanpa komentar — penjelasan "dulu begini" tak boleh ikut terbaca. */
const tanpaKomentar = (s) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ================== Kompilasi modul yang diuji sungguhan ==================
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc',
      path.join(ROOT, 'lib/backup.ts'),
      path.join(ROOT, 'lib/streak.ts'),
      path.join(ROOT, 'lib/reward.ts'),
      path.join(ROOT, 'lib/health.ts'),
      path.join(ROOT, 'lib/learning.ts'),
      '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (/^(expo-|react-native|@expo|react$|@react-native)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const B = require(path.join(OUT, 'backup.js'));
const S = require(path.join(OUT, 'streak.js'));
const RW = require(path.join(OUT, 'reward.js'));
const H = require(path.join(OUT, 'health.js'));
const L = require(path.join(OUT, 'learning.js'));
Module._load = asli;

const recap = baca('app/core-recap.tsx');
const personInfo = baca('components/core/PersonInfo.tsx');

// ===================================================================
console.log('\n=== 1. Garis Σ lurus ke bawah (iPhone 15) ===');
{
  const kode = tanpaKomentar(recap);
  // Akar masalahnya: baris tanggal Thanksgiving memakai minWidth 40 sedangkan
  // baris lain 48. Di layar sempit kolom baris itu menyusut sendiri, jadi
  // garis tegak Σ di ujung kanan meleset ke kiri — tabelnya bertangga.
  ok('cellDate cuma mengatur ukuran huruf, tidak lebarnya',
    /cellDate: \{ fontSize: 11, lineHeight: 14 \}/.test(kode) &&
    !/cellDate: \{[^}]*minWidth/.test(kode));
  ok('semua kolom CL memakai SATU angka lebar (48), termasuk yang jadi tombol',
    (kode.match(/minWidth: 48/g) ?? []).length === 2 &&
    /cell: \{ flex: 1, minWidth: 48,/.test(kode) &&
    /cellTap: \{ flex: 1, minWidth: 48,/.test(kode));
  ok('garisnya tetap dipasang di SETIAP baris, bukan cuma sekali',
    (kode.match(/<SumLine \/>/g) ?? []).length === 4);
  ok('garisnya menembus padding barisnya supaya bersambung antar-baris',
    /sumLine: \{[\s\S]{0,200}alignSelf: 'stretch',[\s\S]{0,120}marginVertical: -8,/.test(kode));
}

// ===================================================================
console.log('\n=== 2. Lambang jenis acara bisa di-click ===');
{
  const core = baca('lib/core.ts');
  const jenis = [...core.matchAll(/\{ key: '(\w+)', label: '([^']+)', icon: '([^']+)', desc: '([^']+)'/g)];
  ok('kesepuluh jenis pertemuan punya penjelasannya sendiri', jenis.length === 10, String(jenis.length));
  ok('penjelasannya kalimat utuh, bukan ulangan namanya',
    jenis.every(([, , label, , desc]) => desc.length > 30 && desc !== label));
  ok('tanpa em dash di penjelasannya (aturan teks app ini)',
    jenis.every(([, , , , desc]) => !desc.includes(String.fromCharCode(0x2014))));
  ok('kolom jenis di tabel jadi tombol, dan yang dibuka meta jenisnya',
    /<PressableScale\s*\n\s*style=\{styles\.labelBtn\}\s*\n\s*onPress=\{\(\) =>\s*\n?\s*setKindInfo\(\{\s*\n\s*icon: meta\.icon,\s*\n\s*label: meta\.label,\s*\n\s*desc: meta\.desc,/.test(recap));
  // 28 Sep 2026: sejak awal ia memang bisa di-click, tapi tidak ada satu pun
  // tanda bahwa ia bisa — jadi penjelasan tiap jenis acara praktis tak pernah
  // ditemukan. Sekarang berlatar pil, dan itu yang dijaga di sini.
  ok('…dan KELIHATAN seperti tombol (pil berlatar, bukan lambang telanjang)',
    /labelBtn: \{[\s\S]{0,220}borderRadius: 8,[\s\S]{0,60}backgroundColor: Color\.CORE,/.test(recap));
  ok('baris 📅 Thanksgiving ikut bisa di-click (keterangannya sendiri, bukan jenis acara)',
    /onPress=\{\(\) => setKindInfo\(INFO_THANKSGIVING\)\}/.test(recap) &&
    /const INFO_THANKSGIVING: KindInfo = \{/.test(recap));
  ok('yang muncul dialog TENGAH layar, bukan sheet dari bawah',
    /<CenterDialog visible=\{kindInfo !== null\}/.test(recap) &&
    /import \{ CenterDialog \} from '@\/components\/common\/CenterDialog';/.test(recap));
}

// ===================================================================
console.log('\n=== 3. Hati CORE bisa di-click → data CL-nya ===');
{
  ok('hatinya jadi tombol, membawa CL barisnya',
    /onPress=\{\(\) => setLeaderInfo\(l\)\}/.test(recap) &&
    /<CenterDialog visible=\{leaderInfo !== null\}/.test(recap));
  ok('judul dialognya hati + nama CL-nya',
    /\{leaderInfo\.heart\} \{leaderInfo\.name\}/.test(recap));
  // Yang paling penting: isinya komponen yang SAMA dengan modal baca-saja di
  // tab CORE Leader. Menyalinnya berarti dua daftar kolom yang harus diingat
  // untuk diubah bersamaan, dan yang pertama meleset biasanya isinya.
  ok('isinya komponen bersama PersonInfo, bukan salinan',
    /<PersonInfo person=\{leaderInfo\} today=/.test(recap) &&
    /export function PersonInfo\(\{/.test(personInfo) &&
    /<PersonInfo person=\{viewing\.person\}/.test(baca('components/core/LeadersTab.tsx')));
  ok('umurnya memang ikut (yang diminta: "data umum seperti umur")',
    /currentAge\(person, today\)/.test(personInfo) &&
    /🎂 Tanggal Lahir/.test(personInfo) && /🎈 Ulang Tahun/.test(personInfo));
  ok('salinan lamanya benar-benar dicabut dari LeadersTab',
    !/function PersonView\(/.test(baca('components/core/LeadersTab.tsx')));
}

// ===================================================================
console.log('\n=== 4. Sheet Share: keterangan dibuang, kaki tidak tertutup ===');
{
  const share = baca('components/core/ShareToLeaderSheet.tsx');
  ok('paragraf "Click nama CL: PDF-nya dibagikan…" sudah tidak ada',
    !/Click nama CL/.test(tanpaKomentar(share)) && !/styles\.hint/.test(share));
  ok('pilihannya tetap terbaca dari barisnya sendiri (ikon share + 💬)',
    /<EmojiButton\s*\n\s*emoji="💬"/.test(share) &&
    /IconSymbol name="square\.and\.arrow\.up"/.test(share));
  const sheet = baca('components/common/SheetModal.tsx');
  // Batang beranda iPhone 15 setinggi 34pt; paddingBottom tetap 30 membuat
  // baris terakhir daftar duduk tepat di belakangnya.
  ok('kaki sheet ikut tinggi batang beranda perangkat, bukan angka tetap',
    /import \{ useSafeAreaInsets \} from 'react-native-safe-area-context';/.test(sheet) &&
    /const bottomPad = Math\.max\(BOTTOM_GAP, insets\.bottom \+ 14\);/.test(sheet) &&
    /paddingBottom: bottomPad/.test(sheet));
  ok('angka lamanya tidak tertinggal di gaya sheet',
    !/sheet: \{[^}]*paddingBottom/.test(tanpaKomentar(sheet)) &&
    /const BOTTOM_GAP = 30;/.test(sheet));
}

// ===================================================================
console.log('\n=== 5. Tanggal ekspor terakhir & tagihannya ===');
{
  const kosong = { lastDayId: '', docCount: 0 };
  ok('belum pernah diekspor → umurnya null, dan itu JUGA dihitung "sudah waktunya"',
    B.backupAgeDays(kosong, '2026-09-27') === null && B.backupDue(kosong, '2026-09-27') === true);
  ok('umurnya dihitung benar (hari ini · kemarin · 30 hari)',
    B.backupAgeDays({ lastDayId: '2026-09-27', docCount: 9 }, '2026-09-27') === 0 &&
    B.backupAgeDays({ lastDayId: '2026-09-26', docCount: 9 }, '2026-09-27') === 1 &&
    B.backupAgeDays({ lastDayId: '2026-08-28', docCount: 9 }, '2026-09-27') === 30);
  ok(`ditagih tepat sesudah ${B.BACKUP_EVERY_DAYS} hari, bukan sebelumnya`,
    B.backupDue({ lastDayId: '2026-08-29', docCount: 9 }, '2026-09-27') === false &&
    B.backupDue({ lastDayId: '2026-08-28', docCount: 9 }, '2026-09-27') === true);
  const baris = B.backupLine({ lastDayId: '2026-09-26', docCount: 1360 }, '2026-09-27');
  ok('barisnya menyebut TANGGALNYA, bukan cuma "1 hari lalu"',
    /26 Sep 2026/.test(baris) && /kemarin/.test(baris) && /1360 dokumen/.test(baris), baris);
  ok('belum pernah → kalimatnya jujur, bukan tanggal kosong',
    B.backupLine(kosong, '2026-09-27') === '📦 Belum pernah diekspor sama sekali');
  ok('tanpa em dash di kedua kalimatnya',
    ![baris, B.backupDueLine(kosong, '2026-09-27')].some((t) => t.includes(String.fromCharCode(0x2014))));
  const sys = baca('app/system.tsx');
  ok('dicatat SESUDAH share sheet, bukan sesudah dibaca (yang belum disimpan bukan cadangan)',
    /await shareExport\(hasil\.json, exportFileName\(todayId\)\);\s*\n(\s*\/\/[^\n]*\n)*\s*await recordBackup\(user\.uid, todayId, hasil\.docCount\)/.test(sys));
  ok('layar System menampilkan tanggalnya & berganti jadi ajakan kalau sudah waktunya',
    /backupLine\(backup, todayId\)/.test(sys) && /perluCadangan \? styles\.backupDue : styles\.backupLast/.test(sys) &&
    /backupDueLine\(backup, todayId\)/.test(sys));
  // Tagihan yang cuma ada di layar System tidak akan pernah terlihat: layar
  // itu memang tidak dibuka sebulan sekali. Jadi ia ikut masuk daftar Today.
  ok('ikut jadi baris Today (jadi pengingat 🌿 Life sore hari ikut menyebutnya)',
    /if \(backupDue\(input\.backup, todayId\)\) \{/.test(baca('lib/today.ts')) &&
    /id: 'backup',/.test(baca('lib/today.ts')));
  ok('koleksinya sudah terdaftar di ekspor (catatannya ikut tercadangkan)',
    /'app',/.test(baca('lib/dataExport.ts')) &&
    /doc\(db, 'users', uid, 'app', 'backup'\)/.test(baca('lib/backup.ts')));
  // Mesin Today itu fungsi MURNI yang dijalankan suite tanpa modul native.
  ok('lib/backup terpisah dari lib/dataExport (Today Engine tak ikut menyeret expo-sharing)',
    !/expo-sharing|expo-file-system/.test(tanpaKomentar(baca('lib/backup.ts'))) &&
    !/from '\.\/dataExport'/.test(baca('lib/today.ts')));
}

// ===================================================================
console.log('\n=== 6. Tab Steps dipisah per periode + 3 bulan & setahun ===');
{
  const steps = baca('components/health/StepsTab.tsx');
  // 3 Okt 2026 (review Health, disetujui pemilik app): bulan, 3 bulan, &
  // setahun DIGABUNG jadi satu kartu Rekap — kepalanya tinggal tiga, tetap
  // urut dari yang terpendek, dan setahun tetap PALING BAWAH di kartunya.
  const urut = ['JUDUL_HARI', 'JUDUL_MINGGU', 'JUDUL_REKAP'];
  ok('tiga kepala periode, urut dari yang terpendek ke terpanjang',
    urut.every((n, i) => steps.indexOf(`{${n}}`) > 0 && (i === 0 || steps.indexOf(`{${urut[i - 1]}}`) < steps.indexOf(`{${n}}`))),
    urut.map((n) => `${n}@${steps.indexOf(`{${n}}`)}`).join(' '));
  ok('per tahun memang PALING BAWAH, seperti yang diminta',
    steps.indexOf('title: `🏁 ${now.getFullYear()}`') > steps.indexOf('title: `📊 Q${q.q} ${q.year}`') &&
      steps.indexOf('title: `📊 Q${q.q} ${q.year}`') > steps.indexOf('title: `🗓️ ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`'));
  // Patokan jarak harian ala pelari DIBUANG (3 Okt 2026) — jarak dari langkah
  // itu jalan kaki; gantinya target 10.000 langkah di kartu hari ini.
  ok('patokan jarak HARIAN diganti target langkah harian',
    !/Patokan Jarak Harian/.test(steps) && /total=\{DAY_STEP_GOAL\}/.test(steps));
  ok('kartu Rekap tetap menyebut kapan tiap periodenya mulai dari nol lagi',
    /tanggal 1, kuartal tiap Jan · Apr · Jul · Okt, tahun tiap 1 Januari/.test(steps) &&
    /\{RESET_REKAP\}/.test(steps));
  ok('kuartal kalender, sekeluarga dengan Wheel of Life',
    JSON.stringify(H.quarterMonthIds(new Date(2026, 8, 27))) === JSON.stringify(['2026-07', '2026-08', '2026-09']) &&
    JSON.stringify(H.quarterOfDate(new Date(2026, 8, 27))) === JSON.stringify({ year: 2026, q: 3 }));
  ok('batas kuartalnya benar di ujung tahun (Des → Q4, Jan → Q1)',
    H.quarterOfDate(new Date(2026, 11, 31)).q === 4 && H.quarterOfDate(new Date(2027, 0, 1)).q === 1);
  const hari = { '2026-07-01': 1000, '2026-09-27': 2000, '2025-12-31': 9000 };
  ok('dijumlah lewat AWALAN dayId, bukan daftar 91/365 tanggal',
    H.stepsInPrefixes(hari, H.quarterMonthIds(new Date(2026, 8, 27))) === 3000 &&
    H.stepsInPrefixes(hari, ['2026']) === 3000 &&
    H.stepsInPrefixes(hari, ['2025']) === 9000);
  ok('patokan 3 bulan & setahun = kelipatan patokan bulanan (3× dan 12×)',
    H.RUN_QUARTER_MILESTONES.map((m) => m.km).join(',') === '300,600,900' &&
    H.RUN_YEAR_MILESTONES.map((m) => m.km).join(',') === '1200,2400,3600');
  // Minggu ini tetap kartu besarnya sendiri; tiga periode panjang satu kartu.
  ok('minggu ini kartu sendiri, tiga periode panjang SATU kartu Rekap',
    (steps.match(/<MileageCard/g) ?? []).length === 1 &&
      (steps.match(/<RecapCard/g) ?? []).length === 1);
}

// ===================================================================
console.log('\n=== 7. Notifikasi target Learning sesuai hari & jamnya ===');
{
  ok('tiap langkah menyimpan jam pengingatnya sendiri',
    L.LEARNING_STEPS.every((s) => Array.isArray(s.remindAt) && s.remindAt.length > 0));
  ok('Sen/Rab/Jum dua jendela (08.00 & 20.00) — pagi & malam sama-sama sah',
    L.LEARNING_STEPS.filter((s) => s.key !== 'share').every((s) => s.remindAt.join(',') === '8,20'));
  ok('Minggu "Ceritakan" cukup sekali sore (jamnya memang tidak dipatok)',
    L.LEARNING_STEPS.find((s) => s.key === 'share').remindAt.join(',') === '17');
  // pos memakai minggu Senin-dulu (Sen=0 … Min=6); pemicu WEEKLY iOS memakai
  // Minggu-dulu mulai dari 1. Salah terjemah = notifikasi berbunyi di hari
  // yang salah, dan itu tidak ketahuan sampai harinya tiba.
  ok('terjemahan hari ke penomoran iOS benar (Sen=2 · Rab=4 · Jum=6 · Min=1)',
    [L.learningWeekday(0), L.learningWeekday(2), L.learningWeekday(4), L.learningWeekday(6)].join(',') === '2,4,6,1');
  const notify = baca('lib/notify.ts');
  ok('slot berhari-tetap dijadwalkan WEEKLY, yang lain tetap DAILY',
    /s\.weekday === undefined\s*\n\s*\? \{ type: DAILY, hour: s\.hour, minute: s\.minute \}\s*\n\s*: \{ type: WEEKLY, weekday: s\.weekday, hour: s\.hour, minute: s\.minute \}/.test(notify));
  // 2 Okt 2026: tanggal slot sekali-jalan (⏰ reminder berjam) ikut di depannya.
  ok('harinya ikut masuk sidik jadwal (ganti hari = dijadwalkan ulang)',
    /\$\{s\.date \?\? s\.weekday \?\? '\*'\}/.test(notify));
  ok('kelompoknya bisa dimatikan sendiri seperti kelompok lain',
    /\{ key: 'learning', emoji: '🎓', label: 'Target Learning'/.test(notify));
  // buildSlots itu fungsi MURNI — harinya harus datang dari dayId yang
  // dioper, bukan dari jam sistem.
  ok('hari pekannya dihitung dari dayId yang dioper, bukan dari jam sistem',
    /const \[thn, bln, tgl\] = dayId\.split\('-'\)\.map\(Number\);/.test(notify) &&
    !/new Date\(\)\.getDay\(\)/.test(notify));
}

// ===================================================================
console.log('\n=== 8. Family ↔ News ↔ Book berputar ===');
{
  const grid = baca('lib/featureGrid.ts');
  const no = Object.fromEntries(
    [...grid.matchAll(/\{ key: '(\w+)', sort: ([\d.]+),/g)].map((m) => [m[1], Number(m[2])]),
  );
  ok('Book naik ke tempat Family (8), Family ke tempat News (11), News ke tempat Book (12)',
    no.book === 8 && no.family === 11 && no.news === 12,
    `book=${no.book} family=${no.family} news=${no.news}`);
  ok('tidak ada nomor kembar sesudah ditukar',
    new Set(Object.values(no)).size === Object.keys(no).length);
  // Akibat ikutan yang harus ikut dibereskan: Book jadi bersebelahan dengan
  // Learning, dan pastel lamanya cuma berjarak ΔE9 dari Learning — di bawah
  // ambang ΔE10 untuk tile yang bersebelahan (lihat cek-warna-fitur.js).
  ok('pastel Book digeser supaya tidak terbaca sewarna Learning',
    /BOOK: '#C6B3EE'/.test(baca('assets/style/color.ts')));
}

// ===================================================================
console.log('\n=== 9. Lencana Distance dipisah per periode ===');
{
  const kelompok = RW.rewardGroups('run');
  ok('lima kelompok: sehari · sepekan · sebulan · 3 bulan · setahun',
    kelompok.map((g) => g.label).join(' | ') === '⏱️ Sehari | 📅 Sepekan | 🗓️ Sebulan | 📊 3 Bulan | 🏁 Setahun',
    kelompok.map((g) => g.label).join(' | '));
  ok('tidak ada lencana yang hilang saat dikelompokkan',
    kelompok.reduce((n, g) => n + g.items.length, 0) ===
      RW.REWARDS.filter((a) => a.category === 'run').length);
  ok('3 bulan & setahun memang ada isinya (bukan kelompok kosong)',
    kelompok[3].items.length === 3 && kelompok[4].items.length === 3);
  ok('kategori yang periodenya TUNGGAL tetap satu grid tanpa kepala',
    RW.rewardGroups('login').length === 1 && RW.rewardGroups('login')[0].label === null &&
    RW.rewardGroups('water').length === 1);
  ok('Weekly Steps & Weekly Strength ikut terpisah (sepekan · sebulan · 3 bulan)',
    RW.rewardGroups('week').map((g) => g.label).join(',') === '📅 Sepekan,🗓️ Sebulan,📊 3 Bulan' &&
    RW.rewardGroups('strength').map((g) => g.label).join(',') === '📅 Sepekan,🗓️ Sebulan,📊 3 Bulan');
  ok('rekor 3 bulan & setahun dihitung dari riwayat langkah yang sama',
    typeof H.runRecords({ '2026-07-01': 20000, '2026-08-01': 20000 }, 170).bestQuarterKm === 'number' &&
    H.runRecords({ '2026-07-01': 20000, '2026-08-01': 20000 }, 170).bestYearKm >
      H.runRecords({ '2026-07-01': 20000 }, 170).bestYearKm);
  ok('halaman kategorinya menggambar per kelompok, bukan satu grid panjang',
    /\{kelompok\.map\(\(g, gi\) => \(/.test(baca('app/reward-category.tsx')) &&
    /rewardGroups\(key\)/.test(baca('app/reward-category.tsx')));
}

// ===================================================================
console.log('\n=== 10. Streak baca Alkitab yang putus kelihatan ===');
{
  const jalan = { count: 3, lastDayId: '2026-09-27', best: 9, total: 40 };
  const kemarin = { count: 3, lastDayId: '2026-09-26', best: 9, total: 40 };
  const bolos = { count: 3, lastDayId: '2026-09-24', best: 9, total: 40 };
  ok('dicatat hari ini atau kemarin → streaknya masih hidup',
    S.activeDayStreak(jalan, '2026-09-27') === 3 && S.activeDayStreak(kemarin, '2026-09-27') === 3);
  // Inilah keluhannya: angka di Firestore cuma diperbarui saat ada yang
  // DICATAT, jadi sesudah bolos sehari ia masih memamerkan angka lama.
  ok('bolos sehari → 0, walau angka tersimpannya masih 3',
    S.activeDayStreak(bolos, '2026-09-27') === 0 && bolos.count === 3);
  ok('belum pernah sama sekali → 0, bukan error',
    S.activeDayStreak(null, '2026-09-27') === 0);
  ok('hari sebelumnya dihitung murni dari dayId (lewat awal bulan pun benar)',
    S.prevDayId('2026-09-01') === '2026-08-31' && S.prevDayId('2027-01-01') === '2026-12-31');
  ok('bentuk idnya dirangkai lib/format, tidak disusun sendiri di lib/streak',
    /import \{ dayId, dayIdToDate \} from '\.\/format';/.test(baca('lib/streak.ts')) &&
    !/padStart/.test(baca('lib/streak.ts')));
  const spiritual = baca('lib/spiritual.ts');
  ok('lib/spiritual punya pintunya sendiri: yang berjalan & rekornya',
    /export function bibleStreakNow\(/.test(spiritual) && /export function bibleStreakBest\(/.test(spiritual));
  // Nyambung ke Walk: tab Bible Reading.
  const tab = baca('components/spiritual/BibleReadingTab.tsx');
  ok('tab Bible Reading (Walk) memakai angka yang MASIH hidup, bukan count mentah',
    /const streak = bibleStreakNow\(streaks, session, todayId\);/.test(tab) &&
    /const rekor = bibleStreakBest\(streaks, session\);/.test(tab));
  ok('yang putus dikatakan apa adanya, dan rekornya tetap disebut',
    /💤 Streak \$\{meta\.label\.toLowerCase\(\)\} lagi kosong/.test(tab) &&
    /🏆 rekor \{rekor\}/.test(tab));
  // Nyambung ke Habits: tiga baris cermin Bible Reading.
  const habits = baca('components/habits/HabitsTab.tsx');
  ok('tiga baris cermin di Habits ikut menyebut streaknya',
    /const sesiBaca = bibleSessionOfMirror\(link\?\.mirrorOf\);/.test(habits) &&
    /bibleStreakNow\(bibleStreaks, sesiBaca, dayId\)/.test(habits));
  ok('cermin → sesi diterjemahkan di SATU tempat (lib/habits), bukan ditebak di layar',
    /export function bibleSessionOfMirror\(/.test(baca('lib/habits.ts')));
  ok('layar Habits & Walk sama-sama melanggan dokumen streak yang sama',
    /subscribeBibleStreaks\(uid, setBibleStreaks, fail\)/.test(baca('app/habits.tsx')) &&
    /subscribeBibleStreaks\(uid, setBibleStreaks, fail\)/.test(baca('app/(tabs)/walk.tsx')));
  // Angka di pojok kanan atas halaman kategori Reward dulu memakai `best`
  // (rekor), tapi satuannya tertulis "hari streak". Itu keliru.
  ok('halaman Reward baca Alkitab menyebut streak BERJALAN, bukan rekornya',
    /now: \(s\) => s\.bibleMorningNow/.test(baca('lib/reward.ts')) &&
    /now: \(s\) => s\.bibleNightNow/.test(baca('lib/reward.ts')));
  ok('lencananya TETAP memakai rekor — yang sudah terbuka tidak boleh dicabut',
    /streakLadder\('bibleMorning', 'bibleMorning', 'Baca Alkitab pagi', \(s\) => s\.bibleMorningBest\)/.test(baca('lib/reward.ts')) &&
    /streakLadder\('bibleNight', 'bibleNight', 'Baca Alkitab malam', \(s\) => s\.bibleNightBest\)/.test(baca('lib/reward.ts')));
}

// ===================================================================
console.log('\n=== Aturan wajib ===');
{
  const baru = [
    'app/core-recap.tsx', 'components/core/PersonInfo.tsx', 'lib/backup.ts',
    'components/health/StepsTab.tsx', 'components/spiritual/BibleReadingTab.tsx',
    'app/reward-category.tsx',
  ].map(baca).join('\n');
  const kode = tanpaKomentar(baru);
  ok('tidak ada hex mentah di layar (warnanya dari Color)',
    !/#[0-9A-Fa-f]{6}/.test(kode));
  ok('tanpa soft-delete diselundupkan', !/isDeleted|archived: true/.test(kode));
  ok('istilahnya "Click", tanpa tekan/ketuk/tap/klik',
    !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(kode));
  ok('tanpa em dash di teks yang terbaca', !kode.includes(String.fromCharCode(0x2014)));
  ok('tanpa modul native baru (cukup eas update)',
    !/expo-media-library|react-native-[a-z-]+/.test(kode.replace(/react-native-safe-area-context|react-native-reanimated|react-native-gesture-handler/g, '')));
  ok('nama koleksi Firestore tidak ada yang diganti (catatan baru menumpang "app")',
    /doc\(db, 'users', uid, 'app', 'backup'\)/.test(baca('lib/backup.ts')));
}

console.log(gagal === 0
  ? '\n✅ LULUS — kesepuluh permintaan 27 Sep terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
