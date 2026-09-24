// Tiga permintaan: (1) Wheel of Life per CORE Leader dari satu layar yang
// sama, (2) hitung mundur visitasi memojok ke kanan bawah kartu, (3) satu
// rupa tombol ✏️ + ketuk baris CL/Main Team = modal BACA-SAJA.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-wheel');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ===================================================================
// 1. JALUR FIRESTORE-nya BENAR — diuji dengan menjalankan kodenya
// ===================================================================
console.log('\n=== Wheel per CORE Leader: jalur simpannya (kode dijalankan) ===');

// tsc ikut menarik lib/firebase.ts yang memakai `process` (butuh @types/node
// yang tak dipasang di proyek app). Keluhan TIPE itu tidak menghalangi tsc
// MEMBUAT JS-nya — dan yang kita uji di sini memang perilakunya, bukan
// tipenya (tipe sudah dijaga `npx tsc --noEmit` di proyek). Jadi kegagalan
// exit code diabaikan, lalu keberadaan hasil kompilasinya yang dipastikan.
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/wheel.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch {
  /* lihat catatan di atas */
}
if (!fs.existsSync(path.join(OUT, 'wheel.js'))) {
  console.log('  ❌ gagal mengompilasi lib/wheel.ts — tes tak bisa lanjut');
  process.exit(1);
}

// Firestore palsu: `doc()` cuma merangkai jalurnya jadi teks, supaya bisa
// dibaca & dibandingkan. Tak ada jaringan, tak ada Firebase sungguhan.
const ditulis = [];
const didengar = [];
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      doc: (_db, ...seg) => ({ path: seg.join('/') }),
      setDoc: (ref, data, opts) => {
        ditulis.push({ path: ref.path, data, opts });
        return Promise.resolve();
      },
      Timestamp: { now: () => 'JAM' },
    };
  }
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') {
    return {
      liveDoc: (ref) => {
        didengar.push(ref.path);
        return () => {};
      },
    };
  }
  return asli(req, parent, isMain);
};
const W = require(path.join(OUT, 'wheel.js'));
Module._load = asli;

W.subscribeWheel('U1', '2026-Q3', () => {});
ok('tanpa pemilik → tetap ke rodaku sendiri (data lama tak pindah)',
  didengar[0] === 'users/U1/wheel/2026-Q3', didengar[0]);

W.subscribeWheel('U1', '2026-Q3', () => {}, undefined, 'cRiky');
ok('dengan id CL → cabangnya sendiri di bawah coreWheel',
  didengar[1] === 'users/U1/coreWheel/cRiky/quarters/2026-Q3', didengar[1]);

W.saveWheelScores('U1', '2026-Q3', { health: 7 }, {}, 'cRiky');
W.saveWheelFocus('U1', '2026-Q3', [{ area: 'health', targetScore: 9, plan: 'lari' }], 'cRiky');
ok('skor CL ditulis ke dokumen CL, bukan ke punyaku',
  ditulis[0].path === 'users/U1/coreWheel/cRiky/quarters/2026-Q3' &&
  ditulis[0].data.scores.health === 7);
ok('fokus CL ditulis ke dokumen yang SAMA (skor & fokus tak saling menimpa)',
  ditulis[1].path === ditulis[0].path &&
  ditulis[0].opts.merge === true && ditulis[1].opts.merge === true);

W.saveWheelScores('U1', '2026-Q3', { health: 3 }, {});
ok('menyimpan rodaku sendiri TIDAK menyentuh dokumen CL mana pun',
  ditulis[2].path === 'users/U1/wheel/2026-Q3');

// Dua CL berbeda tidak boleh berbagi dokumen.
W.saveWheelScores('U1', '2026-Q3', { fun: 5 }, {}, 'cElvina');
ok('tiap CL punya dokumennya sendiri',
  ditulis[3].path === 'users/U1/coreWheel/cElvina/quarters/2026-Q3' &&
  ditulis[3].path !== ditulis[0].path);

// ===================================================================
// 2. SATU layar, bukan salinan
// ===================================================================
console.log('\n=== Satu layar dipakai berdua ===');
const wheel = baca('app/wheel.tsx');
const leadersTab = baca('components/core/LeadersTab.tsx');

ok('tidak ada layar Wheel kedua yang disalin',
  !fs.existsSync(path.join(ROOT, 'app/core-wheel.tsx')) &&
  !fs.existsSync(path.join(ROOT, 'components/core/WheelTab.tsx')));
ok('layarnya membaca ?leaderId dari rutenya',
  /useLocalSearchParams<\{[\s\S]{0,120}leaderId\?: string;/.test(wheel) &&
  /const owner = params\.leaderId \|\| null;/.test(wheel));
// Panggilan simpannya kini juga membawa `createdAt` (cap "kapan dibuat"),
// jadi bentuknya multi-baris.
ok('pemiliknya dioper ke KETIGA jalur data (baca, simpan skor, simpan fokus)',
  /subscribeWheel\([\s\S]{0,220}owner,\s*\n\s*\),/.test(wheel) && // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
  /saveWheelScores\([\s\S]{0,200}draftNotes,\s*\n\s*owner,/.test(wheel) &&
  /saveWheelFocus\(user\.uid, qid, focus, owner, data\.createdAt\)/.test(wheel));
ok('kunci datanya memuat pemiliknya — skor CL A tak sempat tampil di layar CL B',
  /useKeyedData<string, WheelData>\(\s*`\$\{owner \?\? 'me'\}\/\$\{qid\}`,?\s*\)/.test(wheel));
ok('judul & tombol kembali ikut menyesuaikan siapa yang dibuka',
  /backLabel=\{owner \? 'CORE' : 'Home'\}/.test(wheel) &&
  /title=\{owner \? `Wheel \$\{params\.heart \?\? '🎡'\} \$\{orang\}` : 'Wheel of Life 🎡'\}/.test(wheel));

// Fitur yang WAJIB ikut terbawa — bukan versi sunat.
ok('fokus kuartal, skor per area, & pengisian assessment tetap satu paket',
  /type Mode = 'overview' \| 'assess' \| 'focus';/.test(wheel) &&
  /Mulai Assessment/.test(wheel) &&
  /🎯 Quarter Focus/.test(wheel) &&
  /📋 Score per Area/.test(wheel) &&
  /<RadarChart/.test(wheel));

console.log('\n=== Tombol 🎡 di daftar CORE Leader ===');
ok('ada tombol 🎡 di kartu tiap CL',
  /<EmojiButton\s*\n\s*emoji="🎡"/.test(leadersTab));
ok('menuju layar Wheel yang sama, membawa id + nama + hatinya',
  /pathname: '\/wheel',\s*\n\s*params: \{ leaderId: l\.id, name: l\.name, heart: l\.heart \}/.test(leadersTab));
ok('tombolnya di pojok kanan ATAS kartu',
  /alignItems: 'flex-start',/.test(leadersTab) &&
  /cardActions: \{ flexDirection: 'row', gap: 8 \}/.test(leadersTab));
ok('Main Team TIDAK ikut dapat 🎡 (yang digembalakan roda hidupnya = CL)',
  (leadersTab.match(/emoji="🎡"/g) || []).length === 1);

// ===================================================================
// 3. Ketuk baris = LIHAT, tombol ✏️ = UBAH
// ===================================================================
console.log('\n=== CORE Leader & Main Team: lihat dulu, baru ubah ===');
ok('ketuk baris CL → modal baca-saja, BUKAN form edit',
  /onPress=\{\(\) =>\s*\n\s*setViewing\(\{\s*\n\s*emoji: l\.heart,/.test(leadersTab));
ok('ketuk baris Main Team → modal baca-saja juga',
  /onPress=\{\(\) =>\s*\n\s*setViewing\(\{\s*\n\s*emoji: '👤',/.test(leadersTab));
ok('form edit HANYA terbuka dari tombol ✏️',
  /<EditButton onPress=\{\(\) => openEdit\(l\)\} \/>/.test(leadersTab) &&
  /<EditButton onPress=\{\(\) => openEditMT\(m\)\} \/>/.test(leadersTab));

// Modal baca-saja benar-benar tak bisa mengubah apa pun.
const modalLihat = leadersTab.slice(
  leadersTab.indexOf('visible={viewing !== null}'),
  leadersTab.indexOf('{/* Bottom sheet tambah/edit CL */}'),
);
ok('modal baca-saja tak punya satu pun kolom isian',
  modalLihat.length > 0 &&
  !modalLihat.includes('FormInput') &&
  !modalLihat.includes('onChangeText') &&
  !modalLihat.includes('DualButtons'));
ok('isinya data lengkap orangnya, dipakai bersama CL & Main Team',
  /function PersonView\(\{/.test(leadersTab) &&
  /person: CoreLeader \| MainTeamMember;/.test(leadersTab) &&
  (leadersTab.match(/<PersonView person=/g) || []).length === 1);
ok('baris yang datanya masih kosong tidak ditampilkan (bukan deretan "—")',
  // (15 Sep 2026: judulnya "Gender", berdampingan dengan 📱 No. HP.)
  /\{jenis \? <InfoRow label="🚻 Gender" value=\{jenis\} half \/> : null\}/.test(leadersTab));

// Tombolnya SAUDARA area ketuk — kalau anaknya, ketukan ✏️ ikut membuka
// modal lihat di iOS.
const areaKetukCL = leadersTab.slice(
  leadersTab.indexOf('<PressableScale\n                style={styles.cardLeft}'),
  leadersTab.indexOf('<View style={styles.cardRight}>'),
);
ok('tombol 🎡 & ✏️ jadi SAUDARA area ketuk, bukan anaknya',
  areaKetukCL.length > 0 &&
  areaKetukCL.includes('</PressableScale>') &&
  !areaKetukCL.includes('EmojiButton') &&
  !areaKetukCL.includes('EditButton'));

// ===================================================================
// 4. Satu rupa tombol ✏️ di SELURUH app
// ===================================================================
console.log('\n=== Tombol ✏️: satu rupa di mana-mana ===');
const tombol = baca('components/common/EditButton.tsx');
ok('rupanya ditulis SEKALI saja',
  /export function EditButton/.test(tombol) &&
  /icon="pencil"/.test(tombol) &&
  !/iconColor/.test(tombol));

const PAKAI = [
  'components/core/MonthlyTab.tsx',
  'components/core/MultiplicationTab.tsx',
  'components/core/LeadersTab.tsx',
  'components/habits/HabitsTab.tsx',
  'components/fitness/NotesTab.tsx',
  'app/timeline.tsx',
  'app/history.tsx',
];
for (const f of PAKAI) {
  ok(`${f} pakai tombol bersama`, /<EditButton/.test(baca(f)));
}

// Tidak boleh ada lagi yang menggambar pensilnya sendiri.
const SEMUA = [];
(function sisir(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) sisir(rel);
    else if (e.name.endsWith('.tsx')) SEMUA.push(rel);
  }
})('app');
(function sisir(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) sisir(rel);
    else if (e.name.endsWith('.tsx')) SEMUA.push(rel);
  }
})('components');

// Ikon pensil masih boleh dipakai tombol BERLABEL (mis. "Ubah panduan" di
// Panduan CORE, "Ubah tanggal donor terakhir" di Donor Darah) — yang dilarang
// adalah ikon polos tanpa latar, karena itu yang tak terbaca sebagai tombol.
const nakal = SEMUA.filter((f) => /<IconSymbol\s+name="pencil"/.test(baca(f)));
ok('ikon pensil hanya tersisa di tombol BERLABEL',
  nakal.every((f) => f === 'app/donor.tsx'), nakal.join(', '));
ok('tombol berlabel itu pun sudah punya latar (terbaca sebagai tombol)',
  /heroEdit: \{[\s\S]{0,220}backgroundColor: Color\.MAIN,/.test(baca('app/donor.tsx')) &&
  /CardActionButton/.test(baca('app/core-rules.tsx')));

const emojiNakal = SEMUA.filter((f) => {
  const s = baca(f);
  // ✏️ sebagai ISI tombol (bukan bagian kalimat/label) sudah tak boleh ada.
  return /<VixText heading="label">✏️<\/VixText>/.test(s);
});
ok('tak ada lagi emoji ✏️ dipakai sebagai isi tombol', emojiNakal.length === 0, emojiNakal.join(', '));

ok('gaya tombol edit buatan sendiri sudah dibuang',
  !/editButton/.test(baca('components/core/MultiplicationTab.tsx')) &&
  !/editButton/.test(baca('components/habits/HabitsTab.tsx')) &&
  !/editButton/.test(baca('components/fitness/NotesTab.tsx')));
// 22 Sep 2026: tombol ✗ jadi komponen bersama (dipakai Habits & Puasa).
ok('pasangan ✗ di Habits ikut disamakan ukurannya (tidak timpang)',
  /button: \{\s*\n\s*width: 42,\s*\n\s*height: 42,/.test(baca('components/common/CrossButton.tsx')) &&
  /<CrossButton on=\{skipped\} onPress=\{\(\) => handleSkip\(habit\)\} \/>/.test(baca('components/habits/HabitsTab.tsx')));

// ===================================================================
// 5. Hitung mundur visitasi memojok ke kanan bawah
// ===================================================================
console.log('\n=== "8 hari lagi" memojok ke kanan bawah kartu ===');
const vt = baca('components/core/VisitationTab.tsx');
ok('kolom kanan setinggi kartu',
  /cardRow: \{ flexDirection: 'row', alignItems: 'stretch', gap: 8 \}/.test(vt));
ok('isinya dipisah dua ujung: share di atas, tenggat di bawah',
  /cardSide: \{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 \}/.test(vt));
ok('urutannya tetap share dulu baru status',
  vt.indexOf('icon="square.and.arrow.up"') < vt.indexOf('<VisitationStatus'));
ok('tetap rata kanan — tulisan sepanjang apa pun sejajar tombolnya',
  /alignItems: 'flex-end'/.test(vt));

console.log(gagal === 0
  ? '\n✅ LULUS — Wheel per CL, tombol ✏️ seragam, & tenggat memojok terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
