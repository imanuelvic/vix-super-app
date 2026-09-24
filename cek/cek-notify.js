// 23 Sep 2026: mesin pengingat HP (lib/notify.ts) — SELURUH notifikasi lokal
// app ini (rohani, bacaan Alkitab, CORE, Work, Life, Finance, refleksi) lahir
// dari Today Engine, dijalankan SUNGGUHAN atas fixture.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-notify');
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
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

const ts = (y, m, d, h = 19) => {
  const dt = new Date(y, m - 1, d, h, 0);
  return { toDate: () => dt, toMillis: () => dt.getTime() };
};
const PAGI = new Date(2026, 8, 22, 7, 30);
const HARI = '2026-09-22';

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

// 23 Sep 2026: buildSlots menerima opsi (tanggal penentu kalimat, jam hasil
// belajar kebiasaan, angka pencapaian). Suite ini menguji bentuk dasarnya:
// tanpa jam belajar & tanpa angka pencapaian. Yang ala Duolingo diuji sendiri
// di cek-notify-duo.js.
const slotsOf = (input, finance = null, now = PAGI) =>
  N.buildSlots(T.buildToday(input, now, HARI), finance, { dayId: HARI });
const cari = (slots, id) => slots.find((s) => s.id === id);

console.log('\n=== 1. Kelompok & jam ===');
{
  const s = slotsOf(KOSONG());
  const id = s.map((x) => x.id);
  ok('tiga belas pengingat: journey + penyelamat streak · 3 bacaan · CORE · Work · Life · 2 Finance · 🏆 · refleksi · 🌙 doa malam',
    id.join(',') === 'journey,journey-rescue,bible-morning,bible-daytime,bible-night,core,work,life,finance-morning,finance-evening,reward,reflection,night-prayer', id.join(','));
  const jam = (x) => `${x.hour}.${String(x.minute).padStart(2, '0')}`;
  ok('jamnya sesuai jendela fiturnya (journey 6.00 · bacaan 7/12.30/21.15 · Finance 7.30 & 20.30 · refleksi 21.30)',
    jam(cari(s, 'journey')) === '6.00' && jam(cari(s, 'bible-morning')) === '7.00' &&
    jam(cari(s, 'bible-daytime')) === '12.30' && jam(cari(s, 'bible-night')) === '21.15' &&
    jam(cari(s, 'finance-morning')) === '7.30' && jam(cari(s, 'finance-evening')) === '20.30' &&
    jam(cari(s, 'reflection')) === '21.30' && jam(cari(s, 'night-prayer')) === '22.00');
  ok('tiap kelompok punya keterangan jam di layar pengaturan',
    N.NOTIFY_GROUPS.length === 9 && N.NOTIFY_GROUPS.every((g) => g.emoji && g.label && g.when));
  ok('kelompoknya sama dengan yang dipakai slot',
    new Set(s.map((x) => x.group)).size === 9);
}

console.log('\n=== 2. Hari tenang = tidak berisik ===');
{
  const s = slotsOf(KOSONG());
  ok('CORE/Work tanpa isi → tidak dijadwalkan (body null)',
    cari(s, 'core').body === null && cari(s, 'work').body === null);
  ok('penyelamat streak & 🏆 juga diam kalau tidak ada yang dijaga',
    cari(s, 'journey-rescue').body === null && cari(s, 'reward').body === null);
  ok('journey, bacaan, Finance & refleksi tetap ada (undangan harian, bukan tagihan)',
    ['journey', 'bible-morning', 'bible-daytime', 'bible-night', 'finance-morning', 'finance-evening', 'reflection']
      .every((k) => typeof cari(s, k).body === 'string' && cari(s, k).body.length > 0));
}

console.log('\n=== 3. Isinya = baris Today, bukan hitungan kedua ===');
{
  const cl = { id: 'a', name: 'Novia', heart: '💜', birthYear: 2000, birthMonth: 8, birthDay: 22, phone: '812', lastFollowupDayId: null };
  const visit = { id: 'v1', kind: 'visitasi', leaderIds: ['a'], thanksgiving: false, date: ts(2026, 9, 22, 19), agenda: '', note: '', done: false, pdfSentDayId: null };
  const input = {
    ...KOSONG(),
    leaders: [cl],
    visitations: [visit],
    tasks: [{ id: 't1', title: 'Deploy NDC', done: false, category: 'work', dayId: HARI, createdAt: null }],
  };
  const model = T.buildToday(input, PAGI, HARI);
  const s = N.buildSlots(model, null, { dayId: HARI });
  const core = cari(s, 'core').body;
  ok('CORE menyebut baris CORE hari ini (ulang tahun & visitasi)',
    core !== null && /Novia/.test(core) && core.includes('·') === (model.today.filter((i) => i.section === 'core').length > 1));
  ok('Work menyebut task WORK hari ini', /Deploy NDC/.test(cari(s, 'work').body ?? ''));
  ok('tiap kalimat dibatasi 220 huruf (muat di lock screen)',
    s.every((x) => (x.body ?? '').length <= 220));
  ok('judul & isi tidak pernah menyebut nominal rupiah',
    s.every((x) => !/Rp\s?\d/.test(`${x.title} ${x.body ?? ''}`)));
}

console.log('\n=== 4. Finance: status tanpa nominal ===');
{
  const fin = { emoji: '🟡', level: 'watch', lines: ['Food mendekati batas.', '🟡 Transportation › Gojek: 3/4× minggu ini'] };
  const s = slotsOf(KOSONG(), fin);
  ok('judul memakai lambang statusnya', cari(s, 'finance-morning').title.includes('🟡'));
  ok('isinya dua baris status teratas', /Food mendekati batas/.test(cari(s, 'finance-morning').body));
  ok('malam tetap ajakan mencatat (kalimatnya boleh berganti)', /catat/i.test(cari(s, 'finance-evening').body));
  const tanpa = slotsOf(KOSONG(), null);
  ok('tanpa data Finance → kalimat bawaan, bukan kosong', (cari(tanpa, 'finance-morning').body ?? '').length > 10);
}

console.log('\n=== 5. Ikut keadaan rohani hari ini ===');
{
  const streak = { ...KOSONG(), login: { count: 12, lastDayId: '2026-09-21', best: 20, total: 90 } };
  ok('streak journey ikut disebut kalau sudah > 1 hari', /Streak 12 hari/.test(cari(slotsOf(streak), 'journey').body));
  const plan = {
    id: 'p1', title: 'Puasa Daniel', prayer: 'Keluarga', rules: '', answer: '',
    startId: '2026-09-20', endId: '2026-09-30', days: {},
  };
  const s = slotsOf({ ...KOSONG(), fastingPlans: [plan] });
  ok('sedang puasa → pengingat malam menyebut puasanya', /Puasa Daniel/.test(cari(s, 'bible-night').body));
  const modelBaca = T.buildToday({ ...KOSONG(), bibleReading: { morning: '', daytime: '', night: '' } }, PAGI, HARI);
  const baca2 = N.buildSlots(modelBaca, null, { dayId: HARI });
  const sesiPagi = modelBaca.god.lines.find((l) => l.id === 'bible-morning');
  ok('jendela bacaan yang sedang terbuka & belum diisi → judulnya jadi judul sesi itu',
    !!sesiPagi && cari(baca2, 'bible-morning').title === `${sesiPagi.emoji} ${sesiPagi.title}`,
    cari(baca2, 'bible-morning').title);
}

console.log('\n=== 6. Mesinnya sendiri ===');
{
  const nf = baca('lib/notify.ts');
  ok('modul native di-require LAZY & Expo Go dianggap tidak punya (aman di build lama)',
    /require\('expo-notifications'\)/.test(nf) && !/^import .* from 'expo-notifications'/m.test(nf) &&
    /ExecutionEnvironment\.StoreClient/.test(nf));
  ok('hanya menjadwalkan ulang kalau isinya berubah (hemat tulisan ke sistem)',
    /if \(sidik === terakhir\) return;/.test(nf));
  ok('jadwal lama dibatalkan dulu, id-nya disimpan; kunci Finance lama ikut dibersihkan',
    /cancelScheduledNotificationAsync/.test(nf) && /AsyncStorage\.setItem\(IDS_KEY/.test(nf) &&
    /LEGACY_IDS_KEY/.test(nf));
  ok('sakelar lama Finance ikut terbaca, jadi yang sudah menyalakannya tidak mati diam-diam',
    /LEGACY_FINANCE_KEY/.test(nf));
  ok('angka di ikon app = jumlah baris hari ini', /setBadgeCountAsync\(jumlahHariIni\)/.test(nf));
  ok('izin diminta saat dinyalakan; ditolak → "denied"; tanpa modul → "needs-build"',
    /requestPermissionsAsync\(/.test(nf) && /return 'denied'/.test(nf) && /return 'needs-build'/.test(nf));
  ok('kelompok bawaannya NYALA (dimatikan sendiri = "0")',
    /return \(await AsyncStorage\.getItem\(GROUP_KEY\(group\)\)\) !== '0';/.test(nf));
  ok('penjadwalnya layar Today (app tak punya server / tugas latar)',
    /syncNotifications\(model, finance, todayId\)/.test(baca('hooks/useTodayData.ts')));
  ok('layar pengaturannya satu: app/notifications.tsx (master + 8 kelompok)',
    /NOTIFY_GROUPS\.map/.test(baca('app/notifications.tsx')) && /setNotifyEnabled/.test(baca('app/notifications.tsx')));
  ok('bisa dibuka dari System ⚙️ & dari kartu Finance',
    /router\.push\('\/notifications'\)/.test(baca('app/system.tsx')) &&
    /router\.push\('\/notifications'\)/.test(baca('components/finance/NotifyCard.tsx')));
  ok('rutenya terdaftar di typed routes', baca('.expo/types/router.d.ts').includes('`/notifications`'));
  ok('istilah: tanpa tekan/ketuk/tap/klik & tanpa em dash di string',
    !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(nf) &&
    !/['"`][^'"`\n]*—[^'"`\n]*['"`]/.test(nf.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
}

console.log('\n=== 7. Nama berkas = nama fitur (23 Sep 2026) ===');
{
  const ada = (p) => fs.existsSync(path.join(ROOT, p));
  ok('layar tab: walk.tsx · core.tsx · work.tsx · life.tsx · index.tsx',
    ['walk', 'core', 'work', 'life', 'index'].every((n) => ada(`app/(tabs)/${n}.tsx`)));
  ok('layar stack: reminders.tsx (Semua Pengingat) · system.tsx · morning-journey.tsx · saku.tsx',
    ada('app/reminders.tsx') && ada('app/system.tsx') && ada('app/morning-journey.tsx') && ada('app/saku.tsx') && ada('app/saku/[key].tsx'));
  ok('nama lama sudah tidak ada', ['app/dashboard.tsx', 'app/version.tsx', 'app/morning-prayer.tsx', 'app/funds.tsx', 'app/fund/[key].tsx', 'lib/funds.ts', 'lib/homeGrid.ts', 'lib/financeNotify.ts', 'components/spiritual/MorningPrayerWatcher.tsx']
    .every((p) => !ada(p)));
  ok('pendukungnya ikut: lib/featureGrid.ts · lib/saku.ts · MorningJourneyGate · components/reminders/',
    ada('lib/featureGrid.ts') && ada('lib/saku.ts') && ada('components/spiritual/MorningJourneyGate.tsx') &&
    ada('components/reminders/BadgeReminders.tsx') && ada('components/reminders/FinanceStatusCard.tsx'));
  ok('tak ada sisa tautan ke nama lama di sumber', (() => {
    const sisa = [];
    (function walk(d) {
      for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
        const rel = `${d}/${f.name}`;
        if (f.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(f.name)) {
          const s = baca(rel);
          if (/'\/(dashboard|version|morning-prayer|funds|spiritual|career)'/.test(s)) sisa.push(rel);
          if (/@\/lib\/(homeGrid|funds|financeNotify)/.test(s)) sisa.push(rel);
        }
      }
    })('app');
    for (const d of ['components', 'lib', 'hooks']) {
      (function walk(x) {
        for (const f of fs.readdirSync(path.join(ROOT, x), { withFileTypes: true })) {
          const rel = `${x}/${f.name}`;
          if (f.isDirectory()) walk(rel);
          else if (/\.tsx?$/.test(f.name)) {
            const s = baca(rel);
            if (/'\/(dashboard|version|morning-prayer|funds|spiritual|career)'/.test(s)) sisa.push(rel);
            if (/@\/lib\/(homeGrid|funds|financeNotify)/.test(s)) sisa.push(rel);
          }
        }
      })(d);
    }
    return sisa.length === 0;
  })());
}

console.log(gagal === 0 ? '\n✅ LULUS — pengingat HP & nama berkas beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
