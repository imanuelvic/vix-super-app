// 23 Sep 2026 (malam, lanjutan) — empat permintaan:
//   1. tabel Rekap Visitasi: kolom hati & tanggal dilebarkan
//   2. kalender CORE: Sabtu & Minggu berhuruf merah
//   3. dua pil di kepala System rapi rata kanan (muat di iPhone 15)
//   4. tiap layar berpita warna TILE-nya di grid; warna Reward dibuat terang
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');
const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-pita-grid');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

console.log('\n=== 1. Tabel rekap: kolomnya bernapas ===');
{
  const r = baca('app/core-recap.tsx');
  ok('tiap kolom CL minimal 48 (dulu 28)', /cell: \{ flex: 1, minWidth: 48/.test(r));
  ok('ada jarak antar kolom (gap 6)', /gap: 6,\s*\n\s*paddingHorizontal: 10,/.test(r));
  ok('kolom label dipangkas 96 → 46, sisanya untuk kolom CL', /labelCol: \{ width: 46/.test(r));
  ok('tabelnya memang boleh digeser mendatar kalau melebihi layar',
    /<ScrollView horizontal/.test(r) && /tableScroll: \{ minWidth: '100%' \}/.test(r));
  ok('tanggal Thanksgiving tetap dua baris ("15 Nov" lalu "24")',
    /formatTinyDate\(d\)\.replace\(\/ \(\\d\+\)\$\/, '\\n\$1'\)/.test(r));
}

console.log('\n=== 2. Kalender: akhir pekan merah ===');
{
  const k = baca('app/core-calendar.tsx');
  ok('kepala kolom Sab & Min berhuruf merah', /i >= 5 && styles\.weekEnd/.test(k));
  ok('angka tanggal Sabtu & Minggu ikut merah',
    /\(c\.date\.getDay\(\) === 0 \|\| c\.date\.getDay\(\) === 6\) && styles\.weekEnd/.test(k));
  ok('merahnya dari palet (DANGER), bukan hex lepas',
    /weekEnd: \{ color: Color\.DANGER \}/.test(k));
  ok('hari ini tetap menang (huruf putih di lingkaran pekat)',
    k.indexOf('hariIni && styles.dayTodayText') > k.indexOf('styles.weekEnd'));
}

console.log('\n=== 3. Dua pil di kepala System ===');
{
  const s = baca('app/system.tsx');
  ok('judulnya memakai <ScreenHeader/> yang sama dengan layar lain', /<ScreenHeader/.test(s) && !/BackRow/.test(s));
  ok('kedua pil duduk di slot kanan pita', /right=\{\s*\n\s*<>/.test(s));
  ok('pil 🔔 Pengingat & 📱 Version tetap menuju layarnya',
    /router\.push\('\/notifications'\)/.test(s) && /router\.push\('\/app-version'\)/.test(s));
  ok('warna pilnya ikut pita System (grafit), bukan hijau merek',
    /borderColor: Color\.DEVICE_DEEP/.test(s) && /appButtonText: \{ color: Color\.DEVICE_DEEP \}/.test(s));
  ok('baris judul lama yang meluber sudah dibuang', !/titleRow:/.test(s) && !/titleTools:/.test(s));
}

console.log('\n=== 4. Tiap layar berpita warna tile-nya ===');
{
  fs.rmSync(OUT, { recursive: true, force: true });
  try {
    execFileSync(process.execPath, [
      ROOT + '/node_modules/typescript/bin/tsc', '--ignoreConfig',
      ROOT + '/assets/style/color.ts', ROOT + '/lib/featureGrid.ts', ROOT + '/lib/featureTheme.ts',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ], { stdio: 'pipe' });
  } catch { /* galat tipe diabaikan */ }
  const F_COLOR = path.join(OUT, 'assets/style/color.js');
  const F_GRID = path.join(OUT, 'lib/featureGrid.js');
  const F_THEME = path.join(OUT, 'lib/featureTheme.js');
  const asli = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req === '@/assets/style/color') return asli.call(this, F_COLOR, parent, isMain);
    if (req === '@/lib/featureGrid') return asli.call(this, F_GRID, parent, isMain);
    if (req === 'expo-router') return {};
    return asli.call(this, req, parent, isMain);
  };
  const { Color } = require(F_COLOR);
  const { LIFE_FEATURES } = require(F_GRID);
  const { featureThemeForRoute } = require(F_THEME);
  Module._load = asli;

  const tile = Object.fromEntries(LIFE_FEATURES.map((f) => [f.key, f]));
  const cocok = (rute, key) => featureThemeForRoute(rute).bg === tile[key].bg;
  ok('Reward, Habits, Profile & System: pita = warna tile-nya di grid',
    cocok('reward', 'rewards') && cocok('habits', 'habits') &&
    cocok('profile', 'profile') && cocok('system', 'system'));
  ok('sub-halamannya ikut induknya',
    cocok('reward-category', 'rewards') && cocok('reward-archive', 'rewards') &&
    cocok('history', 'profile') && cocok('timeline', 'profile') &&
    cocok('app-version', 'system') && cocok('notifications', 'system'));
  ok('ketiga layar yang dulu berkepala sendiri kini memakai <ScreenHeader/>',
    /<ScreenHeader/.test(baca('app/habits.tsx')) &&
    /<ScreenHeader/.test(baca('app/profile.tsx')) &&
    /<ScreenHeader/.test(baca('app/system.tsx')));
  ok('isi kepalanya tidak hilang: streak Habits, ✏️ Ubah Profile, dua pil System',
    /right=\{\s*\n\s*<StreakPill/.test(baca('app/habits.tsx')) &&
    /✏️ Ubah/.test(baca('app/profile.tsx')) &&
    /📳 Notif/.test(baca('app/system.tsx')));
  ok('Reward lebih terang dari perunggu lama', Color.REWARD === '#F0C36B');

  // Jarak warna: Reward tetap tidak tertukar dengan tetangganya.
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lab = (hex) => {
    const [r, g, b] = rgb(hex).map(lin);
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const beda = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
  const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const kontras = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const jarak = LIFE_FEATURES.filter((f) => f.key !== 'rewards')
    .map((f) => [f.label, beda(Color.REWARD, f.bg)])
    .sort((a, b) => a[1] - b[1]);
  ok('Reward tetap berjarak ≥ ΔE10 dari semua tile lain', jarak[0][1] >= 10,
    `${jarak[0][0]} ΔE${jarak[0][1].toFixed(1)}`);
  ok('tulisan di atas pita Reward tetap terbaca (kontras ≥ 4.5)',
    kontras(Color.REWARD, Color.REWARD_DARK) >= 4.5,
    kontras(Color.REWARD, Color.REWARD_DARK).toFixed(2));
}

console.log(gagal === 0 ? '\n✅ LULUS — tabel, akhir pekan, kepala System, & pita grid beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
