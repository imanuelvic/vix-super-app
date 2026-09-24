// Delapan permintaan (2 Sep 2026):
//   1. Terjemahan Alkitab ikut tercetak di kartu Bagikan Ayat
//   2/3. Chip mengikuti ukuran hurufnya & digeser — sama seperti Reminder
//   4. Fitur Diet dihapus SELURUHNYA (berkas, sub-tab, kode)
//   5. Badge Spiritual: satu aturan untuk Home & sub-tabnya
//   6. Tambah langkah manual + validasinya
//   7. Titik merah ditarik masuk ke kartunya + daftarnya melompat ke sana
//   8. Layar Puasa: SATU tombol simpan, tampilan dikartukan
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const ada = (f) => fs.existsSync(path.join(R, f));

// Komentar sering MENCERITAKAN hal yang justru harus sudah hilang dari
// kodenya (mis. "dulu ada `fit` …"). Pemeriksaan "sudah hilang?" karena itu
// selalu memakai kodenya saja.
const kode = (f) =>
  baca(f)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// =====================================================================
console.log('\n== 1. Terjemahan ikut di kartu Bagikan Ayat ==');
// =====================================================================
const kartu = baca('components/spiritual/BibleStoryCard.tsx');
const layarStory = baca('app/bible-story.tsx');
const bacaan = baca('app/bible-reading.tsx');

c('kartunya menerima terjemahannya', /version\?: string;/.test(kartu));
c('"Amsal 1:4 (TB)" — acuan + terjemahan jadi satu tulisan',
  /const acuan = rujukan && versi \? `\$\{rujukan\} \(\$\{versi\}\)` : rujukan;/.test(kartu));
c('terjemahan kosong tidak menyisakan kurung menganga',
  /const versi = version\.trim\(\);/.test(kartu));
c('baris acuannya memakai bentuk itu', /— \{acuan\}/.test(kartu));
// Tanpa bunyi ayat, acuannya yang naik jadi tulisan utama — dan terjemahannya
// ikut naik: justru di situlah ia satu-satunya keterangan yang ada.
c('tanpa ayat, terjemahannya ikut jadi tulisan utama',
  /const hero = verse\.trim\(\) \|\| acuan;/.test(kartu));
c('layar catat bacaan mengoper terjemahan yang sedang dipakai',
  /version: versiTerpakai,/.test(bacaan));
c('layar Story membacanya & jatuh ke TB kalau kosong',
  /version: versionParam,/.test(layarStory) &&
    /\|\|\s*\n?\s*BIBLE_VERSION_DEFAULT;/.test(layarStory.replace(/\r\n/g, '\n')));
c('dan meneruskannya ke kartunya', /version=\{version\}/.test(layarStory));

// =====================================================================
console.log('\n== 2/3. Chip mengikuti hurufnya, bukan sebaliknya ==');
// =====================================================================
const chip = baca('components/common/Chip.tsx');
const chipRow = baca('components/common/ChipRow.tsx');
const news = baca('components/news/NewsTab.tsx');
const fun = baca('components/fun/CreatorsTab.tsx');
const tasks = baca('app/tasks.tsx');

c('hurufnya TIDAK mengecil sendiri lagi',
  !/adjustsFontSizeToFit/.test(kode('components/common/Chip.tsx')));
c('satu baris = satu ukuran huruf (tak ada mode lebar sama rata)',
  !/fit\?: number;/.test(kode('components/common/ChipRow.tsx')) &&
    !/bagian: \{ flex: 1 \}/.test(chipRow));
c('yang tersisa: baris yang digeser, seperti Reminder',
  /horizontal/.test(kode('components/common/ChipRow.tsx')) &&
    /showsHorizontalScrollIndicator=\{false\}/.test(chipRow));
c('News memakai bentuk yang sama & menarik chip aktifnya ke dalam layar',
  !/fit=\{/.test(kode('components/news/NewsTab.tsx')) &&
    /activeIndex=\{NEWS_SOURCES\.findIndex\(\(s\) => s\.key === source\)\}/.test(news));
// Tingginya dipatok seperti Reminder: ScrollView horizontal pernah salah
// mengukur tinggi kontennya sampai chip-nya menindih isi di bawahnya.
c('tinggi baris News & Fun dipatok, seperti Reminder',
  /sourceScroll: \{ height: 52 \}/.test(news) &&
    /kindScroll: \{ height: 56 \}/.test(fun) &&
    /chipScroll: \{ flexGrow: 0, height: 60/.test(tasks));
c('Reminder sendiri tidak diusik',
  /activeIndex=\{TASK_CATEGORIES\.findIndex\(\(c\) => c\.key === category\)\}/.test(tasks));

// =====================================================================
console.log('\n== 4. Fitur Diet dihapus seluruhnya ==');
// =====================================================================
const health = baca('app/health.tsx');
c('DietTab.tsx & lib/diet.ts benar-benar tidak ada',
  !ada('components/health/DietTab.tsx') && !ada('lib/diet.ts'));
// 2 Sep 2026: urutannya ditukar jadi Race → Steps → Check-up. Yang dijaga di
// sini tetap sama — sub-tabnya TINGGAL BERTIGA & tak ada sisa Diet.
const tabsBlok = health.slice(
  health.indexOf('const TABS'),
  health.indexOf('];', health.indexOf('const TABS')),
);
c('sub-tabnya tinggal bertiga: Race · Steps · Check-up',
  /\{ key: 'race'[\s\S]{0,200}\{ key: 'steps'[\s\S]{0,200}\{ key: 'checkup'/.test(health) &&
    (tabsBlok.match(/key: '/g) ?? []).length === 3 &&
    !/'diet'/.test(kode('app/health.tsx')));
// Jebakannya: yang paling kiri sekarang Race, tapi layarnya TETAP terbuka di
// Steps. Kalau suatu saat "dirapikan" biar seragam, ini yang memerah.
c('layarnya tetap terbuka di Steps, bukan di tab paling kiri',
  tabsBlok.indexOf("key: 'race'") < tabsBlok.indexOf("key: 'steps'") &&
    /\? tabParam : 'steps'/.test(health));
c('tak ada sisa kata Diet di kodenya', !/Diet/.test(kode('app/health.tsx')));
// `?tab=diet` dari pintasan lama tidak boleh mendarat di layar kosong.
c('pintasan lama ?tab=diet mendarat di Steps, bukan layar kosong',
  /tabParam === 'checkup' \|\| tabParam === 'race' \? tabParam : 'steps'/.test(health));
c('pintasan kebiasaan ke Health › Diet ikut dibuang',
  !/tab: 'diet'/.test(kode('lib/habits.ts')));
c('ikon garpu-pisaunya ikut dibuang (tak ada yang memakainya lagi)',
  !/'fork\.knife'/.test(baca('components/ui/icon-symbol.tsx')));
// 💧 Air Putih dulu digantung di sub-tab Diet — pencapaiannya TETAP ada.
c('pencapaian 💧 Air Putih tidak ikut terhapus',
  /key: 'water'/.test(baca('lib/reward.ts')));

// =====================================================================
console.log('\n== 5. Badge Spiritual: satu aturan, dua tempat ==');
// =====================================================================
const spiritual = baca('app/(tabs)/walk.tsx');
const home = baca('app/(tabs)/index.tsx');
c('sub-tab Revive memakai aturan yang sama dengan tile Home',
  /const reviveBeres = reviveHandledToday\(reviveStreak, todayId\);/.test(spiritual) &&
    /withBadge\(TABS, \{ revive: reviveBeres \? 0 : 1 \}\)/.test(spiritual));
c('Home memanggil fungsi yang sama',
  /reviveHandledToday\(revive, todayId\)/.test(home));
// Layar ini dulu menambahkan `todayEntry ||` sendiri — di situlah badge Home
// bisa menyala sementara di dalam fiturnya tidak ada satu pun tanda.
c('tak ada lagi syarat tambahan yang cuma dipunyai satu sisi',
  !/todayEntry \|\| reviveHandledToday/.test(spiritual));
c('ketidakcocokan lama DIPERBAIKI, bukan ditutupi',
  /bumpReviveStreak\(user\.uid, reviveStreak, todayId\)/.test(spiritual) &&
    /diperbaiki\.current = true;/.test(spiritual));
c('penyebabnya tetap ditandai di tombol tulis Revive',
  /<AttentionMark corner \/>/.test(spiritual));

// =====================================================================
console.log('\n== 6. Tambah langkah manual + validasinya ==');
// =====================================================================
const steps = baca('components/health/StepsTab.tsx');
const libHealth = baca('lib/health.ts');
// Disimpan TERPISAH dari `days`: tiap layar Steps dibuka, riwayat 60 hari dari
// Apple Health ditulis ulang ke `days`. Menumpang di sana = terhapus diam-diam
// pada sinkron berikutnya.
c('disimpan terpisah dari angka Apple Health',
  /manual: \{ \[dayId\]: Math\.max\(0, Math\.round\(steps\)\) \}/.test(libHealth) &&
    /export type StepManualMap/.test(libHealth));
c('dokumennya sama → nol baca Firestore tambahan',
  /export function subscribeManualSteps[\s\S]{0,220}'health', 'steps'/.test(
    libHealth.replace(/\r\n/g, '\n'),
  ));
c('angka hari ini = Apple Health + yang dicatat sendiri',
  /const todaySteps = \(hk\?\.steps \?\? 0\) \+ manualToday;/.test(steps));
c('rekap minggu & bulan ikut menghitungnya',
  /manualInDays\(manual, hariMinggu\)/.test(steps) &&
    /manualInDays\(manual, hariBulan\)/.test(steps));
c('bagian manualnya disebut terpisah (angkanya masih bisa diurai)',
  /dicatat sendiri/.test(steps));
// Judulnya boleh diganti sendiri oleh pemiliknya (2 Sep 2026: "Catat Langkah
// Sendiri" → "Catat Manual Steps") — yang dijaga di sini BENTUKNYA: modalnya
// ada dan digambar sebagai SheetModal, bukan bunyi judulnya.
// Diperiksa dari BADAN fungsinya, bukan "dalam sekian karakter" — satu isian
// tambahan saja sudah membuat ukuran jarak gagal padahal susunannya benar.
const stepsRata = steps.replace(/\r\n/g, '\n');
const badanModal = stepsRata.slice(stepsRata.indexOf('function ManualStepsModal({'));
c('ada tombol tambah & modalnya', /ManualStepsModal/.test(steps) &&
  badanModal.length > 0 && /<SheetModal/.test(badanModal.slice(0, badanModal.indexOf('\n}\n'))));
c('validasi: angka bulat saja', /!\/\^\\d\+\$\/\.test\(bersih\)/.test(steps));
c('validasi: ada batas atas yang masuk akal',
  /STEP_MANUAL_MAX = 60_000/.test(libHealth) &&
    /jumlah > STEP_MANUAL_MAX/.test(steps));
// Yang diisi TOTAL, bukan selisih: kolom "tambah lagi" membuat menekan simpan
// dua kali menghitung dua kali, dan salah ketik tak bisa dibetulkan.
c('yang diisi TOTAL, jadi salah ketik bisa dibetulkan',
  /Isi TOTAL langkah tambahan hari ini/.test(steps));
c('dikosongkan = tambahan hari itu dihapus (hard delete)',
  /if \(bersih === ''\) \{\s*\n\s*await kirim\(0\);/.test(steps.replace(/\r\n/g, '\n')));

// =====================================================================
console.log('\n== 7. Titik merah: masuk ke kartunya & didatangi ==');
// =====================================================================
const badge = baca('components/common/Badge.tsx');
c('letaknya satu aturan di komponennya, bukan disalin per layar',
  /corner: \{ position: 'absolute', top: 6, right: 6, zIndex: 1 \}/.test(badge));
c('tidak ada lagi titik yang menggantung di luar kartunya',
  !/top: -4, right: -4/.test(
    [
      'app/debts.tsx',
      'components/career/FreelanceTab.tsx',
      'components/career/FulltimeTab.tsx',
      'components/common/UpkeepList.tsx',
      'components/core/VisitationTab.tsx',
      'components/device/PlanTab.tsx',
      'components/friends/SplitBillTab.tsx',
      'components/tasks/PriorityTab.tsx',
    ]
      .map(baca)
      .join('\n'),
  ));

// Tiga sub-tab berbadge yang dulu TIDAK punya penanda sama sekali.
c('Device › Stuff: barang bergaransi ditandai',
  /garansi !== null && garansi >= 0 && \(\s*\n?\s*<AttentionMark corner \/>/.test(
    baca('components/device/StuffTab.tsx').replace(/\r\n/g, '\n'),
  ));
c('Learning › Topics: topik minggu ini yang belum diobrolkan ditandai',
  /\{!checked && <AttentionMark corner \/>\}/.test(
    baca('components/learning/DiscussionTab.tsx'),
  ));
c('CORE › Follow Up: CL & ulang tahun sama-sama ditandai',
  /\{!done && <AttentionMark corner \/>\}/.test(baca('components/core/FollowupTab.tsx')) &&
    /<AttentionMark corner \/>\s*\n\s*<VixText heading="title" additionalStyle=\{styles\.birthdayTitle\}>/.test(
      baca('components/core/FollowupTab.tsx').replace(/\r\n/g, '\n'),
    ));

// Membuka sub-tabnya = daftarnya datang ke tanda merahnya. Syarat "tekanan
// kedua" dibuang: yang tahu aturan itu cuma yang menulis kodenya.
c('lompatannya tidak lagi menunggu tekanan kedua',
  !/enabled/.test(kode('hooks/useDueJump.ts')) &&
    !/repress/.test(kode('components/common/useTabScroll.ts')));
const PELOMPAT = [
  'components/common/UpkeepList.tsx', // Car › Parts + Residence › Maintenance
  'app/debts.tsx',
  'components/device/StuffTab.tsx',
  'components/device/PlanTab.tsx',
  'components/friends/SplitBillTab.tsx',
  'components/tasks/PriorityTab.tsx',
  'components/career/FulltimeTab.tsx',
  'components/career/FreelanceTab.tsx',
  'components/core/FollowupTab.tsx',
  'components/fitness/ExerciseTab.tsx',
  'components/learning/WeekTab.tsx',
];
const belum = PELOMPAT.filter((f) => {
  const s = kode(f);
  return (
    !/useDueJump\(/.test(s) ||
    !/onContentSizeChange=\{onContentSizeChange\}/.test(s) ||
    !/setRowY\(/.test(s)
  );
});
c('sebelas daftar berbadge melompat ke tanda merahnya',
  belum.length === 0, belum.join(', '));
// Satu ScrollView tidak boleh dipasangi dua ref: yang sudah punya ref sendiri
// (useScrollTop) mengopernya ke useDueJump.
c('ScrollView ber-ref sendiri mengoper refnya, bukan dipasangi ref kedua',
  /external\?: RefObject<ScrollView \| null>/.test(baca('hooks/useDueJump.ts')) &&
    /useDueJump\([\s\S]{0,160}scrollRef,\s*\n\s*\);/.test(
      baca('components/tasks/PriorityTab.tsx').replace(/\r\n/g, '\n'),
    ));

// =====================================================================
console.log('\n== 8. Layar Puasa: satu tombol simpan & dikartukan ==');
// =====================================================================
const puasa = baca('app/fasting.tsx');
// Dulu DUA tombol yang memanggil fungsi yang sama persis & menyimpan keenam
// kolomnya sekaligus — bukan cuma memenuhi layar, tapi bikin ragu apakah yang
// di atas sudah ikut tersimpan.
c('tinggal SATU tombol simpan, di paling bawah',
  (puasa.match(/<PrimaryButton/g) ?? []).length === 1 &&
    !/Simpan Jawaban Doa/.test(puasa));
c('isian dikelompokkan jadi tiga kartu, bukan enam kolom berderet',
  /<Bagian judul="📝 Tentang Puasa">/.test(puasa) &&
    /<Bagian judul="📆 Periode">/.test(puasa) &&
    /<Bagian judul="✨ Jawaban Doa">/.test(puasa));
c('ada kartu keadaan: progres + rentang + pil status',
  /<ProgressBar/.test(puasa) &&
    /keadaan\.gaya/.test(puasa) &&
    /🔥 Berjalan/.test(puasa) && /✅ Selesai/.test(puasa) && /🔒 Terkunci/.test(puasa));
c('pintu ke checklist harian naik ke atas isian',
  puasa.indexOf('Lihat Hari per Hari') < puasa.indexOf('Tentang Puasa'));

console.log('\n   yang TIDAK boleh berubah');
c('penguncian 3 hari sesudah selesai tetap berlaku',
  /fastingLocked\(plan, today\)/.test(puasa) && /FASTING_GRACE_DAYS/.test(puasa));
c('terkunci → tombolnya HILANG, bukan sekadar mati',
  /\{terkunci \? \(/.test(puasa) && /if \(!user \|\| busy \|\| terkunci\) return;/.test(puasa));
c('hapus TETAP ada walau terkunci (catatan salah masuk masih bisa dibuang)',
  /<InlineDelete/.test(puasa));
c('hitung mundur sebelum terkunci tetap ada', /sisaKunci/.test(puasa));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);