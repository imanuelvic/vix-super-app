// Uji kecocokan tampilan di DUA alat yang dipakai: iPhone 15 & iPad 10th gen.
//
// Lebar teksnya diukur SUNGGUHAN dari berkas font Inter yang dipaketkan app
// ini (lihat ukur-teks.js), bukan ditebak "sekian piksel per huruf". Jadi
// kalau uji ini bilang "muat satu baris", itu memang perhitungan dari metrik
// fontnya, bukan perkiraan.
//
// Emoji tidak ada di Inter → di iOS jatuh ke Apple Color Emoji; lebarnya
// diperkirakan 1,20 em. Setiap judul yang mengandung emoji dilaporkan apa
// adanya supaya jelas mana angka pasti & mana yang mengandung perkiraan.
const AKAR = require('./akar');
const fs = require('fs');
const { ukur, ukurHeading } = require('./ukur-teks.js');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// Angka resmi kedua alat (titik, bukan piksel).
const ALAT = [
  { nama: 'iPhone 15', w: 393, h: 852, atas: 59, bawah: 34 },
  { nama: 'iPad 10th gen', w: 820, h: 1180, atas: 24, bawah: 20 },
];

// ===================== Header tiap layar =====================
console.log('=== Header: judul & subjudul muat? ===');
const header = baca('components/common/ScreenHeader.tsx');
c('subjudul dirender DI LUAR titleBox → dapat lebar penuh header',
  /\{right \? <View style=\{styles\.rightBox\}>\{right\}<\/View> : null\}\s*<\/View>\s*\{\/\*[\s\S]*?\*\/\}\s*\{subtitle \? \(\s*<VixText\s+heading="label"/
    .test(header));
c('judul tetap di dalam titleBox yang berbagi baris dengan tombol kanan',
  /<View style=\{styles\.titleBox\}>\s*<VixText heading="header"[\s\S]*?\{title\}[\s\S]*?<\/View>\s*\{right \?/
    .test(header));
c('paddingHorizontal header masih 20 & jarak titleRow 10',
  /header: \{ paddingHorizontal: 20/.test(header) &&
    /titleRow: \{[\s\S]*?gap: 10/.test(header));

// Sensus header dari sumbernya. Penutup elemen = "/>" pertama di kedalaman
// kurung kurawal 0 (kalau tidak, `right={<EmojiButton … />}` dikira penutup).
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(R + dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(dir + '/' + f.name);
    else if (f.name.endsWith('.tsx')) files.push(dir + '/' + f.name);
  }
})('app');

const headers = [];
for (const f of files) {
  const src = baca(f);
  for (const awal of [...src.matchAll(/<ScreenHeader\b/g)].map((x) => x.index)) {
    let depth = 0;
    let akhir = -1;
    for (let i = awal + 13; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (depth === 0 && ((ch === '/' && src[i + 1] === '>') ||
        (ch === '>' && src[i - 1] !== '/'))) { akhir = i; break; }
    }
    if (akhir === -1) continue;
    const blok = src.slice(awal + 13, akhir);
    // (?<![a-zA-Z]) supaya "subtitle=" tak tertangkap sebagai judul.
    const judul = blok.match(/(?<![a-zA-Z])title="([^"]*)"/);
    if (!judul) continue; // judul dinamis — tak bisa diukur dari sumber
    const sub = blok.match(/subtitle="([^"]*)"/);
    // Tombol yang bisa muncul BERSAMAAN = terbanyak dalam satu fragment <>…</>.
    let tombol = 0;
    if (/\bright=/.test(blok)) {
      const frag = [...blok.matchAll(/<>([\s\S]*?)<\/>/g)].map(
        (x) => (x[1].match(/<(EmojiButton|RewardButton|StreakPill)/g) || []).length,
      );
      tombol = frag.length ? Math.max(...frag) : 1;
    }
    headers.push({ file: f.replace('app/', ''), judul: judul[1], sub: sub?.[1] ?? null, tombol });
  }
}
c(`sensus header jalan (${headers.length} header berjudul tetap)`,
  headers.length >= 25);
c('layar dua tombol memang terdeteksi (Walk/spiritual & Health)', (() => {
  const dua = headers.filter((h) => h.tombol >= 2).map((h) => h.file);
  // 22 Sep 2026: Spiritual jadi tab Walk di dalam (tabs).
  return dua.includes('(tabs)/walk.tsx') && dua.includes('health.tsx');
})());

for (const alat of ALAT) {
  const isi = alat.w - 40; // paddingHorizontal 20 kiri-kanan
  let gagal = 0;
  let emojiTaksir = 0;
  for (const h of headers) {
    // Tombol kanan: 42pt tiap tombol + jarak 8, ditambah jarak titleRow 10.
    const kolomJudul = h.tombol ? isi - 10 - (h.tombol * 42 + (h.tombol - 1) * 8) : isi;
    const uj = ukurHeading(h.judul, 'header');
    emojiTaksir += uj.emoji;
    if (uj.lebar > kolomJudul) {
      gagal++;
      console.log(`      ✗ ${alat.nama} · ${h.file} judul "${h.judul}" ${Math.round(uj.lebar)}pt > ${Math.round(kolomJudul)}pt`);
    }
    if (h.sub) {
      const us = ukurHeading(h.sub, 'label');
      if (us.lebar > isi) {
        gagal++;
        console.log(`      ✗ ${alat.nama} · ${h.file} subjudul ${Math.round(us.lebar)}pt > ${isi}pt`);
      }
    }
  }
  c(`${alat.nama}: semua judul & subjudul muat satu baris`, gagal === 0,
    `${headers.length} header diperiksa, ${emojiTaksir} emoji ditaksir 1,2 em`);
}

// ===================== Subjudul Spiritual: ayat harian =====================
// 28 Agu 2026: subjudulnya bukan kalimat tetap lagi, melainkan salah satu ayat
// penyembahan yang berganti tiap hari — jadi tak bisa lagi dibaca dari sumber
// layarnya. Yang harus dijaga sekarang: SETIAP ayat di daftarnya muat satu
// baris, di iPhone 15 maupun iPad. Kalau ada satu saja yang pecah dua baris,
// tinggi headernya berubah di hari itu dan isi layarnya ikut turun.
console.log('\n=== Subjudul Spiritual: tiap ayat muat satu baris? ===');
{
  const spiritual = baca('lib/spiritual.ts');
  const blok = /export const WORSHIP_VERSES: string\[\] = \[([\s\S]*?)\n\];/.exec(spiritual);
  c('daftar ayatnya ketemu', !!blok);
  const ayat = [...(blok?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  c('jumlahnya masuk akal (≥ 10 supaya tidak cepat berulang)', ayat.length >= 10,
    `${ayat.length} ayat`);

  for (const alat of ALAT) {
    const isi = alat.w - 40;
    const pecah = ayat.filter((a) => ukurHeading(a, 'label').lebar > isi);
    c(`${alat.nama}: semua ayat muat satu baris`, pecah.length === 0,
      pecah.length
        ? pecah.map((a) => `${a} (${Math.round(ukurHeading(a, 'label').lebar)}pt > ${isi}pt)`).join(' | ')
        : `terlebar ${Math.round(Math.max(...ayat.map((a) => ukurHeading(a, 'label').lebar)))}pt ≤ ${isi}pt`);
  }

  // Bukti kalimat LAMA-nya memang butuh lebar penuh header (kalau ikut
  // menyempit di sebelah dua tombol, ia pecah dua baris di iPhone 15).
  const lama = 'Being with God, bukan sekadar doing for God';
  const kolomLama = 393 - 40 - 10 - (2 * 42 + 8);
  c('bukti: kalimat lamanya memang tak muat di kolom sempit',
    ukurHeading(lama, 'label').lebar > kolomLama,
    `butuh ${Math.round(ukurHeading(lama, 'label').lebar)}pt, kolom sempit ${kolomLama}pt`);
}

// ===================== Tulisan sub-tab bawah =====================
console.log('\n=== Sub-tab bawah: tulisannya muat? ===');
const tabScreens = files.filter((f) => /<BottomTabs/.test(baca(f)));
let tabGagal = 0;
const laporTab = [];
for (const f of tabScreens) {
  const src = baca(f);
  const arr = src.match(/BottomTab<[^>]*>\[\] = \[([\s\S]*?)\n\];/);
  if (!arr) continue;
  const labels = [...arr[1].matchAll(/label: '([^']*)'/g)].map((m) => m[1]);
  if (!labels.length) continue;
  for (const alat of ALAT) {
    const lebarTab = alat.w / labels.length; // tabBar tanpa padding samping
    for (const l of labels) {
      const u = ukur(l, 13, '500');
      const skala = lebarTab / u.lebar;
      if (skala < 1) laporTab.push(`${alat.nama} · ${f.replace('app/', '')} "${l}" ${Math.round(u.lebar)}pt di kolom ${Math.round(lebarTab)}pt (mengecil ×${skala.toFixed(2)})`);
      // adjustsFontSizeToFit menyusutkan sendiri; yang dianggap gagal cuma
      // kalau harus menyusut di bawah 0,85 (mulai terbaca beda sendiri).
      if (skala < 0.85) tabGagal++;
    }
  }
}
// 17 sejak fitur Device 📱 punya layarnya sendiri (Log · iPhone 15 · iPad).
c(`${tabScreens.length} layar bersub-tab diperiksa`, tabScreens.length === 17);
c('tak ada tulisan tab yang harus menyusut di bawah ×0,85', tabGagal === 0);
for (const l of laporTab) console.log(`      ℹ️ ${l}`);
c('tulisan tab memang disetel menyusut sendiri, bukan terpotong',
  /numberOfLines=\{1\}\s*adjustsFontSizeToFit/.test(baca('components/common/BottomTabs.tsx')));

// ===================== Ruang aman bawah =====================
console.log('\n=== Pita bawah sub-tab di kedua alat ===');
const tabs = baca('components/common/BottomTabs.tsx');
const gayaSrc = tabs.match(/styles\.tabBar,\s*(\{[^}]*\}),?\s*\]/);
const gayaOf = (bottom) => new Function('insets', `return ${gayaSrc[1]}`)({ bottom });
for (const alat of ALAT) {
  const g = gayaOf(alat.bawah);
  c(`${alat.nama} (ruang aman ${alat.bawah}pt): putihnya menutup penuh`,
    g.paddingBottom === 8 + alat.bawah && g.marginBottom === -alat.bawah,
    `padding ${g.paddingBottom}, margin ${g.marginBottom}`);
}
c('iPad 10th gen memang PUNYA home indicator (ruang aman bawah ≠ 0)',
  ALAT[1].bawah === 20);

// ===================== Lebar layar dibaca hidup, tidak beku =====================
console.log('\n=== Ukuran jendela dibaca hidup (penting di iPad) ===');
let beku = [];
for (const f of [...files, ...fs.readdirSync(R + 'components', { recursive: true })
  .filter((x) => String(x).endsWith('.tsx')).map((x) => 'components/' + String(x).replace(/\\/g, '/'))]) {
  const src = baca(f);
  // Dimensions.get di LUAR komponen = angkanya beku sejak modul dimuat.
  for (const m of src.matchAll(/^const .*Dimensions\.get\(/gm)) {
    beku.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
  }
}
c('tak ada lagi lebar layar yang dibekukan di luar komponen', beku.length === 0,
  beku.join(', ') || 'bersih');
c('Family Tree memakai useWindowDimensions',
  /const \{ width: windowWidth \} = useWindowDimensions\(\)/.test(baca('app/family.tsx')) &&
    /const anak = childRowSizes\(windowWidth\)/.test(baca('app/family.tsx')));

// Hitungan 5 kolom baris anak di kedua alat, memakai rumus dari kodenya.
const famSrc = baca('app/family.tsx').match(/function childRowSizes[\s\S]*?\n\}/)[0];
const childRowSizes = new Function(
  'CHILD_ROW_GAP',
  famSrc.replace(/^function/, 'return function').replace(/: number/g, ''),
)(8);
for (const alat of ALAT) {
  const s = childRowSizes(alat.w);
  const dipakai = s.col * 5 + 8 * 4;
  const tersedia = alat.w - 40 - 24;
  c(`${alat.nama}: 5 avatar anak muat sebaris`, dipakai <= tersedia,
    `${dipakai}pt dari ${tersedia}pt · kolom ${s.col}, avatar ${s.avatar}`);
  c(`${alat.nama}: avatar tidak mengecil di bawah 34pt (masih bisa dipencet)`,
    s.avatar >= 34, `${s.avatar}pt`);
}

// ===================== Grid fitur di Life =====================
// 22 Sep 2026: grid pindah dari Home ke tab Life (tanpa badge); aturan lebar
// & label satu barisnya sama.
console.log('\n=== Grid fitur Life ===');
const home = baca('app/(tabs)/life.tsx');
const grid = baca('lib/featureGrid.ts');
// Lebar kolomnya kini satu token bersama (assets/style/layout.ts), dipakai
// kepala & isi keempat layar berkolom tunggal.
const maxW = Number(baca('assets/style/layout.ts').match(/maxWidth: (\d+)/)[1]);
c('kolom tengah dipakai lewat CONTENT_COLUMN, bukan angka lepas di tiap layar',
  // 23 Sep 2026: Habits memakai <ScreenHeader/> (pita warna tile-nya), jadi
  // kolom tengahnya diurus header bersama, bukan di layarnya sendiri.
  ['app/(tabs)/index.tsx', 'app/(tabs)/life.tsx', 'app/reminders.tsx']
    .every((f) => /\.\.\.CONTENT_COLUMN,/.test(baca(f)) && !/maxWidth: 680/.test(baca(f))));
const persen = Number(home.match(/gridItem: \{ width: '([\d.]+)%'/)[1]);
const pillPad = Number(home.match(/tileLabelPill: \{[\s\S]*?paddingHorizontal: (\d+)/)[1]);
const labels = [...grid.matchAll(/label: '([^']*)',/g)].map((m) => m[1]);
c(`ketemu ${labels.length} tile & aturan lebarnya (${persen}%, maxWidth ${maxW})`,
  labels.length >= 18 && persen > 0 && maxW === 680);
c('nama tile disetel satu baris & mengecil sendiri kalau tak muat',
  /numberOfLines=\{1\}\s*adjustsFontSizeToFit\s*minimumFontScale=\{0\.85\}/.test(home));
for (const alat of ALAT) {
  const isiGrid = Math.min(maxW, alat.w) - 40;
  const tile = (isiGrid * persen) / 100;
  const muat = tile - pillPad * 2;
  const urut = labels
    .map((l) => ({ l, w: ukur(l, 13, '500').lebar }))
    .sort((a, b) => b.w - a.w);
  const terpanjang = urut[0];
  const skala = muat / terpanjang.w;
  c(`${alat.nama}: nama tile terpanjang ("${terpanjang.l}") tetap SATU baris`,
    skala >= 0.85,
    `${Math.round(terpanjang.w * 10) / 10}pt dari ${Math.round(muat * 10) / 10}pt` +
      (skala < 1 ? ` → mengecil ×${skala.toFixed(2)}` : ' → utuh 13pt'));
  // Yang muat TIDAK boleh ikut mengecil — kalau tidak, ukurannya jadi belang.
  const keduaTerpanjang = urut[1];
  c(`${alat.nama}: nama lain ("${keduaTerpanjang.l}" dst.) tetap 13pt penuh`,
    keduaTerpanjang.w <= muat,
    `${Math.round(keduaTerpanjang.w * 10) / 10}pt dari ${Math.round(muat * 10) / 10}pt`);
  c(`${alat.nama}: 4 tile + jarak muat sebaris`,
    tile * 4 + 16 * 3 <= isiGrid, `${Math.round(tile * 4 + 48)}pt dari ${isiGrid}pt`);
}

// ===================== Sheet modal =====================
console.log('\n=== Sheet modal ===');
const sheet = baca('components/common/SheetModal.tsx');
c('tinggi sheet mengikuti tinggi layar SAAT INI, bukan angka tetap',
  /const \{ height \} = useWindowDimensions\(\)/.test(sheet) &&
    /Math\.min\(height \* 0\.75, height - keyboardHeight - TOP_GAP\)/.test(sheet));
// Daftar pencapaian tidak lagi tinggal di dalam sheet (sudah jadi halaman
// sendiri), jadi yang disapu sekarang SEMUA daftar bertinggi tetap yang masih
// dipakai di dalam modal — bukan satu berkas yang kebetulan diingat.
const tinggiTetap = [];
(function sapu(dir) {
  for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
    if (e.isDirectory()) sapu(`${dir}/${e.name}`);
    else if (e.name.endsWith('.tsx')) {
      for (const m of baca(`${dir}/${e.name}`).matchAll(/maxHeight: (\d+)/g)) {
        tinggiTetap.push({ file: `${dir}/${e.name}`, h: Number(m[1]) });
      }
    }
  }
})('components');
const tertinggi = tinggiTetap.sort((a, b) => b.h - a.h)[0];
c('masih ada daftar bertinggi tetap yang perlu dijaga', !!tertinggi);
for (const alat of ALAT) {
  c(`${alat.nama}: daftar tertinggi di dalam sheet (${tertinggi.h}pt) masih muat`,
    tertinggi.h + 140 <= alat.h * 0.75,
    `${tertinggi.h + 140}pt dari ${Math.round(alat.h * 0.75)}pt — ${tertinggi.file}`);
}

// ===================== Aturan alat =====================
console.log('\n=== Setelan alat ===');
const appJson = JSON.parse(baca('app.json'));
c('iPad memang didukung (supportsTablet)', appJson.expo.ios.supportsTablet === true);
c('orientasi dikunci portrait — tata letak cuma perlu benar di satu arah',
  appJson.expo.orientation === 'portrait');

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
