// Dua permintaan:
//   1. Social → Friends: nama fitur, nama berkas, token warna, rute, dan
//      lambang tile jadi jabat tangan 🤝.
//   2. Fitur Stuff DIHAPUS PERMANEN — kode, teks, badge, remindernya.
//
// Yang paling penting dijaga di sini bukan namanya, tapi DATANYA: id koleksi
// Firestore ('users/{uid}/social/…') sengaja TIDAK ikut berganti nama.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const ada = (f) => fs.existsSync(R + f);

const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

const cari = (d, keluar = []) =>
  fs.readdirSync(R + d, { withFileTypes: true }).flatMap((e) => {
    const p = `${d}/${e.name}`;
    if (keluar.includes(e.name)) return [];
    if (e.isDirectory()) return cari(p, keluar);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const SUMBER = ['app', 'components', 'lib', 'hooks', 'contexts', 'assets'].flatMap((d) =>
  cari(d),
);

// ============================================================
console.log('=== 1a. Berkasnya benar-benar pindah nama ===');
c('app/friends.tsx ada, app/social.tsx tidak', ada('app/friends.tsx') && !ada('app/social.tsx'));
c('lib/friends.ts ada, lib/social.ts tidak', ada('lib/friends.ts') && !ada('lib/social.ts'));
c('components/friends/ ada, components/social/ tidak',
  ada('components/friends') && !ada('components/social'));
c('keempat komponennya ikut pindah',
  ['PlacesTab', 'SplitBillTab', 'FutsalTab', 'FutsalSessionCard']
    .every((f) => ada(`components/friends/${f}.tsx`)));

console.log('\n=== 1b. Tidak ada alamat lama yang tertinggal ===');
const alamatLama = SUMBER.filter((f) =>
  /@\/lib\/social|@\/components\/social|lib\/social\.ts|components\/social\/|'\/social'/.test(baca(f)),
);
c('tak ada berkas yang masih menunjuk alamat lama', alamatLama.length === 0, alamatLama.join(' · '));
const tokenLama = SUMBER.filter((f) => /SOCIAL(_DARK|_DEEP)?\b/.test(baca(f)));
c('token warna SOCIAL sudah tidak ada di mana pun', tokenLama.length === 0, tokenLama.join(' · '));
c('palet memakai FRIENDS', /FRIENDS: '#/.test(baca('assets/style/color.ts')) &&
  /FRIENDS_DARK: '#/.test(baca('assets/style/color.ts')) &&
  /FRIENDS_DEEP: '#/.test(baca('assets/style/color.ts')));
c('nama tipe & fungsi layarnya ikut',
  /type FriendsTab/.test(kode('app/friends.tsx')) &&
  /function FriendsScreen/.test(kode('app/friends.tsx')) &&
  !/SocialTab|SocialScreen/.test(kode('app/friends.tsx')));
c('judul layarnya "Friends 🤝"', /title="Friends 🤝"/.test(baca('app/friends.tsx')));
c('tombol kembali di seluruh sub-halamannya ikut berganti',
  ['app/bill/[id].tsx', 'app/futsal/[id].tsx', 'app/futsal-cash.tsx', 'app/futsal-schedule.tsx']
    .every((f) => /backLabel="Friends"/.test(baca(f)) && !/backLabel="Social"/.test(baca(f))));

console.log('\n=== 1c. ⚠️ DATA LAMA TIDAK BOLEH IKUT BERGANTI NAMA ===');
// Ini yang paling gampang terlewat saat rename: 'social' di dua baris ini
// adalah ID KOLEKSI Firestore, bukan nama berkas. Menggantinya = seluruh
// tempat nongkrong & data Fun Futsal yang sudah tersimpan tidak terbaca lagi.
c("Places tetap di users/{uid}/social/places",
  /doc\(db, 'users', uid, 'social', 'places'\)/.test(baca('lib/friends.ts')));
c("Fun Futsal tetap di users/{uid}/social/sport",
  /doc\(db, 'users', uid, 'social', 'sport'\)/.test(baca('lib/futsal.ts')));
c('Split Bill tetap di users/{uid}/bills',
  /collection\(db, 'users', uid, 'bills'\)/.test(baca('lib/friends.ts')));

console.log('\n=== 1d. Tile Home & rutenya ===');
const grid = baca('lib/featureGrid.ts');
c("kunci, nama & rutenya 'friends'",
  /key: 'friends', sort: \d+, label: 'Friends'/.test(grid) && /route: '\/friends'/.test(grid));
c('lambangnya jabat tangan — glif satu warna, bukan emoji',
  /glyph: 'handshake'/.test(grid) && !/emoji:/.test(grid));
// 23 Sep 2026: tile Married dihapus; Friends tetap sesudah Games.
c('urutan tile tidak digeser (Friends tetap sesudah Games)',
  grid.indexOf("key: 'games'") < grid.indexOf("key: 'friends'") && !/married/i.test(grid));
// 22 Sep 2026: grid tile pindah ke tab Life.
c('Life menggambar glif kalau ada, ikon kalau tidak',
  /feature\.glyph \?/.test(kode('app/(tabs)/life.tsx')) &&
  /IconGlyph name=\{feature\.glyph\} size=\{30\}/.test(kode('app/(tabs)/life.tsx')) &&
  /IconSymbol name=\{feature\.icon\} size=\{30\}/.test(kode('app/(tabs)/life.tsx')));
c('tinggal SATU tile yang pakai glif (Friends; sisanya SF Symbols)',
  (grid.match(/glyph: '/g) || []).length === 1);
c('ikon wineglass yang jadi yatim ikut dibuang',
  !/wineglass/.test(baca('components/ui/icon-symbol.tsx')) && !/wineglass/.test(grid));
c('seluruh sub-rutenya ikut warna Friends',
  ['friends', 'bill', 'futsal', 'futsal-cash', 'futsal-schedule'].every((k) =>
    new RegExp(`'?${k}'?: 'friends'`).test(baca('lib/featureTheme.ts'))));
c('rute bertipe sudah diregenerasi',
  baca('.expo/types/router.d.ts').includes('/friends') &&
  !baca('.expo/types/router.d.ts').includes('/social'));
c('Today menagih patungan belum lunas & sesi futsal dari sumber yang sama',
  /sortedBills\(input\.bills\)\.filter\(billUnsettled\)/.test(kode('lib/today.ts')) &&
  /futsalReminders\(input\.futsal, now\)/.test(kode('lib/today.ts')));
// Di Dashboard, Friends tak lagi cuma sebuah ANGKA: ia punya kartunya sendiri
// yang menyebut sesi & tagihannya satu per satu.
c('kartu reminder Dashboard-nya ikut',
  /Reminder Friends/.test(kode('app/reminders.tsx')) &&
  /futsalReminders\(futsal, now\)/.test(kode('app/reminders.tsx')));

// ============================================================
console.log('\n=== 2a. Stuff hilang dari kode ===');
c('lib/stuff.ts dihapus', !ada('lib/stuff.ts'));
c('lib/stuffSeed.ts dihapus', !ada('lib/stuffSeed.ts'));
c('components/device/StuffTab.tsx dihapus', !ada('components/device/StuffTab.tsx'));
// Satu-satunya "stuff" yang boleh tersisa adalah catatan di device.tsx yang
// menerangkan bahwa fiturnya memang dihapus (termasuk path Firestore-nya).
const sisa = SUMBER.filter((f) => /stuff/i.test(kode(f)));
c('tak ada satu pun KODE yang masih menyebut stuff', sisa.length === 0, sisa.join(' · '));

console.log('\n=== 2b. Tidak ada sisa yang menggantung ===');
const device = kode('app/device.tsx');
c("sub-tab Device tinggal dua", /type DeviceTab = 'log' \| 'iphone';/.test(device));
c('tab Stuff dicabut dari daftar tab', !/label: 'Stuff'/.test(device));
c('badge sub-tabnya tinggal iPhone',
  /iphone: deviceNeedsTopUp\(plans \?\? \[\], 'iphone', now\) \? 1 : 0,/.test(device) &&
  !/stuff:/.test(device));
const home = kode('app/(tabs)/index.tsx');
c('baris Device di Today tinggal paket kuota',
  /devicesNeedingTopUp\(input\.dataPlans, now\)/.test(kode('lib/today.ts')));
// Gerbangnya menunggu N langganan. Kelebihan satu = baris TAK PERNAH muncul,
// karena ia menunggu sumber yang sudah tidak ada lagi.
c('gerbang Today tidak menunggu langganan yang sudah dihapus', (() => {
  const data = kode('hooks/useTodayData.ts');
  const gerbang = Number((data.match(/const SOURCES = (\d+);/) || [])[1]);
  return gerbang > 0 && gerbang === (data.match(/mark\('/g) || []).length;
})(), `SOURCES vs ${(kode('hooks/useTodayData.ts').match(/mark\('/g) || []).length} mark()`);
c('Dashboard tidak lagi melanggan datanya',
  !/setStuff|subscribeStuff/.test(kode('app/reminders.tsx')));
c('kartu reminder Device tidak lagi menjanjikan barang bergaransi',
  !/bergaransi/.test(baca('components/reminders/BadgeReminders.tsx')));
c('device.tsx mencatat bahwa Stuff dihapus TOTAL (beda dari iPad yang cuma disembunyikan)',
  /DIHAPUS TOTAL/.test(baca('app/device.tsx')) &&
  /users\/\{uid\}\/app\/stuff/.test(baca('app/device.tsx')));

console.log('\n=== 2c. Hook bersamanya tidak ikut terbawa ===');
// useDueJump dipakai 11 daftar lain — menghapusnya bersama Stuff akan
// mematikan lompat-ke-titik-merah di seluruh app.
c('useDueJump tetap ada', ada('hooks/useDueJump.ts'));
c('…dan masih dipakai banyak daftar lain',
  SUMBER.filter((f) => /useDueJump\(/.test(baca(f))).length >= 8);

console.log(ok ? '\nSEMUA LULUS' : '\nADA YANG GAGAL');
process.exit(ok ? 0 : 1);