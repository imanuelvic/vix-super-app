// Batch rapihin: UpkeepList (Car Parts + Residence Maintenance) &
// VisitationCardBody (tab Visitation + Riwayat Visitasi). Yang dijaga: angka
// gaya, urutan baris, dan perilaku simpan/hapus TIDAK berubah.
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

// ================= UpkeepList =================
console.log('\nUpkeepList — Car → Parts & Residence → Maintenance');
const up = baca('components/common/UpkeepList.tsx');
const parts = baca('components/car/PartsTab.tsx');
const chore = baca('components/residence/ChoreTab.tsx');

// Angka gaya HARUS sama persis dengan yang dulu ada di kedua file.
const GAYA_LAMA = {
  // (16 Sep 2026: paddingTop 4 = irama bersama seluruh app, pita 6 + 4.)
  content: `content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 }`,
  groupTitle: `groupTitle: { marginTop: 14, marginBottom: 8 }`,
  rowLabel: `rowLabel: { flex: 1, color: Color.TEXT_TITLE }`,
  dateLine: `dateLine: { color: Color.TEXT_PLACEHOLDER }`,
  // `flex: 1` ditambahkan saat tombol "🔴 Sekarang" masuk ke kanan atas dialog:
  // judulnya kini berbagi baris dengan tombol itu. Jarak bawahnya (2) sengaja
  // TIDAK berubah — yang bertambah cuma kemampuan judulnya memanjang.
  modalTitle: `modalTitle: { flex: 1, marginBottom: 2 }`,
  modalHint: `modalHint: { marginBottom: 10 }`,
  noteInput: `noteInput: { marginTop: 10, minHeight: 76, textAlignVertical: 'top' }`,
};
for (const [nama, potong] of Object.entries(GAYA_LAMA)) {
  ok(`gaya ${nama} tidak bergeser`, up.includes(potong), potong);
}
// Keenam angka kartunya pindah ke satu tempat (assets/style/card.ts) — dulu
// disalin utuh di 43 blok pada 32 berkas. NILAINYA tidak berubah, jadi yang
// dijaga sekarang dua hal: barisnya memang memakai bentuk baku itu, dan bentuk
// bakunya sendiri masih berisi angka yang sama persis.
const cardTs = baca('assets/style/card.ts');
ok('kartu baris memakai bentuk baku + jarak bawah 8',
  /row: \{\s*\n\s*\.\.\.CARD,[\s\S]{0,80}marginBottom: 8,/.test(up.replace(/\r\n/g, '\n')));
ok('bentuk bakunya: CONTAINER + BORDER, radius 14, border 1, padding 14/12',
  /backgroundColor: Color\.CONTAINER,/.test(cardTs) &&
  /borderRadius: 14,/.test(cardTs) &&
  /borderWidth: 1,/.test(cardTs) &&
  /borderColor: Color\.BORDER,/.test(cardTs) &&
  /paddingHorizontal: 14,/.test(cardTs) &&
  /paddingVertical: 12,/.test(cardTs));
ok('garis tepi warna tenggat tetap dipakai', /deadlineBorder\(row\.tone\)/.test(up));
ok('label tenggat tetap DeadlineTag', /<DeadlineTag tone=\{row\.tone\} label=\{row\.toneLabel\}/.test(up));
ok('urutan isi baris tetap: judul+status → tip → tanggal',
  up.indexOf('{row.label}') < up.indexOf('{row.tip}') &&
  up.indexOf('{row.tip}') < up.indexOf('{row.dateLine}'));
ok('dialog: judul → penuntun → tanggal → catatan → error → tombol',
  ['{editing?.label}', '{dialogHint}', '<DateField', '<FormInput', '<FormError', '<DualButtons']
    .every((t, i, arr) => i === 0 || up.indexOf(arr[i - 1]) < up.indexOf(t)));
ok('key DateField tetap per baris (picker reset tiap ganti barang)',
  /<DateField key=\{editing\?\.key\}/.test(up));
ok('catatan tetap di-trim sebelum disimpan', /fNote\.trim\(\)/.test(up));
// 15 Sep 2026 malam (/rapihin): busy/try/catch pindah ke hook bersama
// useFormSave — SAVE_ERROR & penjaga click-ganda kini ada di dalam save().
ok('gagal simpan tetap pakai SAVE_ERROR bersama (lewat useFormSave.save)',
  /const \{ busy, formError: error, setFormError: setError, save \} = useFormSave\(\);/.test(up) &&
    !/SAVE_ERROR/.test(up));
ok('tidak menyimpan dobel saat masih proses (penjaga busy di dalam save())',
  (up.match(/await save\(async \(\) => \{/g) || []).length === 2 && !/setBusy\(/.test(up));

console.log('\n  …dan tiap fitur tetap memakai rumus & teksnya sendiri');
ok('Car: rumus partCondition + interval bulan',
  /partCondition\(/.test(parts) && /tiap \$\{part\.intervalMonths\} bulan/.test(parts));
ok('Car: label nada "✅ Aman"', /ok: '✅ Aman'/.test(parts));
ok('Car: ringkasan "Kondisi perawatan"', /label: 'Kondisi perawatan'/.test(parts));
ok('Car: penuntun dialog "diganti / dicek"', /dialogHint="Kapan terakhir diganti \/ dicek\?"/.test(parts));
ok('Car: simpan tetap setPartDate', /setPartDate\(user\.uid, key, date, note\)/.test(parts));
ok('Rumah: rumus choreCondition + interval hari',
  /choreCondition\(/.test(chore) && /choreIntervalLabel\(chore\.intervalDays\)/.test(chore));
ok('Rumah: label nada "✅ Bersih"', /ok: '✅ Bersih'/.test(chore));
ok('Rumah: ringkasan "Kebersihan rumah"', /label: 'Kebersihan rumah'/.test(chore));
ok('Rumah: penuntun dialog "dibersihkan / dikerjakan"',
  /dialogHint="Kapan terakhir dibersihkan \/ dikerjakan\?"/.test(chore));
ok('Rumah: simpan tetap setChoreDate', /setChoreDate\(user\.uid, key, date, note\)/.test(chore));
ok('dua-duanya membaca catatan lama saat dialog dibuka',
  /noteOf=\{\(key\) => status\[key\]\?\.note \?\? ''\}/.test(parts) &&
  /noteOf=\{\(key\) => status\[key\]\?\.note \?\? ''\}/.test(chore));
ok('tidak ada lagi StyleSheet kembar di kedua tab',
  !/StyleSheet/.test(parts) && !/StyleSheet/.test(chore));

// ================= VisitationCardBody =================
console.log('\nVisitationCardBody — tab Visitation & Riwayat Visitasi');
const body = baca('components/core/VisitationCardBody.tsx');
const tab = baca('components/core/VisitationTab.tsx');
const riwayat = baca('app/visitations.tsx');
// cardTop sudah tidak ada: statusnya pindah ke KOLOM KANAN kartu (di bawah
// tombol share), jadi baris nama tak perlu lagi jadi baris dua kolom.
ok('cardTop ikut dibuang saat status pindah', !/cardTop:/.test(body));
ok('cardTitle / kindLine / statusDone tidak bergeser',
  /cardTitle: \{ color: Color\.TEXT_TITLE \}/.test(body) &&
  /kindLine: \{ color: Color\.MAIN \}/.test(body) &&
  /statusDone: \{ color: Color\.SUCCESS \}/.test(body));
// Dihitung dari bagian JSX-nya saja — kalau seluruh file ikut, yang kebaca
// malah urutan daftar impor di atas.
const bodyJsx = body.slice(body.indexOf('return ('));
ok('urutan baris tetap: nama → jenis → gabung → tanggal → judul',
  ['meetingLeaderNames', 'meetingKindLabels', 'CORE gabung', '📆', '🏷️ Judul:']
    .every((t, i, arr) => i === 0 || bodyJsx.indexOf(arr[i - 1]) < bodyJsx.indexOf(t)));
ok('status ✅ Selesai menggantikan hitung mundur, bukan menambah',
  /v\.done \? \([\s\S]{0,160}✅ Selesai[\s\S]{0,120}\) : \([\s\S]{0,80}<DeadlineTag/.test(body));
ok('status berdiri sendiri sebagai <VisitationStatus>',
  /export function VisitationStatus/.test(body));
ok('"N CORE gabung" cuma untuk acara gabungan', /v\.leaderIds\.length > 1 \?/.test(body));
ok('agenda tetap tidak dicetak di kartu', !/v\.agenda/.test(body));
ok('kedua layar memakai komponen yang sama',
  /<VisitationCardBody/.test(tab) && /<VisitationCardBody/.test(riwayat));
ok('gaya kembarnya sudah dibuang dari kedua layar',
  !/cardTop:/.test(tab) && !/cardTop:/.test(riwayat) &&
  !/statusDone:/.test(tab) && !/statusDone:/.test(riwayat));
// Bungkus kartunya memang BEDA — itu disengaja, jangan ikut disamakan.
// Dicek dari BENTUKNYA, bukan dari jarak antar-baris: isi area ketuk harus
// benar-benar bersih dari tombol. (Dulu diukur "dalam 600 karakter" — satu
// komentar tambahan saja sudah membuatnya gagal padahal susunannya benar.)
const areaKetuk = tab.slice(
  tab.indexOf('<PressableScale style={styles.cardTapArea}'),
  tab.indexOf('<View style={styles.cardSide}>'),
);
ok('tab Visitation tetap menaruh tombol share sebagai SAUDARA area ketuk',
  areaKetuk.length > 0 &&
  // area ketuk sudah DITUTUP sebelum kolom kanan dimulai…
  areaKetuk.includes('</PressableScale>') &&
  // …dan tak ada satu pun tombol di dalamnya.
  !areaKetuk.includes('EmojiButton'));
ok('Riwayat tetap satu PressableScale polos (tanpa tombol di dalamnya)',
  /<PressableScale[\s\S]{0,140}deadlineBorder\(tone\)\][\s\S]{0,400}<VisitationCardBody/.test(riwayat) &&
  !/EmojiButton/.test(riwayat));
ok('nama ex-CL tetap ikut terbaca di dua-duanya',
  /leaders=\{namaLeaders\}/.test(tab) &&
  /leaders=\{\[\.\.\.leaders, \.\.\.exLeaders\]\}/.test(riwayat));

// ================= Nada tenggat jadi satu sumber =================
console.log('\nNada tenggat: satu sumber, tidak bisa beda');
ok('PartTone = DeadlineTone', /export type PartTone = DeadlineTone;/.test(baca('lib/car.ts')));
ok('ChoreTone = DeadlineTone', /export type ChoreTone = DeadlineTone;/.test(baca('lib/residence.ts')));
ok('tidak ada lagi salinan daftar nadanya',
  !/'ok' \| 'warn' \| 'over' \| 'unknown'/.test(baca('lib/car.ts')) &&
  !/'ok' \| 'warn' \| 'over' \| 'unknown'/.test(baca('lib/residence.ts')));

// ================= Aturan wajib =================
console.log('\nAturan wajib');
ok('hapus tetap PERMANEN di layar yang disentuh',
  /saveVisitations\(user\.uid, all\.filter\(\(v\) => v\.id !== editing\.id\)\)/.test(riwayat));
ok('tidak ada soft-delete yang diselundupkan',
  !/isDeleted|archived: true/.test(up + body + parts + chore));
ok('warna semua dari Color, tak ada kode warna mentah',
  !/#[0-9A-Fa-f]{6}/.test(up) && !/#[0-9A-Fa-f]{6}/.test(body));
ok('tidak ada dependency baru (cuma yang sudah ada)',
  !/from '(?!@\/|react|react-native)/.test(up + body));

console.log(gagal === 0 ? '\n✅ LULUS — duplikat hilang, tampilan & perilaku sama.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
