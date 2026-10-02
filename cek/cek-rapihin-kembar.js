// /rapihin 2 Okt 2026 — tiga salinan kembar jadi satu tempat, nol perubahan
// perilaku & tampilan.
//
//   1. 💾 Simpan ke Foto / 📸 Buka Instagram — Bagikan Ayat, Pause & Pray, &
//      Generate Feed menulis alur yang sama persis (satu proses dua tombol,
//      gambar yang sama tidak disimpan dua kali, simpan DULU baru buka
//      Instagram). Sekarang hooks/useSaveToPhotos.ts + <PhotoSavedNote/>.
//   2. Formulir pertemuan — sub-tab Visitation & Visitation History sama-sama
//      memeriksa "CORE Leader belum dipilih" dan merakit jadwalnya sendiri.
//      Sekarang `form.problem()` & `form.build()` di hooks/useVisitationForm.ts.
//   3. Penulis jam "HH.MM" — empat tempat merangkai padStart sendiri. Sekarang
//      `formatHourMinute` di lib/format.ts (formatTime ikut memakainya).
//
// Alur simpan-ke-Foto DIJALANKAN sungguhan di sini dengan runtime React mini
// (useState yang ingat nilainya antar-render), karena yang dijaga bukan
// "kodenya ada", tapi janjinya: gambar sama tidak tersimpan dua kali,
// Instagram dibuka SESUDAH tersimpan, dan gagal tidak menjalankan langkah
// sesudahnya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ts = require(AKAR + '/node_modules/typescript');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Isi berkas TANPA komentar — supaya cek tidak membaca komentar sebagai kode. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

/** Jalankan satu berkas TS sebagai CommonJS, dengan impor yang ditentukan. */
function jalankan(berkas, impor) {
  const js = ts.transpileModule(baca(berkas), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  const req = (nama) => {
    if (nama in impor) return impor[nama];
    throw new Error(`${berkas}: impor tak terduga ${nama}`);
  };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
}

// =====================================================================
console.log('\n=== 1. Simpan ke Foto & buka Instagram: satu alur ===');
// =====================================================================

// Runtime React mini: nilai useState diingat per urutan panggilan, persis
// seperti React mengingatnya antar-render.
let sel = [];
let urut = 0;
const React = {
  useState(awal) {
    const k = urut++;
    if (!(k in sel)) sel[k] = typeof awal === 'function' ? awal() : awal;
    return [sel[k], (v) => { sel[k] = typeof v === 'function' ? v(sel[k]) : v; }];
  },
};
const busyTask = jalankan('hooks/useBusyTask.ts', { react: React });

const jejak = [];
let gagalSimpan = false;
const shareImage = {
  savePngToPhotos: async (png, nama) => {
    if (gagalSimpan) throw new Error('izin ditolak');
    jejak.push(`simpan:${nama}:${png}`);
  },
  openInstagram: async (target) => { jejak.push(`ig:${target}`); },
  photoErrorMessage: (e) => `GAGAL(${e.message})`,
};
const H = jalankan('hooks/useSaveToPhotos.ts', {
  react: React,
  '@/hooks/useBusyTask': busyTask,
  '@/lib/shareImage': shareImage,
});

let pesan = 'lama';
/** Satu render layar dengan isi `kunci`; mengembalikan hasil hook-nya. */
const render = (kunci, ekstra = {}) => {
  urut = 0;
  return H.useSaveToPhotos({
    kunci,
    buatPng: async () => `png(${kunci})`,
    namaBerkas: 'Story.png',
    instagram: 'story',
    setError: (p) => { pesan = p; },
    ...ekstra,
  });
};

(async () => {
  let f = render('ink|Mazmur 23');
  ok('awalnya tidak ada yang bekerja & belum tersimpan', f.busy === null && f.tersimpan === false);

  await f.jalankan('save');
  f = render('ink|Mazmur 23');
  ok('Simpan → tersimpan ke Foto sekali, pesan lama dibersihkan',
    jejak.join() === 'simpan:Story.png:png(ink|Mazmur 23)' && pesan === null, jejak.join());
  ok('…lalu tanda "Tersimpan" menyala untuk gambar ini', f.tersimpan === true);

  await f.jalankan('ig');
  f = render('ink|Mazmur 23');
  ok('Buka Instagram sesudah Simpan: TIDAK menyimpan ulang, cuma membuka',
    jejak.join() === 'simpan:Story.png:png(ink|Mazmur 23),ig:story', jejak.join());

  f = render('paper|Mazmur 23');
  ok('ganti rupa = gambar baru → tanda "Tersimpan" padam', f.tersimpan === false);
  jejak.length = 0;
  await f.jalankan('ig');
  ok('gambar baru: disimpan DULU, baru Instagram dibuka',
    jejak.join() === 'simpan:Story.png:png(paper|Mazmur 23),ig:story', jejak.join());

  // Gagal menyimpan: pesannya dari photoErrorMessage, Instagram TIDAK dibuka,
  // langkah `sesudah` (penanda feed hari ini) TIDAK jalan.
  sel = []; jejak.length = 0; gagalSimpan = true;
  let sesudah = 0;
  f = render('sage|Refleksi', { sesudah: async () => { sesudah++; } });
  await f.jalankan('ig');
  f = render('sage|Refleksi', { sesudah: async () => { sesudah++; } });
  ok('gagal: pesannya dari photoErrorMessage, Instagram & langkah sesudahnya tidak jalan',
    pesan === 'GAGAL(izin ditolak)' && jejak.length === 0 && sesudah === 0 && f.busy === null,
    `${pesan} | ${jejak.join()} | sesudah=${sesudah} | busy=${f.busy}`);

  gagalSimpan = false;
  await f.jalankan('save');
  ok('berhasil: langkah sesudahnya jalan SEKALI, sesudah gambarnya jadi', sesudah === 1);

  // ---------- Ketiga layarnya memakai alur itu, bukan salinan ----------
  const LAYAR = [
    ['app/bible-story.tsx', "instagram: 'story'", '`${design.key}|${reference}|${verse}`'],
    ['app/pause-pray.tsx', "instagram: 'story'", '`${design.key}|${doa}`'],
    ['app/reflection-feed.tsx', "instagram: 'app'", '`${design.key}|${text}`'],
  ];
  for (const [f2, tujuan, kunci] of LAYAR) {
    const src = kode(f2);
    const nama = f2.replace('app/', '').padEnd(20);
    ok(`${nama} memakai useSaveToPhotos (${tujuan})`,
      /useSaveToPhotos\(\{/.test(src) && src.includes(tujuan) && src.includes(`kunci: ${kunci}`));
    ok(`${nama} salinan lamanya hilang (useBusyTask · saved · simpanKeFoto)`,
      !/useBusyTask|setSaved|simpanKeFoto|openInstagram\(|savedNote/.test(src));
    ok(`${nama} tanda "Tersimpan" lewat <PhotoSavedNote/>`,
      /<PhotoSavedNote show=\{foto\.tersimpan\} \/>/.test(src));
  }
  ok('Pause & Pray: doa kosong tetap tidak bisa disimpan', /if \(!doa\) return;/.test(kode('app/pause-pray.tsx')));
  const rf = kode('app/reflection-feed.tsx');
  ok('Generate Feed: tanpa akun berhenti, penanda feed jadi langkah sesudahnya',
    /if \(!user\) return;\s*\n\s*return foto\.jalankan\(mode\);/.test(rf) &&
      /sesudah: async \(\) => \{\s*\n\s*if \(user\) await markFeedGenerated\(user\.uid, todayId\);/.test(rf));
  const catatan = kode('components/common/PhotoSavedNote.tsx');
  ok('<PhotoSavedNote/> = teks & gaya yang dulu disalin tiga kali',
    /✅ Tersimpan di Photos/.test(catatan) &&
      /note: \{ textAlign: 'center', color: Color\.SUCCESS \}/.test(catatan));
  ok('terusan reflectionFeed yang tak terpakai ikut dibuang',
    !/saveFeedToPhotos|openInstagram|photoErrorMessage/.test(kode('lib/reflectionFeed.ts')));

  // =====================================================================
  console.log('\n=== 2. Formulir pertemuan: pemeriksaan & perakitan di hook ===');
  // =====================================================================
  sel = [];
  const VF = jalankan('hooks/useVisitationForm.ts', {
    'firebase/firestore': { Timestamp: { fromDate: (d) => ({ ms: d.getTime() }) } },
    react: React,
    '@/lib/core': {
      isMultiLeaderKind: (k) => k === 'coreGabungan',
      newVisitationId: () => 'v-baru',
    },
    '@/lib/format': {
      daysBetween: (a, b) => Math.round((b - a) / 86400000),
    },
    '@/lib/messages': { PICK_LEADER_FIRST: 'Pilih CORE Leader-nya dulu.' },
  });
  urut = 0;
  let form = VF.useVisitationForm();
  ok('CORE Leader belum dipilih → simpan ditahan dengan kalimat lamanya',
    form.problem() === 'Pilih CORE Leader-nya dulu.');
  form.setLeaderIds(['cl1']);
  urut = 0;
  form = VF.useVisitationForm();
  ok('sudah dipilih → tidak ada yang menahan', form.problem() === null);
  const baru = form.build(null);
  ok('jadwal BARU: id baru & belum pernah dikirim PDF-nya',
    baru.id === 'v-baru' && baru.pdfSentDayId === null && baru.leaderIds.join() === 'cl1');
  const lama = { id: 'v-lama', pdfSentDayId: '2026-09-30' };
  const ubah = form.build(lama);
  ok('jadwal LAMA: id & catatan kirim PDF-nya dipertahankan',
    ubah.id === 'v-lama' && ubah.pdfSentDayId === '2026-09-30');
  ok('isinya tetap dari payload() (7 kolom form + id + pdfSentDayId)',
    Object.keys(ubah).sort().join() ===
      'agenda,date,done,id,kind,leaderIds,note,pdfSentDayId,thanksgiving');

  const vt = kode('components/core/VisitationTab.tsx');
  const vs = kode('app/visitations.tsx');
  ok('kedua layar memeriksa & merakit lewat hook, bukan salinan sendiri',
    [vt, vs].every((s) => /const masalah = form\.problem\(\);/.test(s) &&
      /const data = form\.build\(/.test(s) && !/form\.leaderIds\.length === 0/.test(s)));
  ok('kalimat "Pilih CORE Leader-nya dulu." tinggal SATU sumber',
    /PICK_LEADER_FIRST = 'Pilih CORE Leader-nya dulu\.'/.test(kode('lib/messages.ts')) &&
      /setMtFormError\(PICK_LEADER_FIRST\)/.test(kode('components/core/LeadersTab.tsx')) &&
      ![vt, vs, kode('components/core/LeadersTab.tsx')].some((s) => /'Pilih CORE Leader-nya dulu\.'/.test(s)));

  // =====================================================================
  console.log('\n=== 3. Satu penulis jam "HH.MM" ===');
  // =====================================================================
  const F = jalankan('lib/format.ts', {});
  ok('formatHourMinute(7, 5) = "07.05" · (23, 59) = "23.59"',
    F.formatHourMinute(7, 5) === '07.05' && F.formatHourMinute(23, 59) === '23.59');
  ok('formatTime tetap "HH.MM" dari Date, kini lewat penulis yang sama',
    F.formatTime(new Date(2026, 9, 2, 9, 3)) === '09.03' &&
      /return formatHourMinute\(d\.getHours\(\), d\.getMinutes\(\)\);/.test(kode('lib/format.ts')));
  const salin = /padStart\(2, '0'\)\}\.\$\{String\(/;
  for (const f3 of ['lib/tasks.ts', 'lib/notify.ts', 'hooks/useFutsalSessionForm.ts']) {
    ok(`${f3.padEnd(30)} tidak merangkai "HH.MM" sendiri lagi`,
      !salin.test(kode(f3)) && /formatHourMinute|formatTime/.test(kode(f3)));
  }
  const futsal = kode('hooks/useFutsalSessionForm.ts');
  ok('Futsal: jam yang disimpan = formatTime apa adanya (jamTeks dibuang)',
    /time: formatTime\(jam\),/.test(futsal) && /endTime: formatTime\(jamSelesai\),/.test(futsal) &&
      !/function jamTeks/.test(futsal));

  // =====================================================================
  console.log('\n=== 4. Kode mati ===');
  // =====================================================================
  const progress = kode('components/fitness/ProgressTab.tsx');
  ok('Progress: hitungan "minggu" & streak berjalan yang tak lagi digambar dibuang',
    !/const weeks = /.test(progress) && !/const count = streak/.test(progress));

  console.log(gagal === 0 ? '\n✅ LULUS — salinan kembar jadi satu, perilaku sama.'
    : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
})();
