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
  leaders: [], mainTeam: [], weeklyFocus: CORE.EMPTY_WEEKLY_FOCUS,
  visitations: [], monthlyPrayers: CORE.EMPTY_MONTHLY_PRAYERS,
  tasks: [], otherTasks: [], roadmap: [], freelance: [],
  family: [], debts: [], checkups: [], profile: null,
  donor: { lastDonation: null, notes: '', schedules: [] },
  learningWeek: { skillKey: null, steps: {}, note: '' }, topicsDone: {},
  bills: [], futsal: { members: [], sessions: [], cash: [] },
  dataPlans: [], population: {}, carParts: {}, residenceChores: {},
  meterReadings: [], wheel: null, fun: { entries: [] },
    // 27 Sep 2026: catatan cadangan data (lib/backup.ts). Tanggal kosong =
    // belum pernah diekspor, dan itu memang keadaan wajar di fixture.
    backup: { lastDayId: '', docCount: 0 }, finance: null,
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
  // 26 Sep 2026: + 💪 olahraga 21.00. Jendela sore Fitness tutup jam 21.00
  // tepat, jadi tanpa pengingat ini hari yang belum dicatat lewat begitu saja.
  // 27 Sep 2026: + 🎓 target Learning. Tujuh slot sekaligus, karena harinya
  // TETAP (Sen · Rab · Jum · Min) dan tiga hari pertama punya DUA jendela jam
  // (pagi 08.00 & malam 20.00). Lihat bagian 8 di bawah.
  // 28 Sep 2026: + 🗓️ puasa bulanan (Senin terakhir tiap bulan, 09.00).
  ok('dua puluh dua pengingat: 15 harian + 7 target Learning',
    id.join(',') === 'journey,journey-rescue,bible-morning,bible-daytime,bible-night,core,work,life,finance-morning,finance-evening,reward,fitness,fasting-monthly,reflection,night-prayer,learning-discover-8,learning-discover-20,learning-dig-8,learning-dig-20,learning-summarize-8,learning-summarize-20,learning-share-17', id.join(','));
  const jam = (x) => `${x.hour}.${String(x.minute).padStart(2, '0')}`;
  ok('jamnya sesuai jendela fiturnya (journey 6.00 · bacaan 7/12.30/21.15 · Finance 7.30 & 20.30 · refleksi 21.30)',
    jam(cari(s, 'journey')) === '6.00' && jam(cari(s, 'bible-morning')) === '7.00' &&
    jam(cari(s, 'bible-daytime')) === '12.30' && jam(cari(s, 'bible-night')) === '21.15' &&
    jam(cari(s, 'finance-morning')) === '7.30' && jam(cari(s, 'finance-evening')) === '20.30' &&
    jam(cari(s, 'reflection')) === '21.30' && jam(cari(s, 'night-prayer')) === '22.00');
  ok('tiap kelompok punya keterangan jam di layar pengaturan',
    N.NOTIFY_GROUPS.length === 12 && N.NOTIFY_GROUPS.every((g) => g.emoji && g.label && g.when));
  ok('kelompoknya sama dengan yang dipakai slot',
    new Set(s.map((x) => x.group)).size === 12);
}

console.log('\n=== 8. 🎓 Target Learning: harinya TETAP, bukan tiap hari ===');
{
  const s = slotsOf(KOSONG());
  const belajar = s.filter((x) => x.group === 'learning');
  ok('tujuh slot, semuanya berkelompok "learning"', belajar.length === 7);
  // Ini penjagaan yang paling penting di bagian ini: slot TANPA `weekday`
  // dijadwalkan HARIAN (lihat syncNotifications). Kalau satu saja lupa
  // menyebut harinya, "🎯 Senin Kenali" ikut berbunyi hari Selasa.
  ok('semuanya menyebut harinya sendiri (weekday), jadi tak ada yang jatuh ke harian',
    belajar.every((x) => typeof x.weekday === 'number' && x.weekday >= 1 && x.weekday <= 7),
    belajar.map((x) => `${x.id}=${x.weekday}`).join(', '));
  // 1 = Minggu … 7 = Sabtu (penomoran expo-notifications).
  const hari = Object.fromEntries(belajar.map((x) => [x.id, x.weekday]));
  ok('Senin=2 · Rabu=4 · Jumat=6 · Minggu=1 (penomoran iOS, bukan Senin-dulu)',
    hari['learning-discover-8'] === 2 && hari['learning-discover-20'] === 2 &&
    hari['learning-dig-8'] === 4 && hari['learning-summarize-8'] === 6 &&
    hari['learning-share-17'] === 1,
    JSON.stringify(hari));
  ok('Sen/Rab/Jum dua jendela (08.00 & 20.00); Minggu sekali sore 17.00',
    belajar.filter((x) => x.hour === 8).length === 3 &&
    belajar.filter((x) => x.hour === 20).length === 3 &&
    belajar.filter((x) => x.hour === 17).length === 1 &&
    belajar.every((x) => x.minute === 0));
  ok('semuanya mendarat di sub-tab Target, bukan cuma layar Learning',
    belajar.every((x) => N.tujuanTeks(x.route) === '/learning?tab=week'));
  ok('isinya menyebut hari, langkah & skill-nya, jadi bisa dikerjakan tanpa buka app dulu',
    /Senin Kenali: .+\./.test(cari(s, 'learning-discover-8').body) &&
    /Minggu Ceritakan: /.test(cari(s, 'learning-share-17').body));

  // Yang sudah beres DI HARINYA → diam. HARI UJI = Selasa, jadi yang bisa
  // didiamkan cuma langkah Selasa — dan memang tidak ada. Itu disengaja:
  // pekan berganti tiap Senin, jadi langkah yang harinya BELUM datang tak
  // boleh ikut didiamkan sekarang (kalau tidak, Senin depan sunyi total).
  const beresSemua = { ...KOSONG(), learningWeek: { skillKey: null, steps: { discover: true, dig: true, summarize: true, share: true }, note: '' } };
  ok('Selasa: langkah hari lain tetap dijadwalkan walau minggu ini sudah beres',
    slotsOf(beresSemua).filter((x) => x.group === 'learning' && x.body !== null).length === 7);
  // Senin 21 Sep 2026 — hari langkah "Kenali".
  const SENIN = new Date(2026, 8, 21, 7, 30);
  const sSenin = N.buildSlots(T.buildToday(beresSemua, SENIN, '2026-09-21'), null, { dayId: '2026-09-21' });
  ok('Senin & "Kenali" sudah beres → dua slot Senin diam, sisanya tetap',
    sSenin.filter((x) => x.group === 'learning' && x.body === null).map((x) => x.id).join(',') ===
      'learning-discover-8,learning-discover-20',
    sSenin.filter((x) => x.group === 'learning' && x.body === null).map((x) => x.id).join(','));
  const belumSenin = { ...KOSONG(), learningWeek: { skillKey: null, steps: {}, note: '' } };
  const sSenin2 = N.buildSlots(T.buildToday(belumSenin, SENIN, '2026-09-21'), null, { dayId: '2026-09-21' });
  ok('Senin & belum dikerjakan → dua slot Senin tetap berbunyi',
    sSenin2.filter((x) => x.id.startsWith('learning-discover')).every((x) => x.body !== null));
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

// ===================== 💪 Pengingat olahraga 21.00 =====================
//
// 26 Sep 2026, permintaan pemiliknya: "kalau belum dicentang sampai jam 21.00,
// ingatkan untuk segera diisi, kecuali sudah dicentang atau di-skip".
//
// Yang bikin ini TIDAK bisa menumpang baris 💪 di daftar Today: baris itu ikut
// jendela pengingat Fitness (05–09 & 16–21), dan jendela sore tutup jam 21.00
// TEPAT. Jadi pada jam pengingat ini berbunyi, `fitPendingToday` sudah 0 dan
// barisnya sudah hilang. Karena itu ada `fitUnanswered` yang tidak melihat jam.
console.log('\n=== 5. 💪 Pengingat olahraga 21.00 ===');
{
  const hari = (over) => ({
    ...KOSONG(),
    fitDay: { done: {}, skipped: false, picks: [], runs: {}, ...over },
  });
  const slotOlahraga = (over, now = PAGI) => cari(slotsOf(hari(over), null, now), 'fitness');

  const belum = slotOlahraga({});
  ok('berbunyi jam 21.00', belum.hour === 21 && belum.minute === 0);
  ok('belum memilih apa pun → ditagih memilih',
    belum.body === 'Belum pilih olahraga hari ini. Catat atau tandai dilewati.',
    String(belum.body));
  ok('di-click → Fitness sub-tab Exercise, tempat mencatatnya',
    belum.route.pathname === '/fitness' && belum.route.params.tab === 'exercise');

  // Sudah memilih paket tapi gerakannya belum dicentang semua.
  const pilihRenang = slotOlahraga({ picks: ['swim'] });
  ok('sudah memilih tapi belum beres → paketnya disebut namanya',
    pilihRenang.body === 'Berenang belum beres. Catat atau tandai dilewati.',
    String(pilihRenang.body));

  // Dua jalan keluar yang SAMA-SAMA membuatnya diam.
  const semuaBeres = slotOlahraga({
    picks: ['swim'],
    done: { swimwarmup: true, swimmain: true, swimcooldown: true },
  });
  ok('sudah dicatat semua → diam, tidak menagih', semuaBeres.body === null);
  ok('sengaja dilewati (✗) → diam juga, bukan dimarahi',
    slotOlahraga({ skipped: true }).body === null);

  // Jam berapa pun layar Today digambar, jadwal 21.00-nya harus sudah benar —
  // app-nya mungkin cuma dibuka pagi tadi.
  ok('dihitung sepanjang hari, bukan cuma di jendela sore',
    slotOlahraga({}, new Date(2026, 8, 26, 10, 0)).body !== null &&
    slotOlahraga({ skipped: true }, new Date(2026, 8, 26, 10, 0)).body === null);

  ok('judulnya berganti tiap hari (kolam kalimat, seperti pengingat lain)',
    (() => {
      const judul = new Set(
        ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29'].map(
          (d) =>
            N.buildSlots(T.buildToday(hari({}), PAGI, d), null, { dayId: d }).find(
              (s) => s.id === 'fitness',
            ).title,
        ),
      );
      return judul.size > 1;
    })());
}

console.log(gagal === 0 ? '\n✅ LULUS — pengingat HP & nama berkas beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
