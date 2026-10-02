// ⏱️ Sub-tab Record di Fitness 💪 (2 Okt 2026) — stopwatch olahraga, lalu
// hasilnya jadi riwayat.
//
// Kenapa ini perlu suite sendiri: kesalahan paling mungkin di fitur ini TIDAK
// KELIHATAN di komputer. Stopwatch yang menghitung dengan menambah 1 tiap
// detik tampak sempurna selama layarnya menyala — dan baru ketahuan salah
// sesudah kamu benar-benar berlari 30 menit dengan HP di saku, saat iOS
// membekukan app-nya dan yang kembali cuma beberapa detik pertama. Tidak ada
// tsc, lint, atau mata yang menangkap itu; yang menangkapnya cuma aturan
// "waktunya dihitung dari SELISIH CAP WAKTU, bukan dari detak".
//
// Yang kedua: `appendFitLog` menulis seluruh array. Kalau suatu saat daftar
// lamanya tidak ikut dioper, menyimpan sesi kedua akan MENGHAPUS sesi pertama,
// diam-diam, dan riwayatmu menyusut tanpa pesan apa pun.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? `  → ${extra}` : ''));
};

// ---------- Menjalankan modul TS tanpa Firestore ----------
// Modulnya dijalankan sungguhan; impor yang menyeret Firebase & React diganti
// boneka. Yang diuji di bawah semuanya fungsi murni, jadi boneka itu memang
// tidak pernah tersentuh.
function jalankan(berkas, stub = {}) {
  const js = ts.transpileModule(baca(berkas), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (nama) => {
    if (nama in stub) return stub[nama];
    throw new Error(`impor tak terduga: ${nama}`);
  };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
}

const DAYPART = jalankan('lib/daypart.ts');
const F = jalankan('lib/fitness.ts', {
  'firebase/firestore': {},
  './reward': {},
  './core': {},
  './daypart': DAYPART,
  './firebase': {},
  './format': {},
  './habits': {},
  './health': {},
  './liveDoc': {},
  './streak': {},
});
// Pemformat jamnya ada di lib/format.ts, dipakai bersama layar & kartu yang
// dibagikan (2 Okt 2026) — dulu dua salinan, lihat cek-share-olahraga.js.
const FORMAT = jalankan('lib/format.ts');

const layar = baca('app/fitness.tsx');
const hook = baca('hooks/useStopwatch.ts');
const rekam = baca('components/fitness/RecordTab.tsx');
const riwayat = baca('app/fitness-history.tsx');
const fitness = baca('lib/fitness.ts');
const latihan = baca('components/fitness/ExerciseTab.tsx');
const kemajuan = baca('components/fitness/ProgressTab.tsx');

// =====================================================================
console.log('\n=== 1. Record duduk DI TENGAH kaki layar ===');
// =====================================================================

{
  const daftar = layar.match(/const TABS: BottomTab<Tab>\[\] = \[([\s\S]*?)\];/);
  c('daftar sub-tabnya ketemu', !!daftar);
  const kunci = [...(daftar?.[1] ?? '').matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]);
  c('lima sub-tab: Program · Exercise · Record · Progress · Notes',
    kunci.join(',') === 'program,exercise,record,progress,notes', kunci.join(','));
  c('Record tepat di tengah, bukan di ujung',
    kunci.indexOf('record') === Math.floor(kunci.length / 2),
    `urutan ke-${kunci.indexOf('record') + 1} dari ${kunci.length}`);
  c('lambangnya stopwatch & sudah terdaftar di peta ikon',
    /key: 'record', label: 'Record', icon: 'stopwatch.fill'/.test(daftar?.[1] ?? '') &&
      /'stopwatch\.fill': 'timer',/.test(baca('components/ui/icon-symbol.tsx')));
  // Stopwatch yang lupa dihentikan diam-diam mencatat sesi tiga jam, dan
  // satu-satunya petunjuknya ada di sub-tab yang sedang tidak dibuka.
  c('badge menyala selagi stopwatch berjalan',
    /record: watch\.running \? 1 : 0,/.test(layar));
  c('stopwatch-nya dipegang LAYAR, bukan sub-tabnya (biar tidak mati saat pindah tab)',
    /const watch = useStopwatch\(\);/.test(layar) &&
      !/useStopwatch\(\)/.test(rekam));
}

// =====================================================================
console.log('\n=== 2. Stopwatch: dihitung dari cap waktu, bukan dari detak ===');
// =====================================================================

// INILAH pokoknya. Yang disimpan dua cap waktu; yang digambar selisihnya.
c('yang disimpan cap waktu (mulai & berjalan sejak), bukan angka detik',
  /startedEpoch: number;/.test(hook) && /runningSince: number \| null;/.test(hook) &&
    /accruedMs: number;/.test(hook));
c('lamanya = terkumpul + (sekarang − berjalan sejak)',
  /return s\.accruedMs \+ \(s\.runningSince === null \? 0 : now - s\.runningSince\);/
    .test(hook));
// Kalau ini muncul, stopwatch-nya kembali jadi penghitung yang bisa tertinggal.
c('TIDAK ada penghitung yang menambah detik sendiri',
  !/seconds \+ 1|detik \+ 1|\(n\) => n \+ 1|prev \+ 1/.test(hook));
c('detaknya cuma menyegarkan JAM, dan hanya selagi berjalan',
  /setInterval\(\(\) => setNow\(Date\.now\(\)\), 1000\)/.test(hook) &&
    /if \(!running\) return;/.test(hook));
// React Compiler menolak fungsi tak murni di badan render, dan alasannya di
// sini kebetulan sama dengan alasan benarnya: jamnya harus satu nilai yang
// stabil per gambar.
c('jamnya state, bukan Date.now() di badan render',
  /const \[now, setNow\] = useState\(\(\) => Date\.now\(\)\);/.test(hook) &&
    /seconds: Math\.floor\(elapsedMs\(sesi, now\) \/ 1000\)/.test(hook));

// Rumus lamanya diuji SUNGGUHAN lewat formatnya.
c('00:00 saat belum mulai', FORMAT.formatClock(0) === '00:00', FORMAT.formatClock(0));
c('05:09 untuk 309 detik', FORMAT.formatClock(309) === '05:09', FORMAT.formatClock(309));
c('jam baru muncul kalau memang lewat sejam',
  FORMAT.formatClock(3599) === '59:59' && FORMAT.formatClock(3600) === '1:00:00',
  `${FORMAT.formatClock(3599)} | ${FORMAT.formatClock(3600)}`);
c('detik minus tidak pernah tergambar', FORMAT.formatClock(-5) === '00:00');
// Hooknya tidak lagi punya pemformat sendiri — ia cuma menghitung detiknya.
c('stopwatch cuma menghitung detik, formatnya dari lib bersama',
  !/formatStopwatch|padStart/.test(hook));

// =====================================================================
console.log('\n=== 3. Selamat walau app ditutup ===');
// =====================================================================

c('keadaannya disimpan di HP (AsyncStorage), bukan cuma di memori',
  /const KEY = 'fit:stopwatch';/.test(hook) &&
    /AsyncStorage\.setItem\(KEY, JSON\.stringify\(sesi\)\)/.test(hook));
// Tanpa penjaga ini, keadaan kosong saat layar baru dibuka akan MENIMPA sesi
// yang sebenarnya masih berjalan — stopwatch-nya hilang tiap kali app dibuka.
c('tidak menulis sebelum bacaan pertamanya selesai',
  /if \(!ready\) return;/.test(hook) && /setReady\(true\)/.test(hook));
c('gagal membaca = mulai dari kosong, layarnya tetap terbuka',
  /\.catch\(\(\) => \{[\s\S]{0,200}\}\)\s*\.finally/.test(hook));
c('sesi selesai/dibuang menghapus simpanannya, bukan meninggalkan sampah',
  /AsyncStorage\.removeItem\(KEY\)/.test(hook));

// =====================================================================
console.log('\n=== 4. Olahraganya dari daftar yang SAMA dengan Pick Exercise ===');
// =====================================================================

c('empat jenis: beban · lari · renang · jalan',
  F.FIT_MENU_GROUPS.map((g) => g.kind).join(',') === 'strength,run,swim,walk',
  F.FIT_MENU_GROUPS.map((g) => g.kind).join(','));
c('Record memakai daftar itu, bukan salinannya sendiri',
  /FIT_MENU_GROUPS\.map\(\(g\) => \(/.test(rekam) &&
    !/emoji: '🏃'|emoji: '🏊'/.test(rekam));
for (const g of F.FIT_MENU_GROUPS) {
  c(`"${g.kind}" → ${g.emoji} ${g.label}`,
    F.fitKindMeta(g.kind).emoji === g.emoji &&
      F.fitKindMeta(g.kind).label === g.label);
}
c('jenis yang tak dikenal tidak membuat layarnya kosong',
  F.fitKindMeta('ngawur').emoji.length > 0);

// Jarak & lokasi cuma untuk yang memang menempuh jarak.
c('lari & jalan punya jarak + lokasi', F.fitLogHasRoute('run') && F.fitLogHasRoute('walk'));
c('angkat beban & renang TIDAK ditanyai jarak',
  !F.fitLogHasRoute('strength') && !F.fitLogHasRoute('swim'));
c('formulirnya memang mengikuti aturan itu',
  /const berjarak = fitLogHasRoute\(watch\.kind\);/.test(rekam) &&
    /\{berjarak && \(/.test(rekam));

// =====================================================================
console.log('\n=== 5. Tersimpan di dokumen hari yang SUDAH ADA ===');
// =====================================================================

c('tidak ada koleksi Firestore baru',
  !/'fitnessLogs'|'workouts'|'records'/.test(fitness) &&
    (fitness.match(/'users', uid, 'fitnessDays'/g) || []).length >= 6);
// Array ditulis utuh tiap kali. Kalau daftar lamanya tidak ikut dioper, sesi
// kedua akan MENGHAPUS sesi pertama tanpa pesan apa pun.
c('menambah sesi membawa serta daftar lamanya',
  /\{ logs: \[\.\.\.current, log\], date: fitDayDate\(dayId\) \}/.test(fitness));
c('menghapus sesi membuang TEPAT satu, sisanya utuh',
  /logs: current\.filter\(\(_, i\) => i !== index\)/.test(fitness));
c('hapus PERMANEN, tidak ada penanda tersembunyi',
  !/isDeleted|archived: true/.test(fitness + rekam + riwayat));
c('hapus selalu lewat konfirmasi dulu',
  /<ConfirmDialog/.test(rekam) && /Hapus permanen, tidak bisa dikembalikan/.test(rekam));
// Bentuk asing dibuang, bukan dipaksa jadi angka: satu dokumen rusak tidak
// boleh membuat seluruh riwayat berhenti tergambar.
c('data yang bentuknya asing dilewati, bukan bikin layar meledak',
  /if \(!Array\.isArray\(raw\)\) return \[\];/.test(fitness) &&
    /typeof o\.seconds !== 'number' \|\| o\.seconds <= 0/.test(fitness));

// Tanggal dokumen = HARINYA. Kalau ia "kapan terakhir ditulis", membetulkan
// catatan Senin pada hari Jumat akan melempar Senin ke puncak riwayat.
c('tanggal dokumen harian = harinya, bukan saat terakhir ditulis',
  /function fitDayDate\(dayId: string\): Timestamp \{ return Timestamp\.fromDate\(dayIdToDate\(dayId\)\); \}/
    .test(fitness.replace(/\s+/g, ' ')));
c('keempat penulis dokumen harian memakainya',
  (fitness.match(/date: fitDayDate\(dayId\)/g) || []).length >= 6 &&
    !/date: Timestamp\.fromDate\(new Date\(\)\)/.test(fitness));

// =====================================================================
console.log('\n=== 6. Angkanya: total hari ini & riwayat ===');
// =====================================================================

const hari = (logs) => ({ done: {}, skipped: false, picks: [], runs: {}, logs });
c('total hari ini = jumlah seluruh sesinya',
  F.fitLogSeconds(hari([
    { kind: 'run', seconds: 1861, at: '07.34', km: 4.15, place: 'Kedaung' },
    { kind: 'strength', seconds: 900, at: '17.00', km: 0, place: '' },
  ])) === 2761);
c('hari tanpa sesi = 0, bukan meledak',
  F.fitLogSeconds(undefined) === 0 && F.fitLogSeconds(hari([])) === 0);

// Riwayat dari hari-hari yang sudah di tangan: terbaru dulu.
{
  const days = {
    '2026-09-28': hari([{ kind: 'walk', seconds: 600, at: '06.00', km: 1, place: 'Taman' }]),
    '2026-10-01': hari([{ kind: 'run', seconds: 1800, at: '07.00', km: 4, place: 'Angke' }]),
    '2026-09-30': hari([]),
  };
  const urut = F.fitLogsOfDays(days);
  c('terbaru dulu, hari kosong tidak ikut jadi baris hampa',
    urut.map((l) => l.dayId).join(',') === '2026-10-01,2026-09-28',
    urut.map((l) => l.dayId).join(','));
  c('tiap baris membawa hari asalnya', urut[0].dayId === '2026-10-01' && urut[0].km === 4);
  c('penyaring jarak cuma meloloskan lari & jalan',
    F.fitRouteLogs([
      { kind: 'run', seconds: 1, at: '', km: 0, place: '', dayId: 'x' },
      { kind: 'strength', seconds: 1, at: '', km: 0, place: '', dayId: 'x' },
    ]).length === 1);
}

// Pace memakai rumus yang SAMA dengan rekap mingguan — dua satuan berbeda di
// satu layar jauh lebih membingungkan daripada tidak ada pace sama sekali.
c('pace sesi memakai rumus fitPace yang sudah ada',
  /export function fitLogPace\(log: FitLog\): string \{ return fitPace\(log\.km, log\.seconds \/ 60\); \}/
    .test(fitness.replace(/\s+/g, ' ')));
c('30 menit untuk 4 km = 7:30 /km',
  F.fitLogPace({ kind: 'run', seconds: 1800, at: '', km: 4, place: '' }) === '7:30 /km',
  F.fitLogPace({ kind: 'run', seconds: 1800, at: '', km: 4, place: '' }));
c('tanpa jarak, pace-nya kosong (bukan angka karangan)',
  F.fitLogPace({ kind: 'run', seconds: 1800, at: '', km: 0, place: '' }) === '');

// =====================================================================
console.log('\n=== 7. Biaya baca: satu kueri, batasnya ditulis jelas ===');
// =====================================================================

c('riwayat dibaca SATU kueri berbatas, bukan satu baca per hari',
  /query\( collection\(db, 'users', uid, 'fitnessDays'\), orderBy\('date', 'desc'\), limit\(days\), \)/
    .test(fitness.replace(/\s+/g, ' ')) &&
    (fitness.match(/getDocs\(/g) || []).length === 1);
c('batas harinya angka yang ditulis, bukan disembunyikan di dalam kueri',
  /export const FIT_HISTORY_DAYS = \d+;/.test(fitness) &&
    F.FIT_HISTORY_DAYS > 0);
c('layar riwayat membacanya SEKALI, bukan berlangganan',
  /useAsyncData\(muat, LOAD_ERROR\)/.test(riwayat) &&
    !/subscribe/.test(riwayat));
// Kartu di Progress menumpang data yang memang sudah dibaca di sana.
c('kartu riwayat di Progress tidak menambah satu pun pembacaan',
  /fitLogsOfDays\(weekDays\)/.test(kemajuan) && !/fetchFitLogs/.test(kemajuan));
c('daftarnya berpaginasi, tidak jadi gulungan tanpa ujung',
  /usePagination\( logs \?\? \[\], 12, \)/.test(riwayat.replace(/\s+/g, ' ')) &&
    /<Pagination/.test(riwayat));

// =====================================================================
console.log('\n=== 8. Dua sumber angka lari tidak dijumlahkan diam-diam ===');
// =====================================================================

// `runs` = hasil sesi yang direncanakan (diketik di Exercise).
// `logs` = sesi yang benar-benar direkam (Record).
// Menjumlahkannya berarti menebak keduanya lari yang sama — dan tebakan yang
// salah melipatgandakan jarak mingguan tanpa kelihatan di layar mana pun.
c('fitRunTotals TETAP cuma menjumlah `runs`',
  /for \(const run of Object\.values\(day\.runs\)\)/.test(fitness) &&
    !/for \(const [a-z]+ of Object\.values\(day\.logs\)\)/.test(fitness));
c('keduanya tampil sebagai dua kartu dengan judul yang beda',
  /🏃 Lari minggu ini/.test(kemajuan) && /🏃 Riwayat Lari & Jalan/.test(kemajuan));
// Kartu di Progress menyaring yang berjarak; sesi beban & renang tetap utuh,
// tempatnya di layar Workout History.
c('kartu Progress cuma berisi lari & jalan, riwayat penuhnya di layar sendiri',
  /fitRouteLogs\(fitLogsOfDays\(weekDays\)\)\.slice\(0, 5\)/.test(kemajuan) &&
    !/fitRouteLogs/.test(riwayat));
c('sub-tab Exercise menampilkan total yang DIREKAM, terpisah dari centangnya',
  /⏱️ Direkam \{formatClock\(fitLogSeconds\(viewDay\)\)\}/.test(latihan));
c('hari tanpa sesi terekam tidak digambar sebagai kotak kosong',
  /\{viewDay\.logs\.length > 0 && \(/.test(latihan));

// =====================================================================
console.log('\n=== 9. Pintu riwayat & aturan repo ===');
// =====================================================================

c('tombol 📜 riwayat ada di pojok kanan, bersama 🔥 streak',
  /<EmojiButton emoji="📜" onPress=\{\(\) => router\.push\('\/fitness-history'\)\} \/> <RewardButton category="fitness" \/>/
    .test(layar.replace(/\s+/g, ' ')));
c('rutenya dapat warna Fitness, bukan warna merek',
  /'fitness-history': 'fitness',/.test(baca('lib/featureTheme.ts')));
c('koleksi fitnessDays sudah terdaftar di Ekspor Data',
  /'fitnessDays'/.test(baca('lib/dataExport.ts')));

const berkasBaru = [
  'hooks/useStopwatch.ts',
  'components/fitness/RecordTab.tsx',
  'app/fitness-history.tsx',
];
for (const f of berkasBaru) {
  const s = baca(f);
  c(`${f}: tidak ada "tekan"`, !/\btekan\b|ditekan|menekan/i.test(s));
  c(`${f}: tidak ada "Klik" (yang dipakai "click")`, !/\bklik\b/i.test(s));
  const teks = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  c(`${f}: tak ada tanda pisah panjang di tulisan yang tampil`,
    !/—/.test(teks), (teks.match(/.{0,30}—.{0,30}/) || [])[0]);
}

// GPS sengaja TIDAK dipakai: izin lokasi latar belakang itu modul native, dan
// tiap modul native berarti build EAS baru (bukan sekadar eas update).
c('tidak ada modul native baru (GPS/peta) yang menyelinap masuk',
  !/expo-location|react-native-maps|expo-sensors|expo-background/.test(
    [hook, rekam, riwayat, fitness].join('\n')));

console.log(ok ? '\n✅ LULUS — Record & riwayat olahraga.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
