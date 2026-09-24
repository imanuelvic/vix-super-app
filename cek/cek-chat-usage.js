// (1) Dua kartu pemakaian di System jadi sebelahan — kiri minggu, kanan bulan.
// (2) Tombol 💬 Template Chat di CORE: kata-kata siap kirim ke WhatsApp.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-chat');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ===================================================================
console.log('\n=== 1. System: dua kartu sebelahan, kiri minggu kanan bulan ===');
const sys = baca('app/system.tsx');

const baris = sys.slice(
  sys.indexOf('<View style={styles.usageRowHero}>'),
  sys.indexOf('{/* Hari ini */}'),
);
ok('kedua kartu dibungkus SATU baris', baris.length > 0);
ok('barisnya memang mendatar & kartunya berbagi lebar rata',
  /usageRowHero: \{ flexDirection: 'row', gap: 10, marginBottom: 6 \}/.test(sys) &&
  /usageHero: \{\s*\n\s*flex: 1,/.test(sys));

// Urutan di dalam baris = urutan di layar.
const iMinggu = baris.indexOf('📊 Minggu ini');
const iBulan = baris.indexOf('📊 Bulan ');
ok('KIRI = minggu ini', iMinggu > -1);
ok('KANAN = bulan ini', iBulan > iMinggu);

// Angkanya tidak boleh tertukar saat kartunya ditukar posisi.
const kartuKiri = baris.slice(iMinggu, iBulan);
const kartuKanan = baris.slice(iBulan);
ok('kartu kiri benar-benar memakai angka MINGGU',
  /weekTop/.test(kartuKiri) && /weekTotal/.test(kartuKiri) &&
  /weekRangeLabel/.test(kartuKiri) && !/monthTop/.test(kartuKiri));
ok('kartu kanan benar-benar memakai angka BULAN',
  /monthTop/.test(kartuKanan) && /monthTotal/.test(kartuKanan) &&
  /monthRangeLabel/.test(kartuKanan) && !/weekTop/.test(kartuKanan));
ok('keterangan rentangnya tetap ada di masing-masing (Sen–Min · reset tgl 1)',
  /Sen–Min/.test(kartuKiri) && /reset tiap tanggal 1/.test(kartuKanan));
ok('baris terakhir didorong ke dasar → garis bawah kedua kartu sejajar',
  /usageHeroFoot: \{ color: Color\.TEXT_ON_DARK_MUTED, marginTop: 'auto' \}/.test(sys));

// ===================================================================
console.log('\n=== 2. Tombol 💬 di CORE ===');
const core = baca('app/(tabs)/core.tsx');
const kepalaFollowup = core.slice(
  core.indexOf("tab === 'followup' ?"),
  core.indexOf("tab === 'leaders' ?"),
);
ok('💬 muncul di kanan atas sub-tab Follow Up',
  /<EmojiButton\s*\n\s*emoji="💬"/.test(kepalaFollowup));
ok('menuju layar template chat', /router\.push\('\/chat-templates'\)/.test(kepalaFollowup));
ok('🙏 pokok doa bulanan TIDAK tergusur — keduanya berdampingan',
  /emoji="🙏"/.test(kepalaFollowup) &&
  kepalaFollowup.indexOf('emoji="💬"') < kepalaFollowup.indexOf('emoji="🙏"') &&
  /<View style=\{styles\.headerButtons\}>/.test(kepalaFollowup));
ok('rutenya terdaftar di typed routes',
  /chat-templates/.test(baca('.expo/types/router.d.ts')));

// ===================================================================
console.log('\n=== 3. Isi templatenya (kode dijalankan) ===');
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/chatTemplates.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
if (!fs.existsSync(path.join(OUT, 'chatTemplates.js'))) {
  console.log('  ❌ gagal mengompilasi lib/chatTemplates.ts');
  process.exit(1);
}
const T = require(path.join(OUT, 'chatTemplates.js'));

ok('kategori yang diminta ada semua',
  ['motivational', 'duka', 'sakit', 'wisuda', 'wedding', 'bisnis']
    .every((k) => T.CHAT_CATEGORIES.some((c) => c.key === k)));
ok('ditambah kategori lain yang masuk akal (kerja, bayi, lagi berat, apresiasi, ajakan)',
  ['kerja', 'newborn', 'berat', 'apresiasi', 'ajakan']
    .every((k) => T.CHAT_CATEGORIES.some((c) => c.key === k)));

const abc = T.CHAT_CATEGORIES.filter((c) => !c.byDay);
ok('tiap kategori biasa punya TEPAT 3 pilihan A, B, C',
  abc.length > 0 && abc.every((c) =>
    c.variants.length === 3 &&
    c.variants.map((v) => v.key).join('') === 'ABC'));

const moti = T.CHAT_CATEGORIES.find((c) => c.key === 'motivational');
ok('Motivational Words: 7 hari lengkap, urut Senin→Minggu',
  moti.byDay === true &&
  moti.variants.map((v) => v.key).join(',') ===
    'Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu');
ok('tiap hari membawa ayat + kalimat penerapannya',
  moti.variants.every((v) => v.text.includes('📖') && v.text.includes('➡️')));

// Teks yang kamu berikan harus utuh, tidak diringkas diam-diam.
const senin = moti.variants[0].text;
ok('teks Senin persis seperti yang kamu tulis',
  senin.startsWith('Pagiiiii Semangat kerja di minggu baru') &&
  senin.includes('Yosua 1:9') &&
  senin.includes('Be strong, let\'s go! 💪'));
const dukaA = T.CHAT_CATEGORIES.find((c) => c.key === 'duka').variants[0].text;
ok('teks Kedukaan A persis seperti yang kamu tulis',
  dukaA === 'Turut berdukacita ya <nama>, semoga kamu & keluarga dikuatkan serta dihiburkan oleh Tuhan Yesus 🙏💛💜💚🤍💙🧡🩵🖤');
const sakitB = T.CHAT_CATEGORIES.find((c) => c.key === 'sakit').variants[1].text;
ok('teks Get Well Soon B memakai <nama> (bukan @<nama> yang jadi mention salah)',
  sakitB.includes('bestieee <nama>') && !sakitB.includes('@<nama>'));

// Penggantian penanda.
ok('<nama> tergantikan saat namanya diisi',
  T.fillTemplate('Halo <nama>!', { nama: 'Riky' }) === 'Halo Riky!');
ok('<gelar> tergantikan juga (wisuda)',
  T.fillTemplate('<nama>, <gelar>!', { nama: 'Elvina', gelar: 'S.Kom' }) ===
    'Elvina, S.Kom!');
ok('yang KOSONG dibiarkan apa adanya — biar ketahuan belum diisi',
  T.fillTemplate('Halo <nama>!', {}) === 'Halo <nama>!' &&
  T.fillTemplate('Halo <nama>!', { nama: '   ' }) === 'Halo <nama>!');
ok('semua kemunculan diganti, bukan cuma yang pertama',
  T.fillTemplate('<nama> ya <nama>', { nama: 'Sarah' }) === 'Sarah ya Sarah');
ok('sisa penanda bisa dideteksi untuk peringatan di layar',
  T.hasPlaceholder('Halo <nama>') === true &&
  T.hasPlaceholder('Halo Riky') === false);

// Kategori grup tidak boleh minta nama.
const ajakan = T.CHAT_CATEGORIES.find((c) => c.key === 'ajakan');
ok('Ajakan Datang CORE tak butuh nama (memang untuk grup)',
  ajakan.fields.length === 0 &&
  ajakan.variants.every((v) => !T.hasPlaceholder(v.text)));
ok('kategori wisuda minta nama DAN gelar',
  T.CHAT_CATEGORIES.find((c) => c.key === 'wisuda').fields.join(',') === 'nama,gelar');

// Hari ini dipakai menyorot pilihan Motivational.
ok('nama hari dihitung benar (0 = Minggu)',
  T.todayName(new Date(2026, 7, 23)) === 'Minggu' &&
  T.todayName(new Date(2026, 7, 24)) === 'Senin' &&
  T.todayName(new Date(2026, 7, 28)) === 'Jumat');

// Tak ada teks kembar antar-pilihan (kalau kembar, pilihannya jadi percuma).
const semuaTeks = T.CHAT_CATEGORIES.flatMap((c) => c.variants.map((v) => v.text));
ok('tidak ada dua pilihan yang teksnya kembar',
  new Set(semuaTeks).size === semuaTeks.length);

// ===================================================================
console.log('\n=== 4. Layarnya ===');
const layar = baca('app/chat-templates.tsx');
ok('kirimnya lewat WhatsApp tanpa nomor tujuan — pilih chat/grup sendiri',
  /shareTextToWhatsApp\(text, \(\) => setError\(WHATSAPP_ERROR\)\)/.test(layar));
// Deretan chip nama CL diganti SATU dropdown (sepuluh chip memakan setengah
// layar). Isinya tetap: grup · semua CL · ketik nama lain.
ok('nama CL dipilih dari dropdown (tak perlu mengetik)',
  /subscribeCoreLeaders\(user\.uid, setLeaders/.test(layar) &&
  /<SelectField\s+value=\{pilihan\}\s+options=\{pilihanNama\}/.test(layar) &&
  /\.\.\.leaders\.map\(\(l\) => \(\{ key: l\.id, label: `\$\{l\.heart\} \$\{l\.name\}` \}\)\)/.test(layar));
ok('grup & "nama lain" tetap bisa dituju (tak ada yang hilang)',
  /\{ key: GRUP,/.test(layar) && /\{ key: MANUAL,/.test(layar) &&
  /pilihan === MANUAL && \(/.test(layar));
// 31 Agu 2026: CL yang dituju diangkat jadi satu nilai (`cl`) supaya NOMOR
// WA-nya ikut terpakai. Namanya tetap diturunkan dari pilihan yang sama —
// itulah yang dijaga di sini, bukan bentuk tulisannya.
ok('nama diturunkan dari pilihan, bukan disalin ke state kedua',
  /: \(leaders\.find\(\(l\) => l\.id === pilihan\) \?\? null\);/.test(layar) &&
  /const nama = pilihan === MANUAL \? namaLain\.trim\(\) : \(cl\?\.name \?\? ''\);/.test(layar) &&
  !/setNama\(/.test(layar));
ok('kolom gelar hanya muncul saat kategorinya memang butuh',
  /\{fields\.includes\('gelar'\) && \(/.test(layar));
// 31 Agu 2026: TERTUTUP SEMUA saat layarnya dibuka — satu kategori yang
// terbuka sendiri mendorong kategori lain jauh ke bawah layar.
ok('semua kategori tertutup saat masuk & hari ini tetap disorot',
  /useState<string \| null>\(null\)/.test(layar) &&
  /const isToday = category\.byDay === true && v\.key === today;/.test(layar));
ok('teks yang tampil = teks yang dikirim (satu sumber, tak mungkin beda)',
  /const text = fillTemplate\(v\.text, values\);/.test(layar) &&
  /onPress=\{\(\) => onSend\(text\)\}/.test(layar) &&
  />\s*\{text\}\s*<\/VixText>/.test(layar));
ok('ada peringatan kalau penandanya belum diisi',
  /\{hasPlaceholder\(text\) && \(/.test(layar));
ok('tidak menyalin ucapan ulang tahun (sudah punya tempat sendiri)',
  !/ulang tahun.*<nama>/.test(baca('lib/chatTemplates.ts')) &&
  /birthdayGroupText/.test(baca('lib/core.ts')));

console.log(gagal === 0
  ? '\n✅ LULUS — kartu sebelahan & template chat 💬 terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
