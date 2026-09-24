// Enam permintaan 31 Agu 2026 (reward, habits inti, ✗ & area, streak).
// Fungsi yang diuji DIJALANKAN dari sumbernya, bukan disalin ulang.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const OUT = path.join(__dirname, 'keluar-enam-p');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
try {
  require('child_process').execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/habits.ts', R + 'lib/reward.ts',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch {
  /* tsc mengeluh soal alias "@/…" yang distub, tapi JS-nya tetap keluar */
}
for (const f of ['habits.js', 'reward.js']) {
  if (!fs.existsSync(path.join(OUT, f))) throw new Error('tsc gagal: ' + f);
}

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return { doc: () => ({}), setDoc: () => Promise.resolve(), collection: () => ({}), query: (...a) => a, orderBy: () => ({}), limit: () => ({}), documentId: () => ({}) };
  }
  if (/firebase$/.test(req)) return { db: {} };
  if (/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: (_, k) => `#${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const H = require(path.join(OUT, 'habits.js'));
const A = require(path.join(OUT, 'reward.js'));
Module._load = asli;

const ht = baca('components/habits/HabitsTab.tsx');
const src = baca('lib/habits.ts');
const ach = baca('lib/reward.ts');

// Pembuat kebiasaan ringkas.
const kb = (id, extra = {}) => ({
  id, label: extra.label ?? id, slot: 'morning', ...extra,
});

// ===================================================================
console.log('=== 1. Angkat beban mingguan: kolomnya sendiri lagi ===');
// Sempat digabung ke kolom Fitness ("sama-sama soal latihan"). 6 Sep 2026
// dibatalkan: angkanya datang dari rekap mingguan Apple Health, BUKAN dari sesi
// yang kamu centang di fitur Fitness — di dalam kolom Fitness ia tampak tidak
// nyambung dengan apa pun di sekitarnya.
const kategori = [...ach.matchAll(/\{ key: '(\w+)', icon: [^,]+, label: '([^']+)'/g)]
  .map(([, key, label]) => ({ key, label }));
c('kolom "strength" berdiri sendiri lagi', kategori.some((k) => k.key === 'strength'));
c('key-nya terdaftar di tipe kategori (URL-nya ikut disaring)', /\| 'strength'/.test(ach));
const kuat = kategori.find((k) => k.key === 'strength');
c('namanya sejalan dengan Weekly Steps', kuat?.label === 'Weekly Strength', kuat?.label);
const fit = kategori.find((k) => k.key === 'fitness');
c('kolom Fitness tetap ada & namanya tetap', fit?.label === 'Fitness', fit?.label);
c('keterangannya tidak lagi menjanjikan angkat beban',
  !/Sesi latihan & angkat beban 2 hari\/minggu/.test(ach) &&
  /desc: 'Sesi latihan yang kamu centang di fitur Fitness'/.test(ach));

const lencana = (kat) =>
  [...ach.matchAll(/\{ id: '(\w+)', category: '(\w+)'/g)]
    .filter(([, , k]) => k === kat)
    .map(([, id]) => id);
const isiFitness = lencana('fitness');
const isiStrength = lencana('strength');
c('TIDAK ADA lencana yang hilang — ketiga weekGym pindah ke kolom strength',
  ['weekGym1', 'weekGym4', 'weekGym12'].every((id) => isiStrength.includes(id)),
  isiStrength.join(', '));
c('dan tidak tertinggal ganda di Fitness',
  ['weekGym1', 'weekGym4', 'weekGym12'].every((id) => !isiFitness.includes(id)));
c('lencana sesi latihan yang lama tetap di Fitness',
  ['fit1', 'fitWeek1', 'fit10', 'fit50', 'fit100'].every((id) => isiFitness.includes(id)));
c('tak ada lencana yatim (kategori tanpa kolom)', (() => {
  const kunci = kategori.map((k) => k.key);
  const semua = [...ach.matchAll(/\{ id: '\w+', category: '(\w+)'/g)].map((m) => m[1]);
  const yatim = [...new Set(semua)].filter((k) => !kunci.includes(k));
  return yatim.length === 0;
})());
c('angka progresnya tetap punya sumber (weekGymHits masih dihitung)',
  /weekGymHits/.test(ach) && /s\.weekGymHits/.test(ach));

// ===================================================================
console.log('\n=== 2. Bersyukur 3 Hal: centang dari tulisan, & wajib ===');
const syukur = kb('g1', { label: '🙏 Bersyukur 3 Hal' });
const jurnal = kb('j1', { label: '📓 Daily Reflection Journal' });
const biasa = kb('b1', { label: '🚿 Warm Shower' });

c('Bersyukur dikenali sebagai baris bercatatan', H.isNoteDrivenHabit(syukur));
c('Jurnal tetap dikenali', H.isNoteDrivenHabit(jurnal));
c('kebiasaan biasa TIDAK ikut terkunci', !H.isNoteDrivenHabit(biasa));

c('minta TIGA butir, bukan sekadar panjang', H.habitNoteLines(syukur) === 3);
c('kosong → belum selesai', !H.habitNoteFilled(syukur, ''));
c('satu butir saja → BELUM selesai (inilah bedanya dari Jurnal)',
  !H.habitNoteFilled(syukur, 'terima kasih Tuhan untuk hari ini yang panjang'));
c('dua butir → masih belum', !H.habitNoteFilled(syukur, 'kesehatan\nkeluarga'));
c('tiga butir → SELESAI', H.habitNoteFilled(syukur, 'kesehatan\nkeluarga\npekerjaan'));
c('butir ke-2 dikosongkan lagi → lepas lagi',
  !H.habitNoteFilled(syukur, 'kesehatan\n\npekerjaan'));
c('spasi saja tidak dihitung terisi',
  !H.habitNoteFilled(syukur, 'kesehatan\n   \npekerjaan'));
c('Jurnal tetap pakai aturan panjang, bukan butir',
  H.habitNoteLines(jurnal) === 0 &&
    H.habitNoteFilled(jurnal, 'hari ini aku belajar sabar') &&
    !H.habitNoteFilled(jurnal, 'singkat'));

c('lingkarannya dikunci & tak bisa dipencet (sama seperti Jurnal)',
  /disabled=\{fromNote \|\| skipped \|\| \(mirrored && checked\)\}/.test(ht) &&
    /locked=\{mirrored \|\| fromNote\}/.test(ht));
c('centangnya ditulis dari handleNote',
  /const selesai = habitNoteFilled\(habit, text\);/.test(ht));

console.log('\n  --- dua-duanya jadi WAJIB (tak bisa dihapus) ---');
c('Bersyukur terkunci', H.isFixedHabit(syukur));
c('Jurnal terkunci', H.isFixedHabit(jurnal));
c('kebiasaan biasa TETAP boleh dihapus', !H.isFixedHabit(biasa));
c('baris cermin sungguhan tetap terkunci juga',
  H.isFixedHabit(kb('x', { label: '📖 Morning Bible Reading' })));

// ===================================================================
console.log('\n=== 3. ✗ = gagal, bukan dikeluarkan dari hitungan ===');
const inti = (id, area) => kb(id, { label: id, area, tier: 'core' });
const daftar = [inti('a', 'body'), inti('b', 'body'), inti('s', 'spirit')];

console.log('  -- area hidup --');
const areaDari = (done, skip) => {
  const r = H.areaProgress(daftar, done, skip);
  return Object.fromEntries(r.map((x) => [x.area, x]));
};
let A1 = areaDari({ a: true, b: true }, {});
c('dua-duanya dicentang → Body terjaga', A1.body.kept && !A1.body.skipped);
A1 = areaDari({ a: true }, {});
c('satu belum dicentang → Body belum terjaga, tapi BUKAN merah',
  !A1.body.kept && !A1.body.skipped);
A1 = areaDari({ a: true }, { b: true });
c('satu ditandai ✗ → Body MERAH', A1.body.skipped);
c('dan ✗ membuat areanya TIDAK terjaga (dulu justru terjaga)', !A1.body.kept);
c('✗ tidak menghilangkan barisnya dari penyebut', A1.body.total === 2, `total=${A1.body.total}`);
// Kasus yang benar-benar membedakan: baris yang tercentang LALU ditandai ✗.
// Kalau angkanya cuma membaca `done`, ✗-nya tak terasa sama sekali.
{
  const dua = areaDari({ a: true, b: true }, { b: true });
  c('baris yang dicentang lalu ditandai ✗ TIDAK ikut dihitung "sudah"',
    dua.body.done === 1, `done=${dua.body.done}`);
  c('dan areanya tetap merah, bukan terjaga',
    dua.body.skipped && !dua.body.kept);
  c('streaknya pun tidak diberikan',
    !H.coreDone(daftar, { a: true, b: true, s: true }, { b: true }));
}
c('area LAIN tidak ikut memerah', !A1.spirit.skipped);

console.log('  -- streak harian --');
c('semua inti dicentang → dapat poin streak',
  H.coreDone(daftar, { a: true, b: true, s: true }, {}));
c('satu belum dicentang → TIDAK dapat poin streak',
  !H.coreDone(daftar, { a: true, b: true }, {}));
c('satu ditandai ✗ → TIDAK dapat poin streak (dulu justru dapat)',
  !H.coreDone(daftar, { a: true, b: true, s: true }, { s: true }));
c('SEMUA ditandai ✗ → jelas tidak dapat',
  !H.coreDone(daftar, {}, { a: true, b: true, s: true }));
c('skor harian ikut turun kalau ada yang ✗',
  H.dailyScore(daftar, { a: true, b: true, s: true }, { s: true }) < 10,
  String(H.dailyScore(daftar, { a: true, b: true, s: true }, { s: true })),
);
c('skor 10 hanya kalau benar-benar semua beres',
  H.dailyScore(daftar, { a: true, b: true, s: true }, {}) === 10);
c('layar Habits memakai daftar LENGKAP + peta ✗, bukan `counted`',
  /dailyScore\(habits, day\.done, day\.skipped\)/.test(ht) &&
    /areaProgress\(habits, day\.done, day\.skipped\)/.test(ht) &&
    /coreDone\(habits, day\.done, day\.skipped\)/.test(ht));
c('menandai ✗ tidak lagi menaikkan streak',
  !/if \(nextSkipped\) \{[\s\S]{0,400}bumpStreak/.test(ht));
c('area merah punya gayanya sendiri di layar',
  /areaChipSkipped/.test(ht) && /a\.skipped && styles\.areaChipSkipped/.test(ht));

// ===================================================================
console.log('\n=== 4. Angka "area terjaga" dibuang dari kartu ring ===');
// Dulu tulisannya diganti jadi "area streak🔥"; sekarang STATNYA SENDIRI sudah
// dibuang dari kartu ring. Yang dijaga: tak ada lagi tulisan yang menyebut
// hitungan area di situ — sementara kelima chip areanya tetap ada & tetap
// diuji di bagian 3 di atas.
// Yang dicari tulisan yang BENAR-BENAR TAMPIL (isi VixText di barisnya
// sendiri), bukan sekadar kata yang kebetulan muncul di komentar kode.
const tampil = (t) => new RegExp('\\n\\s*' + t + '\\s*\\n\\s*</VixText>').test(ht);
c('tulisan lama "area terjaga" sudah tidak tampil', !tampil('area terjaga'));
c('angka "area streak🔥" ikut dibuang dari kartu ring', !tampil('area streak🔥'));
c('variabel penghitungnya tidak ditinggalkan menganggur', !/keptCount/.test(ht));

// ===================================================================
console.log('\n=== 5. Tingkat: cuma inti / bukan ===');
c('Inti terbaca inti', H.isCoreHabit(kb('x', { tier: 'core' })));
c('Pendukung lama terbaca BUKAN inti', !H.isCoreHabit(kb('x', { tier: 'support' })));
c('Opsional lama terbaca BUKAN inti — datanya tidak perlu ditulis ulang',
  !H.isCoreHabit(kb('x', { tier: 'optional' })));
c('kebiasaan lama tanpa tier → bukan inti', !H.isCoreHabit(kb('x')));
c('daftar tiga tingkat & lambangnya dibuang',
  !/HABIT_TIERS/.test(src) && !/tierMeta/.test(src));
c('tiga lambang 🟢🟡⚪ hilang dari kode',
  !/'🟢'/.test(src) && !/'🟡'/.test(src) && !/'⚪'/.test(src) &&
    !/tierMeta\(tier\)\.emoji/.test(ht));
c('opsional TIDAK lagi dikeluarkan dari hitungan area',
  !/habitTier\(h\) !== 'optional'/.test(src));
c('opsional tidak lagi diredupkan di daftar', !/rowOptional/.test(ht));
c('penandanya sekarang TEBAL/tidak tebal',
  /const inti = isCoreHabit\(habit\);/.test(ht) &&
    /heading=\{inti \? 'bold' : 'paragraph'\}/.test(ht));
c('form-nya satu centang, bukan tiga chip',
  /Kebiasaan inti/.test(ht) && /<CheckCircle checked=\{fTier === 'core'\}/.test(ht));
c('menekannya berpindah antara inti & bukan',
  /setFTier\(fTier === 'core' \? 'support' : 'core'\)/.test(ht));
// Opsional lama sekarang IKUT menghitung area — buktikan, jangan cuma percaya.
c('kebiasaan opsional lama sekarang ikut terhitung di areanya', (() => {
  const campur = [kb('o', { area: 'mind', tier: 'optional' })];
  const r = H.areaProgress(campur, { o: true }, {});
  const mind = r.find((x) => x.area === 'mind');
  return mind.total === 1 && mind.done === 1 && mind.kept === true;
})());

// ===================================================================
console.log('\n=== 6. Baris Bersyukur jadi pintu ke Riwayat Syukur ===');
const link = H.habitLink(syukur);
c('pintasannya ada', !!link, link?.note);
c('tujuannya /gratitude', link?.route?.pathname === '/gratitude');
c('baru muncul SESUDAH tercentang', link?.whenDone === true);
c('bukan baris cermin (centangnya tetap dari tulisannya)',
  link?.mirrorOf === undefined);
c('Jurnal tetap ke Generate Feed, tidak tertukar',
  H.habitLink(jurnal)?.route?.pathname === '/reflection-feed');
c('layar Habits mengganti pintasan whenDone sebelum tercentang',
  /rawLink\?\.whenDone && !checked\s*\?\s*\(rawLink\.beforeDone \?\? null\)\s*:\s*rawLink/.test(ht));
// Sebelum ketiga halnya ditulis, riwayatnya memang belum bertambah apa-apa —
// yang berguna justru ayat yang menyuruhnya (1 Tes. 5:16-18).
c('sebelum tercentang: pintunya ke 1 Tes. 5:16-18 di YouVersion',
  link?.beforeDone?.note === 'Buka Baca 1 Tes. 5:16-18' &&
    /reference=1TH\.5\.16/.test(link.beforeDone.external.scheme) &&
    /version=320/.test(link.beforeDone.external.scheme));
c('sesudah tercentang tetap ke Riwayat Syukur', link?.route?.pathname === '/gratitude');
c('rutenya terdaftar di tipe (typed routes ikut memeriksa)',
  /\| '\/gratitude'/.test(src));

// Riwayat Syukur: langganan tidak boleh dipasang ulang tiap snapshot.
const grat = baca('app/gratitude.tsx');
// `jendela` menyusul belakangan (tombol "muat hari yang lebih lama") — itu
// memang HARUS memasang ulang, karena kuerinya berubah. Yang dijaga di sini
// tetap yang lama: objek `gratitude` tidak boleh ikut jadi dependency.
c('langganannya bergantung pada ID, bukan objek yang lahir baru tiap snapshot',
  /const gratitudeId = habits\?\.find\(isGratitudeHabit\)\?\.id \?\? null;/.test(grat) &&
    /deps: \[gratitudeId, jendela\]/.test(grat)); // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
c('tak ada lagi objek `gratitude` di daftar dependency',
  !/\}, \[user, gratitude\]\);/.test(grat));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);