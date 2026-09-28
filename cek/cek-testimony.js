// 🪨 Testimony — batu peringatan (28 Sep 2026).
//
// "Sampai di sini TUHAN menolong kita." (1 Samuel 7:12)
//
// Fitur baru atas permintaan pemilik app: tempat mencatat mukjizat, hal keren
// yang terjadi, dan tanggal-tanggal yang ingin diingat seumur hidup — terutama
// hari-hari yang dijalani sampai habis padahal berisiko.
//
// Yang DIJALANKAN sungguhan di sini: seluruh hitungan murninya (pengelompokan
// per tahun, hitungan per jenis, jatuh-balik jenis asing). Sisanya dibaca dari
// kodenya, karena menyangkut tata letak & Firestore.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-testimony');
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
    ['tsc', path.join(ROOT, 'lib/testimony.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// Yang dicatat dari firestore tiruan: penulisan batch (untuk 4 catatan awal).
const ditulis = [];
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase' || /\/firebase$/.test(req)) return { db: {}, auth: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === 'firebase/firestore') {
    return {
      collection: (...a) => ({ jalur: a.slice(1).join('/') }),
      doc: (c, id) => ({ jalur: `${c.jalur}/${id}` }),
      deleteDoc: async () => {},
      setDoc: async () => {},
      limit: () => ({}),
      orderBy: () => ({}),
      query: () => ({}),
      writeBatch: () => ({
        set: (ref, data) => ditulis.push({ ref, data }),
        commit: async () => {},
      }),
    };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native|react$)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const JALUR = ['testimony.js', path.join('lib', 'testimony.js')]
  .map((p) => path.join(OUT, p))
  .find((p) => fs.existsSync(p));
const T = require(JALUR);
Module._load = asli;

const lib = baca('lib/testimony.ts');
const tab = baca('components/spiritual/TestimonyTab.tsx');
const walk = baca('app/(tabs)/walk.tsx');

// =====================================================================
console.log('=== 1. Empat jenis, dan penampungnya ===');
// =====================================================================
ok('ada empat jenis', T.TESTIMONY_KINDS.length === 4,
  T.TESTIMONY_KINDS.map((k) => k.label).join(' · '));
ok('kunci, label, & emojinya semua unik', (() => {
  const u = (f) => new Set(T.TESTIMONY_KINDS.map(f)).size === 4;
  return u((k) => k.key) && u((k) => k.label) && u((k) => k.emoji);
})());
ok('tiap jenis punya kalimat penuntun yang utuh',
  T.TESTIMONY_KINDS.every((k) => k.hint.length > 25 && k.hint !== k.label));
// Jenis yang tidak dikenal TIDAK boleh membuat catatannya hilang dari daftar —
// itulah gunanya penampung 📌 di ekor daftar.
ok('jenis asing jatuh ke 📌 Tanggal Penting, bukan hilang',
  T.testimonyKindMeta('entah-apa').key === 'mark' &&
  T.testimonyKindMeta('miracle').key === 'miracle');

// =====================================================================
console.log('\n=== 2. Dikelompokkan per tahun (dijalankan) ===');
// =====================================================================
const buat = (dayId, kind = 'mark', title = 'x') => ({ id: dayId, dayId, kind, title, story: '' });
{
  const hasil = T.testimonyYears([
    buat('2026-05-03'), buat('2025-12-31'), buat('2026-09-13'), buat('2026-01-01'),
  ]);
  ok('tahun terbaru di atas', hasil.map((t) => t.year).join(',') === '2026,2025',
    hasil.map((t) => t.year).join(','));
  ok('di dalam satu tahun, tanggal terbaru di atas',
    hasil[0].items.map((t) => t.dayId).join(',') === '2026-09-13,2026-05-03,2026-01-01',
    hasil[0].items.map((t) => t.dayId).join(','));
  // Jebakan zona waktu: membentuk Date dari "2026-01-01" bisa bergeser sehari
  // dan memindahkan catatan 1 Januari ke tahun SEBELUMNYA. Tahunnya karena itu
  // dibaca dari teksnya, bukan lewat Date.
  ok('1 Januari tetap di tahunnya sendiri (bukan geser karena zona waktu)',
    hasil[0].items.some((t) => t.dayId === '2026-01-01') &&
    !hasil.some((t) => t.year === 2025 && t.items.some((x) => x.dayId === '2026-01-01')));
  ok('tanggal rusak/kosong dilewati, bukan bikin kelompok tanpa tahun',
    T.testimonyYears([buat(''), buat('bukan-tanggal'), buat('2026-02-02')]).length === 1);
  ok('daftar kosong → tidak ada kelompok sama sekali', T.testimonyYears([]).length === 0);
}

// =====================================================================
console.log('\n=== 3. Hitungan per jenis (dijalankan) ===');
// =====================================================================
{
  const isi = [buat('2026-01-01', 'miracle'), buat('2026-02-01', 'fullday'), buat('2026-03-01', 'fullday')];
  const n = T.testimonyCounts(isi);
  ok('dihitung per jenis', n.miracle === 1 && n.fullday === 2 && n.cool === 0 && n.mark === 0,
    JSON.stringify(n));
  ok('jenis yang nol tidak ikut disebut di barisnya',
    T.testimonyCountLine(isi) === '🙌 1 · 💪 2', T.testimonyCountLine(isi));
  ok('daftar kosong → barisnya kosong, bukan "0 · 0 · 0"',
    T.testimonyCountLine([]) === '');
  ok('jenis asing ikut terhitung di penampungnya',
    T.testimonyCounts([buat('2026-01-01', 'zzz')]).mark === 1);
}

// =====================================================================
console.log('\n=== 4. Empat catatan awal yang didiktekan pemilik app ===');
// =====================================================================
{
  ok('jumlahnya empat', T.TESTIMONY_SEED.length === 4);
  const tanggal = T.TESTIMONY_SEED.map((s) => s.dayId).sort();
  ok('tanggalnya persis yang disebutkan (3 Mei · 17 Mei · 2 Agu · 13 Sep 2026)',
    tanggal.join(',') === '2026-05-03,2026-05-17,2026-08-02,2026-09-13', tanggal.join(','));
  ok('keempatnya jenis 💪 Hari Niat', T.TESTIMONY_SEED.every((s) => s.kind === 'fullday'));
  ok('keempatnya punya judul & cerita, bukan judul saja',
    T.TESTIMONY_SEED.every((s) => s.title.length > 10 && s.story.length > 20));
  // Isinya harus menyebut hal yang memang dia sebutkan — kalau salah satu
  // hilang saat disunting, catatannya berubah arti.
  const semua = T.TESTIMONY_SEED.map((s) => `${s.title} ${s.story}`).join(' ');
  for (const kata of ['Merbabu', 'NDC Youth', 'Bali', 'Ranu Kumbolo', 'Milo Run', 'Elvina', 'NCH 7']) {
    ok(`menyebut "${kata}"`, semua.includes(kata));
  }
  // Id turunan tanggal, bukan acak: menekan tombolnya dua kali MENIMPA
  // catatan yang sama, bukan melahirkan empat kembarannya.
  ok('id-nya turunan tanggalnya (jadi tidak bisa kembar)',
    T.TESTIMONY_SEED.every((s) => s.id === `seed-${s.dayId}`));
  ditulis.length = 0;
  T.seedTestimonies('u1');
  ok('ditulis SATU batch (tidak mungkin jadi setengah)', ditulis.length === 4,
    `${ditulis.length} tulisan`);
  ok('id-nya tidak ikut masuk ke isi dokumennya',
    ditulis.every((w) => w.data.id === undefined && w.data.dayId));
  ok('masuk ke koleksi testimonies',
    ditulis.every((w) => w.ref.jalur.startsWith('users/u1/testimonies/')),
    ditulis[0]?.ref.jalur);
}

// =====================================================================
console.log('\n=== 5. Penyimpanan & cadangannya ===');
// =====================================================================
ok('satu dokumen per catatan di users/{uid}/testimonies',
  /collection\(db, 'users', uid, 'testimonies'\)/.test(lib));
ok('dibaca lewat liveList + dipatok 400 (arsip seumur hidup, tetap berlangit-langit)',
  /liveList<Testimony>/.test(lib) && /orderBy\('dayId', 'desc'\), limit\(400\)/.test(lib));
// Semua hapus di app ini PERMANEN.
ok('hapus PERMANEN (deleteDoc), bukan ditandai',
  /return deleteDoc\(doc\(testimonyCollection\(uid\), id\)\);/.test(lib) &&
  !/isDeleted|archived/.test(lib));
// Koleksi baru yang lupa didaftarkan = data yang diam-diam tidak pernah ikut
// tercadangkan. cek-ekspor.js menjaganya juga; di sini disebut lagi supaya
// alasannya ikut terbaca dari fiturnya sendiri.
ok('ikut Ekspor Data', /'testimonies'/.test(baca('lib/dataExport.ts')));
ok('nol bacaan tambahan saat tab lain dibuka (langganan di dalam sub-tabnya)',
  /useLive<Testimony\[\]>\(subscribeTestimonies/.test(tab) &&
  !/subscribeTestimonies/.test(walk));

// =====================================================================
console.log('\n=== 6. Tempatnya di app ===');
// =====================================================================
ok('jadi sub-tab Walk 🕊️ bernama Testimony',
  /\{ key: 'testimony', label: 'Testimony', icon: 'calendar' \}/.test(walk) &&
  /tab === 'testimony' \? \(/.test(walk));
// Ditaruh SESUDAH Promise: yang satu melihat ke depan, yang ini ke belakang.
ok('duduk tepat sesudah Promise (pasangan "ke depan" & "ke belakang")', (() => {
  const p = walk.indexOf("key: 'promise'");
  const t = walk.indexOf("key: 'testimony'");
  const s = walk.indexOf("key: 'story'");
  return p > 0 && t > p && s > t;
})());
ok('tombol tambahnya jelas & memakai tombol utama bersama',
  /<PrimaryButton\s*\n\s*label="Catat Tanggal Penting"/.test(tab));
ok('daftarnya dikelompokkan per tahun', /testimonyYears\(list\)/.test(tab) &&
  /yearTitle: \{ \.\.\.SECTION_SPACE/.test(tab));
// Tombol isi-awal cuma boleh muncul selama arsipnya masih KOSONG.
ok('tombol "isi 4 catatan awal" cuma saat arsipnya masih kosong', (() => {
  const blok = /\{list\.length === 0 \? \([\s\S]*?\) : null\}/.exec(tab)?.[0] ?? '';
  return /Isi 4 catatan awal/.test(blok) && /onPress=\{isiAwal\}/.test(blok);
})());
ok('mengubah & menghapus lewat sheet yang sama (InlineDelete, bukan modal bertumpuk)',
  /<InlineDelete/.test(tab) && /<SheetModal/.test(tab));
ok('memakai komponen bersama, bukan salinan sendiri',
  /from '@\/components\/common\/DateField'/.test(tab) &&
  /from '@\/components\/common\/DualButtons'/.test(tab) &&
  /from '@\/hooks\/useFormSave'/.test(tab) &&
  /\.\.\.CARD,/.test(tab) && /\.\.\.SCREEN_CONTENT,/.test(tab));

// =====================================================================
console.log('\n=== 7. Aturan tetap proyek ===');
// =====================================================================
{
  const berkas = [lib, tab];
  ok('tidak ada warna hex mentah', !berkas.some((s) => /#[0-9A-Fa-f]{6}/.test(s)));
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|ditekan|menekan)\b/.test(s)));
  const emDash = [];
  for (const s of berkas) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  ok('tanpa modul native baru (cukup eas update)',
    !/from '(?!@\/|\.)/.test(tab.replace(/from '(react|react-native|expo-router)'/g, '')) ||
    !/react-native-(?!$)/.test(lib));
}

console.log('\n' + (gagal === 0 ? 'LULUS' : `GAGAL — ${gagal} cek`));
process.exit(gagal === 0 ? 0 : 1);
