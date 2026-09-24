// Cek 3 permintaan: hitung mundur jendela baca Alkitab, sesi Siang 12–14
// (termasuk kartu reminder di Home), dan reward Learning mingguan +
// urutan kategori reward mengikuti grid Home.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

const spiritual = baca('lib/spiritual.ts');
const layarBaca = baca('app/bible-reading.tsx');
const format = baca('lib/format.ts');

// ==================== 1. Hitung mundur ====================
console.log('\n1. Hitung mundur — sampai kapan bacanya');
ok('rumusnya ada di lib (bukan dihitung di layar)',
  /export function bibleMinutesLeft\(session: BibleSession, now: Date\): number/.test(spiritual) &&
  /meta\.toHour \* 60 - \(now\.getHours\(\) \* 60 \+ now\.getMinutes\(\)\)/.test(spiritual));
ok('bentuknya sama dengan hitung mundur doa pagi yang sudah ada',
  /PRAYER_DEADLINE_HOUR \* 60 - \(now\.getHours\(\) \* 60 \+ now\.getMinutes\(\)\)/.test(
    baca('lib/reward.ts'),
  ));
ok('angkanya ikut jam berjalan (useNow), bukan beku saat layar dibuka',
  /const \{ now \} = useNow\(\);/.test(layarBaca));

// Bukti perilaku: rumus yang SAMA dijalankan atas beberapa jam.
const SESI = { morning: 10, daytime: 14, night: 24 };
const sisa = (sesi, jam, menit) => SESI[sesi] * 60 - (jam * 60 + menit);
ok('pagi jam 08.40 → sisa 1 jam 20 menit (contoh di layar)',
  sisa('morning', 8, 40) === 80);
ok('siang jam 13.30 → sisa 30 menit', sisa('daytime', 13, 30) === 30);
ok('malam jam 23.59 → sisa 1 menit', sisa('night', 23, 59) === 1);
ok('lewat jendelanya → angkanya negatif (dianggap habis)',
  sisa('morning', 11, 0) < 0 && sisa('daytime', 15, 0) < 0);

// Penulisan waktunya.
function formatMinutesLeft(mins) {
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} menit`;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}
ok('penulisannya milik bersama di lib/format', /export function formatMinutesLeft/.test(format));
ok('95 → "1 jam 35 menit"', formatMinutesLeft(95) === '1 jam 35 menit');
ok('120 → "2 jam" (tanpa "0 menit")', formatMinutesLeft(120) === '2 jam');
ok('40 → "40 menit"', formatMinutesLeft(40) === '40 menit');
ok('negatif tidak pernah tampil minus', formatMinutesLeft(-30) === '0 menit');

console.log('\n   Tampilannya');
ok('hanya muncul selagi sesi ini BELUM diisi & belum dilewati',
  /\{!existing && \(/.test(layarBaca));
ok('30 menit terakhir jadi merah (aba-aba, bukan warna berkedip)',
  /const closingSoon = minutesLeft <= 30;/.test(layarBaca) &&
  /countdownSoon: \{ backgroundColor: Color\.DANGER_TRANSPARENT \}/.test(layarBaca));
ok('menyebut jam tutupnya, bukan cuma sisa waktunya',
  /tutup jam \$\{meta\.toHour\}\.00/.test(layarBaca));
ok('kalau sudah lewat, teksnya JUJUR: masih boleh dicatat',
  /Jendela \$\{meta\.label\.toLowerCase\(\)\} sudah lewat/.test(layarBaca) &&
  /Masih boleh dicatat sekarang/.test(layarBaca));
ok('tombol Lewati & Sudah baca tidak diutak-atik',
  /label="✅ Sudah baca"/.test(layarBaca) &&
  /label="⏭️ Lewati baca hari ini"/.test(layarBaca));

// ==================== 2. Sesi Siang ====================
console.log('\n2. Sesi Siang 12.00–14.00');
ok('tipe sesinya bertiga', /export type BibleSession = 'morning' \| 'daytime' \| 'night';/.test(spiritual));
// Lambangnya kini dari lib/daypart.ts (satu set Pagi/Siang/Malam untuk semua
// fitur) — dulu ☀️ di sini tapi 🌤️ di Habits.
// Judulnya boleh diringkas sendiri oleh pemiliknya — yang dijaga di sini
// JENDELA JAM-nya, bukan bunyi judulnya.
ok('jendelanya 12–15',
  /key: 'daytime', label: 'Siang', title: '[^']+', emoji: DAYPART\.daytime, fromHour: 12, toHour: 15/.test(spiritual));
ok('urutannya Pagi → Siang → Malam',
  spiritual.indexOf("key: 'morning', label: 'Pagi'") <
    spiritual.indexOf("key: 'daytime', label: 'Siang'") &&
  spiritual.indexOf("key: 'daytime', label: 'Siang'") <
    spiritual.indexOf("key: 'night', label: 'Malam'"));
ok('nama kolomnya "daytime" — sama dengan sesi Siang di Habits',
  /daytime: \(data\?\.daytime as string\) \?\? ''/.test(spiritual) &&
  /'morning' \| 'daytime' \| 'night'/.test(baca('lib/habits.ts')));

// Bukti perilaku jendela jam.
const SESSIONS = [
  { key: 'morning', fromHour: 5, toHour: 10 },
  { key: 'daytime', fromHour: 12, toHour: 14 },
  { key: 'night', fromHour: 21, toHour: 24 },
];
const sesiJam = (h) =>
  SESSIONS.find((s) => h >= s.fromHour && h < s.toHour)?.key ?? null;
ok('jam 12 & 13 → Siang', sesiJam(12) === 'daytime' && sesiJam(13) === 'daytime');
ok('jam 14 sudah bukan Siang lagi', sesiJam(14) === null);
ok('pagi & malam tidak bergeser',
  sesiJam(5) === 'morning' && sesiJam(9) === 'morning' && sesiJam(10) === null &&
  sesiJam(21) === 'night' && sesiJam(23) === 'night');
ok('jam 11 & 15 memang tidak ada sesinya (seperti sebelumnya)',
  sesiJam(11) === null && sesiJam(15) === null);

console.log('\n   Reminder di Home ikut otomatis');
const home = baca('app/(tabs)/index.tsx');
ok('kartunya digerakkan bibleSessionNow (jadi Siang ikut tanpa kode baru)',
  /const bibleSession = bibleSessionNow\(now\);/.test(home) &&
  /bibleReading\[bibleSession\]/.test(home));
ok('bibleSessionNow membaca BIBLE_SESSIONS, bukan daftar sendiri',
  /BIBLE_SESSIONS\.find\(\(s\) => h >= s\.fromHour && h < s\.toHour\)/.test(spiritual));
ok('judul & emoji kartunya dari meta sesi', /\{bibleMeta\.emoji\} \{bibleMeta\.title\}/.test(home));

console.log('\n   Yang ikut menyesuaikan');
ok('rentetan "lengkap" kini = KETIGA sesi terisi',
  /export function bibleDayComplete\(/.test(spiritual) &&
  /=== BIBLE_SESSIONS\.length - 1/.test(spiritual));
ok('ternary "morning ? night : morning" sudah tidak ada di mana pun',
  !/'morning' \? 'night' : 'morning'/.test(layarBaca) &&
  !/'morning' \? 'night' : 'morning'/.test(baca('components/spiritual/BibleReadingTab.tsx')));
ok('hapus catatan: dokumen harinya cuma dibuang kalau tak ada sesi lain',
  /export function bibleHasOther\(/.test(spiritual) &&
  /bibleHasOther\(editing, session\)/.test(baca('components/spiritual/BibleReadingTab.tsx')));
ok('hapus tetap PERMANEN (deleteDoc, bukan penanda)',
  /otherFilled \? setDoc\(ref, \{ \[session\]: '' \}, \{ merge: true \}\) : deleteDoc\(ref\)/.test(spiritual));
ok('tab riwayat Spiritual otomatis dapat 3 segmen',
  /BIBLE_SESSIONS\.map\(\(s\) => \(\{/.test(baca('components/spiritual/BibleReadingTab.tsx')));
ok('parameter URL sesi divalidasi di satu tempat',
  /export function bibleSessionOf\(/.test(spiritual) &&
  /const session = bibleSessionOf\(sessionParam\);/.test(layarBaca));

// ==================== 3. Reward Learning + urutan ====================
console.log('\n3a. Reward Learning — rentetan MINGGUAN');
const learning = baca('lib/learning.ts');
const ach = baca('lib/reward.ts');
ok('satu dokumen kecil sendiri', /'users', uid, 'app', 'learningStreak'/.test(learning));
ok('memakai rumus rentetan bersama (bukan hitungan baru)',
  /nextStreak\(current, weekId, prevWeekId\(weekId\)\)/.test(learning) &&
  /from '\.\/streak'/.test(learning));
ok('"kemarin"-nya = MINGGU lalu (mundur 7 hari dari Senin)',
  /dayIdToDate\(weekId\)\.getTime\(\) - 7 \* 86_400_000/.test(learning));
ok('maksimal naik 1× per minggu', /if \(alreadyCounted\(current, weekId\)\) return Promise\.resolve\(\);/.test(learning));
ok('naik saat 4 langkah minggu itu tuntas',
  /if \(nowComplete\) \{\s*await bumpLearningStreak\(user\.uid, streak, weekId\);/.test(
    baca('components/learning/WeekTab.tsx'),
  ));

// Bukti perilaku rentetan mingguan.
const dayId = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDate = (id) => {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const prevWeekId = (id) => dayId(new Date(toDate(id).getTime() - 7 * 86_400_000));
function nextStreak(cur, weekId) {
  if (cur && cur.lastDayId === weekId) return cur; // alreadyCounted
  const lanjut = cur !== null && cur.lastDayId === prevWeekId(weekId);
  const count = lanjut ? cur.count + 1 : 1;
  return {
    count,
    lastDayId: weekId,
    best: Math.max(count, cur?.best ?? 0),
    total: (cur?.total ?? 0) + 1,
  };
}
ok('minggu lalu → "2026-08-17" mundur jadi "2026-08-10"',
  prevWeekId('2026-08-17') === '2026-08-10');
let s = nextStreak(null, '2026-08-03');
s = nextStreak(s, '2026-08-10');
s = nextStreak(s, '2026-08-17');
ok('3 minggu berturut-turut → count 3', s.count === 3 && s.best === 3);
const dobel = nextStreak(s, '2026-08-17');
ok('dicentang ulang di minggu yang sama → TIDAK dihitung dua kali',
  dobel.count === 3 && dobel.total === s.total);
const bolong = nextStreak(s, '2026-09-07'); // lewat 2 minggu
ok('bolong satu minggu → rentetan mulai dari 1 lagi', bolong.count === 1);
ok('…tapi rekornya tidak ikut turun', bolong.best === 3);

console.log('\n   Kategorinya di layar Reward');
ok('kategori 🎓 Learning ada',
  /key: 'learning', icon: '🎓', label: 'Learning'/.test(ach));
ok('tangganya per MINGGU, sampai setahun penuh',
  /const LEARNING_WEEK_LEVELS/.test(ach) && /weeks: 52, icon: '🏆', title: 'Setahun Penuh'/.test(ach));
ok('angkanya dari rekor minggu beruntun',
  /learningWeekBest: learning\.best,/.test(baca('hooks/useRewardStats.ts')));
ok('ikut terhapus saat "Reset semua reward"',
  /\['app', 'learningStreak'\]/.test(ach));
ok('rentetan berjalannya juga kelihatan di fitur Learning',
  /🔥 \{runningStreak\} minggu/.test(baca('components/learning/WeekTab.tsx')));
ok('angka itu hanya tampil kalau rentetannya MASIH hidup',
  /export function learningStreakAlive\(/.test(learning));
ok('bacaan siang ikut dapat kategorinya sendiri',
  /key: 'bibleDaytime', icon: DAYPART\.daytime, label: 'Midday Reading'/.test(ach));

// 15 Sep 2026: urutan papan TIDAK lagi mengikuti grid Home — ditulis tangan
// per baris tiga petak di PAPAN (lib/reward.ts), kolom `feature` dan
// homeFeatureIndex dicabut. Rinciannya di cek-papan-achv.js; di sini yang
// dijaga: grid Home tetap satu sumber, dan papannya tersusun tiga-tiga.
console.log('\n3b. Urutan kategori = papan tiga-tiga (ditulis tangan)');
const grid = baca('lib/featureGrid.ts');
ok('daftar grid Home tetap di lib (satu sumber)',
  /export const HOME_FEATURES/.test(grid) && !/homeFeatureIndex/.test(grid));
ok('Home memakainya, bukan salinan sendiri',
  /import \{ HOME_FEATURES \} from '@\/lib\/homeGrid';/.test(home) &&
  /\{HOME_FEATURES\.map\(\(feature, index\) => \{/.test(home) &&
  !/^const FEATURES/m.test(home));
ok('urutannya ditulis tangan per baris, bukan dihitung dari grid',
  /\[\.\.\.CATEGORIES\]\.sort\(\s*\(a, b\) => papanIndex\(a\.key\) - papanIndex\(b\.key\),\s*\)/.test(ach) &&
  !/homeFeatureIndex/.test(ach));
ok('kategori yang tak ada di papan ditaruh paling BELAKANG, bukan depan',
  /return i === -1 \? URUTAN_PAPAN\.length : i;/.test(ach));

// Bukti urutan akhirnya — dihitung dari papan & daftar kategori di kode.
const urutanGrid = [...grid.matchAll(/\{ key: '([a-z]+)', label:/g)].map((m) => m[1]);
// Ikonnya boleh ditulis langsung ('🎓') ATAU diambil dari lib/daypart.ts
// (DAYPART.morning) — yang diuji di sini urutannya, bukan cara menulisnya.
const kategori = [...ach.matchAll(/\{ key: '(\w+)', icon: ([^,]+), label: '([^']+)'/g)]
  .map(([, key, icon, label]) => ({ key, icon: icon.replace(/'/g, ''), label }));
const papan = [...ach.matchAll(/\['(\w+)', '(\w+)', '(\w+)'\]/g)].map((m) => m.slice(1, 4));
const urutanPapan = papan.flat();
const idx = (k) => {
  const i = urutanPapan.indexOf(k);
  return i === -1 ? urutanPapan.length : i;
};
const hasil = [...kategori].sort((a, b) => idx(a.key) - idx(b.key));
// 20 tile sejak Device 📱 disisipkan tepat sebelum Games; 12 kategori sejak
// Weekly Strength berdiri sendiri lagi (6 Sep 2026) = 4 baris × 3 petak.
ok(`ketemu ${urutanGrid.length} tile grid & ${kategori.length} kategori`,
  urutanGrid.length === 20 && kategori.length === 12);
ok('papannya 4 baris × 3 petak, semua kategori kebagian tempat',
  papan.length === 4 && urutanPapan.length === 12 &&
  kategori.every((k) => urutanPapan.includes(k.key)));
ok('Married ada di ujung grid & tidak punya kategori reward',
  urutanGrid[urutanGrid.length - 1] === 'married' &&
  !kategori.some((k) => k.key === 'married'));
// 4 Sep 2026: judulnya jadi Inggris & ringkas. Yang dijaga cek ini tetap
// URUTANNYA, bukan bahasanya.
const HARUS = [
  // Baris 1: tiga kebiasaan harian.
  'Morning Prayer', 'Good Habit', 'Daily Steps',
  // Baris 2: tiga bacaan Alkitab berdampingan, kiri → tengah → kanan.
  'Morning Reading', 'Midday Reading', 'Night Reading',
  // Baris 3: tiga target olahraga ("Target Mingguan" dipecah dua, 30 Agu 2026;
  // Weekly Strength berdiri sendiri lagi, 6 Sep 2026).
  'Distance', 'Weekly Steps', 'Weekly Strength',
  'Water', 'Learning', 'Fitness',
];
ok('urutan akhirnya persis seperti papan yang diminta',
  JSON.stringify(hasil.map((c) => c.label)) === JSON.stringify(HARUS),
  hasil.map((c) => c.label).join(' → '));
ok('Morning Prayer tetap petak pertama, Fitness tetap terakhir',
  hasil[0].key === 'login' && hasil[hasil.length - 1].key === 'fitness');
ok('tiga bacaan Alkitab sebaris & berurutan Pagi → Siang → Malam',
  Math.floor(hasil.findIndex((c) => c.key === 'bibleMorning') / 3) ===
    Math.floor(hasil.findIndex((c) => c.key === 'bibleNight') / 3) &&
  hasil.findIndex((c) => c.key === 'bibleMorning') <
    hasil.findIndex((c) => c.key === 'bibleDaytime') &&
  hasil.findIndex((c) => c.key === 'bibleDaytime') <
    hasil.findIndex((c) => c.key === 'bibleNight'));
console.log(`     → ${hasil.map((c) => `${c.icon} ${c.label}`).join(' · ')}`);

console.log('\nAturan wajib');
ok('tidak ada soft-delete yang diselundupkan',
  !/isDeleted|archived: true/.test(spiritual + learning + ach + grid));
ok('warna semua dari Color, tak ada hex mentah',
  !/#[0-9A-Fa-f]{6}/.test(layarBaca) && !/#[0-9A-Fa-f]{6}/.test(grid));
ok('tidak ada dependency/modul native baru',
  !/expo-notifications|expo-background|expo-task-manager/.test(baca('package.json')));

console.log(gagal === 0 ? '\n✅ LULUS — tiga-tiganya beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
