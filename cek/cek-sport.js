// Dua permintaan (3 Sep 2026):
//   1. Pagination di Bible Reading & daftar sejenis — SATU komponen bersama.
//   2. Social: 🥂 → 🤝, plus sub-tab Sport ⚽ (pengurus futsal rutin CORE &
//      NDC F3: jadwal, lapangan, skuad, iuran, skor).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-sport');
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const ada = (f) => fs.existsSync(R + f);

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi lib/futsal ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/futsal.ts',
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
    return { doc: () => ({}), setDoc: () => Promise.resolve() };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
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
const S = require(M('futsal'));
Module._load = asli;

// =====================================================================
console.log('\n== 1. Pagination: satu komponen untuk semua daftar ==');
// =====================================================================
const BERPAGINASI = [
  'components/spiritual/BibleReadingTab.tsx',
  'components/car/LogTab.tsx',
  'components/residence/LogTab.tsx',
  'components/fitness/NotesTab.tsx',
  'components/friends/PlacesTab.tsx',
  'components/career/AffiliateTab.tsx',
];
for (const f of BERPAGINASI) {
  const src = baca(f);
  c(`${f.replace(/^(app|components)\//, '').padEnd(30)} berpaginasi`,
    /import \{ usePagination \} from '@\/hooks\/usePagination'/.test(src) &&
    /import \{ Pagination \} from '@\/components\/common\/Pagination'/.test(src) &&
    /<Pagination\s*\n?\s*page=\{currentPage\}/.test(src) &&
    /pageItems\.map\(/.test(src));
}
// Yang dijaga: SATU komponen & SATU hook bersama — bukan tiap layar bikin
// tombol halamannya sendiri yang lama-lama beda bentuk.
c('tak ada layar yang bikin pagination sendiri',
  BERPAGINASI.every((f) => !/setPage\(page \+ 1\)|halaman \+ 1/.test(baca(f))));
// Ganti halaman harus balik ke atas — TAPI caranya berbeda dan itu memang
// harus: ScrollView yang memegang ref (useScrollTop / useDueJump) tidak boleh
// di-remount lewat `key`, karena refnya ikut putus. Yang ber-ref menggulung
// lewat refnya sendiri.
const takBalikAtas = BERPAGINASI.filter((f) => {
  const src = baca(f);
  const berRef = /<ScrollView[^>]*\n?\s*ref=\{/.test(src);
  return berRef
    ? !/toTop\(\);|scrollTo\(\{ y: 0/.test(src)
    : !/key=\{[^}]*currentPage/.test(src);
});
c('ganti halaman selalu balik ke atas (cara yang cocok tiap layar)',
  takBalikAtas.length === 0, takBalikAtas.join(' · '));
c('ScrollView ber-ref TIDAK di-remount oleh paginasi (refnya bisa putus)',
  BERPAGINASI.every((f) => {
    const src = baca(f);
    return !/<ScrollView\s*\n?\s*key=\{[^}]*currentPage[^>]*\n?\s*ref=\{/.test(src);
  }));
// Sumber kebenarannya tetap satu berkas.
c('hook & komponennya memang milik bersama',
  ada('hooks/usePagination.ts') && ada('components/common/Pagination.tsx'));
c('daftar yang sudah lama berpaginasi tidak diutak-atik',
  /usePagination/.test(baca('components/spiritual/SermonTab.tsx')) &&
  /usePagination/.test(baca('components/friends/SplitBillTab.tsx')));

// =====================================================================
console.log('\n== 2. Social: 🤝 & sub-tab Sport ==');
// =====================================================================
const social = baca('app/friends.tsx');

c('lambangnya 🤝, bukan 🥂 lagi',
  /title="Friends 🤝"/.test(social) && !/🥂/.test(social));
c('sub-tab Fun Futsal ada, di antara Split Bill & Places',
  /\{ key: 'bills'[\s\S]{0,140}\{ key: 'futsal', label: 'Fun Futsal'[\s\S]{0,140}\{ key: 'places'/.test(social));
c('Fun Futsal tetap tab BAWAAN walau posisinya di tengah',
  /useTabScroll<FriendsTab>\('futsal'\)/.test(social));
c('datanya dilangganan & ditunggu sebelum digambar',
  /subscribeFutsal\(user\.uid, setFutsal, fail\)/.test(social) &&
  /futsal === null/.test(social));

// =====================================================================
console.log('\n== 3. Dua geng: CORE & NDC F3 ==');
// =====================================================================
c('gengnya dua: CORE & NDC F3',
  S.FUTSAL_GANGS.map((g) => g.key).join(',') === 'core,f3' &&
  S.gangMeta('f3').label === 'NDC F3',
  S.FUTSAL_GANGS.map((g) => g.label).join(' · '));
c('F3 = NDC Fulltimer Fun Futsal, rutin 2 minggu sekali',
  /Fulltimer Fun Futsal/i.test(S.gangMeta('f3').desc) &&
  S.gangMeta('f3').repeatDays === 14,
  `${S.gangMeta('f3').repeatDays} hari`);
c('tiap geng punya keterangan siapa mereka',
  S.FUTSAL_GANGS.every((g) => g.desc.trim().length > 0 && g.repeatDays > 0));
// "Ulangi" harus benar-benar melompat sejauh jarak rutin gengnya.
c('tombol Ulangi melompat PERSIS sejauh jarak rutin tiap geng',
  S.FUTSAL_GANGS.every((g) => {
    const d = new Date(2026, 8, 5);
    d.setDate(d.getDate() + g.repeatDays);
    const p = (n) => String(n).padStart(2, '0');
    return S.repeatDayId('2026-09-05', g.key) ===
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }),
  S.FUTSAL_GANGS.map((g) => `${g.label} ${g.repeatDays}h → ${S.repeatDayId('2026-09-05', g.key)}`).join(' · '));
// Posisi FUTSAL (5 pemain), bukan posisi sepak bola.
c('posisinya posisi futsal: kiper, anchor, flank, pivot',
  S.FUTSAL_POSITIONS.map((p) => p.key).join(',') === 'kiper,anchor,flank,pivot');
c('tiap posisi menjelaskan tugasnya (biar bagi tim tidak asal comot)',
  S.FUTSAL_POSITIONS.every((p) => p.tugas.length > 10));

// =====================================================================
console.log('\n== 4. Penagihan: siapa sudah & belum bayar ==');
// =====================================================================
const sesi = {
  id: 's1', gang: 'f3', dayId: '2026-09-05', time: '20.00',
  venue: 'Sunter Futsal', fee: 35000,
  squad: ['a', 'b', 'c', 'd'], paid: ['a', 'b'],
  games: [], note: '',
};
c('total = iuran × jumlah yang ikut', S.sessionTotal(sesi) === 140000,
  S.sessionTotal(sesi));
c('yang sudah masuk dihitung dari yang SUDAH setor',
  S.sessionPaidTotal(sesi) === 70000);
c('sisa tagihan = total − yang masuk', S.sessionDueTotal(sesi) === 70000);
c('berapa orang yang belum setor', S.sessionUnpaidCount(sesi) === 2);
// Berhalangan datang bukan berarti tidak ikut patungan: 'b' tidak masuk skuad
// tapi tetap menyetor, dan uang itu memang ada di tanganmu. Yang TIDAK boleh
// ikut berubah adalah daftar tagihannya — yang ditagih tetap orang yang main
// tapi belum setor ('c'), bukan berkurang gara-gara ada yang bayar lebih.
const absenTapiBayar = { ...sesi, squad: ['a', 'c'], paid: ['a', 'b'] };
c('setoran orang yang tidak ikut main tetap dihitung uangnya',
  S.sessionPaidTotal(absenTapiBayar) === 70000, S.sessionPaidTotal(absenTapiBayar));
c('…tapi tidak mengurangi jumlah orang yang masih harus ditagih',
  S.sessionUnpaidCount(absenTapiBayar) === 1, S.sessionUnpaidCount(absenTapiBayar));
// Dengan "total dikurangi yang masuk", sisanya jadi MINUS di kasus ini dan
// terbaca seperti salah hitung. Yang benar: sisa = yang main & belum setor.
c('sisa tagihannya tidak pernah minus gara-gara ada yang bayar lebih',
  S.sessionDueTotal(absenTapiBayar) === 35000, S.sessionDueTotal(absenTapiBayar));

// =====================================================================
console.log('\n== 5. Jadwal rutin ==');
// =====================================================================
const daftar = [
  { ...sesi, id: 'lama', dayId: '2026-08-01' },
  { ...sesi, id: 'depan', dayId: '2026-09-19' },
  { ...sesi, id: 'lebih-depan', dayId: '2026-10-03' },
  { ...sesi, id: 'core-depan', gang: 'core', dayId: '2026-09-10' },
];
c('sesi berikutnya = yang paling dekat & belum lewat',
  S.nextSession(daftar, 'f3', '2026-09-06')?.id === 'depan');
c('sesi hari INI masih terhitung "berikutnya", bukan riwayat',
  S.nextSession(daftar, 'f3', '2026-09-19')?.id === 'depan');
c('riwayat = yang sudah lewat, terbaru dulu',
  S.pastSessions(daftar, 'f3', '2026-09-06').map((s) => s.id).join(',') === 'lama');
c('geng lain tidak ikut tercampur',
  S.nextSession(daftar, 'core', '2026-09-06')?.id === 'core-depan');

// =====================================================================
console.log('\n== 6. Skor & papan top skor ==');
// =====================================================================
const dataSkor = {
  members: [
    { id: 'a', gang: 'f3', name: 'Andre', phone: '0812', position: 'pivot', note: '' },
    { id: 'b', gang: 'f3', name: 'Budi', phone: '', position: 'flank', note: '' },
    { id: 'z', gang: 'core', name: 'Cici', phone: '', position: 'kiper', note: '' },
  ],
  sessions: [
    {
      ...sesi, id: 'g1', squad: ['a', 'b'], paid: [],
      games: [
        { id: 'x', teamA: 'Rompi', teamB: 'Non-Rompi', scoreA: 3, scoreB: 2, scorers: ['a', 'a', 'b'] },
        { id: 'y', teamA: 'Rompi', teamB: 'Non-Rompi', scoreA: 1, scoreB: 4, scorers: ['b'] },
      ],
    },
    { ...sesi, id: 'g2', squad: ['a'], paid: [], games: [] },
  ],
};
c('skor sesi = jumlah seluruh game-nya',
  S.sessionScoreLine(dataSkor.sessions[0]) === '4 – 6',
  S.sessionScoreLine(dataSkor.sessions[0]));
c('sesi tanpa game tidak menampilkan skor apa pun',
  S.sessionScoreLine(dataSkor.sessions[1]) === '');
const papan = S.topScorers(dataSkor, 'f3');
// Dua kali nama yang sama di `scorers` = dua gol. Itu cara mencatat hattrick
// tanpa kolom angka terpisah yang bisa meleset dari skornya.
c('gol dihitung per baris — nama yang sama dua kali = dua gol',
  papan[0].member.name === 'Andre' && papan[0].goals === 2,
  papan.map((r) => `${r.member.name}:${r.goals}`).join(' '));
c('yang rajin datang ikut tercatat (caps)',
  papan.find((r) => r.member.id === 'a').caps === 2 &&
  papan.find((r) => r.member.id === 'b').caps === 1);
c('papan tiap geng berdiri sendiri',
  S.topScorers(dataSkor, 'core').length === 1 &&
  papan.every((r) => r.member.gang === 'f3'));

// =====================================================================
console.log('\n== 7. Badge Sport ==');
// =====================================================================
const hariIni = new Date(2026, 8, 5); // 5 Sep 2026
const dekat = { ...sesi, id: 'dekat', dayId: '2026-09-06', paid: ['a', 'b', 'c', 'd'] };
const jauh = { ...sesi, id: 'jauh', dayId: '2026-09-25', paid: ['a', 'b', 'c', 'd'] };
const lewatNunggak = { ...sesi, id: 'nunggak', dayId: '2026-08-20' };
const lewatLunas = { ...sesi, id: 'lunas', dayId: '2026-08-20', paid: ['a', 'b', 'c', 'd'] };

c('sesi ≤ 2 hari lagi → menagih', S.sessionNeedsAttention(dekat, hariIni) === true);
// Menagih dua minggu sebelumnya cuma bikin badge menyala terus lalu diabaikan.
c('sesi masih jauh → TIDAK menagih', S.sessionNeedsAttention(jauh, hariIni) === false);
c('sesi lewat tapi masih ada yang nunggak → menagih',
  S.sessionNeedsAttention(lewatNunggak, hariIni) === true);
c('sesi lewat & sudah lunas semua → berhenti menagih',
  S.sessionNeedsAttention(lewatLunas, hariIni) === false);
c('angka badge = jumlah sesi yang menagih',
  S.futsalAttention({ members: [], sessions: [dekat, jauh, lewatNunggak, lewatLunas] }, hariIni) === 2);

console.log('\n   …dan tersambung ke Home, sub-tab, & Dashboard');
const home = baca('app/(tabs)/index.tsx');
const dash = baca('app/reminders.tsx');
c('badge sub-tab Fun Futsal memakai aturan yang sama',
  /futsal: futsalAttention\(futsal \?\? EMPTY_FUTSAL, new Date\(\)\)/.test(social));
c('tile Friends di Home = Split Bill + Fun Futsal',
  /friends: bills\.filter\(billUnsettled\)\.length \+ futsalAttention\(futsal, now\)/
    .test(home));
c('gerbang badge Home ikut dinaikkan', (() => {
  const g = Number((home.match(/const BADGE_SOURCES = (\d+);/) || [])[1]);
  return g === (home.match(/mark\('/g) || []).length;
})(), (home.match(/mark\('/g) || []).length + ' mark()');
c('badge Home-nya ikut menghitung Fun Futsal',
  /friends: bills\.filter\(billUnsettled\)\.length \+ futsalAttention\(futsal, now\)/
    .test(baca('app/(tabs)/index.tsx')));
// Kartunya bukan lagi kalimat umum di BadgeReminders: ia menyebut SESI-nya satu
// per satu (lihat futsalReminders), jadi "yang mana, kapan" terjawab di
// Dashboard tanpa membuka fiturnya.
c('kartu reminder Friends menyebut sesinya & lambangnya 🤝',
  /🤝 Reminder Friends/.test(dash) && /futsalReminders\(futsal, now\)/.test(dash));

// =====================================================================
console.log('\n== 8. Layar pengurusnya ==');
// =====================================================================
const tab = baca('components/friends/FutsalTab.tsx');
const rinci = baca('app/futsal/[id].tsx');

c('rute rincian sesi terdaftar & typed routes di-regen',
  ada('app/futsal/[id].tsx') &&
  /name="futsal\/\[id\]"/.test(baca('app/_layout.tsx')) &&
  /futsal\/\[id\]/.test(baca('.expo/types/router.d.ts')));

console.log('\n   Anggota');
c('data umum anggota: nama, nomor HP, posisi',
  /placeholder="Nama"/.test(tab) &&
  /placeholder="Nomor HP/.test(tab) &&
  /FUTSAL_POSITIONS\.map/.test(tab));
// id anggota yang menggantung di sesi lama = orang yang sudah tidak ada tetap
// terhitung "belum setor" selamanya.
c('hapus anggota ikut membersihkan skuad, setoran, & pencetak gol',
  /squad: s\.squad\.filter\(\(id\) => id !== editOrang\.id\)/.test(tab) &&
  /paid: s\.paid\.filter\(\(id\) => id !== editOrang\.id\)/.test(tab) &&
  /scorers: g\.scorers\.filter\(\(id\) => id !== editOrang\.id\)/.test(tab));

console.log('\n   Jadwal & lokasi');
const sheet = baca('components/friends/FutsalSessionSheet.tsx');
c('jadwal punya tanggal, jam, lapangan, iuran, & catatan',
  /<DateField/.test(sheet) && /<TimeField/.test(sheet) &&
  /📍 Lapangan/.test(sheet) && /💵 Iuran per orang/.test(sheet) &&
  /Isi catatan yang terjadi saat itu/.test(sheet));
c('tombol "Ulangi" untuk merutinkan jadwalnya',
  /repeatDayId\(terakhir\.dayId, gang\)/.test(tab));
// Mengetik ulang jam & lapangan yang sama tiap dua minggu = pekerjaan yang
// tidak perlu ada.
const formSesi = baca('hooks/useFutsalSessionForm.ts');
c('jam, lapangan & iuran diwarisi dari main terakhir',
  /terakhir\?\.venue \?\? ''/.test(formSesi) && /terakhir\?\.fee/.test(formSesi));
c('sesi baru langsung berisi SELURUH anggota gengnya',
  /squad: edit\?\.squad \?\? gangMembers\(data, gang\)\.map\(\(m\) => m\.id\)/.test(formSesi));
// Satu formulir, dua layar: aturan di atas tidak boleh punya salinan kedua yang
// diam-diam menyimpang.
c('aturannya cuma ada di satu berkas',
  !/terakhir\?\.venue/.test(tab) && !/squad: editSesi/.test(tab));

console.log('\n   Setoran & skor (layar rincian)');
c('tiap pemain punya dua tanda: ikut main & sudah setor',
  /toggleIkut/.test(rinci) && /toggleLunas/.test(rinci) &&
  (rinci.match(/<CheckCircle/g) || []).length >= 2);
c('yang tidak ikut main TETAP bisa ditandai lunas',
  /async function toggleLunas\(m: FutsalMember\) \{\s*\n\s*if \(!sesi\) return;/.test(rinci) &&
  !/!sesi\.squad\.includes\(m\.id\)\) return;/.test(rinci));
// Batal main bukan berarti uangnya ditarik kembali — mencabutnya diam-diam
// berarti kas kehilangan uang yang sebenarnya ada di tanganmu.
c('mencabut kehadiran TIDAK ikut mencabut setorannya',
  !/paid: ikut \?/.test(rinci));
// Menagih orang yang tidak jadi main itu salah alamat; centang setorannya
// yang harus selalu ada.
c('tombol tagih tetap cuma untuk yang ikut main & belum setor',
  /\{ikut && !lunas && \(/.test(rinci));
c('bisa menagih langsung lewat WhatsApp',
  /openWhatsAppChat\(m\.phone, pesan/.test(rinci) &&
  /Iuran futsal/.test(rinci));
c('nomor HP kosong ditolak dengan penjelasan, bukan diam',
  /Nomor HP-nya belum diisi/.test(rinci));
c('skor per game + pencetak golnya',
  /scoreA: Math\.max\(0, parseInt\(fSkorA, 10\) \|\| 0\)/.test(rinci) &&
  /scorers: fPencetak/.test(rinci));
// Kalau gol yang ditandai lebih sedikit dari skornya, papan top skor diam-diam
// lebih kecil dari kenyataan — itu harus kelihatan saat mengisinya.
c('beda antara skor & gol yang ditandai diberitahu',
  /golDitandai !== golDiketik/.test(rinci) &&
  /tidak masuk papan top skor/.test(rinci));
c('ada catatan per sesi', /📝 Catatan/.test(rinci));

// =====================================================================
console.log('\n== Aturan wajib ==');
// =====================================================================
c('hapus PERMANEN — ditulis ulang tanpa barisnya, tak ada soft-delete',
  /sessions: data\.sessions\.filter\(\(s\) => s\.id !== edit\.id\)/.test(formSesi) &&
  /members: data\.members\.filter\(\(m\) => m\.id !== editOrang\.id\)/.test(tab) &&
  !/isDeleted|archived: true/.test(tab + rinci + formSesi + baca('lib/futsal.ts')));
c('warna semua dari Color, tak ada kode warna mentah',
  !/#[0-9A-Fa-f]{6}/.test(tab) && !/#[0-9A-Fa-f]{6}/.test(rinci));
c('tidak ada dependency/modul native baru',
  !/from '(?!@\/|react|react-native|expo-router|firebase)/.test(tab + rinci));
// Satu dokumen — sesi cuma teks & angka, jauh di bawah batas 1 MB.
c('disimpan di SATU dokumen, tidak bikin koleksi baru',
  /doc\(db, 'users', uid, 'social', 'sport'\)/.test(baca('lib/futsal.ts')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);