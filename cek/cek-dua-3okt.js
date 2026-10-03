// Dua permintaan 3 Okt 2026 (malam):
//
//   1. Reminder 🔔 — jam ⏰ pindah ke KANAN baris (dulu satu baris sendiri di
//      bawah judul), kecil, sejajar baris pertama judulnya.
//   2. Finance 💰 — sesudah "Ya, Salin" di Edit Transaction, layar langsung
//      menunjukkan salinannya: mode cari ditutup, dan kalau yang sedang
//      dilihat bulan lain, layar pindah ke bulan berjalan (salinannya selalu
//      bertanggal hari ini) dan terbuka di jenis salinannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Kode tanpa komentar — supaya yang diuji yang benar-benar jalan. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// =====================================================================
console.log('\n=== 1. Reminder: jam di kanan baris ===');
{
  const t = kode('app/tasks.tsx');
  const baris = t.slice(t.indexOf('function DraggableTaskRow'), t.indexOf('const FAB_ACTIONS'));
  const iBody = baris.indexOf('<View style={styles.taskBody}>');
  const iJam = baris.indexOf('⏰ {jam}');
  const iTutupMain = baris.indexOf('</PressableScale>', iJam);
  ok('judul & catatan satu kolom (taskBody), jam ⏰ SESUDAHNYA di baris yang sama',
    iBody > -1 && iJam > iBody && baris.indexOf('</View>', iBody) < iJam &&
    iTutupMain > iJam);
  ok('catatan tetap di bawah judul, di dalam kolomnya',
    baris.indexOf('{item.note}') > iBody && baris.indexOf('{item.note}') < iJam);
  ok('barisnya mendatar: isi melebar, jam cuma selebar isinya',
    /taskMain: \{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 \}/.test(t) &&
    /taskBody: \{ flex: 1 \}/.test(t) &&
    /taskTime: \{ color: Color\.MAIN_DARK, marginTop: 1\.5 \}/.test(t));
  ok('jam tetap di dalam area click edit (tahan & geser tetap memindahkan)',
    /<PressableScale style=\{styles\.taskMain\} onPress=\{\(\) => onEdit\(item\)\}>/.test(baris) &&
    /<GestureDetector gesture=\{pan\}>/.test(baris));
}

// =====================================================================
console.log('\n=== 2. Finance: sesudah salin, langsung ke salinannya ===');
{
  const tx = kode('components/finance/TransactionsTab.tsx');
  const salin = tx.slice(tx.indexOf('async function handleCopy'), tx.indexOf('async function handleSaveEdit'));
  ok('bulan lain → minta pindah ke bulan berjalan, membawa jenis salinannya',
    /if \(now\.getFullYear\(\) !== year \|\| now\.getMonth\(\) !== month\) \{/.test(salin) &&
    /const copiedType = editing\.type;\s*\n\s*setTimeout\(\(\) => onShowToday\(copiedType\), 300\);/.test(salin));
  ok('bulan berjalan tapi sedang mencari → mode cari ditutup',
    /\} else if \(searchMode\) \{\s*\n\s*toggleSearch\(\);/.test(salin));
  ok('bulan berjalan tanpa mencari → tetap digulir ke atas seperti dulu',
    /\} else \{\s*\n\s*listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: true \}\);/.test(salin));
  ok('semuanya SESUDAH salinannya tersimpan & sheet ditutup',
    salin.indexOf('await addTransaction(') < salin.indexOf('setEditing(null);') &&
    salin.indexOf('setEditing(null);') < salin.indexOf('onShowToday('));
  ok('jenis yang terbuka bisa dititipkan (bawaan tetap Expense)',
    /const \[type, setType\] = useState<FinanceType>\(initialType \?\? 'expense'\);/.test(tx));

  const fin = kode('app/finance.tsx');
  ok('layar Finance: pindah ke bulan berjalan & menitipkan jenisnya untuk bulan itu saja',
    /onShowToday=\{\(type\) => \{\s*\n\s*setCopyLanding\(\{ month: monthId\(now\.getFullYear\(\), now\.getMonth\(\)\), type \}\);\s*\n\s*goNow\(\);/.test(fin) &&
    /copyLanding\?\.month === monthId\(year, month\) \? copyLanding\.type : undefined/.test(fin));
  // Yang membuat mode cari ikut tertutup di jalur "bulan lain": daftar
  // transaksi DILEPAS selama bulan baru dimuat, lalu dipasang ulang dengan
  // keadaan awal. Kalau suatu hari daftarnya dibiarkan terpasang saat ganti
  // bulan, handleCopy harus menutup mode carinya sendiri.
  ok('ganti bulan memang memasang ulang daftar transaksi (mode cari ikut tertutup)',
    /useKeyedData<string, Transaction\[\]>\(\s*\n\s*`\$\{year\}-\$\{month\}`,/.test(fin) &&
    /\) : loading \? \(\s*\n\s*<LoadingCenter \/>\s*\n\s*\) : tab === 'dashboard'/.test(fin));
  // Tunda 300 ms > animasi keluar sheet 220 ms: daftar baru dilepas sesudah
  // sheet-nya benar-benar turun.
  ok('tundaannya lebih lama dari animasi keluar sheet',
    /withTiming\(height, \{ duration: 220 \}/.test(baca('components/common/SheetModal.tsx')));
}

// =====================================================================
console.log('\n=== 3. Riwayat versi ===');
{
  const log = baca('lib/changelog.ts');
  ok('kedua perubahannya tercatat di entri paling atas',
    /'🔔 Jam reminder kini di kanan baris, sejajar judulnya'/.test(log) &&
    /'💰 Sesudah salin transaksi, layar pindah ke bulan berjalan tanpa mode cari'/.test(log) &&
    log.indexOf('💰 Sesudah salin transaksi') < log.indexOf("version: '2.0.0'"));
}

console.log(gagal === 0 ? '\n✅ LULUS — jam reminder di kanan & salin transaksi langsung kelihatan.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
