// PDF Wheel of Life 🎡 — dibuat SUNGGUHAN di sini (expo-print distub, HTML-nya
// ditangkap lalu diperiksa), plus cap waktu dibuat/diubah & keamanan repo.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-wheelpdf');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ================= Kompilasi lib-nya =================
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/wheelPdf.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
if (!fs.existsSync(path.join(OUT, 'wheelPdf.js'))) {
  console.log('  ❌ gagal mengompilasi lib/wheelPdf.ts');
  process.exit(1);
}

// Tangkap HTML yang dikirim ke printer, dan nama berkasnya.
const cetakan = { html: null, judulDialog: null, namaBerkas: null };
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'expo-print') {
    return {
      printToFileAsync: async ({ html }) => {
        cetakan.html = html;
        return { uri: '/tmp/palsu.pdf' };
      },
    };
  }
  if (req === 'expo-sharing') {
    return {
      isAvailableAsync: async () => true,
      shareAsync: async (_uri, opt) => {
        cetakan.judulDialog = opt.dialogTitle;
      },
    };
  }
  if (req === 'expo-file-system') {
    return {
      File: class {
        constructor() { this.uri = '/tmp/palsu.pdf'; this.exists = false; }
        rename(n) { cetakan.namaBerkas = n; }
        delete() {}
        get parentDirectory() { return '/tmp'; }
      },
    };
  }
  if (req === '@/assets/logoCoreGwu') return { LOGO_CORE_GWU_DATA_URI: 'data:image/png;base64,AA' };
  if (req === 'firebase/firestore') {
    return { doc: () => ({}), setDoc: () => Promise.resolve(), Timestamp: { now: () => 0 } };
  }
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {} };
  return asli(req, parent, isMain);
};
const { shareWheelPdf } = require(path.join(OUT, 'wheelPdf.js'));
const W = require(path.join(OUT, 'wheel.js'));
Module._load = asli;

// Timestamp palsu — cuma perlu .toDate().
const ts = (d) => ({ toDate: () => d });

// Data uji: kuartal terisi lengkap, 3 area fokus, catatan di beberapa area.
const data = {
  scores: {
    spirituality: 9, health: 4, family: 4, finance: 6,
    ministry: 10, career: 7, relationship: 8, fun: 6,
  },
  notes: {
    spirituality: 'Saat teduh jalan terus.\n\nCORE tidak pernah bolong.',
    health: 'Tidur berantakan, jarang olahraga.',
    family: 'Jarang pulang.',
  },
  focus: [
    { area: 'health', targetScore: 8, plan: 'Gym 3x seminggu.\nTidur sebelum jam 11.' },
    { area: 'family', targetScore: 8, plan: 'Telepon mama tiap minggu.' },
    { area: 'finance', targetScore: 9, plan: '' },
  ],
  createdAt: ts(new Date(2026, 6, 21, 9, 15)),
  updatedAt: ts(new Date(2026, 7, 23, 20, 30)),
};

async function jalan() {
  // ================= 1. PDF punyaku sendiri =================
  console.log('\n=== PDF Wheel of Life (punyaku sendiri) ===');
  await shareWheelPdf(data, 2026, 3, null);
  const html = cetakan.html;
  ok('PDF-nya benar-benar tercetak', typeof html === 'string' && html.length > 2000);
  fs.writeFileSync(path.join(__dirname, 'wheel-punyaku.html'), html);

  ok('judulnya menyebut kuartalnya', /Wheel of Life - Q3 2026/.test(html));
  ok('share sheet-nya terbuka dengan judul yang jelas',
    cetakan.judulDialog === 'Bagikan Wheel of Life');
  ok('berkasnya dinamai jelas, bukan UUID acak',
    cetakan.namaBerkas === 'Wheel of Life - Q3 2026.pdf', cetakan.namaBerkas);

  console.log('\n--- Grafik radar ---');
  ok('radar digambar sebagai SVG (tajam di zoom berapa pun, bukan gambar)',
    /<svg width="400" height="400"/.test(html)); // 400 sejak 14 Sep malam
  ok('poligon skor & poligon target dua-duanya ada',
    (html.match(/<polygon/g) || []).length >= 7 && /stroke-dasharray="6 4"/.test(html));
  ok('kedelapan lambang area ikut tergambar di ujung sumbunya',
    W.WHEEL_AREAS.every((a) => html.includes(`text-anchor="middle">${a.icon}</text>`)));

  // Bentuknya harus SAMA PERSIS dengan yang di layar — dua-duanya memakai
  // radarGeometry yang sama, jadi titiknya dibandingkan langsung.
  const g = W.radarGeometry(400, 8);
  const nilai = W.WHEEL_AREAS.map((a) => data.scores[a.key] ?? 0);
  ok('titik poligonnya identik dengan hitungan yang dipakai layar',
    html.includes(g.polygon(nilai)));

  console.log('\n--- Angka ringkasannya ---');
  // Rata-rata: (9+4+4+6+10+7+8+6)/8 = 54/8 = 6,75 → 6,8
  ok('rata-rata dihitung benar & ditulis gaya Indonesia (koma)',
    /6,8<small> \/ 10 rata-rata/.test(html), 'harusnya 6,8');
  // sehat ≥8 → 9,10,8 = 3 · perlu naik 5–7 → 6,7,6 = 3 · darurat <5 → 4,4 = 2
  ok('sebaran nada skor benar (3 sehat · 3 perlu naik · 2 darurat)',
    /3 sehat/.test(html) && /3 perlu naik/.test(html) && /2 darurat/.test(html));
  // Sisa poin: health 8-4=4, family 8-4=4, finance 9-6=3 → 11
  ok('sisa poin fokus dijumlah benar (4+4+3 = 11)',
    /kurang 11 poin lagi/.test(html));

  console.log('\n--- Fokus kuartal ---');
  ok('ketiga area fokus ikut tercetak',
    /🍎 Health/.test(html) && /👨‍👩‍👧‍👦 Family/.test(html) && /💵 Finance/.test(html));
  ok('tiap fokus menyebut skor sekarang → target',
    /sekarang 4 · target 8/.test(html) && /sekarang 6 · target 9/.test(html));
  ok('action plan-nya ikut, termasuk yang berbaris-baris',
    /Gym 3x seminggu\./.test(html) && /Tidur sebelum jam 11\./.test(html) &&
    /Telepon mama tiap minggu\./.test(html));
  ok('fokus tanpa action plan tidak jadi kotak kosong tak bertanda',
    /class="kosong">belum diisi</.test(html));
  ok('ada batang bar untuk tiap fokus, lengkap dengan penanda target',
    /<div class="bar">/.test(html) && /<i style="left:80%"><\/i>/.test(html));

  console.log('\n--- Skor per area ---');
  ok('KEDELAPAN area ikut tercetak, bukan cuma yang fokus',
    W.WHEEL_AREAS.every((a) => html.includes(`${a.icon} ${a.label}`)));
  ok('pertanyaan penilaian tiap area ikut dibawa',
    html.includes('Apakah kamu benar-benar mengasihi Tuhan?'));
  ok('alasan penilaian (catatan) ikut, termasuk yang beberapa paragraf',
    /Saat teduh jalan terus\./.test(html) && /CORE tidak pernah bolong\./.test(html));
  ok('area tanpa catatan diberi tanda, bukan dibiarkan kosong',
    /class="kosong">tanpa catatan</.test(html));
  ok('area yang jadi fokus ditandai di daftar skornya juga',
    /<em>🎯 fokus<\/em>/.test(html));
  ok('batang skornya sesuai nilainya (health 4 → 40%)',
    /width:40%/.test(html) && /width:90%/.test(html));

  console.log('\n--- Cap waktu ---');
  // 1 Sep 2026: jam di cap waktu ditandai 🕒 (perubahan di lib/format.ts).
  // 10 Sep 2026: bentuknya RINGKAS — "Senin, 7 September 2026 · 🕒 19.00"
  // tidak muat di kotak chip dan mendorong keluar sampai menabrak sebelahnya.
  ok('waktu DIBUAT tercetak, ringkas',
    /Sel, 21 Jul 26 · 🕒 09\.15/.test(html));
  ok('waktu TERAKHIR DIUBAH tercetak',
    /Min, 23 Agu 26 · 🕒 20\.30/.test(html));
  // Yang dipendekkan cuma TANGGALNYA. Jamnya wajib tetap ada — itulah yang
  // membedakan PDF (dokumen arsip) dari layarnya, dan bulan/hari yang utuh
  // tidak boleh menyelinap balik ke chip yang sempit ini.
  ok('yang dipendekkan tanggalnya saja, jamnya tetap tercetak',
    /🕒 09\.15/.test(html) && /🕒 20\.30/.test(html) &&
    !/Selasa, 21 Juli 2026/.test(html) && !/Minggu, 23 Agustus 2026/.test(html));
  ok('keduanya jadi kartu keterangan di kop, bukan teks nyelip',
    /<span>Dibuat<\/span>/.test(html) && /<span>Terakhir diubah<\/span>/.test(html));

  console.log('\n--- Aman & rapi ---');
  ok('kartu fokus & baris area tidak terpotong pergantian halaman',
    (html.match(/page-break-inside: avoid/g) || []).length >= 2);
  ok('warna latar tetap keluar saat dicetak (bukan putih polos)',
    /-webkit-print-color-adjust: exact/.test(html));

  // ================= 2. PDF punya CORE Leader =================
  console.log('\n=== PDF punya CORE Leader ===');
  cetakan.html = null;
  await shareWheelPdf(data, 2026, 3, { name: 'Febryna', heart: '💛' });
  const htmlCL = cetakan.html;
  ok('judulnya menyebut nama & warna hati CL-nya',
    /Wheel of Life 💛 Febryna - Q3 2026/.test(htmlCL));
  ok('anak judulnya menyesuaikan (diisi bareng saat visitasi)',
    /8 area hidup Febryna, dinilai bersama saat visitasi\./.test(htmlCL));
  ok('nama berkasnya ikut nama CL — tidak tertukar antar-orang',
    cetakan.namaBerkas === 'Wheel of Life 💛 Febryna - Q3 2026.pdf', cetakan.namaBerkas);
  fs.writeFileSync(path.join(__dirname, 'wheel-cl.html'), htmlCL);

  // ================= 3. Kuartal yang belum ada fokusnya =================
  console.log('\n=== Kuartal tanpa area fokus ===');
  cetakan.html = null;
  await shareWheelPdf({ ...data, focus: [] }, 2026, 4, null);
  ok('tetap bisa dicetak, tidak error',
    typeof cetakan.html === 'string' && cetakan.html.length > 1000);
  ok('diberi keterangan, bukan bagian kosong menggantung',
    /Belum ada area fokus, minimal 3 area/.test(cetakan.html));
  ok('poligon target tidak digambar kalau memang belum ada targetnya',
    !/stroke-dasharray="6 4"/.test(cetakan.html));

  // ================= 4. Cap waktu di layar & penyimpanan =================
  console.log('\n=== Cap waktu di layar Wheel ===');
  const layar = baca('app/wheel.tsx');
  ok('layarnya menampilkan waktu dibuat & terakhir diubah',
    /🆕 Dibuat: \{formatDayDate\(data\.createdAt\.toDate\(\)\)\}/.test(layar) &&
    /🕒 Terakhir diubah:/.test(layar));
  // 2 Sep 2026: di LAYAR cukup tanggalnya ("Senin, 31 Agu 2026") — isian
  // kuartalan disentuh beberapa kali per tiga bulan, jamnya tidak menjawab
  // apa pun. PDF-nya sengaja TETAP bercap berikut jam: itu dokumen arsip, dan
  // di situ ketepatannya baru berguna. (10 Sep 2026: tanggalnya dipendekkan,
  // jamnya tidak — bedanya dengan layar tetap sama persis.)
  ok('layar pakai tanggal saja, PDF tetap bercap berikut jam',
    !/formatFullDateTime|formatCompactDateTime/.test(layar) &&
    /formatCompactDateTime\(data\.createdAt\.toDate\(\)\)/.test(
      baca('lib/wheelPdf.ts'),
    ));
  // Catatan kakinya justru KEBALIKANNYA: satu baris penuh di kaki halaman,
  // ruangnya lega, jadi di sana tanggal utuh tetap yang paling enak dibaca.
  ok('catatan kaki tetap bertanggal utuh',
    /footerNote: \`Wheel of Life \$\{kuartal\} · dicetak \$\{formatFullDateTime\(new Date\(\)\)\}\`/.test(
      baca('lib/wheelPdf.ts'),
    ));
  ok('tombol share PDF ada di kanan atas header',
    /right=\{[\s\S]{0,200}<EmojiButton\s*\n\s*icon="square\.and\.arrow\.up"/.test(layar));
  ok('tombolnya baru menyala kalau sudah ada yang dinilai',
    /mode === 'overview' && hasScores \?/.test(layar));

  const lib = baca('lib/wheel.ts');
  ok('createdAt ditulis SEKALI — yang lama dipertahankan, tidak ditimpa',
    /return \{ createdAt: existingCreatedAt \?\? now, updatedAt: now \};/.test(lib));
  ok('layar mengoper createdAt yang sudah ada saat menyimpan',
    /data\?\.createdAt,/.test(layar) && /data\.createdAt\);/.test(layar));
  ok('createdAt ikut dibaca dari Firestore',
    /createdAt: \(data\?\.createdAt as Timestamp\) \?\? undefined,/.test(lib));

  // ================= 5. Keamanan =================
  console.log('\n=== Keamanan repo publik ===');
  const gi = baca('.gitignore');
  ok('.env* semuanya diabaikan (bukan cuma .env)',
    /^\.env\*$/m.test(gi) && /^!\.env\.example$/m.test(gi));
  const rules = baca('firestore.rules');
  ok('isolasi antar-akun tetap utuh — INI pertahanan utamanya',
    /request\.auth\.uid == userId/.test(rules));
  ok('default masih tolak-semua di luar users/',
    /match \/\{document=\*\*\} \{\s*\n\s*allow read, write: if false;/.test(rules));
  ok('model ancamannya ditulis di berkasnya, biar tak dilonggarkan tanpa sadar',
    /MODEL ANCAMAN/.test(rules));
  // \s+ karena teksnya bisa terpotong pergantian baris di markdown-nya.
  const sec = fs.existsSync(path.join(ROOT, 'SECURITY.md')) ? baca('SECURITY.md') : '';
  ok('ada daftar periksa keamanan yang bisa dikerjakan',
    /Enable create\s+\(sign-up\)/.test(sec) &&
    /Two-factor authentication/.test(sec) &&
    /App Check/.test(sec));
  ok('ditulis tegas bahwa Web API Key BUKAN rahasia (biar tak salah panik)',
    /BUKAN rahasia/.test(sec));
  ok('jalur "orang mengubah kodemu" ikut dibahas (Expo & GitHub)',
    /eas update/.test(sec) && /GitHub/.test(sec));

  // ================= 6. Dua perbaikan tampilan =================
  console.log('\n=== Margin & garis pemisah ===');
  const leaders = baca('components/core/LeadersTab.tsx');
  ok('jarak bawah chip Cowok/Cewek disamakan dengan kolom lain (10)',
    /genderRow: \{ flexDirection: 'row', gap: 8, marginBottom: 10 \}/.test(leaders));
  ok('modal baca-saja punya garis pemisah di bawah judulnya',
    /<View style=\{styles\.viewDivider\} \/>/.test(leaders) &&
    /viewDivider: \{\s*\n\s*height: 1,/.test(leaders));
  ok('garisnya membentang penuh, tidak mengambang di tengah',
    /marginHorizontal: -20,/.test(leaders.slice(leaders.indexOf('viewDivider'))));
  ok('dipakai CL maupun Main Team (modalnya memang satu)',
    (leaders.match(/<PersonView person=/g) || []).length === 1);

  console.log(gagal === 0
    ? '\n✅ LULUS — PDF Wheel lengkap, cap waktu, keamanan, & tampilan.'
    : `\n❌ ${gagal} cek gagal.`);
  console.log(`   contoh PDF (HTML): ${path.join(__dirname, 'wheel-punyaku.html')}`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan();
