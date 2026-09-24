// Sembilan permintaan 14 Sep 2026:
//   1. Career › Selesai: urut tanggal terbaru di atas
//   2. "Hapus X ini" + Batal/Simpan dipatok di dasar SEMUA sheet
//   3. Wheel › Score per Area: catatan tampil utuh
//   4. Wheel › assessment: gelembung dibuang → tombol 💭 + modal pertanyaan
//   5. "—" dibuang dari semua teks yang TAMPIL (bukan komentar)
//   6. Finance: tombol 👁 naik ke baris bulan, ujung kanan
//   7. Finance › ✏️ Edit Transaction: sub-kategori DULU, baru catatan
//   8. Leaders: 🎡 & 📍 bergaris abu + gerbang PIN (PIN = Finance)
//   9. Race: jarak km, waktu jam·menit·detik, pace dihitung app
//
// Yang bisa DIJALANKAN dijalankan (pace, urutan, penjaga "—" lewat AST);
// sisanya dipaku pada bentuk yang memang jadi inti permintaannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const ts = require(AKAR + '/node_modules/typescript');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-sembilan-14sep');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi lib/fun.ts ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(process.execPath, [
    R + 'node_modules/typescript/bin/tsc', '--ignoreConfig', R + 'lib/fun.ts',
    '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
    '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
  ], { stdio: 'pipe' });
} catch { /* keluhan tipe diabaikan */ }
const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({}), setDoc: async () => {},
      getDoc: async () => ({}), onSnapshot: () => () => {},
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) return { liveDoc: () => () => {} };
  if (req === './photo' || req.endsWith('/photo')) return { pickCompressedImage: async () => null };
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);
const F = require(path.join(DIR, 'fun.js'));

// =====================================================================
console.log('=== 9. Race: pace dihitung, bukan diketik ===');
// =====================================================================
{
  c('1j 25m 30d → 5130 detik', F.toFinishSec(1, 25, 30) === 5130);
  c('kolom kosong/ngawur dihitung 0', F.toFinishSec(NaN, 25, undefined) === 1500);
  const s = F.splitFinishSec(5130);
  c('5130 detik → 1j 25m 30d (bolak-balik utuh)', s.h === 1 && s.m === 25 && s.s === 30);
  c('format: "1j 25m 30d"', F.formatFinish(5130) === '1j 25m 30d', F.formatFinish(5130));
  c('detik 0 tidak ditulis: "1j 25m"', F.formatFinish(5100) === '1j 25m', F.formatFinish(5100));
  c('tanpa jam: "25m 30d"', F.formatFinish(1530) === '25m 30d');
  c('cuma detik: "45d"', F.formatFinish(45) === '45d');
  c('0 → kosong (tidak tampil)', F.formatFinish(0) === '');

  // 10K dalam 1j 25m 30d → 513 dtk/km → 8'33"/km
  const p = F.racePace(5130, 10);
  c('pace 10K/5130d = 513 detik per km', p === 513, p);
  c('ditulis 8\'33"/km', F.formatPace(513) === '8\'33"/km', F.formatPace(513));
  c('detik pace <10 diberi nol di depan: 5\'05"', F.formatPace(305) === '5\'05"/km');
  c('tanpa jarak → pace null (bukan Infinity)', F.racePace(5130, 0) === null);
  c('tanpa waktu → pace null', F.racePace(0, 10) === null);
  c('21,1 km dalam 2j → 5\'41"/km', F.formatPace(F.racePace(7200, 21.1)) === '5\'41"/km',
    F.formatPace(F.racePace(7200, 21.1)));

  // Data LAMA (menit saja) tetap terbaca — tidak ada migrasi.
  c('entri lama finishMinutes: 85 → 5100 detik', F.raceFinishSec({ finishMinutes: 85 }) === 5100);
  c('entri baru finishSec menang atas finishMinutes',
    F.raceFinishSec({ finishSec: 5130, finishMinutes: 85 }) === 5130);
  c('keduanya kosong → 0', F.raceFinishSec({}) === 0);

  const layar = baca('components/fun/FunEntryScreen.tsx');
  c('yang disimpan finishSec & distanceKm, bukan lagi finishMinutes',
    /next\.finishSec = finishSec;/.test(layar) && /next\.distanceKm = parseDecimal\(distance\);/.test(layar) &&
      !/next\.finishMinutes/.test(layar));
  c('pace tampil live di form', /🏃 Pace \$\{formatPace\(pace\)\}/.test(layar));
  const arsip = baca('components/fun/FunArchive.tsx');
  c('kartu Race menampilkan km, waktu, & pace', /📏 \$\{formatDecimal\(item\.distanceKm\)\} km/.test(arsip) &&
    /🏃 \$\{formatPace\(paceItem\)\}/.test(arsip));
}

// =====================================================================
console.log('\n=== 5. Tak ada "—" di teks yang tampil (dijaga lewat AST) ===');
// =====================================================================
{
  // Komentar penuh "—" dan itu memang boleh: tidak tampil ke siapa pun. Yang
  // dijaga: string literal, template literal, teks JSX.
  const berkas = [];
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('app');
  for (const d of ['components', 'lib', 'hooks', 'contexts']) {
    (function sisir(dir) {
      for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
        const p = dir + '/' + e.name;
        if (e.isDirectory()) sisir(p);
        else if (/\.tsx?$/.test(e.name)) berkas.push(p);
      }
    })(d);
  }
  const pelanggar = [];
  for (const f of berkas) {
    const src = baca(f);
    if (!src.includes('—')) continue;
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true,
      f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    (function kunjung(n) {
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ||
           ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ||
           ts.isJsxText(n)) && n.getText(sf).includes('—')) {
        pelanggar.push(f);
      }
      ts.forEachChild(n, kunjung);
    })(sf);
  }
  c('nol "—" di string / template / teks JSX seluruh app',
    pelanggar.length === 0, pelanggar.length ? [...new Set(pelanggar)].join(', ') : `${berkas.length} berkas bersih`);

  // Contoh yang paling dipedulikan pemilik: ucapan ke CORE & ulang tahun.
  const core = baca('lib/core.ts');
  const chat = baca('lib/chatTemplates.ts');
  c('templat ucapan ulang tahun & pesan CORE bebas "—"',
    !/—/.test(core.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) &&
      !/—/.test(chat.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
  // Ayat: acuannya dalam kurung, bukan "koma Kitab N:N" yang janggal.
  const sp = baca('lib/spiritual.ts');
  c('acuan ayat dalam kurung: (Yoh 14:27)', /\(Yoh 14:27\)/.test(sp) && /\(Yohanes 4:24\)/.test(sp));
}

// =====================================================================
console.log('\n=== 1. Career › Selesai: terbaru di atas ===');
// =====================================================================
{
  const tab = baca('components/career/FulltimeTab.tsx');
  const m = tab.match(/if \(a\.status === 'done'\) \{\s*\n\s*return (.+);/);
  c('aturan urut kolom Selesai terbaca', !!m, m?.[1]);
  if (m) {
    const banding = new Function('a', 'b', `return ${m[1]};`);
    const t = (ms) => ({ status: 'done', deadline: { toMillis: () => ms } });
    c('tanggal lebih baru → di atas (negatif)', banding(t(200), t(100)) < 0);
    c('tanggal lebih lama → di bawah', banding(t(100), t(200)) > 0);
    c('tanpa tanggal → paling bawah', banding({ status: 'done', deadline: null }, t(100)) > 0);
  }
  c('kolom lain tetap urut prioritas', /return a\.priority - b\.priority;/.test(tab));
}

// =====================================================================
console.log('\n=== 2. Sheet: hapus + Batal/Simpan dipatok di dasar ===');
// =====================================================================
{
  const sheet = baca('components/common/SheetModal.tsx');
  c('EditFooter, EditDelete, InlineDelete dikenali sebagai bar aksi',
    /c\.type === DualButtons \|\|\s*\n\s*c\.type === EditFooter \|\|\s*\n\s*c\.type === EditDelete \|\|\s*\n\s*c\.type === InlineDelete/.test(sheet));
  c('yang dikenali dikeluarkan dari isi yang digulung',
    /const contentKids = kids\.filter\(\(c\) => !autoBar\.includes\(c\)\);/.test(sheet));
  c('footer eksplisit tetap menang', /footer != null\s*\n?\s*\? \[\]/.test(sheet));
}

// =====================================================================
console.log('\n=== 3 & 4. Wheel ===');
// =====================================================================
{
  const w = baca('app/wheel.tsx');
  c('catatan area tidak lagi dipotong 2 baris',
    /\{note \? <VixText heading="label">\{note\}<\/VixText> : null\}/.test(w) &&
      !/numberOfLines=\{2\}/.test(w));
  c('gelembung refleksi dibuang (berkas & impornya)',
    !fs.existsSync(R + 'components/wheel/ReflectionBubbles.tsx') && !/ReflectionBubbles/.test(w));
  c('gantinya tombol 💭 di atas deretan nilai',
    /💭 Lihat pertanyaan refleksi/.test(w) && /onPress=\{\(\) => setReflectOpen\(true\)\}/.test(w));
  c('modal berisi pertanyaan area yang sedang dinilai',
    /<CenterDialog visible=\{reflectOpen\}/.test(w) && /WHEEL_REFLECTIONS\[area\.key\]\.map\(\(q\)/.test(w));
}

// =====================================================================
console.log('\n=== 6 & 7. Finance ===');
// =====================================================================
{
  const fin = baca('app/finance.tsx');
  const tx = baca('components/finance/TransactionsTab.tsx');
  const hook = baca('hooks/useAmountsHidden.ts');
  c('👁 di baris bulan, ujung kanan (space-between)',
    /\{tab === 'transactions' && \(\s*\n\s*<PressableScale onPress=\{toggleAmountsHidden\}/.test(fin) &&
      /topBar: \{[\s\S]*?justifyContent: 'space-between'/.test(fin));
  c('pilihannya tetap tersimpan di HP (kunci yang sama)', /'finance:amountsHidden'/.test(hook));
  c('TransactionsTab tidak lagi punya tombol mata / AsyncStorage sendiri',
    !/AsyncStorage|toggleAmountsHidden|eye\.slash/.test(tx) && /amountsHidden: boolean;/.test(tx));
  // ✏️ Edit Transaction: sub-kategori DULU, baru catatan.
  const iSub = tx.indexOf('options={editingSubs.map(');
  const iNote = tx.indexOf("placeholder=\"Catatan\"\n          value={editNote}");
  c('sheet edit: sub-kategori di atas catatan', iSub > -1 && iNote > -1 && iSub < iNote);
}

// =====================================================================
console.log('\n=== 8. Leaders: 🎡 & 📍 berpintu PIN ===');
// =====================================================================
{
  const pin = baca('lib/pin.ts');
  c('SATU PIN untuk semua gerbang: 9811 di lib/pin.ts', /export const PRIVACY_PIN = '9811';/.test(pin));
  for (const f of ['app/finance.tsx', 'app/wheel.tsx', 'app/timeline.tsx']) {
    const isi = baca(f);
    c(`${f} memakai PRIVACY_PIN (bukan angka sendiri)`,
      /pin=\{PRIVACY_PIN\}/.test(isi) && !/'9811'/.test(isi));
  }
  for (const f of ['app/wheel.tsx', 'app/timeline.tsx']) {
    const isi = baca(f);
    c(`${f}: milik CL terkunci, milikku tidak`, /useState\(owner === null\)/.test(isi));
    c(`${f}: Firestore belum dibaca selama terkunci`, /when: unlocked \}/.test(isi) && !/if \(!user \|\| !unlocked\) return;/.test(isi)); // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
    c(`${f}: Batal → kembali`, /onCancel=\{\(\) => router\.back\(\)\}/.test(isi));
  }
  const leaders = baca('components/core/LeadersTab.tsx');
  c('🎡 & 📍 bertanda locked; ✏️ & 🧍 tidak',
    /emoji="🎡"\s*\n\s*locked/.test(leaders) && /emoji="📍"\s*\n\s*locked/.test(leaders) &&
      !/emoji="🧍"[^/]*locked/.test(leaders));
  const eb = baca('components/common/EmojiButton.tsx');
  c('locked → garis tepi abu', /locked \? Color\.TEXT_PLACEHOLDER : theme\.fg/.test(eb));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
