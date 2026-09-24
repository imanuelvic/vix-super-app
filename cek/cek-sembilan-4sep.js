// Sembilan permintaan (4 Sep 2026, sore):
//   1. kartu jadwal terdekat menempel ke deretan tab (tak ada jarak atas)
//   2. Squad & Setoran bawaannya tertutup
//   3. tulisan chip benar-benar di tengah kotaknya
//   4. catatan populasi diisi TANGAN tiap tanggal 1 + badge yang mengingatkan
//   5. streak Revive dihitung dari catatannya sendiri, bukan penghitung buta
//   6. urutan grid Home disimpan sebagai NOMOR, dan Dashboard mengikutinya
//   7. "hari beruntun" dihapus; kata "beruntun" → "streak"
//   8. (hitungan Habits — lihat cek-habits-streak.js)
//   9. tombol share pengumuman sesi ke WhatsApp
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

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

// ============================================================
console.log('=== 1. Kartu jadwal menempel ke tab ===');
// ============================================================
const tab = baca('components/friends/FutsalTab.tsx');
// 15 Sep 2026: SummaryCard-nya kini menerima style garis tepi (heroPressable,
// tanpa margin). Yang dijaga tetap: tidak ada gaya `hero` yang memberi jarak atas.
c('kartu ringkasnya tak lagi berjarak dari atas',
  /<SummaryCard(\s*\n\s*style=\{berikut \? \[styles\.heroPressable[^>]*)?>/.test(tab) &&
    !/hero: \{/.test(tab) && /heroPressable: \{ borderWidth: 2, padding: 16 \}/.test(tab));
c('gulungannya pun tidak menambah jarak atas sendiri',
  /content: \{ paddingHorizontal: 20, paddingBottom: 28 \}/.test(tab));

// ============================================================
console.log('\n=== 2. Squad & Setoran bawaannya terbuka lagi ===');
// ============================================================
const rinci = baca('app/futsal/[id].tsx');
// 6 Sep 2026 dibalik lagi: halaman rincian sesi DIBUKA untuk dikerjakan, dan
// dari ketiga bagiannya Squad & Setoran yang dicari duluan. Bentuknya kini
// akordeon — membuka bagian lain menutup yang ini dengan sendirinya.
c('bawaannya terbuka', /useAccordion<Bagian>\('squad'\)/.test(rinci));
// Judulnya membawa ringkasan, jadi menutupnya tidak berarti kehilangan kabar.
c('judulnya tetap menyebut isinya walau tertutup', /sub=\{ringkasSquad\}/.test(rinci));

// ============================================================
console.log('\n=== 3. Tulisan chip di tengah kotaknya ===');
// ============================================================
const chip = baca('components/common/Chip.tsx');
c('chip menengahkan isinya di dua arah',
  /alignItems: 'center',/.test(chip) && /justifyContent: 'center',/.test(chip));
// 8 (atas) + 38,5 (chip) + 10 (bawah) = 56,5 — barisnya harus lebih tinggi
// dari itu, kalau tidak garis bawah chipnya terpotong & hurufnya terbaca naik.
const creators = baca('components/fun/CreatorsTab.tsx');
const tinggi = Number((creators.match(/kindScroll: \{ height: (\d+) \}/) ?? [])[1]);
const isiRow = creators.match(/kindRow: \{[^}]*paddingTop: (\d+), paddingBottom: (\d+)/);
c('tinggi barisnya cukup untuk chip + jarak atas-bawahnya',
  !!isiRow && tinggi >= Number(isiRow[1]) + 38.5 + Number(isiRow[2]),
  `tinggi ${tinggi}`);

// ============================================================
console.log('\n=== 4. Catatan populasi diisi tangan tiap tanggal 1 ===');
// ============================================================
const newsLib = baca('lib/news.ts');
const N = pasang(tsc(newsLib), (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './health') return { dayDocId: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
  if (nama === './format') return { dayIdToDate: (s) => new Date(`${s}T00:00:00`), daysBetween: () => 30 };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return {};
});
c('tanggal catatannya jadi tanggal 1', N.RECORD_DAY === 1);
c('pencatatan otomatis dibuang', !/recordMonthlyPopulation/.test(newsLib));
c('menyimpan & menghapus catatan ada, dan hapusnya PERMANEN',
  typeof N.savePopulationPoint === 'function' &&
  typeof N.deletePopulationPoint === 'function' &&
  !/isDeleted|archived/.test(newsLib));
{
  const now = new Date(2026, 8, 4); // 4 Sep 2026
  c('bulan yang belum dicatat → badge menyala',
    N.populationDue({}, now) === 1);
  c('sudah dicatat bulan itu → padam',
    N.populationDue({ '2026-09-01': 8_320_000_000 }, now) === 0);
  c('catatan bulan LAIN tidak ikut memadamkan',
    N.populationDue({ '2026-08-01': 8_310_000_000 }, now) === 1);
  c('tanggal bawaannya tanggal 1 bulan berjalan',
    N.populationRecordDay(now).getDate() === 1 &&
    N.populationRecordDay(now).getMonth() === 8);
  const titik = N.allPopulationPoints({ '2026-09-01': 8_320_000_000 });
  c('catatan tanganmu masuk daftar & tak lagi ditandai "perkiraan app"',
    titik[0].dayId === '2026-09-01' && titik[0].estimated === undefined);
}
const popTab = baca('components/news/PopulationTab.tsx');
c('tombol tambahnya ada di sebelah judul Riwayat Catatan',
  /📜 Riwayat Catatan/.test(popTab) && /\+ Tambah/.test(popTab));
c('tautan sumbernya tetap satu klik dari situ', /🔗 Sumber/.test(popTab));
c('paragraf panjang "dihitung di HP-mu" sudah tidak ada',
  !/dihitung di HP-mu/.test(popTab));
c('barisnya bisa diubah & dihapus — tapi cuma catatan tanganmu',
  /const milikku = saved\[p\.dayId\] !== undefined;/.test(popTab) &&
  /disabled=\{!milikku\}/.test(popTab));

console.log('\n   Badge-nya memakai aturan yang sama');
c('baris Today (populasi awal bulan)', /populationDue\(input\.population, now\) > 0/.test(baca('lib/today.ts')));
c('kartu reminder Dashboard', /news: populationDue\(population, now\)/.test(baca('app/reminders.tsx')));
c('kartunya benar-benar ada (badge tanpa kartu itu angka merah buntu)',
  /news: \{/.test(baca('components/reminders/BadgeReminders.tsx')));

// ============================================================
console.log('\n=== 5. Streak Revive dari catatannya sendiri ===');
// ============================================================
const spiritLib = baca('lib/spiritual.ts');
const S = pasang(tsc(spiritLib), (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './health') return {
    dayDocId: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    yesterdayId: () => '',
  };
  if (nama === './format') return { dayIdToDate: (s) => new Date(`${s}T00:00:00`) };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return new Proxy({}, { get: () => () => undefined });
});
const { reviveStreakFromDays, repairedReviveStreak } = S;
{
  const hari = (n) => {
    const d = new Date(2026, 8, 4);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const TODAY = hari(0);
  const duabelas = Array.from({ length: 12 }, (_, i) => hari(i));
  c('12 hari berturut-turut = 12 (bukan angka penghitung yang tertinggal)',
    reviveStreakFromDays(duabelas, TODAY) === 12,
    String(reviveStreakFromDays(duabelas, TODAY)));
  c('belum menulis HARI INI tidak langsung memutus — kemarin masih menyambung',
    reviveStreakFromDays(duabelas.slice(1), TODAY) === 11);
  c('bolong dua hari → streaknya memang mati',
    reviveStreakFromDays(duabelas.slice(2), TODAY) === 0);
  c('bolong di tengah memotong tepat di situ',
    reviveStreakFromDays([hari(0), hari(1), hari(3), hari(4)], TODAY) === 2);
  c('tak ada catatan sama sekali → 0', reviveStreakFromDays([], TODAY) === 0);
  c('urutan daftarnya tidak berpengaruh',
    reviveStreakFromDays([...duabelas].reverse(), TODAY) === 12);

  console.log('\n   Membetulkan penghitung yang meleset');
  const meleset = { count: 3, lastDayId: hari(0), best: 9, total: 20 };
  const benar = repairedReviveStreak(meleset, duabelas, TODAY);
  c('penghitung yang salah dibetulkan ke angka sesungguhnya', benar?.count === 12);
  c('rekor & total tidak pernah TURUN karena pembetulan itu',
    benar?.best === 12 && benar?.total === 20);
  c('yang sudah cocok TIDAK ditulis ulang (nol tulis sia-sia)',
    repairedReviveStreak(benar, duabelas, TODAY) === null);
  c('dokumen kosong pun terisi benar', repairedReviveStreak(null, duabelas, TODAY)?.count === 12);
}
const spiritLayar = baca('app/(tabs)/walk.tsx');
c('layarnya membetulkan dari daftar catatannya, bukan sekadar menaikkan 1',
  /repairedReviveStreak\(\s*\n?\s*reviveStreak,/.test(spiritLayar) &&
  // 21 Sep 2026: hanya Revive yang UTUH (dokumen yang baru berisi isian
  // Morning Journey tidak ikut dihitung streak Revive).
  /entries\.filter\(reviveWritten\)\.map\(\(e\) => e\.id\)/.test(spiritLayar));

// ============================================================
console.log('\n=== 6. Urutan grid disimpan sebagai nomor ===');
// ============================================================
const gridLib = baca('lib/featureGrid.ts');
const G = pasang(tsc(gridLib), () => new Proxy({}, { get: () => () => undefined }));
// 23 Sep 2026: pemiliknya menukar delapan tile (Finance↔Learning↔Fitness↔
// Health↔Reminder berputar, Car↔Fun, Residence↔Wheel, Device↔Friends).
const HARUS = [
  'tasks', 'health', 'spiritual', 'fitness',
  'core', 'finance', 'learning', 'family',
  'investment', 'career', 'news', 'book',
  'fun', 'wheel', 'car', 'residence',
  'friends', 'games', 'device',
];
c('tiap fitur menyimpan nomor urutnya sendiri',
  G.HOME_FEATURES.every((f) => typeof f.sort === 'number'));
// 23 Sep 2026: Married (nomor 20) dihapus — nomor lain TIDAK digeser, jadi
// yang dijaga: tak ada nomor kembar & urutannya tetap seperti yang diminta.
c('nomornya tanpa kembar, mulai dari 1',
  new Set(G.HOME_FEATURES.map((f) => f.sort)).size === G.HOME_FEATURES.length &&
  Math.min(...G.HOME_FEATURES.map((f) => f.sort)) === 0.5 &&
  Math.max(...G.HOME_FEATURES.map((f) => f.sort)) === 19);
c('urutan tampilnya persis urutan yang diminta',
  JSON.stringify(G.HOME_FEATURES.map((f) => f.key)) === JSON.stringify(HARUS),
  G.HOME_FEATURES.map((f) => f.key).join(' → '));
c('daftarnya DIURUTKAN dari nomor itu, bukan dari urutan barisnya',
  /\[\.\.\.FEATURES\]\.sort\(\s*\n?\s*\(a, b\) => a\.sort - b\.sort,?\s*\n?\)/.test(gridLib));
// 15 Sep 2026: papan Reward TIDAK lagi ikut nomor grid — urutannya
// ditulis tangan per baris tiga petak (PAPAN di lib/reward.ts), dan
// homeFeatureIndex dicabut dari grid. Lihat cek-papan-achv.js.
c('papan Reward punya urutannya sendiri, grid tak lagi menyediakan nomor untuknya',
  !/homeFeatureIndex/.test(gridLib) &&
  /papanIndex\(a\.key\) - papanIndex\(b\.key\)/.test(baca('lib/reward.ts')));

console.log('\n   Dashboard mengikuti nomor itu dari atas ke bawah');
const dash = baca('app/reminders.tsx');
const URUT = [
  ['Sedang berpuasa', 2], ['Pokok Doa Bulanan', 2], ['renungkan khotbah', 2],
  ['Reminder Health digabung', 3],
  ['Reminder CORE:', 4], ['Follow Up Mingguan', 4], ['Doa Rantai', 4],
  ['Reminder bayar pinjaman', 5],
  ['Reminder Learning', 6], ['Reminder diskusi', 6],
  // Tiga kartu Fitness sejak sesinya jadi pilihan: belum memilih, sudah
  // memilih, dan yang dipilih cuma jalan.
  ['Belum memilih', 7], ['Sudah memilih', 7], ['Yang dipilih cuma jalan', 7],
  ['ulang tahun keluarga', 8],
  ['deadline KERJA', 10],
  ['Reminder FUN', 11],
  ['Wheel of Life', 12], ['Reminder fokus Wheel', 12],
  ['Reminder Car', 13],
  ['Reminder Residence', 14],
  ['<BadgeReminders', 17],
  ['Reminder FRIENDS', 19],
];
// Cuma bagian yang DIGAMBAR — penanda yang sama juga muncul di bagian
// perhitungan di atasnya.
const render = dash.slice(dash.indexOf('<View style={styles.contentInner}>'));
const posisi = URUT.map(([teks]) => render.indexOf(teks));
c('semua penanda kartunya ketemu', posisi.every((p) => p > 0));
c('urutannya naik terus mengikuti nomor tile-nya',
  posisi.every((p, i) => i === 0 || posisi[i - 1] < p),
  URUT.filter((_, i) => i > 0 && posisi[i - 1] >= posisi[i]).map(([t]) => t).join(', '));
// Yang di luar grid: kartu putih di paling atas, fallback di paling bawah.
c('kartu putih "Reminder Hari Ini" tetap di atas semua kartu fitur',
  render.indexOf('🔔 Reminder Hari Ini') < posisi[0]);
c('fallback produktivitas tetap paling bawah',
  render.indexOf('Fallback PRODUKTIVITAS') > posisi[posisi.length - 1]);

// ============================================================
console.log('\n=== 7. "beruntun" → "streak" ===');
// ============================================================
const semuaBerkas = [];
(function jelajah(dir) {
  for (const isi of fs.readdirSync(R + dir, { withFileTypes: true })) {
    const p = dir + '/' + isi.name;
    if (isi.isDirectory()) jelajah(p);
    else if (/\.tsx?$/.test(isi.name)) semuaBerkas.push(p);
  }
})('app');
for (const d of ['components', 'lib', 'hooks']) {
  (function jelajah(dir) {
    for (const isi of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + isi.name;
      if (isi.isDirectory()) jelajah(p);
      else if (/\.tsx?$/.test(isi.name)) semuaBerkas.push(p);
    }
  })(d);
}
// lib/pdfDoc.ts dikecualikan: "enter beruntun" di sana soal baris kosong
// berturut-turut di PDF, sama sekali bukan streak.
const sisa = semuaBerkas.filter(
  (f) => f !== 'lib/pdfDoc.ts' && baca(f).includes('beruntun'),
);
c('tak ada lagi kata "beruntun" di kode', sisa.length === 0, sisa.join(', '));
c('kata "streak" memang dipakai sebagai gantinya',
  /hari streak|streak/.test(baca('lib/reward.ts')));
c('baris "hari streak" di bawah angka Dashboard dihapus',
  !/hari streak/.test(dash) && !/streakBest/.test(dash));

// ============================================================
console.log('\n=== 9. Pengumuman sesi ke WhatsApp ===');
// ============================================================
const F = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './transactions') return {
    formatRupiah: (n) => `Rp ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
  };
  if (nama === './format') return {
    dayId: () => '',
    dayIdToDate: (s) => new Date(`${s}T00:00:00`),
    formatDayDate: () => '',
    formatFullDate: () => 'Selasa, 1 September 2026',
  };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return {};
});
{
  const anggota = [
    { id: 'm1', gang: 'f3', name: 'Imanuel', phone: '', position: 'flank', note: '' },
    { id: 'm2', gang: 'f3', name: 'Andika', phone: '', position: 'flank', note: '' },
    { id: 'm3', gang: 'f3', name: 'Denise', phone: '', position: 'pivot', note: '' },
    { id: 'm9', gang: 'core', name: 'Bukan F3', phone: '', position: 'flank', note: '' },
  ];
  const sesi = {
    id: 's1', gang: 'f3', dayId: '2026-09-01', time: '18.00',
    venue: 'Elang Futsal',
    mapsUrl: 'https://maps.app.goo.gl/eD3Y6cvVMmf3vbev9',
    bank: 'BCA 5271415860',
    fee: 65000, squad: ['m1', 'm2'], paid: ['m1'], games: [], note: '',
  };
  const teks = F.sessionRecap({ members: anggota, sessions: [sesi], cash: [] }, sesi);
  const punya = (x) => teks.includes(x);
  c('judulnya nama gengnya', teks.startsWith('NDC F3'));
  c('tanggal lengkap + jam bergaya jam dinding (18:00)',
    punya('📅 Selasa, 1 September 2026') && punya('🕐 18:00'));
  c('lapangan & link maps-nya ikut',
    punya('📍 Elang Futsal') && punya('https://maps.app.goo.gl/eD3Y6cvVMmf3vbev9'));
  c('iuran & rekeningnya ikut',
    punya('Rp 65.000 per orang') && punya('BCA 5271415860'));
  c('daftar yang ikut main bernomor & urut abjad',
    punya('Ikut main:\n1. Andika\n2. Imanuel✅'), JSON.stringify(teks));
  c('yang sudah setor ditandai ✅, yang belum polos',
    punya('2. Imanuel✅') && punya('1. Andika\n'));
  c('keterangan tandanya ditutup di bawah', teks.trimEnd().endsWith('✅ = Sudah setor'));
  c('anggota geng LAIN tidak ikut terbawa', !punya('Bukan F3'));
  // Baris kosong "📍" atau "Rp 0 per orang" itu pesan yang dibaca orang lain.
  const kosong = F.sessionRecap(
    { members: anggota, sessions: [], cash: [] },
    { ...sesi, mapsUrl: '', bank: '', fee: 0, squad: [], paid: [] },
  );
  c('yang belum diisi tidak dikirim sebagai baris kosong',
    !kosong.includes('per orang') && !/\n\n\n/.test(kosong));
  c('squad kosong tetap terbaca wajar', kosong.includes('(belum ada yang ikut)'));
}
c('tombolnya di judul Squad & Setoran, lewat WhatsApp bebas tujuan',
  /shareTextToWhatsApp\(sessionRecap\(data, sesi\)/.test(rinci));
const form = baca('hooks/useFutsalSessionForm.ts');
c('link maps & rekening diwarisi dari sesi terakhir (diketik sekali)',
  /setMaps\(terakhir\?\.mapsUrl \?\? ''\)/.test(form) &&
  /setBank\(terakhir\?\.bank \?\? ''\)/.test(form));
c('keduanya punya isiannya di formulir',
  /🔗 Link Maps lapangan/.test(baca('components/friends/FutsalSessionSheet.tsx')) &&
  /🏦 Rekening setoran/.test(baca('components/friends/FutsalSessionSheet.tsx')));

console.log(ok ? '\n✅ LULUS — sembilan permintaan terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
