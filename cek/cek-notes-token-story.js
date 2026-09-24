// Bukti 3 permintaan: Notes di Fitness, Token di Residence, Rhema → Story.
// Plus batch /rapihin: usePickerSlot.
// Hitungannya diuji terpisah dengan angka sungguhan: bukti-token.js
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ 1. Fitness → Notes ============
console.log('\n1. Fitness → sub-tab Notes 📝');
const fitScreen = baca('app/fitness.tsx');
const notesTab = baca('components/fitness/NotesTab.tsx');
const notesLib = baca('lib/fitNotes.ts');

ok('sub-tab Notes terdaftar', /key: 'notes', label: 'Notes'/.test(fitScreen));
ok('ikonnya dipetakan untuk Android juga',
  /'note\.text': 'sticky-note-2'/.test(baca('components/ui/icon-symbol.tsx')));
ok('tiga sub-tab lama tidak bergeser',
  fitScreen.indexOf("key: 'program'") < fitScreen.indexOf("key: 'exercise'") &&
  fitScreen.indexOf("key: 'exercise'") < fitScreen.indexOf("key: 'progress'") &&
  fitScreen.indexOf("key: 'progress'") < fitScreen.indexOf("key: 'notes'"));
ok('isinya judul + link + catatan',
  /title: string;/.test(notesLib) && /url: string;/.test(notesLib) &&
  /note: string;/.test(notesLib));
ok('KETUK KARTUNYA = langsung buka tautannya',
  /onPress=\{\(\) => openExternalUrl\(n\.url\)\}/.test(notesTab));
ok('kartu tanpa tautan tidak bisa diketuk (biar tidak terasa rusak)',
  /disabled=\{!n\.url\}/.test(notesTab));
// Tombolnya kini <EditButton> bersama — satu rupa dengan tombol ✏️ di
// seluruh app (components/common/EditButton.tsx).
ok('tombol ubah jadi SAUDARA kartu, bukan Pressable bersarang',
  /<\/PressableScale>\s*<EditButton onPress=\{\(\) => openEdit\(n\)\} \/>/.test(notesTab));
ok('link yang ditempel dirapikan — "youtu.be/x" tetap bisa dibuka',
  /export function tidyUrl/.test(notesLib) &&
  /return `https:\/\/\$\{teks\}`;/.test(notesLib));
ok('…dan dirapikan SAAT DISIMPAN, jadi yang tersimpan pasti bisa dibuka',
  /url: tidyUrl\(fUrl\)/.test(notesTab));
ok('hapus PERMANEN (tulis ulang array, tanpa penanda)',
  /notes\.filter\(\(n\) => n\.id !== editing\.id\)/.test(notesTab) &&
  !/isDeleted|archived: true/.test(notesLib + notesTab));

// ============ 2. Residence → Token ============
console.log('\n2. Residence → sub-tab Token ⚡');
const resScreen = baca('app/residence.tsx');
const tokenTab = baca('components/residence/TokenTab.tsx');
const tokenLib = baca('lib/token.ts');

ok('sub-tab Token terdaftar', /key: 'token', label: 'Token'/.test(resScreen));
ok('empat sub-tab lama tidak hilang',
  ["'log'", "'utility'", "'chores'", "'info'"].every((k) => resScreen.includes(`key: ${k}`)));

console.log('\n  Cara mencatatnya = kebiasaanmu sendiri');
ok('dua jenis catatan: 🏠 sampai rumah & 🚪 berangkat',
  /key: 'home', label: 'Sampai rumah'/.test(tokenLib) &&
  /key: 'out', label: 'Berangkat'/.test(tokenLib));
ok('jenisnya yang menentukan "di rumah" atau "ditinggal", BUKAN tebakan jam',
  /atHome: from\.kind === 'home'/.test(tokenLib));
ok('jenis catatan berikutnya ditebak bergantian (hemat ketukan)',
  /terakhir\?\.kind === 'home' \? 'out' : 'home'/.test(tokenTab));
ok('tanggal & jam dicatat terpisah (DateField + TimeField)',
  /<DateField/.test(tokenTab) && /<TimeField/.test(tokenTab));

console.log('\n  Yang dihitung app');
ok('pemakaian dipisah: saat di rumah vs saat ditinggal',
  /homeKwh: number/.test(tokenLib) && /awayKwh: number/.test(tokenLib) &&
  /🏠 Saat di rumah/.test(tokenTab) && /🚪 Saat ditinggal/.test(tokenTab));
ok('harga per kWh dari pembelian TERAKHIR',
  /export function currentRate/.test(tokenLib));
ok('pengeluaran token bulan ini (yang kamu tanyakan)',
  /export function purchasesOfMonth/.test(tokenLib) &&
  /label="Token bulan ini"/.test(tokenTab));
// Kalimatnya diganti user sendiri jadi "Estimasi sebulan penuh …" (15 Sep 2026).
ok('perkiraan sebulan penuh ditampilkan terang-terangan',
  /Estimasi sebulan penuh \{rupiah\(bulanIni\.perDay \* 30\)\}/.test(tokenTab));
ok('sisa token & perkiraan cukup berapa hari lagi',
  /export function daysLeft/.test(tokenLib) &&
  /Cukup ±\{formatDecimal\(hariLagi\)\} hari lagi/.test(tokenTab));
ok('hampir habis → kartunya merah, bukan diam-diam saja',
  /heroLow: \{ backgroundColor: Color\.DANGER \}/.test(tokenTab) &&
  /TOKEN_LOW_DAYS/.test(tokenLib));
ok('rupiah "-" kalau harga per kWh belum diketahui (bukan Rp0 menyesatkan)',
  /rate > 0 \? formatRupiah\(Math\.round\(kwh \* rate\)\) : '-'/.test(tokenTab));

console.log('\n  Pelajaran dari spreadsheet lamamu');
ok('pengisian token di tengah TIDAK jadi pemakaian minus',
  /if \(kwh < 0\) continue;/.test(tokenLib));
ok('selang nol jam dibuang (di spreadsheet ini yang jadi #DIV/0!)',
  /if \(hours <= 0\) continue;/.test(tokenLib));

console.log('\n  Penagih & penyimpanan');
ok('badge Token menagih selama hari ini belum dicatat 2×',
  /export function readingDue/.test(tokenLib) &&
  /token: readingDue\(readings \?\? \[\], new Date\(\)\) \? 1 : 0/.test(resScreen));
ok('dua dokumen kecil terpisah (pembelian & catatan meteran)',
  /'house', 'tokenPurchases'/.test(tokenLib) &&
  /'house', 'tokenReadings'/.test(tokenLib));
ok('hapus PERMANEN, tanpa soft-delete',
  !/isDeleted|archived: true/.test(tokenLib + tokenTab) &&
  /readings\.filter\(\(r\) => r\.id !== editReading\.id\)/.test(tokenTab));

// ============ 3. Refleksi → Instagram FEED ============
// Dulu bagian ini menguji "Rhema → Story". Fiturnya diganti Daily Reflection
// Journal → Feed 4:5 (berkasnya pun berganti nama), jadi acuannya diarahkan ke
// berkas yang baru. Yang dijamin tetap sama: tanpa AI/API key, tanpa modul
// native baru, dan berkas gambarnya cuma singgah di cache.
console.log('\n3. Refleksi → Instagram Feed 📓');
// 22 Sep 2026: kartu refleksi Home → blok Refleksi di Today.
const home = baca('components/today/ReflectionBlock.tsx');
const feedScreen = baca('app/reflection-feed.tsx');
const feedCard = baca('components/spiritual/ReflectionFeedCard.tsx');
// Rupa, pembagi berkas, & alasan "kenapa bukan AI" sekarang tinggal di
// lib/shareImage.ts — dipakai bersama Feed refleksi & Story ayat Alkitab.
// Isinya tidak berubah, cuma pindah berkas, jadi kedua berkas dibaca bersama.
const feedLib = baca('lib/reflectionFeed.ts') + '\n' + baca('lib/shareImage.ts');
const pkg = JSON.parse(baca('package.json'));

ok('tombol Feed ada di blok Refleksi Today',
  /label="🖼️ Feed"/.test(home) &&
  /router\.push\('\/reflection-feed'\)/.test(home));
ok('tombolnya SoftPill bersaudara (bukan Pressable bersarang)',
  /<SoftPill label="🖼️ Feed"/.test(home));
ok('rutenya terdaftar di typed routes',
  baca('.expo/types/router.d.ts').includes('`/reflection-feed`'));

console.log('\n  Rupanya');
ok('warnanya dari palet app, jadi feed-nya sekeluarga dengan aplikasinya',
  /from '\.\.\/assets\/style\/color'/.test(feedLib));
ok('bisa diganti rupanya kalau nuansanya kurang pas',
  /setPickedKey\(d\.key\)/.test(feedScreen));

console.log('\n  Gambarnya');
ok('digambar sebagai SVG — react-native-svg yang SUDAH terpasang',
  /from 'react-native-svg'/.test(feedCard) &&
  pkg.dependencies['react-native-svg'] !== undefined);
// 27 Agu 2026: pemiliknya minta tombolnya benar-benar MENYIMPAN ke Photos,
// bukan membuka share sheet. Satu-satunya jalan = expo-media-library, jadi
// modul native itu ditambah dengan sadar (rilis berikutnya wajib `eas build`).
// Yang tetap dijaga: tidak ada penangkap layar tambahan — gambarnya masih
// digambar sendiri oleh react-native-svg yang sudah lama terpasang.
ok('tak ada penangkap layar tambahan; Photos-nya disengaja',
  pkg.dependencies['react-native-view-shot'] === undefined &&
  pkg.dependencies['expo-media-library'] !== undefined);
// Cek ini DULU cuma melihat kanvas yang diminta, dan itulah kenapa gambar
// hitam 27 Agu 2026 lolos: kanvasnya memang 1080×1350, tapi kartunya dirender
// selebar pratinjau (320 px) sehingga cuma mengisi pojok kiri-atas. Sekarang
// ukuran RENDER-nya ikut diperiksa — itu yang menentukan hasilnya.
ok('dirasterisasi pada ukuran Feed sebenarnya, bukan sebesar pratinjau',
  /useCardPng\(FEED_W, FEED_H\)/.test(feedScreen) &&
  /toDataURL\(\(data\) => resolve\(data\), \{ width, height \}\)/.test(baca('hooks/useCardPng.ts')) &&
  /<ReflectionFeedCard[\s\S]*?width=\{FEED_W\}/.test(feedScreen) &&
  !/<ReflectionFeedCard[\s\S]*?width=\{previewW\}/.test(feedScreen));
ok('ukurannya 1080×1350 (4:5)',
  /viewBox=\{`0 0 \$\{FEED_W\} \$\{FEED_H\}`\}/.test(feedCard));
ok('hurufnya Inter — font yang memang dimuat app ini',
  /fontFamily="Inter_500Medium"/.test(feedCard) &&
  /Inter_500Medium/.test(baca('app/_layout.tsx')));

console.log('\n  Berbagi & privasi');
// Dulu lewat share sheet iOS. Sejak 27 Agu 2026: simpan LANGSUNG ke Photos,
// lalu Instagram dibuka — dua tombol dengan maksud masing-masing.
ok('disimpan langsung ke Photos, lalu Instagram dibuka',
  /from 'expo-media-library'/.test(feedLib) &&
  /Asset\.create\(file\.uri\)/.test(feedLib) &&
  /instagram:\/\//.test(feedLib));
ok('TIDAK ada AI/cloud & TIDAK ada API key',
  !/api[_-]?key|openai|gemini|googleapis|replicate/i.test(feedLib + feedScreen + feedCard));
ok('alasannya ditulis terang-terangan di kodenya, bukan didiamkan',
  /API key di aplikasi klien BISA DIAMBIL/.test(feedLib) &&
  /buruk menuliskan HURUF/.test(feedLib));
// Kalimat "…tidak dikirim ke mana pun" di layarnya dihapus pemiliknya sendiri
// (27 Agu 2026). Janjinya tetap dijaga di sini, tapi dengan bukti yang lebih
// keras daripada kalimat: seluruh alurnya memang tak punya jalan ke internet.
ok('gambarnya benar-benar tak punya jalan keluar dari HP',
  !/fetch\(|XMLHttpRequest|upload|axios|https?:\/\/(?!www\.instagram)/i
    .test(feedLib + feedScreen + feedCard));
ok('berkasnya cuma singgah di cache, bertumpuk pun ditimpa',
  /if \(file\.exists\) file\.delete\(\)/.test(feedLib) &&
  /Paths\.cache/.test(feedLib));
ok('refleksi belum ditulis → dijelaskan, bukan tombol mati tanpa sebab',
  /Refleksi hari ini belum ditulis/.test(feedScreen));

// ============ /rapihin — batch usePickerSlot ============
console.log('\n/rapihin — batch react-hooks/refs');
const slot = baca('hooks/usePickerSlot.ts');
const dateField = baca('components/common/DateField.tsx');
const timeField = baca('components/common/TimeField.tsx');
const priority = baca('app/daily-priority.tsx');

ok('blok kembar DateField/TimeField pindah ke satu hook',
  /export function usePickerSlot/.test(slot));
ok('id diambil SEKALI lewat useState, bukan ref yang ditulis saat render',
  /const \[myId\] = useState\(nextPickerId\);/.test(slot));
ok('ref yang ditulis saat render sudah tidak ada di kedua field',
  !/idRef/.test(dateField) && !/idRef/.test(timeField) &&
  !/nextPickerId/.test(dateField) && !/nextPickerId/.test(timeField));
ok('kedua field memakainya',
  /const \{ open, toggle \} = usePickerSlot\(\);/.test(dateField) &&
  /const \{ open, toggle \} = usePickerSlot\(\);/.test(timeField));
ok('aturan "hanya SATU picker terbuka" tetap utuh',
  /subscribePicker\(\(openId\) => setOpen\(openId === myId\)\)/.test(slot) &&
  /openPicker\(myId\)/.test(slot) && /closePickers\(\)/.test(slot));
ok('keyboard tetap ditutup dulu sebelum spinner dibuka',
  /Keyboard\.dismiss\(\)/.test(slot));
ok('Android tetap menutup pickernya (lewat closePickers, bukan setOpen)',
  /if \(Platform\.OS === 'android'\) closePickers\(\);/.test(dateField) &&
  /if \(Platform\.OS === 'android'\) closePickers\(\);/.test(timeField));
ok('mergeDate tetap dipakai → ganti tanggal tidak menghapus jamnya',
  /onChange\(value \? mergeDate\(value, selected\) : selected\)/.test(dateField));
// Tulisannya HANYA ada satu, dan tepat di dalam useEffect. Membedakannya dari
// baris isinya saja tidak bisa — di dalam efek pun barisnya persis sama.
const tulisRef = (priority.match(/latest\.current = \{ list, stored \};/g) ?? []).length;
ok('Daily Priority: ref diperbarui di dalam efek, bukan saat render',
  tulisRef === 1 &&
  /useEffect\(\(\) => \{\s*latest\.current = \{ list, stored \};\s*\}\);/.test(priority),
  `ditemukan ${tulisRef} tulisan`);

console.log(gagal === 0
  ? '\n✅ LULUS — 3 permintaan + batch rapihin terbukti.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
