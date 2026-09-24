// Batch /rapihin: blok simpan rekor Snake & Tetris (dulu SALINAN UTUH satu
// sama lain) diekstrak jadi hooks/useHighScore.ts.
//
// Hook-nya BENAR-BENAR DIJALANKAN di sini, lewat tiruan kecil runtime React —
// useState + useEffect saja, dengan aturan yang sama: efek dijalankan ulang
// hanya kalau salah satu dependency-nya berubah. Render ulang dipicu manual
// dari tes (bukan otomatis seperti React), karena keluaran hook ini murni
// fungsi dari state + argumennya, jadi hasilnya identik.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-rekor');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Tiruan runtime React (useState + useEffect) ============
const H = { states: [], efekLama: [], iState: 0, iEfek: 0, antre: [] };

function useState(init) {
  const idx = H.iState++;
  if (!(idx in H.states)) {
    H.states[idx] = typeof init === 'function' ? init() : init;
  }
  const set = (v) => {
    H.states[idx] = typeof v === 'function' ? v(H.states[idx]) : v;
  };
  return [H.states[idx], set];
}

function useEffect(fn, deps) {
  H.antre.push({ idx: H.iEfek++, fn, deps });
}

/** Satu render: jalankan hook, lalu efek yang dependency-nya berubah. */
function render(fn, ...args) {
  H.iState = 0;
  H.iEfek = 0;
  H.antre = [];
  const hasil = fn(...args);
  for (const e of H.antre) {
    const lama = H.efekLama[e.idx];
    const berubah =
      !lama || e.deps.some((d, k) => !Object.is(d, lama.deps[k]));
    if (!berubah) continue;
    if (lama && lama.bersih) lama.bersih();
    H.efekLama[e.idx] = { deps: e.deps, bersih: e.fn() || null };
  }
  return hasil;
}

function pasangBaru() {
  H.states = [];
  H.efekLama = [];
}

const tunggu = () => new Promise((r) => setImmediate(r));

// ============ Kompilasi & pasang hook aslinya ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'hooks/useHighScore.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
if (!fs.existsSync(path.join(OUT, 'useHighScore.js'))) {
  console.log('  ❌ gagal mengompilasi hooks/useHighScore.ts');
  process.exit(1);
}

// Penyimpanan HP palsu — semua tulisannya dicatat supaya bisa diperiksa.
const disk = { isi: {}, ditulis: [], gagalTulis: false };
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@react-native-async-storage/async-storage') {
    return {
      // Tanpa ini, interop `__importDefault` bawaan tsc membungkusnya sekali
      // lagi → jadi `default.default`, dan getItem tak ketemu.
      __esModule: true,
      default: {
        getItem: (k) => Promise.resolve(disk.isi[k] ?? null),
        setItem: (k, v) => {
          disk.ditulis.push([k, v]);
          if (disk.gagalTulis) return Promise.reject(new Error('disk penuh'));
          disk.isi[k] = v;
          return Promise.resolve();
        },
      },
    };
  }
  if (req === 'react') return { useState, useEffect };
  return asli(req, parent, isMain);
};
const { useHighScore } = require(path.join(OUT, 'useHighScore.js'));
Module._load = asli;

const KEY = 'snake:best';

// ===================================================================
async function jalan() {
  console.log('\n=== Rekor dibaca dari HP saat dibuka ===');
  disk.isi = { [KEY]: '120' };
  disk.ditulis = [];
  pasangBaru();

  let best = render(useHighScore, KEY, 0, false);
  ok('sebelum bacaannya sampai, rekor tampil 0 (bukan undefined/NaN)', best === 0, String(best));
  await tunggu();
  best = render(useHighScore, KEY, 0, false);
  ok('sesudah terbaca, rekor tampil 120', best === 120, String(best));
  ok('membaca saja tidak menulis apa pun ke disk', disk.ditulis.length === 0);

  console.log('\n=== Main & kalah dengan skor LEBIH TINGGI ===');
  best = render(useHighScore, KEY, 80, false); // sedang main, skor 80
  ok('selagi main, rekor BELUM ikut naik (persis perilaku lama)', best === 120, String(best));

  best = render(useHighScore, KEY, 200, true); // kalah dengan skor 200
  ok('begitu kalah, rekor langsung 200 — tidak menunggu tulisan ke disk',
    best === 200, String(best));
  ok('sekali kalah = sekali tulis, dengan angka yang benar',
    disk.ditulis.length === 1 &&
    disk.ditulis[0][0] === KEY &&
    disk.ditulis[0][1] === '200', JSON.stringify(disk.ditulis));

  await tunggu();
  best = render(useHighScore, KEY, 200, true);
  ok('render ulang di layar "kalah" tidak menulis lagi (tak ada tulis berulang)',
    disk.ditulis.length === 1, String(disk.ditulis.length));
  ok('angkanya tetap 200', best === 200, String(best));

  // Beberapa render lagi — pastikan benar-benar berhenti, bukan cuma belum.
  for (let n = 0; n < 5; n++) {
    await tunggu();
    render(useHighScore, KEY, 200, true);
  }
  ok('lima render berikutnya pun tetap tidak menulis ulang',
    disk.ditulis.length === 1, String(disk.ditulis.length));

  console.log('\n=== Main lagi dari awal ===');
  best = render(useHighScore, KEY, 0, false);
  ok('rekor 200 tetap terbawa ke permainan berikutnya', best === 200, String(best));
  ok('tersimpan juga di HP, jadi awet sesudah app ditutup',
    disk.isi[KEY] === '200', disk.isi[KEY]);

  console.log('\n=== Kalah dengan skor LEBIH RENDAH ===');
  disk.ditulis = [];
  best = render(useHighScore, KEY, 50, true);
  ok('rekor tidak turun jadi 50', best === 200, String(best));
  ok('tidak ada tulisan ke disk sama sekali', disk.ditulis.length === 0);

  console.log('\n=== Skor SAMA PERSIS dengan rekor ===');
  disk.ditulis = [];
  best = render(useHighScore, KEY, 200, true);
  ok('tetap 200 & tidak menulis ulang (sama seperti aturan lama: harus LEBIH tinggi)',
    best === 200 && disk.ditulis.length === 0);

  console.log('\n=== Kalau tulisan ke HP gagal ===');
  disk.isi = {};
  disk.ditulis = [];
  disk.gagalTulis = true;
  pasangBaru();
  render(useHighScore, KEY, 0, false);
  await tunggu();
  best = render(useHighScore, KEY, 90, true);
  ok('angkanya tetap naik di layar walau disknya gagal', best === 90, String(best));
  await tunggu();
  best = render(useHighScore, KEY, 0, false);
  ok('dan tidak hilang saat main lagi — sama seperti perilaku lama', best === 90, String(best));
  disk.gagalTulis = false;

  console.log('\n=== Dua permainan, dua kunci terpisah ===');
  disk.isi = { 'snake:best': '10', 'tetris:best': '999' };
  disk.ditulis = [];
  pasangBaru();
  render(useHighScore, 'snake:best', 0, false);
  await tunggu();
  const snake = render(useHighScore, 'snake:best', 0, false);
  pasangBaru();
  render(useHighScore, 'tetris:best', 0, false);
  await tunggu();
  const tetris = render(useHighScore, 'tetris:best', 0, false);
  ok('rekor Snake & Tetris tidak tercampur',
    snake === 10 && tetris === 999, `${snake} / ${tetris}`);

  // =================================================================
  console.log('\n=== Salinan kembarnya sudah hilang ===');
  const s = baca('components/games/SnakeTab.tsx');
  const t = baca('components/games/TetrisTab.tsx');

  ok('kedua permainan memakai hook yang sama',
    /useHighScore\(BEST_KEY, game\.score, game\.status === 'over'\)/.test(s) &&
    /useHighScore\(BEST_KEY, game\.score, game\.status === 'over'\)/.test(t));
  ok('blok simpan-rekor yang disalin sudah tidak ada di kedua berkas',
    !/setBest/.test(s) && !/setBest/.test(t) &&
    !/AsyncStorage/.test(s.replace(/\/\/.*/g, '')) &&
    !/AsyncStorage/.test(t.replace(/\/\/.*/g, '')));
  ok('impor AsyncStorage yang jadi mati ikut dibuang',
    !/import AsyncStorage/.test(s) && !/import AsyncStorage/.test(t));
  ok('kunci simpannya tetap beda per permainan',
    /const BEST_KEY = 'snake:best';/.test(s) &&
    /const BEST_KEY = 'tetris:best';/.test(t));
  ok('angka rekor masih ditampilkan di tempat yang sama',
    /\{best\}/.test(s) && /\{best\}/.test(t) &&
    /🏅 Rekor/.test(s) && /🏅 Rekor/.test(t));
  ok('jalannya permainan tidak disentuh (tick & logika tetap)',
    /setInterval\(\(\) => setGame\(\(g\) => step\(g, wantedDir\.current\)\), tickMs\)/.test(s) &&
    /setInterval\(\(\) => setGame\(drop\), tickMs\)/.test(t));

  console.log(gagal === 0
    ? '\n✅ LULUS — satu hook untuk dua permainan, perilakunya sama.'
    : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan();
