// Batch rapihin: <ExpenseRow> (Car → Log & Residence → Log) dan
// useEditParam (Career Fulltime/Freelance & CORE Visitation).
// Yang dijaga: angka gaya, urutan isi, & perilaku TIDAK berubah.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

// ================= ExpenseRow =================
console.log('\nExpenseRow — Car → Log 🚗 & Residence → Log 🏠');
const row = baca('components/common/ExpenseRow.tsx');
const carLog = baca('components/car/LogTab.tsx');
const rumahLog = baca('components/residence/LogTab.tsx');

// Angka gaya HARUS sama persis dengan yang dulu ada di KEDUA berkas. Keenam
// angka kartunya sekarang tinggal di satu tempat (assets/style/card.ts), jadi
// yang dijaga: barisnya memakai bentuk baku itu + jarak/gap khasnya sendiri,
// dan bentuk bakunya masih berisi angka yang sama.
const cardTs = baca('assets/style/card.ts');
ok('kartu baris memakai bentuk baku + gap 10 & jarak bawah 10',
  /row: \{\s*\n\s*\.\.\.CARD,[\s\S]{0,200}gap: 10,\s*\n\s*marginBottom: 10,/.test(
    row.replace(/\r\n/g, '\n'),
  ));
ok('bentuk bakunya: CONTAINER + BORDER, radius 14, border 1, padding 14/12',
  /backgroundColor: Color\.CONTAINER,/.test(cardTs) &&
  /borderRadius: 14,/.test(cardTs) &&
  /borderWidth: 1,/.test(cardTs) &&
  /borderColor: Color\.BORDER,/.test(cardTs) &&
  /paddingHorizontal: 14,/.test(cardTs) &&
  /paddingVertical: 12,/.test(cardTs));
ok('kiri-kanan: isi rata kiri, nominal di kanan',
  /flexDirection: 'row',\s*alignItems: 'center',\s*justifyContent: 'space-between',/.test(row));
ok('gaya kiri/judul/nominal tidak bergeser',
  /left: \{ flex: 1, gap: 2 \}/.test(row) &&
  /title: \{ color: Color\.TEXT_TITLE \}/.test(row) &&
  /cost: \{ color: Color\.MAIN_DARK \}/.test(row));
ok('garis tepi hijau = penanda baris bisa ditekan',
  /rowActive: \{ borderColor: Color\.MAIN \}/.test(row));
ok('nominal tetap lewat formatRupiah bersama',
  /\{formatRupiah\(cost\)\}/.test(row));
ok('urutan isi baris tetap: judul → keterangan → nominal',
  row.indexOf('{title}') < row.indexOf('{children}') &&
  row.indexOf('{children}') < row.indexOf('{formatRupiah(cost)}'));

console.log('\n  …dan tiap fitur tetap membawa isinya sendiri');
ok('Car: garis hijau HANYA untuk catatan miliknya (bukan dari Finance)',
  /active=\{!item\.fromFinance\}/.test(carLog) &&
  /disabled=\{item\.fromFinance\}/.test(carLog));
ok('Car: penanda "💰 Data dari Finance" tetap ada',
  /💰 Data dari Finance/.test(carLog) &&
  /fromFinance: \{ color: Color\.MAIN \}/.test(carLog));
ok('Car: liter & Rp/L tetap dihitung & tampil',
  /Math\.round\(item\.cost \/ item\.liters\)/.test(carLog) &&
  /formatDecimal\(item\.liters\)\} L/.test(carLog));
ok('Rumah: jenis + catatan tetap satu baris',
  /\{meta\.label\}\s*\{item\.note \? ` · \$\{item\.note\}` : ''\}/.test(rumahLog));
// Yang diperiksa <ExpenseRow>-nya saja — `active=` juga dipakai Chip pemilih
// jenis di dalam sheet, jadi tidak boleh dicari di seluruh berkas.
const rumahRow = rumahLog.slice(
  rumahLog.indexOf('<ExpenseRow'),
  rumahLog.indexOf('</ExpenseRow>'),
);
// 30 Agu 2026: Rumah ikut punya baris dari Finance (Expense › Residence),
// jadi aturannya kini SAMA PERSIS dengan Car: yang dicatat sendiri bisa
// ditekan, yang datang dari Finance baca-saja.
// 30 Agu 2026 (lanjutan): tombol "Catat Pengeluaran" di Rumah dibuang, jadi
// SEMUA barisnya datang dari Finance dan semuanya baca-saja — tidak ada lagi
// "sisanya bisa ditekan". Aturan Car tidak berubah.
ok('Rumah: seluruh barisnya baca-saja (semuanya dari Finance)',
  /active=\{false\}/.test(rumahRow) &&
  /disabled/.test(rumahRow) &&
  !/openEdit/.test(rumahRow));
ok('gaya kembarnya sudah dibuang dari kedua tab',
  !/rowLeft:/.test(carLog) && !/rowLeft:/.test(rumahLog) &&
  !/rowCost:/.test(carLog) && !/rowCost:/.test(rumahLog) &&
  !/rowEditable:/.test(carLog));
// `Color` dipakai lagi sejak ada penanda "💰 Data dari Finance" (warnanya
// sama dengan penanda kembarnya di Log Car). PressableScale tetap tak perlu —
// ExpenseRow sendiri yang menggambar barisnya. Penandanya sekarang satu baris
// di atas daftar (bukan per baris), karena SEMUA barisnya dari Finance.
ok('impor yang jadi nganggur ikut dibuang',
  !/PressableScale/.test(rumahLog) &&
  /source: \{ color: Color\.MAIN/.test(rumahLog));
// Judul kartunya boleh diringkas sendiri oleh pemiliknya (31 Agu 2026:
// "Pengeluaran rumah bulan ini" → "Pemakaian bulan …"). Yang dijaga di sini
// ISI-nya: kedua tab tetap punya kartu ringkasan berisi total bulan berjalan.
ok('sisa kedua tab tidak diutak-atik',
  /Total pengeluaran mobil/.test(carLog) &&
  /⛽ Terakhir isi bensin/.test(carLog) &&
  /<SummaryCard/.test(rumahLog) &&
  /formatRupiah\(monthTotal\)/.test(rumahLog));

// ================= useEditParam =================
console.log('\nuseEditParam — buka modal edit dari kartu reminder');
const hook = baca('hooks/useEditParam.ts');
const fulltime = baca('components/career/FulltimeTab.tsx');
const freelance = baca('components/career/FreelanceTab.tsx');
const visit = baca('components/core/VisitationTab.tsx');

ok('aturannya pindah ke satu hook', /export function useEditParam</.test(hook));
ok('penjagaan gandanya UTUH: param dibersihkan + ref anti-dobel',
  /if \(!editId \|\| consumedRef\.current === editId\) return;/.test(hook) &&
  /consumedRef\.current = editId;/.test(hook) &&
  /onConsumed\?\.\(\);/.test(hook));
ok('dependency efeknya sama persis dengan sebelumnya',
  /\}, \[editId, items, openEdit, onConsumed\]\);/.test(hook));
ok('id yang belum ketemu dibiarkan menggantung (data Firestore datang belakangan)',
  !/consumedRef\.current = editId;\s*\}\s*else/.test(hook));
// Catatan: di Freelance namanya `openDetail`, bukan `openEdit` — kartu
// reminder Home sekarang mendarat di HALAMAN RINCIAN proyek, bukan modal isian
// (isiannya sudah pindah ke layar sendiri). Hook & penjagaannya sama persis.
ok('dipakai ketiga tempatnya',
  /useEditParam\(items, openEdit, editId, onEditConsumed\)/.test(fulltime) &&
  /useEditParam\(projects, openDetail, editId, onEditConsumed\)/.test(freelance) &&
  /useEditParam\(visitations, openEdit, editId, onEditConsumed\)/.test(visit));
ok('salinan consumedRef sudah tidak ada di mana pun',
  !/consumedRef/.test(fulltime + freelance + visit));
ok('useRef yang jadi nganggur ikut dibuang',
  !/useRef/.test(fulltime) && !/useRef/.test(freelance) && !/useRef/.test(visit));
ok('callback-nya tetap useCallback (kalau tidak, efeknya jalan tiap render)',
  /const openEdit = useCallback\(/.test(fulltime) &&
  /const openDetail = useCallback\(/.test(freelance) &&
  /const openEdit = useCallback\(/.test(visit));
ok('induknya tetap membersihkan ?edit= dari URL',
  /router\.setParams\(\{ edit: '' \}\)/.test(baca('app/(tabs)/core.tsx')) &&
  /router\.setParams\(\{ edit: '' \}\)/.test(baca('app/(tabs)/work.tsx')));

// ================= Aturan wajib =================
console.log('\nAturan wajib');
// Log Rumah tak lagi menghapus apa pun — ia cuma membaca. Penghapusannya
// pindah ke Finance (menghapus transaksinya sekaligus melepas catatan
// rumahnya, lihat deleteResidenceLog di TransactionsTab).
ok('hapus tetap PERMANEN di layar yang disentuh',
  /deleteCarLog\(user\.uid, editing\.id\)/.test(carLog) &&
  /deleteResidenceLog\(user\.uid, editing\.id\)/.test(
    baca('components/finance/TransactionsTab.tsx')) &&
  /saveVisitations\(\s*user\.uid,\s*visitations\.filter/.test(visit));
ok('tidak ada soft-delete yang diselundupkan',
  !/isDeleted|archived: true/.test(row + hook + carLog + rumahLog));
ok('warna semua dari Color, tak ada kode warna mentah',
  !/#[0-9A-Fa-f]{6}/.test(row) && !/#[0-9A-Fa-f]{6}/.test(carLog));
ok('tidak ada dependency baru',
  !/from '(?!@\/|react|react-native)/.test(row + hook));

console.log(gagal === 0 ? '\n✅ LULUS — duplikat hilang, tampilan & perilaku sama.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
