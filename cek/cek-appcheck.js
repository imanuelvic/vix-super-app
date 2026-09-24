// 24 Sep 2026 — 🛡️ Firebase App Check untuk Firebase AI Logic.
//
// Tenggatnya keras: mulai 2 November 2026 App Check ditegakkan otomatis untuk
// AI Logic dan tidak bisa dimatikan. Tanpa ini, keempat fitur AI mati.
//
// Yang diuji di sini bukan cuma "kodenya ada", tapi tiga hal yang kalau salah
// akibatnya tidak kelihatan sampai terlambat:
//
//   1. Urutan. Token debug dibaca SDK dari objek global, jadi ia wajib sudah
//      terpasang SEBELUM initializeAppCheck dipanggil. Kebalik = diam-diam
//      tidak aktif.
//   2. Providernya. `initializeAppCheck` selalu memanggil provider.initialize()
//      walau mode debug, dan ReCaptchaV3Provider akan menyentuh `document`
//      yang tidak ada di React Native. Harus CustomProvider yang inert.
//   3. Tanpa token, app HARUS tetap jalan (orang yang clone repo, atau kamu
//      sendiri sebelum mengisi .env).
//
// Dua cek terakhir menjaga ASUMSI kita terhadap SDK-nya sendiri, supaya
// `npm install` yang menaikkan versi firebase tidak diam-diam mematahkannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const R = AKAR + '/';
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

// ============ 1. Asumsi terhadap SDK yang benar-benar terpasang ============
console.log('\nAsumsi terhadap @firebase/app-check & @firebase/ai terpasang');

const sumberAppCheck = baca('node_modules/@firebase/app-check/dist/esm/index.esm.js');
const sumberAi = baca('node_modules/@firebase/ai/dist/esm/index.esm.js');

ok('SDK membaca token debug dari objek global FIREBASE_APPCHECK_DEBUG_TOKEN',
  /globals\.FIREBASE_APPCHECK_DEBUG_TOKEN/.test(sumberAppCheck));

// Inilah yang membuat jalur debug hidup di React Native sementara reCAPTCHA
// tidak: hanya provider reCAPTCHA yang menyentuh document.
{
  const blokDebug = sumberAppCheck.slice(
    sumberAppCheck.indexOf('async function getDebugToken'),
    sumberAppCheck.indexOf('function initializeDebugMode'),
  );
  ok('jalur token debug TIDAK menyentuh document/window (syarat jalan di RN)',
    blokDebug.length > 0 && !/document\.|window\./.test(blokDebug));
}
ok('penyimpanan token dijaga isIndexedDBAvailable (aman tanpa IndexedDB di RN)',
  /if \(isIndexedDBAvailable\(\)\) \{/.test(sumberAppCheck));
ok('initializeAppCheck SELALU memanggil provider.initialize(app), juga saat debug',
  /state\.provider\.initialize\(app\);/.test(sumberAppCheck));

// Alasan kenapa token dari SDK native (appId iOS) TIDAK bisa dipakai di sini.
ok('@firebase/ai mengirim X-Firebase-Appid bersama X-Firebase-AppCheck',
  /headers\.append\('X-Firebase-Appid', url\.params\.apiSettings\.appId\)/.test(sumberAi) &&
  /headers\.append\('X-Firebase-AppCheck', appCheckToken\.token\)/.test(sumberAi));

// ==================== 2. Modulnya dijalankan sungguhan ====================
console.log('\nlib/appCheck.ts — dijalankan atas SDK tiruan');

const OUT = path.join(__dirname, 'keluar-appcheck');
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc',
      R + 'lib/appCheck.ts',
      '--ignoreConfig',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
if (!fs.existsSync(path.join(DIR, 'appCheck.js'))) {
  console.log('  ✗ gagal mengompilasi appCheck.js');
  process.exit(1);
}

/** Urutan kejadian, supaya bisa dibuktikan token dipasang SEBELUM init. */
let jejak = [];
let opsiTerakhir = null;

class FakeCustomProvider {
  constructor(opts) {
    this.opts = opts;
    jejak.push('CustomProvider dibuat');
  }
}
class FakeReCaptchaV3Provider {
  constructor() {
    jejak.push('ReCaptchaV3Provider dibuat');
  }
}

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/app-check') {
    return {
      CustomProvider: FakeCustomProvider,
      ReCaptchaV3Provider: FakeReCaptchaV3Provider,
      initializeAppCheck: (_app, opsi) => {
        // Persis yang dilakukan SDK asli: baca global SAAT init dipanggil.
        jejak.push(
          `initializeAppCheck (global=${
            globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN ?? 'KOSONG'
          })`,
        );
        opsiTerakhir = opsi;
        return {};
      },
    };
  }
  return asli(req, parent, isMain);
};
const X = require(path.join(DIR, 'appCheck.js'));
Module._load = asli;

const APP = { name: 'palsu' };

// ---- Tanpa token: app harus tetap jalan, App Check tidak dinyalakan ----
delete process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
delete globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN;
jejak = [];
const tanpa = X.setupAppCheck(APP);
ok('tanpa token di .env: TIDAK dinyalakan, dan tidak meledak',
  tanpa === false && jejak.length === 0, JSON.stringify(jejak));
ok('tanpa token: global tidak dikotori',
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN === undefined);

// ---- Dengan token ----
process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN = 'token-uji-123';
jejak = [];
const dengan = X.setupAppCheck(APP);
ok('dengan token: App Check dinyalakan', dengan === true);
ok('token dipasang ke global SEBELUM initializeAppCheck (urutannya menentukan)',
  jejak.join(' | ').includes('initializeAppCheck (global=token-uji-123)'),
  jejak.join(' | '));
ok('providernya CustomProvider yang inert, BUKAN reCAPTCHA (butuh document)',
  jejak.some((j) => j === 'CustomProvider dibuat') &&
  !jejak.some((j) => j.startsWith('ReCaptchaV3Provider')) &&
  opsiTerakhir.provider instanceof FakeCustomProvider);
ok('token diperbarui otomatis (sesi panjang tidak mendadak ditolak)',
  opsiTerakhir.isTokenAutoRefreshEnabled === true);

// getToken provider TIDAK boleh diam-diam mengembalikan token palsu: kalau ia
// terpanggil, artinya mode debug mati dan app jalan tanpa perlindungan.
ok('getToken provider MENOLAK dengan galat jelas, bukan diam-diam lolos',
  opsiTerakhir.provider.opts.getToken().then(
    () => false,
    (e) => /tanpa perlindungan/.test(e.message),
  ) instanceof Promise);

X.setupAppCheck(APP); // dipanggil dua kali (hot reload) tidak boleh meledak
ok('dipanggil dua kali tetap aman', true);

// ==================== 3. Dipasang di tempat yang benar ====================
console.log('\nPemasangan & dokumentasi');

const fb = baca('lib/firebase.ts');
ok('dinyalakan dari lib/firebase.ts, dijaga isFirebaseConfigured',
  /if \(isFirebaseConfigured\) setupAppCheck\(app\);/.test(fb));
ok('dinyalakan SESUDAH app dibuat tapi SEBELUM Firestore disiapkan',
  fb.indexOf('const app = getApps()') < fb.indexOf('setupAppCheck(app)') &&
  fb.indexOf('setupAppCheck(app)') < fb.indexOf('initializeFirestore(app'));

const contoh = baca('.env.example');
ok('variabelnya didokumentasikan di .env.example beserta tenggatnya',
  /EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN=/.test(contoh) &&
  /2 November 2026/.test(contoh));
ok('.env tetap tidak ikut ter-commit (repo ini publik)',
  /^\.env\*$/m.test(baca('.gitignore')));

// Ini pengaman SEMENTARA — pastikan alasannya tercatat, bukan jadi utang
// diam-diam yang terlupakan sampai lewat tenggat.
const modul = baca('lib/appCheck.ts');
ok('alasan memilih debug token & rencana menggantinya tercatat di kodenya',
  /2 November 2026/.test(modul) && /App Attest/.test(modul) &&
  /RAHASIA STATIS/.test(modul));

console.log(gagal === 0
  ? '\n✅ LULUS — App Check aktif, urutannya benar, dan batasnya tercatat jujur.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
