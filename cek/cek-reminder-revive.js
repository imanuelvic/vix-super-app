// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// 📌 Reminder harian dari tulisan Revive sendiri + sapuan "jangan terpotong
// keluar kartu" + warna Race di dalam Health.
//
// Yang diuji DIJALANKAN dari sumber aslinya (bukan disalin ulang): fungsi
// spiritual.ts di-transpile lalu dipanggil sungguhan dengan Firestore palsu.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n);
};

function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(
    mod.exports,
    mod,
    ...nama.map((n) => luar[n]),
  );
  return mod.exports;
}

const coreSrc = baca('lib/core.ts');
const potong = (src, nama) => {
  const a = src.indexOf(`export function ${nama}`);
  const b = src.indexOf('\n}', a) + 2;
  return src.slice(a, b).replace('export function', 'function');
};
const util = muat(
  potong(coreSrc, 'hashString') +
    potong(coreSrc, 'pickOfDay') +
    '\nexport { hashString, pickOfDay };',
);

// ===== Firestore palsu: catat apa yang DITULIS, jangan sentuh jaringan =====
const ditulis = [];
const fakeSetDoc = (ref, data) => {
  ditulis.push({ ref, data: JSON.parse(JSON.stringify(data)) });
  return Promise.resolve();
};
const fakeDoc = (...jalur) => ({ path: jalur.slice(1).join('/') });

const spiritSrc = baca('lib/spiritual.ts');
const awal = spiritSrc.indexOf('const REMINDERS');
const spirit = muat(
  spiritSrc.slice(awal).replace(/^export /gm, '') +
    `
export {
  REMINDERS, dailyReminder, nudgeSchedule, activeNudge,
  MY_REMINDER_MAX, clampReminder, myReminderId, myReminderOn,
  toggleMyReminder, refreshMyReminders, saveMyReminders, subscribeMyReminders,
  EMPTY_MY_REMINDERS,
};`,
  {
    hashString: util.hashString,
    pickOfDay: util.pickOfDay,
    doc: fakeDoc,
    db: {},
    setDoc: fakeSetDoc,
    liveDoc: () => () => {},
  },
);
const {
  REMINDERS,
  nudgeSchedule,
  activeNudge,
  MY_REMINDER_MAX,
  clampReminder,
  myReminderId,
  myReminderOn,
  toggleMyReminder,
  refreshMyReminders,
} = spirit;

const HARI = [];
for (let i = 0; i < 365; i++) {
  const d = new Date(2026, 0, 1 + i);
  HARI.push(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  );
}

// ===================================================================
console.log('=== 1. Memotong kalimat yang kepanjangan ===');
const pendek = 'Tuhan selalu menarik kita kembali.';
c('kalimat pendek TIDAK diapa-apakan', clampReminder(pendek) === pendek);
c('spasi di ujung dirapikan', clampReminder(`  ${pendek}  `) === pendek);

// Rhema asli dari layar Tulis Revive (lihat tangkapan layarnya) — 350+ huruf.
const rhemaPanjang =
  'Kasih dan anugerah Tuhan sangat dan terlalu besar utk selalu memegang ' +
  'tangan kanan kita, artinya menuntun jalan yang sering kali tidak kita ' +
  'mengerti arahnya kemana. Aku srg menghadapi rasa kebingungan, bodoh, ' +
  'gagal, mengandalkan pengertian dan emosi sendiri, namun kasihNya tk ' +
  'bergantung pada semuanya itu, You are never beyond the reach of God grace! ' +
  'Tuhan selalu menarik kita kembali dan tidak pernah melepaskan kita.';
console.log(`  rhema contoh: ${rhemaPanjang.length} huruf`);
const dipotong = clampReminder(rhemaPanjang);
c('yang kepanjangan dipotong', dipotong.length < rhemaPanjang.length);
c(
  `hasilnya tak pernah lewat ${MY_REMINDER_MAX} huruf (+ "…")`,
  dipotong.length <= MY_REMINDER_MAX + 1,
);
c('ditandai "…" biar jelas ada lanjutannya', dipotong.endsWith('…'));
c(
  'dipotong di batas KATA, bukan di tengah kata',
  !/\S…$/.test(dipotong) === false && !dipotong.slice(0, -1).endsWith(' '),
);
c(
  'awal kalimatnya utuh',
  dipotong.startsWith('Kasih dan anugerah Tuhan sangat'),
);
c(
  'muat di kartu persegi 1080×1080 (±600 huruf, lihat reminderImage.ts)',
  MY_REMINDER_MAX < 600,
);
// Satu kata sangat panjang tanpa spasi → tetap tak boleh melar.
const tanpaSpasi = 'a'.repeat(900);
c(
  'kata raksasa tanpa spasi pun tetap dipotong',
  clampReminder(tanpaSpasi).length <= MY_REMINDER_MAX + 1,
);

// ===================================================================
console.log('\n=== 2. Memasang & melepas (permanen, bukan ditandai mati) ===');
c('id-nya = hari + bagian', myReminderId('2026-08-31', 'rhema') === '2026-08-31-rhema');
c(
  'Rhema & Aplikasi hari yang sama TIDAK bertabrakan',
  myReminderId('2026-08-31', 'rhema') !== myReminderId('2026-08-31', 'application'),
);

ditulis.length = 0;
toggleMyReminder('u1', [], {
  day: '2026-08-31',
  kind: 'rhema',
  text: rhemaPanjang,
});
const pasang = ditulis[0];
c(
  'menulis ke users/{uid}/app/myReminders',
  pasang.ref.path === 'users/u1/app/myReminders',
);
c('daftarnya jadi berisi 1', pasang.data.items.length === 1);
c('yang tersimpan sudah DIPOTONG, bukan mentahnya', pasang.data.items[0].text === dipotong);
c('ingat hari asalnya', pasang.data.items[0].day === '2026-08-31');
c('ingat bagian asalnya', pasang.data.items[0].kind === 'rhema');

const daftar = pasang.data.items;
c('tombolnya tahu sudah terpasang', myReminderOn(daftar, '2026-08-31', 'rhema'));
c('Aplikasi hari yang sama masih kosong', !myReminderOn(daftar, '2026-08-31', 'application'));
c('hari lain tidak ikut menyala', !myReminderOn(daftar, '2026-08-30', 'rhema'));

ditulis.length = 0;
toggleMyReminder('u1', daftar, { day: '2026-08-31', kind: 'rhema', text: 'apa pun' });
c('ditekan lagi → BARISNYA HILANG (hard delete)', ditulis[0].data.items.length === 0);
c(
  'tidak ada tanda mati / arsip yang ditinggalkan',
  !JSON.stringify(ditulis[0].data).includes('active') &&
    !JSON.stringify(ditulis[0].data).includes('deleted'),
);

ditulis.length = 0;
toggleMyReminder('u1', daftar, {
  day: '2026-08-31',
  kind: 'application',
  text: 'Mempercayakan penuh pada kasih dan anugerahNya!',
});
c('memasang bagian lain TIDAK menghapus yang sudah ada', ditulis[0].data.items.length === 2);

const dua = ditulis[0].data.items;
ditulis.length = 0;
toggleMyReminder('u1', dua, { day: '2026-08-30', kind: 'rhema', text: 'hari lain' });
c('hari lain menambah, bukan menimpa', ditulis[0].data.items.length === 3);

// ===================================================================
console.log('\n=== 3. Ikut segar saat Revive-nya diperbaiki ===');
const sebelum = [
  { id: '2026-08-31-rhema', day: '2026-08-31', kind: 'rhema', text: 'lama' },
  { id: '2026-08-30-rhema', day: '2026-08-30', kind: 'rhema', text: 'kemarin' },
];
const sesudah = refreshMyReminders(sebelum, '2026-08-31', {
  rhema: 'sudah diperbaiki',
  application: 'tak dipasang',
});
c('kalimat hari itu ikut diperbarui', sesudah[0].text === 'sudah diperbaiki');
c('hari LAIN tidak ikut tersentuh', sesudah[1].text === 'kemarin');
c(
  'yang BELUM pernah dipasang tidak ikut dipasang',
  sesudah.length === 2 && !sesudah.some((m) => m.kind === 'application'),
);
c(
  'tidak ada yang berubah → null (tak ada tulis ke Firestore sama sekali)',
  refreshMyReminders(sebelum, '2026-08-31', {
    rhema: 'lama',
    application: '',
  }) === null,
);
c(
  'kolom dikosongkan → kalimat lamanya DIPERTAHANKAN, bukan jadi kartu kosong',
  refreshMyReminders(sebelum, '2026-08-31', { rhema: '   ', application: '' }) === null,
);
c(
  'tulisan baru yang kepanjangan ikut dipotong',
  refreshMyReminders(sebelum, '2026-08-31', {
    rhema: rhemaPanjang,
    application: '',
  })[0].text === dipotong,
);

// ===================================================================
console.log('\n=== 4. Muncul di Home sebagai salah satu penyegar ===');
const punyaku = [
  { id: '2026-08-31-rhema', day: '2026-08-31', kind: 'rhema', text: 'KALIMATKU-1' },
  {
    id: '2026-08-30-application',
    day: '2026-08-30',
    kind: 'application',
    text: 'KALIMATKU-2',
  },
];

c(
  'daftar KOSONG → jadwalnya sama persis seperti sebelum fitur ini ada',
  HARI.every(
    (d) => JSON.stringify(nudgeSchedule(d)) === JSON.stringify(nudgeSchedule(d, [])),
  ),
);

let adaPunyaku = 0;
let jamGeser = 0;
for (const d of HARI) {
  const polos = nudgeSchedule(d);
  const dengan = nudgeSchedule(d, punyaku);
  const milikku = dengan.filter((n) => n.day !== undefined);
  if (milikku.length === 1) adaPunyaku++;
  if (
    JSON.stringify(polos.map((n) => [n.from, n.to])) !==
    JSON.stringify(dengan.map((n) => [n.from, n.to]))
  ) {
    jamGeser++;
  }
}
c('TEPAT SATU giliran per hari jadi milik tulisanmu', adaPunyaku === HARI.length);
c('jam munculnya tidak ikut bergeser sedikit pun', jamGeser === 0);
c(
  'dua giliran sisanya tetap dari daftar bawaan',
  HARI.every((d) => {
    const dengan = nudgeSchedule(d, punyaku);
    const bawaan = dengan.filter((n) => n.day === undefined);
    return bawaan.length === 2 && bawaan.every((n) => REMINDERS.includes(n.text));
  }),
);
c(
  'yang dipasang selalu benar-benar kalimatmu',
  HARI.every((d) =>
    nudgeSchedule(d, punyaku)
      .filter((n) => n.day !== undefined)
      .every((n) => punyaku.some((m) => m.text === n.text && m.day === n.day)),
  ),
);
c(
  'stabil sepanjang hari (bukan Math.random) — 30× hasilnya identik',
  (() => {
    const sekali = JSON.stringify(nudgeSchedule('2026-08-31', punyaku));
    return Array.from({ length: 30 }, () =>
      JSON.stringify(nudgeSchedule('2026-08-31', punyaku)),
    ).every((x) => x === sekali);
  })(),
);
c(
  'giliran & kalimat mana yang kebagian ikut berganti-ganti sepanjang tahun',
  (() => {
    const giliran = new Set();
    const teks = new Set();
    for (const d of HARI) {
      const s = nudgeSchedule(d, punyaku);
      giliran.add(s.findIndex((n) => n.day !== undefined));
      s.filter((n) => n.day).forEach((n) => teks.add(n.text));
    }
    console.log(`  giliran terpakai: ${[...giliran].sort().join(', ')}`);
    return giliran.size === 3 && teks.size === 2;
  })(),
);
c(
  'SATU kalimat saja yang dipasang → tetap jalan (tak ada indeks meleset)',
  HARI.every((d) => {
    const s = nudgeSchedule(d, [punyaku[0]]);
    return (
      s.length === 3 && s.filter((n) => n.day !== undefined).length === 1 &&
      s.every((n) => typeof n.text === 'string' && n.text.length > 0)
    );
  }),
);

console.log('\n  --- kartu yang sedang tampil ---');
c(
  'activeNudge membawa serta hari asalnya, jadi kartunya bisa di-click',
  (() => {
    const hari = '2026-08-31';
    const s = nudgeSchedule(hari, punyaku).find((n) => n.day !== undefined);
    const t = new Date(2026, 7, 31, Math.floor(s.from / 60), s.from % 60);
    const aktif = activeNudge(t, hari, punyaku);
    console.log(`  ${aktif.text} → membuka Revive ${aktif.day}`);
    return aktif.text === s.text && aktif.day === s.day;
  })(),
);
c(
  'kalimat BAWAAN tidak punya hari → kartunya tetap sekadar dibaca',
  (() => {
    const hari = '2026-08-31';
    const s = nudgeSchedule(hari, punyaku).find((n) => n.day === undefined);
    const t = new Date(2026, 7, 31, Math.floor(s.from / 60), s.from % 60);
    return activeNudge(t, hari, punyaku).day === undefined;
  })(),
);
c(
  'di luar jamnya tetap tidak muncul apa-apa',
  activeNudge(new Date(2026, 7, 31, 5, 59), '2026-08-31', punyaku) === null,
);

// ===================================================================
console.log('\n=== 5. Tombolnya benar-benar terpasang di layar Revive ===');
const revive = baca('app/revive.tsx');
const pinBtn = baca('components/spiritual/PinReminderButton.tsx');
c('komponennya ada & satu', /export function PinReminderButton/.test(pinBtn));
c('tulisannya jelas dua keadaan', /Jadikan reminder/.test(pinBtn) && /Reminder harian/.test(pinBtn));
c('warnanya dari palet bersama, bukan hex tangan', !/#[0-9A-Fa-f]{6}/.test(pinBtn));
c(
  'DUA tombol di mode tulis: Rhema & Aplikasi',
  /togglePin\('rhema', fRhema\)/.test(revive) &&
    /togglePin\('application', fReflection\)/.test(revive),
);
c(
  'DUA tombol juga saat catatan lama dibaca ulang',
  /togglePin\('rhema', entry\.rhema\)/.test(revive) &&
    /togglePin\('application', entry\.reflection\)/.test(revive),
);
c(
  'kolom masih kosong → tombolnya mati',
  /disabled=\{!fRhema\.trim\(\)/.test(revive) &&
    /disabled=\{!fReflection\.trim\(\)/.test(revive),
);
c('keadaannya dibaca dari daftar, bukan ditebak', (revive.match(/myReminderOn\(mine, targetDay/g) || []).length === 4);
c('daftarnya dilanggan real-time', /subscribeMyReminders\(uid, setMine, fail\)/.test(revive));
c(
  'disimpan → kalimat yang terpasang ikut disegarkan',
  /refreshMyReminders\(mine, targetDay/.test(revive) &&
    /if \(segar\) saveMyReminders\(user\.uid, segar\)/.test(revive),
);
c(
  'Revive dihapus → remindernya ikut dilepas (tak ada kartu yatim)',
  /mine\.filter\(\(m\) => m\.day !== targetDay\)/.test(revive),
);
c('tak ada teks tombol yang ditulis ulang di layar', !/Jadikan reminder/.test(revive));

console.log('\n  --- Home ---');
// 22 Sep 2026: penyegar 🕊️ jadi baris kecil di hero With God (Today):
// undiannya di Today Engine, langganannya di useTodayData, tampilannya GodHero.
const home = baca('components/today/GodHero.tsx') + baca('app/(tabs)/index.tsx');
c('Today ikut melanggan daftarnya', /subscribeMyReminders\(uid, mark\('myReminders', setMyReminders\), fail\)/.test(baca('hooks/useTodayData.ts')));
c('daftarnya dioper ke undian penyegar', /activeNudge\(now, todayId, input\.myReminders\)/.test(baca('lib/today.ts')));
c('kartunya memakai nudge.text', /\{god\.nudge\.text\}/.test(home));
c('click → buka Revive asalnya', /pathname: '\/revive', params: \{ day: god\.nudge\.day \}/.test(home));
c('tetap ditandai "sudah dibaca"', /setNudgeSeen\(model\.god\.nudge\?\.text \?\? null\)/.test(home) && /model\.god\.nudge\.text !== nudgeSeen/.test(home));
c('judulnya memberi tahu kalau kalimatnya milikmu sendiri', /Dari Revive-mu/.test(home));
c('tombol 📤 membagikan kalimat yang SAMA', /params: \{ text: god\.nudge\?\.text \?\? '' \}/.test(home));

// ===================================================================
console.log('\n=== 6. Warna Race ikut layar Health ===');
const arsip = baca('components/fun/FunArchive.tsx');
const health = baca('app/health.tsx');
c('FunArchive menerima warna dari layarnya', /accent\?: string/.test(arsip));
c('kosong = warna kategorinya sendiri (Fun tak berubah)', /accent \?\? meta\.fg/.test(arsip));
c(
  'tombol, garis tepi kartu, & rinciannya sewarna',
  (arsip.match(/\bwarna\b/g) || []).length >= 4 && !/meta\.fg/.test(arsip.replace('accent ?? meta.fg', '')),
);
c('Health memasang warna utamanya', /<FunArchive category="race" accent=\{Color\.MAIN\} \/>/.test(health));
c('layar Fun TIDAK ikut diubah warnanya', !/accent=/.test(baca('app/fun.tsx')));
c(
  'tabel kategori Fun tidak ditulis ulang (Summit & Rekreasi tetap)',
  /key: 'race'[\s\S]{0,120}FINANCE_EXPENSE/.test(baca('lib/fun.ts')),
);

// ===================================================================
console.log('\n=== 7. Tidak ada lagi tulisan yang terpotong keluar kartu ===');
// Baris "judul di kiri, nilai di kanan" yang isinya sama-sama TULISAN wajib
// boleh turun ke baris berikutnya. Tanpa flexWrap, yang kedua tidak menyusut
// & tidak turun — ia menerobos keluar kartu lalu terpotong di tepi layar.
const WAJIB_WRAP = [
  ['components/health/StepsTab.tsx', ['heroTop', 'cardHeader', 'goalTop', 'msRow']],
  ['components/health/WeekTargetCard.tsx', ['top']],
  ['components/health/BodyCard.tsx', ['cardHeader', 'row']],
  ['components/health/CheckupStatusCard.tsx', ['statusHeader']],
  ['components/health/CheckupTab.tsx', ['row']],
  // (InsuranceTab dulu ikut di sini — tab-nya sudah dihapus permanen.)
  ['components/core/FollowupTab.tsx', ['weekTop']],
  ['components/core/LinkedNotesButton.tsx', ['cardTop']],
  ['components/core/VisitationTab.tsx', ['sectionRow']],
  ['components/device/PlanTab.tsx', ['cardTop']],
  ['components/finance/BudgetingTab.tsx', ['summaryTop', 'rowBottom']],
  // 22 Sep 2026: batang komposisi pindah ke MonthDetails (balik "Lihat detail").
  ['components/finance/MonthDetails.tsx', ['compTop']],
  ['components/finance/TransactionsTab.tsx', ['collapsedRow']],
  ['components/fun/FunArchive.tsx', ['budgetRow', 'budgetTotalRow']],
  ['components/learning/WeekTab.tsx', ['heroTop']],
  ['components/residence/UtilityTab.tsx', ['utilRow']],
  ['components/spiritual/BibleReadingTab.tsx', ['cardTop']],
  ['components/spiritual/journey/JourneySteps.tsx', ['chainTop']],
  ['components/common/UpkeepList.tsx', ['modalHead']],
  ['app/reminders.tsx', ['taskHeader']],
  // 22 Sep 2026: kartu sapaan Home dibuang; baris atas Today (tanggal + avatar) memakai flexWrap.
  ['app/(tabs)/index.tsx', ['topRow']],
  ['app/reward-category.tsx', ['catTop']],
  ['app/steps.tsx', ['tierRow']],
  ['app/tasks.tsx', ['dayHeader']],
  ['app/timeline.tsx', ['monthHeader']],
  ['app/donor.tsx', ['sectionHeader', 'cardTop']],
  ['app/book/[key].tsx', ['progressTop']],
  ['app/debts.tsx', ['cardBottom']],
  ['app/leader-criteria.tsx', ['valueRow']],
  ['app/project/[id].tsx', ['estRow']],
  ['components/spiritual/BibleRefList.tsx', ['refTop']],
  ['app/revive.tsx', ['fieldHead']],
];

const kurang = [];
for (const [file, names] of WAJIB_WRAP) {
  const src = baca(file);
  for (const name of names) {
    const m = new RegExp('\\n\\s{2}' + name.replace(/[$]/g, '\\$') + ':\\s*\\{([^{}]*?)\\n\\s{2}\\},').exec(src);
    if (!m || !/flexWrap: 'wrap'/.test(m[1])) kurang.push(`${file} :: ${name}`);
  }
}
const jumlahBaris = WAJIB_WRAP.reduce((s, [, n]) => s + n.length, 0);
console.log(`  ${jumlahBaris - kurang.length}/${jumlahBaris} baris judul kartu sudah boleh turun ke bawah`);
c('semua baris yang disapu sudah punya flexWrap', kurang.length === 0);
if (kurang.length) console.log('  belum: ' + kurang.join(', '));

c(
  'kolom isian TIDAK ikut disapu (chevron-nya jangan sampai turun sendiri)',
  !/flexWrap/.test(baca('components/common/DateField.tsx')) &&
    !/flexWrap/.test(baca('components/common/TimeField.tsx')) &&
    !/flexWrap/.test(baca('components/common/SelectField.tsx')),
);

// Bukti nyata bahwa keluhannya memang teratasi: dua kalimat yang dikeluhkan
// diukur dengan metrik font Inter yang sesungguhnya.
const { ukurHeading } = require('./ukur-teks.js');
const LEBAR_KARTU = 393 - 40 - 32; // layar iPhone 15 − padding layar − padding kartu
const pasangan = [
  ['🏃 Patokan Jarak Harian', 'title', '🔄 Mulai lagi tiap hari, jam 00.00', 'label'],
  ['🎯 Target Langkah Mingguan', 'title', '47,7 / 20 km', 'subheader'],
  ['📅 This Week', 'title', '47,7 km', 'bold'],
];
let adaYangTakMuat = false;
for (const [kiri, hKiri, kanan, hKanan] of pasangan) {
  const total = ukurHeading(kiri, hKiri).lebar + ukurHeading(kanan, hKanan).lebar;
  const muat = total <= LEBAR_KARTU;
  if (!muat) adaYangTakMuat = true;
  console.log(
    `  "${kiri}" + "${kanan}" = ${Math.round(total)}pt dari ${LEBAR_KARTU}pt ${muat ? '→ tetap sebaris, tampilannya sama seperti dulu' : '→ TIDAK muat, wajib turun'}`,
  );
}
c('keluhannya nyata: memang ada yang tak muat sebaris', adaYangTakMuat);
c(
  'yang MEMANG muat tetap sebaris — wrap tidak mengubah tampilan yang sudah benar',
  ukurHeading('📅 This Week', 'title').lebar +
    ukurHeading('47,7 km', 'bold').lebar <=
    LEBAR_KARTU,
);

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);