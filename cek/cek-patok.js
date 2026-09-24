// Cek tombol utama sub-tab CORE benar-benar DIPATOK di atas daftar.
// 16 Sep 2026: jarak atas-bawah bar patoknya dipegang StickyTop sendiri
// (paddingTop 4 + pita 6 = CARD_GAP, paddingBottom CARD_GAP) dan SAMA di
// semua sub-tab; anaknya tidak menambah margin. Multiplication ikut dipatok.
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

// ---------- StickyTop: paddingnya harus sama dgn `content` yang lama ----------
console.log('\nStickyTop (komponen bersama)');
const sticky = baca('components/common/StickyTop.tsx');
ok('paddingHorizontal 20 (sama seperti content)', /paddingHorizontal:\s*20/.test(sticky));
ok('paddingTop 4 (+ pita header 6 = CARD_GAP di atas tombol)', /paddingTop:\s*4,/.test(sticky));
ok('paddingBottom CARD_GAP (jarak ke daftar dipegang bar-nya, sama di semua sub-tab)',
  /paddingBottom:\s*CARD_GAP,/.test(sticky) && /import \{ CARD_GAP \} from '@\/assets\/style\/card';/.test(sticky));
ok('latar = Color.BACKGROUND (nyatu dgn layar)', /backgroundColor:\s*Color\.BACKGROUND/.test(sticky));
ok('bukan position:absolute → kartu tidak ketutupan', !/position:\s*'absolute'/.test(sticky));

// ---------- Helper ----------
/** Posisi karakter kemunculan pertama; -1 kalau tak ada. */
const at = (s, t) => s.indexOf(t);

function cekPatok(label, file, tombol, opsi = {}) {
  console.log(`\n${label} (${file})`);
  const src = baca(file);

  const iSticky = at(src, '<StickyTop>');
  const iTombol = at(src, tombol);
  const iTutup = at(src, '</StickyTop>');
  // ScrollView DAFTARNYA = yang pertama SESUDAH StickyTop. (Di Pertemuan,
  // ScrollView pertama di file itu milik mode cari — bukan yang ini.)
  const iScroll = src.indexOf('<ScrollView', iTutup);

  ok('ada <StickyTop>', iSticky > -1);
  ok(`tombol "${tombol}" ada di DALAM StickyTop`,
    iSticky > -1 && iTombol > iSticky && iTombol < iTutup);
  ok('StickyTop DI ATAS ScrollView daftarnya (tidak ikut tergulung)',
    iSticky > -1 && iScroll > -1 && iSticky < iScroll);

  // Jarak atas total harus tetap: dulu content.paddingTop 8, sekarang
  // StickyTop.paddingTop 8 + content.paddingTop 0.
  if (opsi.contentPinned) {
    // 16 Sep 2026: paddingTop isi layar disamakan 4 di seluruh app
    // (pita 6 + 4 = CARD_GAP).
    ok('content lama tetap ada, paddingTop 4 seperti layar lain (dipakai mode cari)',
      /content:\s*{[^}]*paddingTop:\s*4/.test(src));
    ok('contentPinned paddingTop 0 (daftar yang dipatok)',
      /contentPinned:\s*{\s*paddingTop:\s*0\s*}/.test(src));
    ok('ScrollView daftar pakai [content, contentPinned]',
      /contentContainerStyle=\{\[styles\.content,\s*styles\.contentPinned\]\}/.test(src));
  } else {
    ok('content paddingTop 0 (jarak atas pindah ke StickyTop)',
      /content:\s*{[^}]*paddingTop:\s*0/.test(src));
  }

  // Anak StickyTop TIDAK menambah margin sendiri: jaraknya milik bar-nya.
  for (const [nama, re] of opsi.margin ?? []) {
    ok(`${nama} tidak lagi menambah margin sendiri`, !re.test(src), 'masih ada margin lepas');
  }

  // paddingBottom & paddingHorizontal tidak boleh ikut berubah.
  ok('paddingHorizontal 20 tetap', /content:\s*{[^}]*paddingHorizontal:\s*20/.test(src));
  if (opsi.paddingBottom != null) {
    ok(`paddingBottom ${opsi.paddingBottom} tetap (kartu terakhir tak ketutupan)`,
      new RegExp(`content:\\s*{[^}]*paddingBottom:\\s*${opsi.paddingBottom}`).test(src));
  }
  return src;
}

// ---------- Monthly ----------
const monthly = cekPatok('Monthly 🗒️', 'components/core/MonthlyTab.tsx',
  'label="Buat Rapat Bulanan"', {
    paddingBottom: 90,
    margin: [['tombol Buat Rapat (addButton)', /addButton:\s*{\s*marginBottom/]],
  });
ok('kolom cari 🔍 ikut dipatok (SearchBar di dalam StickyTop)',
  monthly.indexOf('<SearchBar') > monthly.indexOf('<StickyTop>') &&
  monthly.indexOf('<SearchBar') < monthly.indexOf('</StickyTop>'));
ok('kolom cari tidak menambah margin sendiri (searchWrap dibuang)',
  !/searchWrap/.test(monthly));
ok('FAB 🔍 masih mengambang', /fab:\s*{[\s\S]*?position:\s*'absolute'/.test(monthly));
// 14 Sep sore: tombol hapusnya ikut form ke layar app/core/monthly/[id].tsx.
ok('hapus notulen tetap PERMANEN', /deleteMonthlyMeeting\(user\.uid,\s*id\)/.test(baca('app/core/monthly/[id].tsx')));

// ---------- Monthly: KEPALA KARTU ikut dipatok (23 Sep 2026) ----------
// Notulen satu rapat panjang; begitu dibentangkan, judul + tombol ✏️ 📤 dulu
// tergulung jauh ke atas. Sekarang kepala kartunya anak langsung ScrollView
// dan dipatok lewat stickyHeaderIndices.
console.log('\nMonthly 🗒️ — kepala kartu dipatok saat notulen dibentangkan');
ok('ScrollView daftar memakai stickyHeaderIndices',
  /stickyHeaderIndices=\{dipatok\}/.test(monthly));
ok('nomor patokannya dihitung bersamaan dengan barisnya (bukan angka ajaib)',
  /const baris: ReactNode\[\] = \[<FormError key="galat" message=\{error\} \/>\];/.test(monthly) &&
  /const dipatok: number\[\] = \[\];/.test(monthly) &&
  !/stickyHeaderIndices=\{\[/.test(monthly));
ok('kartu jadi ANAK LANGSUNG ScrollView, bukan dibungkus fragment',
  /\{baris\}\s*<\/ScrollView>/.test(monthly) && !/\{pageItems\.map\(/.test(monthly));
ok('tiap kepala kartu dipatok, jadi kepala berikutnya mendorong yang sebelumnya',
  /dipatok\.push\(baris\.length\);\s*\n\s*baris\.push\(renderHeader\(m, expanded\)\);/.test(monthly));
ok('isi notulen TIDAK ikut dipatok (didorong setelah kepalanya)',
  /if \(expanded\) baris\.push\(renderBody\(m\)\);/.test(monthly));
const kepala = monthly.slice(at(monthly, 'function renderHeader'), at(monthly, 'function renderBody'));
ok('tombol ubah & kirim ikut terpatok (ada di dalam kepala kartu)',
  /<EditButton onPress=\{\(\) => openEditor\(m\.id\)\}/.test(kepala) &&
  /icon="square\.and\.arrow\.up"/.test(kepala));
ok('judul, tanggal & tempat ikut terlihat saat dipatok',
  /\{m\.title\}/.test(kepala) && /formatCompactDateTime\(m\.date\.toDate\(\)\)/.test(kepala) && /\{m\.place\}/.test(kepala));
ok('barisnya dipegang View DI DALAM (style anak sticky pindah ke pembungkus RN)',
  /<View key=\{`kepala-\$\{m\.id\}`\} style=\{\[styles\.card, expanded && styles\.cardOpen\]\}>\s*\{\/\*[\s\S]{0,900}?<View style=\{styles\.cardHeader\}>/.test(kepala));
ok('latar kepala PEKAT (Color.CONTAINER) supaya isinya lewat di belakangnya',
  /card:\s*{\s*\n\s*backgroundColor:\s*Color\.CONTAINER/.test(monthly));
ok('kartu terbentang tetap satu kesatuan: sudut bawah kepala dilepas, isinya melanjutkan dindingnya',
  /cardOpen:\s*{[^}]*marginBottom:\s*0[^}]*borderBottomLeftRadius:\s*0[^}]*borderBottomRightRadius:\s*0/.test(monthly) &&
  /cardBody:\s*{[^}]*borderTopWidth:\s*0[^}]*borderBottomLeftRadius:\s*16[^}]*borderBottomRightRadius:\s*16/.test(monthly));
ok('baris "📸 N foto dokumentasi" dibuang (fotonya memang sudah tampil di bawahnya)',
  !/📸 \{m\.photos\.length\}/.test(monthly) && !/<VixText[^>]*>\s*📸/.test(monthly) && /photoUri\(photo\)/.test(monthly));

// ---------- Pertemuan ----------
const visit = cekPatok('Pertemuan 📅', 'components/core/VisitationTab.tsx',
  'label="Jadwalkan Visitasi"', {
    contentPinned: true,
    paddingBottom: 90,
    margin: [['tombol Jadwalkan (addButton)', /addButton:\s*{\s*marginBottom/]],
  });
// Mode cari punya ScrollView sendiri & TIDAK menampilkan tombol jadwalkan.
const potongCari = visit.slice(at(visit, 'searchMode ? ('), at(visit, '<StickyTop>'));
ok('mode cari tidak ikut menampilkan tombol Jadwalkan',
  !potongCari.includes('label="Jadwalkan Visitasi"'));
ok('mode cari tetap pakai styles.content polos (jarak atasnya utuh)',
  /contentContainerStyle=\{styles\.content\}/.test(potongCari));
ok('tombol share per-kartu tetap ada', /icon="square\.and\.arrow\.up"/.test(visit));

// ---------- Leaders ----------
const leaders = cekPatok('Leaders 🫶', 'components/core/LeadersTab.tsx',
  'label="CORE Leader"', {
    paddingBottom: 24,
    margin: [['baris dua tombol (addRow)', /addRow:\s*{[^}]*marginBottom/]],
  });
ok('tombol "Main Team" ikut dipatok',
  leaders.indexOf('label="Main Team"') > leaders.indexOf('<StickyTop>') &&
  leaders.indexOf('label="Main Team"') < leaders.indexOf('</StickyTop>'));
ok('warna tombol Main Team tidak berubah (ACCENT / ACCENT_DARK)',
  /background=\{Color\.ACCENT\}[\s\S]{0,80}textColor=\{Color\.ACCENT_DARK\}/.test(leaders));
ok('dua tombol tetap sebaris & sama lebar (addRow row + addFlex flex:1)',
  /addRow:\s*{\s*flexDirection:\s*'row'/.test(leaders) && /addFlex:\s*{\s*flex:\s*1\s*}/.test(leaders));
// Baris hitungan orang ("N CORE Leader · N Main Team") sudah kamu hapus
// sendiri dari layar ini. Yang tetap diuji: StickyTop HANYA memuat dua tombol
// tambah — sisanya ikut tergulung, tidak ada yang diam-diam ikut dipatok.
ok('baris hitungan orang memang sudah tidak ada lagi',
  !/countLine/.test(leaders));
const patokAtas = leaders.slice(
  leaders.indexOf('<StickyTop>'),
  leaders.indexOf('</StickyTop>'),
);
ok('yang dipatok di atas cuma dua tombol tambah',
  (patokAtas.match(/<PrimaryButton/g) || []).length === 2 &&
  !/ScrollView/.test(patokAtas));

// ---------- Multiplication (16 Sep 2026: ikut dipatok) ----------
const multi = cekPatok('Multiplication 🌱', 'components/core/MultiplicationTab.tsx',
  'label="Buat Rencana Multiplikasi"', {
    paddingBottom: 40,
    margin: [['tombol Buat Rencana (addButton)', /addButton:\s*{\s*marginBottom/]],
  });
ok('daftar multiplikasi tetap di ScrollView di bawah bar-nya',
  multi.indexOf('<FormError') > multi.indexOf('</StickyTop>'));

// ---------- Ketiga tombol utama sama persis bentuknya ----------
console.log('\nTiga tombol utama: satu bentuk, satu jarak');
ok('Jadwalkan Visitasi, Buat Rapat Bulanan, Buat Rencana Multiplikasi semua PrimaryButton ikon plus tanpa gaya tambahan',
  [
    [visit, 'Jadwalkan Visitasi'],
    [monthly, 'Buat Rapat Bulanan'],
    [multi, 'Buat Rencana Multiplikasi'],
  ].every(([s, label]) => {
    // onPress-nya boleh berisi panah (=>), jadi batasnya panjang, bukan ">".
    const m = s.match(new RegExp('<PrimaryButton[\\s\\S]{0,40}label="' + label + '"[\\s\\S]{0,140}?\\/>'));
    return !!m && /icon="plus"/.test(m[0]) && !/additionalStyle/.test(m[0]);
  }));
ok('semua isi di bawah bar patok memakai paddingTop 0 (jaraknya dari bar)',
  /contentPinned:\s*{\s*paddingTop:\s*0\s*}/.test(visit) &&
  /content:\s*{[^}]*paddingTop:\s*0/.test(monthly) &&
  /content:\s*{[^}]*paddingTop:\s*0/.test(multi) &&
  /content:\s*{[^}]*paddingTop:\s*0/.test(leaders));

console.log(gagal === 0 ? '\n✅ LULUS — tombol dipatok, tampilan tidak bergeser.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
