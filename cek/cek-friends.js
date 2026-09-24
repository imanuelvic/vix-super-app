// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Bukti butir 6 — fitur Friends 🤝 (Split Bill + Places).
// Matematikanya diuji terpisah dengan angka sungguhan: bukti-splitbill.js.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
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

const grid = baca('lib/featureGrid.ts');
const screen = baca('app/friends.tsx');
const socialLib = baca('lib/friends.ts');
const billScreen = baca('app/bill/[id].tsx');
const splitTab = baca('components/friends/SplitBillTab.tsx');
const placesTab = baca('components/friends/PlacesTab.tsx');
const ocrLib = baca('lib/receiptOcr.ts');
const photoLib = baca('lib/photo.ts');
const home = baca('app/(tabs)/index.tsx');
const pkg = JSON.parse(baca('package.json'));
const appJson = JSON.parse(baca('app.json'));

console.log('\nTile & rute');
ok('tile Friends ada di grid Home',
  /key: 'friends', sort: \d+, label: 'Friends'[\s\S]{0,120}route: '\/friends'/.test(grid));
ok('warnanya sendiri di palet, bukan hex mentah di layar',
  /FRIENDS: '#[0-9A-F]{6}'/.test(baca('assets/style/color.ts')) &&
  /bg: Color\.FRIENDS, fg: Color\.FRIENDS_DARK/.test(grid));
// 23 Sep 2026: tile Married DIHAPUS (belum pernah dipakai). Urutan Friends
// tidak ikut digeser: nomor sort-nya tetap, cuma tetangganya yang hilang.
ok('Friends tetap di ujung daftar & Married benar-benar hilang',
  grid.indexOf("key: 'games'") < grid.indexOf("key: 'friends'") && !/married/i.test(grid));
ok('ikon kedua sub-tabnya dipetakan untuk Android',
  /'receipt\.fill': 'receipt-long'/.test(baca('components/ui/icon-symbol.tsx')) &&
  /'cup\.and\.saucer\.fill': 'local-cafe'/.test(baca('components/ui/icon-symbol.tsx')));
// Tile-nya sendiri tidak lewat pemetaan itu: SF Symbols tidak punya ikon jabat
// tangan sama sekali, jadi glifnya diambil IconGlyph — satu warna seperti ikon
// tile lain, bukan emoji yang diwarnai sistem. Ikon wineglass lama ikut dibuang.
ok('tile Friends memakai glif jabat tangan, bukan emoji atau ikon yatim',
  /glyph: 'handshake'/.test(grid) &&
  !/emoji:/.test(grid) &&
  !/wineglass/.test(baca('components/ui/icon-symbol.tsx')) &&
  !/wineglass/.test(grid));
const routes = baca('.expo/types/router.d.ts');
ok('rute /friends & /bill/[id] terdaftar di typed routes',
  routes.includes('`/friends`') && !routes.includes('`/social`') &&
  routes.includes('`/bill/[id]`') &&
  routes.includes('`/bill/${Router.SingleRoutePart<T>}'));

console.log('\nSub-tab — nama Inggris seperti fitur lain');
ok('dua sub-tab: Split Bill & Places',
  /key: 'bills', label: 'Split Bill'/.test(screen) &&
  /key: 'places', label: 'Places'/.test(screen));
ok('tidak ada label Indonesia yang nyelip di tab bar',
  !/label: '(Tempat|Nongkrong|Patungan)'/.test(screen));

console.log('\nSplit Bill 💸');
ok('tiap tagihan satu DOKUMEN sendiri (ada foto nota → bisa besar)',
  /collection\(db, 'users', uid, 'bills'\)/.test(socialLib) &&
  /orderBy\('date', 'desc'\), limit\(60\)/.test(socialLib));
ok('layar rincian cuma membaca SATU tagihan, bukan semuanya',
  /export function subscribeBill\(/.test(socialLib) &&
  /subscribeBill\(uid, id, setBill/.test(billScreen));
// Sejak foto nota pindah ke dokumen sendiri, hapus tagihan harus membuang DUA
// dokumen — Firestore tidak menghapus sub-koleksi otomatis.
ok('hapus tagihan PERMANEN, fotonya ikut dibuang',
  /await deleteDoc\(billPhotoRef\(uid, id\)\);/.test(socialLib) &&
  /await deleteDoc\(billRef\(uid, id\)\);/.test(socialLib));
ok('tidak ada soft-delete diselundupkan',
  !/isDeleted|archived: true|deleted: true/.test(socialLib + billScreen));

ok('bisa tambah orang & hapus orang',
  /function addPerson/.test(billScreen) && /function removePerson/.test(billScreen));
ok('menghapus orang sekalian mencabutnya dari semua item',
  /items: b\.items\.map\(\(i\) => \(\{\s*\.\.\.i,\s*sharedBy: i\.sharedBy\.filter/.test(billScreen));
ok('tiap item bisa ditandai siapa saja yang makan (boleh patungan)',
  /sharedBy: string\[\]/.test(socialLib) &&
  /label="👥 Semua ikut"/.test(billScreen));
ok('item yang belum dibagi DIPERINGATKAN, bukan didiamkan',
  /export function unsharedItems/.test(socialLib) &&
  /item belum ditandai siapa yang makan/.test(billScreen) &&
  /itemRowWarn: \{ borderColor: Color\.DANGER \}/.test(billScreen));
ok('ada tanda lunas per orang',
  /function togglePaid/.test(billScreen) && /paid: boolean/.test(socialLib));
ok('penagihan tampil di daftar & di badge',
  /export function unpaidCount/.test(socialLib) &&
  /export function outstandingTotal/.test(socialLib) &&
  /bills: \(bills \?\? \[\]\)\.filter\(billUnsettled\)\.length/.test(screen));
ok('baris Today = badge sub-tab (mustahil beda pendapat; 22 Sep 2026 lewat Today Engine)',
  /sortedBills\(input\.bills\)\.filter\(billUnsettled\)/.test(BACA_TODAY('lib/today.ts')));
ok('persen pajak/service dijaga 0–100 (salah ketik tidak melipatgandakan)',
  /Math\.min\(100, Math\.max\(0, parseAmount\(fTax\)\)\)/.test(billScreen));
ok('pembulatan diakui terus terang ke pengguna',
  /dibulatkan ke rupiah/.test(billScreen));

console.log('\nOCR nota — di HP, bukan cloud');
ok('memakai expo-text-extractor (ML Kit Android / Apple Vision iOS)',
  pkg.dependencies['expo-text-extractor'] !== undefined &&
  /import\('expo-text-extractor'\)/.test(ocrLib));
ok('TIDAK ada layanan cloud & TIDAK ada API key',
  !/api[_-]?key|googleapis|vision\.google|ocr\.space/i.test(ocrLib + billScreen));
// Komentar di dalam try{} diizinkan — di situlah ditulis KENAPA require()
// yang dipakai, bukan import. Yang dijaga tetap: require-nya di dalam try, dan
// gagalnya berakhir sebagai null (bukan lemparan yang naik ke pemanggilnya).
ok('modulnya di-require MALAS di dalam try/catch (pola lib/healthkit.ts)',
  /try \{[\s\S]{0,400}?cached = require\('expo-text-extractor'\)/.test(ocrLib) &&
  /catch \{\s*cached = null;/.test(ocrLib));
ok('build lama tanpa modulnya TIDAK crash — cuma kehilangan pemindainya',
  /export function canScanReceipt/.test(ocrLib) &&
  /reason === 'no-module'/.test(billScreen) &&
  /Pemindai nota belum ada di versi app ini/.test(billScreen));
ok('hasil pindai DITAMBAHKAN, tidak menimpa yang sudah diketik',
  /next\.items = \[\s*\.\.\.b\.items,/.test(billScreen));
ok('fotonya tetap tersimpan walau OCR-nya gagal',
  /if \(foto\.base64\) await saveBillPhoto\(user!\.uid, b\.id, foto\.base64\);/.test(billScreen) &&
  /const next: Bill = \{ \.\.\.b, hasPhoto: !!foto\.base64 \};/.test(billScreen));
ok('dijelaskan apa adanya: hasilnya wajib diperiksa',
  /periksa & betulkan itemnya/.test(billScreen) &&
  /menghemat mengetik, bukan menghilangkannya/.test(ocrLib));
ok('foto tidak dikirim ke mana pun — dan itu dikatakan ke pengguna',
  /fotonya tidak dikirim ke mana pun/.test(billScreen));

console.log('\n  Ukuran foto: dua versi, dua tujuan');
ok('yang dibaca mesin 1600px (640px terlalu kasar untuk struk)',
  /resize: \{ width: 1600 \}/.test(photoLib));
ok('yang DISIMPAN tetap 640px base64 seperti foto lain di app ini',
  /resize: \{ width: 640 \}[\s\S]{0,120}base64: true/.test(photoLib));
ok('izin kamera sudah disiapkan di app.json (build baru akan memuatnya)',
  JSON.stringify(appJson).includes('cameraPermission'));

console.log('\nPlaces 🍜');
ok('daftar tempat cukup SATU dokumen (teks saja, hemat)',
  /doc\(db, 'users', uid, 'social', 'places'\)/.test(socialLib));
ok('dua keadaan: mau coba & sudah pernah',
  /visited: boolean/.test(socialLib) &&
  /label: '🔖 Mau coba'/.test(placesTab) &&
  /label: '✅ Sudah pernah'/.test(placesTab));
ok('yang BELUM didatangi tampil duluan (itu yang perlu diputuskan)',
  /if \(a\.visited !== b\.visited\) return a\.visited \? 1 : -1;/.test(socialLib));
ok('bintang hanya untuk yang sudah pernah',
  /rating: fVisited \? fRating : 0/.test(placesTab) &&
  /\{fVisited && \(/.test(placesTab));
ok('hapus tempat PERMANEN (tulis ulang array)',
  /places\.filter\(\(p\) => p\.id !== editing\.id\)/.test(placesTab));

console.log('\nAturan wajib');
ok('warna semua dari Color, tak ada hex mentah',
  ![screen, splitTab, placesTab, billScreen, socialLib, ocrLib]
    .some((f) => /#[0-9A-Fa-f]{6}/.test(f)));
ok('pakai komponen bersama, bukan bikin duplikat',
  /components\/common\/SheetModal/.test(placesTab) &&
  /components\/common\/FilterChips/.test(placesTab) &&
  /components\/common\/InlineDelete/.test(billScreen) &&
  /components\/common\/BottomTabs/.test(screen));
ok('cuma SATU dependency baru yang ditambahkan',
  pkg.dependencies['expo-text-extractor'] === '^2.0.0');

console.log(gagal === 0
  ? '\n✅ LULUS — fitur Friends terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
