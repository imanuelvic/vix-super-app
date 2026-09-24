// 23 Sep 2026 (malam) — 🌙 Night Prayer: daftar doa malam pemiliknya sendiri
// ("Prayer List 🙏 · every night") jadi jadwal yang rapih sebelum tidur.
//
// Yang diuji sungguhan: isi daftarnya, putaran tiap malam (dijalankan untuk
// puluhan hari berturut-turut), jadwal syafaat mingguan, baris di layar Today,
// pengingat 22.00, dan streaknya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-doa-malam');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/nightPrayer.ts'), path.join(ROOT, 'lib/intercession.ts'),
      path.join(ROOT, 'lib/today.ts'), path.join(ROOT, 'lib/notify.ts'), '--ignoreConfig',
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
const M = require(path.join(OUT, 'nightPrayer.js'));
const I = require(path.join(OUT, 'intercession.js'));
const T = require(path.join(OUT, 'today.js'));
const N = require(path.join(OUT, 'notify.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

const HARI = '2026-09-22'; // Selasa
const SIANG = new Date(2026, 8, 22, 13, 0);
const MALAM = new Date(2026, 8, 22, 21, 0);

console.log('\n=== 1. Daftarnya = daftar doa malam pemiliknya sendiri ===');
{
  ok('12 pokok syukur, urutannya persis catatan aslinya',
    M.SYUKUR.length === 12 && M.SYUKUR[0] === 'Sepanjang hari ini & nafas' &&
    M.SYUKUR[11] === 'Barang', M.SYUKUR.length);
  ok('7 pokok pengakuan dosa', M.PENGAKUAN.length === 7 &&
    M.PENGAKUAN[0] === 'Pikiran kotor' && M.PENGAKUAN[6] === 'Menipu dan mencuri');
  ok('16 pokok permohonan untuk diri sendiri', M.PERMOHONAN.length === 16 &&
    M.PERMOHONAN[0] === 'Apa yang harus kuperbuat' && M.PERMOHONAN[15] === 'Doa yang benar');
  ok('hal-hal khasnya tidak hilang (CORE Leader, HIM Youth, Kuliah S2, KK/Usher/Dansek)',
    ['CORE Leader', 'HIM Youth', 'Kuliah S2', 'Pelayanan KK, Usher & Dansek']
      .every((x) => M.PERMOHONAN.includes(x)));
  ok('empat bagian, urutannya syukur → pengakuan → permohonan → syafaat',
    M.NIGHT_SECTIONS.map((s) => s.key).join() === 'syukur,dosa,permohonan,syafaat');
  const teks = [...M.SYUKUR, ...M.PENGAKUAN, ...M.PERMOHONAN,
    ...M.NIGHT_SECTIONS.map((s) => `${s.label} ${s.hint}`)];
  ok('tanpa em dash & tanpa kata menyentuh layar',
    teks.every((t) => !t.includes(String.fromCharCode(0x2014))) &&
    teks.every((t) => !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(t)));
}

console.log('\n=== 2. Jadwal syafaat mingguan = jadwalnya sendiri ===');
{
  const hari = (d) => I.intercessionToday(new Date(2026, 8, 20 + d)); // 20 Sep 2026 = Minggu
  const label = [0, 1, 2, 3, 4, 5, 6].map((d) => hari(d).label);
  ok('Minggu sampai Sabtu persis daftarnya',
    label.join(' | ') === [
      'Keluarga & Saudara', 'Teman Eben Haezar', 'Teman PO & BASIC',
      'Teman GAT & Kawanua', 'Bangsa dan Negara Indonesia',
      'Teman CORE & Gereja', 'Dunia',
    ].join(' | '), label.join(' | '));
  ok('tiap hari punya pokok doanya, tidak ada kartu kosong',
    [0, 1, 2, 3, 4, 5, 6].every((d) => hari(d).points.length >= 3));
  ok('Jumat membawa Pendeta, murid-murid Tuhan & album Kristen',
    hari(5).points.some((p) => /Pendeta/.test(p)) &&
    hari(5).points.some((p) => /Murid-murid Tuhan/.test(p)) &&
    hari(5).points.some((p) => /Album & lagu Kristen/.test(p)));
  ok('kliping berita mingguan tetap nyambung: Kamis "nation", Jumat "church"',
    hari(4).key === 'nation' && hari(5).key === 'church');
}

console.log('\n=== 3. Sabtu: 9 pokok dunia, tiga-tiga per pekan ===');
{
  const sabtu = (pekan) => I.duniaPekanIni(new Date(2026, 8, 26 + pekan * 7));
  ok('tiap Sabtu tepat tiga pokok', [0, 1, 2].every((w) => sabtu(w).length === 3));
  const tiga = [sabtu(0), sabtu(1), sabtu(2)].flat();
  ok('tiga pekan menutupi kesembilannya, tidak ada yang terlewat',
    new Set(tiga).size === 9, `${new Set(tiga).size}`);
  ok('isinya memang daftarnya: penjara, teroris, korban bencana, panti jompo, tunawisma',
    [/Penjara/, /teroris/, /Korban bencana/, /panti jompo/, /tidak punya rumah/]
      .every((r) => tiga.some((p) => r.test(p))));
  ok('pergeseran dunia membawa keempat turunannya sekaligus',
    tiga.some((p) => /percepatan teknologi/.test(p) && /gerakan anti agama/.test(p) &&
      /manusia menjadi dewa/.test(p) && /pergeseran nilai generasi/.test(p)));
  ok('Sabtu yang sama selalu memberi tiga pokok yang sama (bukan acak)',
    sabtu(1).join() === I.duniaPekanIni(new Date(2026, 9, 3)).join());
}

console.log('\n=== 4. Tiap malam sepotong, berputar, tidak ada yang hilang ===');
{
  const plan = (dayId) => M.nightPlan(dayId, SIANG);
  const p = plan(HARI);
  ok('satu malam: 3 syukur + 2 pengakuan + 4 permohonan',
    p.syukur.length === 3 && p.dosa.length === 2 && p.permohonan.length === 4);
  ok('malam yang sama selalu sama isinya (buka-tutup layar tidak mengocok ulang)',
    JSON.stringify(plan(HARI).syukur) === JSON.stringify(p.syukur));
  ok('malam berikutnya berganti', plan('2026-09-23').syukur.join() !== p.syukur.join());

  const hari = (i) => {
    const d = new Date(2026, 8, 22 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const kumpul = (n, ambil) =>
    new Set(Array.from({ length: n }, (_, i) => ambil(plan(hari(i)))).flat());
  ok('4 malam → seluruh 12 pokok syukur kebagian', kumpul(4, (x) => x.syukur).size === 12);
  ok('4 malam → seluruh 16 pokok permohonan kebagian', kumpul(4, (x) => x.permohonan).size === 16);
  ok('7 malam → seluruh 7 pengakuan kebagian', kumpul(7, (x) => x.dosa).size === 7);
  ok('tidak ada pokok yang dilewati berbulan-bulan (90 malam tetap merata)',
    kumpul(90, (x) => x.syukur).size === 12 && kumpul(90, (x) => x.dosa).size === 7 &&
    kumpul(90, (x) => x.permohonan).size === 16);
  ok('putarannya berurutan, bukan undian', M.putaran([1, 2, 3, 4, 5], 0, 3).join() === '1,2,3' &&
    M.putaran([1, 2, 3, 4, 5], 1, 3).join() === '4,5,1');
  ok('daftar kosong tidak bikin jatuh', M.putaran([], 3, 2).length === 0);
  ok('syafaatnya ikut jadwal hari itu, bukan daftar keempat yang terpisah',
    p.syafaat.label === I.intercessionToday(SIANG).label);
  ok('ringkasannya menyebut porsinya & syafaat hari itu',
    M.nightSummary(p) === `3 syukur · 2 pengakuan · 4 permohonan · ${p.syafaat.emoji} ${p.syafaat.label}`,
    M.nightSummary(p));
}

console.log('\n=== 5. Centangnya menumpang, tanpa read Firestore baru ===');
{
  const nf = baca('lib/nightPrayer.ts');
  ok('id centangnya berawalan night-prayer: (tak mungkin bentrok id kebiasaan)',
    M.nightDoneId('syukur') === 'night-prayer:syukur' && M.nightDoneId('syafaat') === 'night-prayer:syafaat');
  ok('disimpan di dokumen harian kebiasaan yang MEMANG sudah dilanggan',
    /setHabitDone\(uid, dayId, nightDoneId\(key\), done\)/.test(nf));
  const kosong = { done: {}, skipped: {}, water: 0, notes: {} };
  const tiga = { ...kosong, done: { 'night-prayer:syukur': true, 'night-prayer:dosa': true, 'night-prayer:permohonan': true } };
  const penuh = { ...kosong, done: { ...tiga.done, 'night-prayer:syafaat': true } };
  ok('hitungannya benar: 0, 3, lalu lengkap',
    M.nightDoneCount(null) === 0 && M.nightDoneCount(tiga) === 3 && M.nightDoneCount(penuh) === 4);
  ok('lengkap cuma kalau keempat bagiannya dicentang',
    M.nightAllDone(tiga) === false && M.nightAllDone(penuh) === true);
  ok('layar Today TIDAK menambah langganan baru untuk ini',
    !/nightPrayer|subscribeNightStreak/.test(baca('hooks/useTodayData.ts')) &&
    /const SOURCES = 37;/.test(baca('hooks/useTodayData.ts')));
  ok('yang punya dokumen sendiri cuma streaknya, di tempat yang sama dengan streak lain',
    /doc\(db, 'users', uid, 'app', 'nightPrayer'\)/.test(nf));
}

console.log('\n=== 6. Streak malam 🔥 ===');
{
  const nf = baca('lib/nightPrayer.ts');
  const hariIni = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  ok('sudah berdoa hari ini → streaknya hidup',
    M.nightStreakAlive({ count: 12, lastDayId: hariIni, best: 20, total: 90 }, hariIni) === 12);
  ok('bolong berhari-hari → kembali 0, bukan angka lama yang menipu',
    M.nightStreakAlive({ count: 12, lastDayId: '2026-01-01', best: 20, total: 90 }, hariIni) === 0);
  ok('belum pernah → 0', M.nightStreakAlive(null, hariIni) === 0);
  ok('naik maksimal sekali sehari, aturannya sama dengan streak Revive & doa pagi',
    /if \(alreadyCounted\(current, todayId\)\) return Promise\.resolve\(\);/.test(nf) &&
    /nextStreak\(current, todayId, yesterdayId\(\)\)/.test(nf));
  ok('naiknya saat bagian KEEMPAT baru dicentang, bukan saat layar dibuka',
    /if \(jadi && selesai \+ 1 === NIGHT_SECTIONS\.length\)/.test(baca('app/night-prayer.tsx')));
}

console.log('\n=== 7. Di layar Today ===');
{
  const KOSONG = () => ({
    login: null, bibleReading: null, habits: [], day: null,
    fitDay: { done: {}, skipped: false, picks: [], runs: {} },
    fastingPlans: [], sermons: [], myReminders: [],
    intercession: I.intercessionToday(SIANG),
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
  const garis = (now, day = null) =>
    T.buildToday({ ...KOSONG(), day }, now, HARI).god.lines;

  const malam = garis(MALAM).find((l) => l.id === 'night-prayer');
  ok('mulai 19.00 muncul baris 🌙 Night Prayer', !!malam && malam.emoji === '🌙');
  ok('barisnya menyebut porsi malam ini, bukan kalimat umum',
    /3 syukur · 2 pengakuan · 4 permohonan/.test(malam.detail), malam.detail);
  ok('click barisnya membuka layar Night Prayer', malam.href.pathname === '/night-prayer');
  ok('siang belum muncul (bukan tagihan sepanjang hari)',
    !garis(SIANG).some((l) => l.id === 'night-prayer'));
  ok('siang tetap ada baris syafaat, dan ia pun menuju Night Prayer',
    garis(SIANG).find((l) => l.id === 'intercession').href.pathname === '/night-prayer');
  ok('malam TIDAK dobel: baris syafaat melebur ke dalam Night Prayer',
    !garis(MALAM).some((l) => l.id === 'intercession'));

  const penuh = { done: { 'night-prayer:syukur': true, 'night-prayer:dosa': true, 'night-prayer:permohonan': true, 'night-prayer:syafaat': true }, skipped: {}, water: 0, notes: {} };
  ok('sudah lengkap → barisnya tenang (done), bukan hilang',
    garis(MALAM, penuh).find((l) => l.id === 'night-prayer').done === true);
  ok('keadaannya dihitung sepanjang hari, jadi jadwal pengingat tetap benar walau app cuma dibuka pagi',
    T.buildToday({ ...KOSONG() }, new Date(2026, 8, 22, 7, 0), HARI).night.summary.length > 0);
}

console.log('\n=== 8. Pengingat 🌙 22.00 ===');
{
  const model = (night) => ({
    god: { state: 'invite', lines: [], streak: 0, nudge: null },
    today: [], upNext: [], later: [],
    reflection: { available: true, text: '', written: false, showGenerate: false, emphasis: false },
    night,
  });
  const slot = (night) =>
    N.buildSlots(model(night), null, { dayId: HARI }).find((s) => s.id === 'night-prayer');
  const belum = slot({ summary: '3 syukur · 2 pengakuan · 4 permohonan · 🌏 Dunia', done: false });
  ok('berbunyi jam 22.00, paling akhir di hari itu', belum.hour === 22 && belum.minute === 0);
  ok('isinya porsi malam ini, kelihatan dari lock screen',
    belum.body === '3 syukur · 2 pengakuan · 4 permohonan · 🌏 Dunia');
  ok('di-click → langsung layar Night Prayer', belum.route.pathname === '/night-prayer');
  ok('sudah didoakan → diam, tidak menagih', slot({ summary: 'x', done: true }).body === null);
  ok('judulnya berganti tiap hari (kolam kalimat, seperti pengingat lain)',
    new Set(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']
      .map((d) => N.buildSlots(model({ summary: 'x', done: false }), null, { dayId: d })
        .find((s) => s.id === 'night-prayer').title)).size >= 2);
  ok('kelompoknya bisa dimatikan sendiri di layar Notification',
    N.NOTIFY_GROUPS.some((g) => g.key === 'night-prayer' && g.opens === 'Night Prayer 🌙'));
  ok('jamnya ikut belajar kebiasaan, di jendela malam',
    /'night-prayer': \{ bawaan: \{ hour: 22, minute: 0 \}/.test(baca('lib/notifyTiming.ts')));
  ok('yang belum didoakan jadi bahan belajar jamnya',
    /if \(!model\.night\.done\) terisi\.push\('night-prayer'\);/.test(baca('lib/notify.ts')));
}

console.log('\n=== 9. Layarnya ===');
{
  const s = baca('app/night-prayer.tsx');
  ok('berpita warna Spiritual, seperti Morning Journey',
    /<ScreenHeader/.test(s) && /'night-prayer': 'spiritual',/.test(baca('lib/featureTheme.ts')));
  ok('judulnya Inggris berlambang, isinya Indonesia', /title="Night Prayer 🌙"/.test(s));
  ok('tiap bagian punya lingkaran centang yang sama dengan Habits & Task',
    /<CheckCircle checked=\{sudah\} \/>/.test(s));
  ok('streaknya kelihatan di pojok kanan pita', /<StreakPill streak=\{nightStreakAlive\(/.test(s));
  ok('rutenya terdaftar di akar app', /<Stack\.Screen name="night-prayer" \/>/.test(baca('app/_layout.tsx')));
  const bersih = s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  ok('tanpa em dash & tanpa kata menyentuh layar',
    !bersih.includes(String.fromCharCode(0x2014)) &&
    !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(bersih));
  ok('jujur bilang daftarnya tetap utuh, cuma dibawa sepotong',
    /Daftar lengkapnya tetap utuh/.test(s));
}

console.log(gagal === 0 ? '\n✅ LULUS — doa malamnya rapih, berputar, & diingatkan.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
