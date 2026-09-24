// Jarak tombol aksi diseragamkan: satu <ActionStack/> + dua angka bersama
// (ACTION_TOP / ACTION_GAP), plus tombol Share ke WhatsApp yang tadinya
// ditulis tangan dua kali.
//
// ActionStack & ShareWhatsAppButton DIJALANKAN di atas tiruan JSX (jsx() →
// objek biasa), jadi yang diuji jarak & prop yang benar-benar digambar.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-jarak-tombol');
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
      R + 'assets/style/space.ts',
      R + 'components/common/ActionStack.tsx',
      R + 'components/common/ShareWhatsAppButton.tsx',
      R + 'lib/habits.ts',
      '--outDir', OUT,
      '--jsx', 'react-jsx',
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan — yang dicari perilakunya */ }

const cari = (...kandidat) => {
  for (const k of kandidat) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  return null;
};
const MOD_SPACE = cari('assets/style/space.js', 'space.js');
const MOD_STACK = cari('components/common/ActionStack.js', 'ActionStack.js');
const MOD_WA = cari('components/common/ShareWhatsAppButton.js', 'ShareWhatsAppButton.js');
const MOD_HABITS = cari('lib/habits.js', 'habits.js');
if (!MOD_SPACE || !MOD_STACK || !MOD_WA || !MOD_HABITS) {
  console.log('  ✗ gagal mengompilasi berkasnya');
  process.exit(1);
}

// ---------- Tiruan JSX & modul ----------
const jsx = (type, props) => ({ type, props });
const StyleSheet = { create: (o) => o, flatten: (s) => Object.assign({}, ...[s].flat(99).filter(Boolean)) };

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: Symbol('F') };
  if (req === 'react-native') return { StyleSheet, View: 'View' };
  if (/PrimaryButton$/.test(req)) return { PrimaryButton: 'PrimaryButton' };
  if (/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/assets\/style\/space$/.test(req)) return require(MOD_SPACE);
  if (req === 'firebase/firestore') return {};
  if (/\.\/firebase$/.test(req)) return { db: {} };
  if (/\.\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const { ACTION_TOP, ACTION_GAP } = require(MOD_SPACE);
const { ActionStack } = require(MOD_STACK);
const { ShareWhatsAppButton } = require(MOD_WA);
const { habitLink } = require(MOD_HABITS);

// =====================================================================
console.log('=== 1. Dua angka, dua peran ===');
// =====================================================================
{
  c('ACTION_TOP = 18 (jarak dari isi di atasnya)', ACTION_TOP === 18, String(ACTION_TOP));
  c('ACTION_GAP = 10 (jarak antar tombol)', ACTION_GAP === 10, String(ACTION_GAP));
  // Perannya beda: yang memisahkan bacaan dari aksi memang harus lebih lega
  // daripada yang memisahkan tombol dari tombol.
  c('jarak dari isi LEBIH LEGA daripada jarak antar tombol', ACTION_TOP > ACTION_GAP);
}

// =====================================================================
console.log('\n=== 2. ActionStack yang memegang jaraknya ===');
// =====================================================================
{
  const hasil = ActionStack({ children: ['A', 'B'] });
  const gaya = StyleSheet.flatten(hasil.props.style);
  c('menggambar satu View', hasil.type === 'View', String(hasil.type));
  c('marginTop-nya ACTION_TOP', gaya.marginTop === ACTION_TOP, String(gaya.marginTop));
  c('gap-nya ACTION_GAP', gaya.gap === ACTION_GAP, String(gaya.gap));
  c('anak-anaknya diteruskan apa adanya',
    JSON.stringify(hasil.props.children) === '["A","B"]');
  // Inti kenapa jaraknya dipegang wadahnya: tombol yang muncul-hilang tidak
  // meninggalkan lubang. Dengan `gap`, anak yang null memang tidak dihitung.
  const sumber = baca('components/common/ActionStack.tsx');
  const badan = sumber.slice(sumber.indexOf('export function ActionStack'));
  c('tak ada margin per-tombol di dalamnya — cuma marginTop + gap wadahnya',
    !/marginBottom/.test(badan) &&
      (badan.match(/marginTop/g) ?? []).length === 1 &&
      (badan.match(/gap:/g) ?? []).length === 1);
}

// =====================================================================
console.log('\n=== 3. Tombol Share ke WhatsApp — satu bentuk, bukan dua ===');
// =====================================================================
// Dulu ditulis tangan di Revive (tinggi 12) & Khotbah (tinggi 14). Sekarang
// PrimaryButton biasa, jadi bentuknya persis sama dengan tombol di sebelahnya.
{
  const jejak = [];
  const el = ShareWhatsAppButton({ onPress: () => jejak.push('share') });
  c('memakai PrimaryButton yang sama dengan tombol lain',
    el.type === 'PrimaryButton', String(el.type));
  c('bunyinya "💬 Share ke WhatsApp"',
    el.props.label === '💬 Share ke WhatsApp', el.props.label);
  c('warnanya hijau WhatsApp', el.props.background === 'Color.WHATSAPP',
    el.props.background);
  c('onPress diteruskan', (() => { el.props.onPress(); return jejak.join() === 'share'; })());
  c('tanpa margin sendiri — jaraknya milik ActionStack',
    el.props.additionalStyle === undefined);
}

// =====================================================================
console.log('\n=== 4. Syaratnya: elemen di ATAS stack tanpa marginBottom ===');
// =====================================================================
// Kalau elemen tepat di atasnya masih punya marginBottom, keduanya dijumlahkan
// dan jaraknya diam-diam jadi lebih lebar dari layar lain. Ini yang dulu
// terjadi di Catatan Khotbah (16 + 4 = 20) dan justru TIDAK terjadi di Catatan
// Revive (0) — dua-duanya meleset, ke arah berlawanan.
{
  const kasus = [
    ['app/revive.tsx', 'mediumInput', 'kolom Aplikasi (mode tulis)'],
    ['app/revive.tsx', 'bacaBlok', 'blok bacaan (mode arsip)'],
    ['app/sermon.tsx', 'readCol', 'kolom bacaan Catatan Khotbah'],
    ['app/bible-story.tsx', 'chipWrap', 'baris pilihan style'],
    ['app/reflection-feed.tsx', 'chipWrap', 'baris pilihan style'],
  ];
  for (const [f, kunci, apa] of kasus) {
    const s = baca(f);
    const i = s.indexOf(`  ${kunci}: `);
    const blok = i < 0 ? null : s.slice(i, s.indexOf('\n  }', i) > i && s.indexOf('\n  }', i) < s.indexOf('},\n', i) ? s.indexOf('\n  }', i) : s.indexOf('},\n', i) + 2);
    c(`${f} · ${apa} tanpa marginBottom`,
      blok !== null && !/marginBottom/.test(blok), blok === null ? 'gaya tak ditemukan' : '');
  }
}

// =====================================================================
console.log('\n=== 5. Layar yang ikut memakainya ===');
// =====================================================================
{
  const PAKAI = [
    'app/revive.tsx',
    'app/sermon.tsx',
    'app/bible-story.tsx',
    'app/reflection-feed.tsx',
  ];
  const kurang = PAKAI.filter((f) => {
    const s = baca(f);
    return !/<ActionStack>/.test(s) ||
      !/import \{ ActionStack \} from '@\/components\/common\/ActionStack';/.test(s);
  });
  c('4 layar memakai ActionStack', kurang.length === 0, kurang.join(', '));

  // Tombol WA yang ditulis tangan sudah tidak ada lagi di kedua layarnya.
  const sisaWa = ['app/revive.tsx', 'app/sermon.tsx'].filter((f) =>
    /waButton|Color\.WHATSAPP/.test(baca(f)));
  c('tak ada lagi tombol WhatsApp yang ditulis tangan',
    sisaWa.length === 0, sisaWa.join(', '));
  const pakaiWa = ['app/revive.tsx', 'app/sermon.tsx'].filter((f) =>
    /<ShareWhatsAppButton/.test(baca(f)));
  c('keduanya memakai komponen bersamanya', pakaiWa.length === 2,
    `${pakaiWa.length}/2`);

  // Angka jarak lama tidak boleh tertinggal sebagai gaya menganggur.
  const sisaGaya = ['app/bible-story.tsx', 'app/reflection-feed.tsx'].filter((f) =>
    /actionTop:|\n  action: /.test(baca(f)));
  c('gaya actionTop/action lama sudah dibuang', sisaGaya.length === 0,
    sisaGaya.join(', '));

  // ConnectCoreButton berdiri DI DALAM stack → tidak boleh punya jarak sendiri.
  const cc = baca('components/spiritual/ConnectCoreButton.tsx');
  // Komentarnya dibuang dulu — penjelasan "tanpa marginTop sendiri" di dalam
  // gaya itu sendiri memuat kata yang dicari.
  const tombol = cc
    .slice(cc.indexOf('  button: {'), cc.indexOf('  buttonText'))
    .replace(/^\s*\/\/.*$/gm, '');
  c('ConnectCoreButton tanpa marginTop sendiri', !/marginTop/.test(tombol));

  // Yang memakai angkanya langsung (bukan lewat ActionStack) tetap mengambil
  // dari sumber yang sama, bukan menuliskan 18/10 lagi.
  for (const f of ['app/fasting.tsx', 'components/spiritual/MorningJourney.tsx']) {
    c(`${f} mengambil angkanya dari assets/style/space`,
      /from '@\/assets\/style\/space'/.test(baca(f)));
  }
}

// =====================================================================
console.log('\n=== 6. Nama baris kebiasaan yang baru tetap punya pintasan ===');
// =====================================================================
// "Share Revive ke WAG" & "Share Revive ke Instastory" sama-sama memuat kata
// "revive" — yang membedakan tujuannya cuma kata terakhirnya.
{
  const tuju = (label) => {
    const l = habitLink({ id: 'x', label, slot: 'morning' });
    return l ? (l.route ? l.route.pathname : l.external ? l.external.scheme : '?') : null;
  };
  c('"📱 Share Revive ke WAG" → Spiritual › Revive',
    tuju('📱 Share Revive ke WAG') === '/walk', String(tuju('📱 Share Revive ke WAG')));
  c('"📱 Share Revive ke Instastory" → aplikasi Instagram',
    tuju('📱 Share Revive ke Instastory') === 'instagram://app',
    String(tuju('📱 Share Revive ke Instastory')));
  // Nama lamanya jangan sampai ikut rusak — data lama masih memakainya sampai
  // barisnya benar-benar diganti nama.
  c('nama lama "Share Revive ke WA CORE" masih dikenali',
    tuju('📱 Share Revive ke WA CORE') === '/walk');
  c('nama lama "Revive + IG Story" masih dikenali',
    tuju('✝️ Revive + IG Story ➡️📱') === 'instagram://app');
  // Instastory diperiksa DULUAN — kalau tidak, "Share Revive ke Instastory"
  // jatuh ke aturan Revive dan malah membuka Spiritual.
  c('urutannya benar: Instagram sebelum Revive',
    tuju('Share Revive ke Instastory') === 'instagram://app');
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);