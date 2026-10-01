// Dua permintaan (28 Sep 2026, malam):
//
//   1. Kartu rekapan di atas daftar DIHAPUS, dan tombol tambahnya DIPATOK di
//      atas seperti tombol di CORE — di Walk (Testimony · Promise · Fasting)
//      dan di Work (Fulltime · Freelance · Affiliate). Jaraknya sama semua.
//   2. Template Chat: 🎂 Happy Birthday naik ke paling atas, tombol "Kirim"
//      per pilihan dibuang, dan KARTUNYA SENDIRI yang di-click untuk mengirim.
//      Huruf A/B/C dibuang; peringatan penanda yang belum diisi tetap ada.
//
// Yang DIJALANKAN sungguhan: urutan & isi CHAT_CATEGORIES (modul murni, tanpa
// Firestore). Sisanya dibaca dari kodenya, karena menyangkut tata letak.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ts = require(AKAR + '/node_modules/typescript');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

/** Semua .tsx di app/ & components/ — dipakai cek "dua arah" di bagian 3. */
const semuaTsx = ['app', 'components'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx$/.test(e.name) ? [d + '/' + e.name] : []);
});

// Keenam sub-tab yang diubah. Kolom: berkas · tulisan tombolnya · potongan
// yang HARUS tetap ada sesudah diubah (bukti perilakunya tidak ikut bergeser).
const PATOK = [
  ['components/spiritual/TestimonyTab.tsx', 'Catat Tanggal Penting', "buka('new')"],
  ['components/spiritual/PromiseTab.tsx', 'Tulis Janji Tuhan', "router.push('/promise')"],
  ['components/spiritual/FastingTab.tsx', 'Tambah Puasa Baru', 'onPress={() => open()}'],
  ['components/career/FulltimeTab.tsx', 'Tambah Kartu', 'onPress={openAdd}'],
  ['components/career/FreelanceTab.tsx', 'Tambah Proyek', "pathname: '/project/edit/[id]'"],
  // (1 Okt 2026: AffiliateTab dihapus bersama sub-tabnya.)
];
const sumber = Object.fromEntries(PATOK.map(([f]) => [f, baca(f)]));

// =====================================================================
console.log('=== 1. Kartu rekapan di atas daftar sudah dihapus ===');
// =====================================================================
{
  // Lima dari enam sub-tab memang punya kartu rekapan; Fasting tidak pernah
  // punya (di sana yang di atas kartu puasa yang SEDANG berjalan, dan itu
  // bukan rekapan — ia isi, bukan hitungan).
  for (const [f] of PATOK) {
    if (f.endsWith('FastingTab.tsx')) continue;
    // Impornya sekalian: kartu yang cuma dihapus dari JSX tapi impornya
    // tertinggal akan lolos kalau yang dicari cuma tag-nya.
    ok(`${path.basename(f)}: tidak ada lagi kartu ringkasan (beserta impornya)`,
      !/SummaryCard|summaryText/.test(sumber[f]));
  }
  // Bilah kemajuan His Promise ikut dibuang: tanpa kartunya ia cuma garis
  // tanpa keterangan.
  ok('Promise: bilah kemajuannya ikut dibuang (bukan tinggal garis tanpa angka)',
    !/ProgressBar/.test(sumber['components/spiritual/PromiseTab.tsx']));

  // Ini yang membedakan "dihapus" dari "dirobohkan": komponennya sendiri utuh
  // dan masih dipakai puluhan layar lain.
  const pemakai = semuaTsx.filter((f) => /from '@\/components\/common\/SummaryCard'/.test(baca(f)));
  ok(`SummaryCard sendiri tidak diutak-atik & masih dipakai ${pemakai.length} layar lain`,
    fs.existsSync(path.join(ROOT, 'components/common/SummaryCard.tsx')) && pemakai.length >= 25);

  // Tiga helper penghitung jadi yatim begitu kartunya hilang. Kalau dibiarkan,
  // ia jadi ekspor mati yang tidak pernah ketahuan lagi.
  const promiseLib = baca('lib/promise.ts');
  const testimonyLib = baca('lib/testimony.ts');
  const bersih = (s) => s.replace(/\/\/[^\n]*/g, '');
  ok('helper hitungan yang jadi yatim ikut dibuang (promiseProgress)',
    !/promiseProgress/.test(bersih(promiseLib)));
  ok('helper hitungan yang jadi yatim ikut dibuang (testimonyCounts & testimonyCountLine)',
    !/testimonyCounts|testimonyCountLine/.test(bersih(testimonyLib)));
}

// =====================================================================
console.log('\n=== 2. Keenam tombol tambah DIPATOK di atas ===');
// =====================================================================
for (const [f, label, jejak] of PATOK) {
  const s = sumber[f];
  const nama = path.basename(f);
  const blok = /<StickyTop>([\s\S]*?)<\/StickyTop>/.exec(s)?.[1] ?? '';

  ok(`${nama}: tombol "${label}" ada di DALAM bar patoknya`,
    blok.includes(`label="${label}"`));
  // Bar patoknya harus SAUDARA daftar & berdiri di atasnya — bukan di dalam
  // ScrollView (ikut tergulung) dan bukan position:absolute (menutupi kartu).
  const iTutup = s.indexOf('</StickyTop>');
  const iDaftar = Math.min(
    ...['<ScrollView', '<FlatList'].map((t) => {
      const i = s.indexOf(t, iTutup);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    }),
  );
  ok(`${nama}: bar patoknya DI ATAS daftarnya (tidak ikut tergulung)`,
    iTutup > -1 && iDaftar !== Number.MAX_SAFE_INTEGER);
  ok(`${nama}: jarak atas daftarnya dari token SCREEN_CONTENT_PINNED`,
    /content: \{ \.\.\.SCREEN_CONTENT_PINNED,/.test(s));
  // Jaraknya milik bar-nya, bukan tombolnya — kalau tombolnya masih bermargin,
  // sub-tab ini berdiri lebih tinggi daripada sub-tab sebelahnya.
  ok(`${nama}: tombolnya tidak menambah margin/gaya sendiri lagi`,
    !/addButton/.test(s));
  // Perilakunya tidak boleh ikut berubah: tombolnya masih memanggil yang sama.
  ok(`${nama}: yang dikerjakan tombolnya tetap sama`, s.includes(jejak));
}

// =====================================================================
console.log('\n=== 3. "Margin jarak yang sama" — dijamin satu token ===');
// =====================================================================
{
  const layout = baca('assets/style/layout.ts');
  ok('SCREEN_CONTENT_PINNED = SCREEN_CONTENT dengan paddingTop dinolkan',
    /export const SCREEN_CONTENT_PINNED: ViewStyle = \{\s*\n\s*\.\.\.SCREEN_CONTENT,\s*\n\s*paddingTop: 0,\s*\n\};/.test(layout));
  ok('jadi kiri-kanannya tetap 20, angka yang sama dengan seluruh app',
    /export const SCREEN_CONTENT: ViewStyle = \{\s*\n\s*paddingHorizontal: 20,\s*\n\s*paddingTop: 4,\s*\n\};/.test(layout));

  const sticky = baca('components/common/StickyTop.tsx');
  ok('bar patoknya memakai token yang sama + paddingBottom CARD_GAP',
    /\.\.\.SCREEN_CONTENT,/.test(sticky) && /paddingBottom: CARD_GAP,/.test(sticky));
  ok('bar patoknya bukan position:absolute (kartu di bawahnya tidak tertutup)',
    !/position: 'absolute'/.test(sticky));

  // Aturannya berlaku DUA ARAH. Ini cek terpenting di berkas ini: ia yang
  // membuat "semuanya dengan jarak yang sama" bisa dibuktikan, bukan cuma
  // diperiksa satu-satu lalu terlewat pada layar ke-13.
  const pakaiToken = semuaTsx.filter((f) => /\.\.\.SCREEN_CONTENT_PINNED/.test(baca(f))).sort();
  const pakaiPatok = semuaTsx.filter((f) => /<StickyTop>/.test(baca(f))).sort();
  // Lantainya 12 → 11 pada 1 Okt 2026: AffiliateTab dihapus bersama sub-tabnya.
  // Yang benar-benar dijaga tetap utuh, yaitu KESAMAAN kedua daftar itu.
  ok(`yang dipatok = yang jarak atasnya 0, dua arah (${pakaiToken.length} berkas)`,
    pakaiToken.length >= 11 && pakaiToken.join(',') === pakaiPatok.join(','),
    `token: ${pakaiToken.length} | patok: ${pakaiPatok.length}`);
  const nyalin = semuaTsx.filter((f) => /paddingHorizontal: 20,\s*paddingTop: 0/.test(baca(f)));
  ok('tidak ada lagi layar yang menyalin angkanya sendiri', nyalin.length === 0, nyalin.join(', '));
}

// =====================================================================
console.log('\n=== 4. Isi keenam sub-tab tidak ikut hilang ===');
// =====================================================================
{
  const t = sumber['components/spiritual/TestimonyTab.tsx'];
  ok('Testimony: pengelompokan per tahun & jenis tiap catatan tetap',
    /testimonyYears\(list\)/.test(t) && /testimonyKindMeta\(t\.kind\)/.test(t));
  ok('Testimony: tombol "isi 4 catatan awal" tetap ada saat arsipnya kosong',
    /Isi 4 catatan awal/.test(t) && /onPress=\{isiAwal\}/.test(t));

  const p = sumber['components/spiritual/PromiseTab.tsx'];
  ok('Promise: penanda 🙌/🙏/⏳ tiap kartu tetap — itu pengganti angkanya',
    /🙌 Digenapi/.test(p) && /🙏 Didoakan/.test(p) && /⏳ Dipegang/.test(p));
  ok('Promise: halamannya tetap berpaginasi', /usePagination/.test(p) && /<Pagination/.test(p));

  const f = sumber['components/spiritual/FastingTab.tsx'];
  ok('Fasting: kartu puasa yang SEDANG berjalan tetap di atas daftar',
    f.indexOf('styles.activeCard') < f.indexOf('others.map') &&
    /📆 Lihat Hari per Hari/.test(f));
  ok('Fasting: garis pemisah aktif ↔ arsip tetap ada',
    /\{active && <View style=\{styles\.pemisah\} \/>\}/.test(f));

  const ft = sumber['components/career/FulltimeTab.tsx'];
  ok('Fulltime: papan Rencana · Dikerjakan · Selesai tetap, lengkap jumlah kartunya',
    /<SegmentTabs/.test(ft) && /\$\{n\} kartu/.test(ft));

  const fr = sumber['components/career/FreelanceTab.tsx'];
  ok('Freelance: nilai tiap proyek tetap tertulis di kartunya',
    /formatRupiah\(nilai\)/.test(fr));

}

// =====================================================================
console.log('\n=== 5. Template Chat: 🎂 Happy Birthday paling atas ===');
// =====================================================================
const KATEGORI = (() => {
  const js = ts.transpileModule(baca('lib/chatTemplates.ts'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, () => ({}));
  return mod.exports;
})();
{
  const urut = KATEGORI.CHAT_CATEGORIES.map((c) => c.key);
  ok('kategori pertama = ulangtahun (dijalankan, bukan dibaca)',
    urut[0] === 'ulangtahun', urut.slice(0, 3).join(' → '));
  ok('Motivational Words tidak hilang, cuma turun satu',
    urut[1] === 'motivational');
  ok('jumlah kategorinya tetap 13 (tidak ada yang hilang saat dipindah)',
    urut.length === 13, String(urut.length));
  ok('tidak ada key kembar sesudah dipindah', new Set(urut).size === urut.length);
  ok('isi ucapan ulang tahunnya utuh (4 pilihan, semua berpenanda nama)', (() => {
    const c = KATEGORI.CHAT_CATEGORIES[0];
    return c.variants.length === 4 && c.variants.every((v) => v.text.includes('<nama>'));
  })());
  // Motivational Words tetap punya pintu lain, jadi turun peringkat tidak
  // membuatnya lebih sulit dijangkau tiap pagi.
  const layar = baca('app/chat-templates.tsx');
  ok('pintu ?cat=… dari modal Follow Up tetap hidup',
    /CHAT_CATEGORIES\.find\(\(c\) => c\.key === catParam\)\?\.key \?\? null/.test(layar));
  ok('penanda "hari ini" untuk Motivational Words tetap ada',
    /hari ini/.test(layar) && /category\.byDay === true && v\.key === today/.test(layar));
}

// =====================================================================
console.log('\n=== 6. Template Chat: kartunya sendiri yang di-click ===');
// =====================================================================
{
  const layar = baca('app/chat-templates.tsx');
  const varian = /<PressableScale\s*\n\s*key=\{v\.key\}([\s\S]*?)<\/PressableScale>/.exec(layar)?.[0] ?? '';

  ok('tiap pilihan jadi kartu yang bisa di-click', varian !== '');
  ok('yang di-click mengirim kalimat KARTU ITU', /onPress=\{\(\) => onSend\(text\)\}/.test(varian));
  // Komentar dikupas dulu: kodenya BOLEH menceritakan tombol yang dulu ada
  // (dan memang menceritakannya), yang tidak boleh cuma menggambarnya lagi.
  const kode = layar
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  ok('tombol "Kirim 💬" beserta gayanya sudah tidak ada',
    !/Kirim 💬/.test(kode) && !/sendButton|sendText/.test(kode));
  // Huruf A/B/C dibuang; NAMA HARI tetap, karena di Motivational Words penanda
  // itu keterangan sungguhan (mana yang untuk hari ini).
  ok('penanda pilihan hanya digambar untuk kategori per-hari',
    /\{category\.byDay === true && \(\s*\n\s*<View style=\{styles\.variantTop\}>/.test(varian));
  ok('huruf A/B/C memang tidak pernah digambar untuk kategori biasa', (() => {
    const i = varian.indexOf('styles.variantTop');
    const j = varian.indexOf('styles.variantBody');
    // Satu-satunya tempat {v.key} DIGAMBAR harus di dalam cabang byDay, yaitu
    // antara variantTop & badan kartunya. `key={v.key}` di baris pertama itu
    // prop React, bukan tulisan di layar — jadi dicari MULAI dari variantTop.
    const iGambar = varian.indexOf('{v.key}', i);
    return i > -1 && j > i && iGambar > i && iGambar < j &&
      varian.indexOf('{v.key}', j) === -1;
  })());
  ok('peringatan penanda yang belum diisi TETAP ada',
    /Masih ada penanda yang belum diisi/.test(varian) && /hasPlaceholder\(text\)/.test(varian));
  ok('ada lambang tujuannya supaya kartunya terbaca sebagai pengirim',
    /name="bubble\.left\.fill"/.test(varian));
  ok('kalimatnya melebar penuh, lambangnya menempel kanan',
    /variantBody: \{ flexDirection: 'row', alignItems: 'center', gap: 10 \}/.test(layar) &&
    /variantText: \{ color: Color\.TEXT_PARAGRAPH, flex: 1 \}/.test(layar));
  // Kartu di dalam kartu: yang dipatok (kolom nama) & kepala kategori tetap
  // Pressable sendiri-sendiri, BUKAN bersarang — di iOS Pressable bersarang
  // sering tidak menerima click-nya.
  ok('tidak ada PressableScale bersarang (kepala kategori & varian bersaudara)',
    !/<PressableScale[^>]*styles\.cardHeader[\s\S]{0,400}<PressableScale\s*\n\s*key=\{v\.key\}/.test(layar));
  // Tujuan kirimnya tidak berubah: nomor terisi → chat orangnya, selain itu →
  // pilih chat sendiri.
  ok('ke mana kirimnya tidak berubah',
    /if \(cl\?\.phone\) \{/.test(layar) && /openWhatsAppChat\(cl\.phone, text/.test(layar) &&
    /shareTextToWhatsApp\(text/.test(layar));
}

// =====================================================================
console.log('\n=== 7. Aturan tetap proyek ===');
// =====================================================================
{
  const berkas = [
    ...PATOK.map(([f]) => sumber[f]),
    baca('app/chat-templates.tsx'),
    baca('lib/chatTemplates.ts'),
    baca('assets/style/layout.ts'),
  ];
  ok('tidak ada warna hex mentah', !berkas.some((s) => /#[0-9A-Fa-f]{6}/.test(s)));
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|tekan|ditekan|menekan)\b/.test(s)));
  const emDash = [];
  for (const s of berkas) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  ok('tidak ada koleksi Firestore yang diganti nama',
    /'testimonies'/.test(baca('lib/testimony.ts')) && /'promises'/.test(baca('lib/promise.ts')));
  ok('tanpa modul native baru (cukup eas update)',
    !berkas.some((s) => /from 'react-native-(?!reanimated|gesture-handler|safe-area-context|svg|webview)/.test(s)));
}

console.log('\n' + (gagal === 0 ? '✅ LULUS — rekapan dibuang, tombol dipatok, kartu chat langsung kirim.'
  : `❌ ${gagal} cek gagal.`));
process.exit(gagal === 0 ? 0 : 1);
