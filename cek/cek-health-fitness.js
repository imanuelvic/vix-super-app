// 3 Okt 2026: review Health 🍎 & Fitness 💪 — dua belas saran yang dipilih
// pemilik app dari daftar review (H1–H5, H7, F1–F6):
//
//   H1 pengingat timbang membuka isian berat (bukan Check-up)
//   H2 riwayat berat + grafik 12 minggu dengan garis target
//   H3 target 10.000 langkah menggantikan patokan lari harian
//   H4 bulan · kuartal · tahun jadi satu kartu Rekap
//   H5 satu target mingguan di Steps (anjuran umum pindah ke grafik Fitness)
//   H7 Check-up: tombol dipatok, ikon Info 📋
//   F1 satu sumber jarak lari (hasil ketik = sesi, sama dengan rekaman)
//   F2 riwayat beban per gerakan
//   F3 Progress jadi ringkasan minggu + konsistensi 8 minggu
//   F4 tab Program dilebur ke sheet Pick Exercise
//   F5 timer istirahat antar set
//   F6 race berikutnya: hitung mundur + saran blok C
//
// Mesinnya (lib/health, lib/fitness, lib/fun, lib/today) DIJALANKAN atas
// fixture, termasuk tulisan Firestore-nya yang ditangkap Firestore palsu —
// yang dijaga janjinya, bukan cuma bentuk tulisannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-health-fitness');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Kode tanpa komentar — yang diuji yang benar-benar jalan. */
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
    ['tsc', path.join(ROOT, 'lib/today.ts'), path.join(ROOT, 'lib/fitness.ts'),
      path.join(ROOT, 'lib/fun.ts'), path.join(ROOT, 'lib/health.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// ---------- Firestore palsu: tiap tulisan ditangkap ----------
const tulisan = [];
const tsDari = (d) => ({ toDate: () => d, toMillis: () => d.getTime() });
const firestore = new Proxy(
  {
    doc: (_db, ...seg) => ({ path: seg.join('/') }),
    setDoc: async (ref, data, opt) => { tulisan.push({ op: 'set', path: ref.path, data, opt }); },
    writeBatch: () => {
      const ops = [];
      return {
        set: (ref, data, opt) => { ops.push({ path: ref.path, data, opt }); },
        update: (ref, data) => { ops.push({ path: ref.path, data }); },
        delete: (ref) => { ops.push({ path: ref.path, hapus: true }); },
        commit: async () => { tulisan.push({ op: 'batch', ops }); },
      };
    },
    deleteField: () => '__HAPUS__',
    increment: (n) => ({ __tambah: n }),
    serverTimestamp: () => '__SEKARANG__',
    Timestamp: { fromDate: tsDari, now: () => tsDari(new Date()) },
  },
  { get: (t, k) => (k in t ? t[k] : () => ({})) },
);

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: (_, k) => (k === 'CHART_COLORS' ? [] : '#000000') }) };
  if (req === './firebase') return { db: {}, auth: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {}, unsubscribeAll: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req === './gemini' || req === './aiGuard') return new Proxy({}, { get: () => () => ({}) });
  if (req === 'firebase/firestore') return firestore;
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (req === '@react-native-async-storage/async-storage') return { __esModule: true, default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  if (req === 'expo-constants') return { __esModule: true, default: { executionEnvironment: 'bare' }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
  if (/^(expo-|react-native|@expo|react$)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const T = require(path.join(OUT, 'today.js'));
const F = require(path.join(OUT, 'fitness.js'));
const U = require(path.join(OUT, 'fun.js'));
const H = require(path.join(OUT, 'health.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

// Minggu, 4 Okt 2026 jam 07.30 — hari timbang.
const MINGGU = new Date(2026, 9, 4, 7, 30);
const HARI = '2026-10-04';
const KOSONG = () => ({
  login: null, bibleReading: null, habits: [], day: null,
  fitDay: { done: {}, skipped: false, picks: [], runs: {}, logs: [] },
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
const PROFIL = (updated) => ({
  birthYear: 1998, heightCm: 169, weightKg: 72.4, waistCm: null, bloodType: null,
  eyeLeft: null, eyeRight: null, updatedAt: updated ? tsDari(updated) : null,
});
const semuaBaris = (m) => [...m.today, ...m.upNext, ...m.later];

(async () => {
  // =====================================================================
  console.log('\n=== H1. Pengingat timbang membuka isian berat ===');
  // =====================================================================
  {
    const input = KOSONG();
    input.profile = PROFIL(new Date(2026, 8, 27));
    const m = T.buildToday(input, MINGGU, HARI);
    const timbang = semuaBaris(m).find((i) => i.id === 'weigh-in');
    ok('hari Minggu & belum timbang → baris ⚖️ sendiri', !!timbang && timbang.emoji === '⚖️');
    ok('click → Profile sub-tab 🧍 dengan editor berat langsung terbuka',
      timbang && timbang.href.pathname === '/profile' &&
        timbang.href.params.tab === 'body' && timbang.href.params.weighIn === '1',
      JSON.stringify(timbang && timbang.href));
    ok('menyebut berat terakhir', timbang && timbang.detail === 'Terakhir 72,4 kg', timbang && timbang.detail);
    ok('tidak lagi menumpang baris 🩺 yang membuka Check-up',
      !semuaBaris(m).some((i) => i.id === 'health'));
    input.profile = PROFIL(new Date(2026, 9, 4, 6, 0));
    ok('sudah timbang hari ini → diam',
      !semuaBaris(T.buildToday(input, MINGGU, HARI)).some((i) => i.id === 'weigh-in'));
    ok('All Reminder juga membuka sub-tab 🧍 (bukan sub-tab pertama Profile)',
      /params: \{ tab: 'body', weighIn: '1' \}/.test(kode('app/reminders.tsx')));
    ok('param weighIn dilepas sesudah dipakai (editor tidak terbuka lagi tiap kunjungan)',
      /openEdit\(\);\s*\n\s*router\.setParams\(\{ weighIn: '' \}\);/.test(kode('components/health/BodyCard.tsx')));
  }

  // =====================================================================
  console.log('\n=== H2. Riwayat berat ⚖️ ===');
  // =====================================================================
  {
    tulisan.length = 0;
    await H.saveHealthProfile('u1', { weightKg: 71.8, heightCm: 169 });
    const b = tulisan[0];
    const log = b && b.ops.find((o) => o.path === 'users/u1/health/weightLog');
    ok('simpan Data Tubuh = SATU batch: profil + titik berat hari ini',
      b && b.op === 'batch' && b.ops.length === 2 && !!log &&
        Object.values(log.data.points)[0] === 71.8 && /^\d{4}-\d{2}-\d{2}$/.test(Object.keys(log.data.points)[0]),
      JSON.stringify(b));
    ok('titiknya digabung (merge), riwayat lama tidak tertimpa', log && log.opt && log.opt.merge === true);
    tulisan.length = 0;
    await H.saveHealthProfile('u1', { waistCm: 80 });
    ok('simpan tanpa berat → riwayatnya tidak disentuh',
      tulisan[0].ops.length === 1 && tulisan[0].ops[0].path === 'users/u1/health/profile');

    const titik = [{ dayId: '2026-09-20', kg: 73 }, { dayId: '2026-10-04', kg: 72 }];
    const prof = PROFIL(new Date(2026, 8, 13)); // disimpan sebelum riwayat ada
    const seri = H.weightSeries(titik, prof);
    ok('berat yang disimpan SEBELUM riwayat ada jadi titik pertamanya',
      seri.length === 3 && seri[0].dayId === '2026-09-13' && seri[0].kg === 72.4,
      JSON.stringify(seri));
    ok('profil yang belum pernah disimpan (angka bawaan) tidak ikut',
      H.weightSeries(titik, PROFIL(null)).length === 2);
    ok('dipotong mulai tanggal yang diminta', H.weightSeries(titik, prof, '2026-10-01').length === 1);
    const pg = kode('components/fitness/ProgressTab.tsx');
    ok('Progress: grafik 12 minggu + garis 🎯 target',
      /const WEIGHT_DAYS = 84;/.test(baca('components/fitness/ProgressTab.tsx')) &&
        /weightSeries\(bodyLog, profile, sejak\)/.test(pg) &&
        /reference=\{\s*target/.test(pg));
    ok('grafik pasar tidak berubah: garis patokan cuma kalau diminta',
      /reference\?: \{ value: number; label: string \};/.test(baca('components/investment/PriceChart.tsx')) &&
        /const lo = reference \? Math\.min\(min, reference\.value\) : min;/.test(baca('components/investment/PriceChart.tsx')));
  }

  // =====================================================================
  console.log('\n=== H3–H5. Steps: target harian, Rekap, satu target mingguan ===');
  // =====================================================================
  {
    const s = kode('components/health/StepsTab.tsx');
    ok('H3 target harian 10.000 langkah, patokan lari harian dibuang',
      H.DAY_STEP_GOAL === 10000 && H.RUN_DAY_MILESTONES === undefined &&
        /total=\{DAY_STEP_GOAL\}/.test(s) && !/Patokan Jarak Harian/.test(s));
    ok('H4 bulan · kuartal · tahun SATU kartu Rekap',
      (s.match(/<RecapCard/g) || []).length === 1 && /\{JUDUL_REKAP\}/.test(s) &&
        !/JUDUL_BULAN|JUDUL_KUARTAL|JUDUL_TAHUN/.test(s));
    ok('H5 Steps cuma punya target mingguanmu sendiri',
      !/Anjuran Kesehatan|WEEK_STEP_GOAL|WEEK_GYM_GOAL/.test(s) && /<WeekTargetCard/.test(s));
    ok('H5 anjurannya jadi garis patokan grafik Fitness',
      /goal=\{WEEK_GYM_GOAL\}/.test(kode('components/fitness/ProgressTab.tsx')) &&
        /goal=\{WEEK_STEP_GOAL\}/.test(kode('components/fitness/ProgressTab.tsx')));
    ok('Reward Distance tetap utuh (rekor jarak sehari bukan patokan harian)',
      /id: 'run5k', category: 'run'/.test(baca('lib/reward.ts')));
  }

  // =====================================================================
  console.log('\n=== H7. Check-up ===');
  // =====================================================================
  {
    const c = kode('components/health/CheckupTab.tsx');
    ok('tombol Catat Pemeriksaan dipatok di atas daftar',
      /<StickyTop>\s*\n\s*<PrimaryButton label="Catat Pemeriksaan"/.test(c) &&
        c.indexOf('<StickyTop>') < c.indexOf('<KeyboardAwareScrollView') &&
        /content: \{ \.\.\.SCREEN_CONTENT_PINNED,/.test(c));
    ok('ikon Info Kesehatan 📋, bukan 💪🏻', /emoji="📋"/.test(kode('app/health.tsx')) && !/💪🏻/.test(kode('app/health.tsx')));
  }

  // =====================================================================
  console.log('\n=== F1. Satu sumber jarak lari ===');
  // =====================================================================
  {
    const hariLama = { done: {}, skipped: false, picks: [], logs: [], runs: { 'easyrun-a': { km: 5, minutes: 32.5 } } };
    const lama = F.fitDayLogs(hariLama);
    ok('hasil bentuk lama dibaca sebagai sesi lari (detik utuh)',
      lama.length === 1 && lama[0].kind === 'run' && lama[0].km === 5 && lama[0].seconds === 1950 && lama[0].pick === 'easyrun-a');
    const rekam = { kind: 'run', seconds: 1800, at: '06.10', km: 5.1, place: 'GBK' };
    const dobel = { ...hariLama, logs: [rekam] };
    ok('hari yang SUDAH punya sesi lari: hasil lama tidak ikut (tidak dobel)',
      F.fitDayLogs(dobel).length === 1 && F.fitDayLogs(dobel)[0].place === 'GBK');
    ok('hasil satu paket: sesi bertanda paket, atau bentuk lamanya',
      F.fitRunResult(hariLama, 'easyrun-a').km === 5 && F.fitRunResult(hariLama, 'tempo-a') === null);

    const ketik = { kind: 'run', seconds: 1500, at: '', km: 4, place: '', pick: 'easyrun-a' };
    tulisan.length = 0;
    await F.saveFitRunLog('u1', HARI, [rekam], ketik);
    const w1 = tulisan[0];
    ok('hasil ketik = sesi baru di daftar yang sama dengan rekaman',
      w1.path === `users/u1/fitnessDays/${HARI}` && w1.data.logs.length === 2 && w1.data.logs[1].pick === 'easyrun-a');
    ok('hasil bentuk lama paket itu ikut dibuang di tulisan yang sama',
      w1.data.runs['easyrun-a'] === '__HAPUS__' && w1.opt.merge === true);
    tulisan.length = 0;
    await F.saveFitRunLog('u1', HARI, [rekam, ketik], { ...ketik, km: 4.5 });
    ok('satu paket = satu lari: menyimpan lagi MENGGANTI, bukan menambah',
      tulisan[0].data.logs.length === 2 && tulisan[0].data.logs[1].km === 4.5);
    tulisan.length = 0;
    await F.saveFitRunLog('u1', HARI, [rekam, ketik], { ...ketik, km: 0, seconds: 0 });
    ok('isian dikosongkan = hasilnya dihapus, rekaman lain utuh',
      tulisan[0].data.logs.length === 1 && tulisan[0].data.logs[0].place === 'GBK');

    const minggu = {
      a: { ...hariLama },
      b: { done: {}, skipped: false, picks: [], runs: {}, logs: [rekam, { kind: 'walk', seconds: 2400, at: '', km: 3, place: '' }, { kind: 'strength', seconds: 3000, at: '', km: 0, place: '' }] },
    };
    const t = F.fitDistanceTotals(minggu);
    ok('jarak minggu ini = lari & jalan dari SATU daftar (beban tidak ikut)',
      Math.abs(t.km - 13.1) < 1e-9 && t.sessions === 3, JSON.stringify(t));
    ok('riwayat & Progress membaca daftar itu',
      /fitDayLogs\(readFitDay\(d\.data\(\)\)\)/.test(kode('lib/fitness.ts')) &&
        /fitDistanceTotals\(weekDays\)/.test(kode('components/fitness/ProgressTab.tsx')));
  }

  // =====================================================================
  console.log('\n=== F2. Riwayat beban 🏋️ ===');
  // =====================================================================
  {
    tulisan.length = 0;
    await F.saveFitWeight('u1', 'benchpress', 45, 40);
    const b = tulisan[0];
    const log = b.ops.find((o) => o.path === 'users/u1/fitness/weightLog');
    ok('kg baru + catatan riwayat dalam SATU batch',
      b.op === 'batch' && b.ops.some((o) => o.path === 'users/u1/fitness/weights' && o.data.map.benchpress === 45) &&
        log && Object.values(log.data.log.benchpress)[0] === 45);
    ok('perubahan pertama membawa titik mulainya (beban lama)', log.data.base && log.data.base.benchpress === 40);
    tulisan.length = 0;
    await F.saveFitWeight('u1', 'benchpress', 50, null);
    ok('perubahan berikutnya tidak menimpa titik mulai',
      !tulisan[0].ops.find((o) => o.path === 'users/u1/fitness/weightLog').data.base);

    const ex = F.FIT_MENU.flatMap((s) => s.exercises).find((e) => !e.cardio && e.weight !== null);
    const lain = F.FIT_MENU.flatMap((s) => s.exercises).find((e) => !e.cardio && e.weight !== null && e.id !== ex.id);
    const wl = {
      base: { [ex.id]: 40 },
      log: {
        [ex.id]: { '2026-09-20': 45, '2026-10-01': 55, '2026-10-03': 50 },
        [lain.id]: { '2026-10-04': 20 },
        hilang: { '2026-10-04': 99 }, // gerakan yang sudah tidak ada di katalog
      },
    };
    const pr = F.fitWeightProgress(wl, { [ex.id]: 50, [lain.id]: 20 });
    const satu = pr.find((p) => p.id === ex.id);
    ok('dari titik mulai → sekarang, dan rekornya',
      satu && satu.from === 40 && satu.to === 50 && satu.best === 55, JSON.stringify(satu));
    ok('yang paling baru diubah di atas; gerakan tak dikenal dilewati',
      pr.length === 2 && pr[0].id === lain.id, pr.map((p) => p.id).join(','));
    ok('Exercise mengoper titik mulai cuma pada perubahan pertama',
      /const awal = fitWeightTracked\(weightLog, editing\.id\)\s*\n\s*\? null\s*\n\s*: weightOf\(editing, weights\);/.test(kode('components/fitness/ExerciseTab.tsx')));
  }

  // =====================================================================
  console.log('\n=== F3–F5. Progress, Program, istirahat ===');
  // =====================================================================
  {
    const pg = kode('components/fitness/ProgressTab.tsx');
    ok('F3 ringkasan minggu: hari latihan · km · streak',
      /📅 Minggu Ini/.test(pg) && /💪 hari latihan/.test(pg) && /🏃 km lari & jalan/.test(pg) && /🔥 streak/.test(pg));
    ok('F3 konsistensi 8 minggu: dua grafik kecil, bukan satu grafik dua sumbu',
      (pg.match(/<WeekBars/g) || []).length === 2 && /const WEEKS_SHOWN = 8;/.test(baca('components/fitness/ProgressTab.tsx')));
    const wb = kode('components/fitness/WeekBars.tsx');
    ok('F3 kolomnya tenang: ≤ 24 px, ujung atas membulat, angka cuma minggu ini',
      /Math\.min\(24, slot \* 0\.6\)/.test(wb) && /const R = 4;/.test(baca('components/fitness/WeekBars.tsx')) &&
        (wb.match(/format\(/g) || []).length === 1);
    ok('F4 tab Program tidak ada lagi; Fitness 4 sub-tab',
      !fs.existsSync(path.join(ROOT, 'components/fitness/ProgramTab.tsx')) &&
        /type Tab = 'exercise' \| 'record' \| 'progress' \| 'notes';/.test(kode('app/fitness.tsx')));
    ok('F4 pencarian fitur "Program" mendarat di Exercise',
      /'Program Latihan', 'Life › Fitness › Exercise › Pick', \{ pathname: '\/fitness', params: \{ tab: 'exercise' \} \}/.test(baca('lib/featureIndex.ts')));
    const ex = kode('components/fitness/ExerciseTab.tsx');
    ok('F5 istirahat: perut 60 dtk, beban lain 90 dtk',
      /return ex\.core \? 60 : 90;/.test(ex));
    ok('F5 sisa waktunya dari jam (HP terkunci tetap benar) & selesai = getar',
      /endsAt: now \+ restSecondsOf\(ex\) \* 1000/.test(ex) && /haptic\('success'\);/.test(ex) &&
        /if \(now >= rest\.endsAt\)/.test(ex));
    ok('F5 cuma untuk gerakan beban hari ini yang belum beres',
      /isToday && !exSkipped && !checked && !ex\.cardio \?/.test(ex));
  }

  // =====================================================================
  console.log('\n=== F6. Race berikutnya 🏁 ===');
  // =====================================================================
  {
    const ent = (id, category, d, extra = {}) => ({
      id, category, title: id, place: '', detail: '', note: '', date: tsDari(d), ...extra,
    });
    const data = { entries: [
      ent('lampau', 'race', new Date(2026, 8, 1)),
      ent('Jakarta Marathon', 'race', new Date(2026, 9, 25), { distanceKm: 21.1 }),
      ent('Bandung Run', 'race', new Date(2026, 10, 15)),
      ent('Gede', 'summit', new Date(2026, 9, 10)),
    ] };
    const r = U.nextRace(data, MINGGU);
    ok('race terdekat yang belum lewat (summit & race lampau tidak ikut)',
      r && r.entry.title === 'Jakarta Marathon' && r.days === 21 && r.dayId === '2026-10-25',
      JSON.stringify(r && { t: r.entry.title, d: r.days }));
    ok('tanpa race mendatang → null', U.nextRace({ entries: [data.entries[0]] }, MINGGU) === null);

    ok('menjelang race (1–28 hari) program menyarankan blok C',
      F.fitBlockOf(MINGGU, '2026-10-25') === 'C' && F.fitBlockOf(MINGGU, '2026-11-01') === 'C');
    ok('hari-H & race yang masih jauh → giliran blok biasa',
      F.fitBlockOf(MINGGU, HARI) === F.fitBlockOf(MINGGU) && F.fitBlockOf(MINGGU, '2026-12-25') === F.fitBlockOf(MINGGU));
    ok('riwayat lama tidak ikut berubah (tanpa race = rumus lama)',
      F.fitSessionFor(MINGGU).id === F.fitSessionOfWeekday(0, F.fitBlockOf(MINGGU)).id);

    const input = KOSONG();
    input.fun = { entries: [ent('Jakarta Marathon', 'race', new Date(2026, 9, 14), { distanceKm: 21.1 })] };
    const baris = semuaBaris(T.buildToday(input, MINGGU, HARI)).find((i) => i.id === 'race-next');
    ok('Today: 10 hari lagi → baris 🏁 "up next" ke Health › Race',
      baris && baris.tier === 'next' && baris.emoji === '🏁' && baris.detail === '10 hari lagi · 21,1 km' &&
        baris.href.params.tab === 'race', JSON.stringify(baris));
    input.fun = { entries: [ent('Jakarta Marathon', 'race', new Date(2026, 9, 4, 5, 0))] };
    const hariH = semuaBaris(T.buildToday(input, MINGGU, HARI)).find((i) => i.id === 'race-next');
    ok('hari-H → masuk "hari ini"', hariH && hariH.tier === 'today' && hariH.detail === 'HARI INI');
    input.fun = { entries: [ent('Jauh', 'race', new Date(2026, 11, 1))] };
    ok('race yang masih jauh tidak memenuhi Today',
      !semuaBaris(T.buildToday(input, MINGGU, HARI)).some((i) => i.id === 'race-next'));

    // Race yang didaftarkan ke depan bukan "kegiatan Fun terakhir".
    const fun = { entries: [ent('Gede', 'summit', new Date(2026, 7, 1)), ent('Nanti', 'race', new Date(2026, 10, 1))] };
    ok('pengingat refreshing tidak didiamkan race yang belum terjadi', U.funReminderDue(fun, MINGGU) === true);
    ok('Fitness & arsip Race menampilkan hitung mundurnya',
      /race && race\.days <= RACE_SHOWN_DAYS/.test(kode('components/fitness/ExerciseTab.tsx')) &&
        /⏳ \{whenLabel\(daysBetween\(new Date\(\), item\.date\.toDate\(\)\)\)\}/.test(kode('components/fun/FunArchive.tsx')));
  }

  console.log(gagal === 0 ? '\n✅ LULUS — review Health & Fitness terbukti.' : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
})();
