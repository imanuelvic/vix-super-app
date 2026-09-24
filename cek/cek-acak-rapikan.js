// 14 Sep 2026, dua permintaan lanjutan:
//   11. Learning: "Ganti topik" langsung MENGACAK dari skill yang belum
//       tercentang, tanpa sheet.
//   12. CORE › Monthly: tombol "✨ Rapihkan dengan AI" (dulu "Rapikan jadi kesimpulan"), dikerjakan Claude
//       lewat Cloud Function (kunci di server, bukan di app).
//
// Yang dijalankan: aturan undiannya (dari lib/learning.ts), dan kompilasi
// function-nya terhadap SDK aslinya (tsc di functions/). Sisanya dipaku pada
// bentuk yang jadi inti keamanannya: kunci tak pernah di app, pemanggil
// diperiksa emailnya, region app = region function.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-acak-rapikan');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi lib/learning.ts ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(process.execPath, [
    R + 'node_modules/typescript/bin/tsc', '--ignoreConfig', R + 'lib/learning.ts',
    '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
    '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
  ], { stdio: 'pipe' });
} catch { /* keluhan tipe diabaikan */ }
const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({}), setDoc: async () => {},
      getDoc: async () => ({}), onSnapshot: () => () => {}, deleteField: () => {},
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) return { liveDoc: () => () => {} };
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);
const L = require(path.join(DIR, 'learning.js'));

// =====================================================================
console.log('=== 11. Topik diundi dari yang belum tercentang ===');
// =====================================================================
{
  const semua = L.SKILLS.map((s) => s.key);
  const kini = semua[0];
  // Tercentang semua KECUALI dua → undiannya cuma boleh jatuh ke dua itu.
  const done = Object.fromEntries(semua.filter((k) => k !== semua[3] && k !== semua[5]).map((k) => [k, '2026-09-01']));
  const hasil = new Set();
  for (let i = 0; i < 200; i++) hasil.add(L.drawWeekSkill(kini, done));
  c('hanya jatuh ke skill yang belum tercentang',
    [...hasil].every((k) => k === semua[3] || k === semua[5]), [...hasil].join(', '));
  c('kedua-duanya memang pernah terpilih (benar-benar acak)', hasil.size === 2);

  // Yang belum tercentang cuma topik yang SEDANG dipakai → tetap berganti.
  const doneKecualiKini = Object.fromEntries(semua.filter((k) => k !== kini).map((k) => [k, 'x']));
  const lain = new Set();
  for (let i = 0; i < 100; i++) lain.add(L.drawWeekSkill(kini, doneKecualiKini));
  c('tidak pernah jatuh ke topik yang sedang dipakai', !lain.has(kini));

  // Semua sudah tercentang → kolamnya semua kecuali yang sedang dipakai.
  const doneSemua = Object.fromEntries(semua.map((k) => [k, 'x']));
  c('semua tercentang → tetap berganti, tidak macet',
    L.drawWeekSkill(kini, doneSemua) !== null && L.drawWeekSkill(kini, doneSemua) !== kini);

  // Deterministik dengan random yang dioper: index = floor(r * n).
  c('random 0 → pilihan pertama di kolam', L.drawWeekSkill(kini, done, () => 0) === semua[3]);
  c('random 0.99 → pilihan terakhir di kolam', L.drawWeekSkill(kini, done, () => 0.99) === semua[5]);

  const tab = baca('components/learning/WeekTab.tsx');
  c('tombolnya langsung mengundi, tanpa sheet',
    /onPress=\{acakTopik\}/.test(tab) && !/SheetModal|SelectField|pickOpen/.test(tab));
  c('yang diundi memakai skill yang sedang dipakai & skillsDone',
    /drawWeekSkill\(skill\.key, skillsDone\)/.test(tab));
  c('tombol dikunci selagi menunggu Firestore', /disabled=\{mengacak\}/.test(tab));
  c('tetap hanya Senin (aturan lama tidak berubah)',
    /const bisaGanti = canChangeWeekSkill\(now\);/.test(tab) && /\{bisaGanti && \(/.test(tab));
  c('kata di tombolnya jujur: "Acak", bukan "Ganti"', /🔀 Acak topik minggu ini/.test(tab));
}

// =====================================================================
console.log('\n=== 12. Rapikan notulen (kini Firebase AI Logic + Gemini) ===');
// 14 Sep 2026: Cloud Function + Claude dilepas karena wajib Blaze (berbayar).
// Perilaku barunya diuji tuntas di cek-ai-gratis.js; di sini cuma dijaga
// bahwa sisa jalur lamanya benar-benar hilang.
{
  const klien = baca('lib/notulenAi.ts');
  // 14 Sep sore: form notulen pindah ke layar app/core/monthly/[id].tsx.
  const tab = baca('app/core/monthly/[id].tsx');
  c('lib/notulenAi.ts memakai firebase/ai, bukan firebase/functions',
    /from 'firebase\/ai'/.test(klien) && !/firebase\/functions/.test(klien));
  c('tidak ada functions/src, firebase.json, .firebaserc, .easignore',
    !fs.existsSync(R + 'functions/src') && !fs.existsSync(R + 'firebase.json') &&
      !fs.existsSync(R + '.firebaserc') && !fs.existsSync(R + '.easignore'));
  c('tombol ✨ tetap mengisi kolom, BUKAN menyimpan',
    /const rapi = await rapikanNotulen\(fPoints\);\s*\n\s*setFPoints\(\(prev\) => \(\{ \.\.\.prev, \.\.\.rapi \}\)\);/.test(tab) &&
      !/await rapikanNotulen[\s\S]{0,300}save\(/.test(tab));
  c('kosong semua → ditolak sebelum memanggil server',
    /Isi dulu catatannya, baru dirapikan\./.test(tab));
  c('kolom dikunci selagi merapikan', /editable=\{!busy && !merapikan\}/.test(tab));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
