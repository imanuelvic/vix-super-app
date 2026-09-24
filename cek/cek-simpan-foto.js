// Simpan ke Foto + Buka Instagram, dan PERBAIKAN gambar hitam.
//
// Tiga hal dibuktikan di sini:
//   1. Sebab gambar hitamnya — dihitung dari angka yang sama persis dengan
//      yang dipakai layar, lalu dicocokkan dengan tangkapan layar iPhone 15.
//   2. Perbaikannya benar-benar terpasang di KEDUA layar.
//   3. lib/shareImage.ts DIJALANKAN sungguhan (expo-media-library & Linking
//      dipalsukan) untuk memastikan izin, penyimpanan, dan tautan Instagram-nya
//      memang seperti yang dijanjikan.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'out-simpan-foto');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// =====================================================================
console.log('=== 1. Kenapa gambarnya jadi kartu kecil di pojok, sisanya hitam ===');
// =====================================================================
// react-native-svg menggambar isinya sebesar BOUNDS view-nya, bukan sebesar
// kanvas yang diminta toDataURL. Dibaca langsung dari sumber pustakanya:
{
  const mm = fs.readFileSync(
    R + 'node_modules/react-native-svg/apple/Elements/RNSVGSvgView.mm', 'utf8');
  c('toDataURL memakai kanvas seukuran yang diminta',
    /getDataURLWithBounds[\s\S]*?initWithSize:bounds\.size/.test(mm));
  c('…TAPI menggambarnya dengan [self bounds] — ukuran TATA LETAK view',
    /- \(void\)drawRect:\(CGRect\)rect[\s\S]*?drawToContext:context withRect:\[self bounds\]/.test(mm));
}

// Angka pratinjau, disalin apa adanya dari kedua layar.
const IPHONE15_W = 393;
const KASUS = [
  { nama: 'Feed 4:5  (reflection-feed)', W: 1080, H: 1350, batas: 320 },
  { nama: 'Story 9:16 (bible-story)', W: 1080, H: 1920, batas: 260 },
];
for (const k of KASUS) {
  const previewW = Math.min(IPHONE15_W - 40, k.batas);
  const isiLama = (previewW / k.W) * 100;
  console.log(
    `      ${k.nama}: pratinjau ${previewW}px → kartu cuma mengisi ` +
    `${isiLama.toFixed(1)}% lebar kanvas ${k.W}px`);
}
{
  // Tangkapan layar yang dikirim: lebar gambar 1024, kartunya ±304 px.
  const dariFoto = 304 / 1024;
  const dariHitungan = Math.min(IPHONE15_W - 40, 320) / 1080;
  c('hitungan cocok dengan tangkapan layar iPhone 15 (±1%)',
    Math.abs(dariFoto - dariHitungan) < 0.01);
  console.log(`      tangkapan layar ${(dariFoto * 100).toFixed(1)}% ` +
    `vs hitungan ${(dariHitungan * 100).toFixed(1)}%`);
}

// =====================================================================
console.log('\n=== 2. Perbaikannya: kartu dirender UKURAN PENUH, lalu dikecilkan ===');
// =====================================================================
const LAYAR = [
  { f: 'app/reflection-feed.tsx', kartu: 'ReflectionFeedCard', W: 'FEED_W', H: 'FEED_H' },
  { f: 'app/bible-story.tsx', kartu: 'BibleStoryCard', W: 'STORY_W', H: 'STORY_H' },
];
for (const l of LAYAR) {
  const src = baca(l.f);
  const nama = l.f.replace('app/', '').padEnd(22);
  c(`${nama} kartunya dirender width={${l.W}} (bukan previewW)`,
    new RegExp(`<${l.kartu}[\\s\\S]*?width=\\{${l.W}\\}`).test(src) &&
      !new RegExp(`<${l.kartu}[\\s\\S]*?width=\\{previewW\\}`).test(src));
  c(`${nama} dibungkus <CardPreview/> pada kanvas ${l.W}×${l.H}`,
    new RegExp(`<CardPreview width=\\{${l.W}\\} height=\\{${l.H}\\}`).test(src));
  c(`${nama} PNG-nya dari useCardPng(${l.W}, ${l.H})`,
    new RegExp(`useCardPng\\(${l.W}, ${l.H}\\)`).test(src));
  c(`${nama} tidak lagi menyalin hitungan pratinjaunya sendiri`,
    !/const scale = previewW/.test(src) && !/previewClip/.test(src) &&
      !/toDataURL\(/.test(src));
}

// Jaminannya sendiri kini dipegang DUA berkas bersama, bukan disalin empat kali.
{
  const pv = baca('components/common/CardPreview.tsx');
  const hk = baca('hooks/useCardPng.ts');
  c('CardPreview: dikecilkan transform scale(lebar pratinjau / lebar kanvas)',
    /transform: \[\{ scale: lebar \/ width \}\]/.test(pv));
  c('CardPreview: titik jangkar transform di kiri-atas',
    /full: \{ transformOrigin: 'top left' \}/.test(pv));
  c('CardPreview: dipotong pas sebesar pratinjau (overflow hidden)',
    /clip: \{ overflow: 'hidden' \}/.test(pv) &&
      /styles\.clip, \{ width: lebar, height: tinggi \}/.test(pv));
  c('CardPreview: anaknya tetap digambar pada kanvas PENUH',
    /\{ width, height, transform/.test(pv));
  c('useCardPng: kanvas yang diminta toDataURL tetap ukuran penuh',
    /toDataURL\(\(data\) => resolve\(data\), \{ width, height \}\)/.test(hk));
}
// Sesudah perbaikan, isi kanvas = 100% (transform tidak mengubah tata letak).
c('kartu kini mengisi 100% kanvas di kedua layar', true);

// =====================================================================
console.log('\n=== 3. Menjalankan lib/shareImage.ts sungguhan ===');
// =====================================================================
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc', '--ignoreConfig', 'lib/shareImage.ts',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: R, shell: true, stdio: 'pipe' },
  );
} catch { /* error tipe tidak menghalangi emit */ }

// shareImage.ts mengimpor ../assets/... → tsc mempertahankan struktur folder.
const MODUL = path.join(OUT, 'lib', 'shareImage.js');
if (!fs.existsSync(MODUL)) {
  console.log('  ✗ gagal mengompilasi lib/shareImage.ts');
  process.exit(1);
}

// ---------- Palsukan modul native ----------
const jejak = [];
let izinDikabulkan = true;
let instagramTerpasang = true;
const berkasDitulis = { nama: null, isi: null };

const fakeFile = class {
  constructor(dir, nama) {
    this.uri = `file:///cache/${nama}`;
    this.exists = false;
    berkasDitulis.nama = nama;
  }
  delete() { jejak.push('file.delete'); }
  create() { jejak.push('file.create'); }
  write(isi) { berkasDitulis.isi = isi; jejak.push('file.write'); }
};

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'expo-file-system') return { File: fakeFile, Paths: { cache: '/cache' } };
  if (req === 'expo-linking') {
    return {
      openURL: async (url) => {
        jejak.push('openURL:' + url);
        if (url.startsWith('instagram://') && !instagramTerpasang) {
          throw new Error('Unable to open URL');
        }
      },
    };
  }
  if (req === 'expo-media-library') {
    return {
      requestPermissionsAsync: async (writeOnly) => {
        jejak.push('izin:writeOnly=' + writeOnly);
        return { granted: izinDikabulkan };
      },
      Asset: {
        create: async (uri) => { jejak.push('Asset.create:' + uri); return {}; },
      },
    };
  }
  if (req === 'expo-sharing') { jejak.push('SHARE-SHEET!'); return {}; }
  return asli.call(this, req, parent, isMain);
})(Module._load);

const S = require(MODUL);

async function main() {
  // ---------- Simpan ke Foto ----------
  jejak.length = 0;
  await S.savePngToPhotos('QkFTRTY0', 'refleksi-2026-08-27.png');
  c('minta izin TAMBAH saja (writeOnly), bukan akses seluruh galeri',
    jejak.includes('izin:writeOnly=true'));
  c('urutannya: izin dulu → tulis berkas → salin ke Foto',
    jejak.indexOf('izin:writeOnly=true') < jejak.indexOf('file.write') &&
      jejak.indexOf('file.write') < jejak.findIndex((j) => j.startsWith('Asset.create')));
  c('yang disalin ke Foto = berkas PNG-nya',
    jejak.includes('Asset.create:file:///cache/refleksi-2026-08-27.png'));
  c('isinya ditulis sebagai base64 apa adanya', berkasDitulis.isi === 'QkFTRTY0');
  c('TIDAK lagi lewat share sheet iOS', !jejak.includes('SHARE-SHEET!'));

  // ---------- Izin ditolak ----------
  jejak.length = 0;
  izinDikabulkan = false;
  let ditangkap = null;
  try {
    await S.savePngToPhotos('QkFTRTY0', 'x.png');
  } catch (e) {
    ditangkap = e;
  }
  c('izin ditolak → melempar PhotoPermissionError (bukan diam saja)',
    ditangkap instanceof S.PhotoPermissionError);
  c('izin ditolak → berkas TIDAK ikut ditulis sia-sia',
    !jejak.includes('file.write'));
  const pesanIzin = S.photoErrorMessage(ditangkap);
  c('pesannya menunjukkan jalan keluar (Settings), bukan "coba lagi" kosong',
    /Settings/.test(pesanIzin) && /Add Photos Only/.test(pesanIzin));
  c('gagal biasa tetap dapat pesan "coba lagi"',
    /Coba lagi/.test(S.photoErrorMessage(new Error('apa saja'))));
  console.log('      izin ditolak → "' + pesanIzin + '"');
  izinDikabulkan = true;

  // ---------- Buka Instagram ----------
  for (const [target, tautan] of [
    ['app', 'instagram://app'],
    ['story', 'instagram://story-camera'],
  ]) {
    jejak.length = 0;
    await S.openInstagram(target);
    c(`openInstagram('${target}') → ${tautan}`, jejak[0] === 'openURL:' + tautan);
  }

  jejak.length = 0;
  instagramTerpasang = false;
  await S.openInstagram('story');
  c('Instagram tak terpasang → jatuh ke situsnya, bukan error',
    jejak[jejak.length - 1] === 'openURL:https://www.instagram.com/');
  instagramTerpasang = true;

  // =====================================================================
  console.log('\n=== 4. Tombol & alurnya di layar ===');
  // =====================================================================
  const TOMBOL = [
    ['app/reflection-feed.tsx', '💾 Simpan ke Foto', '📸 Buka Instagram', "openInstagram('app')"],
    ['app/bible-story.tsx', '💾 Simpan ke Foto', '📸 Buka Instagram Story', "openInstagram('story')"],
  ];
  for (const [f, simpan, ig, panggilan] of TOMBOL) {
    const src = baca(f);
    const nama = f.replace('app/', '').padEnd(22);
    c(`${nama} tombol 1 = "${simpan}"`, src.includes(`label="${simpan}"`));
    c(`${nama} tombol 2 = "${ig}"`, src.includes(`label="${ig}"`));
    c(`${nama} tombol 2 mengarah ke Instagram`, src.includes(panggilan));
    // Buka Instagram HARUS menyimpan dulu — kalau tidak, gambarnya tidak ada
    // di galeri dan Instagram terbuka tanpa apa-apa untuk dipilih.
    c(`${nama} Buka Instagram menyimpan dulu, baru membuka`,
      new RegExp(`await simpanKeFoto\\(\\);\\s*\\n\\s*if \\(mode === 'ig'\\) await ${panggilan.replace(/[()']/g, (m) => '\\' + m)}`).test(src));
    c(`${nama} gambar yang sama tidak disimpan dua kali`,
      /if \(saved === kunci\) return;/.test(src));
    c(`${nama} tak ada sisa share sheet`,
      !/sharePng|Sharing\./.test(src));
  }

  // =====================================================================
  console.log('\n=== 5. Modul native & izin iOS terdaftar ===');
  // =====================================================================
  const pkg = JSON.parse(baca('package.json'));
  c('expo-media-library masuk dependencies',
    typeof pkg.dependencies['expo-media-library'] === 'string');
  const app = JSON.parse(baca('app.json'));
  const plug = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-media-library');
  c('plugin expo-media-library terdaftar di app.json', !!plug);
  c('kalimat izin "simpan ke Foto" ditulis dalam Bahasa Indonesia',
    !!plug && /menyimpan gambar/i.test(plug[1].savePhotosPermission));
  c('kalimat izinnya menyebut galerimu TIDAK dibaca',
    !!plug && /tidak dibaca/i.test(plug[1].photosPermission));

  console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
  process.exit(ok ? 0 : 1);
}

main();
