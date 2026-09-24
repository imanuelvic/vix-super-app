// Lima permintaan 22 Sep 2026 (dari foto):
//   1. Wheel & Timeline milik satu CL: share LANGSUNG ke orangnya (PDF → catat
//      → chat WA), tanpa sheet "📤 Share to CORE Leader" & tanpa "bagikan biasa"
//   2. Puasa › Hari per Hari: ✓ berhasil DAN ✗ gagal berdampingan (seperti
//      Habits), bukan lingkaran centang + tulisan "❌ Gagal"
//   3. Morning Journey: chip Bersyukur = 💚 (bukan ❤️ yang kembar dengan ikon baris)
//   4. Edit Puasa: "💾 Simpan Perubahan" → langsung kembali
//   5. Fitness › Hasil lari: waktu jam · menit · detik seperti Race
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-lima-22sep');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const kodeSaja = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

// ---------- compile: lib/fasting (dijalankan sungguhan) ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync('npx', ['tsc', path.join(ROOT, 'lib/fasting.ts'), path.join(ROOT, 'lib/fun.ts'),
    '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
    '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
  { cwd: ROOT, stdio: 'pipe', shell: true });
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return { collection: () => ({}), doc: () => ({}), setDoc: async () => {}, deleteDoc: async () => {}, updateDoc: async () => {},
      query: () => ({}), orderBy: () => ({}), where: () => ({}), Timestamp: { now: () => ({}), fromDate: () => ({}) } };
  }
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req.endsWith('assets/style/color')) return { Color: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) };
  if (/^expo-|^@react-native|^react-native|^react$|^@\//.test(req)) return {};
  return asli(req, parent, isMain);
};
const FA = require(path.join(OUT, 'fasting.js'));
const FU = require(path.join(OUT, 'fun.js'));
Module._load = asli;

// ================= 1. Share langsung ke CL =================
const wh = kodeSaja(baca('app/wheel.tsx'));
const tl = kodeSaja(baca('app/timeline.tsx'));
const helper = baca('lib/shareLeader.ts');
const hook = baca('hooks/useOwnerLeader.ts');
ok('Wheel & Timeline tidak lagi memakai ShareToLeaderSheet', !/ShareToLeaderSheet/.test(wh) && !/ShareToLeaderSheet/.test(tl));
ok('tombol share di header langsung menjalankan handleShare (bukan membuka sheet)',
  /icon="square\.and\.arrow\.up"\s*\n\s*onPress=\{handleShare\}/.test(wh) && /icon="square\.and\.arrow\.up"\s*\n\s*onPress=\{handleShare\}/.test(tl) &&
  !/setShareOpen/.test(wh) && !/setShareOpen/.test(tl));
ok('CL pemilik + catatan terakhir dibagikan lewat useOwnerLeader (hanya saat ada pemilik & PIN terbuka)',
  /useOwnerLeader\(owner, unlocked\)/.test(wh) && /useOwnerLeader\(owner, unlocked\)/.test(tl) &&
  /when: when && ownerId !== null/.test(hook) && /subscribeCoreLeaders\(uid, setLeaders\), subscribeShareLog\(uid, setLog\)/.test(hook));
ok('ada pemilik → shareDocToLeader (kind wheel/timeline, penerima = CL itu); tanpa pemilik → bagikan biasa',
  /ownerLeader\s*\n?\s*\? shareDocToLeader\(\{[\s\S]*?kind: 'wheel'/.test(wh) && /: shareWheelPdf\(data, year, q, pemilik\),/.test(wh) &&
  /ownerLeader\s*\n?\s*\? shareDocToLeader\(\{[\s\S]*?kind: 'timeline'/.test(tl) && /: shareTimelinePdf\(await muatSemua\(\), pemilik\),/.test(tl));
ok('urutan bersama: PDF (share sheet) → catat tanggal (abaikan gagal) → chat WA nomor CL-nya',
  /await share\(leader, lastSharedTo\(log, leader\.id, kind\)\);\s*\n\s*markSharedToLeader\(uid, leader\.id, kind, new Date\(\)\)\.catch\(\(\) => undefined\);\s*\n\s*if \(leader\.phone\) \{\s*\n\s*await openWhatsAppChat\(leader\.phone, sharePesanPengantar\(leader, doc\), onWaError\);/.test(helper));
ok('galat WA memakai WHATSAPP_ERROR bersama di kedua layar', /onWaError: \(\) => setError\(WHATSAPP_ERROR\)/.test(wh) && /onWaError: \(\) => setError\(WHATSAPP_ERROR\)/.test(tl));
const sheet = kodeSaja(baca('components/core/ShareToLeaderSheet.tsx'));
ok('sheet pilih CL tinggal untuk Rekap Visitasi, memakai helper yang sama, tanpa baris "bagikan biasa"',
  /shareDocToLeader\(\{/.test(sheet) && !/onSharePlain|Bagikan biasa/.test(sheet) &&
  /<ShareToLeaderSheet/.test(baca('app/core-recap.tsx')));

// ================= 2. Puasa: ✓ dan ✗ =================
const fd = kodeSaja(baca('app/fasting-days.tsx'));
const cross = baca('components/common/CrossButton.tsx');
ok('lib/fasting: hari punya jawaban tegas `failed` (opsional, catatan lama = belum dijawab)',
  /failed\?: boolean;/.test(baca('lib/fasting.ts')) && FA.EMPTY_FASTING_DAY.failed === undefined && FA.EMPTY_FASTING_DAY.done === false);
ok('tagihan malam berhenti begitu dijawab GAGAL juga (bukan cuma berhasil/catatan)',
  FA.fastingCheckDue([{ id: 'p', title: 't', prayer: '', rules: '', answer: '', startId: '2026-09-21', endId: '2026-09-27',
    days: { '2026-09-22': { prayer: '', answer: '', done: false, failed: true } } }], new Date(2026, 8, 22, 21, 0), '2026-09-22') === null &&
  FA.fastingCheckDue([{ id: 'p', title: 't', prayer: '', rules: '', answer: '', startId: '2026-09-21', endId: '2026-09-27',
    days: {} }], new Date(2026, 8, 22, 21, 0), '2026-09-22') !== null);
ok('kartu hari: ✓ (CheckCircle, tampil ✗ saat gagal) + tombol CrossButton di kanan, seperti Habits',
  /<CheckCircle checked=\{d\.done\} skipped=\{!!d\.failed\} size=\{26\} \/>/.test(fd) &&
  /<CrossButton on=\{!!d\.failed\} onPress=\{\(\) => toggleFailed\(dayId\)\} \/>/.test(fd));
ok('✓ dan ✗ saling meniadakan (berhasil melepas gagal, gagal melepas berhasil)',
  /saveDay\(dayId, \{ \.\.\.d, done: !d\.done, failed: false \}\)/.test(fd) && /saveDay\(dayId, \{ \.\.\.d, done: false, failed: !d\.failed \}\)/.test(fd));
ok('sheet hari: dua pilihan berdampingan "Berhasil" (CheckCircle) & "Gagal" (CrossMark), tanpa tulisan "❌ Gagal" saat belum dijawab',
  /setDraft\(\{ done: !draft\.done, failed: false \}\)/.test(fd) && /setDraft\(\{ done: false, failed: !draft\.failed \}\)/.test(fd) &&
  /<CrossMark on=\{!!draft\.failed\} \/>/.test(fd) && !/❌ Gagal/.test(fd) && />\s*Berhasil\s*</.test(fd) && />\s*Gagal\s*</.test(fd));
ok('simpan sheet ikut menulis failed', /done: draft\.done,\s*\n\s*failed: !!draft\.failed,/.test(fd));
ok('CrossButton = tombol ✗ bersama (42×42, aktif merah); Habits memakainya, gaya lamanya dibuang',
  /width: 42,\s*\n\s*height: 42,/.test(cross) && /backgroundColor: Color\.FINANCE_EXPENSE,\s*\n\s*borderColor: Color\.DANGER,/.test(cross) &&
  /haptic="warning"/.test(cross) && /export function CrossMark/.test(cross) &&
  /<CrossButton on=\{skipped\} onPress=\{\(\) => handleSkip\(habit\)\} \/>/.test(baca('components/habits/HabitsTab.tsx')) &&
  !/skipButton:|skipButtonOn:/.test(baca('components/habits/HabitsTab.tsx')));
ok('sheet: tidak ada Pressable bersarang (pilihan Gagal memakai CrossMark, bukan CrossButton)',
  !/<PressableScale[\s\S]{0,300}<CrossButton/.test(fd.slice(fd.indexOf('styles.doneRow'))));

// ================= 3. 💚 Bersyukur =================
ok('chip Bersyukur 💚, tidak kembar dengan ikon langkah Respond ❤️',
  /\{ key: 'grateful', emoji: '💚', label: 'Bersyukur' \}/.test(baca('lib/journey.ts')) && /emoji: '❤️'[^\n]*Respond|Respond[^\n]*❤️/.test(baca('lib/journey.ts')));

// ================= 4. Edit Puasa: simpan → kembali =================
const fz = kodeSaja(baca('app/fasting.tsx'));
ok('Simpan Perubahan (puasa yang sudah ada) → router.back(); puasa baru tetap di layar (jadi mode edit)',
  /const sudahAda = !!planId;/.test(fz) && /if \(sudahAda\) router\.back\(\);\s*\n\s*else setPlanId\(id\);/.test(fz));
ok('kembali hanya SESUDAH tersimpan (di dalam try, sebelum catch)',
  /await saveFastingPlan\([\s\S]*?\}\);\s*\n[\s\S]{0,400}if \(sudahAda\) router\.back\(\);[\s\S]{0,60}\} catch \{/.test(fz));

// ================= 5. Hasil lari: jam · menit · detik =================
const ex = kodeSaja(baca('components/fitness/ExerciseTab.tsx'));
ok('modal Hasil lari: tiga kolom Jam · Menit · Detik (number-pad, 2 digit) persis Race',
  /\['Jam', fJam, setFJam\],\s*\n\s*\['Menit', fMenit, setFMenit\],\s*\n\s*\['Detik', fDetik, setFDetik\],/.test(ex) &&
  /keyboardType="number-pad"/.test(ex) && /onChangeText=\{\(t\) => ubah\(t\.replace\(\/\[\^0-9\]\/g, ''\)\.slice\(0, 2\)\)\}/.test(ex) &&
  !/Waktu \(menit\), mis\. 32/.test(ex));
ok('tersimpan tetap sebagai menit desimal (toFinishSec ÷ 60) → catatan lama & pace tetap',
  /minutes: toFinishSec\(Number\(fJam\), Number\(fMenit\), Number\(fDetik\)\) \/ 60,/.test(ex) &&
  /fitPace\(run\.km, run\.minutes\)/.test(ex));
ok('membuka modal mengisi ulang ketiga kolom dari menit tersimpan (splitFinishSec)',
  /splitFinishSec\(Math\.round\(ada\.minutes \* 60\)\)/.test(ex) && /setFJam\(t\.h > 0 \? String\(t\.h\) : ''\)/.test(ex));
ok('kartu hasil menampilkan "32m 30d" (formatFinish), bukan "32,5 menit"',
  /formatFinish\(Math\.round\(run\.minutes \* 60\)\)/.test(ex) && !/formatDecimal\(run\.minutes\)/.test(ex));
ok('rumus Race yang dipakai: 0j 41m 30d → 41,5 menit; 41,5 menit → 41m 30d',
  FU.toFinishSec(0, 41, 30) / 60 === 41.5 && FU.formatFinish(Math.round(41.5 * 60)) === '41m 30d' &&
  JSON.stringify(FU.splitFinishSec(Math.round(41.5 * 60))) === JSON.stringify({ h: 0, m: 41, s: 30 }));

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
