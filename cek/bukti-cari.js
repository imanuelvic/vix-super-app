// Membuktikan penyebab bug "dicari tapi tidak muncul" di sub-tab Pertemuan,
// memakai logika pencarian yang PERSIS seperti di VisitationTab.tsx.
const MEETING_KINDS = [
  { key: 'visitasi', icon: '🔥', label: 'Visitasi CORE' },
  { key: 'oneonone', icon: '1️⃣', label: 'One-on-One' },
];
const meta = (k) => MEETING_KINDS.find((x) => x.key === k) ?? MEETING_KINDS[0];
const meetingKindLabels = (v) => `${meta(v.kind).icon} ${meta(v.kind).label}`;

// Persis lib/core.ts
function meetingLeaderNames(v, leaders, { fallback = '(CL tidak ditemukan)' } = {}) {
  const nama = v.leaderIds
    .map((id) => leaders.find((l) => l.id === id))
    .filter(Boolean)
    .map((l) => `${l.heart} ${l.name}`);
  return nama.length === 0 ? fallback : nama.join(', ');
}

// Persis VisitationTab.tsx (SEBELUM diperbaiki)
function cariLama(query, visitations, leaders) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return visitations.filter((v) => {
    const hay = `${v.note} ${v.agenda} ${meetingLeaderNames(v, leaders)} ${meetingKindLabels(v)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// SESUDAH: nama ex-CL ikut dikenali + tanggal yang tampil di kartu ikut dicari.
const DAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const formatFullDate = (d) =>
  `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;

function cariBaru(query, visitations, leaders, exLeaders) {
  const semua = [...leaders, ...exLeaders];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return visitations.filter((v) => {
    const hay = `${v.note} ${v.agenda} ${meetingLeaderNames(v, semua)} ${meetingKindLabels(v)} ${formatFullDate(v.date)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

// ===== Data seperti punyamu =====
const leaders = [
  { id: 'l1', heart: '🤎', name: 'Riky' },
  { id: 'l2', heart: '💚', name: 'Lanemey' },
];
// Nicholas SUDAH diarsipkan → tidak ada di `leaders`, adanya di `exLeaders`.
const exLeaders = [{ id: 'l9', heart: '❤️', name: 'Nicholas' }];

const visitations = [
  { id: 'v1', leaderIds: ['l1'], kind: 'oneonone', note: '1st Mentoring',
    agenda: 'Spirituality, Health, Family', date: new Date(2026, 7, 21) },
  { id: 'v2', leaderIds: ['l9'], kind: 'visitasi', note: 'Ngobrol santai',
    agenda: 'Kabar kuliah', date: new Date(2026, 5, 10) },
  { id: 'v3', leaderIds: ['l2'], kind: 'oneonone', note: '1st Mentoring',
    agenda: 'Career', date: new Date(2026, 7, 31) },
];

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

console.log('\n=== BUKTI BUG (kode lama) ===');
const lamaNicholas = cariLama('nicholas', visitations, leaders);
console.log(`  cari "nicholas" → ${lamaNicholas.length} hasil (harusnya 1)`);
ok('TERBUKTI: nama Ex CORE Leader tidak ketemu sama sekali',
  lamaNicholas.length === 0);
console.log(`  kartunya sendiri tertulis: "${meetingLeaderNames(visitations[1], leaders)}"`);
ok('TERBUKTI: kartunya pun tidak menampilkan namanya',
  meetingLeaderNames(visitations[1], leaders) === '(CL tidak ditemukan)');
const lamaTanggal = cariLama('agustus', visitations, leaders);
console.log(`  cari "agustus" → ${lamaTanggal.length} hasil (harusnya 2)`);
ok('TERBUKTI: tanggal yang tertulis di kartu tidak ikut dicari',
  lamaTanggal.length === 0);

console.log('\n=== SESUDAH DIPERBAIKI ===');
const cari = (q) => cariBaru(q, visitations, leaders, exLeaders);
ok('"nicholas" → ketemu visitasinya', cari('nicholas').map((v) => v.id).join() === 'v2');
ok('"Nicholas" (huruf besar) juga', cari('Nicholas').length === 1);
ok('"nichol" (potongan nama) juga', cari('nichol').length === 1);
ok('"agustus" → 2 visitasi bulan Agustus',
  cari('agustus').map((v) => v.id).sort().join() === 'v1,v3');
ok('"21 agustus" → tepat satu', cari('21 agustus').map((v) => v.id).join() === 'v1');
ok('"jumat" (nama hari) juga bisa', cari('jumat').length === 1);
ok('"riky mentoring" (urutan kata bebas)', cari('riky mentoring').map((v) => v.id).join() === 'v1');
ok('"mentoring riky" (dibalik, tetap ketemu)', cari('mentoring riky').map((v) => v.id).join() === 'v1');
ok('"1st mentoring" → dua-duanya', cari('1st mentoring').length === 2);
ok('cari isi agenda tetap jalan', cari('kuliah').map((v) => v.id).join() === 'v2');
ok('cari jenis visitasi tetap jalan', cari('one-on-one').length === 2);
ok('yang memang tidak ada → kosong', cari('zzz').length === 0);
ok('kata kosong → tidak menampilkan apa-apa', cari('   ').length === 0);
ok('CL aktif tetap ketemu seperti biasa', cari('lanemey').map((v) => v.id).join() === 'v3');
ok('nama ex-CL sekarang tampil di kartunya',
  meetingLeaderNames(visitations[1], [...leaders, ...exLeaders]) === '❤️ Nicholas');

console.log(gagal === 0 ? '\n✅ LULUS' : `\n❌ ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
