// Tiga permintaan:
//   1.  Ulang tahun mendekat menyebut nama HARI-nya juga, bukan cuma tanggal.
//   2a. Judul "👥 Anggota" di Fun Futsal DIPATOK di atas saat digulung — tombol
//       tutupnya tetap terjangkau. Bawaannya tetap tertutup.
//   2b. Di CORE, membuka satu daftar otomatis menutup yang lain.
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
const core = pasang(tsc(baca('lib/core.ts')), (nama) => {
  if (nama === './format') return format;
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (nama === './photo') return { pickCompressedImage: () => Promise.resolve(null) };
  if (nama === 'firebase/firestore') {
    return new Proxy({}, { get: () => () => ({}) });
  }
  throw new Error('modul tak terduga: ' + nama);
});

// ============================================================
console.log('=== 1. Ulang tahun menyebut nama harinya ===');
// ============================================================
// Theresia di fotomu: 11 September, dilihat dari 4 September 2026 → Jumat.
const hariIni = new Date(2026, 8, 4);
const theresia = { birthYear: 1999, birthMonth: 8, birthDay: 11 };
const b = core.nextBirthday(theresia, hariIni);
c('tanggalnya ikut dikembalikan, bukan cuma jumlah harinya',
  b.date instanceof Date && b.daysUntil === 7 && b.turningAge === 27,
  JSON.stringify({ d: b.daysUntil, u: b.turningAge }));
c('nama harinya benar', format.formatDayMonth(b.date) === 'Jumat, 11 September',
  format.formatDayMonth(b.date));

// Inilah sebabnya tanggalnya TIDAK boleh disusun ulang dari birthDay/birthMonth
// di layar: yang sudah lewat tahun ini jatuh di TAHUN DEPAN, dan nama harinya
// beda. 4 Februari 2027 = Kamis; kalau dipaksa 2026 hasilnya Rabu.
const febryna = { birthYear: 1999, birthMonth: 1, birthDay: 4 };
const b2 = core.nextBirthday(febryna, hariIni);
c('ulang tahun yang jatuh TAHUN DEPAN pakai hari tahun itu, bukan tahun ini',
  b2.date.getFullYear() === 2027 &&
  format.formatDayMonth(b2.date) === format.formatDayMonth(new Date(2027, 1, 4)) &&
  format.formatDayMonth(b2.date) !== format.formatDayMonth(new Date(2026, 1, 4)),
  format.formatDayMonth(b2.date));

const followup = kode('components/core/FollowupTab.tsx');
c('layarnya memakai tanggal dari nextBirthday, bukan menyusunnya sendiri',
  /\{formatDayMonth\(b\.date\)\}/.test(followup) &&
  !/\{b\.birthDay\} \{MONTH_NAMES\[b\.birthMonth\]\}/.test(followup));
c('sisanya tidak berubah: berapa hari lagi & umur ke berapa',
  /ultah \{b\.daysUntil\} hari lagi/.test(followup) && /ke-\{b\.turningAge\}/.test(followup));

// ============================================================
console.log('\n=== 2a. Judul "Anggota" dipatok di Fun Futsal ===');
// ============================================================
const tabSport = baca('components/friends/FutsalTab.tsx').replace(/\r\n/g, '\n');
c('ScrollView-nya memang memakai patokan', /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(tabSport));
c('nomornya konstan di luar komponen, bukan array baru tiap render',
  /^const STICKY_HEADERS = \[3\];$/m.test(tabSport));

// Nomor patokan itu MENGHITUNG anak langsung ScrollView. Jadi diperiksa
// sungguhan: anak ke-5 harus benar-benar <SectionToggle>, dan tidak boleh ada
// anak bersyarat telanjang sebelum itu (yang lenyap saat syaratnya salah).
const isiScroll = tabSport.slice(
  tabSport.indexOf('<ScrollView'),
  tabSport.indexOf('</ScrollView>'),
);
const anak = isiScroll.split('\n').filter((l) => /^ {8}<[A-Za-z]/.test(l));
c('anak ke-3 memang judul Anggota', /^ {8}<SectionToggle/.test(anak[3] ?? ''),
  anak.map((l, i) => `${i}:${l.trim().slice(0, 14)}`).join(' '));
c('tidak ada anak bersyarat telanjang yang bisa menggeser nomornya',
  !/^ {8}\{[a-zA-Z]/m.test(isiScroll));

const toggle = baca('components/common/SectionToggle.tsx');
c('judulnya berlatar pekat — daftar di bawahnya lewat persis di belakangnya',
  /backgroundColor: Color\.BACKGROUND/.test(toggle));
// ScrollView memindahkan style anak sticky-nya ke pembungkusnya sendiri, jadi
// flexDirection di style terluar tidak pernah sampai ke isinya.
c('barisnya dipegang View di DALAM, bukan style terluar',
  /<View style=\{styles\.head\}>[\s\S]{0,900}<View style=\{styles\.row\}>/.test(toggle) &&
  /row: \{\s*\n\s*flexDirection: 'row',/.test(toggle));
c('isinya TIDAK lagi di dalam komponennya (kalau tidak, yang terpatok seluruh daftar)',
  !/children/.test(kode('components/common/SectionToggle.tsx')));
c('tombol "+ Tambah" tetap di luar area buka-tutup',
  /right=\{/.test(kode('components/friends/FutsalTab.tsx')) &&
  /\{right\}/.test(toggle));
// 6 Sep 2026: dibalik jadi TERBUKA — kas & riwayat main sudah pindah ke pojok
// header, jadi daftar ini tak bisa lagi mendorong apa pun ke bawah.
c('bawaannya kini TERBUKA',
  /const \[anggotaOpen, setAnggotaOpen\] = useState\(true\);/.test(tabSport));
c('panahnya tetap naik-turun', /name=\{open \? 'chevron\.up' : 'chevron\.down'\}/.test(toggle));

// ============================================================
console.log('\n=== 2b. CORE: satu terbuka, yang lain menutup ===');
// ============================================================
const leaders = kode('components/core/LeadersTab.tsx');
// Dua boolean membuat "keduanya terbuka" jadi keadaan yang MUNGKIN, lalu harus
// dijaga tangan di tiap tombol. Satu nilai membuatnya mustahil.
c('dipegang SATU state, bukan dua boolean terpisah',
  /const \{ isOpen, toggle: toggleSeksi \} = useAccordion<'cl' \| 'mt'>\(\);/.test(
    leaders,
  ) &&
  !/const \[clOpen, setClOpen\]/.test(leaders) &&
  !/const \[mtOpen, setMtOpen\]/.test(leaders));
c('kedua keadaannya diturunkan dari state itu',
  /const clOpen = isOpen\('cl'\);/.test(leaders) &&
  /const mtOpen = isOpen\('mt'\);/.test(leaders));
// Aturan "klik lagi = tutup" kini di hooks/useAccordion.ts, dijalankan di
// cek-akordion.js. Di sini cukup: layar ini memang memakainya.
c('mengklik yang sama menutupnya lagi',
  /useAccordion<'cl' \| 'mt'>\(\)/.test(leaders));
c('kedua tombolnya lewat pintu yang sama',
  /onPress=\{\(\) => toggleSeksi\('cl'\)\}/.test(leaders) &&
  /onPress=\{\(\) => toggleSeksi\('mt'\)\}/.test(leaders));
c('bawaannya tetap dua-duanya tertutup',
  /useAccordion<'cl' \| 'mt'>\(\)/.test(leaders));
c('judul CORE tetap dipatok seperti sebelumnya',
  /const STICKY_HEADERS = \[1, 3\];/.test(baca('components/core/LeadersTab.tsx')) &&
  /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(leaders));

console.log(ok ? '\n✅ LULUS — nama hari & patokan judul terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);