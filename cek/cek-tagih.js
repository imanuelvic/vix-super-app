// Satu permintaan (8 Sep 2026): pesan tagih perorangan ditulis ulang.
//
// Pesannya DIJALANKAN, bukan dicocokkan hurufnya di berkas — yang dijaga di
// sini teks yang benar-benar sampai ke WhatsApp orang lain.
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

const F = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './transactions')
    return {
      formatRupiah: (n) => `Rp ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
    };
  if (nama === './format')
    return {
      dayId: () => '',
      dayIdToDate: (s) => new Date(`${s}T00:00:00`),
      formatDayDate: () => '',
      formatFullDate: () => 'Selasa, 22 September 2026',
    };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return {};
});

const sesi = {
  id: 's1',
  gang: 'f3',
  dayId: '2026-09-22',
  time: '18.00',
  endTime: '20.00',
  venue: 'TBA',
  mapsUrl: '',
  bank: 'Trf ke 5271415860',
  fee: 65000,
  squad: ['m1'],
  paid: [],
  games: [],
  note: '',
};

// ============================================================
console.log('=== 1. Pesannya persis seperti yang diminta ===');
// ============================================================
const DIMINTA = [
  'Shalomm👋 reminder untuk patungan NDC F3',
  '',
  '📅 Selasa, 22 September 2026',
  '🕐 18:00–20:00',
  '📍 TBA',
  '',
  'Rp 65.000 per orang',
  'Trf ke 5271415860',
  '',
  'Tlg kirim buktinya kalau sudah',
].join('\n');

const pesan = F.sessionReminder(sesi);
c('teksnya sama huruf demi huruf', pesan === DIMINTA, JSON.stringify(pesan));

// ============================================================
console.log('\n=== 2. Yang belum diisi tidak dikirim sebagai baris kosong ===');
// ============================================================
{
  // "Rp 0 per orang" & rongga menganga itu pesan yang dibaca orang lain.
  const kosong = F.sessionReminder({ ...sesi, fee: 0, bank: '', venue: '' });
  c('iuran & rekening kosong dilewati beserta pemisahnya',
    !kosong.includes('per orang') && !/\n\n\n/.test(kosong), JSON.stringify(kosong));
  c('lapangan kosong tetap terbaca wajar', kosong.includes('📍 Lapangan menyusul'));
  c('penutupnya tetap ada', kosong.trimEnd().endsWith('Tlg kirim buktinya kalau sudah'));
}
{
  // Sesi lama belum punya jam selesai.
  const satuJam = F.sessionReminder({ ...sesi, endTime: undefined });
  c('sesi tanpa jam selesai tidak jadi "18:00–undefined"',
    satuJam.includes('🕐 18:00\n'), JSON.stringify(satuJam.split('\n')[3]));
}

// ============================================================
console.log('\n=== 3. Satu penyusun untuk dua pesan ===');
// ============================================================
// Pengumuman grup & tagihan japri menyebut jadwal dan rekening yang SAMA.
// Dua salinan cara menulisnya = satu sesi terbaca beda jam di dua pesan.
const lib = baca('lib/futsal.ts');
c('jadwal & setorannya disusun penyusun bersama',
  /function sessionWhenLines\(s: FutsalSession\): string\[\]/.test(lib) &&
    /function sessionPayLines\(s: FutsalSession\): string\[\]/.test(lib) &&
    (lib.match(/sessionWhenLines\(s\)/g) || []).length === 2 &&
    (lib.match(/sessionPayLines\(s\)/g) || []).length === 2);
c('keduanya penyusun DALAM lib ini, bukan tambahan permukaan baru',
  !/export function sessionWhenLines/.test(lib) &&
    !/export function sessionPayLines/.test(lib));
c('layarnya tidak lagi merangkai pesannya sendiri',
  /sessionReminder\(sesi\)/.test(baca('app/futsal/[id].tsx')) &&
    !/belum masuk ya/.test(baca('app/futsal/[id].tsx')));

// Pengumuman grupnya tidak boleh ikut berubah gara-gara ini.
{
  const anggota = [
    { id: 'm1', gang: 'f3', name: 'Imanuel', phone: '', position: 'flank', note: '' },
  ];
  const teks = F.sessionRecap({ members: anggota, sessions: [sesi], cash: [] }, sesi);
  c('pengumuman grup tetap utuh: kepala, jadwal, setoran, daftar ikut',
    teks.startsWith('NDC F3\n\n📅 Selasa, 22 September 2026\n🕐 18:00–20:00\n📍 TBA\n\n') &&
      teks.includes('\nRp 65.000 per orang\nTrf ke 5271415860\n\nIkut main:\n1. Imanuel') &&
      teks.trimEnd().endsWith('✅ = Sudah setor'),
    JSON.stringify(teks));
}

console.log(
  ok ? '\n✅ LULUS — pesan tagih baru terbukti.' : '\n❌ ADA YANG GAGAL',
);
process.exit(ok ? 0 : 1);
