// Uji: pita di BAWAH sub-tab (area home indicator) ikut putih seperti tab
// bar-nya — DAN tak ada satu pun yang bergeser karenanya (tulisan tab, isi
// layar, tombol melayang). Perhitungan tata letaknya dijalankan sungguhan,
// pakai angka yang diambil dari kode yang dikirim.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const tabs = baca('components/common/BottomTabs.tsx');

console.log('=== Warnanya disamakan dengan tab bar ===');
// 24 Sep 2026: kaki layar fitur jadi BAR EMERALD GELAP (permintaan user, meniru
// bentuk tab bar GoPay dengan warna merek sendiri). Yang dijaga tetap sama
// tegasnya: latarnya WAJIB dari token khusus kaki layar, dan garis pemisahnya
// wajib ada. Yang berubah cuma token mana yang dipatok.
c('latar tab bar dari token kaki layar (TABBAR_BG), tidak diganti diam-diam',
  /tabBar: \{[\s\S]*?backgroundColor: Color\.TABBAR_BG/.test(tabs));
c('garis atasnya tetap ada', /borderTopWidth: 1/.test(tabs) &&
  /borderTopColor: Color\.TABBAR_LINE/.test(tabs));
// Yang dilarang adalah hex mentah di KODE, bukan penyebutannya di komentar.
// 24 Sep 2026: dulu cek ini memindai seluruh berkas, jadi satu komentar yang
// menjelaskan "TASKS_DARK nilainya persis #0B3D36" ikut dianggap pelanggaran.
// Komentarnya justru penting, jadi yang diperbaiki ceknya: komentar dibuang
// dulu, sisanya diperiksa seketat sebelumnya.
const tanpaKomentar = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
c('tidak ada warna hex mentah', !/#[0-9A-Fa-f]{6}/.test(tanpaKomentar(tabs)));
c('ruang aman bawah dibaca dari sistem, bukan angka tebakan',
  /import \{ useSafeAreaInsets \} from 'react-native-safe-area-context'/.test(tabs) &&
    /const insets = useSafeAreaInsets\(\)/.test(tabs));

console.log('\n=== Angka yang benar-benar dikirim ===');
const gayaSrc = tabs.match(/styles\.tabBar,\s*(\{[^}]*\}),?\s*\]/);
c('gaya tambahannya ketemu di kode', !!gayaSrc);
const gayaOf = (bottom) =>
  gayaSrc ? new Function('insets', `return ${gayaSrc[1]}`)({ bottom }) : {};
const dasarSrc = tabs.match(/tabBar: \{[\s\S]*?paddingTop: (\d+),\s*paddingBottom: (\d+),/);
c('paddingTop & paddingBottom dasar ketemu', !!dasarSrc);
const padTop = dasarSrc ? Number(dasarSrc[1]) : NaN;
const padBawahDasar = dasarSrc ? Number(dasarSrc[2]) : NaN;
c('padding dasarnya tetap 8/8 seperti sebelum diubah (dulu paddingVertical: 8)',
  padTop === 8 && padBawahDasar === 8);
c('paddingVertical lama sudah tidak dipakai lagi (kalau tersisa, ia menimpa)',
  !/paddingVertical: 8/.test(tabs));

for (const inset of [0, 20, 34]) {
  const g = gayaOf(inset);
  c(`ruang aman ${inset}px → paddingBottom ${8 + inset}`,
    g.paddingBottom === 8 + inset, `dapat ${g.paddingBottom}`);
  c(`ruang aman ${inset}px → marginBottom -${inset} (persis sebesar tambahannya)`,
    g.marginBottom === -inset, `dapat ${g.marginBottom}`);
  c(`ruang aman ${inset}px → tambahan & tarikannya SAMA besar`,
    g.paddingBottom - padBawahDasar === -g.marginBottom);
}

console.log('\n=== Simulasi tata letak (angka dari kode di atas) ===');
// Model sederhana kolom flex di dalam SafeAreaView edges={['top','bottom']}:
//   [ isi layar (flex:1) ][ tab bar ]   dengan paddingBottom = ruang aman.
const LAYAR = 844; // tinggi layar iPhone 15
const ISI_TAB = 44; // tinggi ikon + tulisan di dalam tab
function ukur(inset, pakaiPerbaikan) {
  const g = pakaiPerbaikan ? gayaOf(inset) : { paddingBottom: padBawahDasar, marginBottom: 0 };
  const tinggiGambar = padTop + ISI_TAB + g.paddingBottom;
  const tinggiDipesan = tinggiGambar + g.marginBottom; // margin negatif = "dipesan" lebih kecil
  const kotakIsi = LAYAR - inset; // batas bawah area isi SafeAreaView
  const atasTab = kotakIsi - tinggiDipesan;
  return {
    atasTab,
    bawahTab: atasTab + tinggiGambar,
    tulisanTab: atasTab + padTop, // posisi ikon & tulisan di dalam tab
    tinggiIsiLayar: atasTab, // sisa ruang untuk konten di atasnya
  };
}
const inset = 34;
const sebelum = ukur(inset, false);
const sesudah = ukur(inset, true);
c('SEBELUM: ada pita krem tersisa di bawah tab bar',
  sebelum.bawahTab < LAYAR, `sisa ${LAYAR - sebelum.bawahTab}px`);
c('SESUDAH: putihnya menutup sampai ujung bawah layar, tak ada pita tersisa',
  Math.round(sesudah.bawahTab) === LAYAR, `bawah tab = ${sesudah.bawahTab}`);
c('tulisan tab TIDAK bergeser sedikit pun',
  sesudah.tulisanTab === sebelum.tulisanTab,
  `${sebelum.tulisanTab} → ${sesudah.tulisanTab}`);
c('tinggi isi layar TIDAK berubah (konten & scroll tetap)',
  sesudah.tinggiIsiLayar === sebelum.tinggiIsiLayar,
  `${sebelum.tinggiIsiLayar} → ${sesudah.tinggiIsiLayar}`);
// FAB Reminder 🔔 anak langsung SafeAreaView dengan bottom: 78 → patokannya
// tepi bawah kotak isi SafeAreaView (LAYAR - ruang aman), bukan tepi layar.
const fabBawah = LAYAR - inset - 78;
c('FAB Reminder (bottom: 78) tetap MELAYANG DI ATAS tab bar, tidak tertimpa',
  fabBawah < sesudah.atasTab, `tepi bawah FAB ${fabBawah} < atas tab ${sesudah.atasTab}`);
c('posisi FAB itu sama persis dengan sebelum diubah',
  sesudah.atasTab === sebelum.atasTab && fabBawah === LAYAR - inset - 78);
// Tanpa marginBottom negatif, tab bar akan naik & mendorong isi layar.
const tanpaTarikan = LAYAR - inset - (padTop + ISI_TAB + (8 + inset));
c('bukti tarikannya memang perlu: tanpa marginBottom negatif isi layar menyusut',
  tanpaTarikan < sebelum.tinggiIsiLayar,
  `${sebelum.tinggiIsiLayar} → ${tanpaTarikan}`);
c('…dan tanpa tarikan itu FAB malah menabrak tab bar',
  fabBawah > tanpaTarikan, `FAB ${fabBawah} vs atas tab ${tanpaTarikan}`);

console.log('\n=== Berlaku di SEMUA layar fitur bersub-tab ===');
// 22 Sep 2026: Walk (spiritual), CORE & Work (career) jadi TAB UTAMA — sub-tabnya
// pil di bawah pita (placement="top"), ruang aman bawah milik tab bar utama.
const LAYAR_SUBTAB = [
  'app/car.tsx', 'app/debts.tsx',
  'app/device.tsx', 'app/finance.tsx', 'app/fitness.tsx', 'app/fun.tsx',
  'app/games.tsx', 'app/health.tsx', 'app/investment.tsx', 'app/learning.tsx',
  'app/residence.tsx', 'app/friends.tsx',
  'app/tasks.tsx', 'app/news.tsx',
];
for (const f of ['app/(tabs)/walk.tsx', 'app/(tabs)/core.tsx', 'app/(tabs)/work.tsx']) {
  const src = baca(f);
  c(`${f.replace('app/', '')} — tab utama: sub-tab pil di atas & ruang aman bawah milik tab bar`,
    /<BottomTabs\s*\n\s*placement="top"/.test(src) && /edges=\{\['top'\]\}/.test(src));
}
c(`daftarnya masih lengkap (${LAYAR_SUBTAB.length} layar)`, (() => {
  const semua = fs.readdirSync(R + 'app')
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => /<BottomTabs/.test(baca('app/' + f)))
    .map((f) => 'app/' + f);
  return JSON.stringify(semua.sort()) === JSON.stringify([...LAYAR_SUBTAB].sort());
})());
for (const f of LAYAR_SUBTAB) {
  const src = baca(f);
  c(`${f.replace('app/', '')} — memakai BottomTabs bersama (bukan salinan sendiri)`,
    /<BottomTabs/.test(src) &&
      /from '@\/components\/common\/BottomTabs'/.test(src));
  c(`${f.replace('app/', '')} — ruang aman bawah memang dipesan SafeAreaView`,
    /edges=\{\['top', 'bottom'\]\}/.test(src));
}

console.log('\n=== Aturan wajib ===');
c('tidak ada modul native baru — safe-area-context sudah terpasang', (() => {
  const pkg = JSON.parse(baca('package.json'));
  return !!pkg.dependencies['react-native-safe-area-context'];
})());
c('tidak ada layar yang ikut diubah demi perbaikan ini', (() => {
  // Perbaikannya HARUS cukup di satu file; kalau tiap layar ikut diutak-atik,
  // risikonya jadi 16× lipat.
  return !LAYAR_SUBTAB.some((f) => /useSafeAreaInsets/.test(baca(f)));
})());
c('perilaku tab tidak disentuh (onChange tetap dipanggil walau tab sudah aktif)',
  /onPress=\{\(\) => onChange\(t\.key\)\}/.test(tabs));
// Bentuk badge-nya pindah ke <Badge> bersama; yang tetap milik tab bar cuma
// LETAKnya. Tepi putih (CONTAINER) itu bawaan <Badge>, jadi tab bar tak perlu
// menyebutkannya lagi — dan justru itu yang menjamin ia sama dengan yang lain.
c('badge tab tidak ikut berubah (bentuknya kini milik <Badge>)',
  /<Badge count=\{tab\.badge \?\? 0\} style=\{styles\.badge\} \/>/.test(tabs) &&
  /badge: \{ position: 'absolute', top: -6, right: -10 \}/.test(tabs) &&
  /ring = Color\.CONTAINER/.test(
    fs.readFileSync(R + 'components/common/Badge.tsx', 'utf8'),
  ));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
