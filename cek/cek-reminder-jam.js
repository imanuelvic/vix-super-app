// 2 Okt 2026: lima perubahan Reminder 🔔 yang disetujui pemilik app.
//   1. ⏰ jam pengingat per reminder → notifikasi HP tepat di jam itu
//   2. 📌 deadline dekat (Reminder Prioritas H-7) di atas daftar Daily
//   3. tombol tambah DIPATOK di kedua tab (dijaga juga oleh cek-patok.js)
//   4. kata "reminder" seragam di layar + angka di samping bulan diperbaiki
//   5. lib/tasks.ts: kolom opsional `note` & `carried`, rollover menaikkan
//      `carried` lewat increment(1)
// Bagian mesinnya (Today Engine → jadwal notifikasi) DIJALANKAN atas fixture,
// bukan cuma dibaca tulisannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-reminder-jam');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Kode tanpa komentar — supaya yang diuji yang benar-benar jalan. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/notify.ts'), path.join(ROOT, 'lib/today.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: (_, k) => (k === 'CHART_COLORS' ? [] : '#000000') }) };
  if (req === './firebase') return { db: {}, auth: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {}, unsubscribeAll: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req === './gemini' || req === './aiGuard') return new Proxy({}, { get: () => () => ({}) });
  if (req.startsWith('firebase/')) return new Proxy({}, { get: (_, k) => (k === 'Timestamp' ? { now: () => ({}) } : () => ({})) });
  if (req === '@react-native-async-storage/async-storage') return { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  if (req === 'expo-constants') return { __esModule: true, default: { executionEnvironment: 'bare' }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
  if (/^(expo-|react-native|@expo|react$)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const N = require(path.join(OUT, 'notify.js'));
const T = require(path.join(OUT, 'today.js'));
const K = require(path.join(OUT, 'tasks.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

const PAGI = new Date(2026, 9, 2, 7, 30);
const HARI = '2026-10-02';

const KOSONG = () => ({
  login: null, bibleReading: null, habits: [], day: null,
  fitDay: { done: {}, skipped: false, picks: [], runs: {} },
  fastingPlans: [], sermons: [], myReminders: [],
  intercession: { key: 'family', emoji: '👨‍👩‍👧', label: 'Keluarga', points: [] },
  intercessionDismissed: false, feedGenerated: false,
  leaders: [], mainTeam: [], weeklyFocus: CORE.EMPTY_WEEKLY_FOCUS,
  visitations: [], monthlyPrayers: CORE.EMPTY_MONTHLY_PRAYERS,
  tasks: [], otherTasks: [], roadmap: [], freelance: [],
  family: [], debts: [], checkups: [], profile: null,
  donor: { lastDonation: null, notes: '', schedules: [] },
  learningWeek: { skillKey: null, steps: {}, note: '' }, topicsDone: {},
  bills: [], futsal: { members: [], sessions: [], cash: [] },
  dataPlans: [], population: {}, carParts: {}, residenceChores: {},
  meterReadings: [], wheel: null, fun: { entries: [] },
  timeline: [],
  backup: { lastDayId: '', docCount: 0 }, finance: null,
});

const task = (id, dayId, time, over = {}) => ({
  id, title: `Reminder ${id}`, done: false, category: 'work', dayId, time, createdAt: null, ...over,
});

// =====================================================================
console.log('\n=== 1. Jam di lib/tasks.ts ===');
{
  const j = K.parseTaskTime('07:05');
  ok('"07:05" terbaca jam 7 menit 5', j && j.hour === 7 && j.minute === 5);
  ok('yang bukan jam sah ditolak (7:5 · 24:00 · 12:60 · kosong · null)',
    ['7:5', '24:00', '12:60', '', null, undefined].every((t) => K.parseTaskTime(t) === null));
  ok('roda jam → "HH:MM" yang disimpan', K.taskTimeOf(new Date(2026, 0, 1, 9, 3)) === '09:03');
  ok('tampilannya gaya jam Indonesia "09.03", kosong kalau tanpa jam',
    K.taskTimeLabel('09:03') === '09.03' && K.taskTimeLabel(null) === '');

  // Datang terbaru-dulu (urutan langganan): c dibuat paling akhir.
  const urut = K.orderDayTasks([
    task('c', HARI, null), task('b', HARI, '14:00'), task('a', HARI, null), task('d', HARI, '08:30'),
  ]).map((t) => t.id).join('');
  ok('satu hari: yang berjam dulu (urut jam), lalu tanpa jam urut dibuat', urut === 'dbac', urut);
}

// =====================================================================
console.log('\n=== 2. Today Engine: daftar reminder berjam ===');
{
  const input = KOSONG();
  input.tasks = [
    task('lusa', '2026-10-04', '19:00'),
    task('hari-ini', HARI, '09:03', { title: 'Telepon\n  dokter' }),
    task('tanpa-jam', HARI, null),
    task('selesai', HARI, '10:00', { done: true }),
    task('kemarin', '2026-10-01', '10:00'),
    task('h6', '2026-10-08', '06:00'),
    task('h7', '2026-10-09', '06:00'),
    task('pagi', HARI, '06:15'),
  ];
  const m = T.buildToday(input, PAGI, HARI);
  const ids = m.timed.map((t) => t.id).join(',');
  ok('cuma yang berjam, belum selesai, hari ini s.d. 6 hari ke depan, urut waktu',
    ids === 'pagi,hari-ini,lusa,h6', ids);
  const satu = m.timed.find((t) => t.id === 'hari-ini');
  ok('membawa tanggal, jam, emoji kategori, & tujuan click ke kategorinya',
    satu.dayId === HARI && satu.hour === 9 && satu.minute === 3 && satu.emoji === '💼' &&
    satu.href.pathname === '/tasks' && satu.href.params.category === 'work');

  const banyak = KOSONG();
  banyak.tasks = Array.from({ length: 30 }, (_, i) =>
    task(`t${i}`, HARI, `${String(Math.floor(i / 2) + 6).padStart(2, '0')}:${i % 2 ? '30' : '00'}`));
  const mb = T.buildToday(banyak, PAGI, HARI);
  ok(`dipangkas ke TIMED_MAX (${T.TIMED_MAX}) supaya batas 64 notifikasi iOS aman`,
    T.TIMED_MAX === 20 && mb.timed.length === 20 && mb.timed[0].id === 't0');

  const baris = m.today.find((i) => i.id === 'task-hari-ini');
  ok('baris Today reminder berjam menyebut jamnya', baris && baris.detail === '⏰ 09.03',
    baris && baris.detail);
  const tanpa = m.today.find((i) => i.id === 'task-tanpa-jam');
  ok('yang tanpa jam tidak diberi keterangan jam', tanpa && tanpa.detail === undefined);
}

// =====================================================================
console.log('\n=== 3. Jadwal notifikasi ===');
{
  const input = KOSONG();
  input.tasks = [task('hari-ini', HARI, '09:03', { title: 'Telepon\n  dokter' }), task('lusa', '2026-10-04', '19:00')];
  const s = N.buildSlots(T.buildToday(input, PAGI, HARI), null, { dayId: HARI });
  const r = s.filter((x) => x.group === 'reminder');
  ok('satu notifikasi per reminder berjam', r.length === 2 &&
    r.map((x) => x.id).join(',') === 'reminder-hari-ini,reminder-lusa');
  const a = r[0];
  ok('sekali jalan di tanggal & jamnya sendiri (bukan harian)',
    a.date === HARI && a.hour === 9 && a.minute === 3 && a.weekday === undefined);
  ok('judulnya jamnya, isinya reminder-nya dalam satu baris',
    a.title === '⏰ Reminder 09.03' && a.body === '💼 Telepon dokter', `${a.title} | ${a.body}`);
  ok('click → Reminder di kategori reminder itu', N.tujuanTeks(a.route) === '/tasks?category=work');
  const saat = N.saatSlot(a);
  ok('saatSlot = tanggal + jam lokalnya', saat && saat.getTime() === new Date(2026, 9, 2, 9, 3).getTime());
  ok('slot harian biasa tidak punya saat sekali-jalan', N.saatSlot(s.find((x) => x.id === 'journey')) === null);

  const kosong = N.buildSlots(T.buildToday(KOSONG(), PAGI, HARI), null, { dayId: HARI });
  ok('tanpa reminder berjam → tidak ada slot ⏰ sama sekali',
    kosong.every((x) => x.group !== 'reminder'));

  const g = N.NOTIFY_GROUPS.find((x) => x.key === 'reminder');
  ok('kelompok ⏰ terdaftar di layar Notification (bisa dimatikan sendiri)',
    g && g.emoji === '⏰' && g.when.length > 0 && g.opens.length > 0);

  const nf = kode('lib/notify.ts');
  ok('yang jamnya sudah lewat dilewati SEBELUM dijadwalkan (tanggal lampau ditolak sistem)',
    /const saat = saatSlot\(s\);\s*\n\s*if \(saat && saat\.getTime\(\) <= sekarang\) continue;/.test(nf));
  ok('sekali-jalan memakai pemicu DATE, sisanya tetap DAILY/WEEKLY',
    /trigger: saat\s*\n\s*\? \{ type: DATE, date: saat \}/.test(nf) &&
    /\{ type: DAILY, hour: s\.hour, minute: s\.minute \}/.test(nf));
  ok('tanggalnya ikut sidik jadwal (ganti tanggal = jadwal ditulis ulang)',
    /\$\{s\.id\}@\$\{s\.date \?\? s\.weekday \?\? '\*'\}/.test(nf));
}

// =====================================================================
console.log('\n=== 4. Layar Reminder ===');
{
  const t = kode('app/tasks.tsx');
  ok('sheet tambah/edit & sheet berulang sama-sama punya ⏰ Jam Pengingat',
    (t.match(/<ReminderTimeField/g) || []).length === 2);
  ok('jam disimpan "HH:MM" atau null (tanpa jam)',
    /const time = fTimeOn \? taskTimeOf\(fTime\) : null;/.test(t) &&
    /rTimeOn \? taskTimeOf\(rTime\) : null/.test(t));
  ok('📝 kotak catatan di sheet & catatannya tampil di baris',
    /placeholder="Catatan \(opsional\)"/.test(t) && /\{item\.note\}/.test(t));
  ok('jamnya tampil di baris reminder', /⏰ \{jam\}/.test(t));
  ok('urutan satu hari memakai orderDayTasks', /orderDayTasks\(shown\.filter/.test(t));

  ok('📌 Deadline Dekat memakai aturan H-7 & P1 efektif yang sama dengan tab Priority',
    /effectiveOtherTask\(t, now\)/.test(t) && /otherTaskDaysUntil\(t, now\)/.test(t) &&
    /x\.days <= OTHER_REMINDER_DAYS/.test(t) && /📌 Deadline Dekat/.test(t));
  ok('section itu cuma di bulan berjalan & ikut kategori yang dibuka',
    /atMinMonth && deadlineSoon\.length > 0/.test(t) &&
    /\(t\.category \?\? 'personal'\) === category/.test(t));

  ok('angka di samping bulan = belum selesai di bulan yang TAMPIL, mulai hari ini',
    /t\.dayId\.startsWith\(monthPrefix\) && t\.dayId >= todayId/.test(t) &&
    /\{remaining\} belum selesai/.test(t) && !/task tercatat/.test(t));
  ok('kata yang terbaca di layar: reminder, bukan task',
    !/Cari task|Hapus task ini|Isi task-nya|Tidak ada task|Maksimal \$\{MAX_RECURRING\} task|task lama|loadErrorOf\('task'\)/.test(t));
  ok('"Tambah hari ini" keluar dari speed-dial (tombolnya sudah dipatok)',
    !/Tambah hari ini/.test(t) && /const FAB_ACTIONS = 2;/.test(t));
  ok('drag & drop tetap utuh (pemilik app memilih mempertahankannya)',
    /DraggableTaskRow/.test(t) && /catRefs\.current\[c\.key\] = r;/.test(t) && /measureTargets/.test(t));
}

// =====================================================================
console.log('\n=== 5. lib/tasks.ts ===');
{
  const k = kode('lib/tasks.ts');
  ok('rollover menaikkan `carried` di server (increment, tanpa baca dulu)',
    /dayId: todayId,\s*\n\s*carried: increment\(1\),/.test(k));
  ok('task baru menyimpan catatan & jam', /note: data\.note\.trim\(\),\s*\n\s*time: data\.time,/.test(k));
  ok('reminder berulang ikut membawa jamnya', /note: '',\s*\n\s*time,/.test(k));
  ok('kolomnya opsional: data lama tanpa note/time/carried tetap sah',
    /note\?: string;/.test(k) && /time\?: string \| null;/.test(k) && /carried\?: number;/.test(k));
}

// =====================================================================
console.log('\n=== 6. Riwayat versi ===');
{
  const log = baca('lib/changelog.ts');
  ok('perubahannya tercatat di entri paling atas lib/changelog.ts',
    /'⏰ Reminder bisa diberi jam, HP berbunyi tepat di jam itu'/.test(log) &&
    log.indexOf('⏰ Reminder bisa diberi jam') < log.indexOf("version: '2.0.0'"));
}

console.log(gagal === 0 ? '\n✅ LULUS — reminder berjam & rapihnya Reminder terjaga.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
