// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Empat permintaan (3 Sep 2026):
//   1. Race: foto medali pindah ke kanan, sepertiga lebar kartu.
//   2. Program: jadwalnya jadi dropdown + Blok C (bisep & persiapan race).
//   3. Bagian "Aplikasi" pindah ke layar sendiri berjudul Version.
//   4. Badge Stuff ikut ke Home, baris berbadge bergaris MERAH, artinya
//      dijelaskan, dan tiap badge punya reminder di Dashboard.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-empat-baru');
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const ada = (f) => fs.existsSync(R + f);
// Komentar dibuang — kalimat penjelas sering menyebut identifier yang justru
// sedang diuji ADA/TIDAKNYA di kode.
const kode = (f) =>
  baca(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi lib yang perlu dijalankan sungguhan ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/fitness.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      doc: () => ({}), setDoc: () => Promise.resolve(), getDoc: () => ({}),
      collection: () => ({}), deleteDoc: () => {}, getDocs: () => {},
      onSnapshot: () => {}, orderBy: () => {}, query: () => {}, where: () => {},
      limit: () => {}, writeBatch: () => ({}),
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
};
const M = (n) => {
  for (const k of [`lib/${n}.js`, `${n}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${n}.ts`);
  process.exit(1);
};
const fit = require(M('fitness'));
Module._load = asli;

// =====================================================================
console.log('\n== 1. Race: foto medali di kanan, sepertiga lebar ==');
// =====================================================================
const arsip = baca('components/fun/FunArchive.tsx');

c('kartunya jadi dua kolom saat ada fotonya', /styles\.medalRow/.test(arsip));
// 2 : 1 = keterangan dua pertiga, foto sepertiga. Kalau angkanya digeser,
// permintaan "1/3" tidak lagi terpenuhi.
c('keterangan 2 bagian : foto 1 bagian (= sepertiga lebar)',
  /medalMain: \{ flex: 2, minWidth: 0, gap: 6 \}/.test(arsip) &&
  /medalThumb: \{\s*\n\s*flex: 1,/.test(arsip));
c('tingginya ikut lebarnya sendiri, bukan angka tetap',
  /aspectRatio: 1,/.test(arsip) && !/height: 170/.test(arsip));
c('yang tanpa foto tetap satu kolom seperti dulu',
  /\) : \(\s*\n\s*keterangan\s*\n\s*\)/.test(arsip));
c('fotonya cuma untuk Race yang memang punya medali',
  /item\.category === 'race' && item\.medalPhoto/.test(arsip));

// =====================================================================
console.log('\n== 2. Program: dropdown hari + Blok C ==');
// =====================================================================
const prog = baca('components/fitness/ProgramTab.tsx');

c('harinya dipilih lewat dropdown, bukan ditumpuk ketujuhnya',
  /<SelectField/.test(prog) && !/FIT_PROGRAM\[block\]\.map/.test(prog));
c('bawaannya HARI INI', /useState\(String\(todayWeekday\)\)/.test(prog));
c('ganti blok TIDAK memindahkan harinya (tiap blok punya ketujuh hari)',
  !/setHari\(/.test(prog.slice(prog.indexOf('<SegmentTabs'), prog.indexOf('</SegmentTabs') + 1)));
c('hari ini ditandai di daftar pilihannya', /● hari ini/.test(prog));

console.log('\n   Blok C');
c('bloknya bertiga sekarang',
  JSON.stringify(fit.FIT_BLOCK_ORDER) === '["A","B","C"]',
  fit.FIT_BLOCK_ORDER.join(','));
c('Blok C punya ketujuh hari, sama seperti A & B',
  [0, 1, 2, 3, 4, 5, 6].every((w) =>
    fit.FIT_PROGRAM.C.some((s) => s.weekday === w)),
  fit.FIT_PROGRAM.C.map((s) => s.weekday).join(','));
// Fokusnya BISEP: gerakan curl muncul di tiga hari berbeda, bukan sekali
// sebagai penutup seperti di blok A & B.
const hariBisep = fit.FIT_PROGRAM.C.filter((s) =>
  s.exercises.some((e) => /curl/i.test(e.id))).length;
c('bisep dilatih di TIGA hari (itu yang membedakannya dari A & B)',
  hariBisep === 3, `${hariBisep} hari`);
const bisepAB = ['A', 'B'].map((b) =>
  fit.FIT_PROGRAM[b].filter((s) => s.exercises.some((e) => /curl/i.test(e.id))).length);
c('di blok A & B bisepnya memang lebih sedikit',
  bisepAB.every((n) => n < hariBisep), bisepAB.join(' & '));

const mingguC = fit.FIT_PROGRAM.C.find((s) => s.weekday === 0);
c('Minggu di blok C = lari persiapan race, bukan jalan pagi',
  mingguC.kind === 'run' && /longrun/.test(mingguC.exercises.map((e) => e.id).join(',')),
  `${mingguC.kind} · ${mingguC.title}`);
// Konsekuensinya nyata: hari `run` IKUT streak 🔥 (lihat fitDayComplete &
// settleFitDays), sedangkan `walk` tidak pernah. Harus diberitahu.
c('Minggu di blok A & B tetap disarankan jalan pagi',
  ['A', 'B'].every((b) => fit.FIT_PROGRAM[b].find((s) => s.weekday === 0).kind === 'walk'));
// Peringatan lama ("di blok C, Minggu IKUT streak") sudah tidak berlaku:
// sejak Fitness dirombak, semua hari yang tuntas ikut streak — tak ada lagi
// hari istimewa. Yang perlu diberitahu sekarang justru hal yang lebih besar:
// seluruh halaman ini cuma saran, dan yang memutuskan kamu.
c('halaman ini menawarkan, bukan menentukan',
  /Ambil untuk hari ini/.test(prog) && /applyFitPicks\(/.test(prog));
// Blok pengingat pemulihan dihapus pemiliknya dari halaman ini (10 Sep 2026).
// Yang dijaga tinggal pokoknya: hari jalan TIDAK boleh dipatok "Rabu & Minggu"
// di mana pun, karena blok C tidak begitu — dan sekarang hari mana pun boleh
// jadi hari jalan, karena kamu yang memilihnya.
c('tak ada hari jalan yang dipatok di teks mana pun',
  !/Rabu & Minggu/.test(prog) && !/hariJalan/.test(prog));
// Beban tersimpan menempel pada id gerakan — id yang dipakai ulang berarti
// bebannya langsung terbawa, bukan mulai dari saran awal lagi.
const idC = new Set(fit.FIT_PROGRAM.C.flatMap((s) => s.exercises.map((e) => e.id)));
const idAB = new Set(['A', 'B'].flatMap((b) =>
  fit.FIT_PROGRAM[b].flatMap((s) => s.exercises.map((e) => e.id))));
const dipakaiUlang = [...idC].filter((id) => idAB.has(id)).length;
c('sebagian gerakannya memakai id lama → beban tersimpanmu ikut terbawa',
  dipakaiUlang >= 8, `${dipakaiUlang} dari ${idC.size} gerakan`);

// =====================================================================
console.log('\n== 3. Layar Version terpisah dari System ==');
// =====================================================================
const sistem = baca('app/system.tsx');
const versi = baca('app/app-version.tsx');

c('layarnya ada', ada('app/app-version.tsx'));
c('judulnya "Version"', /title="Version 📱"/.test(versi));
c('rutenya terdaftar di _layout', /name="app-version"/.test(baca('app/_layout.tsx')));
c('typed routes sudah di-regen', /app-version/.test(baca('.expo/types/router.d.ts')));
// 23 Sep 2026: judul System pindah ke <ScreenHeader/> (pita warna tile-nya),
// dan kedua pilnya duduk di slot `right` pita itu — tetap di pojok kanan judul.
c('tombolnya pil di pojok kanan judul System, menuju layar Version',
  /<ScreenHeader[\s\S]{0,300}right=\{/.test(sistem) &&
  /router\.push\('\/app-version'\)/.test(sistem) &&
  /styles\.appButtonText/.test(sistem));

console.log('\n   Isinya benar-benar PINDAH, bukan disalin');
for (const potong of ['Versi Aplikasi', 'Update Terbaru', 'Update ID', 'Runtime', 'Channel']) {
  c(`"${potong}" ada di Version & sudah tidak di System`,
    versi.includes(potong) && !sistem.includes(potong));
}
c('tombol update & pesannya ikut pindah',
  /checkForUpdateAsync/.test(versi) && !/checkForUpdateAsync/.test(sistem));
c('laporan pemakaian TETAP di System',
  /topFeatures/.test(sistem) && !/topFeatures/.test(versi));
c('tak ada sisa kode mati di System',
  !/APP_BIRTHDAY|handleCheckUpdate|appAgeDays/.test(sistem));

// =====================================================================
console.log('\n== 4. Badge: satu aturan di seluruh app ==');
// =====================================================================
const home = baca('app/(tabs)/index.tsx');
const badge = baca('components/common/Badge.tsx');
const dash = baca('app/reminders.tsx');

console.log('\n   a. Badge tile Device');
// Sub-tab Stuff 📦 DIHAPUS TOTAL (3 Sep 2026) — badge Device sekarang cuma
// soal paket kuota. Yang tetap dijaga: angkanya dari lib yang sama dengan
// badge sub-tabnya, bukan ditulis ulang di layar.
c('baris Device di Today = paket kuota yang sudah H-1 (22 Sep 2026)',
  /devicesNeedingTopUp\(input\.dataPlans, now\)/.test(BACA_TODAY('lib/today.ts')));
c('tak ada sisa Stuff di Home', !/[Ss]tuff/.test(home));
// Gerbangnya menghitung berapa sumber yang ditunggu — angkanya boleh naik
// (tiap sumber badge baru menambah satu). Yang dijaga HUBUNGANNYA: kelebihan =
// badge tak pernah muncul, kekurangan = badge digambar sebelum semua datanya
// tiba, jadi angkanya sempat salah.
c('jumlah sumber badge = jumlah mark() yang sesungguhnya', (() => {
  const data = BACA_TODAY('hooks/useTodayData.ts');
  const gerbang = Number((data.match(/const SOURCES = (\d+);/) || [])[1]);
  return gerbang > 0 && gerbang === (data.match(/mark\('/g) || []).length;
})(), `${(BACA_TODAY('hooks/useTodayData.ts').match(/mark\('/g) || []).length} mark()`);
c('aturannya sama dengan badge sub-tabnya, bukan ditulis ulang',
  /deviceNeedsTopUp\(plans \?\? \[\], 'iphone', now\)/.test(baca('app/device.tsx')));

console.log('\n   b. Baris berbadge bergaris MERAH');
c('garis merahnya satu sumber di components/common/Badge.tsx',
  /export function attentionBorder/.test(badge) &&
  /attention: \{ borderColor: Color\.DANGER \}/.test(badge));
// Tebalnya sengaja tidak diubah — kalau ikut ditebalkan, barisnya bergeser
// sedikit tiap kali badge-nya menyala/padam.
c('tebal garisnya tidak ikut diubah (baris tidak bergeser saat menyala)',
  !/attention: \{[^}]*borderWidth/.test(badge));

const PEMAKAI = [
  'components/device/PlanTab.tsx',
  'components/friends/SplitBillTab.tsx',
  'components/career/FreelanceTab.tsx',
  'components/career/FulltimeTab.tsx',
  'components/core/VisitationTab.tsx',
  'components/core/FollowupTab.tsx',
  'components/tasks/PriorityTab.tsx',
  'components/learning/WeekTab.tsx',
  'components/learning/DiscussionTab.tsx',
  'components/fitness/ExerciseTab.tsx',
  'components/common/UpkeepList.tsx',
  'app/debts.tsx',
];
const tanpaGaris = PEMAKAI.filter((f) => !/attentionBorder\(/.test(baca(f)));
c('SEMUA daftar berbadge memakai garis merah yang sama',
  tanpaGaris.length === 0, tanpaGaris.join(' · '));
// Dua penanda pada baris yang sama harus dipasang dari SYARAT yang sama —
// kalau tidak, ada kartu bergaris merah tanpa titik (atau sebaliknya).
c('tiap pemakainya juga menggambar titiknya',
  PEMAKAI.every((f) => /<AttentionMark corner \/>/.test(baca(f))));

console.log('\n   d. Tiap badge punya reminder di Dashboard');
const kartuBadge = baca('components/reminders/BadgeReminders.tsx');
c('kartunya digambar dari HOME_FEATURES → warnanya = warna tile-nya',
  /HOME_FEATURES\.map/.test(kartuBadge) &&
  /bg=\{f\.bg\}/.test(kartuBadge) && /fg=\{f\.fg\}/.test(kartuBadge));
c('bentuknya ReminderCard, sama seperti kartu Dashboard lain',
  /<ReminderCard/.test(kartuBadge));
// Friends 🤝 lulus dari kartu kalimat umum: begitu barisnya bisa menyebut sesi
// & tagihan yang sesungguhnya, ia pindah jadi kartunya sendiri di Dashboard.
// Yang dijaga tetap sama — badge menyala WAJIB ada kartunya.
c('Device masih di kartu umum; Friends sudah punya kartunya sendiri',
  /device: \{/.test(kartuBadge) && !/friends: \{/.test(kartuBadge) &&
  /🤝 Reminder Friends/.test(dash));
c('tiap kartu menyebut APA penyebabnya & APA yang harus dilakukan',
  /apa: string/.test(kartuBadge) && /aksi: string/.test(kartuBadge));
c('kartunya menuju fiturnya sendiri', /router\.push\(f\.route\)/.test(kartuBadge));
c('Dashboard memakainya', /<BadgeReminders counts=\{badgeCounts\} \/>/.test(dash));
c('angkanya dihitung dengan aturan yang sama persis dengan badge-nya',
  /device: devicesNeedingTopUp\(dataPlans, now\),/.test(dash) &&
  // Baris Friends memakai penyaring yang SAMA dengan angka badge-nya
  // (sessionNeedsAttention di futsalReminders + billUnsettled) — kartu & badge
  // tak boleh pernah berselisih.
  /futsalReminders\(futsal, now\)/.test(dash) &&
  /\.filter\(billUnsettled\)/.test(dash) &&
  /sessionNeedsAttention\(s, now\)/.test(baca('lib/futsal.ts')));
// Kalau tidak ikut dihitung, Dashboard mengira "tidak ada tagihan hari ini"
// lalu memunculkan kartu produktivitas — padahal ada badge menyala.
c('ikut dihitung sebagai "ada yang harus dikerjakan"',
  /anyBadgeReminder\(badgeCounts\)/.test(dash) && /friendsRows\.length > 0 \|\|/.test(dash));
c('sumber datanya benar-benar dilangganan di Dashboard',
  /subscribeBills\(uid, setBills\)/.test(dash) &&
  /subscribeDataPlans\(uid, setDataPlans\)/.test(dash));
// Fitur yang sudah punya kartunya sendiri tidak boleh dapat kartu kedua.
c('yang sudah punya kartu khusus tidak digandakan',
  !/(^|\s)(tasks|career|core|spiritual|car|residence|fitness|learning|finance|family): \{/m
    .test(kode('components/reminders/BadgeReminders.tsx')));

// =====================================================================
console.log('\n== Aturan wajib ==');
// =====================================================================
c('warna semua dari Color, tak ada kode warna mentah',
  ![arsip, prog, versi, kartuBadge].some((s) => /#[0-9A-Fa-f]{6}/.test(s)));
c('tidak ada dependency/modul native baru',
  !/from 'expo-(?!constants|updates|router)/.test(versi + kartuBadge + prog));
c('tidak ada soft-delete diselundupkan',
  !/isDeleted|archived: true/.test(arsip + prog + kartuBadge));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);