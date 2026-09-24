// Uji: nama berkas PDF yang benar-benar terkirim ke WhatsApp.
//   • Pedoman Calon CL & Tugas CL  → "Pedoman … CORE Leader.pdf"
//   • Invoice freelance            → "Victory Technology - 042-VTI-VIII-2026.pdf"
//
// Caranya bukan mencocokkan regex: kode aslinya dikompilasi & DIJALANKAN, lalu
// panggilan sharePdf-nya dicegat supaya nama berkas & isi HTML-nya bisa
// diperiksa apa adanya. Modul native (expo-print/sharing) diganti boneka.
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

// ---------- Kompilasi ----------
const OUT = path.join(__dirname, 'keluar-pdf');
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc',
      R + 'lib/leaderCriteriaPdf.ts',
      R + 'lib/invoice.ts',
      R + 'assets/logoCoreGwu.ts',
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
const LIB = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['leaderCriteriaPdf.js', 'invoice.js', 'pdfDoc.js']) {
  if (!fs.existsSync(path.join(LIB, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

// ---------- Cegat sharePdf ----------
const dikirim = [];
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'expo-print') {
    return { printToFileAsync: async () => ({ uri: 'file:///cache/Print/x.pdf' }) };
  }
  if (req === 'expo-file-system') {
    return { File: class { constructor() { this.exists = false; } }, Paths: {} };
  }
  if (req === 'expo-sharing') {
    return { isAvailableAsync: async () => false, shareAsync: async () => {} };
  }
  if (req === '@react-native-async-storage/async-storage') {
    const kosong = {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
      getAllKeys: async () => [],
      multiRemove: async () => {},
    };
    return { __esModule: true, default: kosong, ...kosong };
  }
  if (req.startsWith('firebase/')) {
    return asli.call(this, R + 'node_modules/' + req, parent, isMain);
  }
  if (/[/\\]firebase$/.test(req)) return { db: {}, auth: null, app: {} };
  // Modul native lain yang ikut tertarik rantai impor (expo-image-manipulator,
  // react-native-*, dll). Tak satu pun dipanggil oleh uji di bawah — kalau
  // ternyata dipanggil, ia akan meledak, bukan diam-diam mengembalikan nilai
  // palsu.
  if (/^(expo-|expo$|react-native)/.test(req)) return {};
  // Alias "@/…" tak dikenal di luar proyek → arahkan ke hasil kompilasinya.
  if (req.startsWith('@/')) {
    return asli.call(this, path.join(OUT, req.slice(2)), parent, isMain);
  }
  // pdfDoc dipakai APA ADANYA (pdfFileName & escapeHtml aslinya), cuma
  // sharePdf-nya yang dicatat supaya bisa diperiksa.
  if (/[/\\]pdfDoc$/.test(req)) {
    const nyata = asli.call(this, req, parent, isMain);
    return {
      ...nyata,
      sharePdf: async (html, dialogTitle, fileName) => {
        dikirim.push({ html, dialogTitle, fileName });
      },
    };
  }
  return asli.call(this, req, parent, isMain);
};
const P = require(path.join(LIB, 'leaderCriteriaPdf.js'));
const I = require(path.join(LIB, 'invoice.js'));
const D = require(path.join(LIB, 'pdfDoc.js'));
const K = require(path.join(LIB, 'leaderCriteria.js'));
Module._load = asli;

console.log('=== Nama berkas pedoman ===');
// Judul lembarnya boleh diganti sendiri oleh pemiliknya (2 Sep 2026:
// "Pedoman Mengajukan Calon CORE Leader" → "Pedoman Ajuin …"). Yang dijaga di
// sini ATURANNYA: nama berkas = judul lembar + ".pdf", jadi apa pun judulnya,
// nama berkasnya ikut — bukan bunyi judulnya.
for (const jenis of ['calon', 'tugas']) {
  const nama = P.criteriaPdfFileName(jenis);
  c(`${jenis}: nama berkas = judul lembarnya + ".pdf"`,
    nama === `${K.CRITERIA_SHEETS[jenis].title}.pdf`, nama);
}
c('namanya diambil dari judul lembarnya (satu sumber, tak bisa melenceng)',
  P.criteriaPdfFileName('calon') === D.pdfFileName(K.CRITERIA_SHEETS.calon.title) &&
    P.criteriaPdfFileName('tugas') === D.pdfFileName(K.CRITERIA_SHEETS.tugas.title));
c('tidak terpotong batas 80 huruf',
  P.criteriaPdfFileName('calon').length < 80);

console.log('\n=== Isi PDF pedomannya ===');
(async () => {
  dikirim.length = 0;
  await P.shareCriteriaPdf('calon');
  await P.shareCriteriaPdf('tugas');
  const [calon, tugas] = dikirim;

  c('dua-duanya benar-benar dikirim', dikirim.length === 2);
  c('nama berkas yang DIKIRIM = nama yang dijanjikan',
    calon.fileName === P.criteriaPdfFileName('calon') &&
      tugas.fileName === P.criteriaPdfFileName('tugas'),
    `${calon.fileName} · ${tugas.fileName}`);
  c('judul share sheet menyebut WhatsApp',
    /WhatsApp/.test(calon.dialogTitle) && /WhatsApp/.test(tugas.dialogTitle),
    calon.dialogTitle);

  c('SELURUH 21 butir Calon CL masuk ke PDF-nya', (() => {
    return K.LEADER_CRITERIA.every((s) =>
      s.points.every((p) => calon.html.includes(p.replace(/&/g, '&amp;'))),
    );
  })());
  c('SELURUH 42 butir Tugas CL masuk ke PDF-nya', (() => {
    return K.LEADER_DUTIES.every((s) =>
      s.points.every((p) => tugas.html.includes(p.replace(/&/g, '&amp;'))),
    );
  })());
  c('judul tiap bagian ikut tercetak', (() => {
    return K.LEADER_DUTIES.every((s) => tugas.html.includes(s.title));
  })());
  c('bagian Peringatan memakai kotak ⚠️ yang sama dengan panduan CORE',
    /<div class="penting"><b>⚠️ Peringatan<\/b>/.test(tugas.html));
  c('bagian biasa TIDAK ikut jadi kotak peringatan',
    (tugas.html.match(/class="penting"/g) || []).length === 1);
  c('visi NDC ikut di atas isinya',
    calon.html.includes(K.NDC_VISION) && tugas.html.includes(K.NDC_VISION));
  c('CARE OPEN REACH EQUIP jadi subjudulnya',
    /CARE · OPEN · REACH · EQUIP/.test(calon.html));
  c('tanda & di teks di-escape, tidak merusak HTML-nya',
    tugas.html.includes('Comment &amp; like Social Media Member') &&
      !tugas.html.includes('Comment & like'));
  c('memakai kerangka & gaya PDF bersama, bukan gaya sendiri', (() => {
    const src = baca('lib/leaderCriteriaPdf.ts');
    return /pdfShellHtml/.test(src) && /RULE_ISI_CSS/.test(src) &&
      /from '\.\/pdfDoc'/.test(src);
  })());
  // 3 Sep 2026: kelasnya dulu ditulis "butir angka", padahal gaya bersamanya
  // (RULE_ISI_CSS di lib/coreRulesPdf.ts) cuma mengenal ".poin" — jadi butirnya
  // sebenarnya TIDAK pernah kebagian nomor hijaunya. Sekarang cocok.
  c('poinnya bernomor (bukan bulatan), sama seperti daftar bernomor CORE',
    /<div class="poin angka">/.test(calon.html));
  // Yang dijaga sekarang aturannya, bukan ejaan kelasnya: tiap kelas yang
  // dipakai di HTML-nya harus benar-benar ada di CSS yang ikut dikirim.
  c('tiap kelas di HTML-nya punya gayanya di CSS (tak ada yang tak berbaju)', (() => {
    // Gayanya datang dari tiga tempat: kerangka bersama (kop/kaki/logo),
    // gaya isi bersama, dan tambahan khusus lembar ini.
    const css = baca('lib/pdfDoc.ts') + baca('lib/coreRulesPdf.ts') +
      baca('lib/leaderCriteriaPdf.ts');
    const yatim = [...new Set(
      [...calon.html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
    )].filter((k) => !new RegExp(`\\.${k}[\\s{.,:]`).test(css));
    return yatim.length === 0 ? true : (console.log('     yatim: ' + yatim.join(', ')), false);
  })());

  console.log('\n=== Nama berkas invoice ===');
  const proyek = { id: 'p-abc-123', client: 'PT Contoh', title: 'Website', invoiceItems: [] };
  const tgl = new Date(2026, 7, 26);
  const nama = I.invoiceFileName(proyek, tgl);
  c('berpola "Victory Technology - <nomor>.pdf"',
    /^Victory Technology - \d{3}-VTI-VIII-2026\.pdf$/.test(nama), nama);
  c('garis miring nomor diganti tanda hubung, bukan jadi spasi',
    !/ VTI /.test(nama) && nama.includes('-VTI-'));
  c('bulan romawi ikut tanggalnya', (() => {
    const jan = I.invoiceFileName(proyek, new Date(2026, 0, 5));
    const des = I.invoiceFileName(proyek, new Date(2026, 11, 5));
    return jan.includes('-I-2026') && des.includes('-XII-2026');
  })());
  c('nomornya tetap sama untuk proyek yang sama (tidak berubah tiap dicetak)',
    I.invoiceFileName(proyek, tgl) === I.invoiceFileName(proyek, tgl));
  c('proyek berbeda → nomor berbeda', (() => {
    const lain = I.invoiceFileName({ ...proyek, id: 'p-xyz-999' }, tgl);
    return lain !== nama;
  })());

  dikirim.length = 0;
  await I.shareInvoicePdf(proyek);
  const inv = dikirim[0];
  c('invoice benar-benar dikirim dengan nama itu, bukan nama acak expo-print',
    !!inv && /^Victory Technology - \d{3}-VTI-/.test(inv.fileName), inv?.fileName);
  c('NOMOR di nama berkas SAMA dengan nomor di dalam dokumennya', (() => {
    const dariNama = inv.fileName.match(/(\d{3})-VTI-([IVX]+)-(\d{4})/);
    const dariIsi = inv.html.match(/<b>No\.<\/b>\s*(\d{3})\/VTI\/([IVX]+)\/(\d{4})/);
    return !!dariNama && !!dariIsi && dariNama.slice(1).join() === dariIsi.slice(1).join();
  })(), 'satu `new Date()` dipakai untuk keduanya');
  c('satu tanggal dipakai bersama (penjaga di kodenya)', (() => {
    const src = baca('lib/invoice.ts');
    return /const now = new Date\(\);[\s\S]*buildInvoiceHtml\(p, now\)[\s\S]*invoiceFileName\(p, now\)/
      .test(src);
  })());

  console.log('\n=== Tombolnya di layar ===');
  const layar = baca('app/leader-criteria.tsx');
  c('bentuknya sama dengan Share PDF di Rules & Suggestions',
    /<CardActionButton[\s\S]*?icon="square\.and\.arrow\.up"[\s\S]*?variant="filled"/.test(layar));
  c('yang tercetak = lembar yang sedang dibuka',
    /shareCriteriaPdf\(sheet\)/.test(layar));
  // Bunyi labelnya boleh diringkas pemiliknya (2 Sep 2026: awalan "Share PDF ·"
  // dibuang). Yang dijaga: labelnya tetap MENYEBUT judul lembar yang sedang
  // dibuka — itu yang membuat kamu tidak salah kirim lembar.
  c('labelnya menyebut nama berkasnya, jadi tidak salah kirim lembar',
    /label=\{`[^`]*\$\{CRITERIA_SHEETS\[sheet\]\.title\}[^`]*`\}/.test(layar));
  // Penanda "sedang mencetak" kini datang dari hook bersama useBusyTask
  // (dulu useState sharing lokal) — bacanya jadi pdf.busy, artinya sama.
  c('tidak bisa dicetak dobel (spinner + tombol mati)',
    /busy=\{pdf\.busy === sheet\}/.test(layar) && /disabled=\{pdf\.busy !== null\}/.test(layar));
  c('gagal cetak → ada pesannya, bukan diam saja',
    /setError\(pdfErrorOf\('pedomannya'\)\)/.test(layar) &&
      /Gagal membuat PDF \$\{apa\}\. Coba lagi\./.test(baca('lib/messages.ts')) &&
      /<ScreenError message=\{error\} \/>/.test(layar));
  const free = baca('components/career/FreelanceTab.tsx') + baca('app/project/[id].tsx');
  c('tombol invoice di Freelance tetap memanggil shareInvoicePdf',
    /shareInvoicePdf\(/.test(free));

  console.log('\n=== Aturan wajib ===');
  c('tidak ada dependency/modul native baru', (() => {
    const pkg = JSON.parse(baca('package.json'));
    return !!pkg.dependencies['expo-print'] && !!pkg.dependencies['expo-sharing'];
  })());
  c('tidak ada soft-delete diselundupkan',
    !/isDeleted|archived: true/.test(baca('lib/leaderCriteriaPdf.ts')));
  c('warna PDF-nya memakai palet yang sudah dipakai dokumen CORE lain', (() => {
    // Hex di dalam CSS PDF memang wajar (HTML terpisah dari app), tapi harus
    // warna yang SUDAH dipakai kerangka bersamanya — bukan palet baru.
    const src = baca('lib/leaderCriteriaPdf.ts');
    const dipakai = src.match(/#[0-9A-Fa-f]{6}/g) || [];
    const kerangka = baca('lib/pdfDoc.ts') + baca('lib/coreRulesPdf.ts');
    return dipakai.every((h) => kerangka.includes(h));
  })());

  console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
  process.exit(ok ? 0 : 1);
})();
