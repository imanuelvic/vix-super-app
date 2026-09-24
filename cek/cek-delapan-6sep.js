// Delapan permintaan (6 Sep 2026):
//   1. Kas Tim: kartu "Total kas semua tim" dibuang
//   2. Rincian sesi: ada jarak sebelum judul "Squad & Setoran"
//   3. Habits › Bersyukur 3 Hal: pintu ke 1 Tes. 5:16-18 (TSI) di YouVersion
//   4. Fitness: hari lampau yang tidak tuntas → pil harinya ABU-ABU
//   5. Fitness: hari tanpa satu centang pun / sengaja dilewati → MERAH
//   6. Learning: Arsip Rangkuman dari modal jadi halaman sendiri + pagination
//   7. Catat bacaan: kolom ayat pindah ke layar Story, Pasal naik sebaris
//   8. Layar Story: dari ayat ke ayat, judul kartunya ikut berubah sendiri
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

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

// ============================================================
console.log('=== 1. Kas Tim: total semua tim dibuang ===');
// ============================================================
const kas = baca('app/futsal-cash.tsx');
c('kartu totalnya sudah tidak ada', !/Total kas semua tim/.test(kas));
c('fungsinya ikut dibuang, bukan ditinggal menganggur',
  !/cashTotal/.test(kas) && !/cashTotal/.test(baca('lib/futsal.ts')));
// Angkanya tidak hilang — ia memang sudah tertulis di pilihan tabnya.
c('saldo tiap geng tetap terbaca di tabnya sendiri',
  /sub: formatRupiah\(cashBalance\(isi, g\.key\)\)/.test(kas));
c('saldo geng yang sedang dibuka tetap ada', /Saldo kas \{meta\.label\}/.test(kas));
c('impor yang jadi menganggur ikut dibersihkan',
  !/SummaryCard/.test(kas) && !/summaryText/.test(kas));

// ============================================================
console.log('\n=== 2. Jarak sebelum "Squad & Setoran" ===');
// ============================================================
const sesi = baca('app/futsal/[id].tsx');
c('jaraknya ada', /moneyBlock: \{ marginBottom: \d+ \}/.test(sesi));
// Ditaruh di BAWAH blok uang, bukan di ATAS judulnya: judul itu dipatok
// (sticky), dan jarak atas pada yang dipatok ikut menempel di layar sebagai
// pita menganga selama daftarnya digulung.
c('menempel di blok uang, bukan di judul yang dipatok',
  /<View style=\{styles\.moneyBlock\}>/.test(sesi) &&
    /paddingTop: 0,/.test(baca('components/common/SectionToggle.tsx')));
// 6 Sep 2026 (malam): Game & Score dan Catatan ikut jadi bagian buka-tutup
// yang sama, jadi patokannya BERTAMBAH dua — judul di anak ganjil, isinya di
// anak genap. Jarak atasnya tetap tak boleh ada; itu diuji tepat di atas ini.
c('patokan sticky-nya bertambah dua, dan nomornya tetap pas',
  /^const STICKY_HEADERS = \[1, 3, 5\];$/m.test(sesi));

// ============================================================
console.log('\n=== 3. Bersyukur 3 Hal → 1 Tes. 5:16-18 (TSI) ===');
// ============================================================
const H = pasang(tsc(baca('lib/habits.ts')), (m) => {
  if (m === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000' }) };
  if (m === './daypart') return { DAYPART: { morning: '🌅', daytime: '🌤️', night: '🌙' } };
  if (m === 'firebase/firestore') return { doc: () => ({}), setDoc: async () => {} };
  if (m === './firebase') return { db: {} };
  if (m === './liveDoc') return { liveDoc: () => () => {} };
  return {};
});
const syukur = { id: 'x', label: '🙏 Bersyukur 3 Hal', slot: 'night', area: 'spirit', tier: 'core' };
const link = H.habitLink(syukur);
c('sesudah ditulis: tetap ke Riwayat Syukur',
  link?.whenDone === true && link?.route?.pathname === '/gratitude');
const sebelum = link?.beforeDone;
c('sebelum ditulis: ada keterangannya', sebelum?.note === 'Buka Baca 1 Tes. 5:16-18', sebelum?.note);
c('klik → YouVersion, kitab 1 Tes. 5:16',
  /^youversion:\/\/bible\?reference=1TH\.5\.16/.test(sebelum?.external?.scheme ?? ''),
  sebelum?.external?.scheme);
c('terjemahannya TSI (320), bukan tebakan',
  /version=320$/.test(sebelum?.external?.scheme ?? '') &&
    sebelum?.external?.web === 'https://www.bible.com/bible/320/1TH.5.16',
  sebelum?.external?.web);
// Nomor 320 itu dipastikan di bible.com, bukan dikarang — dan sekarang SEMUA
// pintu YouVersion di app ini ikut membuka TSI, bukan cuma baris ini.
const S = baca('lib/spiritual.ts');
c('TSI juga terdaftar di peta terjemahan bersama',
  /TSI: 320,/.test(S) && /TB: 306,/.test(S));
c('yang belum dipastikan tetap tidak dipaksa',
  !/BIS:/.test(S) && !/NIV:/.test(S));
const ht = baca('components/habits/HabitsTab.tsx');
c('layar Habits memakai penggantinya, bukan mengosongkan',
  /rawLink\?\.whenDone && !checked\s*\?\s*\(rawLink\.beforeDone \?\? null\)\s*:\s*rawLink/.test(ht));
// Pintu luar tidak boleh ikut mencentang: membuka YouVersion belum berarti
// tiga hal syukurnya sudah ditulis.
c('membukanya TIDAK mencentang barisnya',
  sebelum?.doneOnOpen === undefined && sebelum?.mirrorOf === undefined);
c('yang tanpa pengganti tetap tanpa pintu sebelum dikerjakan',
  H.habitLink({ ...syukur, label: '📓 Daily Reflection Journal' }).beforeDone === undefined);

// ============================================================
console.log('\n=== 4 & 5. Warna hari di deretan Fitness ===');
// ============================================================
const gym = baca('components/fitness/ExerciseTab.tsx');
c('catatan hari itu dibaca sekali, dipakai bersama',
  /const catatan = wd === todayWeekday \? day : weekDays\[id\];/.test(gym));
c('4 — bolong (ada yang terlewat/lupa) → abu-abu',
  /const bolong = !kosong && lampau && !selesai;/.test(gym) &&
    /bolong && !active && styles\.dayPillMissed/.test(gym));
c('5 — dilewati ❌ atau tanpa satu centang pun → merah',
  /const kosong = \(catatan\?\.skipped \?\? false\) \|\| \(lampau && tercentang === 0\);/.test(gym) &&
    /kosong && !active && styles\.dayPillSkipped/.test(gym));
c('merah menang atas abu-abu (kosong itu bukan sekadar bolong)',
  gym.indexOf('bolong && !active') < gym.indexOf('kosong && !active'));
// HARI INI tidak ikut dinilai selama sesinya masih berjalan: jam 7 pagi belum
// tercentang apa-apa itu wajar, bukan gagal. Kecuali memang sengaja dilewati.
c('hari ini belum dinilai selama sesinya masih berjalan',
  /const lampau = weekLoaded && id < dayId;/.test(gym));
c('tapi "sengaja dilewati" langsung merah, termasuk hari ini',
  /catatan\?\.skipped \?\? false/.test(gym));
c('tidak berkedip merah sebelum ambilan semingguannya sampai',
  /const weekLoaded = Object\.keys\(weekDays\)\.length > 0;/.test(gym));
c('warnanya dari palet, bukan hex baru',
  /dayPillMissed: \{[\s\S]{0,140}Color\.DISABLED_DARK[\s\S]{0,80}Color\.DISABLED,/.test(gym) &&
    /dayPillSkipped: \{[\s\S]{0,140}Color\.DANGER,[\s\S]{0,80}Color\.DANGER_TRANSPARENT,/.test(gym));
c('hari yang sedang dibuka tetap paling menonjol',
  /active && styles\.dayPillActive,/.test(gym));
c('tanda ✅ hari beres tidak ikut hilang',
  /selesai && !active && styles\.dayPillDone,/.test(gym));

// ============================================================
console.log('\n=== 6. Arsip Rangkuman jadi halaman sendiri ===');
// ============================================================
const arsip = baca('app/learning-archive.tsx');
const skills = baca('components/learning/SkillsTab.tsx');
c('halamannya ada', /export default function LearningArchiveScreen/.test(arsip));
c('tombolnya menuju ke sana', /router\.push\('\/learning-archive'\)/.test(skills));
c('modalnya benar-benar dibongkar dari sub-tab Skills',
  !/archiveOpen/.test(skills) && !/📔 Arsip Rangkuman/.test(skills));
c('impor yang jadi menganggur ikut dibersihkan',
  !/LoadingCenter/.test(skills) && !/subscribeLearningNotes/.test(skills) &&
    !/skillOfNote/.test(skills) && !/useEffect/.test(skills));
c('gaya kartunya ikut pindah, tidak ditinggal mati',
  !/noteCard/.test(skills) && /noteCard/.test(arsip));
c('ada paginationnya (yang jadi alasan pindah halaman)',
  /usePagination/.test(arsip) && /<Pagination/.test(arsip));
c('ganti halaman → daftarnya balik ke atas', /key=\{currentPage\}/.test(arsip));
c('isinya tetap sama: tanggal, judul ilmunya, rangkumannya',
  // 14 Sep 2026: tanggalnya jadi "Minggu ke-37 (7-13 Sep 2026)".
  /formatWeekLabel\(dayIdToDate\(n\.weekId\)\)/.test(arsip) &&
    /\{s\.title\}/.test(arsip) && /\{n\.note\}/.test(arsip));
c('BACA saja — mengubahnya tetap di minggunya masing-masing',
  !/setLearningNote/.test(arsip) && !/SheetModal/.test(arsip));
c('gagal baca → daftar kosong, bukan berputar selamanya',
  /\(\) => setNotes\(\[\]\)/.test(arsip));
c('rutenya ikut warna Learning',
  /'learning-archive': 'learning'/.test(baca('lib/featureTheme.ts')));
c('rutenya terdaftar di typed routes',
  /learning-archive/.test(baca('.expo/types/router.d.ts')));

// ============================================================
console.log('\n=== 7. Catat bacaan: kitab & pasal saja ===');
// ============================================================
const field = baca('components/common/BibleRefField.tsx');
c('modenya ada', /chapterOnly = false,/.test(field) && /chapterOnly\?: boolean;/.test(field));
c('Pasal naik sebaris dengan nama kitab', /\{chapterOnly && pasal\}/.test(field));
c('barisnya rata bawah (label Pasal ada di atas kotaknya)',
  /bookPasalRow: \{ flexDirection: 'row', alignItems: 'flex-end', gap: \d+ \}/.test(field));
c('kolom ayat tidak ditampilkan di mode itu',
  /\{!chapterOnly && \(\s*<View style=\{styles\.numberRow\}>/.test(field));
c('kolom Pasal-nya satu, dipakai kedua tata letak',
  (field.match(/placeholder=\{meta \? `1–\$\{meta\.chapters\}` : '-'\}/g) || []).length === 1);
c('layar catat bacaan memang meminta mode itu',
  /chapterOnly/.test(baca('components/spiritual/BibleRefList.tsx')));
// Revive TIDAK ikut berubah: di sana ayat yang dipakai memang bagian dari
// catatannya, bukan sekadar penanda "hari ini saya baca pasal berapa".
c('Revive tidak ikut berubah', !/chapterOnly/.test(baca('app/revive.tsx')));
// Ayat yang TERLANJUR tersimpan tidak boleh hilang waktu pasalnya diubah.
const B = pasang(tsc(baca('lib/bible.ts')), () => ({}));
c('ayat lama tetap utuh saat pasalnya diubah',
  B.bibleRefText('Amsal', '6', '16', '18') === 'Amsal 6:16-18');
c('tanpa ayat → pasalnya saja', B.bibleRefText('Amsal', '5', '', '') === 'Amsal 5');

// ============================================================
console.log('\n=== 8. Layar Story: dari ayat ke ayat ===');
// ============================================================
const story = baca('app/bible-story.tsx');
c('dua isian ayatnya ada', /Ayat dari/.test(story) && /sampai/.test(story));
c('letaknya sesudah "Isi Ayat", sebelum pratinjaunya',
  story.indexOf('✍️ Isi Ayat') < story.indexOf('styles.ayatRow') &&
    story.indexOf('styles.ayatRow') < story.indexOf('<CardPreview'));
c('cuma angka yang masuk',
  (story.match(/replace\(\/\\D\/g, ''\)/g) || []).length === 2);
c('"sampai" mati selama "dari" masih kosong', /!!ayatDari/.test(story));
c('judul kartunya ikut berubah sendiri',
  /const reference =\s*\n?\s*bibleRefText\(dasar\.book, dasar\.chapter, ayatDari, ayatSampai\) \|\| dipilih;/.test(
    story,
  ));
c('acuan yang tak terbaca dipakai apa adanya (bukan kartu tanpa acuan)',
  /\|\| dipilih;/.test(story));
c('nilai awalnya ikut acuan yang dioper (catatan lama tak kehilangan ayatnya)',
  /const awal = parseBibleRef\(refs\[0\] \?\? ''\);/.test(story));
// Chip pilih bacaan membandingkan acuan MENTAH-nya: kalau dibandingkan dengan
// `reference` yang sudah berayat, tak ada satu chip pun yang pernah aktif.
c('chip pilih bacaan tetap menyorot yang benar', /active=\{r === pickedRef\}/.test(story));
c('ganti chip → ayatnya ikut berganti, bukan tertinggal dari kitab lama',
  /setAyatDari\(b\.verseFrom\);/.test(story) && /setAyatSampai\(b\.verseTo\);/.test(story));
// Nama berkas & penanda "sudah tersimpan" ikut acuan yang sama, jadi ganti
// ayat = gambar baru, bukan menimpa yang lama diam-diam.
c('nama berkas & penanda tersimpan ikut acuannya',
  /storyFileName\(todayId, reference\)/.test(story) &&
    /`\$\{design\.key\}\|\$\{reference\}\|\$\{verse\}`/.test(story));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
