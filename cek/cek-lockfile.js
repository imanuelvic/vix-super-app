// 🔒 Lockfile & resolutions (1 Okt 2026) — penjaga fase "Install dependencies".
//
// Build EAS 2.0.1 yang pertama MATI di fase itu, 62 detik, dengan pesan:
//
//   warning Resolution field "expo-constants@57.0.19" is incompatible with
//           requested version "expo-constants@~57.0.20"
//   error Your lockfile needs to be updated, but yarn was run with
//         `--frozen-lockfile`.
//
// Sebabnya: `resolutions` di package.json memaku expo-constants ke 57.0.19,
// sementara upgrade paket Expo membuat `expo` sendiri meminta ~57.0.20. Dua
// angka itu mustahil dipenuhi berbarengan, jadi yarn ingin menulis ulang
// lockfile-nya, sedangkan EAS menjalankan yarn dengan --frozen-lockfile yang
// justru melarang itu.
//
// Kenapa satu angka layak dapat suite sendiri: salahnya TIDAK kelihatan di
// komputer sendiri. `yarn install` biasa hanya memberi peringatan lalu jalan
// terus, tsc dan lint tidak peduli, dan app tetap bisa dijalankan. Yang
// menolaknya cuma server EAS, sesudah 26 MB terunggah, dan harganya satu
// build. Suite ini menjalankan pemeriksaan yang sama di sini, gratis.
//
// Catatan tentang `resolutions` yang salah paku: ia bukan cuma gagal, ia
// MEMBALIK tujuannya sendiri. Dengan paku 57.0.19, tiga paket peminta
// ~57.0.19 dapat salinan bersarangnya masing-masing sementara `expo` dapat
// 57.0.20 di atas, jadi node_modules berisi EMPAT salinan modul native yang
// sama. Dengan paku 57.0.20 (yang memenuhi ~57.0.19 maupun ~57.0.20),
// keempatnya runtuh jadi satu.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const ada = (p) => fs.existsSync(path.join(ROOT, p));

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ── Satu pengatur paket, satu lockfile ────────────────────────────────────
console.log('\n# Lockfile');

ok('yarn.lock ada', ada('yarn.lock'));
// EAS memilih pengatur paketnya DARI lockfile yang ia temukan. Dua lockfile
// berbeda berarti server yang menebak, dan tebakannya bisa berbeda dari yang
// dipakai di sini.
ok('tidak ada lockfile pengatur lain yang ikut',
  !ada('package-lock.json') && !ada('pnpm-lock.yaml') && !ada('bun.lockb'));
ok('.nvmrc berisi versi Node utuh',
  ada('.nvmrc') && /^\d+\.\d+\.\d+$/.test(baca('.nvmrc').trim()),
  ada('.nvmrc') ? baca('.nvmrc').trim() : 'tidak ada');

const pkg = JSON.parse(baca('package.json'));
const lock = baca('yarn.lock');

// ── Membaca yarn.lock v1 ──────────────────────────────────────────────────
//
// Bentuknya: blok dipisah baris kosong, judulnya di kolom 0 dan diakhiri ':',
// isinya menjorok. Yang dibutuhkan di sini cuma tiga hal per blok: pola yang
// ia layani, versi yang ia putuskan, dan permintaan ke paket lain.
/** @type {{pola: string[], versi: string, minta: [string, string][]}[]} */
const blok = [];
for (const potong of lock.split('\n\n')) {
  const baris = potong.split('\n').filter((b) => b.trim() && !b.startsWith('#'));
  if (baris.length === 0) continue;
  const judul = baris[0];
  if (/^\s/.test(judul) || !judul.trimEnd().endsWith(':')) continue;

  const pola = judul.trimEnd().slice(0, -1).split(',')
    .map((s) => s.trim().replace(/^"|"$/g, ''));
  const versi = (potong.match(/^ {2}version "([^"]+)"/m) || [])[1] || '';

  // Hanya dependencies & optionalDependencies yang benar-benar dipasang yarn 1;
  // peerDependencies cuma peringatan, jadi ia tidak boleh ikut dihitung sebagai
  // permintaan yang wajib dipenuhi.
  const minta = [];
  let wajib = false;
  for (const b of baris.slice(1)) {
    const bagian = b.match(/^ {2}(\w+):\s*$/);
    if (bagian) { wajib = /^(dependencies|optionalDependencies)$/.test(bagian[1]); continue; }
    if (!wajib) continue;
    const m = b.match(/^ {4}"?([^"\s]+)"? "([^"]+)"\s*$/);
    if (m) minta.push([m[1], m[2]]);
  }
  blok.push({ pola, versi, minta });
}

const semuaPola = new Set();
for (const b of blok) for (const p of b.pola) semuaPola.add(p);
ok('yarn.lock terbaca sebagai blok (bukan satu gumpalan)', blok.length > 500,
  `${blok.length} blok, ${semuaPola.size} pola`);

// ── Yang diuji --frozen-lockfile: tiap pola yang diminta HARUS ada ────────
console.log('\n# Sinkron dengan package.json (yang diuji --frozen-lockfile)');

const langsung = { ...pkg.dependencies, ...pkg.devDependencies };
const hilang = Object.entries(langsung)
  .filter(([nama, range]) => !semuaPola.has(`${nama}@${range}`))
  .map(([nama, range]) => `${nama}@${range}`);
ok('tiap dependensi package.json punya polanya di yarn.lock', hilang.length === 0,
  hilang.join(', '));

// ── resolutions: pakunya harus memenuhi SEMUA yang meminta ────────────────
console.log('\n# resolutions');

let semver = null;
try { semver = require('semver'); } catch { /* dilaporkan di bawah */ }
ok('semver tersedia untuk membandingkan versi', semver !== null,
  'jalankan yarn install dulu');

const resolutions = pkg.resolutions || {};
ok('resolutions cuma memaku paket yang memang dipakai',
  Object.keys(resolutions).every((n) => semuaPola.has(`${n}@${resolutions[n]}`)
    || blok.some((b) => b.pola.some((p) => p.startsWith(`${n}@`)))),
  Object.keys(resolutions).join(', '));

if (semver) {
  for (const [nama, paku] of Object.entries(resolutions)) {
    // Semua range yang meminta paket ini: dari package.json maupun dari paket
    // lain di dalam yarn.lock.
    const peminta = [];
    if (langsung[nama]) peminta.push(['package.json', langsung[nama]]);
    for (const b of blok) {
      for (const [n, range] of b.minta) {
        if (n === nama) peminta.push([b.pola[0], range]);
      }
    }

    const melanggar = peminta.filter(([, range]) => {
      // Range yang bentuknya tidak dikenali semver tidak boleh diam-diam
      // dianggap lulus; ia dihitung melanggar supaya kelihatan.
      if (semver.validRange(range) === null) return true;
      return !semver.satisfies(paku, range);
    });

    ok(`resolutions "${nama}@${paku}" memenuhi semua ${peminta.length} peminta`,
      melanggar.length === 0,
      melanggar.map(([siapa, range]) => `${siapa} minta ${range}`).join(' | '));

    // Satu paku, satu blok. Dua blok berarti dua salinan modul yang sama ikut
    // terpasang, dan untuk modul native itu bukan cuma pemborosan.
    const blokNya = blok.filter((b) => b.pola.some((p) => p.startsWith(`${nama}@`)));
    ok(`"${nama}" diputuskan jadi SATU versi saja di yarn.lock`,
      blokNya.length === 1,
      blokNya.map((b) => b.versi).join(', '));
    ok(`"${nama}" diputuskan tepat ke versi yang dipaku`,
      blokNya.length === 1 && blokNya[0].versi === paku,
      blokNya.map((b) => b.versi).join(', '));
  }
}

// ── Buktinya di node_modules, kalau memang sudah terpasang ────────────────
console.log('\n# node_modules');

const adaNodeModules = ada('node_modules');
if (!adaNodeModules) {
  console.log('  (dilewati: node_modules belum ada)');
} else {
  for (const nama of Object.keys(resolutions)) {
    // Salinan bersarang = node_modules/<paket-lain>/node_modules/<nama>.
    const sarang = fs
      .readdirSync(path.join(ROOT, 'node_modules'))
      .flatMap((d) => {
        const dalam = path.join(ROOT, 'node_modules', d, 'node_modules', nama);
        return fs.existsSync(dalam) ? [`${d}/node_modules/${nama}`] : [];
      });
    ok(`"${nama}" terpasang tanpa salinan bersarang`, sarang.length === 0,
      sarang.join(', '));
  }
}

console.log(gagal === 0 ? '\n✅ SEMUA LULUS.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
