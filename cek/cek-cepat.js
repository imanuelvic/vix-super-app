// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Bukti perbaikan kecepatan & biaya: badge muncul serentak, foto nota keluar
// dari dokumen tagihan, dan aturan lint yang dimatikan memang beralasan.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// 22 Sep 2026: langganan & gerbangnya pindah ke hooks/useTodayData.
const home = baca('hooks/useTodayData.ts');
const gate = baca('hooks/useReadyGate.ts');

console.log('\n1. Badge Home muncul SERENTAK');
ok('ada gerbang "tampilkan setelah semuanya tiba"',
  /export function useReadyGate/.test(gate));
// Bentuk badge-nya sekarang milik <Badge> bersama (dipakai tile Home, sub-tab,
// & tombol pojok kanan) — jadi "0 tak digambar" & fade-nya diperiksa di sana.
// Yang tetap milik Home: GERBANGnya, supaya badge tidak bermunculan satu per
// satu sambil datanya menetes.
// 22 Sep 2026: gerbangnya pindah ke hooks/useTodayData (baris Today, bukan
// badge tile); layar Today menggambar bagian-bagiannya sesudah `ready`.
ok('baris Today baru digambar setelah gerbangnya terbuka',
  /\{ready \? \(/.test(BACA_TODAY('app/(tabs)/index.tsx')) && /useReadyGate\(SOURCES\)/.test(home));
ok('…dan memudar masuk bersamaan, bukan berkedip muncul',
  /entering=\{FadeIn\.duration\(260\)\}/.test(
    baca('components/common/Badge.tsx'),
  ) && /if \(!count \|\| count <= 0\) return null;/.test(
    baca('components/common/Badge.tsx'),
  ));

// Jumlah sumber yang ditunggu HARUS sama dengan jumlah yang ditandai mark().
const jumlahMark = (home.match(/mark\('[a-zA-Z]+', set/g) ?? []).length;
const diminta = Number(/const SOURCES = (\d+);/.exec(home)[1]);
ok(`SOURCES (${diminta}) = jumlah sumber yang ditandai (${jumlahMark})`,
  diminta === jumlahMark,
  'kalau beda, badge tidak akan pernah muncul / muncul kecepatan');

// Tiap kunci mark() harus UNIK — kunci kembar bikin hitungannya kurang.
const kunci = [...home.matchAll(/mark\('([a-zA-Z]+)', set/g)].map((m) => m[1]);
ok('kunci tiap sumber unik', new Set(kunci).size === kunci.length,
  JSON.stringify(kunci));

ok('semua sumber badge ikut ditandai (tak ada yang kelewat)',
  ['bills', 'chores', 'tasks', 'otherTasks', 'leaders', 'visitations',
   'login', 'carParts', 'roadmap', 'freelance', 'fitDay', 'debts',
   'learningWeek', 'topicsDone'].every((k) => kunci.includes(k)),
  JSON.stringify(kunci));

ok('streak journey ikut ditandai (hero With God menunggu login, bukan berkedip)',
  /subscribeLoginStreak\(uid, mark\('login', setLogin\), fail\)/.test(home));
ok('hanya menambah SATU render (penanda di ref, state disentuh sekali)',
  /const seen = useRef<Set<string>>\(new Set\(\)\);/.test(gate) &&
  /if \(s\.size >= total\) setReady\(true\);/.test(gate));
ok('hero & prioritas TIDAK ikut ditahan — layarnya tetap tampil seketika',
  !/if \(!ready\) return/.test(BACA_TODAY('app/(tabs)/index.tsx')));

console.log('\n2. Biaya Firestore: foto nota keluar dari dokumen tagihan');
const social = baca('lib/friends.ts');
const billScreen = baca('app/bill/[id].tsx');
const splitTab = baca('components/friends/SplitBillTab.tsx');

ok('dokumen tagihan tidak lagi memuat foto base64',
  !/photo: string \| null;/.test(social) && /hasPhoto: boolean;/.test(social));
ok('fotonya pindah ke dokumen sendiri',
  /'bills', id, 'media', 'photo'/.test(social) &&
  /export function subscribeBillPhoto/.test(social));
ok('dibaca lewat liveDoc → ikut dibagi bersama & ter-cache di HP',
  /return liveDoc\(\s*billPhotoRef\(uid, id\)/.test(social));
ok('hanya layar RINCIAN yang mengambilnya',
  /subscribeBillPhoto\(uid, id, setPhoto\)/.test(billScreen) &&
  !/subscribeBillPhoto/.test(splitTab) && !/subscribeBillPhoto/.test(home));
ok('daftar tetap bisa menunjukkan notanya sudah difoto (tanpa mengunduhnya)',
  /bill\.hasPhoto \? ' · 📸' : ''/.test(splitTab));
ok('hapus tagihan ikut membuang fotonya (Firestore tidak otomatis)',
  /await deleteDoc\(billPhotoRef\(uid, id\)\);\s*await deleteDoc\(billRef\(uid, id\)\);/.test(social));
ok('daftar tagihan tetap dibatasi 60 & urut satu field (tanpa composite index)',
  /orderBy\('date', 'desc'\), limit\(60\)/.test(social));

console.log('\n3. Aturan lint yang dimatikan — beralasan & terbatas');
const cfg = baca('eslint.config.js');
ok('hanya react-hooks/immutability, bukan seluruh react-hooks',
  /'react-hooks\/immutability': 'off'/.test(cfg) &&
  !/'react-hooks\/set-state-in-effect': 'off'/.test(cfg) &&
  !/'react-hooks\/purity': 'off'/.test(cfg));
ok('alasannya ditulis, lengkap dengan tautan isu upstream',
  /github\.com\/react\/react\/issues\/29641/.test(cfg) &&
  /Reanimated/.test(cfg));
ok('kode animasinya TIDAK dibongkar — tetap memakai API Reanimated',
  /scale\.value = withSpring\(scaleTo, SPRING\)/.test(baca('components/common/PressableScale.tsx')));

console.log(gagal === 0
  ? '\n✅ LULUS — badge serentak & biaya Firestore turun.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
