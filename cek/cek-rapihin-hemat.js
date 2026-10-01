// Batch /rapihin 27 Sep 2026 — "hemat": tiga pekerjaan yang semuanya soal
// BIAYA & KERAPUHAN, bukan tampilan. Satu layar pun tidak berubah.
//
//   1. syncNotifications tidak lagi membaca disk tiap 60 detik.
//      Penjaga sidik jadwalnya sudah lama ada, tapi ia diperiksa PALING AKHIR,
//      jadi ~22 pembacaan + 1 penulisan AsyncStorage tetap jalan tiap menit
//      hanya untuk sampai ke kesimpulan "tidak ada yang berubah". Sekarang ada
//      gerbang murah dari bahan MURNInya (model Today + Finance + tanggal) di
//      paling depan.
//
//   2. `greets` dibuang dari TodayInput. Ia dideklarasikan, dilanggan, dioper
//      ke buildToday — dan tidak pernah dibaca. Akibatnya tiap satu ucapan
//      ulang tahun ditulis, SELURUH model Today dibangun ulang dan seluruh
//      notifikasi dijadwalkan ulang tanpa perlu.
//
//   3. Tiap langganan koleksi punya langit-langit. `liveList` tidak punya cache
//      disk, jadi daftar tanpa batas dibaca ulang dari server tiap app dibuka
//      dari mati — dan biayanya tumbuh selamanya.
//
// Yang diuji di §1 DIJALANKAN sungguhan dengan AsyncStorage tiruan yang
// menghitung tiap operasinya, karena inti pekerjaannya justru "berapa kali
// disknya disentuh" — itu tidak bisa dibuktikan dengan membaca kode.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-rapihin-hemat');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/notify.ts'), path.join(ROOT, 'lib/today.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// ---------- AsyncStorage tiruan yang MENGHITUNG ----------
const disk = new Map();
let opsi = 0; // berapa operasi disk sejak terakhir dinolkan
const AsyncStorageTiruan = {
  getItem: async (k) => { opsi++; return disk.has(k) ? disk.get(k) : null; },
  setItem: async (k, v) => { opsi++; disk.set(k, v); },
  removeItem: async (k) => { opsi++; disk.delete(k); },
  multiRemove: async (ks) => { opsi++; ks.forEach((k) => disk.delete(k)); },
};

// ---------- expo-notifications tiruan ----------
// Ditulis lengkap (bukan Proxy serba-bisa) karena yang dihitung justru
// panggilannya: kalau `setBadgeCountAsync` mengembalikan benda tanpa `.catch`,
// syncNotifications masuk ke blok catch-nya dan uji ini jadi menguji jalur yang
// salah tanpa memberi tahu.
let dijadwalkan = [];
let dibatalkan = 0;
let nomor = 0;
const notifTiruan = {
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly' },
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ granted: true }),
  requestPermissionsAsync: async () => ({ granted: true }),
  scheduleNotificationAsync: async (isi) => {
    nomor += 1;
    dijadwalkan.push(isi);
    return `n${nomor}`;
  },
  cancelScheduledNotificationAsync: async () => { dibatalkan += 1; },
  setBadgeCountAsync: async () => true,
};

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'expo-notifications') return notifTiruan;
  if (req === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: AsyncStorageTiruan };
  }
  if (req === 'expo-constants') {
    return { __esModule: true, default: { executionEnvironment: 'bare' }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
  }
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
  if (req === './firebase') return { db: {}, auth: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {}, unsubscribeAll: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req === './gemini' || req === './aiGuard') return new Proxy({}, { get: () => () => ({}) });
  if (req.startsWith('firebase/')) return new Proxy({}, { get: (_, k) => (k === 'Timestamp' ? { now: () => ({}) } : () => ({})) });
  if (/^(expo-|react-native|@expo|react$)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const N = require(path.join(OUT, 'notify.js'));
const T = require(path.join(OUT, 'today.js'));
const CORE = require(path.join(OUT, 'core.js'));
// ⚠️ Module._load SENGAJA masih dipasang di sini — `expo-notifications` di
// lib/notify.ts di-require LAZY (baru saat dipakai), jadi kalau pengalihnya
// dilepas sekarang, yang termuat nanti modul NATIVE-nya: getModule() gagal,
// syncNotifications keluar di baris pertama, dan seluruh uji §1 hijau palsu
// karena "nol operasi disk". Dilepas sesudah §1 selesai.

const HARI = '2026-09-22';
const PAGI = new Date(2026, 8, 22, 7, 30);

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
  // 30 Sep 2026: wishlist tahun berjalan (lib/timeline.ts), penagih tiap
  // Senin. Kosong = tidak ada yang ditagih, keadaan wajar di fixture.
  timeline: [],
  backup: { lastDayId: '', docCount: 0 }, finance: null,
});

const modelOf = (ubah) => {
  const input = KOSONG();
  if (ubah) ubah(input);
  return T.buildToday(input, PAGI, HARI);
};

// Sakelar utamanya sudah menyala — itu keadaan normal pemilik app.
disk.set('notify:on', '1');

const nol = () => { opsi = 0; dijadwalkan = []; dibatalkan = 0; };

// =====================================================================
console.log('=== 1. Sinkron notifikasi: disk cuma disentuh kalau ada yang berubah ===');
// =====================================================================
(async () => {
  const model = modelOf();

  nol();
  await N.syncNotifications(model, null, HARI);
  const opsiPertama = opsi;
  const jadwalPertama = dijadwalkan.length;
  ok('sinkron PERTAMA memang bekerja: membaca disk & menjadwalkan',
    opsiPertama > 5 && jadwalPertama > 0, `${opsiPertama} operasi disk, ${jadwalPertama} notifikasi`);

  nol();
  await N.syncNotifications(model, null, HARI);
  ok('sinkron kedua dengan model SAMA: NOL operasi disk',
    opsi === 0, `${opsi} operasi`);
  ok('…dan tidak menjadwalkan ulang apa pun', dijadwalkan.length === 0 && dibatalkan === 0);

  // Ini yang penting: layar Today membangun model BARU tiap `useNow` berdetak,
  // jadi gerbangnya harus membandingkan ISINYA, bukan alamat objeknya.
  nol();
  await N.syncNotifications(modelOf(), null, HARI);
  ok('objek model BARU tapi isinya sama: tetap NOL operasi disk',
    opsi === 0, `${opsi} operasi`);

  // Bukti bahwa gerbangnya tidak menelan perubahan yang sungguhan.
  nol();
  const modelBeda = modelOf((i) => {
    i.tasks = [{ id: 't1', title: 'Kirim invoice', done: false, category: 'work', dayId: HARI, createdAt: null }];
  });
  await N.syncNotifications(modelBeda, null, HARI);
  ok('model BERUBAH → jadwalnya ditulis ulang dengan isi baru',
    opsi > 5 && dijadwalkan.length > 0, `${opsi} operasi, ${dijadwalkan.length} notifikasi`);
  ok('…dan isi barunya benar-benar sampai ke notifikasinya',
    dijadwalkan.some((d) => /invoice/i.test(d.content.body ?? '')),
    dijadwalkan.map((d) => d.content.title).join(' · '));

  // Tanggal ganti (lewat tengah malam) juga harus membuka gerbangnya.
  nol();
  await N.syncNotifications(modelBeda, null, '2026-09-23');
  ok('tanggal ganti → sinkron jalan lagi walau modelnya sama',
    opsi > 5, `${opsi} operasi`);

  // ---- Keadaan yang hidup di AsyncStorage, bukan di model ----
  // Gerbang murah hanya boleh benar kalau SETIAP penulis keadaan itu
  // melupakan sidiknya. Ketiganya diuji satu per satu.
  await N.syncNotifications(modelBeda, null, '2026-09-23'); // pastikan diam
  nol();
  await N.setGroupEnabled('night-prayer', false);
  nol();
  await N.syncNotifications(modelBeda, null, '2026-09-23');
  ok('kelompok dimatikan → sinkron jalan lagi walau modelnya sama',
    opsi > 5, `${opsi} operasi`);
  ok('…dan kelompok itu benar-benar hilang dari jadwalnya',
    dijadwalkan.length > 0 && !dijadwalkan.some((d) => d.content.data.group === 'night-prayer'),
    dijadwalkan.map((d) => d.content.data.group).join(','));

  nol();
  await N.saveRewardSnapshot({ hints: [], unlocked: 3, total: 40 });
  nol();
  await N.syncNotifications(modelBeda, null, '2026-09-23');
  ok('cuplikan Reward disimpan → sinkron jalan lagi', opsi > 5, `${opsi} operasi`);

  nol();
  await N.setNotifyEnabled(false);
  nol();
  await N.syncNotifications(modelBeda, null, '2026-09-23');
  ok('sakelar utama dimatikan → sinkron cuma membaca sakelarnya, tidak menjadwalkan',
    opsi === 1 && dijadwalkan.length === 0, `${opsi} operasi, ${dijadwalkan.length} notifikasi`);
  nol();
  await N.syncNotifications(modelBeda, null, '2026-09-23');
  ok('…dan sinkron berikutnya sesudah itu NOL operasi (tidak menanya terus)',
    opsi === 0, `${opsi} operasi`);

  nol();
  await N.setNotifyEnabled(true);
  nol();
  await N.syncNotifications(modelBeda, null, '2026-09-23');
  ok('sakelar dinyalakan lagi → jadwalnya kembali',
    dijadwalkan.length > 0, `${dijadwalkan.length} notifikasi`);

  Module._load = asli;

  // =====================================================================
  console.log('\n=== 2. Bentuk gerbangnya dijaga ===');
  // =====================================================================
  const notify = baca('lib/notify.ts');
  // Dicari DI DALAM syncNotifications saja. Sejak 1 Okt 2026 `setAppBadge`
  // juga membaca sakelar yang sama, dan letaknya lebih atas di berkas — jadi
  // mencari dari awal berkas akan menemukan sakelar milik fungsi lain dan
  // menyimpulkan urutannya terbalik.
  ok('gerbang murahnya diperiksa SEBELUM sakelar dibaca dari disk', (() => {
    const badan = notify.slice(notify.indexOf('export async function syncNotifications'));
    const gerbang = badan.indexOf('if (murni === murniTerakhir) return;');
    const sakelar = badan.indexOf('if (!(await notifyEnabled())) return;');
    return gerbang > 0 && sakelar > 0 && gerbang < sakelar;
  })());
  ok('sidiknya dari model + Finance + tanggal, bukan daftar bagian tulis tangan',
    /const murni = `\$\{todayId\}\|\$\{JSON\.stringify\(model\)\}\|\$\{JSON\.stringify\(finance\)\}`;/.test(notify));
  // Satu pintu. Kalau ada yang menulis `terakhir = ''` sendiri lagi, ia lupa
  // `murniTerakhir` — dan gejalanya "notifikasi tidak ikut berubah", jenis bug
  // yang paling lama tak terlihat.
  ok('kedua sidiknya dikosongkan HANYA dari lupakanJadwal()', (() => {
    const badan = /function lupakanJadwal\(\): void \{[\s\S]*?\n\}/.exec(notify)?.[0] ?? '';
    const semuaTerakhir = (notify.match(/^\s*terakhir = '';/gm) || []).length;
    const semuaMurni = (notify.match(/^\s*murniTerakhir = '';/gm) || []).length;
    return /terakhir = '';/.test(badan) && /murniTerakhir = '';/.test(badan) &&
      semuaTerakhir === 1 && semuaMurni === 1;
  })());
  ok('setiap penulis keadaan AsyncStorage memanggilnya (5 tempat)',
    (notify.match(/lupakanJadwal\(\);/g) || []).length >= 5,
    String((notify.match(/lupakanJadwal\(\);/g) || []).length));
  ok('penjaga lama (sidik jadwal) TIDAK dibuang, cuma dapat lapis di depannya',
    /if \(sidik === terakhir\) return;/.test(notify) && /terakhir = sidik;/.test(notify));

  // =====================================================================
  console.log('\n=== 3. Input mati `greets` benar-benar hilang ===');
  // =====================================================================
  const today = baca('lib/today.ts');
  ok('TodayInput tidak lagi punya kolom greets', !/^\s*greets:/m.test(today));
  ok('tipe BirthdayGreets ikut tidak diimpor lagi', !/type BirthdayGreets/.test(today));
  ok('alasannya dicatat di tempat kolomnya dulu berdiri',
    /`greets`\) SENGAJA tidak ada di sini/.test(today));

  const hook = baca('hooks/useTodayData.ts');
  ok('langganan ucapan ulang tahun dilepas dari useTodayData',
    !/subscribeBirthdayGreets/.test(hook) && !/BirthdayGreets/.test(hook));
  ok('SOURCES = jumlah sumber yang benar-benar ditandai', (() => {
    const diminta = Number(/const SOURCES = (\d+);/.exec(hook)[1]);
    const ditandai = (hook.match(/mark\('/g) || []).length;
    // 38 sejak 30 Sep 2026: + wishlist 📍 tahun berjalan (penagih tiap Senin).
    return diminta === ditandai && diminta === 38;
  })(), `${/const SOURCES = (\d+);/.exec(hook)[1]} vs ${(hook.match(/mark\('/g) || []).length} mark(`);
  // Fiturnya sendiri TIDAK hilang: badge ulang tahun di kaki app memakai
  // coreAttention, dan itu yang memang membaca ucapannya.
  ok('badge CORE tetap memakai ucapannya lewat coreAttention',
    /coreAttention\(\{ leaders, mainTeam, visitations, greets/.test(baca('app/(tabs)/_layout.tsx')) &&
      /subscribeBirthdayGreets/.test(baca('app/(tabs)/_layout.tsx')));
  ok('kartu Follow Up juga masih menyaring yang sudah diucapkan',
    /greets\[b\.key\] !== dayId/.test(baca('components/core/FollowupTab.tsx')));

  // =====================================================================
  console.log('\n=== 4. Tiap langganan koleksi punya langit-langit ===');
  // =====================================================================
  // Pengecualian yang SAH, beserta alasannya. Ketiganya dipatok oleh daftar
  // tetap di kode, bukan oleh data yang bisa tumbuh:
  //   • subscribeCoreRules   → satu dokumen per MEETING_KINDS
  //   • subscribeFundBalances→ satu dokumen per FUNDS (sembilan dompet)
  //   • subscribeFundEntries → mutasi SATU dompet, hitungan puluhan per tahun
  const BOLEH = ['subscribeCoreRules', 'subscribeFundBalances', 'subscribeFundEntries'];
  const tanpaBatas = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'lib')).filter((x) => x.endsWith('.ts'))) {
    const s = baca('lib/' + f);
    const re = /export function (subscribe\w+)\(([\s\S]*?)\n\}/g;
    let m;
    while ((m = re.exec(s))) {
      if (!/liveList/.test(m[2])) continue;
      if (BOLEH.includes(m[1])) continue;
      // Terbatas kalau: ada limit(), ada where() (rentang), atau kuerinya
      // dibangun penolong ber-akhiran Query() yang batasnya di dalam sana.
      const terbatas = /limit\(/.test(m[2]) || /where\(/.test(m[2]) || /\w+Query\(/.test(m[2]);
      if (!terbatas) tanpaBatas.push(`lib/${f} ${m[1]}`);
    }
  }
  ok('tidak ada langganan koleksi tanpa batas di seluruh lib/',
    tanpaBatas.length === 0, tanpaBatas.join(', '));

  const batas = [
    ['lib/tasks.ts', 'subscribeTasks', 'limit(TASK_MAKS)'],
    ['lib/tasks.ts', 'subscribeOtherTasks', 'limit(200)'],
    ['lib/debts.ts', 'subscribeDebts', 'limit(200)'],
    ['lib/family.ts', 'subscribeFamily', 'limit(200)'],
    ['lib/multiplication.ts', 'subscribeMultiplications', 'limit(60)'],
    ['lib/tournament.ts', 'subscribeTournaments', 'limit(60)'],
    ['lib/learning.ts', 'subscribeLearningNotes', 'limit(ARSIP_MAKS)'],
  ];
  for (const [f, fn, teks] of batas) {
    const s = baca(f);
    const blok = new RegExp(`export function ${fn}\\(([\\s\\S]*?)\\n\\}`).exec(s)?.[1] ?? '';
    ok(`${fn} dipatok ${teks}`, blok.includes(teks), blok.slice(0, 120).replace(/\n/g, ' '));
  }
  ok('TASK_MAKS 500 & ARSIP_MAKS 200 ditulis beserta alasannya',
    /const TASK_MAKS = 500;/.test(baca('lib/tasks.ts')) &&
      /rolloverTasks/.test(baca('lib/tasks.ts')) &&
      /const ARSIP_MAKS = 200;/.test(baca('lib/learning.ts')));

  // Batas BUKAN alasan untuk berhenti mencadangkan: Ekspor Data memakai
  // getDocs-nya sendiri, jadi cadangan JSON tetap memuat seluruh koleksi.
  ok('Ekspor Data tidak ikut dibatasi (cadangan tetap utuh)',
    !/limit\(/.test(baca('lib/dataExport.ts')));

  console.log('\n' + (gagal === 0 ? 'LULUS' : `GAGAL — ${gagal} cek`));
  process.exit(gagal === 0 ? 0 : 1);
})();
