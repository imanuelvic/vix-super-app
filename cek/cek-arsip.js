// Cek kartu Ex CORE Leader: hapus permanen pindah ke ✕ kanan atas, tombol
// kembalikan diringkas, dan jarak/padding kartunya dilonggarkan.
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

const src = baca('app/ex-leaders.tsx');

// ---------- Tombol ✕ ----------
console.log('\nHapus permanen → tombol ✕ kanan atas');
ok('link "Hapus permanen dari arsip" di bawah kartu sudah hilang',
  !src.includes('InlineDelete') && !src.includes('Hapus permanen dari arsip"'));
// Warnanya tak lagi disetel dari sini: EmojiButton punya mode `danger` sendiri
// (merah penuh + ikon putih) supaya hapus permanen terbaca sama bahayanya di
// layar mana pun, sementara tombol lain ikut warna fiturnya.
ok('pakai EmojiButton ikon xmark bermode danger',
  /icon="xmark"[\s\S]{0,60}\n\s+danger\n/.test(src));
// Ada di ANTARA pembuka baris atas dan kotak "Alasan" → berarti masih di
// dalam baris atas kartu. (Jangan cari '</View>' pertama: itu penutup blok
// nama, bukan penutup barisnya.)
const iX = src.indexOf('icon="xmark"');
const iTop = src.indexOf('style={styles.cardTop}');
const iAlasan = src.indexOf('style={styles.reasonBox}');
ok('letaknya di dalam baris atas kartu (bareng hati & nama)',
  iX > -1 && iTop > -1 && iAlasan > -1 && iX > iTop && iX < iAlasan);
ok('menempel ke ATAS, tidak ikut ketengah (alignSelf flex-start)',
  /deleteCorner:\s*\{\s*alignSelf:\s*'flex-start'\s*\}/.test(src) &&
  /style=\{styles\.deleteCorner\}/.test(src));
ok('ukuran & bentuknya sama dengan tombol aksi kartu lain (EmojiButton 42px)',
  /button:\s*\{\s*\n?\s*width:\s*42/.test(baca('components/common/EmojiButton.tsx')));

// ---------- Konfirmasi ----------
console.log('\nKonfirmasi sebelum hilang selamanya');
ok('✕ tidak langsung menghapus — cuma membuka dialog',
  /onPress=\{\(\) => setConfirmDelete\(ex\)\}/.test(src));
ok('ConfirmDialog terpasang & tombolnya memanggil handleDelete',
  /<ConfirmDialog[\s\S]{0,400}onConfirm=\{handleDelete\}/.test(src));
ok('judul & tombolnya menyebut PERMANEN',
  /title="Hapus permanen dari arsip\?"/.test(src) &&
  /confirmLabel="Hapus permanen"/.test(src));
ok('dialog menyebut nama orangnya (tidak salah hapus)',
  /confirmDelete\?\.name/.test(src));
ok('hapusnya tetap PERMANEN (dokumen ditulis ulang tanpa dia)',
  /deleteExLeader\(user\.uid, exLeaders, confirmDelete\.id\)/.test(src) &&
  /exLeaders\.filter\(\(e\) => e\.id !== id\)/.test(baca('lib/core.ts')));
ok('tidak ada soft-delete (isDeleted/archived)',
  !/isDeleted|archived/.test(src));
ok('tak bisa menghapus saat ada aksi lain berjalan',
  /if \(!user \|\| !exLeaders \|\| !confirmDelete \|\| busyId\) return;/.test(src));
ok('dialog & tombolnya menunjukkan sedang bekerja',
  /busy=\{busyId !== null && busyId === confirmDelete\?\.id\}/.test(src));

// ---------- Tombol kembalikan ----------
console.log('\nTombol kembalikan');
// Kata "Kembalikan" sudah kamu pendekkan sendiri jadi "Kembali".
ok('tulisannya jadi "↩️ Kembali jadi CORE Leader"',
  /↩️ Kembali jadi CORE Leader/.test(src));
ok('tulisan lama "Pegang lagi" sudah tidak ada', !src.includes('Pegang lagi'));
// Tombolnya kini membuka konfirmasi dulu (biar tak kepencet tanpa sengaja);
// yang dikerjakan sesudah dikonfirmasi tetap restoreCoreLeader yang sama.
ok('fungsinya tidak berubah (tetap restoreCoreLeader, kini lewat konfirmasi)',
  /onPress=\{\(\) => setConfirmRestore\(ex\)\}/.test(src) &&
  /restoreCoreLeader\(user\.uid, leaders, exLeaders, confirmRestore\.id\)/.test(src));

// ---------- Jarak & padding ----------
console.log('\nJarak & padding kartu');
const angka = (nama, blok) => {
  const m = src.match(new RegExp(`${blok}:\\s*\\{[^}]*${nama}:\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
};
const pad = angka('padding', 'card');
const gap = angka('gap', 'card');
const bawah = angka('marginBottom', 'card');
const padAlasan = angka('padding', 'reasonBox');
ok(`padding kartu 16 → ${pad}`, pad === 18, `sekarang ${pad}`);
ok(`jarak antar-isi 12 → ${gap}`, gap === 14, `sekarang ${gap}`);
ok(`jarak antar-kartu 12 → ${bawah}`, bawah === 14, `sekarang ${bawah}`);
ok(`padding kotak "Alasan" 12 → ${padAlasan}`, padAlasan === 14, `sekarang ${padAlasan}`);
// Kotak Alasan tidak boleh melebar sampai menempel tepi kartu.
ok('kotak "Alasan" tetap di dalam padding kartu (tak ada margin negatif)',
  !/reasonBox:\s*\{[^}]*margin[^:]*:\s*-/.test(src));

// ---------- Yang tidak boleh berubah ----------
console.log('\nYang tidak boleh berubah');
ok('warna kartu tetap CONTAINER + garis BORDER',
  /card:\s*\{[\s\S]{0,200}backgroundColor:\s*Color\.CONTAINER[\s\S]{0,200}borderColor:\s*Color\.BORDER/.test(src));
ok('kotak "Alasan" tetap berlatar BACKGROUND',
  /reasonBox:\s*\{\s*\n?\s*backgroundColor:\s*Color\.BACKGROUND/.test(src));
ok('tombol kembalikan tetap hijau MAIN',
  /backgroundColor:\s*Color\.MAIN_TRANSPARENT[\s\S]{0,80}borderColor:\s*Color\.MAIN/.test(src));
ok('kartu kosong (belum ada ex CL) tidak diutak-atik',
  /Belum ada Ex CORE Leader/.test(src));
ok('urutan tetap yang terbaru dilepas di atas',
  /b\.exDayId\.localeCompare\(a\.exDayId\)/.test(src));

console.log(gagal === 0 ? '\n✅ LULUS — ✕ di kanan atas, tombol diringkas, kartu lebih lega.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
