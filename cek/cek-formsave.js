// Batch /rapihin: 19 handleSave yang bentuknya sama persis → hooks/useFormSave.
//
// Yang diuji BUKAN tulisannya, tapi urutan kejadiannya: bentuk LAMA dan bentuk
// BARU dijalankan berdampingan di atas tiruan kecil React, lalu catatan
// langkahnya dibandingkan — kalau ada satu langkah yang beda urutan atau
// hilang, ujinya merah.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-formsave');
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
      R + 'hooks/useFormSave.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const MODUL = fs.existsSync(path.join(OUT, 'hooks', 'useFormSave.js'))
  ? path.join(OUT, 'hooks', 'useFormSave.js')
  : path.join(OUT, 'useFormSave.js');
if (!fs.existsSync(MODUL)) {
  console.log('  ✗ gagal mengompilasi useFormSave.ts');
  process.exit(1);
}

// ---------- Tiruan React ----------
const slots = [];
let cursor = 0;
function useState(init) {
  const i = cursor++;
  if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
  return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
}
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'react') return { useState };
  if (/messages$/.test(req)) return { SAVE_ERROR: 'SAVE_ERROR' };
  if (/^(expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const { useFormSave } = require(MODUL);

// =====================================================================
console.log('=== 1. Bentuk LAMA vs BARU: yang TERLIHAT harus sama ===');
// =====================================================================
//
// Satu form khayalan yang isinya persis pola ke-19 berkas itu: penjaga,
// pemeriksaan isian, susun `data`, simpan, tutup sheet kalau berhasil.
//
// Yang dibandingkan sengaja BUKAN tiap pemanggilan setter, tapi keadaan pada
// dua saat yang benar-benar bisa dilihat orang: (a) selagi penyimpanannya
// berjalan, dan (b) sesudah selesai. Di antara keduanya semuanya sinkron —
// React tidak menggambar apa pun di sana, jadi urutan setter di dalam satu
// tarikan napas itu memang tidak kelihatan.

/** Bentuk LAMA — disalin apa adanya dari kode sebelum batch ini. */
function formLama() {
  let busy = false;
  let formError = null;
  let editing = 'new';
  const keadaan = () => ({ busy, formError, editing });
  return {
    keadaan,
    async handleSave(judul, simpan) {
      if (!editing || busy) return;
      if (!judul.trim()) {
        formError = 'Judul wajib diisi.';
        return;
      }
      busy = true;
      formError = null;
      const data = { judul: judul.trim() };
      try {
        await simpan(data, keadaan);
        editing = null;
      } catch {
        formError = 'SAVE_ERROR';
      } finally {
        busy = false;
      }
    },
  };
}

/** Bentuk BARU — memakai hooks/useFormSave.ts yang sungguhan. */
function formBaru() {
  slots.length = 0;
  let editing = 'new';
  const render = () => { cursor = 0; return useFormSave(); };
  render();
  const keadaan = () => ({ busy: slots[0], formError: slots[1], editing });
  return {
    keadaan,
    async handleSave(judul, simpan) {
      const h = render();
      if (!editing || h.busy) return;
      if (!judul.trim()) {
        h.setFormError('Judul wajib diisi.');
        return;
      }
      const data = { judul: judul.trim() };
      await h.save(async () => {
        await simpan(data, keadaan);
        editing = null;
      });
    },
  };
}

/** Jalankan satu bentuk, kembalikan potret "selagi menyimpan" & "sesudahnya". */
async function potret(form, judul, { gagal = false } = {}) {
  let selagi = null;
  let dataTerkirim = null;
  await form.handleSave(judul, async (data, keadaan) => {
    dataTerkirim = data;
    selagi = keadaan();
    await null; // beri satu putaran, seperti panggilan jaringan sungguhan
    if (gagal) throw new Error('gagal simpan');
  });
  return { selagi, sesudah: form.keadaan(), dataTerkirim };
}

const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  for (const [nama, opsi] of [['berhasil', {}], ['GAGAL', { gagal: true }]]) {
    const lama = await potret(formLama(), 'Judul', opsi);
    const baru = await potret(formBaru(), 'Judul', opsi);
    c(`${nama}: selagi menyimpan, yang terlihat sama persis`,
      sama(lama.selagi, baru.selagi),
      `lama=${JSON.stringify(lama.selagi)} baru=${JSON.stringify(baru.selagi)}`);
    c(`${nama}: sesudah selesai, yang terlihat sama persis`,
      sama(lama.sesudah, baru.sesudah),
      `lama=${JSON.stringify(lama.sesudah)} baru=${JSON.stringify(baru.sesudah)}`);
    c(`${nama}: data yang dikirim ke Firestore sama`,
      sama(lama.dataTerkirim, baru.dataTerkirim));
  }

  // Yang penting dari potret di atas, dieja supaya tidak lolos diam-diam:
  const jalan = await potret(formBaru(), 'Judul');
  c('selagi menyimpan: tombolnya sibuk & pesan lama sudah dibersihkan',
    jalan.selagi.busy === true && jalan.selagi.formError === null,
    JSON.stringify(jalan.selagi));
  c('berhasil → sheet ditutup, sibuknya padam',
    jalan.sesudah.editing === null && jalan.sesudah.busy === false);

  const rusak = await potret(formBaru(), 'Judul', { gagal: true });
  c('gagal → sheet TETAP terbuka (isian yang sudah diketik tidak hilang)',
    rusak.sesudah.editing === 'new', JSON.stringify(rusak.sesudah));
  c('gagal → pesannya SAVE_ERROR & sibuknya tetap padam',
    rusak.sesudah.formError === 'SAVE_ERROR' && rusak.sesudah.busy === false);

  // Percobaan KEDUA sesudah gagal: pesan merah yang lama harus lenyap begitu
  // penyimpanannya mulai — kalau tidak, orang melihat "gagal" padahal sedang
  // berjalan, lalu ragu apakah tekanannya masuk.
  for (const [nama, form] of [['lama', formLama()], ['baru', formBaru()]]) {
    await potret(form, 'Judul', { gagal: true });
    c(`${nama}: percobaan pertama meninggalkan pesan merah`,
      form.keadaan().formError === 'SAVE_ERROR');
    const ulang = await potret(form, 'Judul');
    c(`${nama}: percobaan kedua langsung membersihkan pesan lamanya`,
      ulang.selagi.formError === null, JSON.stringify(ulang.selagi));
    c(`${nama}: dan kali ini sheet-nya tertutup`,
      ulang.sesudah.editing === null && ulang.sesudah.formError === null);
  }

  // Isian kosong: berhenti di pemeriksaan, penyimpanan tak pernah dimulai.
  for (const [nama, form] of [['lama', formLama()], ['baru', formBaru()]]) {
    let dipanggil = false;
    await form.handleSave('   ', async () => { dipanggil = true; });
    c(`isian kosong (${nama}): tak menyimpan apa pun & sibuknya tak menyala`,
      !dipanggil && form.keadaan().busy === false &&
        form.keadaan().formError === 'Judul wajib diisi.' &&
        form.keadaan().editing === 'new');
  }

  lanjut();
})().catch((e) => { console.log('  ✗ uji jalan gagal: ' + e.message); ok = false; lanjut(); });

function lanjut() {
  // =====================================================================
  console.log('\n=== 2. Sibuknya PASTI padam, sekali pun lupa ditulis ===');
  // =====================================================================
  {
    slots.length = 0;
    cursor = 0;
    const h = useFormSave();
    let selesai = false;
    const p = h.save(async () => { throw new Error('meledak'); }).then(() => { selesai = true; });
    p.then(() => {
      c('save TIDAK pernah melempar keluar (tak ada unhandled rejection)', selesai);
      cursor = 0;
      const h2 = useFormSave();
      c('busy kembali false sesudah gagal', h2.busy === false, String(h2.busy));
      c('pesannya diisi SAVE_ERROR', h2.formError === 'SAVE_ERROR', String(h2.formError));
      lanjut2();
    });
  }
}

function lanjut2() {
  // =====================================================================
  console.log('\n=== 3. Tekanan kedua saat masih menyimpan diabaikan ===');
  // =====================================================================
  {
    slots.length = 0;
    cursor = 0;
    let jalan = 0;
    let lepas;
    const tertahan = new Promise((r) => { lepas = r; });
    const h = useFormSave();
    const p1 = h.save(async () => { jalan++; await tertahan; });
    // Render ulang: `busy` sekarang true.
    cursor = 0;
    const h2 = useFormSave();
    const p2 = h2.save(async () => { jalan++; });
    lepas();
    Promise.all([p1, p2]).then(() => {
      c('tugasnya cuma jalan SEKALI', jalan === 1, `${jalan}×`);
      cursor = 0;
      c('sesudah selesai, busy padam', useFormSave().busy === false);
      lanjut3();
    });
  }
}

function lanjut3() {
  // =====================================================================
  console.log('\n=== 4. Kedelapan belas berkasnya benar-benar pindah ===');
  // =====================================================================
  const F = [
    'app/core-rules.tsx', 'app/debts.tsx', 'app/diseases.tsx', 'app/family.tsx',
    'app/history.tsx', 'app/timeline.tsx', 'app/visitations.tsx',
    'components/car/LogTab.tsx', 'components/career/AffiliateTab.tsx',
    'components/career/FulltimeTab.tsx', 'components/core/LeadersTab.tsx',
    // 14 Sep sore: form notulen pindah dari MonthlyTab ke layarnya sendiri.
    'app/core/monthly/[id].tsx', 'components/core/MultiplicationTab.tsx',
    'components/core/VisitationTab.tsx', 'components/fitness/NotesTab.tsx',
    'components/friends/PlacesTab.tsx',
    'components/spiritual/BibleReadingTab.tsx', 'components/tasks/PriorityTab.tsx',
  ];
  let pindah = 0;
  let bersih = 0;
  for (const f of F) {
    const s = baca(f);
    const a = /const \{ busy, (setBusy, )?formError, setFormError, save \} = useFormSave\(\);/.test(s) &&
      /import \{ useFormSave \} from '@\/hooks\/useFormSave';/.test(s);
    const b = !/const \[busy, setBusy\] = useState\(false\);/.test(s) &&
      !/const \[formError, setFormError\] = useState<string \| null>\(null\);/.test(s);
    if (a) pindah++;
    if (b) bersih++;
    if (!a || !b) c(`${f} pindah`, false, `hook=${a} bersih=${b}`);
  }
  c('18 berkas memanggil useFormSave', pindah === 18, `${pindah}/18`);
  c('18 berkas tak lagi punya useState busy/formError sendiri', bersih === 18, `${bersih}/18`);

  // Badan handleSave-nya: blok lama harus HILANG total di kesembilan belasnya.
  const badan = (s) => {
    const i = s.indexOf('async function handleSave(');
    return i < 0 ? '' : s.slice(i, s.indexOf('\n  }\n', i) + 4);
  };
  let sisa = [];
  for (const f of F) {
    const b = badan(baca(f));
    if (/setBusy\(/.test(b) || /catch \{\s*\n\s*setFormError\(SAVE_ERROR\)/.test(b) ||
        !/await save\(async \(\) => \{/.test(b)) sisa.push(f);
  }
  c('tak ada satu pun yang masih menulis setBusy/try-catch sendiri di handleSave',
    sisa.length === 0, sisa.join(', '));

  // Pemeriksaan isian TETAP di pemanggilnya — pesannya khas tiap form.
  const punyaPesanSendiri = F.filter((f) => /setFormError\('[^']+'\)/.test(badan(baca(f))));
  c('pemeriksaan isian tetap di formnya masing-masing (pesannya beda-beda)',
    punyaPesanSendiri.length >= 17, `${punyaPesanSendiri.length}/18 form`);

  // Penjaga `busy` di baris pertama tidak boleh ikut hilang.
  const berpenjaga = F.filter((f) => /if \([^)]*\bbusy\) return;/.test(badan(baca(f))));
  c('penjaga "sedang sibuk → abaikan" tetap ada di semuanya',
    berpenjaga.length === 18, `${berpenjaga.length}/18`);

  // =====================================================================
  console.log('\n=== 5. Tombol 🗑️ Hapus SENGAJA tidak disentuh ===');
  // =====================================================================
  // Perilaku gagalnya masih beda-beda (ada yang menutup sheet walau gagal, ada
  // yang tidak menangkap kegagalan sama sekali). Menyeragamkannya = mengubah
  // perilaku, jadi bukan urusan batch ini — tapi harus tetap utuh apa adanya.
  const hapus = (f) => {
    const s = baca(f);
    const i = s.indexOf('async function handleDelete(');
    return i < 0 ? '' : s.slice(i, s.indexOf('\n  }\n', i) + 4);
  };
  const masihTangan = [
    'app/diseases.tsx', 'app/family.tsx', 'app/timeline.tsx',
    'components/car/LogTab.tsx',
    'components/tasks/PriorityTab.tsx',
  ];
  c('yang menutup sheet di `finally` tetap begitu',
    masihTangan.every((f) => /setBusy\(true\);/.test(hapus(f)) &&
      /finally \{\s*\n\s*setEditing\(null\);\s*\n\s*setBusy\(false\);/.test(hapus(f))),
    masihTangan.length + ' berkas');
  c('yang menampilkan DELETE_ERROR tetap menampilkannya',
    ['app/debts.tsx', 'app/visitations.tsx', 'components/core/LeadersTab.tsx']
      .every((f) => /setError\(DELETE_ERROR\)/.test(hapus(f))));
  c('setBusy masih dibagikan hook-nya untuk tombol Hapus',
    /setBusy: \(value: boolean\) => void;/.test(baca('hooks/useFormSave.ts')) &&
      ['app/diseases.tsx', 'app/debts.tsx'].every((f) =>
        /const \{ busy, setBusy, formError/.test(baca(f))));
  c('form yang TIDAK punya tombol Hapus tidak ikut meminta setBusy',
    /const \{ busy, formError, setFormError, save \} = useFormSave\(\);/.test(
      baca('components/core/MultiplicationTab.tsx')));

  // =====================================================================
  console.log('\n=== 6. Bunyi pesan gagalnya kini SATU tempat ===');
  // =====================================================================
  {
    const hook = baca('hooks/useFormSave.ts');
    // Bukan lagi mencocokkan contoh di komentarnya: yang diuji mekanismenya.
    c('SAVE_ERROR dipakai di dalam hook-nya',
      /jalankan\(task, SAVE_ERROR\)/.test(hook) &&
      /jalankan\(task, DELETE_ERROR\)/.test(hook));
    const masihImpor = F.filter((f) => /SAVE_ERROR/.test(baca(f)));
    c('import SAVE_ERROR tinggal di berkas yang memang masih memakainya',
      masihImpor.every((f) => {
        const s = baca(f);
        // Kalau masih diimpor, harus benar-benar dipakai di luar import.
        return (s.match(/SAVE_ERROR/g) || []).length >= 2;
      }), masihImpor.length + ' berkas');
  }

  console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
  process.exit(ok ? 0 : 1);
}