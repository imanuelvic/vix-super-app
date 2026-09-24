// Modifikasi besar: warna tiap fitur menempel dari tile grid Home sampai ke
// dalam layarnya (pita header, tab bawah, kartu ringkasan) — plus palet yang
// disebar ulang supaya tidak ada dua tile yang tertukar sekilas pandang.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-warna-fitur');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'assets/style/color.ts',
      R + 'lib/featureGrid.ts',
      R + 'lib/featureTheme.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan — yang penting JS-nya terbit */ }

const F_COLOR = path.join(OUT, 'assets/style/color.js');
const F_GRID = path.join(OUT, 'lib/featureGrid.js');
const F_THEME = path.join(OUT, 'lib/featureTheme.js');
for (const f of [F_COLOR, F_GRID, F_THEME]) {
  if (!fs.existsSync(f)) {
    console.log(`  ✗ gagal mengompilasi ${path.basename(f)}`);
    process.exit(1);
  }
}

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === '@/assets/style/color') return asli.call(this, F_COLOR, parent, isMain);
  if (req === '@/lib/featureGrid') return asli.call(this, F_GRID, parent, isMain);
  if (req === 'expo-router') return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const { Color } = require(F_COLOR);
const { HOME_FEATURES, LIFE_FEATURES } = require(F_GRID);
const { featureKeyForRoute, featureThemeForRoute, BRAND_THEME } = require(F_THEME);

// ---------- Alat ukur warna ----------
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function lab(hex) {
  const [r, g, b] = rgb(hex).map(lin);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const beda = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const kontras = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

console.log('\n== 1. Palet 19 fitur: tidak ada yang kembar ==');

// 23 Sep 2026: tile Married dihapus (belum pernah dipakai) → tinggal 19.
c('grid Home berisi 19 fitur', HOME_FEATURES.length === 19, `${HOME_FEATURES.length}`);
c(
  'tiap fitur punya tiga warna (pastel · gelap · paling gelap)',
  HOME_FEATURES.every((f) => /^#[0-9A-F]{6}$/i.test(f.bg) && /^#[0-9A-F]{6}$/i.test(f.fg) && /^#[0-9A-F]{6}$/i.test(f.deep)),
);

// Dulu Device memakai warna Learning PERSIS SAMA — dua tile benar-benar kembar.
const pastelSama = [];
for (let i = 0; i < HOME_FEATURES.length; i++)
  for (let j = i + 1; j < HOME_FEATURES.length; j++)
    if (HOME_FEATURES[i].bg.toUpperCase() === HOME_FEATURES[j].bg.toUpperCase())
      pastelSama.push(`${HOME_FEATURES[i].label}=${HOME_FEATURES[j].label}`);
c('tak ada dua tile berwarna sama persis', pastelSama.length === 0, pastelSama.join(', '));

c(
  'Device tidak lagi menumpang warna Learning',
  HOME_FEATURES.find((f) => f.key === 'device').bg !==
    HOME_FEATURES.find((f) => f.key === 'learning').bg,
);
c(
  'Fun tidak lagi sehijau Finance',
  beda(HOME_FEATURES.find((f) => f.key === 'fun').bg, HOME_FEATURES.find((f) => f.key === 'finance').bg) > 40,
);
c(
  'Invest punya warna sendiri, bukan abu-abu tanpa arti',
  beda(HOME_FEATURES.find((f) => f.key === 'investment').bg, '#E4E2DC') > 20,
);

// Jarak warna: ΔE di bawah ~7 praktis terbaca "warna yang sama" sekilas.
const MIN_GLOBAL = 8.5;
const MIN_TETANGGA = 10;
const terlalu = [];
const tetanggaTerlalu = [];
for (let i = 0; i < HOME_FEATURES.length; i++) {
  for (let j = i + 1; j < HOME_FEATURES.length; j++) {
    const d = beda(HOME_FEATURES[i].bg, HOME_FEATURES[j].bg);
    const label = `${HOME_FEATURES[i].label}↔${HOME_FEATURES[j].label} ΔE${d.toFixed(1)}`;
    if (d < MIN_GLOBAL) terlalu.push(label);
    // Grid 4 kolom: bersebelahan = kiri-kanan sebaris, atau atas-bawah sekolom.
    const sebaris = Math.floor(i / 4) === Math.floor(j / 4) && j - i === 1;
    const sekolom = i % 4 === j % 4 && j - i === 4;
    if ((sebaris || sekolom) && d < MIN_TETANGGA) tetanggaTerlalu.push(label);
  }
}
c(`tiap pasang tile berjarak ≥ ΔE${MIN_GLOBAL}`, terlalu.length === 0, terlalu.join(' · '));
c(`tile yang BERSEBELAHAN di grid berjarak ≥ ΔE${MIN_TETANGGA}`, tetanggaTerlalu.length === 0, tetanggaTerlalu.join(' · '));

// ---------------------------------------------------------------------------
// 23 Sep 2026: grid LIFE memuat empat tile tambahan (Habits, Reward, Profile,
// System) yang TIDAK ikut diperiksa di atas — dan di situlah Reward sempat
// memakai warna Games persis. Sekarang gridnya diperiksa apa adanya.
console.log('\n== 1b. Grid Life: tile tambahannya ikut diperiksa ==');
// System sengaja memakai warna Device: ia memang halaman pengaturan perangkat
// itu sendiri, dan keduanya tidak pernah bersebelahan di grid.
const KEMBAR_SENGAJA = new Set(['Device=System']);
const lifeSama = [];
for (let i = 0; i < LIFE_FEATURES.length; i++) {
  for (let j = i + 1; j < LIFE_FEATURES.length; j++) {
    if (LIFE_FEATURES[i].bg.toUpperCase() === LIFE_FEATURES[j].bg.toUpperCase()) {
      const pasangan = `${LIFE_FEATURES[i].label}=${LIFE_FEATURES[j].label}`;
      if (!KEMBAR_SENGAJA.has(pasangan)) lifeSama.push(pasangan);
    }
  }
}
c('tak ada tile Life berwarna sama persis (selain Device/System yang sengaja)',
  lifeSama.length === 0, lifeSama.join(', '));
const awards = LIFE_FEATURES.find((f) => f.key === 'rewards');
const games = LIFE_FEATURES.find((f) => f.key === 'games');
c('Reward tidak lagi memakai warna Games', awards.bg !== games.bg);
c(`Reward ↔ Games berjarak ≥ ΔE${MIN_TETANGGA}`,
  beda(awards.bg, games.bg) >= MIN_TETANGGA, `ΔE${beda(awards.bg, games.bg).toFixed(1)}`);
c('Reward memakai piala, Games memakai stik game',
  awards.icon === 'trophy.fill' && games.icon === 'gamecontroller.fill');
c('Habits & Reminder tidak lagi berlambang sama (centang vs lonceng)',
  LIFE_FEATURES.find((f) => f.key === 'habits').icon === 'checkmark.circle.fill' &&
  LIFE_FEATURES.find((f) => f.key === 'tasks').icon === 'bell.fill');
const lambang = LIFE_FEATURES.map((f) => f.icon ?? f.glyph);
c('tidak ada dua tile Life yang berlambang sama',
  new Set(lambang).size === lambang.length,
  lambang.filter((x, i) => lambang.indexOf(x) !== i).join(', '));
c('tulisannya tetap terbaca di atas pastelnya (kontras ≥ 4.5)',
  LIFE_FEATURES.every((f) => kontras(f.bg, f.fg) >= 4.5),
  LIFE_FEATURES.filter((f) => kontras(f.bg, f.fg) < 4.5).map((f) => `${f.label} ${kontras(f.bg, f.fg).toFixed(1)}`).join(', '));
c('judul layar Life memakai lambangnya, seperti judul layar lain',
  /Life 🌿/.test(baca('app/(tabs)/life.tsx')));

console.log('\n== 2. Warna itu terbaca, bukan cuma cantik ==');

// Pita header memuat tulisan kecil (label tombol kembali 15pt, subjudul 13pt),
// jadi patokannya 4.5 — bukan 3.0 yang berlaku untuk tulisan besar saja.
const kurangKontras = HOME_FEATURES.filter((f) => kontras(f.fg, f.bg) < 4.5)
  .map((f) => `${f.label} ${kontras(f.fg, f.bg).toFixed(2)}`);
c('tulisan gelap tiap fitur terbaca di atas pastelnya (≥4.5)', kurangKontras.length === 0, kurangKontras.join(', '));

const kurangPutih = HOME_FEATURES.filter((f) => kontras('#FFFFFF', f.deep) < 4.5)
  .map((f) => `${f.label} ${kontras('#FFFFFF', f.deep).toFixed(2)}`);
c('tulisan putih terbaca di atas kartu ringkasan tiap fitur (≥4.5)', kurangPutih.length === 0, kurangPutih.join(', '));

const deepTerangDariFg = HOME_FEATURES.filter((f) => f.deep !== f.fg && lum(f.deep) > lum(f.fg)).map((f) => f.label);
c('warna kartu selalu sama gelap atau lebih gelap dari warna tulisannya', deepTerangDariFg.length === 0, deepTerangDariFg.join(', '));

// Bug lama: CAREER_DARK berisi ABU-ABU PUCAT (#E4E2DC) padahal dipakai sebagai
// warna TULISAN di dua tab Career — di atas kartu putih praktis tak terbaca.
c(
  'CAREER_DARK cukup gelap untuk jadi warna tulisan (dulu #E4E2DC)',
  kontras(Color.CAREER_DARK, Color.CONTAINER) >= 4.5,
  `kontras ${kontras(Color.CAREER_DARK, Color.CONTAINER).toFixed(2)}`,
);
const affiliate = baca('components/career/AffiliateTab.tsx');
const fulltime = baca('components/career/FulltimeTab.tsx');
c(
  'dua tulisan Career yang memakainya masih ada (🛍️ produk & 📥 backlog)',
  /product: \{ color: Color\.CAREER_DARK \}/.test(affiliate) &&
    /backlog: \{ color: Color\.CAREER_DARK \}/.test(fulltime),
);

console.log('\n== 3. Rute mana milik fitur mana ==');

const kunciGrid = HOME_FEATURES.map((f) => f.key);
c('semua rute layar utama fitur menunjuk fiturnya sendiri',
  kunciGrid.every((k) => {
    // Rute layar utamanya = '/tasks', '/walk', … kecuali Invest ('/investment').
    const rute = HOME_FEATURES.find((f) => f.key === k).route.replace(/^\//, '');
    return featureKeyForRoute(rute) === k;
  }));

const contoh = [
  ['steps', 'health'], ['donor', 'health'], ['checkup-status', 'health'],
  ['revive', 'spiritual'], ['gratitude', 'spiritual'], ['sermon', 'spiritual'],
  ['fasting', 'spiritual'], ['reminder-share', 'spiritual'],
  ['debts', 'finance'], ['saku', 'finance'], ['saku/[key]', 'finance'],
  ['chat-templates', 'core'], ['visitations', 'core'], ['core-rules', 'core'],
  ['multiplication/[id]', 'core'], ['monthly-prayers', 'core'],
  ['project/[id]', 'career'], ['project/edit/[id]', 'career'],
  ['bill/[id]', 'friends'], ['book/[key]', 'book'],
];
const salah = contoh.filter(([r, k]) => featureKeyForRoute(r) !== k)
  .map(([r, k]) => `${r} seharusnya ${k}, dapat ${featureKeyForRoute(r)}`);
c('sub-halaman ikut warna fitur induknya', salah.length === 0, salah.join(' · '));

// 'core-rules' tidak boleh tertelan aturan awalan 'core' secara kebetulan —
// pencocokannya per RUAS, jadi 'core-rules' memang harus terdaftar sendiri.
c('pencocokan per ruas, bukan awalan mentah', featureKeyForRoute('corel') === null && featureKeyForRoute('newsletter') === null);

// 23 Sep 2026: Reward, Profile, System & Habits kini berpita warna TILE-nya
// (permintaan pemilik: layar harus menjawab tile mana yang tadi di-click),
// jadi yang tersisa memakai warna merek cuma layar tanpa tile: login & (tabs).
const luar = ['(tabs)', 'login'];
c('layar di luar fitur memakai warna merek',
  luar.every((r) => featureThemeForRoute(r).key === BRAND_THEME.key));
c('warna merek = mint & hijau tua merek',
  BRAND_THEME.bg === Color.MAIN_LIGHT && BRAND_THEME.fg === Color.MAIN_DARK && BRAND_THEME.deep === Color.MAIN_DARK);

c('tiap fitur di grid benar-benar punya rute yang menunjuk ke sana',
  kunciGrid.every((k) => featureThemeForRoute(
    HOME_FEATURES.find((f) => f.key === k).route.replace(/^\//, ''),
  ).key === k));

// Layar yang memakai <ScreenHeader/> tapi tidak terdaftar di peta rute akan
// diam-diam berwarna merek. Boleh — asal disengaja, jadi daftarnya dipatok.
const RUTE_MEREK_SENGAJA = new Set([
  // Tinggal layar masuk: satu-satunya layar yang memang bukan milik fitur
  // mana pun. Sisanya (Reward, Profile, System, Habits, beserta
  // sub-halamannya) sudah berpita warna tile-nya sendiri.
  'login',
]);
const layar = [];
(function sapu(dir, awalan) {
  for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name.startsWith('+')) continue;
    if (e.isDirectory()) {
      if (e.name.startsWith('(')) sapu(`${dir}/${e.name}`, awalan);
      else sapu(`${dir}/${e.name}`, `${awalan}${e.name}/`);
    } else if (e.name.endsWith('.tsx')) {
      layar.push({ rute: awalan + e.name.replace(/\.tsx$/, ''), file: `${dir}/${e.name}` });
    }
  }
})('app', '');
const pakaiHeader = layar.filter((l) => /<ScreenHeader/.test(baca(l.file)));
const yatim = pakaiHeader
  .filter((l) => featureKeyForRoute(l.rute) === null && !RUTE_MEREK_SENGAJA.has(l.rute))
  .map((l) => l.rute);
c(
  `${pakaiHeader.length} layar berheader: semuanya kebagian warna (fitur / merek yang disengaja)`,
  yatim.length === 0,
  yatim.join(', '),
);

console.log('\n== 4. Warnanya benar-benar dipasang di layar ==');

const header = baca('components/common/ScreenHeader.tsx');
c('header memakai warna fitur layarnya', /useFeatureTheme\(\)/.test(header));
c('pita header berlatar pastel fitur', /styles\.band,[\s\S]{0,120}backgroundColor: theme\.bg/.test(header));
c('judul & tombol kembali ikut warna gelap fitur',
  /IconSymbol\s*\n?\s*name="chevron\.left"[\s\S]{0,80}color=\{theme\.fg\}/.test(header) &&
  /heading="header" additionalStyle=\{\{ color: theme\.fg \}\}/.test(header));
c('pita ikut menutup jalur status bar (padding + margin negatif)',
  /paddingTop: insets\.top/.test(header) && /marginTop: -insets\.top/.test(header));
// 24 Sep 2026 (permintaan pemiliknya): pita header RATA keempat sudutnya.
// Sudut membulat bermasalah di layar bersub-tab — di bawah pita ada bar
// emerald gelap, dan dua sudut membulat di atasnya menyisakan takik krem.
// Lengkungan kepala layar sekarang dipegang ujung bawah bar emerald itu, jadi
// yang dijaga di sini dibalik: pita TIDAK boleh punya sudut bawah lagi.
c('pita header rata, tidak bersudut bawah (lengkungannya pindah ke bar sub-tab)',
  !/borderBottomLeftRadius/.test(header) && !/borderBottomRightRadius/.test(header) &&
  /borderBottomLeftRadius: 24/.test(baca('components/common/BottomTabs.tsx')));
c('warna teal tetap tidak dipatok lagi di header', !/Color\.MAIN\b/.test(header));

const tabs = baca('components/common/BottomTabs.tsx');
c('tab bawah memakai warna fitur', /useFeatureTheme\(\)/.test(tabs));
// 24 Sep 2026: bar sub-tab jadi emerald gelap. Dua akibatnya, dan keduanya
// dipisah di bawah karena DUA komponen berbeda yang mengaturnya:
//
//   • TopTab (pil di atas, layar Walk/CORE/Work): ikon & tulisan sama-sama DI
//     DALAM pil pastel, jadi keduanya tetap warna gelap fitur (fg).
//   • Tab (kaki layar fitur): ikonnya di dalam pil (fg), tapi LABELNYA di luar
//     pil, langsung di atas bar gelap — jadi labelnya pastel fitur (bg).
//
// Dulu cek ini satu baris dan cuma mencari polanya di mana saja di berkas;
// akibatnya saat label Tab berubah jadi `bg`, ceknya tetap hijau karena masih
// menemukan pola `fg` milik TopTab. Sekarang tiap komponen diperiksa di
// potongan berkasnya sendiri, jadi tidak bisa saling menutupi lagi.
const potong = (dari, sampai) => tabs.slice(tabs.indexOf(dari), tabs.indexOf(sampai));
const blokTab = potong('function Tab<T extends string>', 'function TopTab<T extends string>');
const blokTopTab = potong('function TopTab<T extends string>', 'const styles = StyleSheet.create');

c('sub-menu aktif (pil atas): ikon & tulisan sewarna gelap fitur, di dalam pilnya',
  /color=\{active \? fg : Color\.TABBAR_INACTIVE\}/.test(blokTopTab) &&
  /additionalStyle=\{\{ color: active \? fg : Color\.TABBAR_INACTIVE \}\}/.test(blokTopTab));
c('sub-menu aktif (kaki layar): ikon fg di dalam pil, LABEL pastel di atas bar gelap',
  /color=\{active \? fg : Color\.TABBAR_INACTIVE\}/.test(blokTab) &&
  /additionalStyle=\{\{ color: active \? bg : Color\.TABBAR_INACTIVE \}\}/.test(blokTab));
c('sub-menu aktif berpil pastel fitur',
  /activePill,\s*\{ backgroundColor: bg \}/.test(tabs));
c('pilnya melayang (posisi mutlak) supaya tinggi tab tak bergeser',
  /activePill: \{\s*\n\s*position: 'absolute'/.test(tabs));

const ringkas = baca('components/common/SummaryCard.tsx');
c('kartu ringkasan berlatar warna tergelap fitur', /backgroundColor: theme\.deep/.test(ringkas));
c('kartu ringkasan tak lagi hijau tua dipatok', !/backgroundColor: Color\.MAIN_DARK/.test(ringkas));
c('keterangannya putih redup netral, bukan yang bersemu mint',
  /label: \{ color: Color\.TEXT_ON_DARK_SOFT \}/.test(ringkas));

const hook = baca('hooks/useFeatureTheme.ts');
// Sengaja mengabaikan komentar: alasan memilih useRoute justru MENYEBUT
// usePathname, jadi yang diperiksa barisnya sendiri, bukan seluruh berkas.
const kodeHook = hook.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
c('warna diambil dari rute LAYAR ITU, bukan rute yang sedang tampil',
  /import \{ useRoute \} from 'expo-router'/.test(kodeHook) &&
  /useRoute\(\)/.test(kodeHook) &&
  !/usePathname/.test(kodeHook));

console.log('\n== 5. Hijau yang bukan warna fitur tetap hijau ==');


// Ring kalori & paket sarapan Diet dulu diperiksa di sini. Fitur Diet
// dihapus seluruhnya (2 Sep 2026); warnanya sendiri TETAP ada di palet —
// dijaga di sini supaya tidak ikut terbawa terhapus.
c('GREEN_SOFT tetap hijau lama milik Fun (dipakai palet, bukan Diet lagi)',
  Color.GREEN_SOFT === '#C7E9C0' && Color.GREEN_SOFT_DARK === '#3E7A3A');

const profil = baca('app/profile.tsx');
c('kotak 💚 Strengths di SWOT masih hijau', /emoji: '💚'[^\n]*Color\.GREEN_SOFT/.test(profil));

const kepribadian = baca('components/profile/PersonalityTab.tsx');
c('kartu Temperamen masih hijau', /bg=\{Color\.GREEN_SOFT\}/.test(kepribadian));

// Kartu reminder Fun di Dashboard MEMANG harus ikut pindah ke fuchsia —
// itu kartu milik fiturnya, bukan hijau "sehat/cukup".
const dash = baca('app/reminders.tsx');
c('kartu reminder Fun di Dashboard tetap memakai warna fitur Fun',
  /bg=\{Color\.FUN\}[\s\S]{0,60}fg=\{Color\.FUN_DARK\}/.test(dash));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);