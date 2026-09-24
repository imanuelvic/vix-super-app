// Empat permintaan:
//   1. Puasa terkunci 3 hari sesudah selesai + checklist harian jadi layar
//      sendiri, dibuka lewat tombol di depan tiap baris daftar puasa
//   2. Badge: satu komponen untuk semua, plus penanda BERDENYUT pada penyebabnya
//   3. Kategori News muat sebaris (tidak terpotong) & rata tengah
//   4. Baca/tulis Firestore: langganan koleksi kembar digabung
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-badge-puasa');
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const ada = (f) => fs.existsSync(R + f);
/**
 * Kode SAJA, tanpa komentar — termasuk komentar JSX `{/* … *​/}`.
 *
 * Wajib untuk tiap pemeriksaan "X masih dipakai?": komentar yang MENYEBUT
 * nama itu ("bentuknya milik <Badge>", "`fit={6}`: kalau nanti…") membuat
 * pemeriksaannya tetap hijau padahal kodenya sudah hilang. Tiga mutasi lolos
 * gara-gara ini sebelum dibersihkan.
 */
const kode = (f) =>
  baca(f)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/fasting.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => {}, doc: () => {}, deleteDoc: () => {}, setDoc: () => {},
      limit: () => {}, orderBy: () => {}, query: () => {}, onSnapshot: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const puasa = require(M('fasting'));
Module._load = asli;

const cariTsx = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? cariTsx(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
const rel = (p) => p.replace(/\\/g, '/').replace(R, '');
const semua = [...cariTsx(R + 'app'), ...cariTsx(R + 'components'), ...cariTsx(R + 'lib')];

// =====================================================================
console.log('\n== 1a. Puasa dikunci 3 hari sesudah selesai ==');
// =====================================================================
const rencana = (endId) => ({ id: 'x', title: 'T', prayer: '', rules: '', answer: '', startId: '2026-08-24', endId, days: {} });
const P = rencana('2026-08-29');

c('masa tenggangnya 3 hari', puasa.FASTING_GRACE_DAYS === 3);
c('batas terakhir bisa diedit = selesai + 3 hari',
  puasa.fastingEditableUntil(P) === '2026-09-01', puasa.fastingEditableUntil(P));
// Hari terakhir puasa & sepanjang masa tenggang: MASIH bisa diedit.
c('hari terakhir puasa (29 Agu) belum terkunci',
  puasa.fastingLocked(P, new Date(2026, 7, 29)) === false);
c('hari ke-3 tenggang (1 Sep) masih bisa diedit — jawaban doa sering telat',
  puasa.fastingLocked(P, new Date(2026, 8, 1)) === false);
c('2 September TERKUNCI', puasa.fastingLocked(P, new Date(2026, 8, 2)) === true);
c('sekali terkunci, selamanya terkunci',
  puasa.fastingLocked(P, new Date(2027, 0, 1)) === true &&
  puasa.fastingLocked(P, new Date(2030, 0, 1)) === true);
// Puasa yang belum punya tanggal selesai (sedang dibuat) tak boleh ikut terkunci.
c('puasa tanpa tanggal selesai tidak pernah terkunci',
  puasa.fastingLocked(rencana(''), new Date(2030, 0, 1)) === false);

c('hitung mundur: 1 Sep = hari terakhir (0 hari lagi)',
  puasa.fastingLockDaysLeft(P, new Date(2026, 8, 1)) === 0,
  puasa.fastingLockDaysLeft(P, new Date(2026, 8, 1)));
c('30 Agu → 2 hari lagi',
  puasa.fastingLockDaysLeft(P, new Date(2026, 7, 30)) === 2);
c('selama puasanya masih jalan, belum ada hitung mundur',
  puasa.fastingLockDaysLeft(P, new Date(2026, 7, 26)) === null);
c('sesudah terkunci, hitung mundurnya berhenti (bukan angka negatif)',
  puasa.fastingLockDaysLeft(P, new Date(2026, 8, 5)) === null);

const layarPuasa = baca('app/fasting.tsx');
const layarHari = baca('app/fasting-days.tsx');
c('layar Edit Puasa: tombol simpan HILANG saat terkunci (bukan sekadar mati)',
  /\{terkunci \? \([\s\S]{0,400}?🔒[\s\S]{0,400}?\) : \([\s\S]{0,300}?<PrimaryButton/.test(layarPuasa));
c('kolom isiannya ikut baca-saja',
  (layarPuasa.match(/editable=\{!busy && !terkunci\}/g) ?? []).length >= 4,
  (layarPuasa.match(/editable=\{!busy && !terkunci\}/g) ?? []).length);
c('tanggal mulai & selesai ikut dikunci',
  (layarPuasa.match(/disabled=\{terkunci\}/g) ?? []).length === 2);
c('menyimpan ditolak di sumbernya juga, bukan cuma tombolnya disembunyikan',
  /if \(!user \|\| busy \|\| terkunci\) return;/.test(layarPuasa));
c('centang harian & simpan modal ikut ditolak saat terkunci',
  /if \(!user \|\| !planId \|\| terkunci\) return;/.test(layarHari) &&
  /if \(!plan \|\| terkunci\) return;/.test(layarHari));
// Menghapus BUKAN mengedit — catatan salah ketik harus tetap bisa dibuang.
c('tombol hapus TETAP ada walau terkunci (sengaja)',
  /<InlineDelete/.test(layarPuasa) &&
  !/terkunci[\s\S]{0,80}<InlineDelete/.test(layarPuasa));

// =====================================================================
console.log('\n== 1b. Checklist harian punya layarnya sendiri ==');
// =====================================================================
c('layar /fasting-days ada', ada('app/fasting-days.tsx'));
c('terdaftar di navigator', /<Stack\.Screen name="fasting-days" \/>/.test(baca('app/_layout.tsx')));
c('rutenya terdaftar di typed routes', /fasting-days/.test(baca('.expo/types/router.d.ts')));
c('daftar hari & modalnya PINDAH — tak tertinggal di layar Edit Puasa',
  !/dayIds\.map/.test(layarPuasa) && !/<SheetModal/.test(layarPuasa) &&
  /dayIds\.map/.test(layarHari) && /<SheetModal/.test(layarHari));
// Kartu ringkasannya pindah; di layar Edit yang tersisa cuma SATU BARIS di
// dalam tombol menuju ke sana — angkanya jadi alasan menekan tombolnya, bukan
// kartu besar kedua yang mengulang isi layar sebelah.
c('kartu ringkasan besar pindah ke layar hari per hari',
  /<SummaryCard[\s\S]{0,200}Puasa berhasil/.test(layarHari) &&
  !/styles\.progressCard/.test(layarPuasa));
// 2 Sep 2026: angkanya naik ke kartu keadaan paling atas (progres + pil
// "🔥 Berjalan / ✅ Selesai / 🔒 Terkunci"), jadi tombolnya tinggal menyebut
// gunanya. Yang tetap dijaga: angkanya cuma ada SEKALI di layar ini.
c('di layar Edit angkanya cuma DITULIS sekali, di kartu keadaannya',
  /\{progress\.done\}/.test(layarPuasa) &&
  // Dua pemakaian, satu tempat: angkanya DITULIS sekali, lalu angka yang sama
  // mengisi bar progres di bawahnya. Bukan dua kartu yang sama-sama melapor.
  (layarPuasa.match(/progress\.done/g) ?? []).length === 2 &&
  /value=\{progress\.done\}/.test(layarPuasa) &&
  /Centang puasamu tiap malam di sini/.test(layarPuasa));

const tabPuasa = baca('components/spiritual/FastingTab.tsx');
c('tiap baris daftar punya tombol 📆 DI DEPANNYA',
  /style=\{styles\.daysIcon\}[\s\S]{0,120}openDays\(p\.id\)/.test(tabPuasa));
c('puasa yang sedang berjalan juga punya tombolnya',
  /style=\{styles\.daysButton\}[\s\S]{0,120}openDays\(active\.id\)/.test(tabPuasa));
c('tombolnya BUKAN Pressable bersarang (tidak andal di iOS)',
  /<View key=\{p\.id\} style=\{styles\.row\}>/.test(tabPuasa));
c('layar Edit Puasa juga punya pintu ke sana',
  /pathname: '\/fasting-days'/.test(layarPuasa));
// Kartu reminder yang mengajak MENCENTANG harus mendarat di checklist-nya,
// bukan di layar keterangan yang sekarang sudah tak punya centang.
c('reminder Today & Semua Pengingat diarahkan ke checklist-nya',
  /pathname: '\/fasting-days', params: \{ id: fastingNow\.id, day: todayId \}/
    .test(BACA_TODAY('lib/today.ts')) &&
  /pathname: '\/fasting-days',\s*\n\s*params: \{ id: fastingNow\.id \}/
    .test(baca('app/reminders.tsx').replace(/\r\n/g, '\n')));

// =====================================================================
console.log('\n== 2a. Badge: SATU komponen untuk semua tempat ==');
// =====================================================================
const badge = baca('components/common/Badge.tsx');
c('komponen bersamanya ada', ada('components/common/Badge.tsx'));
c('aturannya satu: 0 tak digambar, >9 jadi "9+"',
  /if \(!count \|\| count <= 0\) return null;/.test(badge) &&
  /count > MAX \? `\$\{MAX\}\+` : count/.test(badge));

// 22 Sep 2026: grid tile pindah ke tab Life & SENGAJA tanpa badge (Today yang bicara).
c('grid Life sengaja tanpa badge', !/<Badge/.test(kode('app/(tabs)/life.tsx')));
// Dua tempat yang dulu menggambar badge-nya sendiri.
for (const [f, nama] of [
  ['components/common/BottomTabs.tsx', 'sub-tab bawah'],
  ['components/common/EmojiButton.tsx', 'tombol pojok kanan'],
]) {
  const src = kode(f);
  c(`${nama.padEnd(20)} memakai <Badge>`, /<Badge\b/.test(src) &&
    /components\/common\/Badge/.test(src));
  c(`${nama.padEnd(20)} tak lagi punya salinan bentuknya`,
    !/backgroundColor: Color\.DANGER,[\s\S]{0,200}borderWidth/.test(src) &&
    !/> 9 \? '9\+'/.test(src));
}

// =====================================================================
console.log('\n== 2b. Penanda berdenyut pada PENYEBAB badge ==');
// =====================================================================
c('AttentionMark ada & berdenyut berulang',
  /export function AttentionMark/.test(badge) && /withRepeat\(/.test(badge));
c('denyutnya dimulai di efek, bukan saat render',
  /useEffect\(\(\) => \{\s*\n\s*denyut\.value = withRepeat/.test(badge.replace(/\r\n/g, '\n')));
c('riaknya tidak pernah mencuri tekanan jari',
  /pointerEvents="none"/.test(badge));

// Tiap fitur yang punya badge di Home HARUS menandai penyebabnya di dalam.
const PENANDA = [
  ['spiritual', 'app/(tabs)/walk.tsx'],
  ['tasks · harian', 'app/tasks.tsx'],
  ['tasks · prioritas', 'components/tasks/PriorityTab.tsx'],
  ['career · fulltime', 'components/career/FulltimeTab.tsx'],
  ['career · freelance', 'components/career/FreelanceTab.tsx'],
  ['core · visitation', 'components/core/VisitationTab.tsx'],
  ['car & residence', 'components/common/UpkeepList.tsx'],
  ['fitness', 'components/fitness/ExerciseTab.tsx'],
  ['learning', 'components/learning/WeekTab.tsx'],
  ['finance · pinjaman', 'app/debts.tsx'],
  ['social · split bill', 'components/friends/SplitBillTab.tsx'],
  ['device · paket', 'components/device/PlanTab.tsx'],
];
for (const [nama, f] of PENANDA) {
  c(`${nama.padEnd(20)} menandai penyebabnya`, /<AttentionMark/.test(baca(f)));
}

// Yang dijaga: ambang penandanya dipanggil dari LIB yang sama dengan badge-nya,
// bukan ditebak ulang di layar. Kalau ditebak ulang, suatu hari titiknya
// menyala di baris yang tidak ikut dihitung badge — dan itu justru menyesatkan.
c('penanda memakai aturan yang sama dengan badge-nya (bukan tebakan sendiri)',
  /deadlineDue\(row\.tone\) && \(/.test(baca('components/common/UpkeepList.tsx')) &&
  /billUnsettled\(bill\) && \(/.test(baca('components/friends/SplitBillTab.tsx')) &&
  /debtUrgent\(d, today\) && \(/.test(baca('app/debts.tsx')) &&
  /freelanceReminderWindow\(p, today\) && \(/.test(baca('components/career/FreelanceTab.tsx')) &&
  /perluKirim && </.test(baca('components/core/VisitationTab.tsx')) &&
  // Sejak garis merahnya ikut dipasang (attentionBorder), syaratnya dihitung
  // SEKALI ke sebuah nama lalu dipakai dua-duanya — jadi mustahil ada kartu
  // bergaris merah tanpa titik, atau sebaliknya. Yang dijaga tetap sama:
  // ambangnya datang dari lib-nya (PLAN_ALERT_DAYS), bukan angka tulis tangan.
  /const perluIsi = aktif && sisaHari <= PLAN_ALERT_DAYS;/
    .test(baca('components/device/PlanTab.tsx')));
// Learning: badge menghitung SEMUA yang tertagih, bukan cuma yang terdepan.
c('Learning menandai semua langkah tertagih, bukan cuma yang terdepan',
  /overdueSteps\(week\.steps, now\)/.test(baca('components/learning/WeekTab.tsx')) &&
  /export function overdueSteps/.test(baca('lib/learning.ts')));

// =====================================================================
console.log('\n== 3. Kategori News muat sebaris & rata tengah ==');
// =====================================================================
const chipRow = baca('components/common/ChipRow.tsx');
const chip = baca('components/common/Chip.tsx');
const newsTab = baca('components/news/NewsTab.tsx');
// 2 Sep 2026 — mode "muat sebaris" DIBATALKAN atas permintaan pemiliknya.
// Lebar chip yang dipatok sama rata menuntut hurufnya yang mengalah: satu
// baris berisi enam ukuran huruf berbeda ("Tech" besar, "Kristen" kecil), dan
// yang terpanjang tetap paling kecil. Terlihat semua, terbaca seperti
// kesalahan cetak. Chip yang benar itu KOTAKNYA yang mengikuti hurufnya.
c('mode "muat sebaris" benar-benar dibuang', !/fit\?: number;/.test(chipRow));
c('lebar sama rata ikut dibuang', !/bagian: \{ flex: 1 \}/.test(chipRow));
c('hurufnya TIDAK mengecil sendiri lagi',
  !/adjustsFontSizeToFit/.test(kode('components/common/Chip.tsx')));
c('nama kategorinya tetap rata tengah', /textAlign: 'center'/.test(chip));
c('News kembali ke bentuk baris geser, sama seperti Reminder',
  !/fit=\{/.test(kode('components/news/NewsTab.tsx')) &&
    /activeIndex=\{NEWS_SOURCES\.findIndex/.test(newsTab));
// Tingginya dipatok seperti Reminder: ScrollView horizontal pernah salah
// mengukur tinggi kontennya sampai chip-nya menindih keterangan di bawahnya.
c('tinggi barisnya dipatok (chip tidak menindih isi di bawahnya)',
  /sourceScroll: \{ height: 52 \}/.test(newsTab) &&
    /kindScroll: \{ height: 58 \}/.test(baca('components/fun/CreatorsTab.tsx')));
c('sumber News memang 7 (Crypto masuk 23 Sep 2026) — barisnya tetap bisa digeser',
  (baca('lib/news.ts').match(/\{ key: '\w+', label: '[^']+', emoji:/g) ?? []).length === 7,
  (baca('lib/news.ts').match(/\{ key: '\w+', label: '[^']+', emoji:/g) ?? []).length);
// Baris chip lain TIDAK ikut berubah — mereka memang panjang & harus digeser.
c('baris chip lain tetap baris geser (tak ada fit yang tercecer)',
  (
    semua
      .filter((p) => rel(p) !== 'components/news/NewsTab.tsx')
      .filter((p) => /fit=\{/.test(fs.readFileSync(p, 'utf8')))
      .map(rel)
  ).length === 0);

// =====================================================================
console.log('\n== 4. Hemat Firestore: langganan koleksi kembar digabung ==');
// =====================================================================
const live = baca('lib/liveDoc.ts');
c('liveList menggabungkan kueri yang sama', /queryEqual\(x\.q, q\)/.test(live));
c('perbandingannya pakai queryEqual resmi Firestore, bukan tebakan sendiri',
  /import \{[\s\S]{0,300}queryEqual,/.test(live));
c('pemakai berikutnya langsung dapat hasil yang sudah ada (0 baca tambahan)',
  /if \(entry\.last\) terima\(entry\.last\);/.test(live));
c('tiap pemakai tetap memakai `row`-nya sendiri (snapshot mentah yang dibagi)',
  /subs: Set<\(snapshot: QuerySnapshot\) => void>;/.test(live));
c('listener dilepas setelah pemakai terakhir pergi (dengan jeda pindah layar)',
  /entry\.idle = setTimeout\(/.test(live) && /IDLE_MS/.test(live));
c('logout melepas langganan koleksi juga, bukan cuma dokumen',
  /lists\.forEach\(\(e\) => \{[\s\S]{0,120}e\.stop\?\.\(\);/.test(live) &&
  /lists\.length = 0;/.test(live));

// Bukti angkanya: koleksi mana yang benar-benar didengarkan >1 layar.
const koleksi = new Set();
for (const p of cariTsx(R + 'lib')) {
  const s = fs.readFileSync(p, 'utf8');
  for (const m of s.matchAll(/export function (subscribe\w+)\(([\s\S]{0,1400}?)\n\}/g)) {
    if (/liveList|onSnapshot\(\s*q/.test(m[2])) koleksi.add(m[1]);
  }
}
let pemasangan = 0;
const ganda = [];
for (const f of koleksi) {
  const pakai = semua.filter((p) => new RegExp('\\b' + f + '\\(').test(fs.readFileSync(p, 'utf8')));
  pemasangan += pakai.length;
  if (pakai.length > 1) ganda.push(`${f}×${pakai.length}`);
}
c('memang ada langganan koleksi yang kembar (ini yang dihemat)',
  ganda.length >= 10, ganda.slice(0, 5).join(', ') + ' …');
c(`${pemasangan} pemasangan → ${koleksi.size} listener sesudah digabung`,
  pemasangan > koleksi.size, `hemat ${pemasangan - koleksi.size}`);

// Yang TIDAK boleh berubah: liveDoc sudah menggabungkan sejak dulu.
c('penggabungan dokumen (liveDoc) tetap utuh',
  /const entries = new Map<string, Entry>\(\);/.test(live) &&
  /if \(e\.live && e\.last\) \{/.test(live));

console.log('\n' + (ok ? 'LULUS: semua benar.' : 'GAGAL: ada yang tidak cocok.'));
process.exit(ok ? 0 : 1);