// Tombol ✨ Rapihkan notulen (14 Sep 2026): hanya bisa di-click SEKALI per
// layar, hasilnya langsung mengisi kolom. Sejak sore 14 Sep form notulen
// pindah dari sheet ke layar sendiri (app/core/monthly/[id].tsx) dan pilnya
// duduk di header, kanan atas, sebaris dengan judul: labelnya dipendekkan jadi
// "✨ Rapihkan" supaya muat di samping "Ubah Notulen" (30pt) di layar 390pt.
const AKAR = require('./akar');
const fs = require('fs');
const ROOT = AKAR + '/';

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');
const layar = baca('app/core/monthly/[id].tsx');
const tab = baca('components/core/MonthlyTab.tsx');

console.log('teks & keadaan tombol');
c('teks "✨ Rapihkan" (header), bukan "Rapikan jadi kesimpulan"', /'✨ Rapihkan'/.test(layar) && !/Rapikan jadi kesimpulan/.test(layar));
c('selagi menunggu: "Merapihkan…" + spinner (SoftPill busy)', /'Merapihkan…'/.test(layar) && /busy=\{merapikan\}/.test(layar) && /<SoftPill/.test(layar));
c('sesudah berhasil: "✓ Sudah rapi"', /'✓ Sudah rapi'/.test(layar));

console.log('letak: header, bukan di dalam gulungan');
const slotKanan = /right=\{[\s\S]*?<SoftPill[\s\S]*?\}\s*\/>/.exec(layar)?.[0] ?? '';
c('pilnya di slot `right` ScreenHeader (sebaris dengan judul)', slotKanan.length > 0 && /<ScreenHeader[\s\S]*?right=\{/.test(layar));
// <ScreenHeader … /> ditulis SEBELUM <KeyboardAwareScrollView> dan bukan
// anaknya, jadi pil di dalamnya diam di tempat saat isi digulung.
c('header ada DI LUAR KeyboardAwareScrollView → tidak ikut tergulung',
  layar.indexOf('<SoftPill') > 0 &&
    layar.indexOf('<SoftPill') < layar.indexOf('<KeyboardAwareScrollView') &&
    layar.indexOf('<ScreenHeader') < layar.indexOf('<SoftPill'));
c('judulnya "Ubah Notulen" / "Catat Rapat"', /title=\{isNew \? 'Catat Rapat' : 'Ubah Notulen'\}/.test(layar));
c('MonthlyTab tidak lagi punya pil ✨ maupun sheet', !/SoftPill|SheetModal|rapikanNotulen/.test(tab));
c('MonthlyTab membuka layarnya lewat router (✏️ dan + Buat Rapat Bulanan)',
  /router\.push\(\{ pathname: '\/core\/monthly\/\[id\]', params: \{ id \} \}\)/.test(tab) &&
    /openEditor\(m\.id\)/.test(tab) && /openEditor\('new'\)/.test(tab));
c('rutenya terdaftar di _layout & typed routes', /name="core\/monthly\/\[id\]"/.test(baca('app/_layout.tsx')) && /\/core\/monthly\/\[id\]/.test(baca('.expo/types/router.d.ts')));

console.log('sekali saja');
c('ada penanda sudahRapi', /const \[sudahRapi, setSudahRapi\] = useState\(false\);/.test(layar));
c('tombol mati sesudah berhasil (busy → SoftPill sudah menonaktifkan sendiri)', /disabled=\{busy \|\| sudahRapi \|\| loading\}/.test(layar) && /disabled=\{disabled \|\| busy\}/.test(baca('components/common/SoftPill.tsx')));
c('handler pun menolak click kedua', /if \(merapikan \|\| busy \|\| sudahRapi\) return;/.test(layar));
c('penanda dinyalakan HANYA sesudah hasilnya masuk kolom (bukan saat gagal)',
  /setFPoints\(\(prev\) => \(\{ \.\.\.prev, \.\.\.rapi \}\)\);\s*\n\s*setSudahRapi\(true\);/.test(layar) &&
    !/catch \(e\) \{[\s\S]{0,120}setSudahRapi\(true\)/.test(layar));
c('gagal → tombol tetap hidup untuk dicoba lagi (setMerapikan(false) di finally)',
  /finally \{\s*setMerapikan\(false\);\s*\}/.test(layar));
// Dulu sheet-nya satu komponen yang dibuka-tutup, jadi penandanya harus
// dipulihkan di openAdd/openEdit. Sekarang tiap buka = mount layar baru:
// useState(false) sudah cukup, dan tidak boleh ada yang memulihkannya manual.
c('buka layar lagi → penandanya pulih sendiri (mount baru, tanpa setSudahRapi(false))',
  !/setSudahRapi\(false\)/.test(layar) && !/sudahRapi/.test(tab));
c('sesudah dipakai tombolnya pudar', /additionalStyle=\{sudahRapi && styles\.rapikanDone\}/.test(layar) && /rapikanDone: \{ opacity: 0\.5 \}/.test(layar));

console.log('hasil langsung masuk kolom');
c('jawaban server langsung menimpa kelima kolom (tanpa dialog, tanpa simpan)',
  /const rapi = await rapikanNotulen\(fPoints\);\s*\n\s*setFPoints\(\(prev\) => \(\{ \.\.\.prev, \.\.\.rapi \}\)\);/.test(layar) &&
    !/await rapikanNotulen[\s\S]{0,300}save\(/.test(layar));
c('kolom dikunci selagi merapikan', /editable=\{!busy && !merapikan\}/.test(layar));
c('label MENTORSHIP di bawahnya tidak menambah jarak sendiri', /fieldLabel: \{ marginBottom: 6 \}/.test(layar));
c('pesan gagal AI (kuota/offline) tampil di footer yang dipatok, bukan di ujung gulungan',
  // 16 Sep 2026: footer menambahkan insets.bottom sendiri (edges top saja).
  /<View style=\{\[styles\.footer, \{ paddingBottom: Math\.max\(insets\.bottom, 12\) \}\]\}>\s*<FormError message=\{formError\} \/>/.test(layar));

console.log('dokumen ikut');
c('AI-GRATIS.md menyebut nama & letak tombol yang baru', /\*\*✨ Rapihkan\*\* di kanan atas/.test(baca('AI-GRATIS.md')));

console.log(gagal === 0 ? 'CEK-RAPIHKAN-SEKALI OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
