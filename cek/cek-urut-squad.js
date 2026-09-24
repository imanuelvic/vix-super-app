// Urutan baris "Squad & Setoran" di rincian sesi Fun Futsal:
//   • bawaannya URUT ABJAD nama;
//   • yang sudah tercentang setoran naik ke PALING ATAS;
//   • yang tidak ikut main turun ke PALING BAWAH.
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

const sport = pasang(tsc(baca('lib/futsal.ts')), (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === './format') return { dayIdToDate: () => new Date(), formatShortDayDate: () => '' };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  return {};
});
const { gangMembers, squadOrder } = sport;

// Id & urutan tambahnya sengaja TIDAK sejalan dengan abjad namanya — malah
// persis terbalik. Kalau keduanya kebetulan searah, urutan yang keliru pun
// tetap terlihat benar, dan cek ini jadi tak membuktikan apa-apa.
const ORANG = [
  ['m3', 'Jovian'],
  ['m9', 'Erwanto'],
  ['m1', 'Riyan'],
  ['m7', 'Felix'],
  ['m5', 'Imanuel'],
];
const anggota = ORANG.map(([id, name]) => ({ id, name, gang: 'core', position: 'flank' }));
const data = { members: anggota, sessions: [], cash: [] };
const nama = (list) => list.map((m) => m.name).join(' ');

// ============================================================
console.log('=== Bawaan: urut abjad nama ===');
// ============================================================
// Daftarnya dulu memakai `data.members.filter(...)` mentah — urutan TAMBAH,
// yang tak berarti apa-apa buat siapa pun yang mencari satu nama.
c('layarnya memakai gangMembers, bukan filter mentah',
  baca('app/futsal/[id].tsx').includes('const anggota = gangMembers(data, sesi.gang);') &&
  !/data\.members\.filter/.test(baca('app/futsal/[id].tsx')));
{
  c('gangMembers mengurutkan abjad walau urutan tambahnya berantakan',
    nama(gangMembers(data, 'core')) === 'Erwanto Felix Imanuel Jovian Riyan',
    nama(gangMembers(data, 'core')));
}
{
  // Tak ada yang ikut & tak ada yang setor → tak ada alasan menggeser apa pun.
  const sesi = { id: 's1', gang: 'core', squad: [], paid: [], fee: 53000, games: [] };
  c('sesi kosong: urutannya persis abjad, tak digeser',
    nama(squadOrder(gangMembers(data, 'core'), sesi)) ===
      'Erwanto Felix Imanuel Jovian Riyan');
}

// ============================================================
console.log('\n=== Empat kelompok: yang harus ditagih paling atas ===');
// ============================================================
{
  // Persis keadaan di layar yang dilaporkan: Erwanto tidak ikut, sisanya ikut.
  const sesi = {
    id: 's1', gang: 'core', fee: 53000, games: [],
    squad: ['m7', 'm5', 'm3', 'm1'],   // Felix, Imanuel, Jovian, Riyan
    paid: ['m3'],                       // Jovian sudah setor
  };
  const urut = squadOrder(gangMembers(data, 'core'), sesi);
  // Yang ikut main tapi belum setor = daftar tagihan hari ini, jadi ia yang
  // naik paling atas — bukan yang sudah beres.
  c('yang ikut main tapi BELUM setor naik ke paling atas',
    urut[0].name === 'Felix', nama(urut));
  c('yang tidak ikut & tidak setor turun ke paling bawah',
    urut[urut.length - 1].name === 'Erwanto', nama(urut));
  c('yang sudah setor turun ke bawah kelompok tagihan, tetap urut abjad',
    nama(urut) === 'Felix Imanuel Riyan Jovian Erwanto', nama(urut));
}
{
  // Dua orang di tiap kelompok → membuktikan abjadnya tidak hilang setelah
  // dikelompokkan. Sort JS stabil, dan cek ini yang menjaganya tetap begitu.
  const sesi = {
    id: 's1', gang: 'core', fee: 53000, games: [],
    squad: ['m7', 'm5', 'm3'],  // Felix, Imanuel, Jovian
    paid: ['m7', 'm3'],         // Felix & Jovian sudah setor
  };
  c('abjad tetap terjaga DI DALAM tiap kelompok',
    nama(squadOrder(gangMembers(data, 'core'), sesi)) ===
      'Imanuel Felix Jovian Erwanto Riyan',
    nama(squadOrder(gangMembers(data, 'core'), sesi)));
}
{
  // Erwanto tidak jadi main tapi tetap patungan → ia duduk DI ATAS yang
  // absen dan tidak bayar, tapi tetap DI BAWAH yang ikut main: yang ikut main
  // itu yang datanya masih bisa berubah malam ini.
  const sesi = {
    id: 's1', gang: 'core', fee: 53000, games: [],
    squad: ['m7', 'm5'], paid: ['m9', 'm7'],
  };
  const urut = squadOrder(gangMembers(data, 'core'), sesi);
  c('yang absen TAPI sudah setor duduk di atas yang absen & tak bayar',
    nama(urut) === 'Imanuel Felix Erwanto Jovian Riyan', nama(urut));
  // Empat kelompoknya, dari yang paling menuntut tindakan sampai yang tidak.
  c('urutannya: main & belum setor · main & lunas · absen tapi setor · sisanya',
    urut[0].name === 'Imanuel' && urut[1].name === 'Felix' &&
    urut[2].name === 'Erwanto',
    nama(urut));
}
c('daftar asalnya tidak ikut teraduk (bukan sort di tempat)', (() => {
  const asal = gangMembers(data, 'core');
  const salinan = nama(asal);
  squadOrder(asal, { id: 's', gang: 'core', fee: 0, games: [], squad: ['m1'], paid: ['m1'] });
  return nama(asal) === salinan;
})());

// ============================================================
console.log('\n=== Layarnya memang memakai urutan itu ===');
// ============================================================
const layar = baca('app/futsal/[id].tsx');
c('baris Squad & Setoran digambar dari barisSquad',
  /const barisSquad = squadOrder\(anggota, sesi\);/.test(layar) &&
  /barisSquad\.map\(\(m\) => \{/.test(layar));
// Chip pencetak gol TIDAK ikut dikelompokkan: tombol yang berpindah tempat
// begitu seseorang ditandai lunas itu tombol yang salah pencet.
c('chip pencetak gol tetap urut abjad, tidak ikut bergeser',
  /\{anggota\s*\n\s*\.filter\(\(m\) => sesi\.squad\.includes\(m\.id\)\)/.test(layar));

console.log(ok ? '\n✅ LULUS — squad urut abjad, setoran di atas, absen di bawah.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
