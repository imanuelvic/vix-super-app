// Cek sub-tab Pertemuan: agenda tidak lagi memenuhi kartu, dan filter jadwal
// memakai picker (bukan belasan chip).
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

const src = baca('components/core/VisitationTab.tsx');
const riwayat = baca('app/visitations.tsx');
// Isi kartunya sekarang milik bersama — dipakai kedua layar.
const kartu = baca('components/core/VisitationCardBody.tsx');

// ---------- Kartu jadwal ----------
console.log('\nKartu Jadwal Mendatang — agenda tidak lagi dicetak');
ok('blok agenda hilang dari kartu', !/🗒️ Agenda:/.test(src) && !/🗒️ Agenda:/.test(kartu));
ok('gaya khusus agenda ikut dibuang (tak ada gaya nganggur)',
  !/blockText/.test(src));
ok('bentuknya jadi sama dengan Visitation History 🕘 (satu komponen)',
  !/🗒️ Agenda:/.test(riwayat) &&
  /Agenda sengaja tidak ikut ditampilkan/.test(kartu) &&
  /<VisitationCardBody/.test(src) && /<VisitationCardBody/.test(riwayat));

console.log('\n…tapi agendanya TIDAK hilang, cuma disembunyikan');
ok('masih bisa dibaca & diubah lewat modal (kolom agenda di form bersama)',
  /🗒️ Agenda Visitasi/.test(baca('components/core/VisitationFormFields.tsx')));
ok('ketuk kartu → buka modal edit', /onPress=\{\(\) => openEdit\(v\)\}/.test(src));
ok('agenda tetap ikut tercetak di PDF pertemuan',
  /htmlParagraphs\(v\.agenda\)/.test(baca('lib/visitationPdf.ts')));
ok('pencarian 🔍 tetap menelusuri isi agenda',
  /const hay = `\$\{v\.note\} \$\{v\.agenda\}/.test(src));
ok('agenda tetap disimpan apa adanya (tidak dipotong)',
  /agenda: agenda\.trim\(\)/.test(baca('hooks/useVisitationForm.ts')));

// Yang masih harus tampil di kartu.
console.log('\nIsi kartu yang tetap ada');
for (const [nama, re, berkas] of [
  // Isi kartunya kini di VisitationCardBody (dipakai dua layar); tombol share
  // tetap milik tab Visitation karena bungkus kartunya memang beda.
  ['nama CORE-nya', /meetingLeaderNames\(v, leaders\)/, kartu],
  ['jenis visitasi', /meetingKindLabels\(v\)/, kartu],
  ['penanda acara gabungan', /🤝 \{v\.leaderIds\.length\} CORE gabung/, kartu],
  // Tanggalnya ringkas + jam pertemuan, bentuknya sama dengan kartu rapat
  // bulanan: "📆 Sen, 31 Agu 26 · 🕒 19.00".
  ['tanggal + jam', /📆 \{formatCompactDateTime\(v\.date\.toDate\(\)\)\}/, kartu],
  ['judul', /🏷️ Judul: \{v\.note\}/, kartu],
  ['hitung mundur / ✅ selesai', /<DeadlineTag tone=\{tone\}/, kartu],
  ['tombol share PDF', /icon="square\.and\.arrow\.up"/, src],
]) ok(nama, re.test(berkas));

// ---------- Filter jadwal ----------
console.log('\nFilter Jadwal — chip ➜ picker');
const iFilter = src.indexOf('title="🎚️ Schedule Filter"');
const isiFilter = src.slice(iFilter, src.indexOf('</SheetModal>', iFilter));
ok('modal filter ketemu', iFilter > -1);
ok('tidak ada lagi deretan chip di dalamnya', !/<Chip/.test(isiFilter));
ok('CORE Leader jadi picker', /<SelectField[\s\S]{0,200}value=\{filterLeaderId\}/.test(isiFilter));
ok('jenis pertemuan jadi picker', /<SelectField[\s\S]{0,200}value=\{filterKind\}/.test(isiFilter));
// Hitung prop-nya saja (baris `clearable` sendirian), bukan kata "clearable"
// yang kebetulan ikut disebut di komentar penjelasnya.
ok('dua-duanya bisa dikosongkan lagi (clearable)',
  (isiFilter.match(/^\s*clearable$/gm) ?? []).length === 2);
ok('placeholder-nya jelas = tanpa filter',
  /placeholder="Semua CORE Leader"/.test(isiFilter) &&
  /placeholder="Semua jenis visitasi"/.test(isiFilter));
ok('gaya chip lama (leaderWrap) sudah dibuang', !/leaderWrap/.test(src));
ok('bentuknya sama dengan modal Jadwalkan Visitasi (SelectField yang sama)',
  /from '@\/components\/common\/SelectField'/.test(src) &&
  /from '@\/components\/common\/SelectField'/.test(baca('components/core/VisitationFormFields.tsx')));

// SelectField memang menutup daftarnya sendiri setelah dipilih.
const sf = baca('components/common/SelectField.tsx');
ok('daftar picker baru terbentang saat ditekan, lalu menutup lagi',
  /setOpen\(\(v\) => !v\)/.test(sf) && /setOpen\(false\);/.test(sf));
ok('pilih ulang yang aktif → filternya lepas (clearable)',
  /onChange\(clearable && active \? null : o\.key\)/.test(sf));

console.log('\nYang tidak boleh berubah');
ok('aturan penyaringnya sama persis',
  /\(!filterLeaderId \|\| v\.leaderIds\.includes\(filterLeaderId\)\)/.test(src) &&
  /filterKind === 'thanksgiving' && v\.thanksgiving/.test(src));
// Diuji dari KODENYA, bukan dari komentar di atasnya — komentarnya boleh saja
// dirapikan/dihapus tanpa membuat fiturnya hilang.
ok('chip penanda filter aktif di daftar tetap ada (ketuk = hapus filter)',
  /<View style=\{styles\.activeFilterRow\}>/.test(src) &&
  /onPress=\{\(\) => setFilterLeaderId\(null\)\}/.test(src) &&
  /onPress=\{\(\) => setFilterKind\(null\)\}/.test(src));
ok('tombol 🎚️ tetap menyala kalau ada filter aktif',
  /emoji="🎚️"[\s\S]{0,60}active=\{hasFilter\}/.test(src));
ok('Bersihkan & Selesai tetap ada',
  /Bersihkan/.test(isiFilter) && /Selesai/.test(isiFilter));
ok('tombol Jadwalkan tetap dipatok di atas', /<StickyTop>/.test(src));
ok('hapus jadwal tetap PERMANEN',
  /saveVisitations\(\s*user\.uid,\s*visitations\.filter/.test(src));

console.log(gagal === 0 ? '\n✅ LULUS — kartu ringkas, filter pakai picker.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
