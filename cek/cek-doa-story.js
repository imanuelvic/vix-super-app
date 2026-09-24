// Dua permintaan:
//   1. Sheet "Edit Midday/Morning/Night Reading" memakai pemilih kitab yang
//      SAMA dengan layar Baca Alkitab (kitab · pasal · ayat dari–sampai).
//   2. Halaman baru Pause & Pray 🙏 — doa singkat jadi Story Instagram,
//      kartunya sama persis dengan Bagikan Ayat, kopnya "PAUSE & PRAY".
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

// Komentar di berkas ini panjang & menyebut nama-nama yang diuji — kalau ikut
// terbaca, cek "ada X di kode" lolos hanya karena X disebut di komentar.
const kode = (f) =>
  baca(f)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// ===== modul nyata =====
function pasang(js) {
  const mod = { exports: {} };
  new Function('exports', 'module', js)(mod.exports, mod);
  return mod.exports;
}
const tsc = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;

const bible = pasang(tsc(baca('lib/bible.ts')));

const shareSrc = baca('lib/shareImage.ts');
const storySrc = baca('lib/bibleStory.ts');
const potong = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const teks = pasang(
  tsc(
    potong(shareSrc, 'export function wrapLines', 'export function lineY') +
      '\n' +
      potong(storySrc, 'const BODY_TOP', 'export function storyRefs')
        .replace('export function layoutStory', 'function layoutStory') +
      '\nexports.layoutStory = layoutStory;\nexports.wrapLines = wrapLines;',
  ),
);

// ============================================================
console.log('=== 1a. Catatan lama harus utuh lewat pemilih kitab ===');
// Sheet edit sekarang memecah catatan tersimpan jadi daftar acuan, tiap acuan
// diurai ke kitab/pasal/ayat oleh pemilih, lalu dirangkai lagi saat disimpan.
// Kalau perjalanan itu mengubah teksnya, catatan lamamu rusak diam-diam.
const bolakBalik = (s) =>
  bible
    .splitBibleRefs(s)
    .map((r) => {
      const p = bible.parseBibleRef(r);
      return bible.bibleRefText(p.book, p.chapter, p.verseFrom, p.verseTo);
    })
    .join(', ');

for (const asli of [
  'Yesaya 5',
  'Amsal 3:5-6',
  'Mazmur 23:1',
  '1 Petrus 1',
  '1 Yohanes 2:15-17',
  'Yakobus 3, Amsal 14',
  'Kisah Para Rasul 2:1-4, Roma 8',
  'Kidung Agung 8:6-7, 1 Korintus 13:4-8, Wahyu 22',
]) {
  c(`utuh: "${asli}"`, bolakBalik(asli) === asli);
}

console.log('\n=== 1b. Yang MEMANG berubah — dan itu perbaikan ===');
// Kotak teks bebas yang lama membiarkan ini tersimpan; pil acuannya lalu
// berhenti bisa di-klik ke YouVersion tanpa penjelasan apa pun.
c('"Amsal 3:5-5" (dari=sampai) dirapikan jadi "Amsal 3:5"',
  bolakBalik('Amsal 3:5-5') === 'Amsal 3:5');
c('kitab yang tak ada dalam 66 tidak menyamar jadi acuan sah',
  bolakBalik('Talmud 5') === '');
c('salah eja tidak tersimpan diam-diam', bolakBalik('Amsl 3') === '');
c('acuan sah tetap bisa di-klik ke YouVersion', bible.usfmRef('Yesaya 5') === 'ISA.5');
// Inilah untung sebenarnya dari pemilih: namanya TIDAK MUNGKIN keluar dari 66
// nama itu, jadi tiap acuan yang tersimpan pasti punya kode USFM-nya.
c('ke-66 kitab yang bisa dipilih semuanya punya kode YouVersion',
  bible.BIBLE_BOOKS.length === 66 &&
  bible.BIBLE_BOOKS.every((b) => bible.usfmRef(`${b.name} 1`) !== null));

console.log('\n=== 1c. Sheet edit memakai kolom yang sama ===');
const tab = kode('components/spiritual/BibleReadingTab.tsx');
// Daftar isiannya kini satu komponen bersama dengan layar Baca Alkitab.
const daftarRef = baca('components/spiritual/BibleRefList.tsx');
c('BibleRefField dipakai', /<BibleRefField/.test(daftarRef) && /<BibleRefList/.test(tab));
c('inlinePicker dinyalakan (modal di atas modal tidak andal di iOS)',
  /<BibleRefList[^>]*inlinePicker/.test(tab) && /inlinePicker=\{inlinePicker\}/.test(daftarRef));
c('kotak teks bebas untuk acuan sudah TIDAK ada',
  !/placeholder="Alkitab"/.test(tab));
c('acuan tersimpan dipecah dengan splitBibleRefs, bukan split(",") mentah',
  /setRefs\(splitBibleRefs\(d\[session\]\)\)/.test(tab));
c('disimpan lagi sebagai satu baris dipisah koma-spasi',
  /filled\.join\(', '\)/.test(tab));
c('beberapa kitab: ada tombol tambah', /Tambah kitab lain/.test(daftarRef));
c('beberapa kitab: tiap baris bisa dibuang',
  /onChange\(refs\.filter\(\(_, x\) => x !== i\)\)/.test(daftarRef));
c('baris "Hapus" hanya muncul kalau acuannya lebih dari satu',
  /refs\.length > 1 &&/.test(daftarRef));
c('catatan kosong ditolak, bukan menimpa dengan string hampa',
  /filled\.length === 0/.test(tab));
c('terjemahan kosong jatuh ke bawaan, bukan tersimpan hampa',
  /version\.trim\(\) \|\| BIBLE_VERSION_DEFAULT/.test(tab));
c('hapus permanen tetap ada di sheet', /InlineDelete/.test(tab));

console.log('\n=== 1d. Pemilih kitab: dua rupa, satu daftar ===');
const field = kode('components/common/BibleRefField.tsx');
c('daftar kitabnya satu komponen bersama, tidak disalin dua kali',
  (field.match(/TESTAMENT_LABEL\[g\.t\]/g) || []).length === 1);
c('BookList dipakai dialog & panel mengembang',
  (field.match(/<BookList/g) || []).length === 2);
c('dialog tengah layar MATI saat inlinePicker menyala',
  /visible=\{!inlinePicker && pickerOpen\}/.test(field));
c('panel mengembang hanya muncul saat inlinePicker menyala',
  /\{inlinePicker && pickerOpen &&/.test(field));
c('tinggi daftar dalam panel dibatasi (66 kitab tak mendorong kolom pasal)',
  /inlineList: \{ maxHeight: \d+ \}/.test(field));
c('klik tombol kitab lagi menutup panelnya', /pickerOpen \? tutupPemilih\(\)/.test(field));
// Mode chapterOnly (layar catat bacaan): kitab & pasal SEBARIS, kolom ayat
// tidak ada — ayatnya dipilih di layar Story, bukan waktu mencatat bacaan.
c('mode chapterOnly: Pasal sebaris dengan nama kitab', /chapterOnly && pasal/.test(field));
c('kolom ayat dari–sampai hanya di luar chapterOnly',
  /\{!chapterOnly && \(\s*<View style=\{styles\.numberRow\}>/.test(field));
c('kolom ayatnya sendiri tidak dihapus (Revive masih memakainya)',
  /Ayat dari[\s\S]{0,900}sampai/.test(field));
c('layar catat bacaan memang meminta mode itu',
  /chapterOnly/.test(kode('components/spiritual/BibleRefList.tsx')));
c('Revive TIDAK ikut berubah (kolom ayatnya masih ada di sana)',
  !/chapterOnly/.test(kode('app/revive.tsx')));
c('halaman penuh Baca Alkitab TIDAK ikut berubah rupa',
  !/inlinePicker/.test(kode('app/bible-reading.tsx')));

// ============================================================
console.log('\n=== 2a. Kartu Story dipakai bersama, bukan disalin ===');
const kartu = kode('components/spiritual/BibleStoryCard.tsx');
c('acuan & terjemahan jadi opsional', /reference\?: string/.test(kartu) && /version\?: string/.test(kartu));
c('tanpa acuan, baris "— acuan" tidak digambar', /verse\.trim\(\) && acuan \?/.test(kartu));
c('acuan kosong tidak menyisakan kurung menganga',
  /rujukan && versi \? `\$\{rujukan\} \(\$\{versi\}\)` : rujukan/.test(kartu));
c('hanya SATU berkas kartu Story (tidak ada salinan untuk doa)',
  !fs.existsSync(R + 'components/spiritual/PrayerStoryCard.tsx') &&
  !fs.existsSync(R + 'components/spiritual/PausePrayCard.tsx'));

console.log('\n=== 2b. Halaman Pause & Pray ===');
const doa = kode('app/pause-pray.tsx');
c('memakai kartu yang sama persis', /<BibleStoryCard/.test(doa));
c('kopnya PAUSE & PRAY', /'PAUSE & PRAY'/.test(doa) && /sessionLabel=\{KOP\}/.test(doa));
c('TIDAK mengoper acuan/terjemahan', !/reference=/.test(doa) && !/version=/.test(doa));
c('ukuran & rasio Story dipakai apa adanya', /STORY_W/.test(doa) && /STORY_H/.test(doa));
c('tiga style yang sama (Morning/Midday/Night)', /SHARE_DESIGNS\.map/.test(doa));
c('simpan ke Foto', /savePngToPhotos/.test(doa));
c('buka kamera Story Instagram', /openInstagram\('story'\)/.test(doa));
c('nomor arsip vixtory ikut', /archiveNo\(todayId\)/.test(doa));
c('nama berkasnya lewat helper bersama', /storyFileName\(todayId, NAMA_BERKAS\)/.test(doa));
c('gambar sama tidak tersimpan dua kali ke galeri', /if \(saved === kunci\) return;/.test(doa));
c('doa kosong tidak bisa disimpan', /if \(!doa\) return;/.test(doa));
// 23 Sep 2026: hitungan pratinjaunya pindah ke <CardPreview/> (satu tempat
// untuk keempat layar kartu). Jaminannya sama: kanvas penuh, lalu dikecilkan.
c('kartunya dirender ukuran penuh lalu dikecilkan (bukan 260px)',
  /width=\{STORY_W\}/.test(doa) &&
    /<CardPreview width=\{STORY_W\} height=\{STORY_H\} max=\{260\}>/.test(doa) &&
    /transform: \[\{ scale: lebar \/ width \}\]/.test(
      baca('components/common/CardPreview.tsx')));
c('tidak menulis apa pun ke Firestore', !/saveDoc|setDoc|updateDoc|firestore/i.test(doa));

console.log('\n=== 2c. Doa kepanjangan diberitahu, bukan dipotong diam-diam ===');
// layoutText memotong sisa baris begitu ukuran huruf terkecil pun tak cukup.
// Layarnya membandingkan doa yang SUDAH di-trim (doa = prayer.trim()); di sini
// disamakan, kalau tidak spasi di ujung sendiri sudah terhitung "hilang" dan
// tiap doa dituduh kepanjangan.
const rapi = (s) => s.trim().replace(/\s+/g, ' ');
const muatKah = (s) => teks.layoutStory(s).lines.join(' ').length >= rapi(s).length;
c('doa pendek: muat utuh', muatKah('Tuhan, tenangkan hatiku hari ini.'));
c('doa sedang: masih muat utuh',
  muatKah('Tuhan, terima kasih untuk hari ini. Ajar aku berhenti sebentar, ' +
    'dan percaya bahwa yang Kau kerjakan jauh lebih baik dari rencanaku.'));
// Muat maksimal ±21 baris × 56 huruf pada ukuran terkecil; ini jauh di atasnya.
const kepanjangan = 'Tuhan Yesus, terima kasih untuk hari ini. '.repeat(50).trim();
c('doa kelewat panjang: KETAHUAN terpotong',
  kepanjangan.length > 1500 && !muatKah(kepanjangan));
c('layar memang memeriksanya, bukan cuma percaya',
  /layoutStory\(doa\)\.lines\.join\(' '\)\.length/.test(doa));
c('dan memberitahu, bukan diam', /terpotong &&/.test(doa) && /kepanjangan/.test(baca('app/pause-pray.tsx')));
c('pemotongnya sendiri tidak pernah membelah kata',
  teks.wrapLines('Tuhan tenangkan hatiku', 10).every((b) => !/^[a-z]/.test(b) || b.length <= 10));

console.log('\n=== 2d. Tombolnya ada & halamannya terdaftar ===');
const spiritual = kode('app/(tabs)/walk.tsx');
c('tombol ⏸️ di pojok kanan header Spiritual', /emoji="⏸️"/.test(spiritual));
c('menuju halaman Pause & Pray', /push\('\/pause-pray'\)/.test(spiritual));
c('tab Revive tetap 3 tombol (tombol ke-4 memecah judul jadi 2 baris)',
  /tab === 'revive' \? \([\s\S]{0,900}?emoji="📖"[\s\S]{0,600}?emoji="🙏"[\s\S]{0,400}?RewardButton category="login"/.test(spiritual));
// 6 Sep: ⏸️ dipindahkan supaya HANYA muncul di sub-tab Bible Reading — di
// sub-tab lain ia cuma tombol yang kebetulan lewat.
c('⏸️ hanya di sub-tab Bible Reading',
  (spiritual.match(/emoji="⏸️"/g) || []).length === 1 &&
    /\) : tab === 'bible' \? \(/.test(spiritual));
c('🔥 Bible Reading tidak hilang saat ⏸️ dipindahkan',
  /tab === 'bible' \? \([\s\S]{0,600}BIBLE_CATEGORY/.test(spiritual));
c('sub-tab yang tidak berpencapaian pojoknya kosong, bukan tombol nyasar',
  /\) : undefined/.test(spiritual));
c('rutenya terdaftar di Stack', /name="pause-pray"/.test(kode('app/_layout.tsx')));
c('rutenya ikut warna Spiritual, bukan warna merek',
  /'pause-pray': 'spiritual'/.test(kode('lib/featureTheme.ts')));
c('rute bertipe sudah diregenerasi', baca('.expo/types/router.d.ts').includes('/pause-pray'));

console.log(ok ? '\nSEMUA LULUS' : '\nADA YANG GAGAL');
process.exit(ok ? 0 : 1);