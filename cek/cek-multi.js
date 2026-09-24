// Cek fitur Multiplikasi CORE 🌱 — daftar, layar timeline + anggota, dan
// kecocokan data awalnya dengan catatan asli (termasuk HARI tiap tanggal).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

const lib = baca('lib/multiplication.ts');
const seedSrc = baca('lib/multiplicationSeed.ts');
const tab = baca('components/core/MultiplicationTab.tsx');
const layar = baca('app/multiplication/[id].tsx');

// Ambil literal SEEDS apa adanya dari berkasnya lalu jalankan — jadi yang
// diperiksa DATA SUNGGUHAN, bukan tebakan dari regex.
const awal = seedSrc.indexOf('const SEEDS: Seed[] = [');
const akhir = seedSrc.indexOf('\n];', awal);
// eslint-disable-next-line no-eval
const SEEDS = eval(seedSrc.slice(awal + 'const SEEDS: Seed[] = '.length, akhir + 2));

// ==================== 1. Model datanya ====================
console.log('\n1. Model data — timeline & pembagian anggota');
ok('satu dokumen per multiplikasi', /'users', uid, 'multiplications', id/.test(lib));
ok('langkah punya tanggal, judul, butir catatan, & status',
  /export type MultiStep = \{[\s\S]{0,1200}?date: Timestamp;[\s\S]{0,400}?notes: string\[\];[\s\S]{0,900}?cancelled: boolean;/.test(lib));
ok('anggota punya nama, umur, alasan, & kelompok',
  /export type MultiMember = \{[\s\S]{0,300}age: number \| null;[\s\S]{0,120}reason: string;[\s\S]{0,80}side: MultiSide;/.test(lib));
ok('empat kelompok: CORE asal, CORE baru, tidak ikut, Others',
  /'a' \| 'b' \| 'out' \| 'other'/.test(lib) && /label: 'Tidak ikut'/.test(lib) && /label: 'Others'/.test(lib));
ok('status DITURUNKAN dari langkahnya (tak bisa bohong)',
  /export function multiStatus\(/.test(lib) &&
  !/status: MultiStatus;/.test(lib));
ok('langkah ❌ batal tidak ikut dihitung — pembilang maupun penyebut',
  /const live = m\.steps\.filter\(\(s\) => !s\.cancelled\);/.test(lib));
ok('timeline dikelompokkan per bulan', /export function stepsByMonth\(/.test(lib));
ok('ada penunjuk "langkah berikutnya"', /export function nextStep\(/.test(lib));
ok('hapus multiplikasi PERMANEN (deleteDoc)',
  /export function deleteMultiplication[\s\S]{0,120}deleteDoc\(/.test(lib));
ok('hapus langkah/anggota PERMANEN (array ditulis ulang)',
  /steps: m\.steps\.filter\(\(s\) => s\.id !== editStep\.id\)/.test(layar) &&
  /members: m\.members\.filter\(\(x\) => x\.id !== editMember\.id\)/.test(layar));
ok('tidak ada soft-delete', !/isDeleted|archived: true/.test(lib + layar + tab));

// Bukti hitungan (rumus yang sama, dijalankan atas contoh).
const progress = (steps) => {
  const live = steps.filter((s) => !s.cancelled);
  return { done: live.filter((s) => s.done).length, total: live.length };
};
const status = (steps) => {
  const { done, total } = progress(steps);
  if (total > 0 && done === total) return 'done';
  return done > 0 ? 'running' : 'planned';
};
const S = (done, cancelled = false) => ({ done, cancelled });
ok('3 beres dari 4 langkah → berjalan',
  status([S(true), S(true), S(true), S(false)]) === 'running');
ok('semua beres → selesai', status([S(true), S(true)]) === 'done');
ok('belum ada yang beres → rencana', status([S(false), S(false)]) === 'planned');
ok('langkah batal tidak menahan status "selesai"',
  status([S(true), S(false, true)]) === 'done');
ok('4 langkah, 1 batal → penyebutnya 3',
  progress([S(true), S(true), S(false), S(false, true)]).total === 3);

// ==================== 2. Daftar & layar ====================
console.log('\n2. Daftar multiplikasi & layar detailnya');
ok('placeholder "Coming Soon" sudah hilang', !/Coming Soon/.test(tab));
ok('kartunya menuju layar baru',
  /pathname: '\/multiplication\/\[id\]'/.test(tab));
ok('rutenya terdaftar di typed routes',
  /multiplication\/\[id\]/.test(baca('.expo/types/router.d.ts')));
// Tombolnya kini <EditButton> bersama — satu rupa dengan tombol ✏️ di
// seluruh app (lihat components/common/EditButton.tsx).
ok('tombol ✏️ jadi SAUDARA area ketuk (bukan Pressable bersarang)',
  /<\/PressableScale>\s*<EditButton onPress=\{\(\) => openEdit\(m\)\} \/>/.test(tab));
ok('tombol ✏️-nya yang dipakai bersama, bukan gambar sendiri',
  /from '@\/components\/common\/EditButton'/.test(tab) &&
  !/editButton/.test(tab));
ok('layar detail punya dua bagian: Timeline & Anggota',
  /key: 'timeline', label: '📆 Timeline'/.test(layar) &&
  /key: 'members',[\s\S]{0,40}label: '👥 Anggota'/.test(layar));
ok('kartu "langkah berikutnya" di atas', /⏭️ Langkah berikutnya/.test(layar));
ok('ketuk lambang ✅/⏳ = tandai beres, tanpa buka sheet',
  /onPress=\{\(\) => toggleStep\(step\)\}/.test(layar));
ok('langkah ❌ batal tidak bisa dicentang dari daftar',
  /if \(!m \|\| step\.cancelled\) return;/.test(layar));
ok('langkah batal tetap KELIHATAN, cuma diredupkan',
  /stepCancel: \{ opacity: 0\.6 \}/.test(layar) &&
  /stepTitleCancel: \{ textDecorationLine: 'line-through' \}/.test(layar));
ok('butir catatan: satu baris = satu butir',
  /sNotes\s*\.split\('\\n'\)[\s\S]{0,80}\.filter\(Boolean\)/.test(layar));
ok('anggota diurut termuda → tertua', /\(a\.age \?\? 999\) - \(b\.age \?\? 999\)/.test(lib));
ok('kelompok anggota tampil dengan jumlahnya',
  /\$\{sideLabel\(m, s\.key\)\} \$\{membersOf\(m, s\.key\)\.length\}/.test(layar));
ok('warna semua dari Color, tak ada hex mentah',
  !/#[0-9A-Fa-f]{6}/.test(tab) && !/#[0-9A-Fa-f]{6}/.test(layar));
ok('pemilih hati memakai daftar HEARTS yang sudah ada (bukan salinan)',
  /import \{ HEARTS \} from '@\/lib\/core'/.test(tab));

// ==================== 3. Isi awal ====================
console.log('\n3. Isi awal — salinan catatan multiplikasimu');
ok('ditulis SEKALI, hanya kalau daftarnya masih kosong',
  /if \(!user \|\| list === null \|\| list\.length > 0 \|\| seeded\.current\) return;/.test(tab));
ok('gagal tulis → boleh dicoba lagi', /seeded\.current = false;/.test(tab));
ok('lima multiplikasi', SEEDS.length === 5, `${SEEDS.length}`);
const byId = Object.fromEntries(SEEDS.map((s) => [s.id, s]));
for (const [id, dari, ke] of [
  ['multi-victor-cevo', 'Victor', 'Cevo'],
  ['multi-sarah-reyki', 'Sarah', 'Reyki'],
  ['multi-theofilus-riky', 'Theofilus', 'Riky'],
  ['multi-febryna-elvina', 'Febryna', 'Elvina'],
  ['multi-novia-david', 'Novia', 'David'],
]) {
  ok(`${dari} → ${ke}`,
    byId[id] && byId[id].fromName === dari && byId[id].toName === ke);
}
ok('hati tiap CORE sesuai catatanmu',
  byId['multi-sarah-reyki'].fromHeart === '🧡' &&
  byId['multi-sarah-reyki'].toHeart === '🖤' &&
  byId['multi-theofilus-riky'].fromHeart === '🩵' &&
  byId['multi-theofilus-riky'].toHeart === '🤎' &&
  byId['multi-febryna-elvina'].fromHeart === '💛' &&
  byId['multi-febryna-elvina'].toHeart === '🤍' &&
  byId['multi-novia-david'].fromHeart === '💜' &&
  byId['multi-novia-david'].toHeart === '💙');
ok('hati CORE Cevo sengaja dikosongkan (belum pernah kamu sebut)',
  byId['multi-victor-cevo'].toHeart === '');

console.log('\n   Jumlah langkah & anggota');
for (const [id, langkah, anggota] of [
  ['multi-victor-cevo', 19, 0],
  ['multi-sarah-reyki', 21, 25],
  ['multi-theofilus-riky', 22, 22],
  ['multi-febryna-elvina', 2, 35],
  ['multi-novia-david', 2, 34],
]) {
  const s = byId[id];
  const n =
    (s.a?.length ?? 0) + (s.b?.length ?? 0) + (s.out?.length ?? 0) + (s.other?.length ?? 0);
  ok(`${id}: ${langkah} langkah · ${anggota} anggota`,
    (s.steps?.length ?? 0) === langkah && n === anggota,
    `dapat ${s.steps?.length ?? 0} & ${n}`);
}
const totalAnggota = SEEDS.reduce(
  (n, s) =>
    n + (s.a?.length ?? 0) + (s.b?.length ?? 0) + (s.out?.length ?? 0) + (s.other?.length ?? 0),
  0,
);
ok(`total ${totalAnggota} anggota terpindah dari spreadsheet`, totalAnggota === 116);

console.log('\n   Tiap tanggal jatuh di HARI yang kamu tulis');
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
// Diketik ulang dari catatan aslimu — inilah penangkap salah ketik tanggal.
const DIHARAPKAN = {
  '2024-11-5': 'Selasa',
  // ⚠️ Sheet Multi💜💙 menulis "Wednesday, 7 November 2024" — padahal 7
  // November 2024 jatuh KAMIS. Tanggalnya dipakai apa adanya (bukan digeser
  // diam-diam); yang dicatat di sini hari sebenarnya, supaya ketidakcocokan
  // di sumbernya tetap kelihatan dan bisa kamu putuskan sendiri.
  '2024-11-7': 'Kamis',
  '2025-1-8': 'Rabu', '2025-1-10': 'Jumat',
  '2025-10-17': 'Jumat', '2025-10-18': 'Sabtu', '2025-10-31': 'Jumat',
  '2025-11-1': 'Sabtu', '2025-11-8': 'Sabtu', '2025-11-13': 'Kamis',
  '2025-11-15': 'Sabtu', '2025-11-28': 'Jumat',
  '2025-12-1': 'Senin', '2025-12-6': 'Sabtu', '2025-12-9': 'Selasa',
  '2025-12-13': 'Sabtu', '2025-12-14': 'Minggu', '2025-12-17': 'Rabu',
  '2025-12-20': 'Sabtu', '2025-12-21': 'Minggu',
  '2026-1-3': 'Sabtu', '2026-1-4': 'Minggu', '2026-1-6': 'Selasa',
  '2026-1-7': 'Rabu', '2026-1-9': 'Jumat', '2026-1-10': 'Sabtu',
  '2026-1-11': 'Minggu', '2026-1-16': 'Jumat', '2026-1-17': 'Sabtu',
  '2026-1-18': 'Minggu', '2026-1-19': 'Senin', '2026-1-21': 'Rabu',
  '2026-1-22': 'Kamis', '2026-1-23': 'Jumat', '2026-1-26': 'Senin',
  '2026-1-28': 'Rabu', '2026-1-30': 'Jumat',
  '2026-2-3': 'Selasa', '2026-2-4': 'Rabu', '2026-2-6': 'Jumat',
  '2026-4-8': 'Rabu', '2026-4-11': 'Sabtu', '2026-4-15': 'Rabu',
  '2026-4-21': 'Selasa', '2026-4-22': 'Rabu', '2026-4-29': 'Rabu',
  '2026-5-8': 'Jumat', '2026-5-9': 'Sabtu', '2026-5-13': 'Rabu',
  '2026-5-14': 'Kamis',
  '2026-6-3': 'Rabu', '2026-6-10': 'Rabu', '2026-6-13': 'Sabtu',
  '2026-6-14': 'Minggu', '2026-6-17': 'Rabu', '2026-6-18': 'Kamis',
  '2026-6-20': 'Sabtu', '2026-6-21': 'Minggu', '2026-6-24': 'Rabu',
  '2026-7-18': 'Sabtu', '2026-9-16': 'Rabu',
};
const salah = [];
const terpakai = new Set();
for (const s of SEEDS) {
  for (const step of s.steps ?? []) {
    const [y, mo, d] = step.on;
    const key = `${y}-${mo}-${d}`;
    const harusnya = DIHARAPKAN[key];
    if (!harusnya) continue;
    terpakai.add(key);
    const nyata = HARI[new Date(y, mo - 1, d).getDay()];
    if (nyata !== harusnya) salah.push(`${key} → ${nyata}, kamu tulis ${harusnya}`);
  }
}
ok(`${terpakai.size} tanggal timeline dicocokkan harinya`, terpakai.size >= 55);
ok('semua tanggalnya jatuh di hari yang benar', salah.length === 0, salah.join(' · '));
// Dua tonggak yang cuma ada di sheet (bukan di timeline tertulis).
for (const [id, kunci, nama] of [
  ['multi-febryna-elvina', 'meetingDate', 'Multiplication Meeting Febryna'],
  ['multi-novia-david', 'meetingDate', 'Multiplication Meeting Novia'],
]) {
  const [y, mo, d] = byId[id][kunci];
  ok(`${nama} — ${HARI[new Date(y, mo - 1, d).getDay()]}, ${d}/${mo}/${y}`,
    HARI[new Date(y, mo - 1, d).getDay()] === DIHARAPKAN[`${y}-${mo}-${d}`]);
}

console.log('\n   Yang ditandai ❌ / ⏳ sesuai catatanmu');
const tanda = (id, judul) =>
  (byId[id].steps ?? []).find((s) => s.title.startsWith(judul))?.mark ?? '✅';
ok('Reyki Last Fellowship (Kepulauan Seribu) = ❌ batal',
  tanda('multi-sarah-reyki', 'Reyki Last Fellowship CORE Sarah (Kepulauan') === '❌');
ok('…penggantinya (R. Tifara) = ✅ beres',
  tanda('multi-sarah-reyki', 'Reyki Last Fellowship CORE Sarah (R. Tifara') === '✅');
ok('Pastor & MCL Visitation CORE Theofilus = ❌',
  tanda('multi-theofilus-riky', 'Pastor & MCL Visitation') === '❌');
ok('Riky dilantik (18 Juli) masih ⏳ belum',
  tanda('multi-theofilus-riky', 'CORE Leader Meeting') === '⏳');
ok('Riky kembali CORE (16 Sep) masih ⏳', tanda('multi-theofilus-riky', 'Riky kembali') === '⏳');
// Empat langkah di catatanmu ditulis "9 Januari → 26 Januari" dsb — tanggal
// asalnya ❌, tanggal barunya ditulis di keterangannya.
ok('4 langkah Sarah–Reyki yang digeser diberi keterangan tanggal barunya',
  (byId['multi-sarah-reyki'].steps ?? []).filter(
    (s) => s.mark === '❌' && (s.notes ?? []).some((n) => /Digeser ke/.test(n)),
  ).length === 4);
ok('“Rabu, 4 Jan” yang keliru ditaruh di 4 Februari + dicatat alasannya',
  (byId['multi-victor-cevo'].steps ?? []).some(
    (s) => s.on[1] === 2 && s.on[2] === 4 && (s.notes ?? []).some((n) => /Rabu, 4 Jan/.test(n)),
  ));

console.log('\n   Beberapa anggota diadu dengan sheet-nya');
const cari = (id, nama) => {
  const s = byId[id];
  for (const [side, list] of [['a', s.a], ['b', s.b], ['out', s.out], ['other', s.other]]) {
    const hit = (list ?? []).find((x) => x[0] === nama);
    if (hit) return { side, age: hit[1], reason: hit[2] };
  }
  return null;
};
for (const [id, nama, side, age, reason] of [
  ['multi-sarah-reyki', 'Sarah Lucia Dolorosa Zega', 'a', 27, 'CORE Leader'],
  ['multi-sarah-reyki', 'Gede Reyki Astika', 'b', 23, 'CORE Leader'],
  ['multi-sarah-reyki', 'Meidiana Mega', 'b', 25, 'Bantu melayani, bagian keuangan'],
  ['multi-theofilus-riky', 'Handy Hintoro', 'a', 33, 'Umur lebih cocok dengan Theo'],
  ['multi-theofilus-riky', 'Debri Luky', 'b', 28, 'Pasangannya Jesse'],
  ['multi-febryna-elvina', 'Kenneth Johanis Alexander Longdong', 'a', 19, 'Umur lebih cocok dengan Febryna'],
  ['multi-febryna-elvina', 'Ribka Emmanauli', 'out', 24, 'Pindah ke CORE Jean (Rabu)'],
  ['multi-febryna-elvina', 'Gideon Wijaya', 'other', 30, 'Ingin pindah CORE'],
  ['multi-novia-david', 'Novia Tanasia', 'a', 26, 'CORE Leader'],
  ['multi-novia-david', 'Christanael Fellyandro Paath', 'b', 18, 'Ikut Tania'],
  ['multi-novia-david', 'Maria Resita Octavia', 'out', 24, 'Pindah ke CORE Lanemey'],
  ['multi-novia-david', 'Valerie Tjundawan', 'other', 18, 'CORE Campaign'],
]) {
  const hit = cari(id, nama);
  ok(`${nama} · ${age} th · ${reason}`,
    hit && hit.side === side && hit.age === age && hit.reason === reason,
    hit ? `${hit.side}/${hit.age}/${hit.reason}` : 'tidak ketemu');
}
ok('tiap anggota punya umur (tidak ada yang kosong)',
  SEEDS.every((s) =>
    [...(s.a ?? []), ...(s.b ?? []), ...(s.out ?? []), ...(s.other ?? [])].every(
      (x) => typeof x[1] === 'number' && x[1] > 0,
    ),
  ));
ok('tidak ada nama kembar di dalam satu multiplikasi',
  SEEDS.every((s) => {
    const nama = [...(s.a ?? []), ...(s.b ?? []), ...(s.out ?? []), ...(s.other ?? [])].map((x) => x[0]);
    return new Set(nama).size === nama.length;
  }));

console.log('\nAturan wajib');
// Yang diperiksa: tidak ada paket LUAR baru. Impor relatif (./firebase,
// ./format) memang isi proyek sendiri, jadi tidak dihitung.
// 22 Sep 2026: expo-notifications ada di package.json untuk pengingat Finance;
// Multiplikasi sendiri tetap tak memakainya.
ok('tidak ada dependency / modul native baru untuk Multiplikasi',
  !/expo-notifications|expo-background/.test(lib + seedSrc) &&
  !/from '(?!\.\/|@\/|react|react-native|expo-router|firebase)/.test(lib + seedSrc));
ok('subtab Multiplication tetap di tempatnya',
  /label: 'Multiplication'/.test(baca('app/(tabs)/core.tsx')));

console.log(gagal === 0 ? '\n✅ LULUS — fitur Multiplikasi siap.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
