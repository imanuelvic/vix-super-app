// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// 16 Sep 2026: CORE Calendar 📆 (visitasi + rapat bulanan, titik di tanggal,
// rincian saat tanggalnya di-click) & Visitation Recap 📊 (tabel setahun per CL
// per jenis). Tombol: 📊 & 📜 di samping "Jadwal Visitasi", 📆 di kanan atas
// header tab Visitation & Monthly.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-kalender-core');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Dijalankan sungguhan: lib/coreCalendar ============
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
Module._load = asli;

const ts = (y, m, d, h = 19) => ({ toDate: () => new Date(y, m - 1, d, h, 0) });
const visit = (id, kind, leaderIds, y, m, d, done, extra = {}) => ({
  id, kind, leaderIds, thanksgiving: false, date: ts(y, m, d), agenda: '', note: '', done,
  pdfSentDayId: null, ...extra,
});
const rapat = (id, y, m, d) => ({ id, title: 'Rapat ' + id, date: ts(y, m, d, 10), place: '', points: {}, photos: [] });

console.log('\n=== Petak kalender ===');
const sep = K.calendarCells(2026, 8); // September 2026: tanggal 1 = Selasa
ok('selalu 42 petak (6 baris × 7)', sep.length === 42);
ok('Senin dulu: September 2026 diawali Senin 31 Agustus (pinjaman, pudar)',
  sep[0].dayId === '2026-08-31' && !sep[0].inMonth && sep[1].dayId === '2026-09-01' && sep[1].inMonth);
ok('hari terakhir bulan masih inMonth, sesudahnya pinjaman Oktober',
  sep.find((c) => c.dayId === '2026-09-30').inMonth && sep[42 - 1].dayId === '2026-10-11' && !sep[41].inMonth);
const feb = K.calendarCells(2026, 1);
ok('Februari 2026 (1 Feb = Minggu) diawali Senin 26 Januari', feb[0].dayId === '2026-01-26' && feb[6].dayId === '2026-02-01');

console.log('\n=== Jadwal per hari ===');
const peta = K.coreEventsByDay(
  [visit('a', 'visitasi', ['L1'], 2026, 9, 18, false), visit('b', 'oneOnOne', ['L2'], 2026, 9, 18, false, { date: ts(2026, 9, 18, 9) })],
  [rapat('m1', 2026, 9, 18), rapat('m2', 2026, 9, 25)],
);
ok('tanggal berjadwal punya kunci; yang kosong tidak', peta.has('2026-09-18') && peta.has('2026-09-25') && !peta.has('2026-09-19'));
ok('satu hari: urut jam (09.00 one-on-one → 10.00 rapat → 19.00 visitasi), dua sumber tercampur',
  peta.get('2026-09-18').map((e) => e.kind + ':' + (e.visitation?.id ?? e.meeting.id)).join(',') === 'visitation:b,monthly:m1,visitation:a');

console.log('\n=== Rekap setahun ===');
const L = [
  { id: 'L1', name: 'Novia', heart: '💜' },
  { id: 'L2', name: 'Theo', heart: '🩵' },
  { id: 'L3', name: 'Geren', heart: '❤️' },
];
const V = [
  visit('1', 'visitasi', ['L1'], 2026, 2, 1, true),
  visit('2', 'visitasi', ['L1'], 2026, 5, 1, true),
  visit('3', 'oneOnOne', ['L1'], 2026, 6, 1, true),
  visit('4', 'gathering', ['L1'], 2026, 8, 5, true, { thanksgiving: true }), // Gathering + 🎉
  visit('5', 'thanksgiving', ['L2'], 2026, 9, 20, true),
  visit('6', 'coreGabungan', ['L1', 'L2', 'L3'], 2026, 7, 10, true), // gabungan → tiap CL
  visit('7', 'visitasi', ['L3'], 2026, 9, 23, false), // belum selesai
  visit('8', 'visitasi', ['L2'], 2025, 12, 20, true), // tahun lalu
  visit('9', 'visitasi', ['LX'], 2026, 3, 3, true), // CL sudah diarsipkan
];
const r = K.visitationRecap(V, L, 2026);
const baris = (kind) => r.rows.find((x) => x.kind === kind);
ok('satu baris per jenis, urutan MEETING_KINDS', r.rows.map((x) => x.kind).join(',') === C.MEETING_KINDS.map((k) => k.key).join(','));
ok('Novia: 2 visitasi, 1 one-on-one, 1 gathering, 1 gabungan = 5',
  baris('visitasi').counts[0] === 2 && baris('oneOnOne').counts[0] === 1 && baris('gathering').counts[0] === 1 &&
  baris('coreGabungan').counts[0] === 1 && r.totals[0] === 5);
ok('gabungan dihitung untuk TIAP CL yang ikut (Theo & Geren dapat 1 juga)',
  baris('coreGabungan').counts.join(',') === '1,1,1' && baris('coreGabungan').total === 3);
ok('Theo: thanksgiving 1 + gabungan 1 = 2; Geren: cuma gabungan = 1', r.totals[1] === 2 && r.totals[2] === 1);
ok('yang belum selesai TIDAK dihitung, tapi disebut sebagai jadwal menunggu', baris('visitasi').counts[2] === 0 && r.planned === 1);
ok('tahun lain & CL yang sudah diarsipkan tidak ikut', r.grand === 8 && baris('visitasi').total === 2);
ok('tanggal Thanksgiving: Novia 5 Agu (Gathering ber-🎉), Theo 20 Sep (jenis Thanksgiving), Geren belum',
  r.thanksgiving[0].getMonth() === 7 && r.thanksgiving[0].getDate() === 5 &&
  r.thanksgiving[1].getMonth() === 8 && r.thanksgiving[1].getDate() === 20 && r.thanksgiving[2] === null);
ok('tahun tanpa data → semua nol, tidak error', K.visitationRecap(V, L, 2024).grand === 0);

// ============ Statis: layar & tombol ============
console.log('\n=== Layar & tombol ===');
const kal = baca('app/core-calendar.tsx');
const rekap = baca('app/core-recap.tsx');
const core = baca('app/(tabs)/core.tsx');
const tab = baca('components/core/VisitationTab.tsx');
ok('kalender: titik di bawah tanggal (biru visitasi, emas rapat), maks 3',
  /jadwal\.slice\(0, 3\)\.map/.test(kal) && /dotVisit: \{ backgroundColor: Color\.CORE_DARK \}/.test(kal) &&
  /dotMonthly: \{ backgroundColor: Color\.ACCENT_DARK \}/.test(kal));
ok('kalender: hari ini lingkaran penuh, tanggal pilihan bercincin, pinjaman bulan sebelah pudar',
  /hariIni && styles\.dayToday/.test(kal) && /dipilih && !hariIni && styles\.daySelected/.test(kal) && /!c\.inMonth && styles\.dayOutside/.test(kal));
ok('kalender: click tanggal → rincian di bawah; kosong → teks kosong bersama',
  /onPress=\{\(\) => setSelectedId\(c\.dayId\)\}/.test(kal) && /perHari\.get\(selectedId\) \?\? \[\]/.test(kal) &&
  /<EmptyText>Tidak ada jadwal CORE di tanggal ini\.<\/EmptyText>/.test(kal));
ok('kalender: rincian visitasi memakai VisitationCardBody + VisitationStatus (bentuk yang sama dengan tab)',
  /<VisitationCardBody visitation=\{v\} leaders=\{leaders\} \/>/.test(kal) && /<VisitationStatus visitation=\{v\} tone=\{tone\} days=\{days\} \/>/.test(kal));
ok('kalender: click visitasi → CORE tab Visitation dengan ?edit=; rapat → /core/monthly/[id]',
  /params: \{ tab: 'visitation', edit: e\.visitation\.id \}/.test(kal) && /pathname: '\/core\/monthly\/\[id\]', params: \{ id: e\.meeting\.id \}/.test(kal));
ok('kalender: rapat bulanan ikut didengarkan (subscribeMonthlyMeetings) + ex-CL untuk nama lama',
  /subscribeMonthlyMeetings\(uid, setMeetings, fail\)/.test(kal) && /subscribeExLeaders\(uid, setExLeaders, fail\)/.test(kal));
ok('kalender: tanggal pilihan diurai lokal (dayIdToDate), bukan new Date("YYYY-MM-DD") yang geser zona',
  /formatShortDayDate\(dayIdToDate\(selectedId\)\)/.test(kal) && !/new Date\(selectedId\)/.test(kal));
ok('rekap: tabel jenis × CL (hati di kepala), Σ di kanan, Total di dasar, baris Thanksgiving berisi tanggal',
  /\{l\.heart\}/.test(rekap) && /Σ/.test(rekap) && /styles\.totalRow/.test(rekap) && /📅 (Tanggal|🎉)/.test(rekap) && // label dibuka 📅 (23 Sep 2026 dipendekkan jadi "📅 🎉")

  // 21 Sep 2026: "7 Agu" di atas, "26" di bawah (formatTinyDate, tahunnya dipindah ke baris kedua).
  /formatTinyDate\(d\)\.replace\(\/ \(\\d\+\)\$\/, '\\n\$1'\)/.test(rekap));
ok('rekap: navigasi tahun mentok 2026..tahun ini; nol dicetak "·" pudar',
  /const MIN_YEAR = 2026;/.test(rekap) && /disabled=\{year >= tahunIni\}/.test(rekap) && /n > 0 \? n : '·'/.test(rekap));
ok('rekap: kolom CL sempit (minWidth 48) supaya 8 CL + Σ muat di iPhone 15; lebih dari itu bisa digeser',
  /cell: \{ flex: 1, minWidth: 48/.test(rekap) && /<ScrollView horizontal/.test(rekap) && /tableScroll: \{ minWidth: '100%' \}/.test(rekap));
ok('header CORE: 📆 kalender di tab Visitation (bersama 🕘) & tab Monthly; 📜 tidak di header lagi',
  /tab === 'visitation' \? \(\s*\n\s*<View style=\{styles\.headerButtons\}>[\s\S]{0,400}emoji="📆"[\s\S]{0,200}emoji="🕘"/.test(core) &&
  /tab === 'monthly' \? \([\s\S]{0,200}emoji="📆"/.test(core) && !/emoji="📜"/.test(core));
ok('judul Jadwal Visitasi: 📊 rekap & 📜 rules di depan 💡 & 🎚️',
  /<EmojiButton emoji="📊" onPress=\{\(\) => router\.push\('\/core-recap'\)\} \/>\s*\n[\s\S]{0,300}<EmojiButton emoji="📜" onPress=\{\(\) => router\.push\('\/core-rules'\)\} \/>\s*\n[\s\S]{0,100}<EmojiButton emoji="💡"/.test(tab));
ok('rute terdaftar & bertema CORE',
  /<Stack\.Screen name="core-calendar" \/>/.test(baca('app/_layout.tsx')) && /<Stack\.Screen name="core-recap" \/>/.test(baca('app/_layout.tsx')) &&
  /'core-calendar': 'core',\s*\n\s*'core-recap': 'core',/.test(baca('lib/featureTheme.ts')));
ok('jarak kartu memakai CARD_GAP & paddingTop 4 (irama bersama)',
  [kal, rekap].every((s) => /marginBottom: CARD_GAP/.test(s) && /paddingTop: 4/.test(s)));
ok('tidak ada tanda pisah panjang di teks layar', ![kal, rekap].some((s) => /(['"`].*—.*['"`]|>[^<]*—[^<]*<)/.test(s.replace(/\/\/.*|\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, ''))));

console.log(gagal === 0 ? '\n✅ LULUS — kalender & rekap CORE beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
