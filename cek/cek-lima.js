// Lima permintaan 28 Agu 2026:
//   1. Tombol 🧍 Data Tubuh CL (baca-saja) + kolomnya di form ✏️
//   2. Subtitle Baca Alkitab + tombol YouVersion + kolom terjemahan
//   3. Terjemahan bisa diubah di modal edit riwayat
//   4. "💬 Discussion This Week" pindah ke sub-tab Discussion (badge ikut)
//   5. Tombol 📔 Arsip rangkuman di sub-tab Skills
//
// Aturan yang bisa dijalankan MEMANG dijalankan (lib/core, lib/spiritual,
// lib/learning dikompilasi & dipanggil), bukan dicocokkan regex.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-lima');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/core.ts', R + 'lib/spiritual.ts', R + 'lib/learning.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan — emit-nya diperiksa di bawah */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['core.js', 'spiritual.js', 'learning.js']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

// ---------- Palsukan yang bukan urusan uji ini ----------
let snapshotHandler = null;
let dibuka = [];
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: (...a) => ({ path: a.slice(1).join('/') }),
      doc: (...a) => ({ path: a.slice(1).join('/') }),
      setDoc: async () => {},
      deleteDoc: async () => {},
      deleteField: () => '__delete__',
      limit: () => ({}),
      orderBy: () => ({}),
      query: () => ({}),
      arrayUnion: () => ({}),
      writeBatch: () => ({}),
      onSnapshot: (_q, cb) => { snapshotHandler = cb; return () => {}; },
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './linking' || req.endsWith('/linking')) {
    return {
      openExternalUrl: (url, opts) => { dibuka.push({ url, ...opts }); },
    };
  }
  if (/^(expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const CORE = require(path.join(DIR, 'core.js'));
const SPI = require(path.join(DIR, 'spiritual.js'));
const LRN = require(path.join(DIR, 'learning.js'));

// =====================================================================
console.log('=== 1. Data Tubuh CL 🧍 ===');
// =====================================================================
{
  // Tanggal HANYA bergerak kalau angkanya berubah. Kalau tidak, membetulkan
  // nomor HP saja akan bikin kartunya mengaku "baru diperbarui hari ini".
  const lama = {
    heightCm: 160, weightKg: 55, waistCm: 70,
    bodyUpdatedDayId: '2026-07-01',
  };
  const samaSaja = CORE.leaderBodyPayload(
    CORE.leaderBodyOf(lama), lama, '2026-08-28');
  c('angka tidak berubah → tanggalnya TIDAK ikut maju',
    samaSaja.bodyUpdatedDayId === '2026-07-01', samaSaja.bodyUpdatedDayId);

  const beratBaru = CORE.leaderBodyPayload(
    { height: '160', weight: '53.5', waist: '70' }, lama, '2026-08-28');
  c('berat berubah → tanggalnya jadi hari ini',
    beratBaru.bodyUpdatedDayId === '2026-08-28' && beratBaru.weightKg === 53.5,
    `${beratBaru.weightKg} kg · ${beratBaru.bodyUpdatedDayId}`);

  const koma = CORE.leaderBodyPayload(
    { height: '', weight: '53,5', waist: '' }, {}, '2026-08-28');
  c('koma diterima sebagai desimal (53,5 → 53.5)', koma.weightKg === 53.5);

  const dikosongkan = CORE.leaderBodyPayload(
    { height: '', weight: '', waist: '' }, lama, '2026-08-28');
  c('semua dikosongkan → tanggalnya ikut hilang',
    dikosongkan.bodyUpdatedDayId === null &&
      dikosongkan.heightCm === null && dikosongkan.weightKg === null);

  for (const [teks, harap] of [['0', null], ['-5', null], ['abc', null], ['169', 169]]) {
    const r = CORE.leaderBodyPayload({ height: teks, weight: '', waist: '' }, {}, 'x');
    c(`tinggi "${teks}" → ${harap}`, r.heightCm === harap, String(r.heightCm));
  }

  c('hasLeaderBody: kosong = false, satu terisi = true',
    CORE.hasLeaderBody({}) === false &&
      CORE.hasLeaderBody({ waistCm: 70 }) === true);

  // Layarnya
  const tab = baca('components/core/LeadersTab.tsx');
  c('tombol 🧍 ada di kartu CL', /<EmojiButton emoji="🧍" onPress=\{\(\) => setBodyOf\(l\)\} \/>/.test(tab));
  c('form ✏️ punya ketiga kolomnya',
    /\['height', 'Tinggi \(cm\)'/.test(tab) &&
      /\['weight', 'Berat \(kg\)'/.test(tab) &&
      /\['waist', 'Lingkar perut \(cm\)'/.test(tab));
  c('yang disimpan lewat leaderBodyPayload (bukan disusun tangan)',
    /\.\.\.leaderBodyPayload\(/.test(tab));

  const dlg = baca('components/core/LeaderBodyDialog.tsx');
  c('dialognya BACA-SAJA: tak ada simpan/ubah sama sekali',
    !/setDoc|save|onChange|FormInput|DualButtons/.test(dlg));
  c('menampilkan kapan terakhir diperbarui',
    /bodyUpdatedDayId[\s\S]{0,80}Diperbarui/.test(dlg) &&
      /Belum pernah diperbarui/.test(dlg));
  c('isinya yang penting saja: tinggi, berat, ideal, BMI, perut, rasio',
    ['Tinggi', 'Berat', 'Berat ideal', 'BMI', 'Lingkar perut', 'Rasio perut/tinggi']
      .every((l) => dlg.includes(`label="${l}"`)));
  // BMR & persen lemak rumusnya khusus laki-laki — CL ada yang perempuan.
  c('TIDAK memakai rumus khusus laki-laki (bmrMale / bodyFatMale)',
    !/bmrMale|bodyFatMale/.test(dlg));

  // Angka turunannya dihitung pustaka Health yang sudah ada, bukan disalin.
  // 15 Sep 2026: hitungannya dipadatkan jadi satu fungsi bersama dengan
  // PDF-nya (bodySummary), tetap di lib/health.
  c('BMI & berat ideal memakai lib/health yang sudah ada',
    /from '@\/lib\/health'/.test(dlg) && /bodySummary\(/.test(dlg));
}

// =====================================================================
console.log('\n=== 2. Terjemahan Alkitab & YouVersion ===');
// =====================================================================
{
  c('bawaannya TB', SPI.BIBLE_VERSION_DEFAULT === 'TB');
  const contoh = [
    ['Amsal 16', 'TB', 'Amsal 16 (TB)'],
    ['Mazmur 23:1-6', 'BIS', 'Mazmur 23:1-6 (BIS)'],
    ['Amsal 16', '', 'Amsal 16 (TB)'],
    ['Amsal 16', '   ', 'Amsal 16 (TB)'],
    ['', 'TB', ''],
  ];
  let beda = 0;
  for (const [acuan, versi, harap] of contoh) {
    const hasil = SPI.bibleRefWithVersion(acuan, versi);
    if (hasil !== harap) beda += 1;
    console.log(`      ${hasil === harap ? '·' : '!'} "${acuan}" + "${versi}" → "${hasil}"`);
  }
  c('acuan + terjemahan digabung persis seperti contohnya', beda === 0);

  // Hari yang DILEWATI tidak boleh ikut dihias "(TB)" — itu bukan bacaan.
  c('hari yang dilewati tidak ikut diberi kurung terjemahan',
    SPI.bibleRefWithVersion(SPI.BIBLE_SKIPPED, 'TB') === SPI.BIBLE_SKIPPED);

  const lib = baca('lib/spiritual.ts');
  c('disimpan terpisah dari acuannya (morningVersion, dst)',
    /\[`\$\{session\}Version`\]: version\.trim\(\) \|\| BIBLE_VERSION_DEFAULT/.test(lib));
  c('catatan lama tanpa kolom ini terbaca sebagai TB',
    /ambil\('morningVersion'\)/.test(lib) &&
      /\|\| BIBLE_VERSION_DEFAULT/.test(lib));

  // YouVersion
  dibuka = [];
  SPI.openYouVersion();
  c('openYouVersion membuka skema youversion://',
    dibuka[0]?.url === 'youversion://', dibuka[0]?.url);
  c('belum terpasang → jatuh ke App Store-nya (id282935706)',
    /apps\.apple\.com[\s\S]*id282935706/.test(dibuka[0]?.fallback ?? ''),
    dibuka[0]?.fallback);
  dibuka = [];
  SPI.openNdcMinistry();
  c('NDC Ministry TIDAK ikut diubah (Revive masih ke sana)',
    dibuka[0]?.url === 'ndc://');

  const intro = baca('components/spiritual/SpiritualIntro.tsx');
  c('tombolnya bisa dua tujuan, bawaannya tetap NDC',
    /app = 'ndc'/.test(intro) && /youversion: \{ label: '📖 Buka YouVersion'/.test(intro));

  const layar = baca('app/bible-reading.tsx');
  c('layar Baca Alkitab memakai YouVersion', /app="youversion"/.test(layar));
  c('layar Tulis Revive TETAP NDC Ministry',
    !/app="youversion"/.test(baca('app/revive.tsx')));

  c('subtitle-nya bicara merenungkan firman pagi–siang–malam',
    /subtitle="Merenungkan firman-Nya pagi, siang & malam"/.test(layar));
  c('subtitle lama sudah tidak ada',
    !/Pilih kitab, lalu isi pasal & ayatnya/.test(layar));
  // 10 Sep 2026: kolomnya pindah KE DALAM kartu bacaan, jadi bentuknya ada
  // di komponen bersamanya. Kata "Terjemahan" berhenti jadi bukti — ia kini
  // juga muncul di komentar layar ini; yang diuji: layarnya benar-benar
  // MENGOPER nilainya, dan tetap ikut menyimpannya.
  c('kolom terjemahan ada di layar catat & ikut tersimpan',
    /version=\{version\}/.test(layar) &&
      /onVersionChange=\{setVersion\}/.test(layar) &&
      /versiTerpakai/.test(layar));
  c('ringkasan "Tersimpan sebagai" ikut menampilkan terjemahannya',
    /bibleRefWithVersion\(filled\.join\(', '\), versiTerpakai\)/.test(layar));
}

// =====================================================================
console.log('\n=== 3. Terjemahan bisa diubah dari riwayat ===');
// =====================================================================
{
  const tab = baca('components/spiritual/BibleReadingTab.tsx');
  // Sheet ubah memakai kolom yang SAMA dengan layar catat — satu komponen,
  // jadi keduanya tak bisa lagi diam-diam berbeda.
  c('modal edit punya kolom Terjemahan',
    /version=\{version\}/.test(tab) && /onVersionChange=\{setVersion\}/.test(tab));
  c('isinya terisi dari catatan hari itu', /setVersion\(d\.versions\[session\]\)/.test(tab));
  c('ikut tersimpan saat Perbarui',
    /saveBibleReading\(\s*user\.uid,\s*editing\.id,\s*session,\s*filled\.join\(', '\),\s*version\.trim\(\) \|\| BIBLE_VERSION_DEFAULT,\s*\)/.test(tab));
  // 30 Agu 2026: barisnya tidak lagi satu teks utuh — tiap acuan jadi tombol
  // sendiri yang membuka YouVersion, dan terjemahannya menyusul di ujungnya.
  // Yang dijaga tetap sama: acuan DAN terjemahannya sama-sama terlihat.
  c('daftar riwayatnya tetap menampilkan acuan + terjemahannya',
    /splitBibleRefs\(d\[session\]\)\.map/.test(tab) &&
      /\(\{d\.versions\[session\] \|\| BIBLE_VERSION_DEFAULT\}\)/.test(tab));
}

// =====================================================================
console.log('\n=== 4. Diskusi Minggu Ini pindah ke sub-tab Discussion ===');
// =====================================================================
{
  const week = baca('components/learning/WeekTab.tsx');
  const topics = baca('components/learning/DiscussionTab.tsx');
  c('bloknya HILANG dari sub-tab Target',
    !/💬 Discussion This Week/.test(week) && !/topicsOfWeek/.test(week) &&
      !/setTopicDone/.test(week));
  c('bloknya ADA di sub-tab Discussion',
    /💬 Discussion This Week/.test(topics) && /weekly\.map/.test(topics));
  // Kartu "bahan utama" di sini sudah dihapus — ilmu minggu ini tetap tampil
  // di sub-tab Target, dan satu tempat memang cukup.
  c('kartu bahan utama tidak digandakan di sini',
    !/mainTopicCard/.test(topics) && !/skillOfWeek\(now\)/.test(topics));
  c('ilmu minggu ini tetap tampil di sub-tab Target',
    /skillOfWeek\(now\)/.test(week));
  c('sisa gaya & propnya tidak ditinggalkan menganggur',
    !/mainTopic/.test(topics) && !/week: LearningWeek/.test(topics));
  c('ketiganya tetap bisa dicentang di sana', /onPress=\{\(\) => toggle\(t\.key, checked\)\}/.test(topics));
  c('daftar panjangnya diberi judul sendiri', /💬 Semua Bahan Diskusi/.test(topics));

  // Badge: pecahannya harus BERJUMLAH sama dengan angka badge tile Home.
  const layar = baca('app/learning.tsx');
  c('badge Target = langkah tertagih, badge Discussion = topik tertagih',
    /pendingSteps\(week\.steps, now\)/.test(layar) &&
      /pendingTopicsOfWeek\(topicsDone, now\)\.length/.test(layar) &&
      /withBadge\(TABS, \{ week: stepsPending, topics: topicsPending \}\)/.test(layar));

  // Dijalankan: untuk data yang sama, pecahannya = angka Home.
  const now = new Date(2026, 7, 28); // Jumat
  const kasus = [
    ['kosong semua', {}, {}],
    ['2 langkah beres', { discover: true, dig: true }, {}],
    ['1 topik sudah diobrolkan', {}, { [LRN.topicsOfWeek(now)[0].key]: true }],
    ['semua topik beres', { discover: true, dig: true, summarize: true, share: true },
      Object.fromEntries(LRN.topicsOfWeek(now).map((t) => [t.key, true]))],
  ];
  let cocok = 0;
  for (const [nama, steps, done] of kasus) {
    const a = LRN.pendingSteps(steps, now);
    const b = LRN.pendingTopicsOfWeek(done, now).length;
    const home = LRN.learningPending(steps, done, now);
    const sama = a + b === home;
    if (sama) cocok += 1;
    console.log(`      ${sama ? '·' : '!'} ${nama.padEnd(26)} Target ${a} + Discussion ${b} = Home ${home}`);
  }
  c('jumlah kedua badge SELALU sama dengan badge tile Home', cocok === kasus.length);

  const dash = baca('app/reminders.tsx');
  c('reminder Dashboard mendarat langsung di sub-tab Discussion',
    /💬 Discussion Reminder[\s\S]{0,700}params: \{ tab: 'topics' \}/.test(dash));
  // Penjaganya sudah pindah ke useTabScroll (daftar sahnya = TABS layarnya) —
  // perilakunya diuji tersendiri di cek-tab-param.js.
  c('layar Learning menerima param tab-nya',
    /useTabScroll<LearningTabKey>\('week', \{\s*tabs: TABS,/.test(layar));
}

// =====================================================================
console.log('\n=== 5. Arsip rangkuman 📔 di sub-tab Skills ===');
// =====================================================================
{
  // Dijalankan dengan snapshot palsu: koleksi `learning` juga memuat dokumen
  // `skills` & `topics` yang BUKAN minggu, dan minggu tanpa rangkuman.
  const docs = [
    { id: '2026-08-24', data: () => ({ note: 'Rangkuman minggu ini', skillKey: null }) },
    { id: '2026-08-17', data: () => ({ note: '  ', skillKey: null }) },       // kosong
    { id: '2026-08-10', data: () => ({ note: 'Yang lebih lama', skillKey: 'critical-thinking' }) },
    { id: 'skills', data: () => ({ done: { x: '2026-08-10' } }) },            // bukan minggu
    { id: 'topics', data: () => ({ done: { y: true } }) },                    // bukan minggu
    { id: '2026-08-31', data: () => ({ note: 'Paling baru', skillKey: null }) },
  ];
  let hasil = null;
  LRN.subscribeLearningNotes('uid', (n) => { hasil = n; });
  snapshotHandler({ docs });

  c('dokumen `skills` & `topics` tidak ikut terbawa',
    hasil.every((n) => /^\d{4}-\d{2}-\d{2}$/.test(n.weekId)), hasil.map((n) => n.weekId).join(' '));
  c('minggu tanpa rangkuman tidak ditampilkan',
    !hasil.some((n) => n.weekId === '2026-08-17'));
  c('terbaru di atas',
    hasil.map((n) => n.weekId).join(',') === '2026-08-31,2026-08-24,2026-08-10',
    hasil.map((n) => n.weekId).join(','));
  c('rangkumannya ikut apa adanya', hasil[0].note === 'Paling baru');

  // Judul topiknya: yang dipilih manual, atau rotasi otomatis minggu itu.
  const manual = LRN.skillOfNote({ weekId: '2026-08-10', skillKey: 'critical-thinking', note: 'x' });
  const otomatis = LRN.skillOfNote({ weekId: '2026-08-10', skillKey: null, note: 'x' });
  c('skillOfNote: yang dipilih manual dipakai apa adanya',
    manual.key === 'critical-thinking', manual.title);
  c('skillOfNote: tanpa pilihan manual → rotasi minggu itu',
    !!otomatis && otomatis.key === LRN.skillOfWeek(new Date(2026, 7, 10)).key,
    otomatis.title);

  const skills = baca('components/learning/SkillsTab.tsx');
  // 6 Sep: dari modal jadi HALAMAN sendiri — isinya bertambah satu tiap
  // minggu dan tak pernah menyusut, sedangkan sheet tak punya tempat untuk
  // nomor halaman.
  const arsip = baca('app/learning-archive.tsx');
  c('tombol 📔 Arsip ada di kartu ringkasannya',
    /📔 Arsip/.test(skills) && /router\.push\('\/learning-archive'\)/.test(skills));
  c('modalnya benar-benar dibongkar dari sub-tab Skills',
    !/archiveOpen/.test(skills) && !/subscribeLearningNotes/.test(skills));
  c('halamannya punya pagination', /usePagination/.test(arsip) && /<Pagination/.test(arsip));
  c('ganti halaman → daftarnya balik ke atas', /key=\{currentPage\}/.test(arsip));
  c('rutenya ikut warna Learning',
    /'learning-archive': 'learning'/.test(baca('lib/featureTheme.ts')));
  // Kata "Minggu" di depan tanggalnya dilepas 31 Agu 2026 (dirapikan sendiri
  // oleh pemiliknya) — yang dijaga di sini isinya, bukan kata pengantarnya.
  c('isinya: tanggal minggunya, judul ilmunya, & rangkumannya',
    // 14 Sep 2026: tanggalnya jadi "Minggu ke-37 (7-13 Sep 2026)".
    /formatWeekLabel\(dayIdToDate\(n\.weekId\)\)/.test(arsip) &&
      /\{s\.title\}/.test(arsip) && /\{n\.note\}/.test(arsip));
  c('arsipnya BACA saja (mengubah tetap di minggunya)',
    !/setLearningNote/.test(arsip));
  // Koleksi seluruh minggu cuma dibaca di halamannya sendiri — sub-tab Skills
  // tidak lagi ikut menanggung biayanya.
  c('koleksinya dibaca di halaman arsipnya, bukan di sub-tab Skills',
    /useLiveAll\(\(uid\) => \[subscribeLearningNotes\(uid, setNotes, \(\) => setNotes\(\[\]\)\)\]\);/.test(arsip)); // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
  c('gagal baca → daftar kosong, bukan berputar selamanya',
    /\(\) => setNotes\(\[\]\)/.test(arsip));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
