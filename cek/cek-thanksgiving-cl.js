// 21 Sep 2026: (1) lambang ▾/▴/→ kartu Doa Syafaat pindah ke pojok kanan
// bawah, di bawah ✕ (ReminderCard `corner`); (2) tanggal Thanksgiving CORE
// diisi di data CL (thanksgivingDayId), tampil "d mmm yy" di baris 🎉 Rekap
// Visitasi & PDF rekap; (3) Fellowship CORE Gabungan 🫂, tidak lagi kembar
// dengan Fellowship CORE 👥; (4) kolom Σ dipisah garis tegak.
// 22 Sep 2026: isian CL tampil TAHUN APA PUN (tanggal milik CORE-nya, bukan
// hitungan per tahun); baris tabelnya "📅 Tanggal" (🎉 kembar dengan baris
// jenis Thanksgiving); modal CL memakai format utuh seperti tanggal lahir.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-thanksgiving-cl');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Dijalankan sungguhan: coreCalendar + format + core ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/coreCalendar.ts'), path.join(ROOT, 'lib/core.ts'),
      path.join(ROOT, 'lib/format.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const K = require(path.join(OUT, 'coreCalendar.js'));
const C = require(path.join(OUT, 'core.js'));
const F = require(path.join(OUT, 'format.js'));
Module._load = asli;

const ts = (y, m, d, h = 19) => ({ toDate: () => new Date(y, m - 1, d, h, 0), toMillis: () => new Date(y, m - 1, d, h, 0).getTime() });
const visit = (id, kind, leaderIds, y, m, d, done, extra = {}) => ({
  id, kind, leaderIds, thanksgiving: false, date: ts(y, m, d), agenda: '', note: '', done,
  pdfSentDayId: null, ...extra,
});
const cl = (id, thanksgivingDayId) => ({
  id, name: 'CL ' + id, heart: '💚', birthYear: 2000, birthMonth: 0, birthDay: 1, phone: '812',
  lastFollowupDayId: null, ...(thanksgivingDayId === undefined ? {} : { thanksgivingDayId }),
});

console.log('\n=== formatTinyDate: "d mmm yy" ===');
ok('7 Agu 26', F.formatTinyDate(new Date(2026, 7, 7)) === '7 Agu 26', F.formatTinyDate(new Date(2026, 7, 7)));
ok('17 Des 27', F.formatTinyDate(new Date(2027, 11, 17)) === '17 Des 27');
ok('formatCompactDate & formatGreetingDate tidak berubah bentuknya',
  F.formatCompactDate(new Date(2026, 7, 7)) === 'Jum, 7 Agu 26' && F.formatGreetingDate(new Date(2026, 7, 7)) === 'Jumat, 7 Agu 26',
  F.formatCompactDate(new Date(2026, 7, 7)) + ' | ' + F.formatGreetingDate(new Date(2026, 7, 7)));

console.log('\n=== Lambang jenis pertemuan ===');
const ikon = C.MEETING_KINDS.map((k) => k.icon);
ok('tidak ada dua jenis dengan lambang yang sama', new Set(ikon).size === ikon.length, ikon.join(' '));
ok('Fellowship CORE 👥, Fellowship CORE Gabungan 🫂',
  C.meetingKindMeta('fellowship').icon === '👥' && C.meetingKindMeta('fellowshipGabungan').icon === '🫂');

console.log('\n=== visitationRecap: baris Thanksgiving dari data CL ===');
const L = [cl('a', '2026-08-07'), cl('b', null), cl('c', '2025-03-01'), cl('d')];
const V = [
  visit('v1', 'visitasi', ['a'], 2026, 5, 10, true, { thanksgiving: true }), // penanda, tapi CL a sudah mengisi tanggalnya
  visit('v2', 'thanksgiving', ['b'], 2026, 9, 12, true),
  visit('v3', 'thanksgiving', ['c'], 2026, 10, 3, true),
];
const r = K.visitationRecap(V, L, 2026);
const tgl = (d) => (d ? F.dayId(d) : null);
ok('CL yang mengisi tanggalnya → tanggal ISIAN yang tampil (menang atas visitasi ber-penanda 🎉)',
  tgl(r.thanksgiving[0]) === '2026-08-07', tgl(r.thanksgiving[0]));
ok('CL tanpa isian → cadangan: visitasi Thanksgiving tahun itu', tgl(r.thanksgiving[1]) === '2026-09-12');
ok('isian tahun LAIN tetap tampil (22 Sep 2026: tanggal CORE-nya, bukan per tahun)',
  tgl(r.thanksgiving[2]) === '2025-03-01', tgl(r.thanksgiving[2]));
ok('Σ baris tanggal menghitung yang berisi: a, b (cadangan), c = 3',
  r.thanksgiving.filter(Boolean).length === 3);
ok('CL data lama tanpa field → null, tidak error', r.thanksgiving[3] === null);
ok('hitungan jenis tidak terpengaruh (visitasi ber-penanda tetap masuk jenis aslinya)',
  r.rows.find((x) => x.kind === 'visitasi').counts[0] === 1 && r.rows.find((x) => x.kind === 'thanksgiving').counts[1] === 1);
ok('tahun 2025: isian CL c muncul walau tak ada visitasi', tgl(K.visitationRecap(V, L, 2025).thanksgiving[2]) === '2025-03-01');

console.log('\n=== leaderRecap (PDF satu CORE) ===');
ok('parameter ke-4 thanksgivingDayId menang; tanpa itu tetap dari visitasi',
  tgl(K.leaderRecap(V, 'a', 2026, '2026-08-07').thanksgiving) === '2026-08-07' &&
  tgl(K.leaderRecap(V, 'a', 2026).thanksgiving) === '2026-05-10');
ok('PDF: isian tahun lain juga tampil apa adanya', tgl(K.leaderRecap(V, 'c', 2026, '2025-03-01').thanksgiving) === '2025-03-01');
ok('tanpa isian & tanpa visitasi 🎉 tahun itu → null', K.leaderRecap(V, 'c', 2024).thanksgiving === null);
ok('recapPdf mengoper thanksgivingDayId CL-nya',
  /leaderRecap\(visitations, leader\.id, year, leader\.thanksgivingDayId \?\? null\)/.test(baca('lib/recapPdf.ts')));

console.log('\n=== Form CL (LeadersTab) ===');
const lt = baca('components/core/LeadersTab.tsx');
ok('state fThanksgiving: Date | null; reset null saat tambah; terisi dari dayIdToDate saat ubah',
  /const \[fThanksgiving, setFThanksgiving\] = useState<Date \| null>\(null\);/.test(lt) &&
  /setFPhone\(''\);\s*\n\s*setFThanksgiving\(null\);/.test(lt) &&
  /setFThanksgiving\(l\.thanksgivingDayId \? dayIdToDate\(l\.thanksgivingDayId\) : null\);/.test(lt));
ok('DateField "🎉 Tanggal Thanksgiving" boleh kosong (placeholder), sesudah 📱 No. HP',
  /🎉 Tanggal Thanksgiving/.test(lt) &&
  /<DateField\s+key=\{`tg-\$\{editing === 'new' \? 'new' : editing\?\.id\}`\}\s+value=\{fThanksgiving\}\s+onChange=\{setFThanksgiving\}\s+placeholder="Belum ditentukan"/.test(lt) &&
  lt.indexOf('🎉 Tanggal Thanksgiving') > lt.indexOf('📱 No. HP\n') && lt.indexOf('🎉 Tanggal Thanksgiving') < lt.indexOf('<GenderField'));
ok('disimpan sebagai dayId "YYYY-MM-DD" (null kalau kosong)',
  /thanksgivingDayId: fThanksgiving \? dayId\(fThanksgiving\) : null,/.test(lt));
ok('modal baca-saja: baris 🎉 Thanksgiving CORE format utuh seperti tanggal lahir (formatDate), hanya untuk CL yang mengisinya',
  /'thanksgivingDayId' in person && person\.thanksgivingDayId \? \(\s*<InfoRow\s+label="🎉 Thanksgiving CORE"\s+value=\{formatDate\(dayIdToDate\(person\.thanksgivingDayId\)\)\}/.test(lt) &&
  !/formatTinyDate/.test(lt) && F.formatDate(new Date(2025, 0, 8)) === '8 Januari 2025');
ok('tanggal lahir di modal memang format yang sama: "d Bulan yyyy · n th"',
  /value=\{`\$\{person\.birthDay\} \$\{MONTH_NAMES\[person\.birthMonth\]\} \$\{person\.birthYear\} · \$\{currentAge\(person, today\)\} th`\}/.test(lt));
ok('tipe CoreLeader punya thanksgivingDayId?: string | null', /thanksgivingDayId\?: string \| null;/.test(baca('lib/core.ts')));

console.log('\n=== Tabel Rekap Visitasi ===');
const rk = baca('app/core-recap.tsx');
// 23 Sep 2026: label kolomnya dipendekkan pemiliknya sendiri jadi "📅 🎉"
// (kolom labelnya sempit, dua baris). Yang dijaga tetap sama: barisnya DIBUKA
// lambang tanggal 📅, jadi tidak tertukar dengan baris jenis Thanksgiving di
// bawahnya yang lambangnya 🎉 saja.
ok('baris tanggal Thanksgiving dibuka lambang 📅, bukan 🎉 saja',
  /📅 (Tanggal|🎉)\s*\n\s*<\/VixText>/.test(rk) && !/🎉 Thanksgiving/.test(rk) &&
  !/^\s*🎉\s*$/m.test(rk.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')));
ok('PDF rekap: baris "📅 Tanggal Thanksgiving"; 1× hanya kalau tanggalnya tahun rekap; chip ikut tahun kalau tahun lain',
  /📅 Tanggal Thanksgiving/.test(baca('lib/recapPdf.ts')) && !/🎉 Tanggal Thanksgiving/.test(baca('lib/recapPdf.ts')) &&
  /r\.thanksgiving \? \(r\.thanksgiving\.getFullYear\(\) === year \? '1×' : ''\) : '·'/.test(baca('lib/recapPdf.ts')) &&
  /return d\.getFullYear\(\) === year \? tanggalPendek\(d\) : formatTinyDate\(d\);/.test(baca('lib/recapPdf.ts')) &&
  /value: r\.thanksgiving \? tanggalSyukur\(r\.thanksgiving, year\) : '',/.test(baca('lib/recapPdf.ts')));
ok('sel Thanksgiving: "7 Agu" di atas, "26" di bawah (formatTinyDate)',
  /formatTinyDate\(d\)\.replace\(\/ \(\\d\+\)\$\/, '\\n\$1'\)/.test(rk) && !/monthShort/.test(rk));
ok('kolom tanggal minWidth 40 supaya "17 Agu" tidak pecah tiga baris',
  /cellDate: \{ fontSize: 11, lineHeight: 14, minWidth: 40 \}/.test(rk));
ok('garis tegak <SumLine /> tepat sebelum SETIAP sel Σ (kepala, Thanksgiving, tiap jenis, Total)',
  (rk.match(/<SumLine \/>\s*\n\s*<VixText[\s\S]{0,200}?styles\.sumCol/g) ?? []).length === 4 &&
  (rk.match(/<SumLine \/>/g) ?? []).length === 4 &&
  (rk.match(/styles\.sumCol/g) ?? []).length === 4);
ok('gaya garisnya: 1.5 CORE_DARK (seperti garis Total), menembus padding baris (margin -8) supaya bersambung',
  /sumLine: \{\s*width: 1\.5,\s*alignSelf: 'stretch',\s*marginVertical: -8,\s*marginLeft: 4,\s*backgroundColor: Color\.CORE_DARK,\s*\}/.test(rk) &&
  /paddingVertical: 8,/.test(rk));

console.log('\n=== Kartu Doa Syafaat: lambang di pojok kanan bawah ===');
const card = baca('components/common/ReminderCard.tsx');
const home = baca('app/(tabs)/index.tsx');
ok('ReminderCard punya prop corner?: string', /corner\?: string;/.test(card) && /\n  corner,\n/.test(card));
ok('badan = kolom teks (flex 1, gap 3) + lambang rata bawah; dipakai di KETIGA mode kartu',
  /const badan = corner \? \(\s*<View style=\{styles\.bodyRow\}>\s*<View style=\{styles\.bodyMain\}>\s*\{judul\}\s*\{isi\}\s*<\/View>\s*<VixText heading="bold" additionalStyle=\{\[styles\.title, styles\.corner\]\}>\s*\{corner\}/.test(card) &&
  /bodyRow: \{ flexDirection: 'row', alignItems: 'flex-end' \}/.test(card) &&
  /bodyMain: \{ flex: 1, gap: 3 \}/.test(card) &&
  (card.match(/\{badan\}/g) ?? []).length === 3 && !/\{judul\}\s*\{isi\}\s*\{tutup\}/.test(card));
ok('lambang segaris di bawah ✕: lebar 24, margin kanan -4 (✕ right 12 di dalam padding 16)',
  /corner: \{ width: 24, textAlign: 'center', marginRight: -4 \}/.test(card) &&
  /closeButton: \{\s*position: 'absolute',\s*top: 10,\s*right: 12,\s*width: 24,/.test(card) &&
  /paddingHorizontal: 16,/.test(card));
// 22 Sep 2026: kartu Doa Syafaat Home → baris di hero With God; lambang
// buka/tutupnya ikon chevron di ujung baris (bukan corner ReminderCard).
ok('Today: baris syafaat "🙏 Syafaat: <emoji> <label>", chevron naik/turun di ujung baris',
  /title: `Syafaat: \$\{input\.intercession\.emoji\} \$\{input\.intercession\.label\}`,/.test(BACA_TODAY('lib/today.ts')) &&
  /name=\{terbuka \? 'chevron\.up' : 'chevron\.right'\}/.test(BACA_TODAY('components/today/GodHero.tsx')));

console.log('\n=== Istilah ===');
for (const f of ['components/common/ReminderCard.tsx', 'app/core-recap.tsx', 'lib/coreCalendar.ts', 'lib/format.ts']) {
  const s = baca(f);
  ok(`${f}: tanpa tekan/ketuk/tap/klik`, !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(s.replace(/Gesture\.Tap\(\)/g, '')));
}

console.log(gagal === 0 ? '\n✅ LULUS — Thanksgiving CL, 🫂, garis Σ, & lambang pojok kartu beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
