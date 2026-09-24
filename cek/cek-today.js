// 22 Sep 2026 (versi 2.0 "Today OS"): Today Engine dijalankan SUNGGUHAN atas
// fixture — kosong, tanpa pengingat, banyak pengingat (dipangkas ke 7),
// terlewat, prioritas CORE / Work / rohani, tugas per kategori, data lama —
// plus indeks pencarian fitur & bentuk layar Today / navigasi baru.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-today');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Kompilasi lib/today.ts (+ semua yang diimpornya) ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/today.ts'), path.join(ROOT, 'lib/featureIndex.ts'), '--ignoreConfig',
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
  if (/^(expo-|react-native|@expo|react$)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const T = require(path.join(OUT, 'today.js'));
const FI = require(path.join(OUT, 'featureIndex.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

const ts = (y, m, d, h = 19, mi = 0) => {
  const dt = new Date(y, m - 1, d, h, mi);
  return { toDate: () => dt, toMillis: () => dt.getTime() };
};
const dayId = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Hari uji: Selasa 22 Sep 2026 (hari Doa Rantai), jam 07.30 & 20.30.
const PAGI = new Date(2026, 8, 22, 7, 30);
const MALAM = new Date(2026, 8, 22, 20, 30);
const HARI = '2026-09-22';

const TOPIC = { key: 'world', emoji: '🌏', label: 'Dunia', points: ['Dunia, damai'] };
const KOSONG = () => ({
  login: null,
  bibleReading: null,
  habits: [],
  day: null,
  fitDay: { done: {}, skipped: false, picks: [], runs: {} },
  fastingPlans: [],
  sermons: [],
  myReminders: [],
  intercession: { key: 'family', emoji: '👨‍👩‍👧', label: 'Keluarga', points: ['Papa', 'Mama'] },
  intercessionDismissed: false,
  feedGenerated: false,
  leaders: [],
  mainTeam: [],
  greets: {},
  weeklyFocus: CORE.EMPTY_WEEKLY_FOCUS,
  visitations: [],
  monthlyPrayers: CORE.EMPTY_MONTHLY_PRAYERS,
  tasks: [],
  otherTasks: [],
  roadmap: [],
  freelance: [],
  family: [],
  debts: [],
  checkups: [],
  profile: null,
  donor: { lastDonation: null, notes: '', schedules: [] },
  learningWeek: { skillKey: null, steps: {}, note: '' },
  topicsDone: {},
  bills: [],
  futsal: { members: [], sessions: [], cash: [] },
  dataPlans: [],
  population: {},
  carParts: {},
  residenceChores: {},
  meterReadings: [],
  wheel: null,
  fun: { entries: [] },
  finance: null,
});

console.log('\n=== 1. Kosong: tenang, bukan penuh ===');
{
  const m = T.buildToday(KOSONG(), PAGI, HARI);
  ok('data belum tiba (login undefined) → hero loading', T.buildToday({ ...KOSONG(), login: undefined }, PAGI, HARI).god.state === 'loading');
  ok('belum journey & masih pagi → undangan (invite)', m.god.state === 'invite');
  // Tanpa catatan apa pun, aturan harian tetap hidup (pilih olahraga, langkah
  // belajar hari ini, catat meteran) — semuanya Life; CORE & Work tenang.
  ok('CORE & Work tenang (tak ada barisnya); yang ada cuma aturan harian Life', m.today.every((i) => i.section === 'life') && m.today.length <= T.TODAY_MAX, m.today.map((i) => i.id).join(','));
  ok('yang tak untuk hari ini turun: topik minggu ini → up next; populasi (tgl 22) & fun → later',
    m.upNext.some((i) => i.id === 'learning-topics') && m.later.some((i) => i.id === 'population') && m.later.some((i) => i.id === 'fun'));
  ok('syafaat selalu ada sebagai baris With God', m.god.lines.some((l) => l.id === 'intercession'));
  ok('refleksi: jurnal tidak ada di daftar kebiasaan → available false', m.reflection.available === false);
  ok('streak 0 tanpa login', m.god.streak === 0);
}

console.log('\n=== 2. Keadaan With God ===');
{
  const sudah = { ...KOSONG(), login: { count: 12, lastDayId: HARI, best: 30, total: 100 } };
  ok('sudah journey hari ini → done + streak 12', T.buildToday(sudah, PAGI, HARI).god.state === 'done' && T.buildToday(sudah, PAGI, HARI).god.streak === 12);
  const belum = { ...KOSONG(), login: { count: 3, lastDayId: '2026-09-21', best: 5, total: 9 } };
  ok('belum & jam 07.30 → invite', T.buildToday(belum, PAGI, HARI).god.state === 'invite');
  ok('belum & jam 20.30 → late (tetap bisa dijalani)', T.buildToday(belum, MALAM, HARI).god.state === 'late');
  const baca = { ...belum, bibleReading: { morning: '', daytime: '', night: '' } };
  const pagi = T.buildToday(baca, PAGI, HARI).god.lines.find((l) => l.id === 'bible-morning');
  ok('jendela pagi & belum baca → baris bacaan pagi menuju Habits ?focus=bible-morning',
    pagi && pagi.done === false && pagi.href.pathname === '/habits' && pagi.href.params.focus === 'bible-morning');
  const sudahBaca = T.buildToday({ ...baca, bibleReading: { morning: 'Mazmur 1', daytime: '', night: '' } }, PAGI, HARI).god.lines.find((l) => l.id === 'bible-morning');
  ok('sudah baca → barisnya ✓ (done), bukan hilang', sudahBaca && sudahBaca.done === true);
  ok('jam 20.30 (di luar jendela) → tak ada baris bacaan', !T.buildToday(baca, MALAM, HARI).god.lines.some((l) => l.id.startsWith('bible-')));
  // 23 Sep 2026: syafaat jadi bagian keempat Night Prayer, jadi barisnya
  // menuju ke sana, bukan lagi ke layar lain per topik.
  const syafaat = T.buildToday({ ...belum, intercession: TOPIC }, PAGI, HARI).god.lines.find((l) => l.id === 'intercession');
  ok('siang → baris syafaat menuju Night Prayer', syafaat.href.pathname === '/night-prayer');
  ok('syafaat ditutup hari ini → done', T.buildToday({ ...belum, intercessionDismissed: true }, PAGI, HARI).god.lines.find((l) => l.id === 'intercession').done === true);
}

console.log('\n=== 3. Prioritas CORE: bertenggat hari ini ===');
{
  const cl = { id: 'a', name: 'Novia', heart: '💜', birthYear: 2000, birthMonth: 8, birthDay: 22, phone: '812', lastFollowupDayId: null };
  const visit = { id: 'v1', kind: 'visitasi', leaderIds: ['a'], thanksgiving: false, date: ts(2026, 9, 22, 19), agenda: '', note: '', done: false, pdfSentDayId: null };
  const besok = { ...visit, id: 'v2', date: ts(2026, 9, 24, 19) };
  const h3 = { ...visit, id: 'v3', date: ts(2026, 9, 25, 19) }; // H-3: panduannya ditagih hari ini
  const m = T.buildToday({ ...KOSONG(), login: null, leaders: [cl], visitations: [visit, besok, h3] }, PAGI, HARI);
  const hariH = m.today.find((i) => i.id === 'visit-v1');
  ok('visitasi HARI INI → today, bagian CORE, menuju ?edit=', hariH && hariH.section === 'core' && hariH.href.params.edit === 'v1');
  ok('visitasi 2 hari lagi → up next', m.upNext.some((i) => i.id === 'visit-v2'));
  ok('panduan H-3 (needsPdfShare) → baris "Kirim panduan" today, rank 2', m.today.find((i) => i.id === 'pdf-v3')?.rank === 2);
  ok('visitasi H-3 sendiri → up next (bukan today)', m.upNext.some((i) => i.id === 'visit-v3'));
  ok('ulang tahun CL HARI INI → today rank 2', m.today.find((i) => i.id === 'bday-core-a')?.rank === 2);
  ok('follow up giliran minggu ini → today (sepanjang hari, tanpa jendela jam)',
    m.today.some((i) => i.id === 'followup') && T.buildToday({ ...KOSONG(), leaders: [cl] }, MALAM, HARI).today.some((i) => i.id === 'followup'));
}

console.log('\n=== 4. Prioritas Work & tugas per kategori ===');
{
  const roadmap = [{ id: 'r1', title: 'Rilis fitur X', note: '', priority: 2, status: 'doing', deadline: ts(2026, 9, 23, 9) }];
  const freelance = [{ id: 'f1', name: 'Web Toko', client: 'Budi', requirement: '', fee: 0, deadline: ts(2026, 9, 28, 9), done: false }];
  const tasks = [
    { id: 't1', title: 'Deploy', done: false, category: 'work', dayId: HARI, createdAt: null },
    { id: 't2', title: 'Telepon CL', done: false, category: 'ministry', dayId: HARI, createdAt: null },
    { id: 't3', title: 'Beli sabun', done: false, category: 'personal', dayId: HARI, createdAt: null },
    { id: 't4', title: 'Kemarin', done: false, category: 'work', dayId: '2026-09-21', createdAt: null },
    { id: 't5', title: 'Selesai', done: true, category: 'work', dayId: HARI, createdAt: null },
  ];
  const m = T.buildToday({ ...KOSONG(), roadmap, freelance, tasks }, PAGI, HARI);
  ok('roadmap tenggat besok → Work today', m.today.find((i) => i.id === 'ft-r1')?.section === 'work');
  ok('freelance 6 hari lagi → up next (H-7 tapi > 3 hari)', m.upNext.some((i) => i.id === 'fl-f1'));
  ok('task WORK hari ini → bagian Work; MINISTRY → CORE; PERSONAL → Life',
    m.today.find((i) => i.id === 'task-t1')?.section === 'work' &&
    m.today.find((i) => i.id === 'task-t2')?.section === 'core' &&
    m.today.find((i) => i.id === 'task-t3')?.section === 'life');
  ok('task hari lain & yang sudah selesai tidak ikut', !m.today.some((i) => i.id === 'task-t4' || i.id === 'task-t5'));
  ok('sectionOfTaskCategory: data lama tanpa kategori → life', T.sectionOfTaskCategory(undefined) === 'life');
}

console.log('\n=== 5. Terlewat & Life ===');
{
  const debts = [{ id: 'd1', direction: 'mine', person: 'Andi', amount: 500000, dueDate: ts(2026, 9, 20, 9), payments: [], note: '', createdAt: null }];
  const parts = { 'oli-mesin': { last: undefined, dueNow: true } };
  const m = T.buildToday({ ...KOSONG(), debts, carParts: parts, day: { done: {}, skipped: {}, water: 2, notes: {} } }, MALAM, HARI);
  ok('pinjaman LEWAT jatuh tempo → today rank 2 (time-sensitive)', m.today.find((i) => i.id === 'debt-d1')?.rank === 2);
  ok('perawatan mobil hari-H/lewat → today; menuju Car › Parts', m.today.find((i) => i.id === 'car-oli-mesin')?.href.params.tab === 'parts');
  ok('malam & air 2/8 → baris air today', m.today.some((i) => i.id === 'water'));
  ok('pagi & air 2/8 → belum ditagih', !T.buildToday({ ...KOSONG(), day: { done: {}, skipped: {}, water: 2, notes: {} } }, PAGI, HARI).today.some((i) => i.id === 'water'));
  const fin = { emoji: '🟡', level: 'watch', lines: ['Food mendekati batas.'] };
  ok('finance watch → baris Life', T.buildToday({ ...KOSONG(), finance: fin }, PAGI, HARI).today.find((i) => i.id === 'finance')?.section === 'life');
  ok('finance on-track tanpa catatan → diam', !T.buildToday({ ...KOSONG(), finance: { emoji: '🟢', level: 'on-track', lines: ['Semua sesuai rencana.'] } }, PAGI, HARI).today.some((i) => i.id === 'finance'));
  ok('finance on-track + catatan malam 📝 → tetap disebut', T.buildToday({ ...KOSONG(), finance: { emoji: '🟢', level: 'on-track', lines: ['ok', '📝 Belum ada transaksi tercatat hari ini.'] } }, MALAM, HARI).today.some((i) => i.id === 'finance'));
}

console.log('\n=== 6. Banyak pengingat → dipangkas ke 7, sisanya up next ===');
{
  const banyak = KOSONG();
  banyak.tasks = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: `Tugas ${i}`, done: false, category: 'personal', dayId: HARI, createdAt: null }));
  banyak.debts = [{ id: 'd1', direction: 'mine', person: 'Andi', amount: 1, dueDate: ts(2026, 9, 22, 9), payments: [], note: '', createdAt: null }];
  banyak.leaders = [{ id: 'a', name: 'Novia', heart: '💜', birthYear: 2000, birthMonth: 0, birthDay: 1, phone: '812', lastFollowupDayId: null }];
  const m = T.buildToday(banyak, PAGI, HARI);
  ok(`today maksimal ${T.TODAY_MAX} baris`, m.today.length === T.TODAY_MAX, `${m.today.length}`);
  ok('yang terpangkas turun ke up next, tidak hilang', m.upNext.length >= 12 + 2 - T.TODAY_MAX);
  ok('yang dipertahankan = rank terkecil dulu: 7 baris rank 2, follow up (rank 3) turun ke up next',
    m.today.every((i) => i.rank === 2) && m.upNext.some((i) => i.id === 'followup'));
  ok('urutan today: CORE dulu, lalu Work, lalu Life', (() => {
    const urut = m.today.map((i) => ({ god: 0, core: 1, work: 2, life: 3 })[i.section]);
    return urut.every((v, i) => i === 0 || v >= urut[i - 1]);
  })());
  ok('tanpa AI & tanpa acak: dua kali hitung hasilnya identik',
    JSON.stringify(T.buildToday(banyak, PAGI, HARI)) === JSON.stringify(m));
}

console.log('\n=== 7. Refleksi & data lama ===');
{
  const jurnal = { id: 'j1', label: '📓 Daily Reflection Journal', slot: 'morning', note: true, notePrompt: 'x' };
  const habits = [jurnal];
  const isReflection = CORE && true;
  const day = { done: {}, skipped: {}, water: 0, notes: { j1: 'Hari ini aku belajar sabar menunggu jawaban.' } };
  const m = T.buildToday({ ...KOSONG(), habits, day }, MALAM, HARI);
  ok('jurnal ada → available; tulisannya ikut; malam → emphasis', isReflection && m.reflection.available === true && m.reflection.text.length > 10 && m.reflection.emphasis === true);
  ok('belum feed → showGenerate', m.reflection.showGenerate === true);
  ok('sudah feed → showGenerate false', T.buildToday({ ...KOSONG(), habits, day, feedGenerated: true }, MALAM, HARI).reflection.showGenerate === false);
  ok('data lama: fastingPlans null & finance null tidak meledak', (() => {
    try { T.buildToday({ ...KOSONG(), fastingPlans: null, finance: null }, PAGI, HARI); return true; } catch { return false; }
  })());
}

console.log('\n=== 8. Indeks pencarian fitur (Life) ===');
{
  const stnk = FI.searchFeatures('stnk');
  ok('"STNK" → Car › Info', stnk[0]?.href.pathname === '/car' && stnk[0]?.href.params.tab === 'info', stnk[0]?.label);
  const budget = FI.searchFeatures('budget');
  ok('"budget" → Finance › Budgeting', budget[0]?.href.params?.tab === 'budgeting', budget[0]?.label);
  const cl = FI.searchFeatures('core leader');
  ok('"CORE Leader" → CORE › Leaders', cl[0]?.href.params?.tab === 'leaders', cl[0]?.label);
  const bible = FI.searchFeatures('bible');
  ok('"Bible" → Walk › Bible Reading (paling atas)', bible[0]?.href.params?.tab === 'bible', bible[0]?.label);
  ok('semua kata harus ketemu: "token listrik" tidak mengembalikan Air & Listrik', FI.searchFeatures('token listrik').every((f) => /Token/.test(f.label)));
  ok('kosong → tidak ada hasil (grid yang tampil)', FI.searchFeatures('   ').length === 0);
  ok('tiap entri punya emoji, label, jalur, kata kunci, & rute berawalan /',
    FI.FEATURE_INDEX.every((f) => f.emoji && f.label && f.path && f.keywords.length > 0 && f.href.pathname.startsWith('/')));
  const rute = fs.readFileSync(path.join(ROOT, '.expo/types/router.d.ts'), 'utf8');
  const hilang = FI.FEATURE_INDEX.map((f) => f.href.pathname).filter((p) => !rute.includes('`' + p + '`') && !rute.includes('`' + p.replace('[id]', '${') ));
  ok('semua rute indeks terdaftar di typed routes', hilang.length === 0, hilang.join(', '));
}

console.log('\n=== 9. Bentuk layar & navigasi baru ===');
{
  const layout = baca('app/(tabs)/_layout.tsx');
  ok('lima tab: index (Today) · walk · core · work · life (23 Sep 2026: nama berkas = nama tab)',
    ['index', 'walk', 'core', 'work', 'life'].every((n) => new RegExp(`name="${n}"`).test(layout)) &&
    /title: 'Today'/.test(layout) && /title: 'Walk'/.test(layout) && /title: 'Work'/.test(layout) && /title: 'Life'/.test(layout));
  ok('badge hanya CORE & Work', /tabBarBadge: coreBadge/.test(layout) && /tabBarBadge: workBadge/.test(layout) && (layout.match(/tabBarBadge:/g) ?? []).length === 2);
  const today = baca('app/(tabs)/index.tsx');
  ok('Today: hero → prioritas → CORE → Work → Life → refleksi → up next → later',
    ['<GodHero', '<PrioritiesBlock', 'eyebrow="CORE hari ini"', 'eyebrow="Work hari ini"', 'eyebrow="Life hari ini"', '<ReflectionBlock', 'label="Up next"', 'label="Later"']
      .map((s) => today.indexOf(s)).every((v, i, a) => v > -1 && (i === 0 || v > a[i - 1])));
  ok('Later menaut ke Semua Pengingat (/dashboard) — tidak ada kartu yang dibuang', /router\.push\('\/reminders'\)/.test(today) && /All Reminder 📊/.test(baca('app/reminders.tsx')));
  ok('tidak ada grid 20 tile di Today', !/HOME_FEATURES/.test(today));
  const stack = baca('app/_layout.tsx');
  ok('layar lama tetap ada sebagai stack: reminders (Semua Pengingat), habits, profile, system',
    ['reminders', 'habits', 'profile', 'system'].every((n) => new RegExp(`<Stack\\.Screen name="${n}" />`).test(stack)));
  ok('berkas tab hidup di (tabs) dengan nama fiturnya (walk/core/work), bukan lagi di root',
    fs.existsSync(path.join(ROOT, 'app/(tabs)/walk.tsx')) && fs.existsSync(path.join(ROOT, 'app/(tabs)/core.tsx')) && fs.existsSync(path.join(ROOT, 'app/(tabs)/work.tsx')) &&
    !fs.existsSync(path.join(ROOT, 'app/spiritual.tsx')) && !fs.existsSync(path.join(ROOT, 'app/core.tsx')) && !fs.existsSync(path.join(ROOT, 'app/career.tsx')));
  // 23 Sep 2026: tombolnya jadi 🔔 — lambang yang sama dengan judul layar
// tujuannya (Reminder 🔔), bukan centang yang tertukar arti dengan "selesai".
  ok('Work: sub-tab Focus (WorkFocusTab) + tombol 🔔 Reminder', /<WorkFocusTab roadmap=\{roadmap\} freelance=\{freelance\} \/>/.test(baca('app/(tabs)/work.tsx')) && /emoji="🔔" onPress=\{\(\) => router\.push\('\/tasks'\)\}/.test(baca('app/(tabs)/work.tsx')));
  ok('Life: pencarian + grid LIFE_FEATURES (tanpa Walk/CORE/Work, plus Habits/Reward/Profile/System)',
    /searchFeatures\(query\)/.test(baca('app/(tabs)/life.tsx')) && /LIFE_FEATURES/.test(baca('app/(tabs)/life.tsx')) &&
    /PUNYA_TAB = new Set\(\['spiritual', 'core', 'career'\]\)/.test(baca('lib/featureGrid.ts')));
  ok('gerbang pagi lunak: "Nanti dulu" & undangan otomatis sekali per hari', /Nanti dulu/.test(baca('components/spiritual/MorningJourney.tsx')) && /GATE_SHOWN_KEY/.test(baca('components/spiritual/MorningJourneyGate.tsx')));
  ok('Firestore: tidak ada koleksi/skema baru di mesin (hanya membaca)', !/setDoc|updateDoc|addDoc|deleteDoc|writeBatch/.test(baca('lib/today.ts')) && !/setDoc|updateDoc|addDoc|deleteDoc/.test(baca('hooks/useTodayData.ts')));
  ok('AI tidak dipanggil dari mesin/hook Today', !/gemini|guardedAiCall|generateContent/i.test(baca('lib/today.ts') + baca('hooks/useTodayData.ts')));

  // ---- Kegagalan langganan harus SAMPAI KE LAYAR ----
  //
  // 24 Sep 2026. Sampai tanggal ini, useTodayData memasang 37 langganan tanpa
  // satu pun penangan galat. Digabung dengan gerbang useReadyGate yang
  // menunggu ke-37 sumber tiba, satu langganan yang gagal permanen berarti
  // `ready` tidak pernah true: daftar Today memutar pemuat selamanya DAN
  // `syncNotifications` tidak pernah jalan (ia menunggu `ready`). Layar kosong,
  // notifikasi mati, tanpa satu pun pesan yang menjelaskan.
  //
  // Catatan: kecocokan angka SOURCES dengan jumlah mark(), dan keunikan
  // kuncinya, SUDAH dijaga cek-cepat.js sejak lama — tidak diulang di sini.
  // Yang dijaga di bawah khusus jalur galatnya.
  const hook = baca('hooks/useTodayData.ts');
  const jumlahMark = (hook.match(/\bmark\('/g) ?? []).length;
  const jumlahFail = (hook.match(/, fail\),/g) ?? []).length;
  ok('tiap langganan meneruskan galatnya ke `fail`, dan fail bermuara ke layar',
    jumlahFail === jumlahMark && /onError: setLoadError/.test(hook) &&
      /loadError/.test(baca('app/(tabs)/index.tsx')) &&
      /<ScreenError message=\{loadError\} \/>/.test(baca('app/(tabs)/index.tsx')),
    `fail=${jumlahFail} vs mark=${jumlahMark}`);
  ok('saat galat, pemuatnya BERHENTI berputar (tidak selamanya)',
    /\) : loadError \? null : \(/.test(baca('app/(tabs)/index.tsx')));
}

console.log('\n=== 10. Rupa 2.0: token warna, bayangan, tipografi ===');
{
  const warna = baca('assets/style/color.ts');
  ok('palet lebih gelap: MAIN #176B5D, MAIN_DARK #0B3D36, ACCENT pasir #E6D3B3, BACKGROUND #F7F3EC',
    /MAIN: '#176B5D'/.test(warna) && /MAIN_DARK: '#0B3D36'/.test(warna) && /ACCENT: '#E6D3B3'/.test(warna) && /BACKGROUND: '#F7F3EC'/.test(warna));
  const kartu = baca('assets/style/card.ts');
  ok('token bayangan SHADOW_SOFT & SHADOW_RAISED (iOS shadow*, Android elevation)',
    /export const SHADOW_SOFT: ViewStyle = Platform\.select\(/.test(kartu) && /export const SHADOW_RAISED/.test(kartu) && /elevation: 2/.test(kartu) && /shadowOpacity: 0\.06/.test(kartu));
  // 23 Sep 2026 (/rapihin): bentuk kartu bloknya jadi BLOCK_CARD (sudah
  // memuat SHADOW_SOFT); hero tetap memakai SHADOW_SOFT langsung karena
  // sudut & paddingnya memang khas (22 / 20).
  ok('bayangan lembut dipakai lewat BLOCK_CARD (bagian, prioritas, refleksi, Work Focus) & hero; tab bar memakai SHADOW_RAISED',
    /\.\.\.SHADOW_SOFT,/.test(baca('assets/style/card.ts')) &&
    /\.\.\.SHADOW_SOFT,/.test(baca('components/today/GodHero.tsx')) &&
    ['components/today/TodaySection.tsx', 'components/today/PrioritiesBlock.tsx', 'components/today/ReflectionBlock.tsx', 'components/career/WorkFocusTab.tsx']
      .every((f) => /\.\.\.BLOCK_CARD/.test(baca(f))) &&
    /\.\.\.SHADOW_RAISED,/.test(layout_()));
  ok('tipografi: display & eyebrow ditambahkan ke VixText', /display: \{ fontSize: 28/.test(baca('components/common/VixText.tsx')) && /eyebrow: \{ fontSize: 11/.test(baca('components/common/VixText.tsx')));
  function layout_() { return baca('app/(tabs)/_layout.tsx'); }
}

console.log('\n=== Istilah ===');
for (const f of ['lib/today.ts', 'hooks/useTodayData.ts', 'app/(tabs)/index.tsx', 'app/(tabs)/life.tsx', 'components/today/GodHero.tsx', 'components/today/PrioritiesBlock.tsx', 'components/today/TodaySection.tsx', 'components/today/ReflectionBlock.tsx', 'components/today/FoldedList.tsx', 'components/career/WorkFocusTab.tsx', 'lib/featureIndex.ts']) {
  const s = baca(f);
  ok(`${f}: tanpa tekan/ketuk/tap/klik & tanpa em dash di string`, !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(s.replace(/Gesture\.Tap\(\)/g, '')) &&
    !/['"`][^'"`\n]*—[^'"`\n]*['"`]/.test(s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log(gagal === 0 ? '\n✅ LULUS — Today Engine, navigasi 2.0, & rupa baru beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
