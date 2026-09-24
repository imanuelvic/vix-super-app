// Delapan permintaan 30 Agu 2026:
//   1. Pil 💡 Home: ⚠️ belum diisi · angka sisa · ✅ beres
//   2. Tekanan & gula darah jadi SATU kotak → halaman sendiri
//   3. Steps dirombak: target mingguan sendiri + tulisan "sisa"
//   4. Kartu Refleksi Home → Habits tab Pagi, tepat ke baris jurnalnya
//   5. Tab sesi: "❌ tak tuntas" kalau ada yang dilewati + lompat otomatis
//   6. Kategori expense Residence → ikut tercatat di Residence › Log
//   7. Kategori tanpa budget → abu-abu gelap
//   8. Idea For CORE jadi halaman sendiri (tombol 💡 di header CORE)
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-delapan-b');
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
      R + 'lib/priority.ts', R + 'lib/health.ts', R + 'lib/budgets.ts',
      R + 'lib/residence.ts', R + 'lib/categories.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['priority.js', 'health.js', 'budgets.js', 'residence.js']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({ path: 'x' }), setDoc: async () => {},
      getDoc: async () => ({ data: () => ({}) }), onSnapshot: () => () => {},
      deleteDoc: async () => {}, addDoc: async () => ({}), updateDoc: async () => {},
      deleteField: () => '__d__', query: () => ({}), orderBy: () => ({}),
      limit: () => ({}), writeBatch: () => ({}), arrayUnion: () => ({}),
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) {
    return { liveDoc: () => () => {}, unsubscribeAll: () => () => {} };
  }
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const P = require(path.join(DIR, 'priority.js'));
const H = require(path.join(DIR, 'health.js'));
const B = require(path.join(DIR, 'budgets.js'));
const RES = require(path.join(DIR, 'residence.js'));
const CAT = require(path.join(DIR, 'categories.js'));

const item = (text, done = false) => ({ text, done });

// =====================================================================
console.log('=== 1. Pil 💡 Daily Priority: ⚠️ · angka · ✅ ===');
// =====================================================================
{
  // Pilnya kini membaca HARI, bukan cuma daftar barisnya: tanda "dilewati"
  // menumpang di dokumen yang sama dan ikut menentukan bunyinya.
  const hari = (items, skipped = false) => ({ items, skipped });
  const kosong = hari([item(''), item(''), item('')]);
  const isi3 = hari([item('A'), item('B'), item('C')]);
  const satuBeres = hari([item('A', true), item('B'), item('C')]);
  const semuaBeres = hari([item('A', true), item('B', true), item('C', true)]);

  c('belum diisi → ⚠️, TANPA angka',
    P.priorityBadgeText(kosong) === '💡 ⚠️', P.priorityBadgeText(kosong));
  c('sudah diisi 3, belum dicoret → 💡 3',
    P.priorityBadgeText(isi3) === '💡 3', P.priorityBadgeText(isi3));
  c('satu dicoret → 💡 2', P.priorityBadgeText(satuBeres) === '💡 2');
  c('semuanya dicoret → ✅',
    P.priorityBadgeText(semuaBeres) === '💡 ✅', P.priorityBadgeText(semuaBeres));

  c('keadaannya juga bisa dibaca terpisah',
    P.priorityState(kosong) === 'kurang' && P.priorityState(isi3) === 'sisa' &&
      P.priorityState(semuaBeres) === 'beres');

  // BERUBAH atas permintaan: diisi 1 atau 2 TETAP ⚠️, bukan angka — mengisinya
  // wajib tiga. Aturan lengkapnya diuji di cek-enam-permintaan.js.
  c('diisi sebagian TETAP menagih pengisiannya, bukan menampilkan angka',
    P.priorityBadgeText(hari([item('A'), item(''), item('')])) === '💡 ⚠️',
    P.priorityBadgeText(hari([item('A'), item(''), item('')])));

  // Keadaan KEEMPAT (10 Sep 2026): hari yang sengaja dilewati. Menagih hari
  // yang sudah kamu putuskan untuk lewati itu bukan mengingatkan, cuma
  // berisik — jadi bunyinya ⏭️, termasuk saat barisnya kebetulan sudah terisi.
  c('hari yang dilewati → ⏭️, bukan ⚠️ / angka',
    P.priorityBadgeText(hari([item(''), item(''), item('')], true)) === '💡 ⏭️' &&
      P.priorityBadgeText(hari([item('A'), item('B'), item('C')], true)) ===
        '💡 ⏭️' &&
      P.priorityState(hari([item('A'), item('B'), item('C')], true)) === 'lewat');

  // Angka badge lamanya TIDAK berubah — badge tile & baris cermin Habits
  // masih memakainya.
  c('priorityPending lama tidak diubah artinya',
    P.priorityPending(kosong.items) === 3 &&
      P.priorityPending(semuaBeres.items) === 0);

  const home = baca('app/(tabs)/index.tsx');
  // 22 Sep 2026: pil 💡 Home dibuang; Today punya blok "3 hal terpenting"
  // yang menyebut keadaannya dengan kalimat, bukan angka telanjang.
  c('Today memakai kalimat keadaannya, bukan angka telanjang',
    /priorityFilled\(day\.items\)/.test(BACA_TODAY('components/today/PrioritiesBlock.tsx')) &&
      !/priorityPending\(/.test(BACA_TODAY('components/today/PrioritiesBlock.tsx')));
}

// =====================================================================
console.log('\n=== 2. Tekanan & gula darah: satu kotak → halaman sendiri ===');
// =====================================================================
{
  const tab = baca('components/health/CheckupTab.tsx');
  c('dua kartu panjangnya sudah tidak digambar di sub-tab',
    !/<StatusCard/.test(tab) && !/function StatusCard/.test(tab));
  c('diganti SATU kotak yang bisa dipencet',
    /<PressableScale\s*\n\s*style=\{styles\.summaryCard\}/.test(tab) &&
      /router\.push\('\/checkup-status'\)/.test(tab));
  c('kedua angkanya tetap terlihat dari sub-tab',
    /CHECKUP_TYPES\.map\(\(meta\) => \{[\s\S]{0,200}checkupSummary\(meta\.key/.test(tab));
  c('yang perlu perhatian ditandai ⚠️ + warna bahaya',
    /s\.perhatian \? ' ⚠️' : ''/.test(tab) &&
      /s\.perhatian \? styles\.summaryWarn : styles\.summaryValue/.test(tab));

  c('halamannya ada & memakai kartu yang sama (bukan salinan)',
    fs.existsSync(R + 'app/checkup-status.tsx') &&
      /<CheckupStatusCard/.test(baca('app/checkup-status.tsx')) &&
      /export function CheckupStatusCard/.test(
        baca('components/health/CheckupStatusCard.tsx')));
  c('isi kartunya utuh: nilai normal, hasil, tips, jadwal berikutnya', (() => {
    const k = baca('components/health/CheckupStatusCard.tsx');
    return /Normal: \{info\.normal\}/.test(k) && /Hasil terakhir/.test(k) &&
      /result\.tip/.test(k) && /Cek lagi/.test(k);
  })());
  c('rutenya sudah terdaftar di typed routes',
    /checkup-status/.test(baca('.expo/types/router.d.ts')));
}

// =====================================================================
console.log('\n=== 3. Steps: target mingguan sendiri + tulisan "sisa" ===');
// =====================================================================
{
  c('sisa dihitung benar', H.weekTargetLeft(10, 25) === 15);
  c('sudah lewat target → sisa 0, bukan negatif',
    H.weekTargetLeft(30, 25) === 0, String(H.weekTargetLeft(30, 25)));
  c('pas di target → sisa 0', H.weekTargetLeft(25, 25) === 0);
  c('usul awalnya masuk akal', H.WEEK_TARGET_DEFAULT_KM === 25);

  const kartu = baca('components/health/WeekTargetCard.tsx');
  c('targetnya diisi sendiri & bisa dihapus',
    /saveWeekTarget/.test(kartu) && /clearWeekTarget/.test(kartu));
  c('tulisan "sisa" persis seperti target berat di Habits',
    /Sisa \$\{formatDecimal\(sisa\)\} km lagi minggu ini/.test(kartu));
  c('tercapai → ucapan, bukan angka minus',
    /Target minggu ini tercapai/.test(kartu));
  c('belum dipasang → kartunya jadi ajakan, bukan kartu kosong',
    /Belum dipasang\. Tentukan targetmu/.test(kartu));

  const steps = baca('components/health/StepsTab.tsx');
  c('kartunya ditaruh paling atas, sesudah angka hari ini',
    steps.indexOf('<WeekTargetCard') < steps.indexOf('title="📅 This Week"') &&
      steps.indexOf('<WeekTargetCard') > steps.indexOf('👣 Langkah hari ini'));
  // Yang diperiksa TULISAN YANG DIRENDER, bukan komentarnya: baris keterangan
  // di tiap kartu (prop `sub`) sudah tidak ada sama sekali.
  c('keterangan bertele-tele di tiap kartu dibuang',
    !/^\s*sub="/m.test(steps) && !/\{sub\}/.test(steps) &&
      !/Anjuran dewasa: ±150 menit/.test(steps));
  c('anjuran kesehatan umum dipisahkan dari target pribadi',
    /🩺 Anjuran Kesehatan/.test(steps) && !/🎯 Target Sehat Mingguan/.test(steps));
  c('reset tiap Senin tetap dari sumber yang sama (weekDayIds)',
    /const hariMinggu = weekDayIds\(now\);/.test(steps) &&
      /stepsInDays\(stepDays, hariMinggu\)/.test(steps));

  // Reset Senin 00.00 — dijalankan.
  const senin = new Date(2026, 7, 31); // Senin
  const minggu = new Date(2026, 7, 30); // Minggu sebelumnya
  const idsSenin = H.weekDayIds(senin);
  const idsMinggu = H.weekDayIds(minggu);
  c('minggu baru = daftar hari yang benar-benar baru',
    idsSenin.every((d) => !idsMinggu.includes(d)),
    `${idsSenin[0]}…${idsSenin[6]}`);
  c('minggunya selalu 7 hari & mulai Senin',
    idsSenin.length === 7 && idsSenin[0] === '2026-08-31');
}

// =====================================================================
console.log('\n=== 4. Kartu di Home → baris tujuannya di tab Habits ===');
// =====================================================================
{
  const home = baca('app/(tabs)/index.tsx');
  c('blok Refleksi (Today) menuju Habits dengan ?focus=rhema',
    /pathname: '\/habits', params: \{ focus: 'rhema' \}/.test(BACA_TODAY('components/today/ReflectionBlock.tsx')));
  // Kartu "🌅/🌤️/🌙 … Reading" memakai pintu yang SAMA, dan sesinya ikut —
  // jadi kartu jam berapa pun tidak pernah mendarat di baris sesi lain.
  c('baris Bible Reading (Today Engine) menuju baris sesi jam itu, bukan layar catat bacaan',
    /pathname: '\/habits', params: \{ focus: `bible-\$\{bibleSession\}` \}/.test(BACA_TODAY('lib/today.ts')) &&
      !/pathname: '\/bible-reading'/.test(BACA_TODAY('lib/today.ts')));
  const layar = baca('app/habits.tsx');
  c('layar Habits meneruskannya ke tabnya',
    /focus=\{focusOf\(focus\)\}/.test(layar));
  c('param dari URL disaring dulu — yang tak dikenal diabaikan',
    /const FOCUSABLE: HabitFocus\[\] = \[/.test(layar) &&
      /'bible-morning',\s*\n\s*'bible-daytime',\s*\n\s*'bible-night',/.test(layar) &&
      /FOCUSABLE\.find\(\(f\) => f === raw\) \?\? null/.test(layar));
  const tab = baca('components/habits/HabitsTab.tsx');
  // Boleh ada komentar di antaranya (sejak lint dirapikan 11 Sep 2026);
  // yang dijaga tetap sama: penjaganya lebih dulu, baru sesinya dipindah.
  c('sesi baris tujuannya dibuka dulu (jurnal biasanya Pagi)',
    /if \(!focusId \|\| !focusSlot\) return;[\s\S]{0,300}?setActiveSlot\(focusSlot\);/.test(
      tab,
    ));
  c('saringan area ikut dilepas — barisnya tak mungkin tersembunyi',
    /setAreaFilter\(null\);/.test(tab));
  // Baris "📖 Midday Bible Reading" disisipkan induknya kalau belum ada, jadi
  // kadang baru muncul SESUDAH layarnya dibuka — id-nya harus ikut dipantau,
  // bukan cuma sesinya, kalau tidak lompatannya tak pernah jalan untuk Siang.
  c('baris yang baru muncul belakangan tetap dikejar',
    /\}, \[focusId, focusSlot\]\);/.test(tab));
  c('lalu digulung TEPAT ke barisnya, bukan sekadar ke bawah',
    /const targetId = focusId \?\? firstPendingId;/.test(tab) &&
      /y: Math\.max\(0, blockY\.current \+ y - 8\)/.test(tab));
  c('barisnya dikenali dari sifatnya, bukan id yang ditulis tangan',
    /focus === 'rhema' \? isNoteDrivenHabit\(h\) : habitMirror\(h\) === focus/.test(tab));
}

// =====================================================================
console.log('\n=== 5. Tab sesi: ❌ tak tuntas + lompat otomatis ===');
// =====================================================================
{
  const tab = baca('components/habits/HabitsTab.tsx');
  c('sesi yang ada dilewatinya TIDAK lagi disebut "beres"',
    /const adaDilewati = grouped\[s\.key\]\.some\(\(h\) => day\.skipped\[h\.id\]\);/.test(tab) &&
      /const tuntas = complete && !adaDilewati;/.test(tab));
  c('kata pendeknya "❌ tak tuntas"', /'❌ tak tuntas'/.test(tab));
  c('warnanya merah (bahaya), bukan warna biasa',
    /subColor:\s*\n?\s*complete && !tuntas \? Color\.DANGER : undefined/.test(tab));
  c('yang benar-benar tuntas tetap "✅ beres"', /'✅ beres'/.test(tab));
  c('SegmentTabs sanggup mewarnai keterangannya',
    /subColor\?: string;/.test(baca('components/common/SegmentTabs.tsx')));

  c('sesi jam sekarang tetap yang terbuka duluan',
    /defaultSlot\(countedHabits\(habits, day\.skipped\), day\.done, new Date\(\)\)/.test(tab));
  c('lalu melompat ke baris pertama yang belum dicentang',
    /const firstPendingId =\s*\n\s*activeList\.find\(\(h\) => !day\.done\[h\.id\] && !day\.skipped\[h\.id\]\)\?\.id \?\? null;/.test(tab));
  c('cuma SEKALI per pembukaan (posisimu tidak ditarik-tarik)',
    /if \(bukaanJumped\.current\) return;/.test(tab));
  c('aturannya sama dengan menekan tab sesi 2×',
    /const target = activeList\.find\(\s*\n?\s*\(h\) => !day\.done\[h\.id\] && !day\.skipped\[h\.id\],?\s*\n?\s*\);/.test(tab));

  // defaultSlot dijalankan: jam malam → sesi malam.
  // (lib/habits ikut dikompilasi lewat health? tidak — cukup periksa sumbernya.)
  const libH = baca('lib/habits.ts');
  c('defaultSlot memang mengikuti jam sekarang',
    /return now\.getHours\(\) < 1 \? 'morning' : slotNow\(now\);/.test(libH));
}

// =====================================================================
console.log('\n=== 6. Kategori expense Residence → Residence › Log ===');
// =====================================================================
{
  const kat = CAT.FINANCE_CATEGORIES.expense.find((c2) => c2.key === 'residence');
  c('kategorinya ada di daftar Expense', !!kat, kat ? `${kat.icon} ${kat.label}` : 'TIDAK ADA');
  c('dan aktif', !!kat && kat.active === true);

  const subs = B.subsOf({}, 'expense', 'residence');
  c('sub-kategorinya SAMA PERSIS dengan jenis log Residence',
    subs.length === RES.RESIDENCE_LOG_TYPES.length &&
      subs.every((s, i) => s.key === RES.RESIDENCE_LOG_TYPES[i].key),
    subs.map((s) => s.key).join(' · '));
  c('daftarnya tidak disalin — diturunkan dari RESIDENCE_LOG_TYPES',
    /RESIDENCE_LOG_TYPES\.map\(/.test(baca('lib/budgets.ts')));
  c('labelnya ikut lambangnya',
    subs[0].label === `${RES.RESIDENCE_LOG_TYPES[0].icon} ${RES.RESIDENCE_LOG_TYPES[0].label}`,
    subs[0].label);

  c('transaksi Residence dikenali', B.isResidenceTransaction('expense', 'residence', 'wifi') === true);
  c('tanpa sub → bukan (tak tahu jenis lognya)',
    B.isResidenceTransaction('expense', 'residence', undefined) === false);
  c('sub asing → bukan', B.isResidenceTransaction('expense', 'residence', 'ngawur') === false);
  c('jenis lain (income) → bukan', B.isResidenceTransaction('income', 'residence', 'wifi') === false);
  c('kategori lain → bukan', B.isResidenceTransaction('expense', 'rent', 'wifi') === false);
  c('bensin tidak ikut tertarik ke aturan baru',
    B.isFuelTransaction('expense', 'transportation', 'bensin') === true &&
      B.isResidenceTransaction('expense', 'transportation', 'bensin') === false);

  const tx = baca('components/finance/TransactionsTab.tsx');
  c('disimpan → ikut tercatat di Log Residence', /syncResidenceLog\(user\.uid, ref\.id/.test(tx));
  c('diubah → lognya ikut diperbarui / dilepas',
    /await syncResidenceLog\(user\.uid, editing\.id/.test(tx) &&
      /\} else if \(wasResidence\) \{\s*\n\s*await deleteResidenceLog\(user\.uid, editing\.id\);/.test(tx));
  c('dihapus → lognya ikut hilang',
    /await deleteResidenceLog\(user\.uid, confirmDelete\.id\);/.test(tx));
  c('id lognya = id transaksinya (tak mungkin dobel)',
    /doc\(db, 'users', uid, 'houseLogs', txId\)/.test(baca('lib/residence.ts')));

  // 30 Agu 2026: tab Log Residence jadi BACA-SAJA seluruhnya — tombol "Catat
  // Pengeluaran" dibuang, jadi tidak ada lagi baris yang "dicatat sendiri".
  // Aturannya makin sederhana: semua baris datang dari Finance, semuanya
  // baca-saja. Dijaga lengkap di cek-tujuh-baru.js.
  const log = baca('components/residence/LogTab.tsx');
  c('baris dari Finance TIDAK bisa diubah di Residence',
    /active=\{false\}/.test(log) && /disabled/.test(log) &&
      !/openEdit/.test(log));
  c('dan ada tulisannya, sama seperti Log Car',
    /💰 Data dari Finance/.test(log) &&
      /💰 Data dari Finance/.test(baca('components/car/LogTab.tsx')));
}

// =====================================================================
console.log('\n=== 7. Kategori tanpa budget → abu-abu gelap ===');
// =====================================================================
{
  const warna = baca('assets/style/color.ts');
  c('warna "tidak berlaku" punya namanya sendiri',
    /DISABLED: '#[0-9A-Fa-f]{6}'/.test(warna) &&
      /DISABLED_DARK: '#[0-9A-Fa-f]{6}'/.test(warna));

  const tx = baca('components/finance/TransactionsTab.tsx');
  c('budget 0 / belum diatur → abu-abu, bukan putih polos',
    /if \(allocated <= 0\) \{\s*\n\s*return \{\s*\n\s*backgroundColor: Color\.DISABLED,/.test(tx));
  c('warna pemakaian budget lainnya tidak diubah',
    /percent > 100/.test(tx) && /percent >= 100/.test(tx) && /percent >= 75/.test(tx));
  c('alasannya ditulis, bukan warna yang tiba-tiba berubah',
    /tak bisa dibedakan dari kategori yang\s*\n\s*\/\/ budget-nya masih longgar/.test(tx));
}

// =====================================================================
console.log('\n=== 8. Idea For CORE: DICABUT total (16 Sep 2026) ===');
// =====================================================================
// Dulu bagian ini menjaga halaman ide berdiri sendiri. Fiturnya kini dihapus
// atas permintaan: layar, tombol 💡 di header, pengingat Dashboard, dan kode
// di lib/core. Yang dijaga sekarang: tidak ada sisanya di mana pun.
{
  c('halamannya sudah tidak ada', !fs.existsSync(R + 'app/core-ideas.tsx'));
  const core = baca('app/(tabs)/core.tsx');
  c('tombol 💡 tidak ada lagi di header; 💬 & 🙏 tetap',
    !/emoji="💡"/.test(core) && !/core-ideas/.test(core) &&
      /emoji="💬"/.test(core) && /emoji="🙏"/.test(core));
  c('lib/core tidak punya kode ide lagi',
    !/CoreIdea|subscribeCoreIdeas|ideaReminderDue|IDEA_CADENCE/.test(baca('lib/core.ts')));
  c('Dashboard tidak lagi melanggan & mengingatkan ide',
    !/coreIdea|subscribeCoreIdeas|Idea untuk CORE/.test(baca('app/reminders.tsx')));
  c('rute & tema tidak menyisakan core-ideas',
    !/core-ideas/.test(baca('lib/featureTheme.ts')) &&
      !/core-ideas/.test(baca('.expo/types/router.d.ts')));
  const fu = baca('components/core/FollowupTab.tsx');
  c('Follow Up bersih dari bekasnya',
    !/Idea For CORE|editingIdea|ideaCard|CoreIdeasData/.test(fu));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);