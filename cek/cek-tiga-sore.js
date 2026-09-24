// 15 Sep 2026 sore: (1) kartu "Menuju Badan Ideal" dibuang bersama kode yang
// jadi nganggur; (2) Apple Health minta izin lagi sebelum bacaan pertama
// (sekali per sesi) + petunjuk saat angkanya 0; (3) info kartu Race tak
// patah di tengah keping.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-tiga-sore');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const body = baca('components/health/BodyCard.tsx');
const health = baca('lib/health.ts');
const hk = baca('lib/healthkit.ts');
const steps = baca('components/health/StepsTab.tsx');
const arsip = baca('components/fun/FunArchive.tsx');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

// ============ 1. Menuju Badan Ideal dibuang bersih ============
console.log('\n=== 1. Data Tubuh tanpa kartu saran ===');
ok('kartu "🎯 Menuju Badan Ideal" tidak ada lagi', !/Menuju Badan Ideal/.test(body));
ok('gaya adviceCard/adviceTitle/adviceText ikut dibuang', !/advice(Card|Title|Text)/.test(body));
ok('variabel `advice` & impor bodyAdvice ikut dibuang', !/\badvice\b|bodyAdvice/.test(body));
ok('bodyAdvice & formatKg (cuma dipakai saran itu) dicabut dari lib/health',
  !/bodyAdvice|formatKg/.test(health));
ok('rumus yang masih dipakai kartu tetap ada',
  ['bodyFatMale', 'bodyFatCategory', 'waistHipRatio', 'idealWeightRange', 'bmrMale', 'bmiValue']
    .every((f) => new RegExp(`export function ${f}\\(`).test(health)));
ok('baris data tubuh lainnya tetap utuh',
  ['Umur', 'Tinggi', 'Ukuran celana', 'Ukuran sepatu'].every((t) => body.includes(`label="${t}"`)) &&
  /🧍 Data Tubuh/.test(body) && /🧍 Edit Body Data/.test(body));
ok('tidak ada gaya nganggur tersisa di BodyCard', (() => {
  const blok = body.slice(body.indexOf('const styles = StyleSheet.create({'));
  const nama = [...blok.matchAll(/^  (\w+): /gm)].map((m) => m[1]);
  const jsx = body.slice(0, body.indexOf('const styles = StyleSheet.create({'));
  return nama.length > 5 && nama.every((n) => new RegExp(`styles\\.${n}\\b`).test(jsx));
})());

// ============ 2. Apple Health: izin ============
console.log('\n=== 2. Apple Health minta izin lagi ===');
ok('plugin HealthKit + kalimat izinnya masih terpasang di app.json', (() => {
  const p = appJson.expo.plugins.find((x) => Array.isArray(x) && x[0] === '@kingstinct/react-native-healthkit');
  return !!p && typeof p[1].NSHealthShareUsageDescription === 'string' && p[1].NSHealthShareUsageDescription.length > 20;
})());
ok('requestAuthorization masih diminta untuk langkah & kalori aktif',
  /'HKQuantityTypeIdentifierStepCount',\s*\n\s*'HKQuantityTypeIdentifierActiveEnergyBurned',/.test(hk) &&
  /\.requestAuthorization\(\{ toRead: \[\.\.\.READ_TYPES\] \}\)/.test(hk));
ok('izin diminta SEBELUM kedua bacaan (hari ini & riwayat harian)',
  (hk.match(/await pastikanIzin\(mod\);/g) || []).length === 2 &&
  hk.indexOf('await pastikanIzin(mod);') < hk.indexOf('readSteps(mod, dayStart, now)'));
ok('sekali per sesi: promise-nya disimpan, bukan diminta tiap bacaan',
  /let izinDiminta: Promise<void> \| null = null;/.test(hk) && /if \(!izinDiminta\)/.test(hk));
ok('kalau permintaannya gagal, sesi berikutnya dicoba lagi (tidak terkunci gagal)',
  /\(\) => \{\s*\n\s*izinDiminta = null;\s*\n\s*\}/.test(hk));
ok('export mati requestHealthAccess sudah tidak ada di mana pun', (() => {
  const semua = ['app', 'components', 'lib', 'hooks'].flatMap(function jelajah(d) {
    return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? jelajah(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
  });
  return !semua.some((f) => /requestHealthAccess/.test(baca(f)));
})());
ok('kartu langkah menunjukkan jalan ke sakelar izin HANYA saat angkanya 0 & bukan sedang memuat',
  /\{hkStatus === 'ok' && !hkBusy && \(hk\?\.steps \?\? 0\) === 0 && \(/.test(steps) &&
  /Pengaturan iPhone → Kesehatan → Akses Data & Perangkat → vix/.test(steps));
ok('kalimat petunjuknya bersyarat (tidak menuduh saat memang belum jalan)',
  /Sudah jalan tapi tetap 0\?/.test(steps));

// --- dijalankan sungguhan dengan modul HealthKit palsu ---
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/healthkit.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

let dimintaKali = 0;
let gagalkanIzin = false;
const palsu = {
  isHealthDataAvailable: () => true,
  requestAuthorization: async (arg) => {
    dimintaKali++;
    if (!Array.isArray(arg.toRead) || arg.toRead.length !== 2) throw new Error('toRead salah');
    if (gagalkanIzin) throw new Error('gagal');
    return true;
  },
  queryStatisticsForQuantity: async (id) => ({
    sumQuantity: { quantity: id === 'HKQuantityTypeIdentifierStepCount' ? 4321 : 210 },
  }),
};
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'expo-constants') {
    return { __esModule: true, default: { executionEnvironment: 'bare' }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
  }
  if (req === 'react-native') return { Platform: { OS: 'ios' } };
  if (req === '@kingstinct/react-native-healthkit') return palsu;
  if (req === './format') {
    return {
      dayId: (d) => d.toISOString().slice(0, 10),
      startOfDay: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    };
  }
  return asli(req, parent, isMain);
};
const H = require(path.join(OUT, 'healthkit.js'));
// Stub-nya DIBIARKAN terpasang: modul HealthKit di-require MALAS di dalam
// getModule(), baru saat bacaan pertama, bukan saat berkasnya dimuat.

(async () => {
  ok('status: modul palsu terbaca sebagai "ok"', H.healthKitStatus() === 'ok');
  const [hariIni, riwayat] = await Promise.all([H.readTodaySummary(), H.readRecentDailySteps(3)]);
  ok('bacaan hari ini lewat: langkah & kalori terbaca',
    hariIni && hariIni.steps === 4321 && hariIni.activeKcal === 210, JSON.stringify(hariIni));
  ok('riwayat 3 hari terbaca', Array.isArray(riwayat) && riwayat.length === 3 && riwayat[0].steps === 4321);
  ok('dua bacaan bersamaan → dialog izin cuma SEKALI', dimintaKali === 1, String(dimintaKali));
  await H.readTodaySummary();
  ok('bacaan berikutnya (🔄) tidak minta izin lagi', dimintaKali === 1, String(dimintaKali));

  // Sesi baru (modul dimuat ulang) yang permintaannya GAGAL: bacaan tetap
  // jalan, dan bacaan berikutnya mencoba minta izin LAGI, bukan menyerah.
  delete require.cache[require.resolve(path.join(OUT, 'healthkit.js'))];
  const H2 = require(path.join(OUT, 'healthkit.js'));
  gagalkanIzin = true;
  dimintaKali = 0;
  const tetap = await H2.readTodaySummary();
  await H2.readTodaySummary();
  ok('permintaan izin gagal → bacaan tetap jalan (tidak ikut gagal)',
    tetap && tetap.steps === 4321, JSON.stringify(tetap));
  ok('…dan bacaan berikutnya mencoba minta izin lagi', dimintaKali === 2, String(dimintaKali));
  Module._load = asli;

  console.log(gagal === 0 ? '\n✅ LULUS — tiga-tiganya beres.' : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
})();

// ============ 3. Kartu Race ============
console.log('\n=== 3. Info kartu Race tak patah di tengah keping ===');
ok('tiap keping dibuat tak-putus (U+00A0) sebelum digabung dengan " · "',
  /\.filter\(Boolean\)\s*\n\s*\.map\(\(keping\) => keping\.replace\(\/ \/g, '\\u00A0'\)\)\s*\n\s*\.join\('   ·   '\);/.test(arsip));
ok('pemisahnya sendiri tetap spasi biasa (baris boleh patah di situ)',
  /\.join\('   ·   '\)/.test(arsip));
ok('keempat kepingnya masih ada: 💵 📏 ⏱️ 🏃',
  ['💵 ${formatRupiah(item.price)}', '📏 ${formatDecimal(item.distanceKm)} km', '⏱️ ${formatFinish(detikTempuh, { detik: false })}', '🏃 ${formatPace(paceItem)}']
    .every((t) => arsip.includes(t)));
// Tiruan alur yang sama pada data contoh dari layar (Milo Activ):
const contoh = ['💵 Rp 300.000', '📏 10 km', '⏱️ 1j 25m 47d', '🏃 8\'35"/km']
  .filter(Boolean)
  .map((keping) => keping.replace(/ /g, '\u00A0'))
  .join('   ·   ');
const keping = contoh.split('   ·   ');
ok('"⏱️ 1j 25m 47d" jadi satu kesatuan tanpa spasi biasa di dalamnya',
  keping.length === 4 && keping.every((k) => !/ /.test(k)) && keping[2] === '⏱️\u00A01j\u00A025m\u00A047d');
ok('formatFinish tidak diubah (spasi biasa; tak-putusnya cuma di kartu)',
  /return bagian\.join\(' '\);/.test(baca('lib/fun.ts')));
