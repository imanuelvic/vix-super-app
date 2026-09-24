// Tiga permintaan:
//   1. Top skor pindah ke ATAS jadi tombol medali di header; isinya ikut tab
//      geng yang sedang dibuka (CORE → papan CORE, F3 → papan F3).
//   2. Tambah papan "paling rajin datang", DI BAWAH papan top skor.
//   3. Daftar anggota bawaannya tertutup, & panahnya naik-turun (bukan kanan).
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const ada = (f) => fs.existsSync(R + f);

// Komentar menyebut nama-nama yang diuji; kalau ikut terbaca, cek "ada X di
// kode" lolos hanya karena X ada di komentarnya.
const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

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
const sport = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
  if (nama === './format') return format;
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  // Pengumuman WhatsApp-nya memakai formatRupiah bersama.
  if (nama === './transactions') return { formatRupiah: (n) => 'Rp ' + n };
  if (nama === 'firebase/firestore') return { doc: () => ({}), setDoc: () => Promise.resolve() };
  throw new Error('modul tak terduga: ' + nama);
});
const { topAttendance, topScorers } = sport;

// ===== data uji =====
// Empat anggota F3 dengan riwayat yang sengaja berbeda-beda:
//   andre — tidak pernah absen sejak awal
//   budi  — ikut dari awal tapi bolos separuh
//   citra — BARU bergabung di sesi ke-4, hadir terus sejak itu
//   dedi  — terdaftar tapi belum pernah sekali pun masuk skuad
const orang = (id, name) => ({ id, gang: 'f3', name, phone: '', position: 'flank', note: '' });
const sesi = (id, dayId, squad, gang = 'f3') => ({
  id, gang, dayId, time: '20.00', venue: 'Elang', fee: 65000,
  squad, paid: [], games: [], note: '',
});

const HARI_INI = '2026-09-04';
const data = {
  members: [
    orang('andre', 'Andre'),
    orang('budi', 'Budi'),
    orang('citra', 'Citra'),
    orang('dedi', 'Dedi'),
    { ...orang('erik', 'Erik'), gang: 'core' },
  ],
  sessions: [
    sesi('s1', '2026-01-10', ['andre', 'budi']),
    sesi('s2', '2026-02-10', ['andre', 'budi']),
    sesi('s3', '2026-03-10', ['andre']),
    sesi('s4', '2026-04-10', ['andre', 'citra']),
    // Sesi yang BELUM main — skuadnya sudah terisi semua orang sejak dibuat.
    sesi('s5', '2026-09-20', ['andre', 'budi', 'citra', 'dedi']),
    sesi('c1', '2026-05-10', ['erik'], 'core'),
  ],
  cash: [],
};

const papan = topAttendance(data, 'f3', HARI_INI);
const cari = (id) => papan.find((r) => r.member.id === id);

// ============================================================
console.log('=== 1. Papan paling rajin datang ===');
// ============================================================
c('yang tidak pernah absen ada di puncak',
  papan[0].member.id === 'andre' && papan[0].present === 4 && papan[0].possible === 4,
  papan.map((r) => `${r.member.name}:${r.present}/${r.possible}`).join(' '));
c('urutannya persentase dulu, baru jumlah hadir',
  papan.map((r) => r.member.id).join(',') === 'andre,citra,budi,dedi',
  papan.map((r) => `${r.member.name}:${Math.round(r.rate * 100)}%`).join(' '));

console.log('\n   Aturan yang bikin angkanya jujur');
// Kalau dihitung dari sesi pertama GENGNYA, Citra jadi 1 dari 4 (25%) dan
// terlempar ke bawah Budi — padahal ia tidak pernah absen sekali pun.
c('anggota baru dihitung sejak sesi PERTAMA ia masuk skuad',
  cari('citra').present === 1 && cari('citra').possible === 1 && cari('citra').rate === 1);
c('yang bolos separuh memang 50%',
  cari('budi').present === 2 && cari('budi').possible === 4 && cari('budi').rate === 0.5);
// s5 belum main & skuadnya berisi SEMUA orang. Kalau ikut dihitung, Dedi yang
// belum pernah datang justru melonjak ke puncak dengan 1 dari 1 = 100%.
c('sesi yang belum main tidak dihitung sebagai kehadiran',
  cari('dedi').present === 0 && cari('dedi').possible === 0 &&
  cari('andre').possible === 4);
c('yang belum pernah datang tetap ditampilkan, bukan disembunyikan',
  papan.length === 4 && papan[papan.length - 1].member.id === 'dedi');
c('geng lain tidak ikut tercampur',
  papan.every((r) => r.member.gang === 'f3') &&
  topAttendance(data, 'core', HARI_INI).length === 1);
c('geng tanpa sesi lewat → semua 0 dari 0',
  topAttendance({ ...data, sessions: [] }, 'f3', HARI_INI)
    .every((r) => r.possible === 0 && r.rate === 0));

console.log('\n   Papan top skor tidak ikut berubah');
c('topScorers masih hitungan yang sama (gol dulu, caps penyeimbang)',
  topScorers(data, 'f3').length === 4 &&
  topScorers(data, 'f3').every((r) => r.member.gang === 'f3'));

console.log('\n   Gengnya nilai bersama, tak lagi lewat URL');
c('papan & sub-tabnya membaca geng dari satu tempat yang sama',
  /const \{ gang, setGang \} = useFutsalGang\(\);/.test(baca('app/futsal-board.tsx')) &&
  /const \{ gang, setGang \} = useFutsalGang\(\);/.test(baca('app/friends.tsx')));
c('penyaring URL-nya ikut dibuang, bukan ditinggal jadi kode mati',
  !/gangOf/.test(baca('lib/futsal.ts')));

// ============================================================
console.log('\n=== 2. Tombol medali di header ===');
// ============================================================
const layar = kode('app/friends.tsx');
c('tombolnya di slot kanan header, bentuknya EmojiButton seperti layar lain',
  /right=\{/.test(layar) && /<EmojiButton\s*\n?\s*emoji="🏅"/.test(layar));
// Syaratnya diperiksa DI DALAM slot `right`, bukan di mana pun di berkas ini:
// `tab === 'sport'` muncul dua kali (sekali lagi untuk memilih sub-tabnya),
// jadi cek yang longgar tetap hijau walau syarat tombolnya sendiri dicabut.
c('hanya muncul di sub-tab Fun Futsal', /right=\{\s*tab === 'futsal' \? \(/.test(layar));
c('membuka papan geng yang sedang dibuka (nilainya sudah bersama)',
  /router\.push\('\/futsal-board'\)/.test(layar));
// Header milik layar, sub-tab tidak bisa memberitahunya geng mana yang aktif —
// jadi state-nya harus tinggal di layar & dioper turun.
c('state geng dibaca layar & dioper ke sub-tabnya',
  /const \{ gang, setGang \} = useFutsalGang\(\);/.test(layar) &&
  /<FutsalTab data=\{futsal\} gang=\{gang\} onGangChange=\{setGang\} \/>/.test(layar));

const tab = kode('components/friends/FutsalTab.tsx');
c('SegmentTabs geng melapor ke atas, bukan ke state sendiri',
  /onChange=\{onGangChange\}/.test(tab) && !/useState<FutsalGangKey>/.test(tab));
c('papan top skor benar-benar PINDAH dari sub-tabnya (bukan digandakan)',
  !/Top S(kor|core)/i.test(tab) && !/topScorers/.test(tab));
c('gayanya ikut dibuang, tidak tertinggal jadi gaya mati',
  !/papanRow:/.test(tab) && !/papanGol:/.test(tab));

// ============================================================
console.log('\n=== 3. Halaman papannya ===');
// ============================================================
c('berkas & rutenya ada', ada('app/futsal-board.tsx'));
const papanLayar = kode('app/futsal-board.tsx');
c('rute bertipe sudah diregenerasi',
  baca('.expo/types/router.d.ts').includes('/futsal-board'));
c('sub-halamannya ikut warna Friends',
  /'futsal-board': 'friends'/.test(baca('lib/featureTheme.ts')));
c('geng dibaca dari nilai bersamanya',
  /useFutsalGang\(\)/.test(papanLayar) &&
  !/useLocalSearchParams/.test(papanLayar));
c('gengnya masih bisa ditukar di sini juga', /<GangTabs/.test(papanLayar));
c('dua papan ada di halaman ini',
  /🥇 Top Score/.test(papanLayar) && /🔥 Member Attendance/.test(papanLayar));
c('papan kehadiran ada DI BAWAH papan top skor',
  papanLayar.indexOf('🥇 Top Score') < papanLayar.indexOf('🔥 Member Attendance'));
// Papannya berhenti di sesi TERAKHIR, bukan hari ini — jadi tanggalnya
// ditulis di sebelah judulnya, sebelum ada yang bertanya.
c('tanggal batas hitungannya tertulis di sebelah judul',
  /Per \{formatCompactDate\(perTanggal\)\}/.test(papanLayar));
c('kehadiran dihitung sampai HARI INI, bukan seluruh sesi',
  /topAttendance\(isi, gang, todayId\)/.test(papanLayar));
// "3 dari 3" di atas "18 dari 20" terbaca seperti salah hitung tanpa ini.
// Paragraf penjelasnya dihapus dari layar oleh pemilik app; aturannya sendiri
// tetap harus tertulis di tempat ia dihitung, bukan hilang sama sekali.
c('aturan "sejak ia bergabung" tetap tertulis di tempat ia dihitung',
  /sesi PERTAMA ia muncul di squad/.test(baca('lib/futsal.ts')));
c('persentasenya ditampilkan, bukan cuma angka mentah',
  /Math\.round\(r\.rate \* 100\)/.test(papanLayar));
c('memakai hook data bersama, bukan langganan sendiri',
  /useFutsalData\(\)/.test(papanLayar) && !/subscribeFutsal/.test(papanLayar));

console.log('\n   Judul & panjang papannya');
c('judulnya "Leaderboard", bukan "Papan Prestasi" lagi',
  /title="Leaderboard 🏅"/.test(papanLayar) && !/Papan Prestasi/.test(baca('app/futsal-board.tsx')));
// Papan peringkat dibaca untuk tahu siapa yang DI ATAS. Dengan 19 anggota,
// ekor panjangnya cuma mendorong papan kedua keluar layar.
c('panjangnya dipatok satu konstanta, bukan angka yang ditulis dua kali',
  /^const PAPAN_MAKS = 10;$/m.test(papanLayar) &&
  (papanLayar.match(/\.slice\(0, PAPAN_MAKS\)/g) ?? []).length === 2);
c('KEDUA papan dipotong — top score & paling rajin datang',
  /const papan = papanPenuh\.slice\(0, PAPAN_MAKS\);/.test(papanLayar) &&
  /const rajin = rajinPenuh\.slice\(0, PAPAN_MAKS\);/.test(papanLayar));
// Kalau tidak, papannya terbaca seolah anggotanya memang cuma sepuluh.
c('yang tidak masuk sepuluh besar tetap disebut jumlahnya',
  /papanPenuh\.length > PAPAN_MAKS &&/.test(papanLayar) &&
  /rajinPenuh\.length > PAPAN_MAKS &&/.test(papanLayar) &&
  /nama lain tidak masuk sepuluh besar/.test(papanLayar));
c('yang dipotong tampilannya saja — hitungannya tetap dari SELURUH anggota',
  /const papanPenuh = topScorers\(isi, gang\)\.filter\(/.test(papanLayar) &&
  /const rajinPenuh = topAttendance\(isi, gang, todayId\);/.test(papanLayar) &&
  !/slice/.test(baca('lib/futsal.ts').split('export function topScorers')[1].split('export function')[0]));

// ============================================================
console.log('\n=== 4. Daftar anggota: terbuka & panah naik-turun ===');
// ============================================================
// 6 Sep 2026: dibalik jadi TERBUKA. Ia dulu tertutup supaya belasan baris nama
// tak mendorong kas & riwayat main jauh ke bawah — keduanya sekarang pintu di
// pojok header, jadi tak ada lagi yang bisa terdorong.
c('bawaannya TERBUKA', /const \[anggotaOpen, setAnggotaOpen\] = useState\(true\)/.test(tab));
const toggle = kode('components/common/SectionToggle.tsx');
c('panahnya ke bawah saat tertutup, ke atas saat terbuka',
  /name=\{open \? 'chevron\.up' : 'chevron\.down'\}/.test(toggle));
c('tidak ada lagi panah ke KANAN (itu bahasa "pindah halaman")',
  !/chevron\.right/.test(toggle));

// ============================================================
console.log('\n=== Aturan wajib ===');
// ============================================================
const semuaBaru = baca('app/futsal-board.tsx');
c('warna semua dari Color, tak ada hex mentah', !/#[0-9a-fA-F]{6}/.test(semuaBaru));
c('tidak ada soft-delete diselundupkan', !/isDeleted|archived/.test(semuaBaru));
c('tidak ada dependency baru',
  (semuaBaru.match(/^import .* from '([^']+)'/gm) || []).every((b) =>
    /'(@\/|\.\/|\.\.\/|react|react-native|react-native-safe-area-context|expo-router)/.test(b)));

console.log(ok ? '\n✅ LULUS — papan prestasi terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);