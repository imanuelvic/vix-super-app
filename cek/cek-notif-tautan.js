// 23 Sep 2026 (malam) — tiap notifikasi punya TUJUAN sendiri: di-click, ia
// membuka layar yang memang sedang dibicarakannya (pengingat Life membuka All
// Reminder, pengingat bacaan membuka Habits di kartu sesi jam itu, dan kalau
// yang menunggu cuma satu hal, layar hal itu persis).
//
// Yang diuji sungguhan: buildSlots (murni) dijalankan atas model buatan &
// model asli dari Today Engine, lalu tujuannya diperiksa satu per satu.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-notif-tautan');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

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

const gudang = new Map();
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: (_, k) => (k === 'CHART_COLORS' ? [] : '#000000') }) };
  if (req === './firebase') return { db: {}, auth: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {}, unsubscribeAll: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req === './gemini' || req === './aiGuard') return new Proxy({}, { get: () => () => ({}) });
  if (req.startsWith('firebase/')) return new Proxy({}, { get: (_, k) => (k === 'Timestamp' ? { now: () => ({}) } : () => ({})) });
  if (req === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: {
      getItem: async (k) => (gudang.has(k) ? gudang.get(k) : null),
      setItem: async (k, v) => { gudang.set(k, v); },
      removeItem: async (k) => { gudang.delete(k); },
    } };
  }
  if (req === 'expo-constants') return { __esModule: true, default: { executionEnvironment: 'bare' }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
  if (/^(expo-|react-native|@expo|react$)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const N = require(path.join(OUT, 'notify.js'));
const T = require(path.join(OUT, 'today.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

const HARI = '2026-09-22';
const PAGI = new Date(2026, 8, 22, 7, 30);
const SIANG = new Date(2026, 8, 22, 12, 30);

/** Model Today buatan — buildSlots murni, jadi ia cukup diberi bentuknya. */
const model = (over = {}) => ({
  god: { state: 'invite', lines: [], streak: 0, nudge: null, ...(over.god || {}) },
  today: over.today || [],
  upNext: over.upNext || [],
  later: [],
  reflection: { available: true, text: '', written: false, showGenerate: false, emphasis: false },
  // 🌙 Night Prayer: dihitung sepanjang hari, jadi ia selalu ada di modelnya.
  night: over.night || { summary: '3 syukur · 2 pengakuan · 4 permohonan · 🌏 Dunia', done: false },
});
const item = (section, id, href) => ({
  id, section, tier: 'today', rank: 3, emoji: '🔔', title: id, href,
});
const slotsDari = (m, finance = null, opts = {}) =>
  N.buildSlots(m, finance, { dayId: HARI, ...opts });
const cari = (slots, id) => slots.find((s) => s.id === id);
const tujuan = (slots, id) => N.tujuanTeks(cari(slots, id).route);

console.log('\n=== 1. Tiap notifikasi membawa tujuannya sendiri ===');
{
  const s = slotsDari(model());
  ok('tidak ada satu pun slot tanpa tujuan', s.every((x) => x.route && typeof x.route.pathname === 'string'));
  ok('semua tujuannya rute app (diawali "/"), bukan teks bebas',
    s.every((x) => x.route.pathname.startsWith('/')),
    s.map((x) => x.route && x.route.pathname).join(' '));

  // Tiap rute yang dipakai memang ada berkasnya — tautan mati ketahuan di sini,
  // bukan nanti di HP.
  const ada = (p) => {
    const nama = p === '/' ? '(tabs)/index' : p.slice(1);
    return fs.existsSync(path.join(ROOT, 'app', `${nama}.tsx`)) ||
      fs.existsSync(path.join(ROOT, 'app', '(tabs)', `${nama}.tsx`));
  };
  const semuaRute = [...new Set(s.map((x) => x.route.pathname))];
  ok('semua layar tujuannya benar-benar ada', semuaRute.every(ada),
    semuaRute.filter((p) => !ada(p)).join(' '));
}

console.log('\n=== 2. Tujuan tiap kelompok ===');
{
  const s = slotsDari(model({ god: { streak: 9, state: 'invite' } }));
  ok('🌅 Morning Journey & penyelamat streak → layar Morning Journey',
    tujuan(s, 'journey') === '/morning-journey' && tujuan(s, 'journey-rescue') === '/morning-journey');
  ok('📖 bacaan pagi/siang/malam → Habits, langsung di kartu sesi jam itu',
    tujuan(s, 'bible-morning') === '/habits?focus=bible-morning' &&
    tujuan(s, 'bible-daytime') === '/habits?focus=bible-daytime' &&
    tujuan(s, 'bible-night') === '/habits?focus=bible-night',
    [tujuan(s, 'bible-morning'), tujuan(s, 'bible-daytime'), tujuan(s, 'bible-night')].join(' '));
  ok('💰 Finance pagi & malam → layar Finance',
    tujuan(s, 'finance-morning') === '/finance' && tujuan(s, 'finance-evening') === '/finance');
  ok('🏆 Pencapaian → layar Reward', tujuan(s, 'reward') === '/reward');
  ok('📝 Refleksi malam → Today, tempat blok refleksinya ditulis',
    tujuan(s, 'reflection') === '/' && /<ReflectionBlock/.test(baca('app/(tabs)/index.tsx')));
}

console.log('\n=== 3. Satu hal → layar hal itu persis ===');
{
  const satu = model({
    today: [item('core', 'visitasi', { pathname: '/core', params: { tab: 'visitation', edit: 'v1' } })],
  });
  ok('CORE cuma satu baris → sub-tab & isian yang mau dibuka ikut terbawa',
    tujuan(slotsDari(satu), 'core') === '/core?edit=v1&tab=visitation',
    tujuan(slotsDari(satu), 'core'));

  const satuLife = model({ today: [item('life', 'air', { pathname: '/habits' })] });
  ok('Life cuma satu baris → langsung ke layar baris itu',
    tujuan(slotsDari(satuLife), 'life') === '/habits');

  const satuWork = model({
    today: [item('work', 'tenggat', { pathname: '/work', params: { tab: 'roadmap', edit: 'r7' } })],
  });
  ok('Work cuma satu baris → sama, layar barisnya',
    tujuan(slotsDari(satuWork), 'work') === '/work?edit=r7&tab=roadmap');
}

console.log('\n=== 4. Beberapa hal → layar induknya ===');
{
  const banyak = model({
    today: [
      item('core', 'a', { pathname: '/core', params: { tab: 'followup' } }),
      item('core', 'b', { pathname: '/monthly-prayers' }),
      item('work', 'c', { pathname: '/work', params: { tab: 'roadmap' } }),
      item('work', 'd', { pathname: '/tasks' }),
      item('life', 'e', { pathname: '/habits' }),
      item('life', 'f', { pathname: '/learning' }),
      item('life', 'g', { pathname: '/debts' }),
    ],
  });
  const s = slotsDari(banyak);
  ok('CORE → layar CORE', tujuan(s, 'core') === '/core');
  ok('Work → layar Work', tujuan(s, 'work') === '/work');
  ok('Life → All Reminder (daftar lengkapnya), bukan grid Life',
    tujuan(s, 'life') === '/reminders', tujuan(s, 'life'));
  ok('tiga baris Life disebut dua, sisanya dihitung (muat di lock screen)',
    /\+1 lagi$/.test(cari(s, 'life').body) && cari(s, 'life').body.split(' · ').length === 2,
    cari(s, 'life').body);
  ok('dua baris Work disebut dua-duanya, tanpa "+0 lagi"',
    !/lagi/.test(cari(s, 'work').body), cari(s, 'work').body);
}

console.log('\n=== 5. Tujuannya sama dengan click barisnya di dalam app ===');
{
  const KOSONG = () => ({
    login: null, bibleReading: null, habits: [], day: null,
    fitDay: { done: {}, skipped: false, picks: [], runs: {} },
    fastingPlans: [], sermons: [], myReminders: [],
    intercession: { key: 'family', emoji: '👨‍👩‍👧', label: 'Keluarga', points: [] },
    intercessionDismissed: false, feedGenerated: false,
    leaders: [], mainTeam: [], greets: {}, weeklyFocus: CORE.EMPTY_WEEKLY_FOCUS,
    visitations: [], monthlyPrayers: CORE.EMPTY_MONTHLY_PRAYERS,
    tasks: [], otherTasks: [], roadmap: [], freelance: [],
    family: [], debts: [], checkups: [], profile: null,
    donor: { lastDonation: null, notes: '', schedules: [] },
    learningWeek: { skillKey: null, steps: {}, note: '' }, topicsDone: {},
    bills: [], futsal: { members: [], sessions: [], cash: [] },
    dataPlans: [], population: {}, carParts: {}, residenceChores: {},
    meterReadings: [], wheel: null, fun: { entries: [] }, finance: null,
  });
  const belumBaca = { ...KOSONG(), bibleReading: { morning: '', daytime: '', night: '', date: HARI } };

  const pagi = T.buildToday(belumBaca, PAGI, HARI);
  const barisPagi = pagi.god.lines.find((l) => l.id === 'bible-morning');
  ok('jendela pagi terbuka → ada baris bacaan pagi di Today', !!barisPagi);
  ok('slot pagi memakai href baris Todaynya, bukan tebakan sendiri',
    N.tujuanTeks(cari(N.buildSlots(pagi, null, { dayId: HARI }), 'bible-morning').route) ===
      N.tujuanTeks(barisPagi.href));

  // Sesinya bernama "daytime" (lib/spiritual.ts). Dulu id slotnya "bible-midday",
  // jadi judul bacaan siang tidak pernah ikut diperjelas — sekarang id-nya sama.
  const siang = T.buildToday(belumBaca, SIANG, HARI);
  const barisSiang = siang.god.lines.find((l) => l.id === 'bible-daytime');
  const slotSiang = cari(N.buildSlots(siang, null, { dayId: HARI }), 'bible-daytime');
  ok('id slot bacaan siang sama dengan id baris Todaynya', !!barisSiang && !!slotSiang);
  ok('judul bacaan siang benar-benar ikut diperjelas saat jendelanya terbuka',
    slotSiang.title === `${barisSiang.emoji} ${barisSiang.title}`, slotSiang.title);
  ok('tujuannya pun ikut barisnya',
    N.tujuanTeks(slotSiang.route) === N.tujuanTeks(barisSiang.href));
}

console.log('\n=== 6. Dititipkan di notifikasinya, dibaca lagi saat di-click ===');
{
  const nf = baca('lib/notify.ts');
  ok('tujuannya ikut dijadwalkan sebagai data notifikasi',
    /data: \{\s*\n\s*route: s\.route\.pathname,\s*\n\s*params: s\.route\.params \?\? \{\},/.test(nf));
  ok('tujuan ikut sidik jadwal → tujuan berubah = jadwal ditulis ulang',
    /tujuanTeks\(s\.route\)/.test(nf.slice(nf.indexOf('const sidik'))));

  const bolak = N.tujuanTap({ route: '/core', params: { tab: 'visitation' }, slot: 'core' });
  ok('data yang dititipkan terbaca kembali apa adanya',
    N.tujuanTeks(bolak) === '/core?tab=visitation');
  ok('tanpa params tetap sah', N.tujuanTeks(N.tujuanTap({ route: '/reward', params: {} })) === '/reward');
  ok('data sampah ditolak, bukan dipaksa jadi rute',
    N.tujuanTap(null) === null && N.tujuanTap({}) === null &&
    N.tujuanTap({ route: 'reward' }) === null && N.tujuanTap({ route: 5 }) === null);
  ok('notifikasi lama tanpa tujuan (dijadwalkan sebelum hari ini) tidak bikin app melompat',
    N.tujuanTap(undefined) === null);
}

console.log('\n=== 7. Yang mengantar click-nya ke layar ===');
{
  const r = baca('components/common/NotifyRouter.tsx');
  ok('dua jalan masuk diurus: app hidup & app tadinya mati',
    /langgananTap\(pergi\)/.test(r) && /await tapTerakhir\(\)/.test(r));
  ok('memakai todayHref yang SAMA dengan click baris Today',
    /from '@\/components\/today\/todayLink'/.test(r) && /router\.navigate\(todayHref\(/.test(r));
  ok('navigate, bukan push → layar yang sama tidak ditumpuk dua kali', !/router\.push\(/.test(r));
  ok('dipasang sekali di akar app, hanya kalau sudah login',
    /\{!!user && <NotifyRouter \/>\}/.test(baca('app/_layout.tsx')));
  ok('tidak menggambar apa pun (tidak mengganggu layar mana pun)', /return null;/.test(r));

  const nf = baca('lib/notify.ts');
  ok('di Expo Go / build lama ia diam, bukan crash',
    /export function langgananTap[\s\S]{0,200}if \(!mod\) return \(\) => \{\};/.test(nf) &&
    /export async function tapTerakhir[\s\S]{0,160}if \(!mod\) return null;/.test(nf));
  ok('notifikasi pembuka dibersihkan sesudah dibaca (besok tidak melompat lagi)',
    /clearLastNotificationResponseAsync\(\)/.test(nf));
}

console.log('\n=== 8. Layar Notification 📳 ===');
{
  const s = baca('app/notifications.tsx');
  ok('berpita warna tile System, seperti layar lain', /<ScreenHeader/.test(s) && !/BackRow/.test(s));
  ok('tiap kelompok menyebut ke mana notifikasinya mendarat', /Click → \{g\.opens\}/.test(s));
  ok('istilahnya "Click", bukan tekan/ketuk/tap',
    !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap)\b/i.test(s.replace(/^\s*\/\/.*$/gm, '')));
  ok('sembilan kelompok punya keterangan tujuannya',
    N.NOTIFY_GROUPS.length === 9 && N.NOTIFY_GROUPS.every((g) => typeof g.opens === 'string' && g.opens.length > 0));
  const teks = N.NOTIFY_GROUPS.map((g) => `${g.label} ${g.when} ${g.opens}`);
  ok('tanpa em dash di teks yang terbaca',
    teks.every((t) => !t.includes(String.fromCharCode(0x2014))) &&
    !s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').includes(String.fromCharCode(0x2014)));
}

console.log(gagal === 0 ? '\n✅ LULUS — tiap notifikasi mendarat di layarnya sendiri.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
