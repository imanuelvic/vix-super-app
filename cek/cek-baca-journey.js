// 📖 Bible Journey (2 Okt 2026) — layar baca Alkitab jadi PERJALANAN lima
// langkah, dan warnanya ikut SESI (pagi/siang/malam), bukan ikut fitur.
//
// Kenapa ini perlu suite sendiri, padahal "cuma tampilan": dua dari tiga hal
// yang paling gampang rusak di sini TIDAK KELIHATAN sampai terlambat.
//
//   1. Warna. Latar pagi dulu nyaris sewarna kartu putih di atasnya
//      (#F7F3EC vs #FFFFFF), dan di layar itu kartunya seperti menghilang.
//      tsc & lint tidak peduli warna, dan mata sendiri gampang tertipu di
//      ruangan terang. Di sini rasio kontrasnya DIHITUNG, bukan ditaksir.
//   2. Streak. Acuan bacaan kini disimpan di langkah 📖 Read supaya tidak
//      hilang kalau perjalanannya ditinggal, sedangkan streak 🔥 hanya naik
//      di langkah penutup. Kalau suatu saat `bumpBibleStreaks` ikut terseret
//      ke langkah Read, angkanya naik hanya karena layarnya dibuka, dan itu
//      tidak akan ketahuan dari layar mana pun.
//
// Yang ketiga: Morning Journey 🌅 memakai potongan kartu yang SAMA. Begitu
// potongan itu dilepas supaya bisa dipakai berdua, ia jadi bisa ikut berubah
// tanpa sengaja — jadi di bawah ini warna bawaannya ikut dikunci.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ts = require(AKAR + '/node_modules/typescript');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? `  → ${extra}` : ''));
};

// ---------- Menjalankan modul TS tanpa Firestore ----------
// Modulnya dijalankan sungguhan (bukan dibaca regex), tapi impor yang menyeret
// Firebase diganti boneka. `lib/journey.ts` dibonekakan karena ia menarik
// lib/core.ts; namanya sendiri tetap diuji lewat impornya di bawah.
const NAMA_BONEKA = '«NAMA»';
function jalankan(berkas, stub = {}) {
  const js = ts.transpileModule(baca(berkas), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (nama) => {
    if (nama in stub) return stub[nama];
    throw new Error(`impor tak terduga: ${nama}`);
  };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
}

const DAYPART_MOD = jalankan('lib/daypart.ts');
const WARNA = jalankan('assets/style/color.ts');
const BJ = jalankan('lib/bibleJourney.ts', {
  './daypart': DAYPART_MOD,
  './journey': { JOURNEY_NAME: NAMA_BONEKA },
  './spiritual': {},
});

const layar = baca('app/bible-reading.tsx');
const kerangka = baca('components/spiritual/BibleJourney.tsx');
const langkah = baca('components/spiritual/journey/BibleSteps.tsx');
const kartu = baca('components/spiritual/journey/JourneyCard.tsx');
const jejak = baca('components/spiritual/journey/JourneyTrail.tsx');
const spiritual = baca('lib/spiritual.ts');
const SESI = ['morning', 'daytime', 'night'];

// =====================================================================
console.log('\n=== 1. Lima langkah, satu pada satu waktu ===');
// =====================================================================

c('urutannya Open → Read → Receive → Verse → Close',
  BJ.BIBLE_STEP_KEYS.join(',') === 'open,read,receive,verse,close',
  BJ.BIBLE_STEP_KEYS.join(','));
c('tiap langkah punya emoji, nama Inggris, & judul Indonesia',
  BJ.bibleJourneySteps('morning').every(
    (s) => s.emoji && /^[A-Z][a-z]+$/.test(s.label) && s.title.length > 8));
c('nama langkahnya: Open · Read · Receive · Verse · Close',
  BJ.bibleJourneySteps('morning').map((s) => s.label).join(' · ') ===
    'Open · Read · Receive · Verse · Close');

// Rantai "lanjut"-nya dijalankan, bukan dibaca: mulai dari Open, berjalan
// sampai Close, lalu berhenti. Kalau satu langkah tak tersambung, perjalanannya
// buntu di tengah dan itu TIDAK akan ketahuan dari tsc.
{
  const jalan = [];
  let k = 'open';
  for (let i = 0; i < 10 && k; i++) {
    jalan.push(k);
    k = BJ.nextBibleStep(k);
  }
  c('tiap langkah menyambung sampai penutup, lalu berhenti',
    jalan.join(',') === 'open,read,receive,verse,close' &&
      BJ.nextBibleStep('close') === null,
    jalan.join(','));
}

// Lambang langkah pertama IKUT SESINYA — itulah yang membuat jejak di atas
// kartu sudah memberi tahu "ini sesi yang mana" sebelum satu kata pun dibaca.
c('lambang langkah Open ikut sesinya (🌅 / 🌤️ / 🌙), dari lib/daypart',
  SESI.every((s) => BJ.bibleStepMeta('open', s).emoji === DAYPART_MOD.DAYPART[s]),
  SESI.map((s) => BJ.bibleStepMeta('open', s).emoji).join(' '));
c('keempat langkah lainnya sama di ketiga sesi (yang beda waktunya)',
  SESI.every((s) =>
    BJ.bibleJourneySteps(s).slice(1).map((x) => x.emoji).join('') ===
      BJ.bibleJourneySteps('morning').slice(1).map((x) => x.emoji).join('')));

// =====================================================================
console.log('\n=== 2. Kata-katanya: mengundang, bukan menagih ===');
// =====================================================================

c('sapaan & undangan & penutup lengkap untuk KETIGA sesi',
  SESI.every((s) =>
    BJ.BIBLE_GREETING[s] && BJ.BIBLE_INVITATION[s] && BJ.BIBLE_CLOSING[s]));
c('sapaannya memakai nama pemilik app, bukan nama yang diketik ulang',
  SESI.every((s) => BJ.BIBLE_GREETING[s].includes(NAMA_BONEKA)) &&
    /import \{ JOURNEY_NAME \} from '\.\/journey';/.test(baca('lib/bibleJourney.ts')));
c('ketiga undangannya memang BEDA (pagi, siang, malam bukan keadaan yang sama)',
  new Set(SESI.map((s) => BJ.BIBLE_INVITATION[s])).size === 3);
// Inilah pokok perubahannya: bukan "selesaikan", tapi "jalani".
{
  const semuaKata = SESI.flatMap((s) => [
    BJ.BIBLE_GREETING[s], BJ.BIBLE_INVITATION[s], BJ.BIBLE_CLOSING[s],
  ]).join(' ') + BJ.BIBLE_SHARE_QUESTION;
  c('tidak ada bahasa daftar tugas (selesai/lengkap/centang/persen)',
    !/selesaikan|lengkapi|centang|tercentang|\d+%|\d+ dari \d+/i.test(semuaKata));
  c('tidak ada angka langkah ("3 dari 5") di jejak maupun kartunya',
    !/\d+\s*\/\s*\d+|%/.test(
      (jejak + langkah).replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, '')));
}

// =====================================================================
console.log('\n=== 3. Warna sesi: latar bukan ungu, & kartunya kelihatan ===');
// =====================================================================

// Rasio kontras WCAG — dihitung, bukan ditaksir.
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) =>
  rgb(h)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const rasio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PUTIH = '#FFFFFF';

const shade = WARNA.DAYPART_SHADE;
c('paletnya punya ketiga sesi', SESI.every((s) => !!shade[s]));

for (const s of SESI) {
  const t = shade[s];
  // Kartu journey-nya PUTIH di ketiga sesi, jadi latarnya wajib cukup berbeda
  // dari putih — kalau tidak, kartunya hilang dan layarnya terbaca kosong.
  // 1,25 itu ambang yang tepat menolak gading #F7F3EC (1,10) yang dulu dipakai
  // sebagai kertas gambar Story dan TIDAK cocok jadi latar layar.
  c(`${s}: kartu putih masih terbaca di atas latarnya`,
    rasio(t.paper, PUTIH) >= 1.25, rasio(t.paper, PUTIH).toFixed(2));
  c(`${s}: tulisan pokok terbaca di atas latarnya (≥ 4,5)`,
    rasio(t.ink, t.paper) >= 4.5, rasio(t.ink, t.paper).toFixed(2));
  c(`${s}: keterangan kecil terbaca di atas latarnya (≥ 4,5)`,
    rasio(t.muted, t.paper) >= 4.5, rasio(t.muted, t.paper).toFixed(2));
  // `accent` dipakai DI ATAS kartu putih (nama langkah, tautan) DAN sebagai
  // latar tombol utama yang tulisannya putih. Jadi ia harus lolos dua arah.
  c(`${s}: nama langkah & tautan terbaca di atas kartu putih (≥ 4,5)`,
    rasio(t.accent, PUTIH) >= 4.5, rasio(t.accent, PUTIH).toFixed(2));
  c(`${s}: tulisan putih terbaca di atas tombol utamanya (≥ 4,5)`,
    rasio(PUTIH, t.accent) >= 4.5, rasio(PUTIH, t.accent).toFixed(2));
  // Kotak di dalam kartu putih: harus kelihatan sebagai kotak, dan isinya
  // (TEXT_TITLE) harus terbaca di atasnya.
  c(`${s}: kotak di dalam kartu masih terbeda dari kartu putihnya`,
    rasio(t.soft, PUTIH) >= 1.12, rasio(t.soft, PUTIH).toFixed(2));
  c(`${s}: isi kotaknya terbaca (≥ 4,5)`,
    rasio(WARNA.Color.TEXT_TITLE, t.soft) >= 4.5,
    rasio(WARNA.Color.TEXT_TITLE, t.soft).toFixed(2));
}

// Malam HARUS paling gelap: layar ini dibuka jam 21.00–24.00.
c('malam latarnya paling gelap dari ketiganya',
  lum(shade.night.paper) < lum(shade.daytime.paper) &&
    lum(shade.night.paper) < lum(shade.morning.paper));
c('malam satu-satunya yang tulisannya terang di atas latar',
  lum(shade.night.ink) > lum(shade.night.paper) &&
    lum(shade.morning.ink) < lum(shade.morning.paper) &&
    lum(shade.daytime.ink) < lum(shade.daytime.paper));
// Ketiganya harus benar-benar berbeda, bukan tiga nama untuk satu warna.
c('ketiga latarnya memang tiga warna berbeda',
  new Set(SESI.map((s) => shade[s].paper)).size === 3);

// Permintaan aslinya: latarnya BUKAN ungu lagi.
c('layar baca tidak memakai satu pun warna Spiritual (ungu)',
  !/Color\.SPIRITUAL/.test(kerangka + langkah),
  (kerangka + langkah).match(/Color\.SPIRITUAL\w*/g)?.join(', '));
c('latarnya benar-benar dari palet sesi, bukan hex yang diketik di layar',
  /backgroundColor: shade\.paper/.test(kerangka) &&
    /DAYPART_SHADE\[session\]/.test(kerangka) &&
    !/#[0-9A-Fa-f]{6}/.test(kerangka + langkah));

// =====================================================================
console.log('\n=== 4. Morning Journey 🌅 tidak ikut berubah ===');
// =====================================================================

// Potongan kartunya kini dipakai berdua. Yang menjaga Morning Journey tetap
// ungu: nada BAWAANNYA, dipakai kalau tak ada provider sama sekali.
c('nada bawaan potongan kartu tetap ungu Spiritual',
  /export const SPIRITUAL_TONE: JourneyTone = \{\s*accent: Color\.SPIRITUAL_DARK,\s*soft: Color\.SPIRITUAL,/
    .test(kartu.replace(/\s+/g, ' ')
      .replace(/export const SPIRITUAL_TONE: JourneyTone = \{ /, 'export const SPIRITUAL_TONE: JourneyTone = {\n  ')
      .replace(/accent: Color\.SPIRITUAL_DARK, /, 'accent: Color.SPIRITUAL_DARK,\n  ')) ||
    /SPIRITUAL_TONE[\s\S]{0,120}accent: Color\.SPIRITUAL_DARK,[\s\S]{0,40}soft: Color\.SPIRITUAL,/.test(kartu));
c('nada bawaannya memang yang dipakai kalau tak ada provider',
  /createContext<JourneyTone>\(SPIRITUAL_TONE\)/.test(kartu));
c('Morning Journey TIDAK memasang nada lain (jadi tetap ungu)',
  !/JourneyToneProvider/.test(baca('components/spiritual/MorningJourney.tsx')));
c('latar Morning Journey tetap SPIRITUAL_DARK',
  /safe: \{ flex: 1, backgroundColor: Color\.SPIRITUAL_DARK \}/
    .test(baca('components/spiritual/MorningJourney.tsx')));
c('Bible Journey justru memasang nadanya sendiri',
  /<JourneyToneProvider tone=\{tone\}>/.test(kerangka));

// Jejak langkahnya juga dipakai berdua sekarang.
c('jejak langkah dipakai berdua: daftarnya dioper, bukan disalin',
  /steps=\{JOURNEY_STEPS\}/.test(baca('components/spiritual/MorningJourney.tsx')) &&
    /steps=\{steps\}/.test(kerangka) &&
    !fs.existsSync(path.join(R, 'components/spiritual/journey/BibleTrail.tsx')));
// Titik langkah aktifnya putih di latar ungu tua; di latar pagi & siang yang
// terang, titik putih tidak kelihatan sama sekali.
c('warna titik langkah aktif ikut sesinya di Bible Journey',
  /dotColor = Color\.TEXT_REVERSE/.test(jejak) && /dotColor=\{shade\.ink\}/.test(kerangka));

// =====================================================================
console.log('\n=== 5. Tersimpan di dokumen yang SUDAH ADA, bukan koleksi baru ===');
// =====================================================================

c('tidak ada jalur Firestore baru — tetap users/{uid}/bibleRead/{hari}',
  (spiritual.match(/'users', uid, 'bibleRead', dayId/g) || []).length >= 3 &&
    !/'bibleJourney'|'bibleNote'/.test(spiritual));
c('isian Receive & Verse jadi field datar per sesi',
  /isi\[`\$\{session\}Note`\] = fields\.note\.trim\(\);/.test(spiritual) &&
    /isi\[`\$\{session\}Verse`\] = fields\.verse\.trim\(\);/.test(spiritual) &&
    /isi\[`\$\{session\}VerseText`\] = fields\.verseText\.trim\(\);/.test(spiritual));
// `merge: true` itu pokoknya: tanpa itu, menulis catatan akan MENGHAPUS acuan
// bacaan & terjemahan di hari yang sama.
c('menulisnya merge, jadi acuan & terjemahan sesi lain tak tersentuh',
  /export function saveBibleJourney\(/.test(spiritual) &&
    /setDoc\(doc\(db, 'users', uid, 'bibleRead', dayId\), isi, \{ merge: true \}\);/
      .test(spiritual));
// Dokumen bisa LAHIR dari catatan (ditulis sebelum "Sudah baca"), jadi `date`
// wajib ikut — tanpa itu hari itu tak pernah muncul di kueri riwayat.
c('`date` ikut ditulis, jadi hari yang lahir dari catatan tetap terurut',
  /const isi: Record<string, unknown> = \{\s*date: Timestamp\.fromDate\(dayIdToDate\(dayId\)\),\s*\};/
    .test(spiritual.replace(/\s+/g, ' ')));
c('catatan lama tanpa field ini tetap terbaca (kosong, bukan undefined)',
  /const ambil = \(k: string\) => \(\(data\?\.\[k\] as string\) \|\| ''\)\.trim\(\);/
    .test(spiritual));
c('langganan harian ikut mengantar catatannya',
  /notes: BibleReadingNotes,/.test(spiritual) &&
    /readNotes\(snapshot\.data\(\)\)/.test(spiritual) &&
    /subscribeBibleReadingToday\(uid, dayId, \(sessions, versi, catatan\) =>/.test(layar));

// Hapus di app ini SELALU permanen, dan permanen berarti tanpa ekor.
c('hapus bacaan ikut mengosongkan catatannya (tak ada tulisan yatim)',
  /\[`\$\{session\}Note`\]: '',\s*\[`\$\{session\}Verse`\]: '',\s*\[`\$\{session\}VerseText`\]: '',/
    .test(spiritual.replace(/\s+/g, ' ')));
c('tidak ada soft-delete yang diselundupkan',
  !/isDeleted|archived: true/.test(spiritual + layar + kerangka + langkah));

// =====================================================================
console.log('\n=== 6. Achievement: streak hanya naik di langkah penutup ===');
// =====================================================================

{
  const read = layar.slice(
    layar.indexOf('async function handleSaveRead'),
    layar.indexOf('async function handleSaveJourney'));
  const done = layar.slice(layar.indexOf('async function handleDone'));
  c('langkah Read menyimpan acuannya (biar tak hilang kalau ditinggal)',
    /await saveBibleReading\(user\.uid, dayId, session, passage, version\)/
      .test(read.replace(/\s+/g, ' ')));
  c('langkah Read TIDAK menaikkan streak', !/bumpBibleStreaks/.test(read));
  c('catatan Receive/Verse juga tidak menaikkan streak',
    !/bumpBibleStreaks/.test(
      layar.slice(layar.indexOf('async function handleSaveJourney'),
        layar.indexOf('async function handleDone'))));
  c('"✅ Sudah baca" yang menaikkan streak, lalu membawa ke arsipnya',
    /await bumpBibleStreaks\(/.test(done) &&
      /bibleDayComplete\(today, session\)/.test(done) &&
      /router\.replace\(\{ pathname: '\/walk', params: \{ tab: 'bible', session \} \}\)/
        .test(done.replace(/\s+/g, ' ')));
  c('angkanya kelihatan selama perjalanan, bukan cuma lambang 🔥',
    /streak=\{bibleStreakNow\(streaks, session, dayId\)\}/.test(layar) &&
      /🔥 \{streak\}/.test(kerangka));
}

// =====================================================================
console.log('\n=== 7. Bagikan ke Instagram: OPSIONAL betulan ===');
// =====================================================================

// Pokoknya: menjawab "tidak" tidak boleh mengubah apa pun yang tersimpan.
c('membagikan cuma berpindah layar, tidak menulis apa pun',
  (() => {
    const share = layar.slice(layar.indexOf('function handleShare'),
      layar.indexOf('return (\n    <BibleJourney'));
    return /router\.push\(/.test(share) &&
      !/saveBible|bumpBible|setDoc|deleteDoc/.test(share);
  })());
c('tidak membagikan tetap bisa "✅ Sudah baca" (tombolnya berdiri sendiri)',
  /<JourneyNext label="✅ Sudah baca" onPress=\{onDone\} busy=\{busy\} disabled=\{!ready\} \/>/
    .test(langkah.replace(/\s+/g, ' ')));
// Dimatikan sampai dokumen hari ini terbaca: streak "lengkap" dihitung dari
// isi hari itu, dan menghitungnya dari data yang belum sampai akan menebak.
c('"✅ Sudah baca" menunggu datanya sampai dulu, bukan menebak',
  /ready=\{today !== null\}/.test(layar) && /ready=\{ready\}/.test(kerangka));
// Maju ke langkah berikutnya HANYA kalau tulisannya benar-benar tersimpan.
c('langkah Read tidak maju kalau simpannya gagal',
  /return save\(async \(\) => \{ await onSave\(filled\.join\(', '\), version\); onNext\(\); \}\);/
    .test(langkah.replace(/\s+/g, ' ')));
c('pertanyaannya soal hati, bukan tugas yang belum selesai',
  /Kalau hari ini cukup untukmu sendiri, itu juga baik\./.test(
    baca('lib/bibleJourney.ts')));
c('ayat & bunyinya dari langkah Verse ikut dioper, jadi tak diketik dua kali',
  /verse: notes\[session\]\.verse,/.test(layar) &&
    /verseText: notes\[session\]\.verseText,/.test(layar) &&
    /const \[verse, setVerse\] = useState\(bunyiAyat\);/.test(baca('app/bible-story.tsx')));

// =====================================================================
console.log('\n=== 8. Arsipnya ikut menyimpan ceritanya ===');
// =====================================================================

{
  const tab = baca('components/spiritual/BibleReadingTab.tsx');
  c('kartu riwayat menampilkan ayat & apa yang didapat',
    /💛 \{d\.notes\[session\]\.verse\}/.test(tab) &&
      /✨ \{d\.notes\[session\]\.note\}/.test(tab));
  c('hari yang belum punya catatan tidak digambar sebagai kotak kosong',
    /\{bibleNoteWritten\(d\.notes\[session\]\) && \(/.test(tab));
  c('aturan "ada isinya" ada di lib, bukan dihitung di tampilan',
    /export function bibleNoteWritten\(/.test(spiritual));
}

// =====================================================================
console.log('\n=== 9. Istilah & aturan repo ===');
// =====================================================================

const berkasBaru = [
  'lib/bibleJourney.ts',
  'components/spiritual/BibleJourney.tsx',
  'components/spiritual/journey/BibleSteps.tsx',
  'app/bible-reading.tsx',
];
for (const f of berkasBaru) {
  const s = baca(f);
  c(`${f}: tidak ada "tekan" (layar maupun komentar)`,
    !/\btekan\b|ditekan|menekan/i.test(s));
  c(`${f}: tidak ada "Klik" (yang dipakai "click")`, !/\bklik\b/i.test(s));
  // Tanda pisah panjang dilarang di TEKS yang tampil; komentar kode bebas.
  // Komentar JSX ({/* … */}) sering lebih dari satu baris, jadi blok komentar
  // dibuang sebagai blok — bukan per baris, yang akan menyisakan baris
  // lanjutannya dan menuduh komentar sebagai tulisan di layar.
  const teks = s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  c(`${f}: tak ada tanda pisah panjang di tulisan yang tampil`,
    !/—/.test(teks), (teks.match(/.{0,30}—.{0,30}/) || [])[0]);
}

// Modul murni: bisa dijalankan tanpa Firestore sama sekali (sudah terbukti di
// atas, modul ini memang dijalankan dengan boneka).
c('lib/bibleJourney.ts tidak mengimpor Firestore',
  !/firebase|firestore/i.test(baca('lib/bibleJourney.ts')));
c('tidak ada modul native baru',
  !/expo-|react-native-/.test(
    [kerangka, langkah, baca('lib/bibleJourney.ts')]
      .join('\n')
      .split('\n')
      .filter((b) => /^import /.test(b))
      .join('\n')
      .replace(/from 'react-native';/g, '')
      .replace(/from 'react-native-safe-area-context';/g, '')));

console.log(ok ? '\n✅ LULUS — Bible Journey.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
