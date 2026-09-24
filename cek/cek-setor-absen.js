// Dua permintaan (5 Sep 2026, sore):
//   1. Yang TIDAK ikut main tetap boleh menyetor — uangnya masuk hitungan.
//      Tidak hadir ≠ tidak bayar.
//   2. Tanggal 1 digit ditulis 1 digit di SELURUH app: "6 Feb 2026", bukan
//      "06 Feb 2026".
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
const F = pasang(tsc(baca('lib/format.ts')), () => ({}));
const S = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
  if (nama === './format') return F;
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return {};
});

// ============================================================
console.log('=== 1. Tidak hadir ≠ tidak bayar ===');
// ============================================================
const sesi = {
  id: 's1', gang: 'core', dayId: '2026-09-05', time: '18.00', venue: 'ASABA',
  fee: 50000, squad: ['a', 'b', 'c'], paid: [], games: [], note: '',
};

{
  // Keadaan yang dilaporkan: 'd' berhalangan datang tapi tetap patungan.
  const absenBayar = { ...sesi, paid: ['a', 'd'] };
  c('uang orang yang tidak ikut main IKUT dihitung',
    S.sessionPaidTotal(absenBayar) === 100000, S.sessionPaidTotal(absenBayar));
  // Yang ditagih tetap orang yang MAIN & belum setor — tidak berkurang gara-
  // gara ada yang bayar lebih.
  c('daftar tagihannya tidak ikut berubah',
    S.sessionUnpaidCount(absenBayar) === 2, S.sessionUnpaidCount(absenBayar));
  c('sisa tagihan = yang main & belum setor',
    S.sessionDueTotal(absenBayar) === 100000, S.sessionDueTotal(absenBayar));
}
{
  // Dengan "total dikurangi yang masuk", sisanya MINUS di sini dan terbaca
  // seperti salah hitung, padahal yang terjadi cuma uang lebih.
  const lebih = { ...sesi, paid: ['a', 'b', 'c', 'd', 'e'] };
  c('sisa tagihan tidak pernah minus', S.sessionDueTotal(lebih) === 0,
    S.sessionDueTotal(lebih));
  c('uang lebihnya tetap tercatat utuh',
    S.sessionPaidTotal(lebih) === 250000, S.sessionPaidTotal(lebih));
}
{
  const kosong = { ...sesi, paid: [] };
  c('yang biasa tetap seperti semula: belum ada yang setor',
    S.sessionPaidTotal(kosong) === 0 &&
    S.sessionDueTotal(kosong) === 150000 &&
    S.sessionTotal(kosong) === 150000);
  const lunas = { ...sesi, paid: ['a', 'b', 'c'] };
  c('…dan saat semua yang main sudah setor',
    S.sessionDueTotal(lunas) === 0 && S.sessionUnpaidCount(lunas) === 0);
}
{
  // Sudah setor = urusannya beres, ikut main atau tidak.
  const orang = [
    { id: 'a', name: 'Andi', gang: 'core', position: 'flank' },
    { id: 'b', name: 'Budi', gang: 'core', position: 'flank' },
    { id: 'd', name: 'Doni', gang: 'core', position: 'flank' },
  ];
  const urut = S.squadOrder(orang, { ...sesi, squad: ['a', 'b'], paid: ['d'] });
  // Doni tidak ikut main tapi tetap patungan: ia tetap di daftar, di bawah
  // yang masih harus ditagih — bukan terkubur di dasar bersama yang tak bayar.
  c('barisnya: yang harus ditagih dulu, yang absen-tapi-setor menyusul',
    urut.map((m) => m.name).join(' ') === 'Andi Budi Doni',
    urut.map((m) => m.name).join(' '));
}

console.log('\n   Layar rinciannya');
const rinci = baca('app/futsal/[id].tsx');
c('centang setoran boleh diklik tanpa syarat kehadiran',
  /async function toggleLunas\(m: FutsalMember\) \{\s*\n\s*if \(!sesi\) return;/.test(rinci));
c('mencabut kehadiran TIDAK ikut mencabut setorannya',
  !/paid: ikut \?/.test(rinci));
// Kalau tombolnya disembunyikan, aturan di atas tak ada gunanya.
c('centang setorannya selalu digambar, bukan cuma untuk yang main',
  /\{\/\* Centang setoran SELALU ada[\s\S]{0,200}<PressableScale\s*\n\s*onPress=\{\(\) => toggleLunas\(m\)\}/.test(rinci));
c('tombol tagih tetap cuma untuk yang ikut main & belum setor',
  /\{ikut && !lunas && \(/.test(rinci));
// Tiga keadaan, bukan dua: yang absen tapi sudah bayar harus terbaca sebagai
// "beres", bukan sekadar "tidak ikut main".
c('barisnya menyebut ketiga keadaannya',
  /walau tidak ikut main/.test(rinci) &&
  /💸 Belum setor/.test(rinci) && /Tidak ikut main kali ini/.test(rinci));
c('ringkasan uang di atas memakai hitungan yang sama',
  /Kurang \$\{formatRupiah\(kurang\)\} dari \$\{belumSetor\} orang/.test(rinci));

// ============================================================
console.log('\n=== 2. Tanggal 1 digit di seluruh app ===');
// ============================================================
const satu = new Date(2026, 1, 6, 9, 5); // 6 Feb 2026, 09.05
c('formatDayDate      → "Jumat, 6 Feb 2026"',
  F.formatDayDate(satu) === 'Jumat, 6 Feb 2026', F.formatDayDate(satu));
c('formatShortDayDate → "Jum, 6 Feb 2026"',
  F.formatShortDayDate(satu) === 'Jum, 6 Feb 2026', F.formatShortDayDate(satu));
c('formatCompactDate  → "Jum, 6 Feb 26"',
  F.formatCompactDate(satu) === 'Jum, 6 Feb 26', F.formatCompactDate(satu));
c('formatGreetingDate → "Jumat, 6 Feb 26"',
  F.formatGreetingDate(satu) === 'Jumat, 6 Feb 26', F.formatGreetingDate(satu));
c('formatShortDate    → "6 Feb 2026"',
  F.formatShortDate(satu) === '6 Feb 2026', F.formatShortDate(satu));
c('tanggal 2 digit jelas tidak ikut berubah',
  F.formatShortDayDate(new Date(2026, 1, 16)) === 'Sen, 16 Feb 2026');
// Fungsi khusus reminder dihapus: dengan aturan baru ia kembar persis dengan
// formatDayDate, dan dua fungsi berhasil sama itu yang bikin satu layar
// diam-diam memakai yang salah.
c('fungsi tanggal kembar tidak ditinggalkan',
  F.formatReminderDate === undefined && !/formatReminderDate/.test(baca('lib/format.ts')));
c('pemakainya sudah pindah, bukan menggantung',
  !/formatReminderDate/.test(baca('app/reminders.tsx')) &&
  !/formatReminderDate/.test(baca('lib/futsal.ts')));

// Tempat bentuk itu benar-benar dibaca: baris reminder Fun Futsal di Dashboard.
{
  const data = {
    members: [], cash: [],
    sessions: [{ ...sesi, dayId: '2026-09-05', time: '18.00', gang: 'core' }],
  };
  const baris = S.futsalReminders(data, new Date(2026, 8, 4));
  c('baris reminder memakai nama hari UTUH & tanggal 1 digit',
    baris[0].text.startsWith('⛪ CORE · 🗓️ Sabtu, 5 Sep 2026 · 18.00'),
    baris[0].text);
}

console.log('\n   Yang JUSTRU harus tetap 2 digit');
// dayId itu NAMA DOKUMEN Firestore. Satu saja yang lupa pad, "2026-2-6" tak
// akan pernah bertemu "2026-02-06": datanya masih ada, tapi tak terbaca lagi.
c('id harian tetap "2026-02-06" — ia nama dokumen, bukan tulisan di layar',
  F.dayId(satu) === '2026-02-06', F.dayId(satu));
c('kunci bulanan ikut tetap', F.monthId(2026, 1) === '2026-02', F.monthId(2026, 1));
// "9.05" terbaca seperti angka pecahan, bukan jam.
c('jam tetap 2 digit', F.formatTime(satu) === '09.05', F.formatTime(satu));
c('tanggal + jam: yang berubah cuma tanggalnya',
  F.formatCompactDateTime(satu) === 'Jum, 6 Feb 26 · 🕒 09.05',
  F.formatCompactDateTime(satu));
// Tidak ada lagi tanggal yang dipadkan diam-diam di luar lib/format.ts.
{
  const sisa = require('child_process')
    .execSync('grep -rn "getDate()).padStart" --include=*.ts --include=*.tsx lib app components hooks', { cwd: R, encoding: 'utf8' })
    .trim().split('\n').filter((l) => !/lib\/format\.ts/.test(l));
  c('tak ada layar yang memadkan tanggalnya sendiri', sisa.length === 0, sisa.join(' | '));
}

console.log(ok ? '\n✅ LULUS — setoran lepas dari kehadiran, tanggal 1 digit.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
