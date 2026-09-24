// Dua permintaan:
//   1. "Play Duolingo" dapat pintasan ke aplikasi Duolingo (& jadi wajib);
//      jam dibuang dari nama Eat Mindfully & Take Fish Oil.
//   2. Wheel of Life: pertanyaan refleksi tambahan tiap area, muncul sebagai
//      gelembung yang naik ke atas — punyaku maupun punya CORE Leader.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-duolingo-bubble');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/habits.ts',
      R + 'lib/wheel.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

// Callback langganan ditangkap, jadi mapper aslinya (renamedHabit) bisa
// dijalankan sungguhan — bukan ditiru ulang di tes.
let terimaSnapshot = null;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      doc: (_db, ...seg) => seg.join('/'),
      setDoc: () => Promise.resolve(),
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      collection: () => {}, deleteDoc: () => {}, getDoc: () => {},
      getDocs: () => {}, onSnapshot: () => {}, orderBy: () => {},
      query: () => {}, where: () => {}, limit: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) {
    return {
      liveDoc: (_ref, onChange) => {
        terimaSnapshot = onChange;
        return () => {};
      },
    };
  }
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const hb = require(M('habits'));
const wl = require(M('wheel'));

const warna = baca('assets/style/color.ts');
const layar = baca('app/wheel.tsx');
const bubble = baca('components/wheel/ReflectionBubbles.tsx');

// WCAG: teks kecil butuh ≥ 4,5:1.
const kontras = (a, b) => {
  const lum = (h) => {
    const v = [1, 3, 5]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

console.log('\n== 1. Pintasan Duolingo ==');

const duo = hb.habitLink({ id: 'x', label: '🦉 Play Duolingo', slot: 'daytime' });
c('baris "Play Duolingo" punya pintasannya', duo !== null);
c('tulisannya "Buka Duolingo"', duo && duo.note === 'Buka Duolingo', duo && duo.note);
c('mengarah ke APLIKASI Duolingo, bukan situsnya',
  duo && duo.external && duo.external.scheme === 'duolingo://',
  duo && duo.external && duo.external.scheme);
c('belum terpasang → jatuh ke web (bukan click yang mati)',
  duo && /^https:\/\/www\.duolingo\.com/.test(duo.external.web),
  duo && duo.external && duo.external.web);
c('bukan pintu ke layar dalam app', duo && duo.route === undefined);

// Punya pintasan = wajib. Itu yang diminta: "seperti habits yang lain, ini
// habits wajib" — boleh diurutkan & dilewati sehari, tapi tak bisa dihapus.
c('jadi kebiasaan WAJIB (tombol hapusnya tidak ada)',
  hb.isFixedHabit({ id: 'x', label: '🦉 Play Duolingo', slot: 'daytime' }) === true);

// Membuka Duolingo ≠ menyelesaikan pelajarannya.
c('centangnya TETAP di-click sendiri, tidak otomatis saat dibuka',
  duo && !duo.doneOnOpen && duo.mirrorOf === undefined);
c('bukan baris cermin — lingkarannya tidak dikunci',
  hb.habitMirror({ id: 'x', label: '🦉 Play Duolingo', slot: 'daytime' }) === null);

// Namanya tidak boleh menyeret baris lain.
for (const lain of ['⚡ Drink Creatine', '📖 Midday Bible Reading', '🐟 Take Fish Oil']) {
  const l = hb.habitLink({ id: 'y', label: lain, slot: 'daytime' });
  c(`"${lain}" tidak ikut tertangkap aturan Duolingo`,
    !l || l.note !== 'Buka Duolingo');
}

const hexDuo = (warna.match(/DUOLINGO: '(#[0-9A-Fa-f]{6})'/) || [])[1];
c('warnanya terdaftar di palet, bukan hex liar di dalam kode',
  !!hexDuo && !/#58CC02/.test(baca('lib/habits.ts')), hexDuo);
// Hijau Duolingo asli (#58CC02) cuma 2,1:1 — terbaca sebagai logo, tidak
// sebagai teks kecil di baris kebiasaan.
c('terbaca di atas kartu putih & latar krem (WCAG AA ≥ 4,5)',
  hexDuo && kontras(hexDuo, '#FFFFFF') >= 4.5 && kontras(hexDuo, '#FDF6EC') >= 4.5,
  hexDuo && `${kontras(hexDuo, '#FFFFFF').toFixed(2)} / ${kontras(hexDuo, '#FDF6EC').toFixed(2)}`);

console.log('\n== 2. Jam dibuang dari namanya ==');

// Mapper ASLI-nya yang dijalankan (renamedHabit tidak diekspor).
let hasil = [];
hb.subscribeHabitSchedule('u1', (list) => { hasil = list; });
terimaSnapshot({
  data: () => ({
    habits: [
      { id: 'a', label: '🍽️ Eat Mindfully - Pk. 12.00', slot: 'daytime' },
      { id: 'b', label: '🐟 Take Fish Oil - 12.30', slot: 'daytime' },
      { id: 'c', label: '🦉 Play Duolingo', slot: 'daytime' },
      { id: 'd', label: '🥗 Eat Mindfully', slot: 'daytime' },
      { id: 'e', label: '⚡ Drink Creatine - 16.00', slot: 'daytime' },
    ],
  }),
});
const label = Object.fromEntries(hasil.map((h) => [h.id, h.label]));

// Emoji & tulisan yang KAMU pilih tetap seperti apa adanya — yang dibuang
// cuma ekor jamnya, jadi tak perlu menebak emoji apa yang dulu dipakai.
c('"- Pk. 12.00" hilang, emojinya tetap', label.a === '🍽️ Eat Mindfully', label.a);
c('"- 12.30" hilang juga (tanpa "Pk.")', label.b === '🐟 Take Fish Oil', label.b);
c('nama yang sudah bersih tidak berubah', label.d === '🥗 Eat Mindfully', label.d);
c('baris lain tidak ikut dipotong', label.c === '🦉 Play Duolingo', label.c);
c('Drink Creatine tetap memakai aturan lamanya (ganti nama utuh)',
  label.e === '⚡ Drink Creatine', label.e);
c('id-nya tidak disentuh — centang harian tetap nempel',
  hasil.length === 5 && hasil.every((h, i) => h.id === 'abcde'[i]));

console.log('\n== 3. Pertanyaan refleksi tiap area ==');

const AREA = wl.WHEEL_AREAS.map((a) => a.key);
c('kedelapan area punya pertanyaan refleksinya',
  AREA.every((k) => (wl.WHEEL_REFLECTIONS[k] || []).length >= 5),
  AREA.map((k) => (wl.WHEEL_REFLECTIONS[k] || []).length).join(','));
c('semuanya benar-benar PERTANYAAN (diakhiri tanda tanya)',
  AREA.every((k) => wl.WHEEL_REFLECTIONS[k].every((q) => q.trim().endsWith('?'))));

// "sesuai dengan ide dan tips yang anda kasih" — tiap pertanyaan berpasangan
// dengan satu tips di area yang sama, ditandai emoji yang sama & urutan sama.
const kepala = (s) => (s ?? '').split(' ')[0];
const takBerpasangan = [];
const tanpaTips = [];
for (const k of AREA) {
  const tips = wl.WHEEL_TIPS[k];
  wl.WHEEL_REFLECTIONS[k].forEach((q, i) => {
    // Pertanyaan ke-6 sementara tipsnya cuma 5 → pertanyaannya menyadarkan
    // tapi tidak ada jalan keluar yang ditawarkan untuk itu.
    if (i >= tips.length) tanpaTips.push(`${k}#${i} ${q}`);
    else if (kepala(q) !== kepala(tips[i])) takBerpasangan.push(`${k}#${i}`);
  });
}
c('tiap pertanyaan punya tips pasangannya (jumlahnya sama)',
  tanpaTips.length === 0, tanpaTips.join(' | '));
c('pasangannya senada (emoji & urutan sama)',
  takBerpasangan.length === 0, takBerpasangan.join(', '));

const semua = AREA.flatMap((k) => wl.WHEEL_REFLECTIONS[k]);
c('tidak ada pertanyaan yang terulang di area lain',
  new Set(semua).size === semua.length);
// Gelembungnya bulat & sempit; kalimat panjang membuatnya jadi kotak 4 baris.
const terpanjang = semua.reduce((a, b) => (b.length > a.length ? b : a));
c('kalimatnya pendek, muat di dalam gelembung', terpanjang.length <= 78,
  `${terpanjang.length} — ${terpanjang}`);
// Sasarannya kami generasi Z: semuanya menyapa langsung dengan "kamu"/"-mu",
// dan tak satu pun memakai "Anda".
c('menyapa "kamu"/"-mu", bukan "Anda"',
  semua.every((q) => /\bkamu\b|mu\b/i.test(q)) &&
  !semua.some((q) => /\banda\b/i.test(q)),
  semua.filter((q) => !/\bkamu\b|mu\b/i.test(q)).join(' | '));

console.log('\n== 4. Gelembungnya BACA-SAJA (2 Sep 2026) ==');

// Dulu satu click menurunkan pertanyaannya ke kolom catatan. Fiturnya dibuang:
// gelembungnya mengambang, dan sasaran yang bergerak itu sulit dikenai — click
// yang meleset terasa seperti app-nya rusak, padahal isinya cuma bahan renungan.
c('penolongnya ikut dibuang, bukan ditinggal jadi kode mati',
  wl.withReflection === undefined && wl.hasReflection === undefined);
c('tak ada sisa pemakainya di layar',
  !/withReflection|hasReflection/.test(layar));
// Yang dibuang JALAN PINTASNYA saja. Catatan tiap area tetap ada & tersimpan.
c('kolom catatan tiap area tetap ada & tersimpan',
  /value=\{draftNotes\[area\.key\] \?\? ''\}/.test(layar) &&
  /\[area\.key\]: t \}\)\)/.test(layar) &&
  /draftNotes,/.test(layar));

console.log('\n== 5. Gelembungnya naik ke atas ==');

c('naik: dari dasar kolam ke atas layar (angka mengecil)',
  /translateY: interpolate\(naik\.value, \[0, 1\], \[FIELD_H, -70\]\)/.test(bubble));
c('naiknya terus-menerus & berselang, bukan sekali lalu diam',
  /withRepeat\(\s*\n?\s*withSequence\(\s*\n?\s*withTiming\(1, \{ duration: RISE_MS, easing: Easing\.linear \}\),/.test(bubble) &&
  /withDelay\(\s*\n\s*index \* JEDA_MS,/.test(bubble));
// Dulu jedanya RISE_MS dibagi jumlah pertanyaan (±2,6 detik untuk lima) —
// tiga gelembung mengambang berbarengan dan tak satu pun sempat dibaca.
c('jarak berangkatnya TETAP, tidak mengecil kalau pertanyaannya bertambah',
  /const JEDA_MS = \d+;/.test(bubble) && !/RISE_MS\) \/ total/.test(bubble));
c('sesudah sampai atas ia MENUNGGU gilirannya, biar jaraknya tidak berantakan',
  /const tunggu = Math\.max\(0, total \* JEDA_MS - RISE_MS\);/.test(bubble) &&
  /withTiming\(1, \{ duration: tunggu \}\)/.test(bubble) &&
  // Balik ke dasar tanpa terlihat — kalau tidak, ia akan turun melintasi layar.
  /withTiming\(0, \{ duration: 0 \}\)/.test(bubble));
c('muncul & hilang perlahan di kedua ujung',
  /opacity: interpolate\(naik\.value, \[0, 0\.12, 0\.84, 1\], \[0, 1, 1, 0\]\)/.test(bubble));
c('ada goyangan kiri-kanan (mengambang, bukan digeser lurus)',
  /translateX: interpolate\(/.test(bubble));
c('yang di luar kolam dipotong', /overflow: 'hidden'/.test(bubble));
c('naiknya lambat supaya kalimatnya sempat dibaca sampai habis',
  /const RISE_MS = 13000;/.test(bubble));
c('tiga jalur bergantian supaya tidak saling menutupi',
  /const LANE = \[/.test(bubble) && /LANE\[index % LANE\.length\]/.test(bubble));

// --- Melebar sampai TEPI LAYAR ---
// Kolamnya membatalkan padding layarnya sendiri. Angkanya harus SAMA PERSIS:
// beda sedikit saja, gelembungnya berhenti di garis dalam yang tak kelihatan
// (kalau kurang) atau layarnya jadi bisa digeser ke samping (kalau lebih).
const padLayar = (bubble.match(/const PAD_LAYAR = (\d+);/) || [])[1];
const padWheel = (layar.match(/content: \{ paddingHorizontal: (\d+),/) || [])[1];
c('padding layarnya dibatalkan dengan angka yang sama persis',
  !!padLayar && padLayar === padWheel, `${padLayar} vs ${padWheel}`);
c('kolamnya benar-benar melebar keluar, bukan cuma dikomentari',
  /marginHorizontal: -PAD_LAYAR/.test(bubble));
c('gelembung tepi menyembul keluar layar lalu dipotong tepinya',
  /const SEMBUL = \d+;/.test(bubble) &&
  /alignItems: 'flex-start' as const, left: -SEMBUL/.test(bubble) &&
  /alignItems: 'flex-end' as const, right: -SEMBUL/.test(bubble));

// --- Baca-saja ---
c('tidak ada lagi yang bisa diklik di gelembungnya',
  !/PressableScale|onPress|onPick|taken|bubbleTaken/.test(bubble));
c('jari menembus begitu saja (tak ada tekanan yang tertelan)',
  /pointerEvents="none"/.test(bubble));
c('mengambangnya di pembungkus, gelembungnya View polos',
  /<Animated\.View\s*\n\s*style=\{\[styles\.slot, LANE\[index % LANE\.length\], gaya\]\}/.test(bubble) &&
  /<View style=\{styles\.bubble\}>/.test(bubble));
c('bukan state React — animasinya tidak memicu render',
  /useSharedValue\(0\)/.test(bubble) && !/useState/.test(bubble));
c('warnanya ikut warna fitur Wheel, bukan hex liar',
  /Color\.WHEEL\b/.test(bubble) && !/#[0-9A-Fa-f]{6}/.test(bubble));

console.log('\n== 6. Dipasang di layar penilaian ==');

c('gelembungnya muncul saat menilai, bukan di ringkasan',
  /<ReflectionBubbles/.test(layar) &&
  layar.indexOf('<ReflectionBubbles') > layar.indexOf("mode === 'assess'"));
// Gunanya menahan tangan SEBELUM angkanya dipilih — bukan membenarkan skor
// yang sudah terlanjur ditekan.
c('letaknya DI ATAS deretan nilai 1–10',
  layar.indexOf('<ReflectionBubbles') < layar.indexOf('Pilihan nilai 1–10'));
c('pertanyaannya ikut area yang sedang dinilai',
  /questions=\{WHEEL_REFLECTIONS\[area\.key\]\}/.test(layar));
c('dioper pertanyaannya SAJA — tak ada catatan & tak ada callback click',
  /<ReflectionBubbles questions=\{WHEEL_REFLECTIONS\[area\.key\]\} \/>/.test(layar));
// Satu layar dipakai dua pemilik (lihat cek-wheel-cl.js) — jadi tidak ada
// versi kedua yang harus dirawat sendiri.
c('berlaku untuk assessment-ku DAN CORE Leader (layarnya memang satu)',
  /const owner = params\.leaderId \|\| null;/.test(layar) &&
  !fs.existsSync(R + 'app/core-wheel.tsx'));
// Yang wajib tetap satu: skornya.
c('refleksinya tidak dipaksa — yang menahan "Lanjut" tetap skor kosong',
  /if \(!draftScores\[area\.key\]\) \{\s*\n\s*setAssessError\('Pilih nilai 1–10 dulu ya\.'\);/.test(layar) &&
  !/WHEEL_REFLECTIONS[\s\S]{0,200}setAssessError/.test(layar));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);