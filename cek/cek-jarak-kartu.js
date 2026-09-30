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

// =====================================================================
console.log('\n=== Wadah terluar layar (SCREEN_SAFE) ===');
// =====================================================================
// 29 Sep 2026: `safe: { flex: 1, backgroundColor: Color.BACKGROUND }` ditulis
// tangan di 80 berkas — semuanya bernama sama & sama persis isinya. Ini warna
// DASAR app (yang terlihat di sela kartu, di balik bar patok, dan di ruang
// kosong bawah daftar), jadi selama ia tersebar di 80 tempat ia praktis tidak
// bisa diganti lagi.
const layoutSafe = baca('assets/style/layout.ts');
ok('SCREEN_SAFE = flex 1 + latar BACKGROUND, dan TIDAK lebih',
  /export const SCREEN_SAFE: ViewStyle = \{\s*\n\s*flex: 1,\s*\n\s*backgroundColor: Color\.BACKGROUND,\s*\n\};/.test(layoutSafe));
const pemakaiSafe = semua.filter((f) => /safe: \{ \.\.\.SCREEN_SAFE \}/.test(baca(f)));
ok(`dipakai di ${pemakaiSafe.length} layar (dulu ditulis tangan)`,
  pemakaiSafe.length >= 80, String(pemakaiSafe.length));
// Penjaga sebenarnya: tidak boleh ada yang menyalinnya lagi.
const salinanSafe = semua.filter((f) =>
  /\{ flex: 1, backgroundColor: Color\.BACKGROUND \}/.test(baca(f)),
);
ok('tidak ada lagi layar yang menyalin kedua nilainya', salinanSafe.length === 0,
  salinanSafe.join(', '));
// Satu pengecualian yang DISENGAJA: gerbang doa pagi berlatar ungu pekat
// sepenuh layar. Ia harus tetap begitu — kalau ia ikut memakai token, layar
// paling khas app ini diam-diam berubah jadi gading.
ok('gerbang doa pagi tetap berlatar ungu pekat (pengecualian yang disengaja)',
  /safe: \{ flex: 1, backgroundColor: Color\.SPIRITUAL_DARK \}/.test(
    baca('components/spiritual/MorningJourney.tsx')));

// =====================================================================
console.log('\n=== Daftar yang masih kosong (EmptyText) ===');
// =====================================================================
// Sebelum ini 18 layar menyalin gayanya sendiri dengan SEBELAS jarak berbeda
// (8 · 10 · 12 · 14 · 20 · 24 · 40 …). Tidak ada satu pun yang salah
// sendirian; yang salah adalah tidak ada dua yang sama.
const kosong = baca('components/common/EmptyText.tsx');
ok('jaraknya satu angka, dipegang komponennya sendiri',
  /empty: \{ textAlign: 'center', marginVertical: 10 \}/.test(kosong));
const pemakaiKosong = semua.filter((f) => /<EmptyText/.test(baca(f)));
ok(`dipakai di ${pemakaiKosong.length} layar`, pemakaiKosong.length >= 55,
  String(pemakaiKosong.length));
const salinanKosong = semua.filter(
  (f) => !f.endsWith('EmptyText.tsx') &&
    /empty: \{ textAlign: 'center', margin/.test(baca(f)),
);
ok('tidak ada lagi layar yang menyalin gayanya sendiri', salinanKosong.length === 0,
  salinanKosong.join(', '));
// Pesan SATU LAYAR (bukan baris di dalam daftar) boleh menambah napas
// kiri-kanannya sendiri — tapi jarak atas-bawahnya tetap milik EmptyText.
ok('pesan satu layar cuma menambah napas kiri-kanan, bukan jarak atas-bawah',
  ['app/sermon.tsx', 'app/core/monthly/[id].tsx'].every((f) => {
    const s = baca(f);
    return /<EmptyText additionalStyle=\{styles\.empty\}>/.test(s) &&
      /^ {2}empty: \{ paddingHorizontal: \d+ \},$/m.test(s);
  }));

// =====================================================================
console.log('\n=== Bentuk kotak bergaris (FIELD · CARD · PANEL) ===');
// =====================================================================
// 30 Sep 2026: keempat properti bentuk kotak (latar CONTAINER + sudut +
// borderWidth 1 + garis BORDER) masih ditulis tangan di 44 tempat pada 33
// berkas, padahal DUA dari tiga bentuknya sudah punya token. Yang ketiga,
// sudut 12 (kotak isian), belum punya nama sama sekali — dan justru itu yang
// paling banyak disalin, termasuk di TUJUH komponen `components/common/` yang
// dibuat supaya isian app ini seragam.
const BENTUK = [
  ['FIELD', 12, 'kotak isian & kotak kecil di dalam kartu'],
  ['CARD', 14, 'kartu daftar'],
  ['PANEL', 16, 'kotak bergaris di layar'],
];
for (const [nama, radius, peran] of BENTUK) {
  ok(`${nama} (${peran}) = latar CONTAINER + sudut ${radius} + garis rambut`,
    new RegExp(
      `export const ${nama}[^=]*= \\{\\s*\\n\\s*backgroundColor: Color\\.CONTAINER,` +
      `\\s*\\n\\s*borderRadius: ${radius},\\s*\\n\\s*borderWidth: 1,` +
      `\\s*\\n\\s*borderColor: Color\\.BORDER,`,
    ).test(card));
}
// Bedanya CARD dari dua lainnya: ia MEMBAWA paddingnya sendiri (14/12), karena
// kartu daftar itu baris berulang yang iramanya justru harus sama. FIELD &
// PANEL sengaja tidak, karena paddingnya memang beda-beda per pemakai.
// Isi objeknya saja. Dua jebakan yang sudah memerahkan cek ini dua kali:
// FIELD berakhir `} satisfies ViewStyle;` (bukan `};`), dan mencari `{` dari
// nama tokennya akan mendarat di dalam KOMENTAR contohnya. Jadi polanya
// langsung: `export const NAMA … = {` sampai `}` pertama.
const potong = (n) =>
  new RegExp(`export const ${n}[^=]*=\\s*\\{([^}]*)\\}`).exec(card)?.[1] ?? '';
ok('CARD membawa paddingnya sendiri (irama baris daftar)',
  /paddingHorizontal: 14,\s*\n\s*paddingVertical: 12,/.test(potong('CARD')));
ok('FIELD & PANEL sengaja TIDAK membawa padding (milik tiap pemakai)',
  !/padding/.test(potong('FIELD')) && !/padding/.test(potong('PANEL')));
// Ketiganya HARUS tetap berbeda sudut. Menyatukannya keputusan TAMPILAN, bukan
// kerapian, dan kalau suatu saat diambil, ia diambil sadar di satu baris.
ok('ketiga sudutnya tetap berbeda (12 · 14 · 16), tidak diam-diam disamakan',
  new Set(BENTUK.map(([n]) => /borderRadius: (\d+),/.exec(
    card.slice(card.indexOf(`export const ${n}`)))[1])).size === 3);

// Penjaga yang sebenarnya, sama seperti SCREEN_SAFE & EmptyText di atas:
// bukan "tokennya dipakai", tapi "tidak ada lagi yang menyalinnya". Itu yang
// mencegah berkas berikutnya menulis ulang keempat nilainya.
const salinanKotak = [];
for (const f of semua) {
  const s = baca(f);
  for (const blok of s.match(/\{[^{}]*\}/g) ?? []) {
    if (!/backgroundColor: Color\.CONTAINER,/.test(blok)) continue;
    if (!/borderWidth: 1,/.test(blok)) continue;
    if (!/borderColor: Color\.BORDER,?/.test(blok)) continue;
    const r = /borderRadius: (12|14|16),/.exec(blok);
    if (r) salinanKotak.push(`${f} r${r[1]}`);
  }
}
ok('tidak ada lagi berkas yang menyalin keempat nilainya',
  salinanKotak.length === 0, salinanKotak.join(', '));

const pakai = (t) => semua.filter((f) => new RegExp(`\\.\\.\\.${t}\\b`).test(baca(f)));
ok(`FIELD dipakai ${pakai('FIELD').length} berkas`, pakai('FIELD').length >= 19,
  String(pakai('FIELD').length));
ok(`CARD dipakai ${pakai('CARD').length} berkas`, pakai('CARD').length >= 60,
  String(pakai('CARD').length));
ok(`PANEL dipakai ${pakai('PANEL').length} berkas`, pakai('PANEL').length >= 52,
  String(pakai('PANEL').length));

// Tujuh komponen isian bersama WAJIB satu bentuk. Kalau salah satunya kembali
// menulis sendiri, rupa isian app diam-diam jadi dua macam — dan itu persis
// keadaan sebelum token ini ada.
const ISIAN = [
  'components/common/FormInput.tsx', 'components/common/DateField.tsx',
  'components/common/TimeField.tsx', 'components/common/SearchBar.tsx',
  'components/common/SelectField.tsx', 'components/common/MoneyInput.tsx',
  'components/common/BibleRefField.tsx',
];
const isianNakal = ISIAN.filter((f) => !/\.\.\.FIELD\b/.test(baca(f)));
ok('ketujuh komponen isian bersama memakai satu bentuk yang sama',
  isianNakal.length === 0, isianNakal.join(', '));

// Pengecualian yang DISENGAJA & harus tetap begitu: chip/pil yang bisa dipilih
// bergaris 1.5 supaya keadaan terpilihnya terbaca dari tebalnya, bukan cuma
// dari warnanya. Kalau ia ikut ditarik ke token, penanda itu hilang.
const tebal = semua.filter((f) => /borderWidth: 1\.5,/.test(baca(f)));
ok(`chip & pil bergaris 1.5 tetap dibiarkan (${tebal.length} berkas, penanda terpilih)`,
  tebal.length >= 5, String(tebal.length));

console.log(gagal === 0 ? '\n✅ LULUS — satu irama jarak & bentuk kartu.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
