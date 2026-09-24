// Tiga permintaan:
//   1+2. Catatan "🙏 Bersyukur 3 Hal" tersimpan SELAMANYA di arsipnya sendiri
//        (seperti Bible Reading), lengkap dengan paginasi & pemindahan catatan
//        lama yang masih menumpang di catatan kebiasaan.
//   3.   Jam 00.00 langsung ke gerbang doa pagi — hari memang sudah habis.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const tsc = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;

function pasang(js, req) {
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
}

const format = pasang(tsc(baca('lib/format.ts')), () => ({}));

// ===== Firestore palsu yang MENCATAT apa yang ditulis =====
const jejak = [];
const jalur = (a) => a.slice(1).join('/');
const firestore = {
  doc: (...a) => ({ path: jalur(a) }),
  collection: (...a) => ({ path: jalur(a) }),
  query: (c_, ...rest) => ({ c: c_, rest }),
  orderBy: (field, dir) => ({ orderBy: field, dir }),
  limit: (n) => ({ limit: n }),
  setDoc: (ref, data) => { jejak.push({ op: 'set', path: ref.path, data }); return Promise.resolve(); },
  deleteDoc: (ref) => { jejak.push({ op: 'delete', path: ref.path }); return Promise.resolve(); },
  Timestamp: { fromDate: (d) => ({ ts: d.getTime() }) },
  writeBatch: () => {
    const tulis = [];
    return {
      set: (ref, data) => tulis.push({ path: ref.path, data }),
      commit: () => { jejak.push({ op: 'batch', tulis }); return Promise.resolve(); },
    };
  },
};

let kueri = null;
const syukur = pasang(tsc(baca('lib/gratitude.ts')), (nama) => {
  if (nama === './format') return format;
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveList: (q) => { kueri = q; return () => {}; } };
  if (nama === 'firebase/firestore') return firestore;
  throw new Error('modul tak terduga: ' + nama);
});

// ============================================================
console.log('=== 1. Arsip syukur berdiri sendiri (seperti Bible Reading) ===');
// ============================================================
jejak.length = 0;
syukur.saveGratitude('u1', '2026-09-03', 'Version 1.4.0\nFullteam Meeting\nDianterin Hansen');
const tulis = jejak[0];
c('disimpan di koleksinya sendiri, satu dokumen per TANGGAL',
  tulis.op === 'set' && tulis.path === 'users/u1/gratitude/2026-09-03',
  JSON.stringify(tulis));
c('teksnya utuh apa adanya (poin dipisah baris, tanpa aturan penulisan kedua)',
  tulis.data.text === 'Version 1.4.0\nFullteam Meeting\nDianterin Hansen');
c('punya field date — diurut satu field, tanpa composite index',
  tulis.data.date && typeof tulis.data.date.ts === 'number');
// Kuncinya TANGGAL, bukan id baris kebiasaan: itu inti perbaikannya.
c('kuncinya tanggal, sama sekali tidak menyebut id kebiasaan',
  !/habitId|notes\[/.test(kode('lib/gratitude.ts')));

jejak.length = 0;
syukur.saveGratitude('u1', '2026-09-03', '   ');
c('dikosongkan → dokumennya DIHAPUS permanen, bukan disimpan kosong',
  jejak.length === 1 && jejak[0].op === 'delete' &&
  jejak[0].path === 'users/u1/gratitude/2026-09-03');
c('tidak ada soft-delete diselundupkan',
  !/isDeleted|archived/.test(baca('lib/gratitude.ts')));

syukur.subscribeGratitudeDays('u1', () => {}, () => {}, 50);
c('riwayatnya terbaru dulu & ditarik sejendela',
  kueri.rest.some((r) => r.orderBy === 'date' && r.dir === 'desc') &&
  kueri.rest.some((r) => r.limit === 50));
c('jendela bawaannya 120 hari — bukan batas simpan, cuma sekali tarik',
  syukur.GRATITUDE_PAGE === 120);

console.log('\n   Catatan lama ikut dipindahkan');
jejak.length = 0;
syukur.rescueGratitude('u1', [
  { dayId: '2026-08-01', text: 'a\nb\nc' },
  { dayId: '2026-08-02', text: 'd\ne\nf' },
]);
c('dipindah SEKALIGUS dalam satu batch (gagal = gagal semua, tak separuh)',
  jejak.length === 1 && jejak[0].op === 'batch' && jejak[0].tulis.length === 2);
c('mendarat di koleksi yang sama dengan yang baru',
  jejak[0].tulis[0].path === 'users/u1/gratitude/2026-08-01' &&
  jejak[0].tulis[1].path === 'users/u1/gratitude/2026-08-02');
// Riwayatnya diurut lewat field `date`. Hari pindahan yang tak membawanya
// tersimpan tapi TIDAK PERNAH ikut kueri — pindah tapi tetap tak terbaca.
c('hari pindahan ikut membawa teks & tanggalnya',
  jejak[0].tulis.every((t) => t.data.text && typeof t.data.date?.ts === 'number'));

// ============================================================
console.log('\n=== 2. Dari Habits ke arsipnya ===');
// ============================================================
const tab = kode('components/habits/HabitsTab.tsx');
c('menyimpan catatan syukur ikut menulis ke arsipnya',
  /await saveGratitude\(user\.uid, dayId, text\);/.test(tab));
c('…hanya untuk baris syukur, bukan semua catatan',
  /if \(isGratitudeHabit\(habit\)\) \{/.test(tab));
c('catatan kebiasaannya TETAP ditulis (itu yang menentukan centangnya)',
  /await setHabitNote\(user\.uid, dayId, habit\.id, text\);/.test(tab));
const libHabits = kode('lib/habits.ts');
// Bentuk kolomnya & arsipnya sama-sama bertanya "ini baris syukur?" — jadi
// pertanyaannya dijawab satu fungsi, bukan regex yang disalin dua kali.
// (HABIT_LINKS punya `match`-nya sendiri: itu tabel pencocokan pintasan, di
// situ tiap baris memang menyimpan polanya sendiri — bukan salinan aturan.)
c('baris syukur dikenali lewat SATU fungsi bernama',
  /export function isGratitudeHabit/.test(libHabits) &&
  /return isGratitudeHabit\(h\) \? GRATITUDE_LINES : 0;/.test(libHabits));

// ============================================================
console.log('\n=== 3. Layar Riwayat Syukur ===');
// ============================================================
const layar = kode('app/gratitude.tsx');
c('sumber utamanya arsip sendiri', /subscribeGratitudeDays\(/.test(layar));
c('catatan lama masih ikut dibaca, jadi tidak ada hari yang hilang',
  /subscribeHabitNotes\(/.test(layar));
c('kalau harinya ada di dua tempat, arsip sendiri yang menang',
  /\.\.\.baru,\s*\n\s*\.\.\.lama\.filter\(\(d\) => !baru\.some\(\(b\) => b\.dayId === d\.dayId\)\),/.test(layar));
c('yang tertinggal dipindahkan sekali jalan',
  /rescueGratitude\(user\.uid, kurang\)/.test(layar));
// Menulis ke arsip memicu snapshot baru → efeknya jalan lagi. Tanpa penanda
// yang dipasang LEBIH DULU, ia bisa menulis berkali-kali.
// Keduanya WAJIB ada sebelum urutannya dibandingkan: `indexOf` mengembalikan
// -1 kalau tandanya hilang sama sekali, dan -1 selalu "lebih kecil" — cek
// urutan yang polos justru paling hijau saat tandanya dicabut habis.
const iTanda = layar.indexOf('dipindah.current = true;');
const iPindah = layar.indexOf('rescueGratitude(user.uid, kurang)');
c('pemindahannya bertanda LEBIH DULU, jadi tidak menulis berulang',
  /if \(dipindah\.current \|\|/.test(layar) &&
  iTanda !== -1 && iPindah !== -1 && iTanda < iPindah);
c('hanya hari yang BELUM ada di arsip yang dipindah',
  /!arsip\.some\(\(b\) => b\.dayId === d\.dayId\)/.test(layar));
// Dulu barisnya hilang = seluruh layar kosong. Arsipnya tidak boleh ikut
// disandera daftar kebiasaan lagi — itu justru masalah yang diperbaiki.
c('barisnya hilang TIDAK lagi menyembunyikan arsipnya',
  /const belumAda = habits !== null && gratitudeId === null;/.test(layar) &&
  !/belumAda \?/.test(layar));
c('berpaginasi', /usePagination\(isi\)/.test(layar) && /<Pagination/.test(layar));
c('masih bisa menarik hari yang lebih lama dari KEDUA sumbernya',
  /\(notes\?\.more \?\? false\) \|\| baru\.length >= jendela/.test(layar));

// ============================================================
console.log('\n=== 4. Jam 00.00 → gerbang doa pagi ===');
// ============================================================
const prestasi = pasang(tsc(baca('lib/reward.ts')), (nama) => {
  if (nama === './format') return format;
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './daypart') return { DAYPART: {} };
  if (nama === './health') return { dayDocId: (d) => format.dayId(d) };
  if (nama === './homeGrid') return { homeFeatureIndex: () => 0 };
  if (nama === './streak') return pasang(tsc(baca('lib/streak.ts')), () => ({}));
  if (nama === 'firebase/firestore') return firestore;
  throw new Error('modul tak terduga: ' + nama);
});
const { prayerGateDue, prayerDoneToday } = prestasi;
const kemarin = { count: 5, lastDayId: '2026-09-03', best: 9, total: 40 };

// Inilah kejadian di foto: jam 00.04, kemarin sudah berdoa. Dengan batas lama
// (jam 04.00) "hari doa"-nya masih 3 Sep → gerbangnya tidak muncul.
c('00.04 hari BARU → gerbangnya muncul walau kemarin sudah berdoa',
  prayerGateDue(kemarin, new Date(2026, 8, 4, 0, 4)) === true);
c('jam 03.00 pun sudah hari baru (batas 04.00 benar-benar dilepas)',
  prayerGateDue(kemarin, new Date(2026, 8, 4, 3, 0)) === true);
c('23.50 hari yang sama → tidak ditagih lagi, sudah berdoa',
  prayerGateDue(kemarin, new Date(2026, 8, 3, 23, 50)) === false);
c('lewat jam 09.00 → tidak dipaksa lagi (streaknya sudah hangus)',
  prayerGateDue(kemarin, new Date(2026, 8, 4, 9, 30)) === false);
c('sudah berdoa hari ini → gerbangnya diam',
  prayerDoneToday({ ...kemarin, lastDayId: '2026-09-04' }, new Date(2026, 8, 4, 1, 0)) === true &&
  prayerGateDue({ ...kemarin, lastDayId: '2026-09-04' }, new Date(2026, 8, 4, 1, 0)) === false);
c('tidak ada lagi geseran 4 jam di kodenya',
  !/4 \* 3_600_000/.test(baca('lib/reward.ts')));
// App yang sedang terbuka saat tengah malam lewat harus ikut tertarik sendiri.
c('pengawalnya memeriksa jam berjalan, bukan cuma saat app dibuka',
  /setInterval\(\(\) => setNow\(new Date\(\)\), 30_000\)/.test(
    kode('components/spiritual/MorningJourneyGate.tsx')));

console.log(ok ? '\n✅ LULUS — arsip syukur & gerbang tengah malam terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);