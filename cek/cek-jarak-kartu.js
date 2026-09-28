// 16 Sep 2026: SATU irama jarak kartu untuk seluruh app (CARD_GAP = 10):
// pita header → kartu pertama, kartu ringkasan → hero → pengingat → tombol
// tambah semuanya 10. Kartu daftar (baris) tetap 8. Plus tombol ✨ AI di sheet
// catatan diberi napas dari kotak teksnya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const semua = ['app', 'components'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx$/.test(e.name) ? [d + '/' + e.name] : []);
});

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const card = baca('assets/style/card.ts');
const header = baca('components/common/ScreenHeader.tsx');
const summary = baca('components/common/SummaryCard.tsx');

console.log('\n=== Satu angka bersama ===');
ok('CARD_GAP = 10 diekspor dari assets/style/card', /export const CARD_GAP = 10;/.test(card));
// 24 Sep 2026: angka 6 itu kini punya nama (`BAND_GAP`) dan DIEKSPOR, supaya
// baris sub-tab bisa meniadakannya dengan margin negatif sebesar angka yang
// sama. Jaraknya sendiri tidak berubah; yang dijaga sekarang justru lebih
// kuat: kedua tempat wajib memakai SATU angka, bukan dua angka kembar.
ok('pita header BAND_GAP (6) + paddingTop isi 4 = CARD_GAP (dicatat di kedua tempat)',
  /export const BAND_GAP = 6;/.test(header) && /marginBottom: BAND_GAP,/.test(header) &&
  /paddingTop 4 milik isi layar = CARD_GAP/.test(header) &&
  /paddingTop isi layar = 4/.test(card));
ok('baris sub-tab meniadakan napas itu dengan angka yang SAMA, bukan angka kembar',
  /marginTop: -BAND_GAP,/.test(baca('components/common/BottomTabs.tsx')) &&
  /import \{ BAND_GAP \} from '@\/components\/common\/ScreenHeader';/.test(
    baca('components/common/BottomTabs.tsx')));
ok('SummaryCard (kartu ringkasan gelap di ±30 tab) memakai CARD_GAP',
  /marginBottom: CARD_GAP,/.test(summary) && /import \{ CARD_GAP \} from '@\/assets\/style\/card';/.test(summary));

console.log('\n=== Pita header → kartu pertama: paddingTop 4 di seluruh layar ===');
const isi = semua
  .map((f) => [f, baca(f).match(/content: \{ paddingHorizontal: 20, paddingTop: (\d+)/)])
  .filter(([, m]) => m);
const bukan4 = isi.filter(([, m]) => m[1] !== '4' && m[1] !== '0');
ok(`semua layar berpita paddingTop 4 (${isi.length} berkas; 0 = daftar yang dipatok, sengaja)`,
  bukan4.length === 0, bukan4.map(([f, m]) => `${f}=${m[1]}`).join(', '));
// 28 Sep 2026: angka 0-nya tidak ditulis tangan lagi — ia datang dari token
// SCREEN_CONTENT_PINNED. Ceknya sekaligus naik kelas: dulu ia cuma menghafal
// nama tiga berkas (dan harus disunting tiap ada yang ikut dipatok), sekarang
// ia menuntut ATURANNYA berlaku DUA ARAH — yang jarak atasnya dinolkan harus
// yang tombolnya dipatok, dan yang tombolnya dipatok harus dinolkan. Lupa
// salah satunya = kartu pertama berdiri 4 piksel meleset dari sub-tab sebelah.
const pakaiPinned = semua.filter((f) => /\.\.\.SCREEN_CONTENT_PINNED/.test(baca(f))).sort();
const pakaiSticky = semua
  .filter((f) => /<StickyTop>/.test(baca(f)))
  .sort();
ok(`jarak atas 0 = tepat yang tombolnya dipatok, dua arah (${pakaiPinned.length} berkas)`,
  pakaiPinned.length > 0 && pakaiPinned.join(',') === pakaiSticky.join(','),
  `pinned: ${pakaiPinned.join(', ')} | sticky: ${pakaiSticky.join(', ')}`);

console.log('\n=== Kartu blok & tombol tambah: tidak ada angka lepas lagi ===');
const kartuBlok = [
  ['app/profile.tsx', 'hero'], ['app/daily-priority.tsx', 'hero'], ['app/donor.tsx', 'heroCard'],
  ['app/saku/[key].tsx', 'summaryCard'], ['components/finance/BudgetingTab.tsx', 'summaryCard'],
  ['components/finance/TransactionsTab.tsx', 'summaryCard'], ['components/games/TournamentTab.tsx', 'hero'],
  ['components/investment/MarketTab.tsx', 'hero'], ['components/news/PopulationTab.tsx', 'hero'],
  ['components/profile/PersonalityTab.tsx', 'hero'], ['components/learning/WeekTab.tsx', 'hero'],
  ['app/book/[key].tsx', 'progressCard'], ['app/family.tsx', 'infoCard'],
  // (28 Sep 2026: `introCard` Prayer Points dibuang — kartu pembukanya sendiri
  // yang dihapus atas permintaan pemilik app, bukan jaraknya yang dilonggarkan.)
  ['components/core/PrayerPointsTab.tsx', 'staleCard'], ['app/multiplication/[id].tsx', 'nextCard'],
  ['app/bible-reading.tsx', 'summaryCard'], ['app/reward.tsx', 'heroCard'], ['app/fasting.tsx', 'hero'],
  ['app/history.tsx', 'heroCard'], ['app/timeline.tsx', 'progressCard'], ['components/health/StepsTab.tsx', 'heroCard'],
  ['components/tasks/PriorityTab.tsx', 'heroCard'], ['components/residence/TokenTab.tsx', 'hero'],
  ['components/residence/TokenTab.tsx', 'dueCard'],
];
const salahBlok = kartuBlok.filter(([f, n]) => {
  const s = baca(f);
  const i = s.indexOf(`\n  ${n}: {`);
  if (i === -1) return true;
  const akhir = s.slice(i, i + 400);
  return !/marginBottom: CARD_GAP/.test(akhir);
});
ok(`${kartuBlok.length} kartu blok memakai marginBottom CARD_GAP`, salahBlok.length === 0, salahBlok.map((x) => x.join(':')).join(', '));
const tombol = semua.filter((f) => /add(Button|Btn): \{ marginBottom: \d+ \}/.test(baca(f)));
ok('tidak ada tombol tambah dengan marginBottom angka lepas', tombol.length === 0, tombol.join(', '));
// (16 Sep 2026: tiga tombol CORE yang dipatok tidak lagi bermargin sendiri;
// jaraknya milik StickyTop → paddingBottom CARD_GAP. 28 Sep 2026: enam tombol
// lagi ikut dipatok — Catat Tanggal Penting, Tulis Janji Tuhan, Tambah Puasa
// Baru, Tambah Kartu, Tambah Proyek, Tambah Ide — jadi sisanya 14.)
const bermargin = semua.filter((f) =>
  /add(Button|Btn): \{ marginBottom: CARD_GAP \}/.test(baca(f)));
ok(`tombol tambah yang IKUT TERGULUNG memakai CARD_GAP (${bermargin.length} berkas)`,
  bermargin.length >= 14);
// Sisi sebaliknya, dan ini yang benar-benar dijaga: tombol yang DIPATOK tidak
// boleh punya margin sendiri sama sekali — dua jarak yang bertumpuk membuat
// bar patoknya berdiri lebih tinggi daripada sub-tab sebelah.
const patokBermargin = bermargin.filter((f) => /<StickyTop>/.test(baca(f)));
ok('tidak ada tombol dipatok yang masih menambah margin sendiri',
  patokBermargin.length === 0, patokBermargin.join(', '));
ok('tombol yang dipatok (StickyTop) mengandalkan paddingBottom CARD_GAP milik bar-nya',
  /paddingBottom: CARD_GAP,/.test(baca('components/common/StickyTop.tsx')));

console.log('\n=== Yang diminta di layar ===');
const token = baca('components/residence/TokenTab.tsx');
ok('Token: ringkasan → Sisa → pengingat → tombol semuanya CARD_GAP (hero tak lagi menambah marginTop)',
  !/marginTop: 10,\s*\n\s*marginBottom: CARD_GAP/.test(token) &&
  /hero: \{[\s\S]{0,200}marginBottom: CARD_GAP,\s*\n\s*\},/.test(token) &&
  /dueCard: \{ \.\.\.CARD, gap: 2, marginBottom: CARD_GAP \}/.test(token));
const plan = baca('components/device/PlanTab.tsx');
ok('Device: kartu paket → tombol Catat Paket tak lagi 22 (marginTop dibuang, bawah CARD_GAP)',
  /addButton: \{ marginBottom: CARD_GAP \}/.test(plan) && !/addButton: \{ marginTop/.test(plan));
const nf = baca('components/common/NoteField.tsx');
ok('sheet catatan: slot di bawah kotak teks (✨ Generate with AI) berjarak CARD_GAP',
  /\{below \? <View style=\{styles\.below\}>\{below\(\{ text, setText \}\)\}<\/View> : null\}/.test(nf) &&
  /below: \{ marginTop: CARD_GAP \},/.test(nf));

console.log('\n=== Yang sengaja tidak disentuh ===');
ok('kartu daftar (baris) tetap 8 — irama daftar, bukan tumpukan blok',
  /dayCard: \{ \.\.\.CARD, gap: 4, marginBottom: 8 \}/.test(token) &&
  /areaRow: \{\s*\n\s*\.\.\.CARD,\s*\n\s*gap: 8,\s*\n\s*marginBottom: 8,/.test(baca('app/wheel.tsx')));
// 22 Sep 2026: kartu sapaan Home diganti hero With God; tumpukan blok Today
// berjarak CARD_GAP + 2 lewat gap kolom (satu angka, bukan margin per kartu).
ok('Today: tumpukan blok berjarak satu angka (gap: CARD_GAP + 2), bukan margin lepas',
  /contentInner: \{[^}]*gap: CARD_GAP \+ 2/.test(baca('app/(tabs)/index.tsx')) &&
  /sections: \{ gap: CARD_GAP \+ 2 \}/.test(baca('app/(tabs)/index.tsx')));
ok('SECTION_SPACE tetap 10/10', /marginTop: 10,\s*\n\s*marginBottom: 10,/.test(baca('assets/style/section.ts')));

// ============ Napas isi layar: satu token, bukan seratus salinan ============
// 28 Sep 2026. Angkanya TIDAK berubah sedikit pun — yang berubah cuma tempat
// ia ditulis. Dulu `paddingHorizontal: 20, paddingTop: 4` diketik tangan di 100
// tempat pada 96 berkas; tidak ada satu pun yang salah sendirian, dan justru
// itu bahayanya: mengubah napas layar berarti menyunting seratus berkas, jadi
// dalam praktiknya ia tidak pernah bisa diubah lagi.
console.log('\n=== Napas isi layar (SCREEN_CONTENT) ===');
const layout = baca('assets/style/layout.ts');
ok('SCREEN_CONTENT = paddingHorizontal 20 + paddingTop 4, dan TIDAK lebih',
  /export const SCREEN_CONTENT: ViewStyle = \{\s*\n\s*paddingHorizontal: 20,\s*\n\s*paddingTop: 4,\s*\n\}/.test(layout));
// paddingBottom sengaja di luar token: ia memang beda per layar (ber-FAB 40,
// biasa 24), dan bedanya punya alasan.
const blokNapas = /export const SCREEN_CONTENT: ViewStyle = \{[\s\S]*?\n\};/.exec(layout)?.[0] ?? '';
ok('paddingBottom sengaja TIDAK ikut ke token',
  blokNapas.length > 0 && !/paddingBottom/.test(blokNapas));
const pemakaiNapas = semua.filter((f) => /\.\.\.SCREEN_CONTENT/.test(baca(f)));
ok(`dipakai di ${pemakaiNapas.length} berkas (dulu ditulis tangan)`,
  pemakaiNapas.length >= 95, String(pemakaiNapas.length));
// Penjaga sebenarnya: tidak boleh ada yang menuliskannya sendiri lagi.
const tulisTangan = semua.filter((f) =>
  /paddingHorizontal: 20,\s*\n?\s*paddingTop: 4\b|paddingTop: 4,\s*\n?\s*paddingHorizontal: 20\b/.test(baca(f)));
ok('tidak ada lagi yang menulis 20/4 sendiri', tulisTangan.length === 0,
  tulisTangan.join(', ') || `${semua.length} berkas disisir`);
// Nilai paddingBottom yang beda-beda HARUS tetap ada — kalau ikut terseret jadi
// satu angka, layar ber-FAB kehilangan ruang & kartu terakhirnya ketutupan.
ok('tiap layar tetap memegang paddingBottom-nya sendiri (24 · 28 · 32 · 40)',
  ['24', '28', '32', '40'].every((n) =>
    semua.some((f) => new RegExp(`\\.\\.\\.SCREEN_CONTENT, paddingBottom: ${n}`).test(baca(f)))));

// ============ Bentuk kartu sudut 16: satu token, bukan 60 salinan ============
// 28 Sep 2026. Angkanya TIDAK berubah — yang berubah cuma tempat ia ditulis.
console.log('\n=== Bentuk kartu bergaris (PANEL) ===');
ok('PANEL = CONTAINER + sudut 16 + garis 1 BORDER, dan TIDAK lebih',
  /export const PANEL: ViewStyle = \{\s*\n\s*backgroundColor: Color\.CONTAINER,\s*\n\s*borderRadius: 16,\s*\n\s*borderWidth: 1,\s*\n\s*borderColor: Color\.BORDER,\s*\n\}/.test(card));
// padding SENGAJA di luar token: 14 & 16 sama-sama dipakai, dan bedanya milik
// kartunya masing-masing (sama seperti CARD yang juga tidak memuat gap/margin).
const blokPanel = /export const PANEL: ViewStyle = \{[\s\S]*?\n\};/.exec(card)?.[0] ?? '';
ok('padding, gap, & margin sengaja TIDAK ikut ke token',
  blokPanel.length > 0 && !/padding|gap|margin/.test(blokPanel));
const pemakaiPanel = semua.filter((f) => /\.\.\.PANEL\b/.test(baca(f)));
ok(`dipakai di ${pemakaiPanel.length} berkas (dulu ditulis tangan)`,
  pemakaiPanel.length >= 50, String(pemakaiPanel.length));
// Penjaga sebenarnya: tidak boleh ada yang menyalin bentuknya lagi.
const salinan = semua.filter((f) => {
  const s = baca(f);
  return /backgroundColor: Color\.CONTAINER,\s*\n\s*borderRadius: 16,\s*\n\s*borderWidth: 1,\s*\n\s*borderColor: Color\.BORDER,/.test(s);
});
ok('tidak ada lagi yang menyalin keempat propertinya', salinan.length === 0,
  salinan.join(', ') || `${semua.length} berkas disisir`);
// Dua bentuk kartu (14 & 16) memang masih hidup berdampingan, dan itu DISENGAJA
// tidak disatukan: bedanya dua piksel, dan menyatukannya keputusan tampilan.
// Yang dijaga: keduanya tetap punya definisi sendiri, bukan salin-menyalin.
ok('CARD (sudut 14) tetap berdiri sendiri, tidak ikut tergeser',
  /export const CARD: ViewStyle = \{[\s\S]{0,260}borderRadius: 14,/.test(card));

console.log(gagal === 0 ? '\n✅ LULUS — satu irama jarak kartu.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
