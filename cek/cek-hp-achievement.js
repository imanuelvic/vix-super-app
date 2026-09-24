// Dua permintaan:
//   1. Semua kolom nomor HP di SELURUH proyek merapikan ketikan/tempelan jadi
//      satu bentuk lokal: "+62 812-4204-3658" → "081242043658".
//   2. Modal reward memampangkan ANGKA SEKARANG di pojok kanan atas, dan
//      daftarnya jadi grid lencana (ala Duolingo).
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

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
const pasang = (js, req) => {
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
};

const phone = pasang(tsc(baca('lib/phone.ts')), () => ({}));
const { localPhone, waPhone } = phone;

// ============================================================
console.log('=== 1. Nomor HP: satu bentuk di seluruh app ===');
// ============================================================
// Persis yang ditempel dari kontak / WhatsApp.
c('"+62 812-4204-3658" → "081242043658"',
  localPhone('+62 812-4204-3658') === '081242043658',
  localPhone('+62 812-4204-3658'));
c('"62 812 4204 3658" (tanpa +) ikut dirapikan',
  localPhone('62 812 4204 3658') === '081242043658');
c('"0812-4204-3658" cuma dibuang tanda hubungnya',
  localPhone('0812-4204-3658') === '081242043658');
c('"81242043658" (tanpa nol) dinolkan — semua nomor HP Indonesia mulai 08',
  localPhone('81242043658') === '081242043658');
c('yang sudah rapi tidak diubah lagi',
  localPhone('081242043658') === '081242043658');
// Aman ditengah pengetikan: angka setengah jadi tidak dipaksa berubah bentuk.
c('kosong & angka setengah jadi tidak dipaksa',
  localPhone('') === '' && localPhone('0') === '0' && localPhone('08') === '08');

console.log('\n   Tautan wa.me tidak lagi menebak bentuknya');
// Fun Futsal menyimpan bentuk lokal ("0812…"), CORE menyimpan digit sesudah +62
// ("812…"). Dulu tautannya cuma menempelkan "62" di depan apa pun yang datang
// → nomor Fun Futsal jadi "62 0812…" dan chatnya tak pernah terbuka ke orangnya.
c('bentuk CORE (tanpa 0) benar', waPhone('81242043658') === '6281242043658');
c('bentuk Fun Futsal (dengan 0) ikut benar — dulu jadi 62081…',
  waPhone('081242043658') === '6281242043658');
c('yang sudah lengkap tidak digandakan', waPhone('6281242043658') === '6281242043658');
c('tanda baca apa pun tetap terurus', waPhone('+62 812-4204-3658') === '6281242043658');
c('tautannya memakai penyaring itu, bukan tempel buta',
  /https:\/\/wa\.me\/\$\{waPhone\(phone\)\}/.test(baca('lib/whatsapp.ts')));

console.log('\n   Kolomnya dipasang di SEMUA layar');
for (const [f, pola] of [
  ['components/friends/FutsalTab.tsx', 'setFHp(localPhone(t))'],
  ['components/core/LeadersTab.tsx', 'setFPhone(localPhone(t))'],
  ['components/core/LeadersTab.tsx', 'setMtPhone(localPhone(t))'],
  ['app/profile.tsx', 'f.phone ? localPhone(t) : t'],
]) {
  c(`${f.split('/').pop().padEnd(16)} ${pola}`, baca(f).includes(pola));
}
c('tidak ada lagi kolom nomor yang cuma membuang non-digit sendiri',
  !/setFPhone\(t\.replace/.test(baca('components/core/LeadersTab.tsx')) &&
  !/setMtPhone\(t\.replace/.test(baca('components/core/LeadersTab.tsx')));
// Kotak "+62" di samping kolom CORE dibuang: selama ia ada, kolomnya bukan
// nomor HP utuh melainkan "sisa sesudah +62" — bentuk yang cuma dipakai di
// layar itu, dan yang membuat tempelan mendarat di belakang prefiks ganda.
c('kotak prefiks "+62" di CORE dibuang, gayanya tidak tertinggal',
  !/phonePrefix/.test(baca('components/core/LeadersTab.tsx')));
// Yang TERSIMPAN tidak ikut berubah → data lama & tautan WA tetap jalan.
// 16 Sep 2026: CL memeriksa hasil normalizePhone dulu (nomor wajib), lalu
// menyimpan hasil yang sama; Main Team masih langsung.
c('penyimpanan CORE tetap lewat normalizePhone (data lama tidak dibongkar)',
  /const phone = normalizePhone\(fPhone\);/.test(baca('components/core/LeadersTab.tsx')) &&
  /phone: normalizePhone\(mtPhone\)/.test(baca('components/core/LeadersTab.tsx')));
c('form ubah menampilkan bentuk lokal, sama dengan yang diketik',
  /setFPhone\(localPhone\(l\.phone \?\? ''\)\)/.test(baca('components/core/LeadersTab.tsx')));

// ============================================================
console.log('\n=== 2. Reward: angka sekarang & grid lencana ===');
// ============================================================
const lib = baca('lib/reward.ts');
const layar = baca('app/reward.tsx');
const layarKode = kode('app/reward.tsx');

// Satu kategori bisa memuat beberapa ukuran (Fitness: total sesi & rekor
// beruntun), jadi angka utamanya DITULIS, bukan ditebak dari daftar lencananya.
// 12 sejak 6 Sep: "Weekly Strength" kembali berdiri sendiri, keluar dari
// kolom Fitness (angkanya datang dari rekap Apple Health, bukan dari sesi yang
// dicentang di fitur Fitness).
c('tiap kategori punya angka sekarangnya sendiri, ditulis satu per satu',
  (lib.match(/now: \(s\) =>/g) || []).length === 12,
  String((lib.match(/now: \(s\) =>/g) || []).length));
c('satuannya ikut ditulis', (lib.match(/unit: '/g) || []).length === 12);
c('dibaca lewat satu pintu', /export function categoryNow\(/.test(lib));
c('km tetap 1 desimal di kategori Jarak Tempuh',
  /key: 'run',[\s\S]{0,260}fmt: km }/.test(lib));

const achv = pasang(tsc(lib), (nama) => {
  if (nama === './daypart') return { DAYPART: { morning: '🌅', daytime: '🌤️', night: '🌙' } };
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './format') return { dayIdToDate: () => new Date(), formatShortDayDate: () => '' };
  if (nama === './health') return { dayDocId: () => '' };
  if (nama === './homeGrid') return { homeFeatureIndex: () => 0 };
  if (nama === './streak') return { alreadyCounted: () => false, nextStreak: () => ({}) };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  throw new Error('modul tak terduga: ' + nama);
});
const stats = {
  loginCount: 5, loginBest: 9, habitStreak: 3,
  bibleMorningBest: 3, bibleDaytimeBest: 0, bibleNightBest: 2,
  learningWeekBest: 1, fitTotal: 12, fitBest: 4, bestSteps: 21000,
  stepTierLastDate: {}, weekStepHits: 2, weekGymHits: 1, weekBothHits: 0,
  bestDayKm: 10.5, bestWeekKm: 30, bestMonthKm: 90,
  waterCount: 4, waterBest: 7, waterTotal: 20,
};
c('Alkitab Pagi melaporkan streaknya', (() => {
  const n = achv.categoryNow('bibleMorning', stats);
  return n && n.value === 3 && n.text === '3 hari streak';
})(), JSON.stringify(achv.categoryNow('bibleMorning', stats)));
c('Fitness melaporkan sesi, bukan streak', (() => {
  const n = achv.categoryNow('fitness', stats);
  return n && n.value === 12 && n.text === '12 sesi selesai';
})(), JSON.stringify(achv.categoryNow('fitness', stats)));
c('Jarak Tempuh dibulatkan gaya km', (() => {
  const n = achv.categoryNow('run', stats);
  return n && n.text === '10,5 km (rekor sehari)';
})(), JSON.stringify(achv.categoryNow('run', stats)));
c('kategori asing → null, bukan angka karangan',
  achv.categoryNow('bukan-kategori', stats) === null);

console.log('\n   Tampilannya');
// Grid lencananya tidak lagi di dalam modal: ia HALAMAN sendiri, dan bentuk
// petaknya satu komponen bersama (dipakai juga papan kategori di layar utama).
const halaman = baca('app/reward-category.tsx');
const halamanKode = kode('app/reward-category.tsx');
const petak = baca('components/common/BadgeTile.tsx');
const petakKode = kode('components/common/BadgeTile.tsx');
c('angkanya dipampang di pojok kanan atas halamannya',
  /right=\{\s*\n\s*sekarang \? \(/.test(halaman) &&
  /const sekarang = key \? categoryNow\(key, stats\) : null;/.test(halaman));
c('daftarnya jadi grid tiga kolom',
  /tile: \{ width: '33\.33%'/.test(petak) &&
  /grid: \{\s*\n\s*flexDirection: 'row',\s*\n\s*flexWrap: 'wrap',/.test(petak));
// Yang belum terbuka tetap DIGAMBAR, cuma pudar: tangganya harus terlihat utuh
// supaya jelas tingkat berikutnya apa.
c('lencana yang belum terbuka tetap tampil, cuma dipudarkan',
  /badgeLocked: \{/.test(petak) && /!unlocked && styles\.badgeLocked/.test(petakKode));
c('angka targetnya menempel di lencananya (cara Duolingo menandai tingkat)',
  /badgeTag: \{/.test(petak) &&
  /tag=\{String\(a\.fmt \? a\.fmt\(a\.target\) : a\.target\)\}/.test(halamanKode));
c('nilai sekarang tiap lencana tetap terbaca di grid',
  /\$\{a\.fmt\(Math\.min\(value, a\.target\)\)\}\/\$\{a\.fmt\(a\.target\)\}/.test(halamanKode));
// Rincian (keterangan + tanggal + batang) tidak hilang — pindah ke kartu yang
// muncul saat lencananya di-klik.
c('rinciannya muncul saat lencananya di-klik',
  /setPickedId\(dipilih \? null : a\.id\)/.test(halamanKode) &&
  /picked\.detail\?\.\(stats\)/.test(halamanKode) &&
  /pickedCard: \{/.test(halaman));
// Dulu pilihannya harus dikosongkan sendiri saat modal ditutup — kalau lupa,
// rincian kategori LAIN ikut terbawa saat modal dibuka lagi. Sebagai halaman,
// state-nya ikut mati saat halamannya ditinggalkan: masalahnya hilang, bukan
// dipindahkan, ASALKAN pilihannya memang milik halaman itu.
c('pilihan lencana milik halamannya sendiri (ikut mati saat ditinggalkan)',
  /const \[pickedId, setPickedId\] = useState<string \| null>\(null\);/.test(halaman));
c('warna semua dari Color, tak ada hex mentah',
  !/#[0-9a-fA-F]{6}/.test(halaman) && !/#[0-9a-fA-F]{6}/.test(petak));

console.log(ok ? '\n✅ LULUS — nomor HP seragam & reward bergrid.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
