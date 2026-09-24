// Tiga permintaan:
//   1. Kas tim per geng (seperti Pocket 👛 di Finance) + total semua tim.
//   2. Anggota urut abjad, bisa dibuka-tutup, berpaginasi; "Akan Datang"
//      punya halaman sendiri yang juga berpaginasi.
//   3. Sub-tab Sport & Split Bill bertukar posisi; namanya jadi "Fun Futsal".
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

// Komentar di berkas ini menyebut nama-nama yang diuji; kalau ikut terbaca,
// cek "ada X di kode" lolos hanya karena X ada di komentar.
const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// ===== modul nyata =====
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
// Firestore & firebase cuma dipakai di bagian penyimpanan; hitungannya murni.
const sport = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
  if (nama === './format') return format;
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  // Pengumuman WhatsApp-nya memakai formatRupiah bersama.
  if (nama === './transactions') return { formatRupiah: (n) => 'Rp ' + n };
  if (nama === 'firebase/firestore') return { doc: () => ({}), setDoc: () => Promise.resolve() };
  throw new Error('modul tak terduga: ' + nama);
});

const {
  cashBalance, gangCash, sessionCashIn,
  gangMembers, upcomingSessions, nextSession, EMPTY_FUTSAL,
} = sport;

// ===== data uji =====
const orang = (id, gang, name) => ({ id, gang, name, phone: '', position: 'flank', note: '' });
const sesi = (id, gang, dayId) => ({
  id, gang, dayId, time: '20.00', venue: 'Elang', fee: 65000,
  squad: [], paid: [], games: [], note: '',
});
const uang = (id, gang, dayId, direction, amount, extra = {}) => ({
  id, gang, dayId, title: 't', direction, amount, note: '', ...extra,
});

// ============================================================
console.log('=== 1a. Saldo kas tiap geng berdiri sendiri ===');
const kas = {
  members: [],
  sessions: [],
  cash: [
    uang('a', 'f3', '2026-09-01', 'in', 700000),
    uang('b', 'f3', '2026-09-02', 'out', 300000),
    uang('c', 'core', '2026-09-01', 'in', 250000),
  ],
};
c('masuk dikurangi keluar', cashBalance(kas, 'f3') === 400000);
c('geng lain tidak ikut terhitung', cashBalance(kas, 'core') === 250000);
// Kartu "Total kas semua tim" dibuang 6 Sep: saldo tiap geng sudah tertulis
// di pilihan tabnya sendiri, jadi kartunya cuma mengulang angka yang sama.
c('saldo tiap geng berdiri sendiri (kas CORE tak menambal kas F3)',
  cashBalance(kas, 'core') + cashBalance(kas, 'f3') === 650000);
c('geng tanpa mutasi = 0, bukan NaN',
  cashBalance({ ...kas, cash: [] }, 'f3') === 0);
c('kas boleh minus (pengeluaran mendahului iuran)',
  cashBalance({ ...kas, cash: [uang('x', 'f3', '2026-09-01', 'out', 50000)] }, 'f3') === -50000);

console.log('\n=== 1b. Mutasi terbaru dulu ===');
const urut = gangCash(kas, 'f3').map((x) => x.id);
c('tanggal terbaru di atas', JSON.stringify(urut) === JSON.stringify(['b', 'a']));
c('hanya geng yang diminta', gangCash(kas, 'core').every((x) => x.gang === 'core'));
c('dua mutasi di TANGGAL SAMA tetap punya urutan tetap (tidak acak)',
  (() => {
    const d = { ...kas, cash: [uang('p1', 'f3', '2026-09-05', 'in', 1), uang('p2', 'f3', '2026-09-05', 'in', 2)] };
    const a = gangCash(d, 'f3').map((x) => x.id).join();
    const b = gangCash(d, 'f3').map((x) => x.id).join();
    return a === b;
  })());

console.log('\n=== 1c. Uang sesi tidak pernah masuk kas dua kali ===');
// Inti penjagaannya: tombol setor cuma menawarkan SELISIH terkumpul − tercatat.
const kasSesi = {
  members: [],
  sessions: [],
  cash: [
    uang('s1', 'f3', '2026-09-01', 'in', 455000, { sessionId: 'S' }),
    uang('s2', 'f3', '2026-09-03', 'in', 130000, { sessionId: 'S' }),
    uang('lain', 'f3', '2026-09-03', 'in', 999, { sessionId: 'LAIN' }),
    uang('keluar', 'f3', '2026-09-03', 'out', 500000, { sessionId: 'S' }),
  ],
};
c('setoran susulan ikut terhitung (455rb + 130rb)',
  sessionCashIn(kasSesi, 'S') === 585000);
c('sesi lain tidak ikut', sessionCashIn(kasSesi, 'LAIN') === 999);
c('uang KELUAR tidak dianggap setoran masuk',
  sessionCashIn(kasSesi, 'S') !== 1085000);
c('sesi yang belum pernah disetor = 0', sessionCashIn(kasSesi, 'BELUM') === 0);
c('mutasi manual (tanpa sessionId) tak pernah cocok',
  sessionCashIn({ ...kasSesi, cash: [uang('m', 'f3', '2026-09-01', 'in', 5)] }, 'S') === 0);

console.log('\n=== 2a. Anggota urut abjad ===');
const anggotaData = {
  members: [
    orang('1', 'f3', 'William'),
    orang('2', 'f3', 'Arifin'),
    orang('3', 'core', 'Budi'),
    orang('4', 'f3', 'cliff'),
    orang('5', 'f3', 'Denise'),
  ],
  sessions: [],
  cash: [],
};
const nama = gangMembers(anggotaData, 'f3').map((m) => m.name);
c('urut A→Z', JSON.stringify(nama) === JSON.stringify(['Arifin', 'cliff', 'Denise', 'William']));
c('huruf kecil tidak dibuang ke belakang (bukan urutan ASCII)',
  nama.indexOf('cliff') === 1);
c('geng lain tidak ikut', !nama.includes('Budi'));
c('geng kosong → daftar kosong, bukan error',
  gangMembers({ ...anggotaData, members: [] }, 'f3').length === 0);

console.log('\n=== 2b. Jadwal akan datang ===');
const jadwal = {
  members: [], cash: [],
  sessions: [
    sesi('lampau', 'f3', '2026-08-01'),
    sesi('nanti', 'f3', '2026-10-01'),
    sesi('hariini', 'f3', '2026-09-03'),
    sesi('dekat', 'f3', '2026-09-10'),
    sesi('gengLain', 'core', '2026-09-05'),
  ],
};
const akan = upcomingSessions(jadwal.sessions, 'f3', '2026-09-03').map((s) => s.id);
c('paling dekat dulu', JSON.stringify(akan) === JSON.stringify(['hariini', 'dekat', 'nanti']));
c('HARI INI masih terhitung akan datang', akan[0] === 'hariini');
c('yang sudah lewat tidak ikut', !akan.includes('lampau'));
c('geng lain tidak ikut', !akan.includes('gengLain'));
c('nextSession = yang pertama dari daftar itu (satu sumber kebenaran)',
  nextSession(jadwal.sessions, 'f3', '2026-09-03').id === akan[0]);
c('belum ada jadwal → null', nextSession([], 'f3', '2026-09-03') === null);

console.log('\n=== 2c. Sub-tab: buka-tutup, urut, paginasi ===');
const tab = kode('components/friends/FutsalTab.tsx');
c('daftar anggota bisa dibuka-tutup', /<SectionToggle/.test(tab));
c('tombol + Tambah tidak ikut menutup bagiannya (dioper lewat right)',
  /right=\{[\s\S]{0,400}\+ Tambah/.test(tab));
c('anggotanya lewat gangMembers (urut abjad), bukan filter mentah',
  /gangMembers\(data, gang\)/.test(tab) &&
  !/data\.members\.filter\(\(m\) => m\.gang === gang\)/.test(tab));
c('anggota punya paginasi sendiri', /usePagination\(anggota\)/.test(tab));
c('…dan TIDAK ikut me-remount ScrollView (layar tak melompat ke atas)',
  /key=\{gang\}/.test(tab) && !/orang\.currentPage\}`/.test(tab));
// Riwayat main pindah ke halaman Jadwal Main — di sub-tab ini ia cuma
// mendorong anggota & kas jauh ke bawah, padahal keduanya yang dibuka tiap hari.
c('riwayat tidak lagi menumpang di sub-tab ini',
  !/usePagination\(riwayat\)/.test(tab) && !/Riwayat Main/.test(tab));

console.log('\n=== 2d. Pintu ke halaman sendiri ===');
// 4 Sep 2026: kartunya pindah jadi tombol 💰 di pojok header — daftarnya
// sudah panjang, dan pintu yang ikut menggulung itu pintu yang dicari-cari.
c('pintu ke halaman Kas ada di pojok header',
  /emoji="💰" onPress=\{\(\) => router\.push\('\/futsal-cash'\)\}/.test(
    baca('app/friends.tsx').replace(/\s+/g, ' '),
  ) && !/futsal-cash/.test(tab));
// Gengnya tak perlu dititipkan lagi: ia nilai bersama (contexts/futsalGang).
// 6 Sep 2026 (malam): pintu Jadwal Main MENYUSUL Kas ke pojok header — tombol
// 📅, persis di tengah antara 💰 & 🏅. Baris judul yang isinya cuma satu
// tombol itu judul yang tak memayungi apa pun, dan ia pun ikut menggulung
// hilang justru waktu daftar jadwalnya paling dicari.
c('pintu ke halaman Jadwal Main ikut pindah ke pojok header',
  /emoji="📅" onPress=\{\(\) => router\.push\('\/futsal-schedule'\)\}/.test(
    baca('app/friends.tsx').replace(/\s+/g, ' '),
  ) && !/futsal-schedule/.test(tab));
// Hitungan "(1)" di tombolnya ikut hilang, dan itu disengaja: jadwal terdekat
// sudah jadi kartu besar di halaman depan sub-tab ini.
c('tak ada lagi hitungan jadwal yang menggantung di sub-tab',
  !/akanDatang/.test(tab));
// 6 Sep: sub-tab ini tak lagi memuat daftarnya sama sekali (jadwal
// terdekatnya sudah jadi kartu besar di atas). Kartunya sendiri tetap hidup —
// dipakai halaman Jadwal Main — dan tetap TIDAK disalin ke mana-mana.
c('sub-tab ini tak lagi memuat daftar kartunya', !/<FutsalSessionCard/.test(tab));
c('kartu sesi dipakai bersama, tidak disalin dua kali',
  /<FutsalSessionCard/.test(kode('app/futsal-schedule.tsx')) &&
    !/function KartuSesi/.test(tab));
const kartu = kode('components/friends/FutsalSessionCard.tsx');
// Tetap opsional: halaman Leaderboard & kartu "main berikutnya" memakainya
// tanpa pensil. Yang berubah cuma halaman jadwal, yang sekarang MEMILIKI
// formulirnya (lewat hook bersama) karena riwayat tinggal di sana.
c('tombol pensilnya opsional', /onEdit\?: /.test(kartu) && /onEdit \? <EditButton/.test(kartu));
c('gaya kartu sesi tidak tertinggal jadi gaya mati di FutsalTab',
  !/sesiCard:/.test(tab) && !/pilSkor:/.test(tab));
const jadwalLayar = kode('app/futsal-schedule.tsx');
c('halaman jadwal memakai kartu yang sama', /<FutsalSessionCard/.test(jadwalLayar));
c('halaman jadwal berpaginasi', /usePagination\(semua\)/.test(jadwalLayar));
c('halaman jadwal memuat yang akan datang DAN riwayatnya',
  /upcomingSessions\(/.test(jadwalLayar) && /pastSessions\(/.test(jadwalLayar) &&
  /const semua = \[\.\.\.akanDatang, \.\.\.riwayat\];/.test(jadwalLayar));

console.log('\n=== 1d. Halaman Kas ===');
const kasLayar = kode('app/futsal-cash.tsx');
c('kartu total sudah tidak ada lagi', !/cashTotal/.test(kasLayar));
c('saldonya tetap terbaca di tiap tab geng',
  /sub: formatRupiah\(cashBalance\(isi, g\.key\)\)/.test(kasLayar));
c('saldo per geng tampil', /cashBalance\(isi, gang\)/.test(kasLayar));
c('mutasi berpaginasi', /usePagination\(mutasi\)/.test(kasLayar));
c('judul wajib diisi', /!fJudul\.trim\(\)/.test(kasLayar));
c('jumlah nol ditolak', /jumlah <= 0/.test(kasLayar));
c('hapus PERMANEN (tulis ulang tanpa barisnya)',
  /cash: data\.cash\.filter\(\(c\) => c\.id !== edit\.id\)/.test(kasLayar));
c('penanda sesi asal dipertahankan saat mutasi diubah',
  /edit\?\.sessionId \? \{ sessionId: edit\.sessionId \}/.test(kasLayar));

console.log('\n=== 1e. Setor dari layar sesi ===');
const rinci = kode('app/futsal/[id].tsx');
c('yang ditawarkan cuma SELISIH, bukan seluruh uang masuk',
  /const belumKeKas = masuk - keKas;/.test(rinci) && /amount: belumKeKas/.test(rinci));
c('tombolnya hilang kalau tidak ada sisa', /belumKeKas > 0 \?/.test(rinci));
c('penjagaan kedua di dalam fungsinya', /belumKeKas <= 0\) return;/.test(rinci));
c('barisnya ditandai sesi asalnya', /sessionId: sesi\.id/.test(rinci));
c('masuk ke kas GENG sesi itu, bukan geng yang sedang dibuka di layar lain',
  /gang: sesi\.gang/.test(rinci));

console.log('\n=== 3. Sub-tab Social ===');
const social = kode('app/friends.tsx'); // fiturnya kini bernama Friends
const urutTab = [...social.matchAll(/key: '(futsal|bills|places)'/g)].map((m) => m[1]);
c('urutan tab: Split Bill → Fun Futsal → Places',
  JSON.stringify(urutTab) === JSON.stringify(['bills', 'futsal', 'places']));
c('namanya "Fun Futsal"', /label: 'Fun Futsal'/.test(social));
c('nama lama "Sport" polos sudah tidak dipakai', !/label: 'Sport'/.test(social));
c('BAWAAN tetap Fun Futsal walau posisinya pindah',
  /useTabScroll<FriendsTab>\('futsal'\)/.test(social));
c('badge tiap tab tetap terpasang', /futsal: futsalAttention\(/.test(social));
c('ikonnya bola kaki, sesuai nama fiturnya',
  /icon: 'soccerball'/.test(social) &&
  /'soccerball': 'sports-soccer'/.test(baca('components/ui/icon-symbol.tsx')));

console.log('\n=== 4. Data lama & rute ===');
c('EMPTY_FUTSAL punya kas', Array.isArray(EMPTY_FUTSAL.cash));
c('dokumen lama tanpa kolom kas tidak bikin layar mati',
  /cash: d\?\.cash \?\? \[\]/.test(kode('lib/futsal.ts')));
c('hapus anggota tidak menghapus kas (…data dipertahankan)',
  /\.\.\.data,\s*members: data\.members\.filter/.test(tab));
c('kedua rute terdaftar di Stack',
  /name="futsal-cash"/.test(kode('app/_layout.tsx')) &&
  /name="futsal-schedule"/.test(kode('app/_layout.tsx')));
c('kedua rute ikut warna Friends',
  /'futsal-cash': 'friends'/.test(kode('lib/featureTheme.ts')) &&
  /'futsal-schedule': 'friends'/.test(kode('lib/featureTheme.ts')));
c('rute bertipe sudah diregenerasi',
  baca('.expo/types/router.d.ts').includes('/futsal-cash') &&
  baca('.expo/types/router.d.ts').includes('/futsal-schedule'));

console.log(ok ? '\nSEMUA LULUS' : '\nADA YANG GAGAL');
process.exit(ok ? 0 : 1);