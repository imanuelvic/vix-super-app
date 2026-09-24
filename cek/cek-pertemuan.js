// Uji jenis pertemuan & migrasi data CORE — memakai kode SUNGGUHAN dari
// lib/core.ts, ditranspilasi oleh TypeScript asli (bukan regex tebak-tebakan).
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';

const src = fs.readFileSync(R + 'lib/core.ts', 'utf8');

// --- Ambil blok murni (tanpa Firestore) apa adanya dari sumber ---
function ambil(awal, akhir) {
  const a = src.indexOf(awal);
  if (a < 0) throw new Error('tak ketemu: ' + awal);
  const b = src.indexOf(akhir, a);
  if (b < 0) throw new Error('penutup tak ketemu: ' + akhir);
  return src.slice(a, b);
}
const blok =
  ambil('export const MEETING_KINDS', 'export type Visitation') +
  ambil('/** Semua label jenis acara', 'export function subscribeVisitations');

const js = ts.transpileModule(
  'type MeetingKind = string; type CoreLeader = any; type Visitation = any;\n' +
    blok +
    '\nexport { MEETING_KINDS, meetingKindMeta, isMultiLeaderKind, meetingKindLabels, meetingLeaderNames };',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;

const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const {
  MEETING_KINDS, meetingKindMeta, isMultiLeaderKind, meetingKindLabels, meetingLeaderNames,
} = mod.exports;

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

console.log('=== Daftar jenis pertemuan ===');
const HARAP = [
  ['visitasi', '🔥', 'Visitasi CORE', false],
  ['fellowship', '👥', 'Fellowship CORE', false],
  ['oneOnOne', '1️⃣', 'One-on-One', false],
  ['mentoringMclClMt', '✨', 'Mentoring MCL CL MT', false],
  ['gathering', '🏡', 'Gathering CORE', false],
  ['charity', '💌', 'Charity CORE', false],
  ['thanksgiving', '🎉', 'Thanksgiving', false],
  ['christmas', '🎄', 'Christmas CORE', false],
  ['coreGabungan', '⛪', 'CORE Gabungan', true],
  // 21 Sep 2026: 🫂, bukan 👥 — di tabel Rekap Visitasi dua baris 👥 tak terbedakan.
  ['fellowshipGabungan', '🫂', 'Fellowship CORE Gabungan', true],
];
c('jumlahnya 10 (4 lama + 6 baru)', MEETING_KINDS.length === 10);
for (const [key, icon, label, multi] of HARAP) {
  const k = MEETING_KINDS.find((x) => x.key === key);
  const cocok = k && k.icon === icon && k.label === label && !!k.multiLeader === multi;
  c(`${icon} ${label}${multi ? '  (centang CORE banyak)' : ''}`, cocok);
}
c('4 jenis lama tidak berubah key-nya (data lama tetap terbaca)',
  ['visitasi', 'fellowship', 'oneOnOne', 'mentoringMclClMt']
    .every((k) => MEETING_KINDS.some((x) => x.key === k)));

console.log('\n=== Siapa yang boleh centang CORE lebih dari satu ===');
for (const [key, , label, multi] of HARAP) {
  c(`${label.padEnd(26)} → ${isMultiLeaderKind(key) ? 'BANYAK' : 'satu'}`,
    isMultiLeaderKind(key) === multi);
}

console.log('\n=== Thanksgiving sebagai penanda TAMBAHAN ===');
const v = (kind, thanksgiving) => ({ kind, thanksgiving, leaderIds: [] });
c('Christmas + Thanksgiving → dua-duanya tampil',
  meetingKindLabels(v('christmas', true)) === '🎄 Christmas CORE · 🎉 Thanksgiving');
c('Gathering + Thanksgiving → dua-duanya tampil',
  meetingKindLabels(v('gathering', true)) === '🏡 Gathering CORE · 🎉 Thanksgiving');
c('Gathering tanpa Thanksgiving → satu saja',
  meetingKindLabels(v('gathering', false)) === '🏡 Gathering CORE');
c('jenisnya MEMANG Thanksgiving → tidak ditulis dua kali',
  meetingKindLabels(v('thanksgiving', true)) === '🎉 Thanksgiving');
c('jenis tak dikenal → jatuh ke Visitasi, tidak crash',
  meetingKindLabels(v('entah-apa', false)) === '🔥 Visitasi CORE');

console.log('\n=== Nama CORE yang ditemui ===');
const leaders = [
  { id: 'a', heart: '💚', name: 'Riky' },
  { id: 'b', heart: '💛', name: 'Sarah' },
  { id: 'c', heart: '💙', name: 'Toni' },
  { id: 'd', heart: '💜', name: 'Mira' },
];
const L = (ids) => ({ kind: 'coreGabungan', thanksgiving: false, leaderIds: ids });
c('satu CORE', meetingLeaderNames(L(['a']), leaders) === '💚 Riky');
c('tiga CORE dirangkai koma',
  meetingLeaderNames(L(['a', 'b', 'c']), leaders) === '💚 Riky, 💛 Sarah, 💙 Toni');
c('kosong → "(CL tidak ditemukan)"',
  meetingLeaderNames(L([]), leaders) === '(CL tidak ditemukan)');
c('kosong dengan fallback sendiri (dipakai Dashboard)',
  meetingLeaderNames(L([]), leaders, { fallback: 'CORE' }) === 'CORE');
c('CL yang sudah dihapus dilewati, tidak jadi "undefined"',
  meetingLeaderNames(L(['a', 'sudah-dihapus', 'b']), leaders) === '💚 Riky, 💛 Sarah');
c('4 CORE dibatasi 2 nama → "+2 lagi" (reminder Dashboard)',
  meetingLeaderNames(L(['a', 'b', 'c', 'd']), leaders, { maxNames: 2 }) === '💚 Riky, 💛 Sarah +2 lagi');
c('pas 2 CORE dengan batas 2 → TIDAK ada "+0 lagi"',
  meetingLeaderNames(L(['a', 'b']), leaders, { maxNames: 2 }) === '💚 Riky, 💛 Sarah');

console.log('\n=== Migrasi data lama (leaderId tunggal → leaderIds) ===');
// Ambil logika normalisasi PERSIS dari subscribeVisitations.
const AWAL = 'list.map((v) => {';
const AKHIR = '\n        }),';
const a = src.indexOf(AWAL);
const b = src.indexOf(AKHIR, a);
if (a < 0 || b < 0) throw new Error('blok normalisasi tak ketemu');
const norm = 'return ' + src.slice(a, b) + '\n        });';
const migrasi = new Function(
  'list',
  ts.transpileModule(norm, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText,
);
const lama = [
  { id: 'v1', leaderId: 'a', date: 1, note: 'n', done: false },          // paling lama
  { id: 'v2', leaderId: 'b', kind: 'fellowship', agenda: 'x', date: 2, note: '', done: true },
  { id: 'v3', kind: 'coreGabungan', leaderIds: ['a', 'b'], thanksgiving: true, agenda: '', date: 3, note: '', done: false },
];
const hasil = migrasi(lama);
c('leaderId lama jadi leaderIds: ["a"]',
  JSON.stringify(hasil[0].leaderIds) === '["a"]');
c('field leaderId lama DIBUANG (tak ada dua sumber kebenaran)',
  !('leaderId' in hasil[0]) && !('leaderId' in hasil[1]));
c('kind kosong → default "visitasi"', hasil[0].kind === 'visitasi');
c('agenda kosong → "" bukan undefined', hasil[0].agenda === '');
c('thanksgiving kosong → false bukan undefined', hasil[0].thanksgiving === false);
c('data yang SUDAH baru tidak dirusak',
  JSON.stringify(hasil[2].leaderIds) === '["a","b"]' && hasil[2].thanksgiving === true);
c('kind yang sudah ada tidak ditimpa', hasil[1].kind === 'fellowship');
c('tak ada undefined bocor',
  !JSON.stringify(hasil).includes('undefined') && !hasil.some((h) => h.leaderIds === undefined));

console.log('\n=== Filter "Thanksgiving" menangkap keduanya ===');
const matchKind = (v, k) => v.kind === k || (k === 'thanksgiving' && v.thanksgiving);
c('acara yang jenisnya Thanksgiving → kena', matchKind(v('thanksgiving', false), 'thanksgiving'));
c('acara lain yang "sekalian Thanksgiving" → kena', matchKind(v('christmas', true), 'thanksgiving'));
c('acara biasa → TIDAK kena', !matchKind(v('christmas', false), 'thanksgiving'));
c('filter jenis lain tidak terpengaruh penanda',
  matchKind(v('christmas', true), 'christmas') && !matchKind(v('gathering', true), 'christmas'));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
