// 28 Sep 2026 — Visitation Recap 📊: kolom "Jenis" DIAM saat tabelnya digeser
// mendatar, dan lambang jenisnya terlihat seperti tombol.
//
// Dulu seluruh tabel ada di dalam satu ScrollView mendatar, jadi begitu digeser
// ke kanan untuk melihat CORE ke-7, kolom jenisnya ikut hilang dan angkanya
// jadi deretan tanpa nama. Sekarang tabelnya dua bagian bersebelahan: kolom
// Jenis yang diam, lalu sisanya yang bergeser.
//
// ── Kenapa suite ini ada, dan apa yang sebenarnya dijaga ──────────────────
// Bahaya satu-satunya dari pemisahan ini: dua bagian yang tingginya dihitung
// SENDIRI-SENDIRI akan berhenti sejajar begitu satu baris isinya lebih tinggi
// daripada pasangannya. Dan salah sejajar di tabel angka bukan cuma jelek — ia
// membuat angka terbaca di baris yang salah, dan itu tidak kelihatan sampai
// sudah telanjur dipercaya.
//
// Jadi yang dikunci di sini bukan tampilannya, melainkan PASANGANNYA: tiap
// baris di kiri wajib memakai gaya tinggi yang sama persis dengan baris
// pasangannya di kanan, dan angka tingginya wajib cocok dengan hitungan
// padding + garis + tinggi hurufnya sendiri.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const recap = baca('app/core-recap.tsx');
const vix = baca('components/common/VixText.tsx');

// =====================================================================
console.log('=== 1. Tabelnya dua bagian: yang diam & yang bergeser ===');
// =====================================================================
ok('pembungkusnya berbaris mendatar & memegang bingkai kartunya',
  /tableWrap: \{\s*\n\s*flexDirection: 'row',[\s\S]{0,200}borderRadius: 14,/.test(recap));
/** Letak ScrollView mendatarnya di berkas (ditulis bertingkat). */
const MULAI_GESER = recap.search(/<ScrollView\s+\n?\s*horizontal/);
ok('kolom Jenis berdiri DI LUAR ScrollView mendatar', (() => {
  const kolom = recap.indexOf('<View style={styles.freezeCol}>');
  return kolom > 0 && MULAI_GESER > kolom;
})());
ok('kolom diamnya bergaris kanan (tanda isi lewat di belakangnya)',
  /freezeCol: \{ borderRightWidth: 1, borderRightColor: Color\.BORDER \}/.test(recap));
// Tanpa flex:1, ScrollView mendatar di dalam baris melebar mengikuti isinya:
// begitu CORE-nya banyak, tabelnya melewati tepi layar dan yang di kanan
// TERPOTONG overflow hidden — bukan bisa digeser. Gejalanya persis seperti
// "datanya hilang", jadi ia dikunci di sini.
ok('lebar bagian yang bergeser dipatok sisa layar (flex: 1)',
  /scroller: \{ flex: 1 \}/.test(recap) && /style=\{styles\.scroller\}/.test(recap));

// Tiap baris punya pasangan: kepala · tanggal Thanksgiving · daftar jenis ·
// Total. Empat blok di kiri, empat blok di kanan.
const kiri = (recap.match(/styles\.freezeRow/g) || []).length;
const kanan = (recap.match(/styles\.dataRow/g) || []).length;
ok('jumlah blok baris kiri & kanan sama persis', kiri === kanan && kiri === 4,
  `kiri ${kiri} · kanan ${kanan}`);

// =====================================================================
console.log('\n=== 2. Tingginya dipatok, dan angkanya memang pas ===');
// =====================================================================
const angka = (nama) => {
  const m = new RegExp(`const ${nama} = ([\\d.]+);`).exec(recap);
  return m ? Number(m[1]) : null;
};
const ROW_H = angka('ROW_H');
const ROW_DATE_H = angka('ROW_DATE_H');
const ROW_TOTAL_H = angka('ROW_TOTAL_H');
ok('ketiga tinggi barisnya punya nama, bukan angka lepas',
  ROW_H !== null && ROW_DATE_H !== null && ROW_TOTAL_H !== null);

// Tinggi huruf diambil dari VixText, bukan diketik ulang di sini: kalau suatu
// hari ukuran teks app berubah, uji ini ikut berubah sendiri dan langsung
// menunjukkan baris mana yang jadi terpotong.
const lineHeight = (jenis) => {
  const m = new RegExp(`${jenis}: \\{ fontSize: \\d+, lineHeight: ([\\d.]+)`).exec(vix);
  return m ? Number(m[1]) : null;
};
const BOLD = lineHeight('bold');
const PAD = 8; // paddingVertical baris
const GARIS = 1; // borderBottomWidth
const GARIS_TOTAL = 1.5; // borderTopWidth baris Total
// Tanggal Thanksgiving: dua baris kecil, lineHeight-nya ditulis di layarnya.
const mDate = /cellDate: \{ fontSize: 11, lineHeight: (\d+) \}/.exec(recap);
const TANGGAL = mDate ? Number(mDate[1]) * 2 : null;

ok('tinggi huruf terbaca dari VixText & gaya tanggalnya', BOLD !== null && TANGGAL !== null,
  `bold ${BOLD} · tanggal ${TANGGAL}`);
ok(`baris biasa = ${BOLD} + ${PAD}×2 + ${GARIS}`, ROW_H === BOLD + PAD * 2 + GARIS, String(ROW_H));
ok(`baris tanggal = ${TANGGAL} + ${PAD}×2 + ${GARIS}`,
  ROW_DATE_H === TANGGAL + PAD * 2 + GARIS, String(ROW_DATE_H));
ok(`baris Total = ${BOLD} + ${PAD}×2 + ${GARIS_TOTAL} (garisnya di ATAS)`,
  ROW_TOTAL_H === BOLD + PAD * 2 + GARIS_TOTAL, String(ROW_TOTAL_H));
ok('padding & garis yang dipakai hitungan di atas memang yang tertulis di gayanya',
  new RegExp(`paddingVertical: ${PAD},`).test(recap) &&
    new RegExp(`borderBottomWidth: ${GARIS},`).test(recap) &&
    new RegExp(`borderTopWidth: ${GARIS_TOTAL},`).test(recap));

ok('ketiganya benar-benar dipasang ke gaya barisnya',
  /row: \{[\s\S]{0,400}height: ROW_H,\s*\n\s*\}/.test(recap) &&
  /dateRow: \{ height: ROW_DATE_H \}/.test(recap) &&
  /totalRow: \{[\s\S]{0,200}height: ROW_TOTAL_H,/.test(recap));

// Pasangan baris yang KHUSUS (tanggal & Total) wajib dipakai di KEDUA sisi —
// kalau cuma sebelah, dua bagiannya langsung melenceng di baris itu.
for (const [nama, gaya] of [['tanggal Thanksgiving', 'dateRow'], ['Total', 'totalRow'], ['kepala tabel', 'headRow']]) {
  const dipakai = (recap.match(new RegExp(`styles\\.${gaya}`, 'g')) || []).length;
  ok(`baris ${nama} memakai styles.${gaya} di KEDUA sisi`, dipakai === 2, `${dipakai}×`);
}

// =====================================================================
console.log('\n=== 3. Kolomnya jatuh di tempat semula ===');
// =====================================================================
// Kiri: padding 10 + lebar label 46 + napas kanan 6 = 62, sama persis dengan
// jarak label→kolom pertama sebelum dipisah (padding 10 + 46 + gap 6).
ok('napas kanan kolom diam = gap antar-kolom (6), jadi kolom CL tidak bergeser',
  /freezeRow: \{ paddingRight: 6 \}/.test(recap) && /gap: 6,/.test(recap));
ok('bagian yang bergeser tidak menambah napas kiri lagi',
  /dataRow: \{ paddingLeft: 0 \}/.test(recap));
ok('lebar kolom jenis tetap 46', /labelCol: \{ width: 46 \}/.test(recap));

// =====================================================================
console.log('\n=== 4. Lambang jenisnya terlihat seperti tombol ===');
// =====================================================================
const btn = /labelBtn: \{[\s\S]*?\n  \},/.exec(recap)?.[0] ?? '';
ok('berlatar & bersudut (pil), bukan lambang telanjang',
  /backgroundColor: Color\.CORE,/.test(btn) && /borderRadius: 8,/.test(btn));
ok('lebarnya sama dengan kolomnya (46)', /width: 46,/.test(btn));
// Ini yang menjaga tampilan tidak bergeser: pilnya setinggi isi barisnya
// sendiri. Kalau ia diberi padding tegak, SEMUA baris bertambah tinggi dan
// tabelnya memanjang tanpa ada yang meminta.
ok('setinggi isi barisnya (alignSelf stretch), TANPA padding tegak sendiri',
  /alignSelf: 'stretch',/.test(btn) && !/paddingVertical/.test(btn));
ok('isinya tetap di tengah pil', /alignItems: 'center',/.test(btn) && /justifyContent: 'center',/.test(btn));

// Yang di-click tetap membuka penjelasan jenis acaranya — perilaku lama.
ok('click → dialog tengah berisi nama & penjelasan jenis acaranya',
  /setKindInfo\(\{\s*\n\s*icon: meta\.icon,\s*\n\s*label: meta\.label,\s*\n\s*desc: meta\.desc,/.test(recap) &&
  /<CenterDialog visible=\{kindInfo !== null\}/.test(recap));
ok('baris 📅 Thanksgiving juga masih bisa di-click',
  /onPress=\{\(\) => setKindInfo\(INFO_THANKSGIVING\)\}/.test(recap));
// Kepala kolom (hati CL) TIDAK ikut pindah: ia memang milik bagian yang
// bergeser, karena CL-nya sendiri yang bergeser.
ok('hati CL tetap di bagian yang bergeser (bukan ikut dibekukan)', (() => {
  const hati = recap.indexOf('onPress={() => setLeaderInfo(l)}');
  return MULAI_GESER > 0 && hati > MULAI_GESER;
})());

// =====================================================================
console.log('\n=== 5. Aturan tetap ===');
// =====================================================================
ok('tidak ada warna hex mentah', !/#[0-9A-Fa-f]{6}/.test(recap));
ok('istilahnya "click", bukan klik/ketuk/tekan',
  !/\b(klik|Klik|ketuk|Ketuk|ditekan|menekan)\b/.test(recap));
ok('tanpa tanda pisah panjang di teks yang tampil',
  !(recap.match(/'[^'\n]*'|`[^`\n]*`/g) || []).some((t) => t.includes(String.fromCharCode(0x2014))));
ok('napas isi layarnya tetap dari SCREEN_CONTENT',
  /content: \{ \.\.\.SCREEN_CONTENT, paddingBottom: 32 \}/.test(recap));

console.log('\n' + (gagal === 0 ? 'LULUS' : `GAGAL — ${gagal} cek`));
process.exit(gagal === 0 ? 0 : 1);
