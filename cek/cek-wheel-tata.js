// Tata letak ringkasan Wheel of Life.
//
// Yang dijaga di sini SATU jebakan yang sudah pernah kejadian: pil sebaran
// nada ("3 sehat · 4 perlu naik · 1 darurat") sempat berdiri di baris yang
// sama dengan judul "🎯 Quarter Focus". Lebar minimum ketiga pil itu mendorong
// judulnya sampai selebar NOL, dan tulisannya menumpuk satu huruf per baris —
// layarnya praktis tidak terbaca.
const AKAR = require('./akar');
const fs = require('fs');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

const layar = baca('app/wheel.tsx');

console.log('\n== 1. Judul "Fokus Kuartal" tidak bisa tergencet lagi ==');

// Kepalanya kini <SectionToggle/> — judul + tombol Ubah/Pilih yang DIPATOK di
// atas saat digulung (permintaan 4 Sep 2026). Yang dijaga tetap sama: yang
// berdiri di baris kepala itu HANYA judul & tombolnya, bukan pil sebaran.
const kepala = layar.slice(
  layar.indexOf('<SectionToggle'),
  layar.indexOf('{/* 2 */}'),
);
c('baris kepalanya ada', kepala.length > 0);
c('isinya HANYA judul + tombol Ubah/Pilih',
  kepala.includes('title="🎯 Quarter Focus"') &&
  kepala.includes('styles.editButton') &&
  !kepala.includes('styles.legendRow') &&
  !kepala.includes('styles.spreadBar'));
// Gaya kepala lamanya (sectionHeader/sectionHeadMain/sectionTitle) ikut dibuang
// — kalau ditinggal, ia jadi gaya mati yang tidak menggambar apa pun lagi.
c('gaya kepala lama tidak tertinggal jadi gaya mati',
  !layar.includes('sectionHeadMain') && !layar.includes('sectionHeader:'));
c('kartu fokus di bawahnya tetap dijaga lebarnya',
  /focusHeadMain: \{ flex: 1, minWidth: 0, gap: 1 \}/.test(layar));

console.log('\n== 2. Sebaran nada: batang + keterangan ==');

c('ada batang proporsinya, bukan cuma deretan pil',
  /styles\.spreadBar/.test(layar) && /styles\.spreadFill/.test(layar));
// Lebar ruas = banyaknya area bernada itu. Kalau flex-nya diisi angka tetap,
// batangnya berbohong: 1 darurat akan selebar 4 perlu naik.
c('lebar tiap ruas = BANYAKNYA area bernada itu',
  /styles\.fillOk, \{ flex: okCount \}/.test(layar) &&
  /styles\.fillWarn, \{ flex: warnCount \}/.test(layar) &&
  /styles\.fillDanger, \{ flex: dangerCount \}/.test(layar));
c('nada yang kosong tidak digambar (bukan ruas setipis rambut)',
  /\{okCount > 0 && \(/.test(layar) &&
  /\{warnCount > 0 && \(/.test(layar) &&
  /\{dangerCount > 0 && \(/.test(layar));
c('warnanya senada dengan pil keterangannya',
  /fillOk: \{ backgroundColor: Color\.SUCCESS \}/.test(layar) &&
  /fillWarn: \{ backgroundColor: Color\.WARNING \}/.test(layar) &&
  /fillDanger: \{ backgroundColor: Color\.DANGER \}/.test(layar) &&
  /toneOk: \{ color: Color\.SUCCESS \}/.test(layar) &&
  /toneWarn: \{ color: Color\.WARNING \}/.test(layar) &&
  /toneDanger: \{ color: Color\.DANGER \}/.test(layar));
c('ketiga pil keterangannya tetap ada',
  /\{okCount\} sehat/.test(layar) &&
  /\{warnCount\} perlu naik/.test(layar) &&
  /\{dangerCount\} darurat/.test(layar));

console.log('\n== 3. Letaknya masuk akal ==');

// 3+4+1 menghitung KEDELAPAN area. Di dalam kepala "Fokus Kuartal" (yang
// bicara soal 4 area terpilih) angkanya terbaca seolah tentang 4 area itu.
// Dicari dari JSX-nya, bukan dari tulisan "🎯 Quarter Focus" begitu saja —
// kalimat itu juga muncul di komentar penjelasnya di atas.
const judulFokus = 'title="🎯 Quarter Focus"';
c('sebarannya di bawah grafik, SEBELUM kepala Fokus Kuartal',
  layar.indexOf('<View style={styles.chartCard}>') <
    layar.indexOf('<View style={styles.spreadBox}>') &&
  layar.indexOf('<View style={styles.spreadBox}>') < layar.indexOf(judulFokus) &&
  layar.includes(judulFokus));
c('tombol Ubah/Pilih tetap di kepala Fokus Kuartal',
  /\{data\.focus\.length > 0 \? 'Ubah' : 'Pilih'\}/.test(kepala));

console.log('\n== 4. Aturan wajib ==');
c('warna semua dari Color, tak ada kode warna mentah',
  !/#[0-9A-Fa-f]{6}/.test(layar));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);