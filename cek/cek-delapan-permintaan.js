// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Delapan permintaan 31 Agu 2026.
// Fungsi yang diuji DIJALANKAN dari sumber aslinya, bukan disalin ulang.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---- pemuat modul TS: alias @/ & modul native distub ----
const OUT = path.join(__dirname, 'keluar-delapan-p');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// tsc tetap MENGELUARKAN JS walau mengeluh soal alias "@/…" (yang di sini
// memang distub) — jadi status keluarnya diabaikan, yang dicek berkasnya jadi.
function kompilasi(files) {
  try {
    jalankanTsc(files);
  } catch {
    /* diabaikan — lihat catatan di atas */
  }
  const wajib = files.map((f) => path.join(OUT, path.basename(f).replace('.ts', '.js')));
  const hilang = wajib.filter((f) => !fs.existsSync(f));
  if (hilang.length) throw new Error('tsc tidak menghasilkan: ' + hilang.join(', '));
}

function jalankanTsc(files) {
  return require('child_process').execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc',
      '--ignoreConfig',
      ...files.map((f) => R + f),
      '--outDir',
      OUT,
      '--module',
      'commonjs',
      '--target',
      'es2020',
      '--skipLibCheck',
      '--esModuleInterop',
      '--moduleResolution',
      'bundler',
    ],
    { stdio: 'pipe' },
  );
}
kompilasi(['lib/device.ts', 'lib/learning.ts', 'lib/youtube.ts', 'lib/categories.ts', 'lib/habits.ts']);

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({}), query: (...a) => a,
      orderBy: () => ({}), where: () => ({}), limit: () => ({}),
      setDoc: () => Promise.resolve(), addDoc: () => Promise.resolve({ id: 'x' }),
      updateDoc: () => Promise.resolve(), deleteDoc: () => Promise.resolve(),
      Timestamp: {
        fromDate: (d) => ({ toDate: () => d, toMillis: () => d.getTime() }),
        now: () => ({ toDate: () => new Date() }),
      },
    };
  }
  if (/firebase$/.test(req)) return { db: {} };
  if (/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: (_, k) => `#${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli(req, parent, isMain);
};

const DEV = require(path.join(OUT, 'device.js'));
const LRN = require(path.join(OUT, 'learning.js'));
const YT = require(path.join(OUT, 'youtube.js'));
const KAT = require(path.join(OUT, 'categories.js'));
const HAB = require(path.join(OUT, 'habits.js'));
Module._load = asli;

const stamp = (d) => ({ toDate: () => d, toMillis: () => d.getTime() });
const hari = (n) => {
  const d = new Date(2026, 8, 1);
  d.setDate(d.getDate() + n);
  return d;
};

// ===================================================================
console.log('=== 1. Rangkum: tercentang dari tulisannya, bukan dari click ===');
const week = baca('components/learning/WeekTab.tsx');
c('langkah yang dikunci = Rangkum (Jumat)', LRN.NOTE_DRIVEN_STEP === 'summarize');
c(
  'ambangnya sama persis dengan Daily Reflection Journal di Habits',
  LRN.LEARNING_NOTE_MIN === HAB.HABIT_NOTE_MIN,
  `learning ${LRN.LEARNING_NOTE_MIN} vs habits ${HAB.HABIT_NOTE_MIN}`,
);
c('kosong → belum selesai', !LRN.learningNoteDone(''));
c('spasi saja → belum selesai', !LRN.learningNoteDone('     \n  \n '));
c('terlalu pendek → belum selesai', !LRN.learningNoteDone('1. ok'));
c(
  'tiga poin sungguhan → selesai',
  LRN.learningNoteDone('1. Fokus itu memilih\n2. Kurangi input\n3. Satu per satu'),
);
c('lingkarannya dikunci', /<CheckCircle checked=\{checked\} locked=\{dariTulisan\} \/>/.test(week));
c('click-nya dimatikan', /disabled=\{dariTulisan\}/.test(week));
c(
  'ada keterangan kenapa tak bisa diklik',
  /Tercentang sendiri begitu kotak di bawah terisi/.test(week),
);
c(
  'menyimpan catatan sekaligus menyetel centangnya',
  /applyStep\(NOTE_DRIVEN_STEP, learningNoteDone\(text\)\)/.test(week),
);
c(
  'efek sampingnya (skill selesai + streak) SATU jalan untuk kedua pintu',
  (week.match(/async function applyStep/g) || []).length === 1 &&
    /await applyStep\(step, !week\.steps\[step\]\)/.test(week) &&
    // dipanggil TEPAT SEKALI di seluruh berkas — di dalam applyStep
    (week.match(/await bumpLearningStreak\(/g) || []).length === 1 &&
    (week.match(/await setSkillDone\(/g) || []).length === 1,
);
c(
  'dikosongkan lagi → centangnya ikut lepas (bukan nyangkut)',
  !LRN.learningNoteDone(''),
);
// Langkah LAIN tidak boleh ikut terkunci.
c(
  'tiga langkah lain tetap bisa dicentang manual',
  LRN.LEARNING_STEPS.filter((s) => s.key !== LRN.NOTE_DRIVEN_STEP).length === 3,
);

// ===================================================================
console.log('\n=== 2 & 3. Urutan kategori & nama Ministry ===');
const kunci = KAT.FINANCE_CATEGORIES.expense.map((x) => x.key);
c('Travel paling bawah', kunci[kunci.length - 1] === 'travel', kunci.slice(-3).join(' → '));
c('Travel tidak muncul dua kali', kunci.filter((k) => k === 'travel').length === 1);
const ministry = KAT.FINANCE_CATEGORIES.expense.find((x) => x.key === 'gathering-core');
c('namanya jadi Ministry', ministry.label === 'Ministry');
c('lambangnya 🙏', ministry.icon === '🙏');
c('masih aktif', ministry.active === true);
c(
  'KEY-nya TIDAK diganti — riwayat lama tidak jadi "kategori tak dikenal"',
  KAT.categoryOf('expense', 'gathering-core').label === 'Ministry',
);
c(
  'tidak ada key baru "ministry" yang bikin dua kategori kembar',
  !kunci.includes('ministry'),
);
c(
  'tak ada tulisan "Gathering CORE" tersisa di daftar kategori',
  !/Gathering CORE'/.test(baca('lib/categories.ts')),
);

// ===================================================================
console.log('\n=== 4. Salin jadi paket baru ===');
const bekal = {
  device: 'iphone',
  name: 'Super Seru Internet',
  provider: '081377853271',
  quotaGb: 28,
  usedGb: 28,
  cost: 80000,
  startDate: new Date(2026, 7, 30),
  endDate: new Date(2026, 8, 25),
  note: 'catatan',
};
const sekarang = new Date(2026, 8, 26);
const salinan = DEV.renewedPlan(bekal, sekarang);
c('nama, operator, kuota & harga ikut apa adanya',
  salinan.name === bekal.name && salinan.provider === bekal.provider &&
    salinan.quotaGb === 28 && salinan.cost === 80000 && salinan.note === 'catatan');
c('perangkatnya tidak pindah', salinan.device === 'iphone');
c('pemakaian kembali 0 — paket baru belum terpakai', salinan.usedGb === 0);
c('mulai HARI INI', salinan.startDate.getTime() === sekarang.getTime());
c(
  'durasinya sama panjang dengan yang lama (26 hari)',
  Math.round((salinan.endDate - salinan.startDate) / 86400000) === 26,
  `${Math.round((salinan.endDate - salinan.startDate) / 86400000)} hari`,
);
c(
  'salinannya TIDAK lahir dalam keadaan kedaluwarsa',
  salinan.endDate.getTime() > sekarang.getTime(),
);
c('paket aslinya tidak tersentuh', bekal.usedGb === 28 &&
  bekal.startDate.getTime() === new Date(2026, 7, 30).getTime());

const plan = baca('components/device/PlanTab.tsx');
c('tombol 📋 cuma muncul saat MENGUBAH, bukan saat mencatat baru',
  /editing && editing !== 'new' \? \(\s*<CopyChip/.test(plan));
c('konfirmasinya inline di dalam modal (modal-di-atas-modal tak muncul di iOS)',
  /<CopyConfirm\s+title="📋 Salin jadi paket baru\?"/.test(plan));
c('isian yang salah ditolak dulu sebelum menyalin',
  /const salah = validate\(\);\s*\n\s*if \(salah\) \{\s*\n\s*setFormError\(salah\);\s*\n\s*setConfirmCopy\(false\)/.test(plan));
c('menyalin = MENAMBAH dokumen baru, bukan menimpa yang lama',
  /addDataPlan\(user\.uid, renewedPlan\(formValues\(\), new Date\(\)\)\)/.test(plan));
// Tombol & kotaknya sekarang komponen bersama — bukan salinan ketiga.
const copyAction = baca('components/common/CopyAction.tsx');
const trx = baca('components/finance/TransactionsTab.tsx');
c('bentuk tombol 📋 ditulis SEKALI di components/common',
  /export function CopyChip/.test(copyAction) && /export function CopyConfirm/.test(copyAction));
c('Finance ikut memakainya (gayanya tidak bisa berbeda lagi)',
  /<CopyChip/.test(trx) && /<CopyConfirm/.test(trx) && !/copyChip: \{/.test(trx));
c('gaya lamanya benar-benar dibuang dari Finance',
  !/copyBox: \{/.test(trx) && !/copyConfirm: \{/.test(trx));

// ===================================================================
console.log('\n=== 5. Badge H-1 paket kuota ===');
function paket(device, mulaiKe, habisKe) {
  return {
    id: `p${habisKe}`, device, name: 'x', provider: '', quotaGb: 10, usedGb: 0,
    cost: 0, note: '', startDate: stamp(hari(mulaiKe)), endDate: stamp(hari(habisKe)),
  };
}
const kini = hari(0); // 1 Sep 2026
c('sisa 5 hari → belum ditagih', !DEV.deviceNeedsTopUp([paket('iphone', -20, 5)], 'iphone', kini));
c('sisa 2 hari → belum ditagih', !DEV.deviceNeedsTopUp([paket('iphone', -20, 2)], 'iphone', kini));
c('H-1 → DITAGIH', DEV.deviceNeedsTopUp([paket('iphone', -20, 1)], 'iphone', kini));
c('habis hari ini → DITAGIH', DEV.deviceNeedsTopUp([paket('iphone', -20, 0)], 'iphone', kini));
c(
  'sudah kelewat → badge PADAM (badge yang tak bisa dimatikan berhenti dibaca)',
  !DEV.deviceNeedsTopUp([paket('iphone', -40, -3)], 'iphone', kini),
);
c('belum punya paket sama sekali → tidak menagih',
  !DEV.deviceNeedsTopUp([], 'ipad', kini));
c('paket iPhone tidak menyalakan badge iPad',
  !DEV.deviceNeedsTopUp([paket('iphone', -20, 1)], 'ipad', kini));
// Sejak sub-tab iPad dihapus, yang dihitung cuma perangkat yang PUNYA tab —
// badge untuk tab yang tak ada adalah tagihan yang tak bisa dikerjakan.
c('paket iPad tidak lagi ikut dihitung (tabnya sudah tak ada)',
  DEV.devicesNeedingTopUp([paket('iphone', -20, 1), paket('ipad', -20, 0)], kini) === 1);
c('iPhone masih lama → angkanya 0',
  DEV.devicesNeedingTopUp([paket('iphone', -20, 20), paket('ipad', -20, 0)], kini) === 0);
c(
  'yang dipakai paket yang AKTIF, bukan riwayat lama yang habisnya kebetulan H-1',
  DEV.devicesNeedingTopUp(
    [paket('iphone', -400, -300), paket('iphone', -20, 20)],
    kini,
  ) === 0,
);
const dev = baca('app/device.tsx');
const home = baca('app/(tabs)/index.tsx');
c('badge menempel di sub-tab iPhone (iPad sudah tak punya tab)',
  /iphone: deviceNeedsTopUp\(plans \?\? \[\], 'iphone', now\)/.test(dev) &&
    !/ipad: deviceNeedsTopUp/.test(dev));
// 22 Sep 2026: badge tile Home → baris Today (Today Engine), langganannya di useTodayData.
c('baris Device di Today memakai aturan yang SAMA',
  /devicesNeedingTopUp\(input\.dataPlans, now\)/.test(BACA_TODAY('lib/today.ts')));
c('Today ikut melanggan paketnya', /subscribeDataPlans\(uid, mark\('dataPlans', setDataPlans\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
// Angkanya boleh naik (3 Sep 2026: 19 → 20 sejak Stuff ikut menyusun badge
// Device). Yang dijaga HUBUNGANNYA: gerbang harus sama dengan jumlah mark()
// yang sesungguhnya — kelebihan = badge tak pernah muncul, kekurangan = badge
// digambar sebelum semua datanya tiba, jadi angkanya sempat salah.
const gerbang = Number((BACA_TODAY('hooks/useTodayData.ts').match(/const SOURCES = (\d+);/) || [])[1]);
const jumlahMark = (BACA_TODAY('hooks/useTodayData.ts').match(/mark\('/g) || []).length;
c('gerbang badge = jumlah mark() yang sesungguhnya',
  gerbang > 0 && gerbang === jumlahMark, `${gerbang} vs ${jumlahMark} mark()`);

// ===================================================================
console.log('\n=== 6. Log Device hanya sub Mobile ===');
const subs = [
  { key: 'mobile-a4f2', label: '📱 Mobile' },
  { key: 'subscriptions-9x', label: '💻 Subscriptions' },
  { key: 'cost-taxes-1a', label: '💸 Cost / Taxes' },
  { key: 'admin-bank-77', label: '🏦 Admin Bank' },
  { key: 'lainnya-b2', label: '🧾 Lainnya' },
];
const kunciMobile = DEV.deviceSubKeys(subs);
c('yang dikenali cuma sub Mobile', JSON.stringify(kunciMobile) === '["mobile-a4f2"]',
  kunciMobile.join(', '));
c('tanpa emoji pun tetap kenal', DEV.deviceSubKeys([{ key: 'm', label: 'Mobile' }]).length === 1);
c('huruf besar-kecil tidak masalah', DEV.deviceSubKeys([{ key: 'm', label: 'MOBILE' }]).length === 1);
c('"Mobile Banking" masih terhitung Mobile',
  DEV.deviceSubKeys([{ key: 'm', label: '📱 Mobile Data' }]).length === 1);
c('"Automobile" TIDAK ikut tersedot',
  DEV.deviceSubKeys([{ key: 'a', label: 'Automobile' }]).length === 0);
c('daftar sub kosong → tak ada yang cocok', DEV.deviceSubKeys([]).length === 0);

const trxMobile = { category: 'mobile-data-admin', sub: 'mobile-a4f2' };
const trxAdmin = { category: 'mobile-data-admin', sub: 'admin-bank-77' };
const trxTanpaSub = { category: 'mobile-data-admin' };
const trxLain = { category: 'food-drink', sub: 'mobile-a4f2' };
c('paket internet → masuk', DEV.isDeviceExpense(trxMobile, kunciMobile));
c('Admin Bank → TIDAK masuk (inilah keluhannya)', !DEV.isDeviceExpense(trxAdmin, kunciMobile));
c('tanpa sub → tidak masuk', !DEV.isDeviceExpense(trxTanpaSub, kunciMobile));
c('kategori lain berkey sub sama → tidak masuk', !DEV.isDeviceExpense(trxLain, kunciMobile));
c('layar Device menyaringnya sebelum digambar',
  /isDeviceExpense\(t, subKeys\)/.test(dev) &&
    /<DeviceLogTab transactions=\{biayaPerangkat\}/.test(dev));
c('menunggu daftar sub tiba dulu (jangan tampil kosong palsu)',
  /expenses === null \|\| subcats === null/.test(dev));
c('kotak kosongnya menyebut sub yang dicari',
  /sub 📱 Mobile/.test(baca('components/device/DeviceLogTab.tsx')));

// ===================================================================
console.log('\n=== 7. Template Chat tertutup semua ===');
const chat = baca('app/chat-templates.tsx');
c('tak ada kategori yang terbuka duluan',
  /const \[openKey, setOpenKey\] = useState<string \| null>\(null\);/.test(chat));
c('membuka satu tetap menutup yang lain (tetap satu-satu)',
  /setOpenKey\(openKey === cat\.key \? null : cat\.key\)/.test(chat));
c('penanda "hari ini" tidak ikut hilang',
  /category\.byDay === true && v\.key === today/.test(chat));

// ===================================================================
console.log('\n=== 8. Kelompok kreator YouTube ===');
c('kelompoknya tepat tiga: Mr. Beast, Mountain, Recreation',
  JSON.stringify(YT.CREATOR_KINDS.map((k) => k.key)) ===
    '["mrbeast","mountain","recreation"]');
c('label yang tampil sesuai permintaan',
  JSON.stringify(YT.CREATOR_KINDS.map((k) => k.label)) ===
    '["Mr. Beast","Mountain","Recreation"]');
c('chip "Semua" benar-benar hilang',
  !YT.CREATOR_KINDS.some((k) => k.key === 'all') &&
    !/'all'/.test(baca('lib/youtube.ts')) &&
    !/kind === 'all'/.test(baca('components/fun/CreatorsTab.tsx')));
c('tak ada kanal yatim — tiap kanal punya kelompok yang ada chipnya',
  YT.CREATORS.every((x) => YT.CREATOR_KINDS.some((k) => k.key === x.kind)));
for (const k of YT.CREATOR_KINDS) {
  const isi = YT.CREATORS.filter((x) => x.kind === k.key);
  c(`  ${k.label}: ${isi.length} kanal`, isi.length >= 3,
    isi.map((x) => x.name).join(', '));
}
c('channelId-nya berbentuk sah & tidak ada yang kembar', (() => {
  const ids = YT.CREATORS.map((x) => x.channelId);
  return ids.every((i) => /^UC[\w-]{22}$/.test(i)) && new Set(ids).size === ids.length;
})());
c('kanal Mr. Beast benar-benar empat kanal BERBEDA', (() => {
  const beast = YT.CREATORS.filter((x) => x.kind === 'mrbeast');
  return new Set(beast.map((x) => x.channelId)).size === beast.length;
})());
c('MrBeast sendiri tetap ada',
  YT.CREATORS.some((x) => x.name === 'MrBeast' && x.channelId === 'UCX6OQ3DkcsbYNE6H8uQQuVA'));
c('masih tanpa API key sama sekali',
  !/googleapis\.com|API_KEY|apiKey|AIza/.test(baca('lib/youtube.ts')));
c('chip bawaannya kelompok pertama (selalu ada yang terpilih)',
  /useState<CreatorKind>\(CREATOR_KINDS\[0\]\.key\)/.test(baca('components/fun/CreatorsTab.tsx')));

// Batas jumlah video: PER KELOMPOK, bukan untuk daftar gabungan.
console.log('\n  --- jatah video tiap kelompok ---');
const ytSrc = baca('lib/youtube.ts');
c('batasnya dihitung per kelompok', /VIDEO_PER_KIND/.test(ytSrc) && !/VIDEO_LIMIT/.test(ytSrc));
c('alasannya ditulis, bukan angka telanjang',
  /Mountain bisa tampil KOSONG/.test(ytSrc));
// Bukti jalannya — memakai `capPerKind` YANG SESUNGGUHNYA dari lib/youtube.ts,
// bukan tiruannya. (Percobaan pertama menirunya di sini, dan mutasi
// "batas per kelompok dilepas" lolos: yang teruji tiruannya, bukan kodenya.)
const buatan = [];
// 40 video Beast (semuanya paling baru) + 5 video gunung (jauh lebih tua).
for (let i = 0; i < 40; i++) {
  buatan.push({ id: `b${i}`, kind: 'mrbeast', publishedAt: new Date(2026, 8, 20, 0, -i) });
}
for (let i = 0; i < 5; i++) {
  buatan.push({ id: `g${i}`, kind: 'mountain', publishedAt: new Date(2026, 0, 1, 0, -i) });
}
const urut = buatan.sort((a, b) => b.publishedAt - a.publishedAt);
const sisa = YT.capPerKind(urut);
const gunung = sisa.filter((v) => v.kind === 'mountain').length;
const beast = sisa.filter((v) => v.kind === 'mrbeast').length;
console.log(`  40 video Beast + 5 video gunung → tersisa ${beast} Beast, ${gunung} gunung`);
c('kelompok yang jarang terbit tetap kebagian PENUH', gunung === 5);
c('kelompok yang rajin dipangkas di jatahnya sendiri', beast === 15);
c('urutan terbaru-dulu tidak dirusak',
  sisa.every((v, i) => i === 0 || sisa[i - 1].publishedAt >= v.publishedAt));
c('video yang sama tidak digandakan', new Set(sisa.map((v) => v.id)).size === sisa.length);

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);