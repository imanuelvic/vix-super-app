// 📱 Riwayat versi (1 Okt 2026) — lib/changelog.ts + layar Version.
//
// Pemilik app membaca riwayat perubahannya DARI DALAM APP: layar Version,
// click kartu versinya. Daftarnya ditulis tangan karena pesan commit di repo
// ini hampir seluruhnya "Update Version: x.y.z" dan tidak menjelaskan apa pun.
//
// Daftar yang ditulis tangan cuma berguna kalau benar-benar diisi, jadi cek
// yang paling penting di berkas ini bukan soal bentuk: **versi yang ada di
// app.json WAJIB punya entri.** Itu yang memaksa lognya terisi sebelum versi
// berikutnya naik, dan yang membuat aturan di AGENTS.md punya gigi.
//
// Sisanya menjaga kata-katanya tetap enak dibaca di layar HP: satu kalimat,
// lambang di depan, menyebut apa yang berubah BAGI PEMAKAINYA (bukan nama
// berkas), tanpa tanda pisah panjang, dan memakai "click" bukan "tekan".
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-changelog');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Isi berkas TANPA komentar — supaya cek tidak membaca komentar sebagai kode. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/changelog.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const C = require(path.join(OUT, 'changelog.js'));
const LOG = C.CHANGELOG;

const EM = String.fromCharCode(0x2014);
/** Berapa kata satu baris log, tanpa lambang di depannya. */
const kata = (t) =>
  t
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .split(/\s+/)
    .filter(Boolean).length;
const berlambang = (t) => {
  const cp = [...t][0]?.codePointAt(0) ?? 0;
  return (
    (cp >= 0x231a && cp <= 0x23ff) ||
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff)
  );
};
/** "2.0.1" → [2,0,1] untuk dibandingkan sebagai angka, bukan sebagai teks. */
const angka = (v) => v.split('.').map(Number);
function lebihBaru(a, b) {
  const x = angka(a);
  const y = angka(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}

// Satu baris log boleh sepanjang satu baris penuh di layar HP, tidak lebih.
const MAKS_KATA = 14;

// =====================================================================
console.log('\n=== 1. Daftarnya utuh & berurutan ===');
// =====================================================================
{
  ok('ada isinya', Array.isArray(LOG) && LOG.length > 0);
  ok('tiap versi cuma sekali', new Set(LOG.map((r) => r.version)).size === LOG.length,
    LOG.map((r) => r.version).join(', '));
  ok('nomor versinya berbentuk x.y.z', LOG.every((r) => /^\d+\.\d+\.\d+$/.test(r.version)),
    LOG.filter((r) => !/^\d+\.\d+\.\d+$/.test(r.version)).map((r) => r.version).join(', '));
  ok('tanggalnya YYYY-MM-DD', LOG.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date)),
    LOG.filter((r) => !/^\d{4}-\d{2}-\d{2}$/.test(r.date)).map((r) => r.version).join(', '));

  // Terbaru di ATAS: itu urutan yang dibaca di layar, dan entri baru selalu
  // disisipkan di awal.
  const salahUrut = LOG.filter((r, i) => i > 0 && !lebihBaru(LOG[i - 1].version, r.version));
  ok('terbaru di atas (nomor versinya menurun)', salahUrut.length === 0,
    salahUrut.map((r) => r.version).join(', '));
  const salahTanggal = LOG.filter((r, i) => i > 0 && LOG[i - 1].date < r.date);
  ok('tanggalnya ikut menurun', salahTanggal.length === 0,
    salahTanggal.map((r) => r.version).join(', '));
  ok('tidak ada versi tanpa isi', LOG.every((r) => r.items.length > 0),
    LOG.filter((r) => r.items.length === 0).map((r) => r.version).join(', '));
}

// =====================================================================
console.log('\n=== 2. Versi yang terpasang PUNYA entrinya ===');
// =====================================================================
{
  // Inilah cek yang memaksa lognya terisi. Kalau app.json naik ke versi baru
  // tanpa dicatat, suite ini yang memberi tahu, bukan pemiliknya yang
  // kebingungan setengah tahun kemudian.
  const appJson = JSON.parse(baca('app.json'));
  const versi = appJson.expo.version;
  ok(`versi app.json (${versi}) sudah dicatat`,
    LOG.some((r) => r.version === versi),
    'tambahkan entrinya di paling atas lib/changelog.ts');
  ok('entri teratas = versi yang terpasang', LOG[0]?.version === versi,
    `teratas ${LOG[0]?.version}, app.json ${versi}`);
  ok('hitungan totalnya benar',
    C.changelogTotal() === LOG.reduce((a, r) => a + r.items.length, 0));
}

// =====================================================================
console.log('\n=== 3. Kata-katanya: satu kalimat, enak dibaca di HP ===');
// =====================================================================
{
  const semua = LOG.flatMap((r) => r.items.map((t) => [r.version, t]));

  const tanpaLambang = semua.filter(([, t]) => !berlambang(t));
  ok('tiap baris berlambang di depan', tanpaLambang.length === 0,
    tanpaLambang.slice(0, 3).map(([v, t]) => `${v}: ${t}`).join(' · '));

  const kepanjangan = semua.filter(([, t]) => kata(t) > MAKS_KATA);
  ok(`tidak ada baris lebih dari ${MAKS_KATA} kata`, kepanjangan.length === 0,
    kepanjangan.slice(0, 3).map(([v, t]) => `${v}: ${kata(t)} kata, "${t}"`).join(' · '));

  const adaEm = semua.filter(([, t]) => t.includes(EM));
  ok('tanpa tanda pisah panjang', adaEm.length === 0,
    adaEm.slice(0, 3).map(([v]) => v).join(', '));

  const adaTekan = semua.filter(([, t]) => /\b(tekan|ditekan|menekan|klik|ketuk)\b/i.test(t));
  ok('tanpa "tekan"/"klik"/"ketuk" (app ini memakai "click")', adaTekan.length === 0,
    adaTekan.slice(0, 3).map(([v, t]) => `${v}: ${t}`).join(' · '));

  // Log ini dibaca pemilik app, bukan pembaca kode. "memakai liveDoc.ts" tidak
  // mengingatkan apa pun tentang hidupnya.
  const adaBerkas = semua.filter(([, t]) =>
    /\.(ts|tsx|js)\b/.test(t) || /\b(lib|components|hooks|app)\//.test(t) || /\w\(\)/.test(t));
  ok('tanpa nama berkas / fungsi (ini dibaca pemiliknya, bukan pembaca kode)',
    adaBerkas.length === 0,
    adaBerkas.slice(0, 3).map(([v, t]) => `${v}: ${t}`).join(' · '));

  // Satu baris = satu perubahan. Titik di tengah berarti dua kalimat menumpuk.
  const duaKalimat = semua.filter(([, t]) => /\.\s+\p{Lu}/u.test(t));
  ok('satu baris = satu kalimat', duaKalimat.length === 0,
    duaKalimat.slice(0, 3).map(([v, t]) => `${v}: ${t}`).join(' · '));

  const kembar = semua.map(([, t]) => t).filter((t, i, a) => a.indexOf(t) !== i);
  ok('tidak ada baris yang kembar persis', kembar.length === 0, kembar.slice(0, 3).join(' · '));
}

// =====================================================================
console.log('\n=== 4. Layar Version: kartunya jadi pintu ===');
// =====================================================================
{
  const v = kode('app/app-version.tsx');

  ok('kartu versi bisa di-click',
    /<PressableScale\s*\n\s*style=\{styles\.versionCard\}\s*\n\s*onPress=\{\(\) => setRiwayat\(true\)\}>/.test(v));
  ok('ada ajakannya, biar tidak tersembunyi',
    /📖 Click untuk lihat semua perubahan/.test(v));
  ok('riwayatnya di SheetModal bersama, judulnya Inggris',
    /<SheetModal\s*\n\s*visible=\{riwayat\}\s*\n\s*title="📱 Version History"/.test(v));
  ok('seluruh versi digambar, bukan beberapa teratas saja',
    /\{CHANGELOG\.map\(\(rilis\) => \(/.test(v) && !/CHANGELOG\.slice\(/.test(v));
  ok('versi yang sedang terpasang ditandai',
    /terpasang=\{rilis\.version === appVersion\}/.test(v) &&
    /\{terpasang && \(/.test(v));
  ok('jumlahnya disebut di keterangan sheet',
    /\$\{CHANGELOG\.length\} versi, \$\{changelogTotal\(\)\} perubahan tercatat/.test(v));
}

// =====================================================================
console.log('\n=== 5. Aturannya sendiri tidak boleh hilang ===');
// =====================================================================
{
  // Tanpa aturan tertulis, log ini berhenti terisi sesudah satu dua sesi.
  const agents = baca('AGENTS.md');
  ok('AGENTS.md menyuruh mencatat perubahan besar',
    /lib\/changelog\.ts/.test(agents) && /PERUBAHAN BESAR|perubahan besar/i.test(agents));
  ok('AGENTS.md menyebut bentuk barisnya & penjaganya',
    /maksimal sekitar 12 kata/.test(agents) && /cek\/cek-changelog\.js/.test(agents));
  ok('AGENTS.md menyebut kapan harus bikin entri versi BARU',
    /version.*app\.json.*naik|app\.json.*naik/i.test(agents));

  const rapihin = baca('.claude/commands/rapihin.md');
  ok('/rapihin ikut mengurus log (tambah + rapikan kata-katanya)',
    /lib\/changelog\.ts/.test(rapihin) && /Rapikan kata-kata log/i.test(rapihin));
  ok('/rapihin dilarang menulis ulang sejarahnya',
    /jangan mengubah ISI peristiwanya/i.test(rapihin));
}

console.log(
  gagal === 0 ? '\n✅ SEMUA LULUS.' : `\n❌ ${gagal} cek gagal.`,
);
process.exit(gagal === 0 ? 0 : 1);
