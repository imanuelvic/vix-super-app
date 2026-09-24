// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Bukti fitur Daily Reflection Journal 📓 → gambar Instagram Feed 4:5
// (vixtory.archive). lib/reflectionFeed.ts dijalankan BENERAN.
//
// Yang paling penting diuji: MAKNA TULISAN TIDAK BOLEH BERUBAH.

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(os.tmpdir(), 'cek-jurnal-out');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const kodeSaja = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------- compile & jalankan ----------
try {
  execFileSync(
    'npx',
    [
      'tsc',
      path.join(ROOT, 'lib/reflectionFeed.ts'),
      '--ignoreConfig',
      '--outDir',
      OUT,
      '--module',
      'commonjs',
      '--target',
      'es2020',
      '--skipLibCheck',
      '--esModuleInterop',
      '--moduleResolution',
      'bundler',
    ],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch {
  // tipe modul native mengeluh — .js-nya tetap ditulis.
}

const aslinya = Module._load;
Module._load = function (permintaan, induk, isMain) {
  if (permintaan === './firebase') return { db: {} };
  if (permintaan === './liveDoc') return { liveDoc: () => () => {} };
  if (permintaan.endsWith('assets/style/color')) {
    return { Color: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) };
  }
  if (permintaan.startsWith('firebase/')) {
    return { doc: () => ({}), setDoc: async () => {}, serverTimestamp: () => null };
  }
  if (/^expo-|^@react-native|^react-native/.test(permintaan)) return {};
  return aslinya(permintaan, induk, isMain);
};
// Berkasnya mengimpor ../assets/style/color, jadi tsc mempertahankan struktur
// foldernya → hasilnya di OUT/lib/, bukan langsung di OUT/.
const F = require(path.join(OUT, 'lib', 'reflectionFeed.js'));
Module._load = aslinya;

// ================= 1. Ukuran Feed, bukan Story =================
ok('lebar 1080', F.FEED_W === 1080);
ok('tinggi 1350', F.FEED_H === 1350);
ok('perbandingannya TEPAT 4:5', F.FEED_W / F.FEED_H === 4 / 5);
ok('bukan lagi 9:16 (Story)', F.FEED_H !== 1920);
ok('nama arsipnya vixtory.archive', F.ARCHIVE_NAME === 'vixtory.archive');

// ================= 2. MAKNA TULISAN TIDAK BERUBAH =================
// Aturan: gabungan semua baris harus mengandung kata-kata yang SAMA PERSIS,
// dengan urutan yang sama. Tidak ada kata hilang, tertambah, atau tertukar.
const contoh = [
  'Tuhan menolong saya hari ini lewat hal yang paling kecil.',
  'Belajar sabar.\nBukan karena mudah, tapi karena Dia yang menyuruh.',
  'Hari ini berat sekali, tapi saya tetap memilih percaya bahwa rencana-Nya lebih baik daripada rencana saya sendiri, walaupun sekarang belum kelihatan sama sekali.',
  'Satu   kalimat    dengan  spasi   berlebih.',
  'Iman, pertumbuhan, dan tujuan — tiga hal yang saya renungkan pagi ini.',
];
for (const teks of contoh) {
  const kataAsli = teks.trim().split(/\s+/);
  for (const maxChars of [18, 26, 31, 47, 56]) {
    const kataHasil = F.wrapLines(teks, maxChars).join(' ').split(/\s+/);
    ok(
      `kata utuh & urut (maxChars ${maxChars}) — "${teks.slice(0, 24)}…"`,
      kataHasil.join('|') === kataAsli.join('|'),
      kataHasil.join(' ').slice(0, 60),
    );
  }
}
// Tak ada baris yang melebihi lebar yang diminta.
for (const teks of contoh) {
  for (const maxChars of [18, 31, 56]) {
    ok(
      `tak ada baris melebihi ${maxChars} huruf`,
      F.wrapLines(teks, maxChars).every((b) => b.length <= maxChars),
    );
  }
}
// Kata super panjang (tautan) terpaksa dipotong, tapi hurufnya tetap utuh.
{
  const tautan = 'https://contoh.sekali.panjang/sekali/lagi/dan/lagi';
  const hasil = F.wrapLines(tautan, 20);
  ok('kata sangat panjang dipotong, bukan melebar keluar gambar',
    hasil.every((b) => b.length <= 20) && hasil.join('') === tautan);
}

// ================= 3. Ukuran huruf menyesuaikan & SELALU muat =================
const BODY_TOP = 300;
const BODY_BOTTOM = 1120;
function muat(teks) {
  const l = F.layoutFeed(teks);
  const tinggi = l.lines.length * l.lineHeight;
  const atas = l.centerY - tinggi / 2;
  return { l, atas, bawah: atas + tinggi };
}
{
  const pendek = muat('Dia setia.');
  ok('tulisan pendek → huruf paling besar', pendek.l.fontSize === 76);
  ok('tulisan pendek tetap di dalam badan kartu',
    pendek.atas >= BODY_TOP - 1 && pendek.bawah <= BODY_BOTTOM + 1);
}
{
  const panjang = muat(contoh[2]);
  ok('tulisan panjang → huruf mengecil sendiri', panjang.l.fontSize < 76);
  ok('tulisan panjang tetap muat, tidak keluar badan kartu',
    panjang.atas >= BODY_TOP - 1 && panjang.bawah <= BODY_BOTTOM + 1,
    `atas ${panjang.atas} bawah ${panjang.bawah}`);
}
{
  // Tulisan yang jauh lebih panjang dari muatnya → dipotong, TIDAK meluber.
  const raksasa = muat(('kata '.repeat(600)).trim());
  ok('tulisan raksasa tetap muat (dipotong, bukan meluber)',
    raksasa.atas >= BODY_TOP - 1 && raksasa.bawah <= BODY_BOTTOM + 1,
    `atas ${raksasa.atas} bawah ${raksasa.bawah}`);
  ok('… memakai huruf terkecil', raksasa.l.fontSize === 30);
}
// Makin panjang tulisannya, hurufnya tidak pernah membesar.
{
  let sebelum = Infinity;
  let selaluTurun = true;
  for (const n of [1, 5, 20, 60, 200]) {
    const f = F.layoutFeed(('renungan '.repeat(n)).trim()).fontSize;
    if (f > sebelum) selaluTurun = false;
    sebelum = f;
  }
  ok('huruf tidak pernah membesar saat tulisannya bertambah panjang', selaluTurun);
}
// lineY: baris pertama di atas baris kedua, jaraknya persis lineHeight.
{
  const l = F.layoutFeed(contoh[2]);
  ok('jarak antarbaris persis lineHeight',
    Math.abs(F.lineY(l, 1) - F.lineY(l, 0) - l.lineHeight) < 0.001);
  ok('blok teksnya benar-benar di tengah badan kartu',
    Math.abs((F.lineY(l, 0) + F.lineY(l, l.lines.length - 1)) / 2 -
      (l.centerY + l.lineHeight * 0.72 - l.lineHeight / 2)) < 0.001);
}

// ================= 4. Nomor arsip & nama berkas =================
// 30 Agu 2026: "No. 238" jadi "Day 238 / 365" — bukan cuma nomor urut, tapi
// juga seberapa jauh tahun ini sudah berjalan. Totalnya ikut tahun kabisat.
ok('26 Agu 2026 = Day 238 / 365', F.archiveNo('2026-08-26') === 'Day 238 / 365',
  F.archiveNo('2026-08-26'));
ok('1 Januari = Day 1', F.archiveNo('2026-01-01') === 'Day 1 / 365');
ok('31 Desember 2026 = Day 365 / 365', F.archiveNo('2026-12-31') === 'Day 365 / 365');
ok('tahun kabisat ikut terhitung (2028)',
  F.archiveNo('2028-12-31') === 'Day 366 / 366', F.archiveNo('2028-12-31'));
ok('nama berkasnya menyebut arsip & tanggalnya',
  F.feedFileName('2026-08-26') === 'vixtory.archive 2026-08-26.png');

// ================= 5. Rupanya sedikit & tenang =================
ok('rupanya cuma 3 (satu identitas, bukan kumpulan tema)',
  F.FEED_DESIGNS.length === 3);
ok('rupa tak dikenal jatuh ke yang pertama, tidak error',
  F.designOf('entah-apa').key === F.FEED_DESIGNS[0].key);
ok('tiap rupa punya kertas, tinta, redup, & garis',
  F.FEED_DESIGNS.every((d) => d.paper && d.ink && d.muted && d.rule));

// ================= 6. Kartunya: halaman arsip, bukan quote card =================
const kartu = kodeSaja(baca('components/spiritual/ReflectionFeedCard.tsx'));
ok('viewBox-nya 1080×1350', /viewBox=\{`0 0 \$\{FEED_W\} \$\{FEED_H\}`\}/.test(kartu));
ok('tulisan refleksinya RATA KIRI (bukan rata tengah ala quote card)',
  /layout\.lines\.map[\s\S]{0,400}x=\{FEED_MARGIN\}/.test(kartu) &&
    !/layout\.lines\.map[\s\S]{0,400}textAnchor="middle"/.test(kartu));
ok('tidak ada gradien / bulatan hias (sisa gaya Story)',
  !/LinearGradient|<Circle/.test(kartu));
ok('kop "DAILY REFLECTION" + nomor arsip di atas',
  /DAILY REFLECTION/.test(kartu) && /\{archiveLabel\}/.test(kartu));
ok('kaki: tanggal & vixtory.archive',
  /\{dateLabel\}/.test(kartu) && /\{ARCHIVE_NAME\}/.test(kartu));
ok('teksnya dipakai apa adanya (cuma dipenggal, tidak diubah)',
  /\{line\}/.test(kartu) && !/toUpperCase|replace\(/.test(kartu));

// ================= 7. Layarnya: pratinjau, simpan, bagikan =================
const layar = kodeSaja(baca('app/reflection-feed.tsx'));
ok('ada pratinjau sebelum disimpan/dibagikan',
  /<ReflectionFeedCard/.test(layar) && /<CardPreview /.test(layar));
// 27 Agu 2026: tombolnya berganti maksud atas permintaan pemiliknya —
// "Simpan Gambar" (share sheet) jadi "Simpan ke Foto" (langsung ke Photos),
// dan "Bagikan" jadi "Buka Instagram". Rinciannya di cek-simpan-foto.js.
ok('DUA tombol: Simpan ke Foto & Buka Instagram',
  /label="💾 Simpan ke Foto"/.test(layar) && /label="📸 Buka Instagram"/.test(layar));
ok('gambarnya dibuat pada ukuran SEBENARNYA, bukan sebesar pratinjau',
  /useCardPng\(FEED_W, FEED_H\)/.test(layar) && /width=\{FEED_W\}/.test(layar) &&
    /toDataURL\(\(data\) => resolve\(data\), \{ width, height \}\)/.test(
      baca('hooks/useCardPng.ts')));
ok('ditandai sudah dibuat SESUDAH gambarnya jadi',
  /await simpanKeFoto\(\);[\s\S]{0,200}await markFeedGenerated\(user\.uid, todayId\);/.test(layar));
ok('belum menulis refleksi → dijelaskan, bukan layar kosong',
  /Refleksi hari ini belum ditulis/.test(layar));
ok('dua tombol tidak bisa ditekan berbarengan',
  /useBusyTask<'save' \| 'ig'>\(\)/.test(layar) &&
    /busy=\{kerja\.busy === 'save'\}/.test(layar) &&
    /busy=\{kerja\.busy === 'ig'\}/.test(layar));

// ================= 8. Tombol Generate Feed di Home =================
// 22 Sep 2026: kartu Refleksi Home → blok Refleksi di Today (Today Engine +
// components/today/ReflectionBlock); langganannya di useTodayData.
const home = kodeSaja(baca('hooks/useTodayData.ts')) + kodeSaja(baca('lib/today.ts')) + kodeSaja(baca('components/today/ReflectionBlock.tsx'));
ok('Today mendengarkan apakah feed hari ini sudah dibuat',
  /subscribeFeedGenerated\(uid, todayId, mark\('feed', setFeedGenerated\), fail\)/.test(home));
ok('tombolnya bertahan SELAMA belum dibuat',
  /showGenerate: written && !input\.feedGenerated,/.test(home));
ok('bloknya ikut membesar di jam baca-ulang / malam; tulisan yang ada selalu terbaca',
  /emphasis: rhemaWindowNow\(now\) \|\| now\.getHours\(\) >= EVENING_HOUR,/.test(home) &&
    /if \(!reflection\.emphasis && !reflection\.written\)/.test(home));
ok('tombol "🖼️ Feed" → layar feed',
  /label="🖼️ Feed" onPress=\{\(\) => router\.push\('\/reflection-feed'\)\}/.test(home));
ok('sudah dibuat → tombolnya hilang, tulisannya tetap bisa dibaca',
  /\{reflection\.showGenerate && \(/.test(home) && /numberOfLines=\{4\}[^>]*>\s*\{reflection\.text\}/.test(home));
ok('kartunya bukan lagi soal Story', !/Instagram Story/.test(home));

// ================= 9. Kebiasaannya diganti nama =================
const habits = kodeSaja(baca('lib/habits.ts'));
ok('namanya jadi Daily Reflection Journal',
  /label: '📓 Daily Reflection Journal'/.test(habits));
ok('nama LAMA di Firestore tetap dikenali (data tak perlu ditulis ulang)',
  /match: \/1 kalimat rhema\|rhema before activities\/i/.test(habits));
// Ini jebakannya: kalau `isNoteDrivenHabit` masih cuma mencari "rhema",
// baris jurnalnya jadi "hilang" bagi Home & layar feed setelah diganti nama.
// 31 Agu 2026: 🙏 Bersyukur 3 Hal ikut jadi baris bercatatan, jadi polanya
// bertambah satu — yang dijaga di sini tetap "reflection journal" ikut kenal.
ok('pencarian barisnya ikut mengenali nama baru',
  /rhema\|reflection journal\|bersyukur\/i\.test\(h\.label\)/.test(habits));

// ================= 10. Berkas lama benar-benar dibuang =================
for (const p of [
  'app/rhema-story.tsx',
  'lib/rhemaStory.ts',
  'components/spiritual/RhemaStoryCard.tsx',
]) {
  ok(`${p} sudah tidak ada`, !fs.existsSync(path.join(ROOT, p)));
}
ok('tak ada sisa acuan ke berkas lama',
  !/rhemaStory|RhemaStoryCard|rhema-story/.test(
    baca('app/(tabs)/index.tsx') + baca('app/_layout.tsx'),
  ));
ok('rute barunya terdaftar & typed routes sudah di-regen',
  /<Stack\.Screen name="reflection-feed" \/>/.test(baca('app/_layout.tsx')) &&
    baca('.expo/types/router.d.ts').includes('/reflection-feed'));

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
