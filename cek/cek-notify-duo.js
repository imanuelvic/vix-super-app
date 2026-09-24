// 23 Sep 2026 — pengingat ala Duolingo: kalimat berganti tiap hari
// (lib/notifyCopy.ts), jam ikut kebiasaan (lib/notifyTiming.ts), penyelamat
// streak malam, dan godaan pencapaian 🏆 (lib/rewards → lib/notify).
// Ketiganya DIJALANKAN sungguhan atas fixture.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-notify-duo');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/notify.ts'), path.join(ROOT, 'lib/today.ts'),
      path.join(ROOT, 'lib/notifyCopy.ts'), path.join(ROOT, 'lib/notifyTiming.ts'),
      path.join(ROOT, 'lib/reward.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// Penyimpanan HP palsu: isinya bisa dibaca & diperiksa suite ini.
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
const C = require(path.join(OUT, 'notifyCopy.js'));
const W = require(path.join(OUT, 'notifyTiming.js'));
const A = require(path.join(OUT, 'reward.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

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
const slotsOf = (input, opts = {}, finance = null, now = PAGI) =>
  N.buildSlots(T.buildToday(input, now, HARI), finance, { dayId: HARI, ...opts });
const cari = (slots, id) => slots.find((s) => s.id === id);

console.log('\n=== 1. Kalimatnya berganti tiap hari, tapi tidak acak ===');
{
  const hariLain = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
  const judul = hariLain.map(
    (d) => N.buildSlots(T.buildToday(KOSONG(), PAGI, d), null, { dayId: d }).find((s) => s.id === 'journey').title,
  );
  ok('hari yang sama selalu memilih kalimat yang sama (jadwal ulang tidak berubah-ubah)',
    judul[0] === N.buildSlots(T.buildToday(KOSONG(), PAGI, HARI), null, { dayId: HARI }).find((s) => s.id === 'journey').title);
  ok('lima hari berturut tidak memakai satu kalimat yang sama terus', new Set(judul).size >= 2, judul.join(' | '));
  ok('kolamnya cukup banyak untuk tidak cepat hafal',
    C.KOLAM_JOURNEY.length >= 4 && C.KOLAM_RESCUE.length >= 3 && C.KOLAM_REFLEKSI.length >= 3 &&
    C.KOLAM_CORE.length >= 3 && C.KOLAM_WORK.length >= 3 && C.KOLAM_LIFE.length >= 3 && C.KOLAM_REWARD.length >= 3);
  ok('pilihKalimat murni: kolam & tanggal sama → hasil sama',
    C.pilihKalimat(C.KOLAM_CORE, HARI, 'core') === C.pilihKalimat(C.KOLAM_CORE, HARI, 'core'));
  const semuaTeks = [
    ...C.KOLAM_JOURNEY, ...C.KOLAM_RESCUE, ...C.KOLAM_BIBLE_PAGI, ...C.KOLAM_BIBLE_SIANG,
    ...C.KOLAM_BIBLE_MALAM, ...C.KOLAM_FINANCE_MALAM, ...C.KOLAM_REFLEKSI,
  ].map((k) => `${k.title} ${k.body}`).concat(C.KOLAM_CORE, C.KOLAM_WORK, C.KOLAM_LIFE, C.KOLAM_REWARD);
  ok('istilah: tanpa tekan/ketuk/tap/klik, tanpa "rentetan", tanpa em dash',
    semuaTeks.every((t) => !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik|rentetan|beruntun)\b/i.test(t)) &&
    semuaTeks.every((t) => !t.includes(String.fromCharCode(0x2014))));
  ok('kalimatnya pendek (muat di lock screen)', semuaTeks.every((t) => t.length <= 120), semuaTeks.find((t) => t.length > 120));
}

console.log('\n=== 2. Penyelamat streak 😱 ===');
{
  const jalan = { ...KOSONG(), login: { count: 12, lastDayId: '2026-09-21', best: 20, total: 90 } };
  const s = slotsOf(jalan);
  const r = cari(s, 'journey-rescue');
  ok('streak hidup & journey belum → pengingat malam 20.45 berbunyi',
    r.body !== null && r.hour === 20 && r.minute === 45 && r.group === 'journey');
  ok('angka streaknya ikut disebut, bukan kalimat umum', /12/.test(`${r.title} ${r.body}`));
  const sudah = { ...KOSONG(), login: { count: 12, lastDayId: HARI, best: 20, total: 90 } };
  ok('journey hari ini SUDAH dijalani → penyelamatnya diam',
    cari(slotsOf(sudah), 'journey-rescue').body === null);
  const baru = { ...KOSONG(), login: { count: 1, lastDayId: '2026-09-21', best: 1, total: 1 } };
  ok('streak baru sehari → tidak ditakut-takuti', cari(slotsOf(baru), 'journey-rescue').body === null);
  ok('undangan pagi menyebut streak yang sedang jalan', /Streak 12 hari/.test(cari(slotsOf(jalan), 'journey').body));
}

console.log('\n=== 3. Godaan pencapaian 🏆 ===');
{
  const stats = {
    loginCount: 2, loginBest: 2, habitStreak: 0, bibleMorningBest: 2, bibleDaytimeBest: 1,
    bibleNightBest: 2, learningWeekBest: 2, fitTotal: 9, fitBest: 4, bestSteps: 19000,
    stepTierLastDate: {}, weekStepHits: 0, weekGymHits: 1, weekBothHits: 0,
    bestDayKm: 4, bestWeekKm: 0, bestMonthKm: 0, waterCount: 2, waterBest: 2, waterTotal: 2,
  };
  const hampir = A.nearestRewards(stats, 2);
  ok('yang dipilih paling dekat selesai (persentase tertinggi), maksimal dua',
    hampir.length === 2 && hampir[0].id === 'steps20k' && hampir[1].id === 'fit10' && hampir[1].now === '9' && hampir[1].target === '10',
    JSON.stringify(hampir));
  ok('yang masih 0 tidak pernah dipilih (bukan godaan, cuma pengumuman)',
    A.nearestRewards({ ...stats, fitTotal: 0, fitBest: 0, bestSteps: 0, bestDayKm: 0, bibleMorningBest: 0, bibleDaytimeBest: 0, bibleNightBest: 0, loginBest: 0, learningWeekBest: 0, weekGymHits: 0, waterBest: 0, waterTotal: 0, waterCount: 0 }, 2).length === 0);
  ok('unlockedCount dipakai bersama layar Reward', typeof A.unlockedCount(stats) === 'number' &&
    /unlockedCount\(stats\)/.test(baca('app/reward.tsx')));
  const s = slotsOf(KOSONG(), { achv: { hints: hampir, unlocked: 19, total: 85 } });
  const a = cari(s, 'reward');
  ok('pengingat 🏆 jam 19.00 menyebut angkanya & berapa yang sudah kebuka',
    a.hour === 19 && a.minute === 0 && /9\/10/.test(a.body) && /19 dari 85/.test(a.body), a.body);
  ok('belum pernah membuka layar Reward → kelompok 🏆 diam',
    cari(slotsOf(KOSONG()), 'reward').body === null);
  ok('layar Reward yang menitipkan angkanya (bukan langganan baru di Today)',
    /saveRewardSnapshot\(/.test(baca('app/reward.tsx')) &&
    !/useRewardStats/.test(baca('hooks/useTodayData.ts')));
}

console.log('\n=== 4. Jam yang ikut kebiasaan ===');
{
  ok('kelompok yang belajar: journey, core, work, life, refleksi, doa malam',
    Object.keys(W.JENDELA).sort().join() === 'core,journey,life,night-prayer,reflection,work');
  ok('bacaan Alkitab, Finance & reward TIDAK belajar (jamnya terikat jendela fiturnya)',
    !W.JENDELA.bible && !W.JENDELA.finance && !W.JENDELA.reward);
  const jendela = W.JENDELA.core;
  ok('contoh kurang dari 3 → tetap jam bawaan',
    W.jamDariContoh([600, 620], jendela).hour === 8 && W.jamDariContoh([], jendela).minute === 30);
  const belajar = W.jamDariContoh([600, 610, 605], jendela); // biasa selesai ~10.05
  ok('biasa selesai jam 10 → diingatkan setengah jam sebelumnya (09.30)',
    belajar.hour === 9 && belajar.minute === 30, JSON.stringify(belajar));
  ok('satu hari aneh tidak menggeser jadwal (median, bukan rata-rata)',
    W.jamDariContoh([600, 610, 605, 1380], jendela).hour === 9);
  ok('tetap di dalam jendela kelompoknya (tidak pernah jam 5 pagi untuk CORE)',
    W.jamDariContoh([420, 425, 430], jendela).hour === 7 &&
    W.jamDariContoh([1200, 1205, 1210], jendela).hour === 11);
  ok('dibulatkan ke kelipatan 15 menit', [0, 15, 30, 45].includes(W.jamDariContoh([611, 613, 617], jendela).minute));
  ok('jamnya masuk ke slot lewat opsi (buildSlots tetap murni)',
    cari(slotsOf(KOSONG(), { jam: { core: { hour: 10, minute: 15 } } }), 'core').hour === 10);
}

console.log('\n=== 5. Belajarnya dari layar Today, di HP sendiri ===');
(async () => {
  gudang.clear();
  // Hari 1: CORE masih ada isinya jam 09.00.
  await W.catatKebiasaan(['core'], '2026-09-20', new Date(2026, 8, 20, 9, 0));
  ok('belum ada contoh selama kelompoknya masih terisi', (await W.contohJam('core')).length === 0);
  // Masih hari yang sama, jam 10.05 CORE-nya habis → satu contoh tercatat.
  await W.catatKebiasaan([], '2026-09-20', new Date(2026, 8, 20, 10, 5));
  ok('ADA ISI berubah jadi KOSONG → jam saat itu jadi contoh', (await W.contohJam('core')).join() === '605');
  await W.catatKebiasaan([], '2026-09-20', new Date(2026, 8, 20, 11, 0));
  ok('tidak dicatat dua kali di hari yang sama', (await W.contohJam('core')).length === 1);
  await W.catatKebiasaan(['core'], '2026-09-21', new Date(2026, 8, 21, 8, 0));
  await W.catatKebiasaan([], '2026-09-21', new Date(2026, 8, 21, 10, 0));
  await W.catatKebiasaan(['core'], '2026-09-22', new Date(2026, 8, 22, 8, 0));
  await W.catatKebiasaan([], '2026-09-22', new Date(2026, 8, 22, 10, 10));
  ok('tiga hari → jamnya ikut bergeser', (await W.sudahBelajar('core')) === true);
  const jam = await W.jamPengingat('core');
  ok('jam pengingat CORE jadi sekitar 09.30', jam.hour === 9 && jam.minute === 30, JSON.stringify(jam));
  ok('contohnya dibatasi (tidak menumpuk selamanya)', W.CONTOH_MAKS <= 30);
  ok('seluruh belajarnya di HP (AsyncStorage), tanpa Firestore',
    [...gudang.keys()].every((k) => k.startsWith('notify:')) &&
    !/from '\.\/(firebase|liveDoc)'/.test(baca('lib/notifyTiming.ts')));

  console.log('\n=== 6. Penyambungan ===');
  {
    const nf = baca('lib/notify.ts');
    ok('penjadwalnya layar Today & ikut membawa tanggal hari ini',
      /syncNotifications\(model, finance, todayId\)/.test(baca('hooks/useTodayData.ts')));
    ok('kebiasaan dicatat dari kelompok yang hari ini masih terisi', /catatKebiasaan\(terisi, todayId/.test(nf));
    ok('jam & angka pencapaian dibaca sebelum jadwal ditulis',
      /jam: await semuaJamPengingat\(\)/.test(nf) && /achv: await loadRewardSnapshot\(\)/.test(nf));
    ok('kelompok 🏆 ada di layar pengaturan', /reward/.test(nf) && N.NOTIFY_GROUPS.some((g) => g.key === 'reward'));
    ok('layar pengaturan menampilkan jam hasil belajar',
      /mengikuti kebiasaanmu/.test(baca('app/notifications.tsx')) && /sudahBelajar\(g\.key\)/.test(baca('app/notifications.tsx')));
    ok('tidak ada nominal rupiah di kalimat mana pun',
      slotsOf(KOSONG(), { achv: { hints: [], unlocked: 1, total: 85 } }).every((x) => !/Rp\s?\d/.test(`${x.title} ${x.body ?? ''}`)));
  }

  console.log(gagal === 0 ? '\n✅ LULUS — pengingatnya hidup, tidak membosankan.' : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
})();
