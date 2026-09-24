// Tiga permintaan (5 Sep 2026, sore):
//   1. Tab geng (CORE / NDC F3) TETAP di tempatnya saat digulung, dan cuma
//      memuat nama klubnya — tanpa "0 sesi" / "21 orang" / "1 jadwal".
//   2. Riwayat main pindah SELURUHNYA ke halaman Jadwal Main ("Lihat semua"),
//      satu daftar berisi semua pertandingan + paginasi.
//   3. "Lihat semua" dari tab CORE mendarat di CORE, dari F3 mendarat di F3.
const AKAR = require('./akar');
const fs = require('fs');
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

const LAYAR = [
  ['components/friends/FutsalTab.tsx', 'sub-tab Fun Futsal'],
  ['app/futsal-schedule.tsx', 'Jadwal Main'],
  ['app/futsal-board.tsx', 'Leaderboard'],
];

// ============================================================
console.log('=== 1. Tab geng tetap & cuma nama klubnya ===');
// ============================================================
// Ketiganya kini memakai komponen yang SAMA — dulu blok ini disalin tiga kali,
// lengkap dengan jarak kiri-kanannya.
const gangTabs = baca('components/friends/GangTabs.tsx');
for (const [f, nama] of LAYAR) {
  const src = baca(f);
  // Batas kata: "<GangTabsX" tidak boleh ikut lolos sebagai awalan.
  const iTab = src.search(/<GangTabs\b/);
  const iGulung = src.indexOf('<ScrollView');
  // Di LUAR gulungan, bukan sekadar "dipatok": dua judul yang sama-sama
  // dipatok saling mendorong — yang di atas hilang begitu yang bawah tiba.
  c(`${nama.padEnd(16)} tab geng berdiri di luar ScrollView`,
    iTab !== -1 && iGulung !== -1 && iTab < iGulung,
    `tab @${iTab}, scroll @${iGulung}`);
}
c('deretan tabnya satu komponen bersama, bukan tiga salinan',
  /<SegmentTabs/.test(gangTabs) &&
  LAYAR.every(([f]) => !/<SegmentTabs/.test(baca(f))));
c('barisnya punya jarak kiri-kanan yang sama dengan isi halamannya',
  /bar: \{ paddingHorizontal: 20 \}/.test(gangTabs));
// Keterangan kecilnya dibuang: yang dicari di deretan ini cuma "aku sedang di
// geng mana".
c('tanpa keterangan angka di bawah namanya', !/sub:/.test(gangTabs));
c('nama klubnya tetap lengkap (emoji + label)',
  /label: `\$\{g\.emoji\} \$\{g\.label\}`/.test(gangTabs));
// SegmentTabs sendiri tetap sanggup membawa keterangan — yang dilepas cuma
// pemakaiannya di Fun Futsal, bukan kemampuannya (Habits & Bible masih pakai).
c('SegmentTabs tetap boleh punya `sub` untuk layar lain',
  /sub\?: string;/.test(baca('components/common/SegmentTabs.tsx')));
c('layar lain memang masih memakainya',
  /sub:/.test(baca('components/habits/HabitsTab.tsx')));

const tab = baca('components/friends/FutsalTab.tsx');
c('nomor patokan Anggota turun lagi (baris Jadwal Main pindah ke header)',
  /^const STICKY_HEADERS = \[3\];$/m.test(tab));
{
  // Dihitung sungguhan, bukan dipercaya dari komentarnya.
  const a = tab.indexOf('stickyHeaderIndices={STICKY_HEADERS}');
  const b = tab.indexOf('\n      </ScrollView>', a);
  const anak = tab.slice(a, b).split('\n').filter((l) => /^ {8}<[A-Za-z]/.test(l));
  c('anak ke-3 memang judul Anggota, dan jumlah anaknya tetap',
    anak.length === 5 && anak[3].includes('<SectionToggle'),
    anak.map((l, i) => `${i}:${l.trim().slice(0, 12)}`).join(' '));
}

// ============================================================
console.log('\n=== 2. Riwayat main pindah ke "Lihat semua" ===');
// ============================================================
const jadwal = baca('app/futsal-schedule.tsx');
c('sub-tab Fun Futsal tak lagi memuat daftar riwayat',
  !/Riwayat Main/.test(tab) && !/pastSessions/.test(kode('components/friends/FutsalTab.tsx')));
c('halaman Jadwal Main memuat KEDUANYA — akan datang & riwayat',
  /const akanDatang = upcomingSessions\(isi\.sessions, gang, todayId\)/.test(jadwal) &&
  /const riwayat = pastSessions\(isi\.sessions, gang, todayId\)/.test(jadwal));
// Yang akan datang di ATAS: itu yang masih bisa diurus.
c('satu daftar: yang akan datang dulu, riwayat menyusul',
  /const semua = \[\.\.\.akanDatang, \.\.\.riwayat\];/.test(jadwal));
// Dua paginasi di satu layar = dua tombol halaman, dan tak pernah jelas yang
// mana milik siapa.
c('paginasinya SATU, atas daftar gabungan itu',
  /usePagination\(semua\)/.test(jadwal) &&
  (jadwal.match(/<Pagination/g) ?? []).length === 1);
c('judul "Riwayat Main" muncul sekali, tepat di batasnya',
  /const mulaiRiwayat =\s*\n\s*lewat && \(i === 0 \|\| daysToSession\(pageItems\[i - 1\], now\) >= 0\);/.test(jadwal) &&
  /\{mulaiRiwayat && \(/.test(jadwal));
// 6 Sep 2026: kartu "main berikutnya" dibuang dari halaman ini, dan jarak hari
// ("27 hari lagi") ikut pergi bersamanya — kartu itu satu-satunya yang
// menampilkannya. Tanggal lengkap di tiap baris tetap ada.
c('helper jaraknya ikut dibuang, bukan ditinggal menganggur',
  !/function jarak/.test(jadwal) && !/hari lalu/.test(jadwal));
c('sub-tab Fun Futsal jadi lebih pendek: anggota & kas tak terdorong ke bawah',
  tab.indexOf('👥 Anggota') > 0 && !/pageItems/.test(tab.split('SectionToggle')[0]));

console.log('\n   Sesi lama tetap bisa diubah & dihapus');
// Riwayat pindah halaman TIDAK boleh berarti sesi lama jadi tak tersentuh:
// tombol pensilnya ikut pindah, bukan hilang.
c('kartu di halaman Jadwal Main punya tombol ubah',
  /onEdit=\{form\.bukaUbah\}/.test(jadwal));
c('formulirnya SATU, dipakai dua layar (bukan disalin)',
  fs.existsSync(R + 'hooks/useFutsalSessionForm.ts') &&
  fs.existsSync(R + 'components/friends/FutsalSessionSheet.tsx') &&
  /useFutsalSessionForm\(isi, gang\)/.test(jadwal) &&
  /useFutsalSessionForm\(data, gang\)/.test(tab) &&
  /<FutsalSessionSheet form=/.test(jadwal) && /<FutsalSessionSheet form=/.test(tab));
// Aturan penyimpanannya yang paling mahal kalau tercecer di dua tempat.
c('aturan "sesi baru = semua anggota masuk squad" cuma ditulis sekali',
  /squad: edit\?\.squad \?\? gangMembers\(data, gang\)\.map\(\(m\) => m\.id\)/
    .test(baca('hooks/useFutsalSessionForm.ts')) &&
  !/squad: editSesi/.test(tab));
c('menghapus jadwal tetap hard delete (tak ada penanda arsip)',
  /sessions: data\.sessions\.filter\(\(s\) => s\.id !== edit\.id\)/
    .test(baca('hooks/useFutsalSessionForm.ts')));
c('galat formulirnya tetap terbaca di badan sub-tab',
  /message=\{formSesi\.formError \?\? formError\}/.test(tab));

// ============================================================
console.log('\n=== 3. Gengnya SATU nilai bersama, bukan satu per layar ===');
// ============================================================
// Dulu gengnya dititipkan lewat ?gang= tiap kali pindah halaman: cukup SATU
// tombol lupa mengoper dan kamu mendarat di geng lain — yang terbaca bukan
// "aku salah tab", tapi "kas CORE-ku kosong".
const ctx = baca('contexts/futsalGang.tsx');
c('gengnya punya satu tempat tinggal',
  /createContext</.test(ctx) && /export function useFutsalGang\(/.test(ctx));
c('bawaannya CORE', /useState<FutsalGangKey>\('core'\)/.test(ctx));
c('providernya dipasang di akar app, jadi semua layar kebagian',
  /<FutsalGangProvider>/.test(baca('app/_layout.tsx')));
c('keempat layar membaca geng dari sana', [
  'app/friends.tsx',
  'app/futsal-schedule.tsx',
  'app/futsal-board.tsx',
  'app/futsal-cash.tsx',
].every((f) => /const \{ gang, setGang \} = useFutsalGang\(\);/.test(baca(f))));
c('tak ada lagi geng yang dititipkan lewat URL',
  !/params: \{ gang \}/.test(tab + baca('app/friends.tsx')) &&
  !/gangOf/.test(baca('lib/futsal.ts')) &&
  !/useLocalSearchParams/.test(jadwal + baca('app/futsal-board.tsx')));

console.log(ok ? '\n✅ LULUS — tab tetap, riwayat pindah, geng ikut.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
