// (1) Kartu ungu Sermon dibuang + pagination 10 · (2) validasi kembalikan CL ·
// (3) satu format tanggal+jam untuk Monthly & Visitasi · (4) Catatan Khotbah
// pindah ke layar sendiri + kolom baru · (5) garis pemisah modal baca-saja.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-sermon');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ===================================================================
console.log('\n=== 1. Kartu ringkasan dibuang + pagination 10 ===');
const tab = baca('components/spiritual/SermonTab.tsx');
ok('kartu ungu "⛪ Catatan Khotbah Minggu / N catatan tersimpan" sudah hilang',
  !/Catatan Khotbah Minggu/.test(tab) &&
  !/catatan tersimpan/.test(tab) &&
  !/heroCard/.test(tab));
ok('daftarnya berhalaman, pakai hook bersama (bawaan 10 per halaman)',
  /const \{ currentPage, pageCount, pageItems, setPage \} = usePagination\(sermons\)/.test(tab) &&
  /<Pagination page=\{currentPage\} pageCount=\{pageCount\} onChange=\{setPage\} \/>/.test(tab));
ok('yang dirender halamannya saja, bukan seluruh daftar',
  /pageItems\.map/.test(tab) && !/sermons\.map/.test(tab));
ok('ganti halaman → balik ke atas (key={currentPage})',
  /<ScrollView key=\{currentPage\}/.test(tab));

const hookPag = baca('hooks/usePagination.ts');
ok('bawaan hook-nya memang 10 per halaman',
  /export function usePagination<T>\(items: T\[\], size = 10\)/.test(hookPag));
ok('Pagination sembunyi sendiri kalau cuma 1 halaman (tak ada kontrol nyasar)',
  /Sembunyi otomatis kalau cuma 1 halaman/.test(baca('components/common/Pagination.tsx')));

// ===================================================================
console.log('\n=== 2. Validasi "Kembali jadi CORE Leader" ===');
const ex = baca('app/ex-leaders.tsx');
ok('tombolnya TIDAK lagi langsung mengembalikan — cuma membuka konfirmasi',
  /onPress=\{\(\) => setConfirmRestore\(ex\)\}/.test(ex) &&
  !/onPress=\{\(\) => handleRestore\(ex\.id\)\}/.test(ex));
ok('ada dialog konfirmasinya, menyebut namanya',
  /visible=\{confirmRestore !== null\}/.test(ex) &&
  /Kembalikan \$\{confirmRestore\?\.name \?\? ''\} jadi CORE Leader\?/.test(ex));
ok('akibatnya dijelaskan (masuk lagi ke follow up & arsipnya terhapus)',
  /ikut giliran follow up mingguan/.test(ex) &&
  /dihapus dari arsip/.test(ex));
ok('pengembalian baru jalan SETELAH dikonfirmasi',
  /if \(!user \|\| !leaders \|\| !exLeaders \|\| !confirmRestore \|\| busyId\) return;/.test(ex) &&
  /restoreCoreLeader\(user\.uid, leaders, exLeaders, confirmRestore\.id\)/.test(ex));
ok('tombolnya BUKAN merah — ini bukan aksi merusak',
  /danger=\{false\}/.test(ex));
ok('konfirmasi hapus permanen tetap merah seperti semula',
  /confirmLabel="Hapus permanen"/.test(ex) &&
  !/danger=\{false\}[\s\S]{0,200}confirmLabel="Hapus permanen"/.test(ex));
const dialog = baca('components/common/ConfirmDialog.tsx');
ok('ConfirmDialog tetap merah secara bawaan (pemakai lama tak berubah)',
  /danger = true,/.test(dialog) && /danger=\{danger\}/.test(dialog));

// ===================================================================
console.log('\n=== 3. Format tanggal+jam: SATU bentuk (kode dijalankan) ===');
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/format.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
const F = require(path.join(OUT, 'format.js'));

ok('bentuknya persis seperti kartu rapat bulanan: "Sel, 03 Mar 26 · 🕒 19.30"',
  F.formatCompactDateTime(new Date(2026, 2, 3, 19, 30)) === 'Sel, 03 Mar 26 · 🕒 19.30',
  F.formatCompactDateTime(new Date(2026, 2, 3, 19, 30)));
ok('tanggal & jam satu digit tetap 2 digit',
  F.formatCompactDateTime(new Date(2026, 8, 2, 9, 5)) === 'Rab, 02 Sep 26 · 🕒 09.05',
  F.formatCompactDateTime(new Date(2026, 8, 2, 9, 5)));
ok('bentuk lama yang cuma dipakai visitasi sudah dibuang',
  typeof F.formatVisitDateTime === 'undefined' &&
  !/formatVisitDateTime/.test(baca('lib/format.ts')));

const monthly = baca('components/core/MonthlyTab.tsx');
const cardBody = baca('components/core/VisitationCardBody.tsx');
ok('rapat bulanan memakai formatter bersama itu',
  /📆 \{formatCompactDateTime\(m\.date\.toDate\(\)\)\}/.test(monthly));
ok('kartu visitasi memakai formatter yang SAMA',
  /📆 \{formatCompactDateTime\(v\.date\.toDate\(\)\)\}/.test(cardBody));
// Lambang 🕒 masih SAH dipakai sebagai label kolom form ("🕒 Jam Mulai") —
// yang dilarang cuma menyusun BARIS TANGGAL kartunya sendiri-sendiri.
ok('lambang 🕒 ada di dalam formatternya — jadi mustahil beda antar-layar',
  /· 🕒 \$\{formatTime\(d\)\}/.test(baca('lib/format.ts')) &&
  !/📆 \{[\s\S]{0,120}🕒/.test(monthly) &&
  !/📆 \{[\s\S]{0,120}🕒/.test(cardBody));
ok('MonthlyTab tak lagi menyusun sendiri (impor lamanya ikut dibuang)',
  !/formatCompactDate,/.test(monthly) && !/formatTime/.test(monthly));
ok('Riwayat Visitasi ikut berubah tanpa disentuh (komponennya satu)',
  /<VisitationCardBody/.test(baca('app/visitations.tsx')));

// ===================================================================
console.log('\n=== 4. Catatan Khotbah: layar sendiri + 3 kolom ===');
const layar = baca('app/sermon.tsx');
const lib = baca('lib/sermon.ts');

ok('layarnya ada & terdaftar di typed routes',
  fs.existsSync(path.join(ROOT, 'app/sermon.tsx')) &&
  /sermon/.test(baca('.expo/types/router.d.ts')));
ok('daftar khotbah membuka LAYAR, bukan modal',
  /router\.push\(\{ pathname: '\/sermon', params: \{ id: sundayId \} \}\)/.test(tab) &&
  !/SheetModal/.test(tab));
ok('tambah catatan baru juga ke layar yang sama',
  /onPress=\{\(\) => buka\(todaySundayId\)\}/.test(tab));

console.log('\n--- Tiga kolom yang bisa diisi ---');
ok('💡 Quotes', /💡 Quotes/.test(layar) && /value=\{fQuote\}/.test(layar));
ok('📝 Catatan Khotbah (kolom BARU)',
  /📝 Catatan Khotbah/.test(layar) && /value=\{fNote\}/.test(layar));
ok('🏃🏻‍➡️ Aplikasi', /🏃🏻‍➡️ Aplikasi/.test(layar) && /value=\{fReflection\}/.test(layar));
ok('kolom catatan khotbah paling tinggi (yang paling panjang isinya)',
  /multiInputTall: \{ minHeight: 260/.test(layar));
ok('ketiganya multiline — enter bisa diketik',
  (layar.match(/multiline\n/g) || []).length >= 3 ||
  (layar.match(/\bmultiline\b/g) || []).length >= 3);

console.log('\n--- Kolom baru tersimpan & terbaca ---');
ok('`note` masuk tipe SermonNote', /note\?: string;/.test(lib));
ok('opsional — catatan LAMA tanpa kolom ini tidak error',
  /Opsional di tipe karena catatan LAMA/.test(lib));
ok('ikut disimpan ke Firestore', /note: string;/.test(lib) && /note: fNote\.trim\(\)/.test(layar));
ok('ikut terbawa saat di-share ke WhatsApp',
  /if \(s\.note\) lines\.push\('', '📝 Catatan Khotbah:', s\.note\);/.test(lib));
ok('teks share-nya dipakai bersama, bukan disalin ke dua tempat',
  /export function sermonShareText/.test(lib) &&
  !/function sermonShareText/.test(tab));

console.log('\n--- Enter terbaca saat dibaca ---');
ok('blok bacanya tidak memotong baris (tanpa numberOfLines)',
  /function ReadBlock\(\{ label, text \}/.test(layar) &&
  !/numberOfLines/.test(layar.slice(layar.indexOf('function ReadBlock'))));
ok('catatan & aplikasi ditampilkan utuh lewat blok itu',
  /<ReadBlock label="📝 Catatan Khotbah" text=\{note\.note \?\? ''\} \/>/.test(layar) &&
  /<ReadBlock label="🏃🏻‍➡️ Aplikasi" text=\{note\.reflection\} \/>/.test(layar));
ok('blok kosong tidak ditampilkan (tak ada judul tanpa isi)',
  /if \(!text\.trim\(\)\) return null;/.test(layar));
ok('di DAFTAR-nya tetap dipotong 2 baris — itu memang cuma cuplikan',
  /numberOfLines=\{2\}/.test(tab));

console.log('\n--- Aturan kunci Selasa tidak berubah ---');
ok('masih bisa diubah hanya selama Minggu & Senin',
  /sermonEditable\(sundayId, now\)/.test(layar) &&
  /lock\.setDate\(lock\.getDate\(\) \+ 2\)/.test(lib));
// 31 Agu 2026: kalimat penjelas arsipnya dibuang sendiri oleh pemiliknya —
// yang dijaga tinggal penanda 🔒-nya & sifat baca-sajanya.
ok('sudah terkunci → tombol ubah hilang, tapi tetap bisa dibaca & di-share',
  /\{bisaDiubah \? \(/.test(layar) &&
  /🔒 Arsip/.test(layar) &&
  // Tombol WA-nya kini <ShareWhatsAppButton/> — bunyinya dijaga di
  // cek-jarak-tombol.js, di sini yang penting tombolnya memang masih ada.
  /<ShareWhatsAppButton/.test(layar));
ok('hapus tetap PERMANEN & lewat konfirmasi',
  /deleteSermon\(user\.uid, sundayId\)/.test(layar) &&
  /confirmLabel="Hapus permanen"/.test(layar) &&
  /deleteDoc\(doc\(db, 'users', uid, 'sermons', id\)\)/.test(lib));
ok('satu catatan per Minggu tetap dijaga (id = dayId Minggunya)',
  /!sermons\.some\(\(s\) => s\.id === todaySundayId\)/.test(tab));
ok('layarnya cuma membaca SATU dokumen, bukan seluruh daftar',
  /subscribeSermon\(\s*\n?\s*user\.uid,/.test(layar) &&
  /export function subscribeSermon/.test(lib) &&
  /liveDoc\(/.test(lib));

console.log('\n--- Form tidak menimpa ketikan ---');
ok('isian diisi lewat tombol Ubah, bukan lewat efek yang jalan tiap snapshot',
  /function bukaForm\(s: SermonNote \| null\)/.test(layar) &&
  /onPress=\{\(\) => bukaForm\(note\)\}/.test(layar));

// ===================================================================
console.log('\n=== 5. Garis pemisah modal baca-saja ===');
const leaders = baca('components/core/LeadersTab.tsx');
ok('garisnya ada di PersonView', /<View style=\{styles\.viewDivider\} \/>/.test(leaders));
ok('membentang penuh sampai tepi sheet',
  /viewDivider: \{[\s\S]{0,160}marginHorizontal: -20,/.test(leaders));
ok('dipakai CL maupun Main Team (modalnya satu komponen)',
  (leaders.match(/<PersonView person=/g) || []).length === 1);

console.log(gagal === 0
  ? '\n✅ LULUS — kelima permintaan terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
