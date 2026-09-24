// Uji dua hal:
//   A. Baca Alkitab yang jendelanya lewat → ✗ SENDIRI di Habits & tak bisa
//      diklik lagi.
//   B. Ayat yang dibaca → gambar Instagram Story 9:16 (opsional).
//
// Aturan jendela & penataan teksnya dijalankan SUNGGUHAN (kodenya dikompilasi),
// bukan dicocokkan regex — termasuk bukti bahwa kata-katanya tidak berubah.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi kode aslinya ----------
const OUT = path.join(__dirname, 'keluar-story');
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc',
      R + 'lib/bibleStory.ts',
      R + 'lib/shareImage.ts',
      // TypeScript 6 MENOLAK jalan (TS5112) kalau ada tsconfig.json sementara
      // berkasnya disebut satu per satu di baris perintah. Suite ini memang
      // sengaja tidak memakai tsconfig proyek, jadi diabaikan dengan tegas.
      '--ignoreConfig',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch {
  /* keluhan tipe diabaikan — hasil emit-nya diperiksa di bawah */
}
// shareImage mengimpor ../assets/… → tsc mempertahankan struktur foldernya.
const LIB = path.join(OUT, 'lib');
for (const f of ['bibleStory.js', 'shareImage.js']) {
  if (!fs.existsSync(path.join(LIB, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  // Modul native (berkas, Photos, buka aplikasi lain) tidak dipakai satu pun
  // uji di bawah — perilakunya diuji tersendiri di cek-simpan-foto.js.
  if (req === 'expo-file-system') return { File: class {}, Paths: {} };
  if (req === 'expo-linking') return { openURL: async () => {} };
  if (req === 'expo-media-library') {
    return { requestPermissionsAsync: async () => ({ granted: true }), Asset: { create: async () => ({}) } };
  }
  // Lembar berbagi iOS — dipakai sharePng (kartu Reminder 🕊️), diuji di
  // cek-reminder-share.js.
  if (req === 'expo-sharing') {
    return { isAvailableAsync: async () => true, shareAsync: async () => {} };
  }
  return asli.call(this, req, parent, isMain);
};
const S = require(path.join(LIB, 'bibleStory.js'));
const SH = require(path.join(LIB, 'shareImage.js'));
Module._load = asli;

// ---------- Aturan jendela (dari sumbernya, bukan disalin tangan) ----------
const spir = baca('lib/spiritual.ts');
const jendela = Object.fromEntries(
  [...spir.matchAll(/\{ key: '(\w+)',[^}]*fromHour: (\d+), toHour: (\d+) \}/g)].map(
    (m) => [m[1], { from: Number(m[2]), to: Number(m[3]) }],
  ),
);
const src = spir.match(/export function bibleWindowPassed[\s\S]*?\n\}/)[0];
const minutesLeft = (session, now) =>
  jendela[session].to * 60 - (now.getHours() * 60 + now.getMinutes());
const bibleWindowPassed = new Function(
  'bibleMinutesLeft',
  `${src.replace(/^export /, '').replace(/: BibleSession|: Date|: boolean/g, '')}
   return bibleWindowPassed;`,
)(minutesLeft);

const jam = (h, m = 0) => new Date(2026, 7, 26, h, m);

console.log('=== A. Jendela baca lewat → ✗ otomatis ===');
c('jendelanya terbaca dari kodenya',
  jendela.morning.to === 10 && jendela.daytime.to === 15 && jendela.night.to === 24,
  `pagi<${jendela.morning.to} · siang<${jendela.daytime.to} · malam<${jendela.night.to}`);
c('pagi jam 09.59 → BELUM lewat', !bibleWindowPassed('morning', jam(9, 59)));
c('pagi tepat jam 10.00 → lewat', bibleWindowPassed('morning', jam(10, 0)));
c('siang jam 14.59 → BELUM lewat', !bibleWindowPassed('daytime', jam(14, 59)));
c('siang tepat jam 15.00 → lewat', bibleWindowPassed('daytime', jam(15, 0)));
c('malam jam 23.59 → BELUM lewat (masih bisa dikejar hari ini)',
  !bibleWindowPassed('night', jam(23, 59)));
c('malam tidak pernah "lewat" dalam hari yang sama — jam 24 = hari baru',
  ![...Array(24).keys()].some((h) => bibleWindowPassed('night', jam(h, 59))));

// bibleMirrorState dijalankan apa adanya dari sumbernya.
const msSrc = spir.match(/export function bibleMirrorState[\s\S]*?\n\}/)[0];
const bibleMirrorState = new Function(
  'bibleSessionRead', 'isBibleSkipped', 'bibleWindowPassed',
  `${msSrc.replace(/^export /, '')
    .replace(/: BibleReadingSessions|: BibleSession|: Date/g, '')
    .replace(/\): \{ done: boolean; skipped: boolean \}/, ')')}
   return bibleMirrorState;`,
)(
  (s, k) => !!s[k] && s[k] !== '__skip__',
  (v) => v === '__skip__',
  bibleWindowPassed,
);

const sesi = (morning) => ({ morning, daytime: '', night: '' });
console.log('\n  — keadaan baris cermin "Morning Bible Reading" —');
const kasus = [
  ['belum diisi, jendela masih buka (08.00)', sesi(''), jam(8), { done: false, skipped: false }],
  ['sudah diisi, jendela masih buka', sesi('Mazmur 23'), jam(8), { done: true, skipped: false }],
  ['belum diisi, jendela SUDAH lewat (11.00)', sesi(''), jam(11), { done: false, skipped: true }],
  ['sudah diisi, jendela sudah lewat → TETAP tercentang', sesi('Mazmur 23'), jam(11), { done: true, skipped: false }],
  ['ditandai lewat sendiri, jendela masih buka', sesi('__skip__'), jam(8), { done: false, skipped: true }],
  ['ditandai lewat sendiri & jendela sudah lewat', sesi('__skip__'), jam(11), { done: false, skipped: true }],
];
for (const [nama, s, now, mau] of kasus) {
  const hasil = bibleMirrorState(s, 'morning', now);
  c(nama, hasil.done === mau.done && hasil.skipped === mau.skipped,
    `done=${hasil.done} skipped=${hasil.skipped}`);
}
c('yang sudah dibaca TIDAK pernah ikut ditandai ✗ walau jamnya lewat', (() => {
  return [10, 12, 18, 23].every(
    (h) => bibleMirrorState(sesi('Yohanes 3'), 'morning', jam(h)).skipped === false,
  );
})());

console.log('\n=== A. Layar Habits ===');
const habits = baca('app/habits.tsx');
c('jam berjalan ikut dibaca (useNow)', /const \{ now, todayId: dayId \} = useNow\(\)/.test(habits));
c('now dioper ke penentu keadaan baris cermin',
  /mirrorState\(kind, priorities, bible, now\)/.test(habits));
c('now jadi dependency efeknya → ✗ tertulis sendiri saat jamnya habis, tanpa buka ulang layar',
  /\}, \[user, dayId, day, schedule, priorities, bible, now\]\);/.test(habits));
c('penulisan tetap HANYA kalau berbeda (tidak menulis Firestore tiap menit)',
  /if \(!!day\.skipped\[habit\.id\] !== want\.skipped\)/.test(habits) &&
    /else if \(!!day\.done\[habit\.id\] !== want\.done\)/.test(habits));

const tab = baca('components/habits/HabitsTab.tsx');
c('lingkaran centangnya mati kalau sudah ✗ atau baris cermin sudah tercentang',
  /disabled=\{fromNote \|\| skipped \|\| \(mirrored && checked\)\}/.test(tab));
c('baris biasa yang tercentang TETAP bisa dilepas (bukan ikut terkunci)', (() => {
  // disabled = fromNote || skipped || (mirrored && checked)
  const mati = (fromNote, skipped, mirrored, checked) =>
    fromNote || skipped || (mirrored && checked);
  return mati(false, false, false, true) === false && // habit biasa, tercentang
    mati(false, false, true, true) === true && // cermin, tercentang
    mati(false, true, true, false) === true && // cermin, ✗ (jendela lewat)
    mati(false, false, true, false) === false; // cermin, masih bisa dikerjakan
})());
// Kebiasaannya ikut dioper sejak "Reading the News" perlu dicentang saat
// pintasannya dibuka (doneOnOpen) — lihat cek-berita.js.
c('nama kebiasaannya tetap bisa diklik untuk membuka layar asalnya',
  /onPress=\{\(\) => link && openHabitLink\(link, habit\)\}/.test(tab));
c('baris cermin tetap tanpa tombol ✗ sendiri (tandanya dari layar asalnya)',
  /\{!mirrored && \(/.test(tab));

console.log('\n=== B. Bahan bersama dipakai ulang, bukan disalin ===');
const share = baca('lib/shareImage.ts');
const feed = baca('lib/reflectionFeed.ts');
const story = baca('lib/bibleStory.ts');
c('rupa, nomor arsip, pemenggal baris & penyimpan gambar kini di lib/shareImage',
  /export const SHARE_DESIGNS/.test(share) && /export function archiveNo/.test(share) &&
    /export function wrapLines/.test(share) &&
    /export async function savePngToPhotos/.test(share) &&
    /export function layoutText/.test(share));
c('reflectionFeed TIDAK lagi menyalinnya sendiri',
  !/function wrapLines/.test(feed) && !/const FEED_DESIGNS: /.test(feed) &&
    !/function archiveNo/.test(feed) && !/function shareFeedPng/.test(feed));
c('nama lamanya tetap tersedia → kartu Feed tak perlu diubah',
  /SHARE_DESIGNS as FEED_DESIGNS/.test(feed) &&
    /savePngToPhotos as saveFeedToPhotos/.test(feed) &&
    /type ShareDesign as FeedDesign/.test(feed));
c('bibleStory memakai bahan yang sama, tidak menyalin ulang',
  /from '\.\/shareImage'/.test(story) && !/function wrapLines/.test(story));
// Urutan & namanya diubah pemiliknya jadi urutan waktu baca (Morning🌅 →
// Midday🌤️ → Night🌙); `key`-nya sengaja TIDAK ikut berganti supaya pilihan
// yang sudah tersimpan tidak kehilangan rupanya. Jadi yang dijaga di sini
// ketiga kuncinya, bukan urutannya.
c('tiga rupa yang sama dipakai kedua gambar', SH.SHARE_DESIGNS.length === 3 &&
  SH.SHARE_DESIGNS.map((d) => d.key).sort().join() === 'ink,paper,sage');

console.log('\n=== B. Ukuran & tata letak Story ===');
c('9:16 — 1080×1920', S.STORY_W === 1080 && S.STORY_H === 1920);
c('bingkainya menghindari pita atas & bawah Instagram (±250px)', (() => {
  const f = S.STORY_FRAME;
  return f.y >= 240 && f.y + f.h <= S.STORY_H - 240;
})(), `atas ${S.STORY_FRAME.y}, bawah ${S.STORY_H - (S.STORY_FRAME.y + S.STORY_FRAME.h)}`);
c('semua tulisan tetap berada di dalam bingkainya', (() => {
  const f = S.STORY_FRAME;
  return [S.STORY_HEAD_Y, S.STORY_RULE_TOP_Y, S.STORY_REF_Y,
    S.STORY_RULE_BOTTOM_Y, S.STORY_FOOT_Y].every((y) => y > f.y && y < f.y + f.h);
})());
c('urutannya benar dari atas ke bawah',
  S.STORY_HEAD_Y < S.STORY_RULE_TOP_Y && S.STORY_RULE_TOP_Y < S.STORY_REF_Y &&
    S.STORY_REF_Y < S.STORY_RULE_BOTTOM_Y && S.STORY_RULE_BOTTOM_Y < S.STORY_FOOT_Y);

console.log('\n  — ayat pendek besar, ayat panjang mengecil, SELALU muat —');
const contoh = [
  'Kasih itu sabar.',
  'TUHAN adalah gembalaku, takkan kekurangan aku.',
  'Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.',
  'Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku. Sebab itu janganlah kamu kuatir akan hari besok, karena hari besok mempunyai kesusahannya sendiri. Kesusahan sehari cukuplah untuk sehari.',
];
let besarSebelumnya = Infinity;
for (const t of contoh) {
  const L = S.layoutStory(t);
  const tinggi = L.lines.length * L.lineHeight;
  c(`${String(t.length).padStart(3)} huruf → ${L.fontSize}pt, ${L.lines.length} baris, muat`,
    tinggi <= 1380 - 520 + 1, `tinggi blok ${tinggi}px dari 860px`);
  besarSebelumnya = Math.min(besarSebelumnya, L.fontSize);
}
c('makin panjang ayatnya, hurufnya makin kecil (bukan terpotong)', (() => {
  const ukuran = contoh.map((t) => S.layoutStory(t).fontSize);
  return ukuran.every((u, i) => i === 0 || u <= ukuran[i - 1]);
})(), contoh.map((t) => S.layoutStory(t).fontSize + 'pt').join(' → '));

console.log('\n  — bunyi ayatnya TIDAK berubah —');
c('kata-katanya sama persis & urutannya sama, di semua contoh', (() => {
  for (const t of contoh) {
    const asalnya = t.trim().split(/\s+/);
    const hasil = S.layoutStory(t).lines.join(' ').trim().split(/\s+/);
    if (asalnya.join('|') !== hasil.join('|')) return false;
  }
  return true;
})());
c('tidak pernah memotong di tengah kata', (() => {
  const t = contoh[2];
  return S.layoutStory(t).lines.every((b) =>
    b.split(/\s+/).every((k) => t.includes(k)),
  );
})());

console.log('\n=== B. Pilih bacaan & nama berkas ===');
c('satu acuan → satu pilihan',
  JSON.stringify(S.storyRefs('Mazmur 23:1-6')) === '["Mazmur 23:1-6"]');
c('beberapa acuan dipecah & dirapikan',
  JSON.stringify(S.storyRefs('Mazmur 23:1-6,  Yohanes 3:16 ')) ===
    '["Mazmur 23:1-6","Yohanes 3:16"]');
c('yang kosong dibuang', JSON.stringify(S.storyRefs('Mazmur 23, , ')) === '["Mazmur 23"]');
c('tanpa isi → tidak ada pilihan (layarnya menampilkan pesan)',
  S.storyRefs('').length === 0 && S.storyRefs('  ,  ').length === 0);
c('nama berkas memuat tanggal & acuannya',
  S.storyFileName('2026-08-26', 'Mazmur 23:1-6') ===
    'vixtory.archive 2026-08-26 Mazmur 23-1-6.png',
  S.storyFileName('2026-08-26', 'Mazmur 23:1-6'));
c('tanda yang tak sah di nama berkas dibersihkan',
  !/[/:\\?%*|"<>]/.test(S.storyFileName('2026-08-26', 'Wahyu 1:1/2?')));

console.log('\n=== B. Kartunya ===');
const kartu = baca('components/spiritual/BibleStoryCard.tsx');
c('digambar SVG (react-native-svg yang sudah terpasang), bukan modul baru',
  /from 'react-native-svg'/.test(kartu));
c('ukurannya ditulis di viewBox → hasilnya selalu 1080×1920',
  /viewBox=\{`0 0 \$\{STORY_W\} \$\{STORY_H\}`\}/.test(kartu));
c('tulisannya rata KIRI, bukan quote card rata tengah',
  !/textAnchor="middle"/.test(kartu));
// `acuan` = acuannya BESERTA terjemahannya ("Amsal 1:4 (TB)") — lihat cek
// terjemahan di bawah. Tanpa ayat, itulah yang naik jadi tulisan utama.
c('tanpa ayat, ACUANNYA yang jadi tulisan utama (kartunya tak pernah kosong)',
  /const hero = verse\.trim\(\) \|\| acuan;/.test(kartu));
c('terjemahannya ikut tercetak di sebelah acuannya',
  /const acuan = rujukan && versi \? `\$\{rujukan\} \(\$\{versi\}\)` : rujukan;/.test(kartu) &&
    /- \{acuan\}/.test(kartu));
c('terjemahan kosong tidak menyisakan kurung menganga',
  /const versi = version\.trim\(\);/.test(kartu));
c('acuannya tidak ditulis dua kali saat ia sendiri jadi tulisan utama',
  /\{verse\.trim\(\)( && acuan)? \? \(/.test(kartu));
c('kaki: tanggal + vixtory.archive, sama seperti Feed refleksi',
  /\{dateLabel\}/.test(kartu) && /\{ARCHIVE_NAME\}/.test(kartu));

console.log('\n=== B. Layar & pintunya ===');
const layar = baca('app/bible-story.tsx');
const bacaan = baca('app/bible-reading.tsx');
c('pintunya di layar catat bacaan, MUNCUL hanya kalau sudah ada isinya',
  /\{filled\.length > 0 && \([\s\S]*?pathname: '\/bible-story'/.test(bacaan));
// Terjemahannya ikut dioper (2 Sep 2026): yang membaca Story-mu tidak punya
// cara lain untuk tahu "Amsal 1:4" itu versi yang mana.
c('acuan, sesi & terjemahannya dioper lewat parameter',
  /refs: filled\.join\(', '\),/.test(bacaan) &&
    /version: versiTerpakai,/.test(bacaan));
c('layar Story membacanya & jatuh ke TB kalau kosong',
  /version: versionParam,/.test(layar) &&
    /BIBLE_VERSION_DEFAULT/.test(layar) &&
    /version=\{version\}/.test(layar));
c('sifatnya opsional — tombol "Sudah baca" & "Lewati" tidak tersentuh',
  /label="✅ Sudah baca"/.test(bacaan) && /label="⏭️ Lewati baca hari ini"/.test(bacaan));
c('layar Story tidak menyentuh Firestore sama sekali', (() => {
  const impor = (layar.match(/^import .*$/gm) || []).join('\n');
  return !/firebase|firestore|liveDoc|subscribe/i.test(impor);
})());
c('ada pratinjau sebelum disimpan/dibagikan', /<BibleStoryCard/.test(layar));
// 27 Agu 2026: tombolnya berganti maksud atas permintaan pemiliknya —
// simpan LANGSUNG ke Photos, lalu buka Instagram. Lihat cek-simpan-foto.js.
c('dua tombol: Simpan ke Foto & Buka Instagram Story',
  /label="💾 Simpan ke Foto"/.test(layar) && /label="📸 Buka Instagram Story"/.test(layar));
// 23 Sep 2026: hitungan pratinjaunya pindah ke <CardPreview/> & useCardPng,
// satu tempat untuk keempat layar kartu. Jaminannya tetap sama.
c('digambar ulang pada ukuran SEBENARNYA, bukan sebesar pratinjau',
  /<CardPreview width=\{STORY_W\} height=\{STORY_H\}/.test(layar) &&
    /useCardPng\(STORY_W, STORY_H\)/.test(layar) && /width=\{STORY_W\}/.test(layar));
// Kalimat "Opsional. Kosongkan saja…" dihapus pemiliknya sendiri (judulnya
// kini "✍️ Isi Ayat"). Sifat OPSIONAL-nya tetap dijaga: kartunya harus tetap
// jadi walau ayatnya kosong — acuannya yang naik jadi tulisan utama.
c('ayatnya tetap boleh kosong — acuannya yang jadi tulisan utama',
  /const hero = verse\.trim\(\) \|\| acuan;/.test(kartu));
c('rutenya terdaftar & typed routes sudah di-regen',
  /name="bible-story"/.test(baca('app/_layout.tsx')) &&
    /bible-story/.test(baca('.expo/types/router.d.ts')));

console.log('\n=== Aturan wajib ===');
// Sejak 27 Agu 2026 Story disimpan LANGSUNG ke Photos atas permintaan
// pemiliknya, jadi expo-media-library memang ditambahkan dengan sadar
// (lihat cek-simpan-foto.js). Gambarnya sendiri tetap digambar oleh
// react-native-svg yang sudah lama terpasang.
c('kartunya tetap digambar react-native-svg; native yang bertambah cuma Photos', (() => {
  const pkg = JSON.parse(baca('package.json'));
  return !!pkg.dependencies['react-native-svg'] && !!pkg.dependencies['expo-media-library'];
})());
c('warnanya dari Color, tak ada hex mentah di layar & kartu',
  !/#[0-9A-Fa-f]{6}/.test(layar) && !/#[0-9A-Fa-f]{6}/.test(kartu));
c('tidak ada soft-delete diselundupkan',
  !/isDeleted|archived: true/.test(layar + story + share));
c('memakai komponen bersama, bukan bikin sendiri',
  /ScreenHeader/.test(layar) && /PrimaryButton/.test(layar) && /Chip/.test(layar) &&
    /FormInput/.test(layar) && !/<Text[ >]/.test(layar));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
