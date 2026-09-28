// Dua permintaan 27 Sep 2026:
//
//   1. 📸 Foto notulen rapat bulanan bisa di-click → SATU LAYAR PENUH, dan
//      bisa dicubit (pinch) untuk memperbesar. Di kartu fotonya dipotong
//      `cover` supaya kartunya rapi, jadi wajah di tepi foto memang hilang —
//      sebelum ini tidak ada cara melihat aslinya di dalam app sama sekali.
//
//   2. 🙏 Langkah Pray di Morning Journey dapat chip KATEGORI POKOK DOA,
//      bentuknya sama persis dengan chip ❤️ Respond. Kolom doa pagi selalu
//      mulai dari halaman kosong, dan halaman kosong jam 5 pagi paling gampang
//      dilewati begitu saja.
//
// Yang dijalankan sungguhan: seluruh fungsi murni kategori doa (label, baris
// riwayat, kunci asing). Yang dibaca dari kode: bentuk gestur & tempat
// PhotoViewer dipasang — keduanya tidak bisa dijalankan tanpa layar.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-foto-doa');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/journey.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase' || /\/firebase$/.test(req)) return { db: {}, auth: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req.startsWith('firebase/')) {
    return new Proxy({}, { get: (_, k) => (k === 'Timestamp' ? { now: () => ({}) } : () => ({})) });
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native|react$)/.test(req)) return {};
  return asli(req, parent, isMain);
};
// tsc menaruh hasilnya langsung di OUT saat cuma satu berkas yang diminta,
// tapi di OUT/lib kalau ada berkas lain yang ikut. Keduanya diterima.
const JALUR = ['journey.js', path.join('lib', 'journey.js')]
  .map((p) => path.join(OUT, p))
  .find((p) => fs.existsSync(p));
const J = require(JALUR);
Module._load = asli;

// =====================================================================
console.log('=== 1. 📸 PhotoViewer: satu layar penuh & bisa dicubit ===');
// =====================================================================
{
  const v = baca('components/common/PhotoViewer.tsx');

  ok('komponennya ada di components/common (dipakai bersama, bukan disalin)',
    fs.existsSync(path.join(ROOT, 'components/common/PhotoViewer.tsx')));

  // Gesturnya: cubit + geser + click 2× + click 1×, digabung.
  ok('cubit untuk memperbesar', /Gesture\.Pinch\(\)/.test(v));
  ok('geser untuk memindahkan foto yang sudah diperbesar', /Gesture\.Pan\(\)/.test(v));
  ok('click 2× = zoom cepat', /numberOfTaps\(2\)/.test(v));
  ok('click 1× = tutup', /numberOfTaps\(1\)/.test(v));
  ok('keempatnya digabung (Simultaneous + Exclusive), bukan saling menindih',
    /Gesture\.Simultaneous\(/.test(v) && /Gesture\.Exclusive\(/.test(v));

  // Dua aturan yang membuatnya tidak menyebalkan dipakai.
  ok('geser DIAM selama fotonya belum diperbesar',
    /onUpdate\(\(e\) => \{\s*\n\s*if \(skala\.value <= 1\) return;/.test(v));
  ok('click 1× tidak menutup saat sedang diperbesar (posisi zoom tidak terbuang)',
    /if \(skala\.value <= 1\) runOnJS\(onClose\)\(\);/.test(v));

  ok('batas zoom 1× sampai 5×, click 2× ke 2,5×',
    /const MAKS_ZOOM = 5;/.test(v) && /const ZOOM_CEPAT = 2\.5;/.test(v) &&
      /Math\.min\(Math\.max\(nilai, 1\), MAKS_ZOOM\)/.test(v));

  // Foto lain dibuka → zoom & posisi foto sebelumnya TIDAK ikut terbawa.
  ok('ganti foto → zoom & posisinya dikembalikan ke awal',
    /useEffect\(\(\) => \{[\s\S]*?skala\.value = 1;[\s\S]*?\}, \[uri,/.test(v));

  // GestureHandlerRootView harus DI DALAM Modal — hierarki view Modal
  // terpisah, jadi root di app/_layout.tsx tidak menjangkaunya.
  ok('GestureHandlerRootView dipasang DI DALAM Modal', (() => {
    const modal = v.indexOf('<Modal');
    const root = v.indexOf('<GestureHandlerRootView');
    return modal > 0 && root > modal;
  })());

  ok('fotonya UTUH di layar penuh (contain), bukan dipotong',
    /resizeMode="contain"/.test(v));
  ok('warnanya dari token, tidak ada hex mentah',
    !/#[0-9A-Fa-f]{6}/.test(v) && /Color\.PHOTO_BACKDROP/.test(v));

  const warna = baca('assets/style/color.ts');
  ok('PHOTO_BACKDROP ada & sengaja BEDA dari OVERLAY modal biasa', (() => {
    const p = /PHOTO_BACKDROP: '(#[0-9A-Fa-f]{8})'/.exec(warna);
    const o = /OVERLAY: '(#[0-9A-Fa-f]{8})'/.exec(warna);
    return !!p && !!o && p[1] !== o[1];
  })());

  // ---- Tempat pakainya ----
  const tab = baca('components/core/MonthlyTab.tsx');
  ok('foto di kartu notulen jadi bisa di-click', (() => {
    const blok = /\{m\.photos\.map\(\(photo, i\) => \([\s\S]*?\)\)\}/.exec(tab)?.[0] ?? '';
    return /<PressableScale/.test(blok) && /setLihatFoto\(photoUri\(photo\)\)/.test(blok);
  })());
  ok('…dan click foto TIDAK ikut menutup kartunya', (() => {
    const blok = /\{m\.photos\.map\(\(photo, i\) => \([\s\S]*?\)\)\}/.exec(tab)?.[0] ?? '';
    return !/setOpenId/.test(blok);
  })());
  ok('di kartu fotonya tetap dipotong `cover` (tampilan kartu tidak berubah)',
    /style=\{styles\.cardPhoto\}\s*\n\s*resizeMode="cover"/.test(tab));
  ok('PhotoViewer dipasang sekali di layarnya, di luar daftar',
    /<PhotoViewer uri=\{lihatFoto\} onClose=\{\(\) => setLihatFoto\(null\)\} \/>/.test(tab));

  // Layar UBAH notulen sengaja TIDAK ikut: foto di sana punya tombol ✕ untuk
  // membuangnya, dan membuka layar penuh di atasnya cuma menghalangi.
  ok('layar ubah notulen sengaja tidak ikut diubah',
    !/PhotoViewer/.test(baca('app/core/monthly/[id].tsx')));

  // Tanpa modul native baru → cukup `eas update`.
  ok('tidak ada pustaka baru: semuanya sudah ada di package.json', (() => {
    const pkg = JSON.parse(baca('package.json'));
    const impor = [...v.matchAll(/from '([^'@][^']*)'/g)].map((m) => m[1]);
    return impor.every((p) => pkg.dependencies[p] || p.startsWith('.'));
  })());
}

// =====================================================================
console.log('\n=== 2. 🙏 Chip kategori pokok doa di langkah Pray ===');
// =====================================================================
{
  ok('ada tujuh kategori', J.PRAYER_TOPICS.length === 7,
    J.PRAYER_TOPICS.map((t) => t.label).join(' · '));
  ok('kuncinya unik', new Set(J.PRAYER_TOPICS.map((t) => t.key)).size === 7);
  ok('labelnya unik (tidak ada dua chip berteks kembar)',
    new Set(J.PRAYER_TOPICS.map((t) => t.label)).size === 7);
  ok('tiap kategori punya emoji & label terisi',
    J.PRAYER_TOPICS.every((t) => t.emoji.length > 0 && t.label.length > 0));

  ok('prayerTopicLabel: kunci dikenal jadi "emoji label"',
    J.prayerTopicLabel('family') === '🏠 Keluarga', J.prayerTopicLabel('family'));
  // Kunci asing = data lama / kategori yang pernah dibuang. Ia harus tetap
  // tercetak apa adanya, bukan hilang diam-diam dari riwayat.
  ok('prayerTopicLabel: kunci asing dicetak apa adanya, tidak hilang',
    J.prayerTopicLabel('kunci-lama') === 'kunci-lama');
  ok('prayerTopicsLine: digabung dengan " · "',
    J.prayerTopicsLine(['family', 'work']) === '🏠 Keluarga · 💼 Kerja',
    J.prayerTopicsLine(['family', 'work']));
  ok('prayerTopicsLine: kosong & undefined sama-sama jadi teks kosong',
    J.prayerTopicsLine([]) === '' && J.prayerTopicsLine(undefined) === '');

  const steps = baca('components/spiritual/journey/JourneySteps.tsx');
  // Satu fungsi utuh: dari deklarasinya sampai tepat sebelum fungsi
  // berikutnya. Tidak bisa dipotong pakai "\n}" pertama — daftar prop-nya
  // sendiri sudah berakhir dengan "}" di kolom nol ("}: {").
  const blok = (src, nama) => {
    const mulai = src.indexOf(`export function ${nama}(`);
    if (mulai < 0) return '';
    const sisa = src.slice(mulai + 1);
    const akhir = sisa.search(/\n(export )?function \w+\(/);
    return akhir < 0 ? sisa : sisa.slice(0, akhir);
  };
  const pray = blok(steps, 'PrayStep');
  ok('chipnya digambar dari PRAYER_TOPICS, bukan daftar salinan',
    /PRAYER_TOPICS\.map\(\(t\) => \(/.test(pray) && /<Chip/.test(pray));
  ok('boleh dipilih lebih dari satu (toggle, sama seperti Respond)',
    /cur\.includes\(key\) \? cur\.filter\(\(k\) => k !== key\) : \[\.\.\.cur, key\]/.test(pray));
  ok('pilihannya ikut tersimpan saat "Berdoa" di-click',
    /onSave\(\{ prayer: prayer\.trim\(\), prayerTopics: topics \}\)/.test(pray));
  ok('isian lama terbaca lagi saat layarnya dibuka ulang',
    /useDraft<string\[\]>\(entry\?\.prayerTopics \?\? \[\]\)/.test(pray));
  ok('chipnya duduk di antara pertanyaan & kolom tulisnya', (() => {
    const label = pray.indexOf('Hal apa yang ingin kamu serahkan');
    const chip = pray.indexOf('PRAYER_TOPICS.map');
    const input = pray.indexOf('Tuliskan doamu sendiri');
    return label > 0 && chip > label && input > chip;
  })());

  // Langkah Respond TIDAK ikut berubah — permintaannya menambah, bukan
  // memindahkan.
  const respond = blok(steps, 'RespondStep');
  ok('chip ❤️ Respond tetap seperti semula (5 pilihan, dari RESPONSE_OPTIONS)',
    /RESPONSE_OPTIONS\.map\(\(o\) => \(/.test(respond) && J.RESPONSE_OPTIONS.length === 5);

  // ---- Tempat menyimpannya ----
  const spi = baca('lib/spiritual.ts');
  ok('prayerTopics menumpang di dokumen Revive hari itu (tanpa koleksi baru)',
    /prayerTopics\?: string\[\];/.test(spi) &&
      !/collection\(db, 'users', uid, 'prayerTopics'\)/.test(spi));
  ok('dokumen lama tanpa kolom itu terbaca sebagai daftar kosong',
    /Array\.isArray\(d\.prayerTopics\)/.test(spi));
  ok('isi yang bukan teks disaring, jadi riwayat tidak bisa diracuni data aneh',
    /d\.prayerTopics\s*\n?\s*\.filter\(\(t\): t is string => typeof t === 'string'\)|\.filter\(\(t\): t is string => typeof t === 'string'\)/.test(spi));
  ok('Morning Journey boleh menulis kolom itu',
    /'responses' \| 'prayer' \| 'prayerTopics'/.test(spi));
  ok('dokumen Revive yang baru dibuat sudah punya kolomnya (bukan kolom hilang)',
    /prayer: '',\s*\n\s*prayerTopics: \[\],/.test(spi));

  // ---- Terbaca lagi di riwayat ----
  ok('kategori doanya ikut terlihat di arsip Revive',
    /prayerTopicsLine\(entry\.prayerTopics\)/.test(baca('app/revive.tsx')));
  const rh = baca('app/journey-history.tsx');
  ok('…dan di Riwayat Morning Journey',
    /prayerTopicsLine\(d\.entry\?\.prayerTopics\)/.test(rh));
  ok('…termasuk ikut tercari lewat kolom cari',
    /prayerTopicsLine\(e\?\.prayerTopics\)/.test(rh));
}

// =====================================================================
console.log('\n=== 3. Aturan tetap proyek ===');
// =====================================================================
{
  const berkasBaru = [
    'components/common/PhotoViewer.tsx',
    'lib/journey.ts',
    'components/spiritual/journey/JourneySteps.tsx',
    'components/core/MonthlyTab.tsx',
  ];
  // Istilah: "click", bukan "klik"/"ketuk"/"tap"; dan tidak pernah "tekan".
  const salahIstilah = berkasBaru.filter((f) =>
    /\b(klik|Klik|ketuk|Ketuk|ditekan|menekan)\b/.test(baca(f)));
  ok('istilahnya "click", bukan klik/ketuk/tekan', salahIstilah.length === 0,
    salahIstilah.join(', '));

  // Tanda pisah panjang tidak boleh ada di TEKS yang tampil (komentar bebas).
  const emDash = [];
  for (const f of berkasBaru) {
    for (const m of baca(f).match(/'[^'\n]*'|`[^`\n]*`/g) || []) {
      if (m.includes('—')) emDash.push(`${f}: ${m.slice(0, 40)}`);
    }
  }
  ok('tidak ada tanda pisah panjang di teks yang tampil', emDash.length === 0,
    emDash.join(' | '));

  ok('tidak ada soft-delete diselundupkan',
    !berkasBaru.some((f) => /isDeleted|archived: true/.test(baca(f))));
}

console.log('\n' + (gagal === 0 ? 'LULUS' : `GAGAL — ${gagal} cek`));
process.exit(gagal === 0 ? 0 : 1);
