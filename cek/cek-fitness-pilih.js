// Fitness dirombak total (10 Sep 2026): sesi harian tidak lagi DITENTUKAN
// hari, tapi DIPILIH sendiri. Program mingguan turun pangkat jadi saran.
//
// Yang dijaga di sini bukan cuma bentuk kodenya — sebagian besar cek di bawah
// MENJALANKAN lib-nya sungguhan, karena yang berbahaya dari perombakan ini
// bukan tampilannya, melainkan riwayat yang bisa terbaca kosong.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');
const kode = (f) =>
  baca(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const tsc = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
const pasang = (js, req) => {
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
};

// Blok dipatok A (weekIndex 0) supaya saran programnya bisa ditebak & diuji.
const gymBump = [];
const F = pasang(tsc(baca('lib/fitness.ts')), (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './core') return { pickOfDay: (a) => a[0], weekIndex: () => 0 };
  if (nama === './daypart') return { DAYPART: { morning: '🌅' } };
  if (nama === './habits') return { FITNESS_HABIT_ID: 'exercise' };
  if (nama === './format')
    return {
      dayIdToDate: (s) => new Date(`${s}T00:00:00`),
      formatDecimal: (n) => String(n),
    };
  if (nama === './health')
    return {
      bmiCategory: () => '',
      bmiValue: () => 0,
      bumpWeekGym: async (_uid, d) => gymBump.push(d.toISOString().slice(0, 10)),
      dayDocId: (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      idealWeightRange: () => ({}),
      setHabitDone: async () => {},
      setHabitSkipped: async () => {},
    };
  if (nama === './streak')
    return {
      EMPTY_DAY_STREAK: { count: 0, lastDayId: '', best: 0, total: 0 },
      nextStreak: (cur, todayId, prevId) => {
        const lanjut = cur !== null && cur.lastDayId === prevId;
        const count = lanjut ? cur.count + 1 : 1;
        return {
          count,
          lastDayId: todayId,
          best: Math.max(count, cur?.best ?? 0),
          total: (cur?.total ?? 0) + 1,
        };
      },
    };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return {};
});

const SENIN = new Date('2026-09-07T00:00:00');
const kosong = { done: {}, skipped: false, picks: [], runs: {} };

// ============================================================
console.log('=== 1. Katalog paket — 18, idnya tetap & unik ===');
// ============================================================
c('hari itu memang Senin (dasar cek saran program di bawah)', SENIN.getDay() === 1);
c('katalognya 18 paket', F.FIT_MENU.length === 18, String(F.FIT_MENU.length));
c('tiap id unik', new Set(F.FIT_MENU.map((s) => s.id)).size === 18);
c('tiap paket punya isi yang lengkap',
  F.FIT_MENU.every(
    (s) => s.id && s.emoji && s.title && s.focus && s.minutes > 0 && s.exercises.length > 0,
  ));
// Jalan pagi dipakai ketiga blok — kalau ikut disalin per blok, ia muncul 3×
// di daftar pilihan sebagai tiga paket berbeda yang isinya sama persis.
c('paket jalan tidak tersalin per blok',
  F.FIT_MENU.filter((s) => s.kind === 'walk').length === 2);
c('ketiga kelompoknya terwakili',
  F.FIT_MENU_GROUPS.map((g) => g.kind).join() === 'strength,run,walk' &&
    F.FIT_MENU_GROUPS.every((g) => F.FIT_MENU.some((s) => s.kind === g.kind)));
// Paket berjudul sama di blok A & B cuma beda gerakannya — tanpa penanda
// variasi keduanya terbaca sebagai satu paket yang muncul dua kali.
{
  const kembar = F.FIT_MENU.filter((s) => s.title === 'Dada, Bahu & Trisep');
  c('paket kembar dibedakan variasinya',
    kembar.length === 2 &&
      new Set(kembar.map((s) => F.fitMenuLabel(s))).size === 2 &&
      kembar.every((s) => /variasi [AB]$/.test(F.fitMenuLabel(s))),
    kembar.map((s) => F.fitMenuLabel(s)).join(' | '));
  c('paket berjudul unik tidak diberi embel-embel',
    F.fitMenuLabel(F.fitMenuById('longrun-c')) === 'Long Run Persiapan Race');
}
c('id yang tak dikenal tidak meledak, cuma undefined',
  F.fitMenuById('paket-yang-sudah-dihapus') === undefined);

// ============================================================
console.log('\n=== 2. Riwayat lama TIDAK boleh hilang ===');
// ============================================================
// Ini bagian paling berbahaya dari perombakan ini. Dokumen harian yang ditulis
// SEBELUM hari ini tidak punya `picks` sama sekali — dulu sesinya tak perlu
// dicatat karena bisa dihitung dari tanggalnya. Kalau bagian ini salah,
// seluruh centang, tanda ✓ mingguan & streak yang sudah terkumpul terbaca
// kosong, dan tidak ada cara mengembalikannya.
{
  const saranSenin = F.fitSessionFor(SENIN);
  c('saran program Senin = paket dada blok A', saranSenin.id === 'chest-a');

  const hariLama = {
    done: Object.fromEntries(saranSenin.exercises.map((e) => [e.id, true])),
    skipped: false,
    picks: [], // ← persis seperti dokumen lama
    runs: {},
  };
  c('hari lama jatuh balik ke sesi programnya',
    F.fitPicksOf(hariLama, SENIN).join() === 'chest-a');
  c('gerakannya terbaca lengkap, bukan kosong',
    F.fitExercisesOf(hariLama, SENIN).length === saranSenin.exercises.length);
  c('hari lama yang tuntas TETAP terhitung tuntas',
    F.fitDayComplete(hariLama, SENIN) === true);

  // Hari benar-benar kosong ≠ hari lama. Tanpa pembeda ini, tiap hari yang
  // belum kamu isi akan terlihat "sudah punya sesi" — dan tanda merah "tidak
  // olahraga" tidak akan pernah muncul.
  c('hari yang memang kosong tetap kosong',
    F.fitPicksOf(kosong, SENIN).length === 0 &&
      F.fitExercisesOf(kosong, SENIN).length === 0 &&
      F.fitDayComplete(kosong, SENIN) === false);
  c('hari tanpa catatan sama sekali juga kosong',
    F.fitPicksOf(undefined, SENIN).length === 0);
}

// ============================================================
console.log('\n=== 3. Boleh pilih lebih dari satu sehari ===');
// ============================================================
{
  // Contoh nyata pemiliknya: pagi lari 5K di GBK, sore masih sempat kaki.
  const hari = { ...kosong, picks: ['easyrun-a', 'legs-a'] };
  const lari = F.fitMenuById('easyrun-a');
  const kaki = F.fitMenuById('legs-a');
  const gerakan = F.fitExercisesOf(hari, SENIN);

  c('kedua paketnya terbaca', F.fitSessionsOf(hari, SENIN).length === 2);
  c('daftar gerakannya digabung jadi satu ceklis',
    gerakan.length > lari.exercises.length && gerakan.length > kaki.exercises.length);
  // Gerakan yang sama tidak boleh minta dicentang dua kali.
  c('gerakan kembar antar-paket cuma muncul sekali',
    new Set(gerakan.map((e) => e.id)).size === gerakan.length);
  c('durasinya dijumlah, bukan diambil salah satu',
    F.fitPickedMinutes(hari, SENIN) === lari.minutes + kaki.minutes);

  // Tuntas = SEMUA gerakan dari SEMUA paket. Menambah kategori di tengah hari
  // memang membuat hari yang tadinya beres jadi belum beres lagi — itu benar.
  const separuh = { ...hari, done: Object.fromEntries(lari.exercises.map((e) => [e.id, true])) };
  c('separuh paket tuntas belum berarti harinya tuntas',
    F.fitDayComplete(separuh, SENIN) === false);
  const penuh = { ...hari, done: Object.fromEntries(gerakan.map((e) => [e.id, true])) };
  c('semua gerakan tercentang → harinya tuntas', F.fitDayComplete(penuh, SENIN) === true);
  c('hari yang dilewati ❌ tidak pernah tuntas',
    F.fitDayComplete({ ...penuh, skipped: true }, SENIN) === false);
}

// ============================================================
console.log('\n=== 4. Badge: hari kosong pun tetap menagih ===');
// ============================================================
{
  const jam7 = new Date('2026-09-07T07:00:00'); // dalam jendela pengingat pagi
  const jam13 = new Date('2026-09-07T13:00:00'); // di luar jendela
  c('jam kerja tidak ditagih', F.fitPendingToday(kosong, jam13) === 0);
  // Tanpa aturan ini badge-nya 0 sepanjang hari yang kosong — padahal hari
  // kosong itulah yang justru paling perlu ditagih.
  c('belum memilih apa pun → tepat 1 hal menunggu',
    F.fitPendingToday(kosong, jam7) === 1);
  c('hari yang dilewati ❌ tidak menagih apa-apa',
    F.fitPendingToday({ ...kosong, skipped: true }, jam7) === 0);
  {
    const paket = F.fitMenuById('easyrun-a');
    const hari = { ...kosong, picks: ['easyrun-a'] };
    c('sudah memilih → angkanya = gerakan yang belum dicentang',
      F.fitPendingToday(hari, jam7) === paket.exercises.length);
    const beres = {
      ...hari,
      done: Object.fromEntries(paket.exercises.map((e) => [e.id, true])),
    };
    c('beres semua → tidak menagih lagi', F.fitPendingToday(beres, jam7) === 0);
    c('baris cermin Habits ikut keadaan yang sama',
      F.fitMirrorState(beres, jam7).done === true &&
        F.fitMirrorState(hari, jam7).done === false);
  }
}

// ============================================================
console.log('\n=== 5. Streak 🔥 hari ke hari, tanpa hari istimewa ===');
// ============================================================
// Dulu jalan pagi dilompati supaya Selasa → Kamis nyambung. Aturan itu tidak
// bisa dipertahankan: app tak lagi tahu hari mana yang seharusnya ringan.
const fitLib = kode('lib/fitness.ts');
c('penanda "hari jalan" sudah tidak ada lagi', !/isFitWalkDay/.test(fitLib));
c('streaknya nyambung ke KEMARIN, bukan ke hari inti terakhir',
  /function prevDayId/.test(fitLib) &&
    /streak = nextStreak\(streak, id, prevDayId\(d\)\);/.test(fitLib));
c('rekap gym mingguan naik kalau ada paket beban di hari itu',
  /fitSessionsOf\(days\[id\], d\)\.some\(\(s\) => s\.kind === 'strength'\)/.test(fitLib));
// Hari yang isinya cuma jalan pun kini menaikkan streak — itulah jalan keluar
// untuk hari istirahat, menggantikan pengecualian yang dibuang.
{
  const jalan = F.fitMenuById('walk-recovery');
  const hari = {
    ...kosong,
    picks: ['walk-recovery'],
    done: Object.fromEntries(jalan.exercises.map((e) => [e.id, true])),
  };
  c('hari yang isinya cuma jalan tetap terhitung tuntas',
    F.fitDayComplete(hari, SENIN) === true);
}

// ============================================================
console.log('\n=== 6. Hasil lari 🏃 — angkanya, bukan cuma centang ===');
// ============================================================
c('pace dihitung dari jarak & waktu', F.fitPace(5, 32) === '6:24 /km');
c('pembulatan 60 detik naik ke menit berikutnya, bukan ":60"',
  !/:60/.test(F.fitPace(6, 35.996)), F.fitPace(6, 35.996));
c('jarak/waktu kosong tidak menghasilkan pace ngawur',
  F.fitPace(0, 30) === '' && F.fitPace(5, 0) === '');
{
  const minggu = {
    'd1': { ...kosong, runs: { 'easyrun-a': { km: 5, minutes: 32 } } },
    'd2': { ...kosong, runs: { 'interval-a': { km: 3, minutes: 18 } } },
    // Dicentang selesai tapi angkanya dikosongkan — itu BUKAN lari sejauh nol.
    'd3': { ...kosong, runs: { 'easyrun-a': { km: 0, minutes: 0 } } },
  };
  const t = F.fitRunTotals(minggu);
  c('totalnya dijumlah dari seluruh hari', t.km === 8 && t.minutes === 50);
  c('sesi tanpa angka tidak dihitung sebagai 0 km', t.sessions === 2);
}

// ============================================================
console.log('\n=== 7. Layarnya ikut kenyataan barunya ===');
// ============================================================
const ex = kode('components/fitness/ExerciseTab.tsx');
const prog = kode('components/fitness/ProgramTab.tsx');
const dash = kode('app/reminders.tsx');

c('tab Exercise tak lagi menghitung sesi dari hari + blok',
  !/fitSessionOfWeekday/.test(ex) && /fitSessionsOf\(/.test(ex));
c('ada pintu memilih & membuang kategori',
  /setPickerOpen\(true\)/.test(ex) && /buangPick/.test(ex));
// Sheet-nya memakai draf lokal supaya memilih 3 kategori = SATU tulis
// Firestore, bukan tiga.
c('pilihannya disusun dulu, baru ditulis sekali',
  /const \[draf, setDraf\] = useState<string\[\]>\(\[\]\)/.test(ex) &&
    /onConfirm=\{\(\) => simpanPicks\(draf\)\}/.test(ex));
c('saran program bisa diambil satu klik, dan hilang setelah diambil',
  /const saran = fitSessionFor\(today\);/.test(ex) &&
    /saranBelumDiambil/.test(ex) &&
    /const ambilSaran = /.test(ex));
c('isian hasil lari muncul per paket lari',
  /sesiHari\.filter\(\(s\) => s\.kind === 'run'\)/.test(ex) && /setFitRun\(/.test(ex));

// Menyimpan pilihan + menyelaraskan cermin Habits ditulis SEKALI di lib —
// dua layar memakainya, dan cermin Habits itu yang paling gampang terlupa
// kalau logikanya disalin.
c('penyimpan pilihan dipakai bersama, bukan disalin',
  /export async function applyFitPicks/.test(fitLib) &&
    /applyFitPicks\(/.test(ex) &&
    /applyFitPicks\(/.test(prog));
// Buktinya STRUKTURAL, bukan kalimat: tab Program tak lagi memutuskan isi
// harimu — ia cuma menawarkan, dan tombol itulah tawarannya.
c('tab Program menawarkan, bukan menentukan',
  /Ambil untuk hari ini/.test(prog) &&
    /applyFitPicks\(/.test(prog) &&
    /const sudahDiambil = dipilih\.includes\(session\.id\);/.test(prog));

// Dashboard: keadaan KETIGA yang dulu tidak mungkin ada.
c('Dashboard punya kartu untuk hari yang belum dipilih',
  /const pickDue = fitBelumPilih && fitLeft > 0;/.test(dash) &&
    /🤔 Exercise Reminder/.test(dash));
c('kartu itu ikut menyalakan blok reminder, bukan menggantung',
  /pickDue \|\|/.test(dash));
c('judul kartunya menyebut paket yang KAMU ambil',
  /const fitJudul = fitBelumPilih/.test(dash) && /lagi/.test(dash));

console.log(
  ok
    ? '\n✅ LULUS — Fitness pilih-sendiri terbukti, riwayat lama aman.'
    : '\n❌ ADA YANG GAGAL',
);
process.exit(ok ? 0 : 1);
