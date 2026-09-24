// Enam permintaan (4 Sep 2026, malam):
//   1. isian link Google Maps di formulir jadwal
//   2. "Sampai jam" — dan jamnya tidak boleh lebih awal dari jam mulai
//   3. Kas jadi tombol 💰 di pojok header, sebelah Leaderboard
//   4. kartu jadwal terdekat bisa diklik → rincian sesinya
//   5. bahan diskusi benar-benar teracak dari SELURUH daftarnya
//   6. rekap wishlist jadi tombol kecil 📋 di sebelah Tambah Wishlist
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const rapat = (f) => baca(f).replace(/\s+/g, ' ');
// Buang komentar dulu: assertion yang melarang sebuah kata harus menguji KODE,
// bukan kalimat yang justru menerangkan kenapa kata itu tak ada lagi di kode.
const kode = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

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

const sheet = baca('components/friends/FutsalSessionSheet.tsx');
const form = baca('hooks/useFutsalSessionForm.ts');
const tab = baca('components/friends/FutsalTab.tsx');

// ============================================================
console.log('=== 1. Link Google Maps di formulirnya ===');
// ============================================================
c('isiannya ada, tepat di bawah lapangannya',
  /🔗 Link Maps lapangan/.test(sheet) &&
  sheet.indexOf('📍 Lapangan') < sheet.indexOf('🔗 Link Maps lapangan'));
c('tersimpan di sesinya & ikut ke pengumuman WhatsApp',
  /mapsUrl\?: string;/.test(baca('lib/futsal.ts')) &&
  /if \(s\.mapsUrl\) baris\.push\(s\.mapsUrl\);/.test(baca('lib/futsal.ts')));
// Ketik sekali, terbawa sendiri tiap menjadwalkan lagi di lapangan yang sama.
c('diwarisi dari sesi terakhir', /setMaps\(terakhir\?\.mapsUrl \?\? ''\)/.test(form));

// ============================================================
console.log('\n=== 2. Sampai jam ===');
// ============================================================
c('dua isian jam: dari & sampai',
  /🕗 Dari Jam/.test(sheet) && /🕙 Sampai Jam/.test(sheet));
c('rodanya tidak bisa diputar ke bawah jam mulai',
  /minimumDate=\{form\.jam\}/.test(sheet) &&
  /minimumDate\?: Date;/.test(baca('components/common/TimeField.tsx')) &&
  /minimumDate=\{minimumDate\}/.test(baca('components/common/TimeField.tsx')));
// Roda jam saja tidak cukup: Android mengabaikan batas itu, dan data lama tak
// pernah lewat rodanya sama sekali.
c('penjagaan kedua saat menyimpan, bukan cuma di rodanya',
  /if \(menit\(jamSelesai\) <= menit\(jam\)\) \{/.test(form) &&
  /Jam selesainya harus lebih malam dari jam mulai\./.test(form));
c('tersimpan di sesinya', /endTime\?: string;/.test(baca('lib/futsal.ts')) &&
  /endTime: jamTeks\(jamSelesai\)/.test(form));
c('lama mainnya diwarisi (bawaan 2 jam sesudah mulai)',
  /setJamSelesai\(\s*\n?\s*keJam\(terakhir\?\.endTime \?\? tambahJam/.test(form));

{
  const F = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
    if (nama === './firebase') return { db: {} };
    if (nama === './liveDoc') return { liveDoc: () => () => {} };
    if (nama === './transactions') return { formatRupiah: (n) => 'Rp ' + n };
    if (nama === './format') return {
      dayId: () => '', dayIdToDate: (s) => new Date(`${s}T00:00:00`),
      formatDayDate: () => '', formatFullDate: () => 'Selasa, 1 September 2026',
    };
    if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
    return {};
  });
  const sesi = {
    id: 's1', gang: 'f3', dayId: '2026-09-01', time: '18.00', endTime: '20.00',
    venue: 'Elang Futsal', fee: 65000, squad: [], paid: [], games: [], note: '',
  };
  c('jamnya tampil sebagai rentang', F.sessionTimeRange(sesi) === '18.00–20.00');
  // Sesi lama belum punya jam selesai — tak boleh berubah jadi "18.00–undefined".
  c('sesi lama tanpa jam selesai tetap wajar',
    F.sessionTimeRange({ ...sesi, endTime: undefined }) === '18.00');
  const teks = F.sessionRecap({ members: [], sessions: [], cash: [] }, sesi);
  c('pengumumannya ikut menyebut rentangnya', teks.includes('🕐 18:00–20:00'), teks.split('\n')[3]);
}
// Satu penyusun untuk semua layar — kalau tidak, sesi yang sama terbaca beda
// jamnya tergantung kamu sedang berdiri di mana.
c('semua layar memakai penyusun yang sama',
  /sessionTimeRange\(s\)/.test(baca('components/friends/FutsalSessionCard.tsx')) &&
  /sessionTimeRange\(berikut\)/.test(tab) &&
  /sessionTimeRange\(sesi\)/.test(baca('app/futsal/[id].tsx')));

// ============================================================
console.log('\n=== 3. Kas jadi tombol di pojok header ===');
// ============================================================
const friends = rapat('app/friends.tsx');
c('tombol 💰 ada, sebelah tombol 🏅',
  /emoji="💰" onPress=\{\(\) => router\.push\('\/futsal-cash'\)\}/.test(friends) &&
  friends.indexOf('emoji="💰"') < friends.indexOf('emoji="🏅"'));
c('keduanya cuma di sub-tab Fun Futsal', /tab === 'futsal' \? \( <>/.test(friends));
c('kartu Kas benar-benar keluar dari daftar (bukan digandakan)',
  !/futsal-cash/.test(tab) && !/kasCard/.test(tab) && !/cashBalance/.test(tab));
c('halaman Kas-nya sendiri tetap ada & terdaftar',
  fs.existsSync(R + 'app/futsal-cash.tsx') &&
  /name="futsal-cash"/.test(baca('app/_layout.tsx')));

// ============================================================
console.log('\n=== 4. Kartu jadwal terdekat bisa diklik ===');
// ============================================================
c('kartunya membuka rincian sesinya',
  /<PressableScale\s*\n\s*disabled=\{!berikut\}\s*\n\s*onPress=\{\(\) => berikut && bukaRincian\(berikut\)\}>/.test(tab));
// Belum ada jadwal → tak ada yang bisa dibuka; tombolnya mati, bukan membuka
// layar kosong.
c('tanpa jadwal, kartunya tidak bisa diklik', /disabled=\{!berikut\}/.test(tab));
// 6 Sep: daftar kartu di bawahnya DIBUANG — jadwal terdekatnya sudah jadi
// kartu besar di atas, dan kartu kecil yang mengulang hal yang sama persis
// dalam satu layar itulah yang bikin halaman ini terasa penuh tapi kosong.
// Yang dijaga sekarang: kartu besarnya benar-benar satu-satunya pintu, dan
// tujuannya tetap rincian sesi yang sama.
c('tujuannya rincian sesi, lewat satu pintu yang sama',
  /const bukaRincian = \(s: FutsalSession\) =>\s*\n\s*router\.push\(\{ pathname: '\/futsal\/\[id\]'/.test(
    tab,
  ));
c('tidak ada lagi kartu kedua yang mengulanginya', !/<FutsalSessionCard/.test(tab));
// 6 Sep 2026: pintunya PINDAH ke pojok header, jadi tombol 📅. Baris judul
// yang isinya cuma satu tombol itu judul yang tak memayungi apa pun — ia
// memakan tinggi satu bagian penuh untuk satu klik, dan ikut menggulung hilang
// justru waktu daftar jadwalnya paling dicari.
c('pintu ke daftar lengkapnya pindah ke tombol 📅 di header',
  // Diuji pada kode SAJA — komentar di berkasnya memang masih menyebut
  // 'Jadwal Main', justru untuk menerangkan ke mana pintunya pergi.
  !/title="📅 Jadwal Main"/.test(kode(tab)) &&
    !/router\.push\('\/futsal-schedule'\)/.test(kode(tab)) &&
    /<EmojiButton emoji="📅" onPress=\{\(\) => router\.push\('\/futsal-schedule'\)\} \/>/.test(
      baca('app/friends.tsx'),
    ));
// Urutannya dari yang paling sering dibuka: uang, jadwal, lalu papan.
c('tombolnya duduk PERSIS di tengah, antara 💰 kas & 🏅 papan',
  /emoji="💰"[\s\S]{0,220}emoji="📅"[\s\S]{0,220}emoji="🏅"/.test(baca('app/friends.tsx')));

// ============================================================
console.log('\n=== 5. Bahan diskusi teracak ===');
// ============================================================
const hashString = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const L = pasang(tsc(baca('lib/learning.ts')), (nama) => {
  if (nama === './core') return { hashString };
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (nama === './health') return { dayDocId: (d) => d.toISOString().slice(0, 10) };
  if (nama === './usage') return {
    weekStart: (d) => {
      const x = new Date(d);
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      x.setHours(0, 0, 0, 0);
      return x;
    },
  };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return new Proxy({}, { get: () => () => undefined });
});
{
  const minggu = (w) => L.topicsOfWeek(new Date(2026, 8, 7 + w * 7));
  const putaran = Math.ceil(L.TOPICS.length / L.TOPICS_PER_WEEK);
  c('tiga topik per minggu, selalu berbeda', [0, 1, 5, 9].every((w) => {
    const t = minggu(w);
    return t.length === 3 && new Set(t.map((x) => x.key)).size === 3;
  }));
  // Inti permintaannya: TIDAK lagi tiga topik dari kelompok yang sama tiap
  // minggu (daftar aslinya dikelompokkan, jadi tiga berurutan = satu tema).
  let sekelompok = 0;
  for (let w = 0; w < putaran; w++) {
    if (new Set(minggu(w).map((x) => x.group)).size === 1) sekelompok += 1;
  }
  c('hampir tak ada minggu yang ketiganya satu kelompok',
    sekelompok <= 2, `${sekelompok} dari ${putaran} minggu`);
  const kelompok = new Set();
  for (let w = 0; w < 6; w++) minggu(w).forEach((t) => kelompok.add(t.group));
  c('enam minggu pertama menyentuh banyak kelompok',
    kelompok.size >= 4, [...kelompok].join(', '));
  // Diacak boleh, hilang tidak: semua topik tetap kebagian gilirannya.
  const kena = new Set();
  for (let w = 0; w < putaran; w++) minggu(w).forEach((t) => kena.add(t.key));
  c('seluruh topik kebagian sebelum ada yang terulang',
    kena.size === L.TOPICS.length, `${kena.size}/${L.TOPICS.length}`);
  // Acak yang BERUBAH tiap app dibuka = topik minggu ini berganti sendiri.
  c('urutannya tetap: dibuka lagi, topiknya sama',
    JSON.stringify(minggu(3).map((t) => t.key)) ===
      JSON.stringify(minggu(3).map((t) => t.key)));
  c('minggu berikutnya memang berganti',
    JSON.stringify(minggu(3)) !== JSON.stringify(minggu(4)));
  // Yang tersisa cuma penyebutannya di komentar, bukan pemakaiannya:
  // undian yang berubah tiap app dibuka = topik minggu ini berganti sendiri.
  // drawWeekSkill (14 Sep 2026) boleh mengundi: ia jalan HANYA saat tombol
  // 🔀 di-click, dan hasilnya langsung disimpan (setWeekSkill), jadi rotasi
  // mingguannya sendiri tetap deterministik. Badannya dikecualikan di sini.
  const kodeLearning = baca('lib/learning.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/export function drawWeekSkill\([\s\S]*?\n\}/, '');
  c('bukan Math.random (di luar undian tombol 🔀)', !/Math\.random/.test(kodeLearning));
}

// ============================================================
console.log('\n=== 6. Rekap wishlist jadi tombol kecil ===');
// ============================================================
const timeline = baca('app/timeline.tsx');
// 14 Sep 2026 malam (permintaan user): 📋 pindah ke header, di kiri tombol
// bagikan; tombol utamanya kini sendirian selebar layar.
c('📋 rekap di header (EmojiButton), sebelum tombol bagikan',
  /right=\{\s*\n\s*<>[\s\S]{0,400}<EmojiButton\s*\n\s*emoji="📋"\s*\n\s*onPress=\{openRekap\}[\s\S]{0,300}icon="square\.and\.arrow\.up"/.test(timeline) &&
  !/aksiRow|recapButton/.test(timeline));
c('tulisan panjangnya sudah tidak ada di tombol itu',
  !/📋 All Wishlist Recap\s*\n\s*<\/VixText>/.test(timeline));
c('fungsinya sama persis — sheet rekapnya tak berubah',
  /title="📋 All Wishlist Recap"/.test(timeline) &&
  /const \[rekapOpen, setRekapOpen\]/.test(timeline));
c('tombol utamanya selebar layar (tanpa baris pendamping)',
  // (16 Sep 2026: jaraknya jadi CARD_GAP bersama, bukan angka lepas.)
  /addButton: \{ marginBottom: CARD_GAP \}/.test(timeline) &&
  /<PrimaryButton\s*\n\s*label="Tambah Wishlist"[\s\S]{0,200}additionalStyle=\{styles\.addButton\}\s*\n\s*\/>/.test(timeline),
  (timeline.match(/addButton: \{[^}]*\}/) ?? [])[0]);

console.log(ok ? '\n✅ LULUS — enam permintaan terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
