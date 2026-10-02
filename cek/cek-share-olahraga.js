// 💬 Bagikan sesi olahraga ke grup keluarga (2 Okt 2026) — kartu persegi
// berisi sapaan jamnya, apa yang barusan dijalani, dan satu kalimat
// penyemangat, lalu dikirim lewat WhatsApp.
//
// Kenapa ini perlu penjaga sendiri, padahal "cuma kartu":
//
//   1. Gambarnya & teksnya adalah DUA jalan keluar untuk satu pagi yang sama.
//      Kalau keduanya berpisah, yang membaca di grup keluarga melihat dua
//      versi dari kejadian yang sama, dan itu tidak akan ketahuan dari layar
//      mana pun selain grupnya sendiri.
//   2. Jam di kartu & jam di layar wajib sama persis. Sempat ada DUA salinan
//      pemformatnya (stopwatch di layarnya & `clockOf` di modul kartunya),
//      dan dua pemformat yang harus sama adalah jenis hal yang paling pelan
//      melencengnya. 2 Okt 2026 keduanya dilebur jadi `formatClock` di
//      lib/format.ts; yang dijaga sekarang: salinannya tidak lahir lagi.
//   3. Kalimat penyemangatnya dibaca KELUARGA, bukan diri sendiri. Satu
//      kalimat yang menggurui atau menyebut berat badan sudah cukup untuk
//      membuat kiriman yang niatnya mengajak jadi terasa memamerkan.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? `  → ${extra}` : ''));
};

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

const WARNA = jalankan('assets/style/color.ts');
const DAYPART = jalankan('lib/daypart.ts');
const FORMAT = jalankan('lib/format.ts');
const SHARE = jalankan('lib/shareImage.ts', {
  'expo-file-system': {},
  'expo-linking': {},
  'expo-media-library': {},
  'expo-sharing': {},
  '../assets/style/color': WARNA,
  './format': FORMAT,
});
const FIT = jalankan('lib/fitness.ts', {
  'firebase/firestore': {},
  './reward': {},
  './core': {},
  './daypart': DAYPART,
  './firebase': {},
  './format': FORMAT,
  './habits': {},
  './health': {},
  './liveDoc': {},
  './streak': {},
});
// `pickOfDay` dibonekakan jadi "selalu yang pertama" supaya yang diuji di sini
// adalah PUTARANNYA — bagian yang memang ditambahkan modul ini. Undian per
// harinya sendiri sudah punya penjaganya di tempat lain.
const WS = jalankan('lib/workoutShare.ts', {
  './core': { pickOfDay: (list) => list[0] },
  './daypart': DAYPART,
  './fitness': FIT,
  './format': FORMAT,
  './shareImage': SHARE,
});

const modul = baca('lib/workoutShare.ts');
const kartu = baca('components/fitness/WorkoutShareCard.tsx');
const layar = baca('app/workout-share.tsx');
const rekam = baca('components/fitness/RecordTab.tsx');

// =====================================================================
console.log('\n=== 1. Satu pagi, satu cerita: kartu & teksnya sama ===');
// =====================================================================

const sesi = {
  kind: 'run',
  seconds: 1861,
  km: 4.15,
  place: 'Kedaung Kali Angke',
  dateLabel: 'Jumat, 2 Oktober 2026',
  greeting: DAYPART.greetingOfHour(7),
  cheer: WS.WORKOUT_CHEERS[0],
};
const teks = WS.workoutCaption(sesi);

// Jaraknya ditampilkan satu angka di belakang koma, lewat `formatDecimal` yang
// SAMA dengan rekap lari di sub-tab Progress. Yang tersimpan tetap utuh (4,15)
// dan pace dihitung dari angka utuh itu; yang dibulatkan cuma tampilannya.
// Memberi kartu ini ketelitian sendiri berarti satu lari yang sama terbaca
// sebagai dua angka berbeda di dua layar.
c('judulnya sama di kartu & di teks',
  teks.includes(WS.workoutHeadline('run', 4.15)) &&
    WS.workoutHeadline('run', 4.15) === 'Lari 4,2 km',
  WS.workoutHeadline('run', 4.15));
c('angkanya sama di kartu & di teks',
  teks.includes(WS.workoutStats(1861, 4.15)) &&
    WS.workoutStats(1861, 4.15) === '31:01 · 7:28 /km',
  WS.workoutStats(1861, 4.15));
c('sapaan, lokasi, kalimat penyemangat, & salamnya ikut semua',
  teks.includes('Selamat pagi 🌅') &&
    teks.includes('📍 Kedaung Kali Angke') &&
    teks.includes(WS.WORKOUT_CHEERS[0]) &&
    teks.includes(WS.WORKOUT_SALAM));
// Kartunya menggambar dari fungsi yang SAMA, bukan merangkai sendiri — itulah
// yang membuat keduanya mustahil berpisah.
c('kartunya memakai fungsi yang sama, bukan merangkai sendiri',
  /workoutHeadline\(share\.kind, share\.km\)/.test(kartu) &&
    /workoutStats\(share\.seconds, share\.km\)/.test(kartu) &&
    /\{WORKOUT_SALAM\}/.test(kartu) &&
    !/Salam sehat/.test(kartu.replace(/WORKOUT_SALAM/g, '')));
c('layar berbaginya memakai kalimat yang sama untuk gambar & teks',
  /const caption = workoutCaption\(share\);/.test(layar) &&
    /shareTextToWhatsApp\(caption,/.test(layar));

// Tanpa angka yang dicatat, kartunya tidak mengarang.
c('tanpa jarak, judulnya cuma namanya (bukan "Lari 0 km")',
  WS.workoutHeadline('run', 0) === 'Lari' &&
    WS.workoutHeadline('strength', 0) === 'Angkat Beban');
c('tanpa jarak, pace tidak dikarang',
  WS.workoutStats(1800, 0) === '30:00', WS.workoutStats(1800, 0));
c('tanpa lokasi, barisnya tidak digambar sebagai baris kosong',
  !WS.workoutCaption({ ...sesi, place: '   ' }).includes('📍') &&
    /\{tempat \? \(/.test(kartu));

// =====================================================================
console.log('\n=== 2. Satu pemformat jam, dipakai kartu & layar ===');
// =====================================================================

{
  // Sampai 2 Okt 2026 ada dua salinan dan cek ini membandingkan keluarannya.
  // Sekarang keduanya memanggil `formatClock` yang sama, jadi yang diuji
  // berubah jadi hal yang lebih kuat: salinannya tidak boleh lahir lagi.
  c('modul kartu tidak punya pemformat jamnya sendiri',
    !/function clockOf|padStart\(2, '0'\)/.test(modul));
  c('hook stopwatch juga tidak',
    !/function formatStopwatch|padStart\(2, '0'\)/.test(baca('hooks/useStopwatch.ts')));
  c('keduanya memakai formatClock dari lib/format',
    /import \{ formatClock, formatDecimal \} from '\.\/format';/.test(modul) &&
      /formatClock\(seconds\)/.test(modul) &&
      /export function formatClock\(seconds: number\): string \{/.test(baca('lib/format.ts')));
  // Angkanya tetap diuji di tiap batas: yang dilebur pemformatnya, bukan
  // kewajibannya untuk benar.
  c('jam baru muncul kalau memang lewat sejam',
    FORMAT.formatClock(3599) === '59:59' && FORMAT.formatClock(3600) === '1:00:00',
    `${FORMAT.formatClock(3599)} | ${FORMAT.formatClock(3600)}`);
  c('detik minus tidak pernah tergambar', FORMAT.formatClock(-9) === '00:00');
  c('yang tergambar di kartu memang keluaran pemformat itu',
    WS.workoutStats(3661, 0) === FORMAT.formatClock(3661),
    `${WS.workoutStats(3661, 0)} vs ${FORMAT.formatClock(3661)}`);
}

// =====================================================================
console.log('\n=== 3. Sapaannya dari aturan bersama, bukan salinan ===');
// =====================================================================

c('sapaannya dari lib/daypart, bukan batas jam yang ditulis ulang',
  /import \{ greetingOfHour, type Greeting \} from '\.\/daypart';/.test(modul) &&
    !/h < 11|h < 15|h < 19/.test(modul));
c('pagi 🌅 · siang 🌤️ · sore 🌇 · malam 🌙',
  WS.workoutGreeting(new Date(2026, 9, 2, 7)).emoji === DAYPART.DAYPART.morning &&
    WS.workoutGreeting(new Date(2026, 9, 2, 13)).emoji === DAYPART.DAYPART.daytime &&
    WS.workoutGreeting(new Date(2026, 9, 2, 17)).emoji === '🌇' &&
    WS.workoutGreeting(new Date(2026, 9, 2, 21)).emoji === DAYPART.DAYPART.night);
// Yang membaca di grup membacanya SEKARANG, jadi sapaannya ikut jam sekarang.
c('sapaannya ikut jam sekarang, bukan jam sesinya',
  /greeting: workoutGreeting\(now\),/.test(layar));

// =====================================================================
console.log('\n=== 4. Kalimat penyemangat: berputar & layak dibaca keluarga ===');
// =====================================================================

c('kalimatnya diundi per hari, bukan acak tiap gambar ulang',
  /pickOfDay\(WORKOUT_CHEERS, dayId, 'cheer'\)/.test(modul));
{
  const n = WS.WORKOUT_CHEERS.length;
  c('cukup banyak untuk tidak cepat terasa berulang', n >= 12, String(n));
  c('putaran 0 = kalimat hari itu', WS.workoutCheer('2026-10-02', 0) === WS.WORKOUT_CHEERS[0]);
  c('putaran maju satu per satu',
    WS.workoutCheer('2026-10-02', 1) === WS.WORKOUT_CHEERS[1] &&
      WS.workoutCheer('2026-10-02', 2) === WS.WORKOUT_CHEERS[2]);
  // Yang gampang terlewat: putaran yang melewati ujung daftar, dan putaran
  // mundur. Keduanya harus tetap memberi kalimat, bukan undefined.
  c('putaran melewati ujung daftar kembali ke awal',
    WS.workoutCheer('2026-10-02', n) === WS.WORKOUT_CHEERS[0] &&
      WS.workoutCheer('2026-10-02', n + 3) === WS.WORKOUT_CHEERS[3]);
  c('putaran mundur tetap memberi kalimat, bukan undefined',
    WS.workoutCheer('2026-10-02', -1) === WS.WORKOUT_CHEERS[n - 1] &&
      typeof WS.workoutCheer('2026-10-02', -99) === 'string');
  c('tidak ada kalimat yang kembar', new Set(WS.WORKOUT_CHEERS).size === n);
  c('semuanya muat di kartu tanpa dipotong',
    WS.WORKOUT_CHEERS.every((t) => WS.layoutCheer(t).lines.join(' ').length >= t.length - 2),
    WS.WORKOUT_CHEERS.filter(
      (t) => WS.layoutCheer(t).lines.join(' ').length < t.length - 2,
    ).join(' | '));
}
// Ini dibaca keluarga. Nadanya mengajak, bukan menggurui atau memamerkan.
{
  const semua = WS.WORKOUT_CHEERS.join(' ').toLowerCase();
  const terlarang = ['harus ', 'wajib', 'gemuk', 'kurus', 'malas', 'gendut', 'diet'];
  const kena = terlarang.filter((k) => semua.includes(k));
  c('tidak ada yang menggurui atau menyinggung badan', kena.length === 0, kena.join(', '));
  c('tidak ada tanda pisah panjang di kalimatnya',
    !WS.WORKOUT_CHEERS.some((t) => t.includes('—')));
}

// =====================================================================
console.log('\n=== 5. Bentuk & jalan keluarnya ===');
// =====================================================================

// WhatsApp menampilkan gambar sebagai pratinjau kecil di gelembung pesan;
// gambar tinggi terpotong di situ. Persegi tampil utuh.
c('kanvasnya PERSEGI (pratinjau WhatsApp tidak memotongnya)',
  WS.WORKOUT_W === 1080 && WS.WORKOUT_H === 1080);
// Ukurannya sama persis dengan kartu Reminder 🕊️ yang juga dibuat untuk chat,
// jadi dua gambar dari app ini tidak tampil beda besar di grup yang sama.
c('ukurannya sama dengan kartu Reminder yang juga untuk WhatsApp',
  /export const REMINDER_W = 1080;/.test(baca('lib/reminderImage.ts')) &&
    /export const REMINDER_H = 1080;/.test(baca('lib/reminderImage.ts')) &&
    WS.WORKOUT_W === 1080 && WS.WORKOUT_H === 1080);
// 2 Okt 2026: pemilih rupanya jadi <ShareStylePicker/> bersama, dipakai
// keempat layar kartu — jadi "rupa yang SAMA dengan kartu lain" sekarang
// bukan lagi soal daftar yang kebetulan sama, tapi komponen yang memang satu.
c('tiga rupa yang sama dipakai kartu lain (Morning/Midday/Night)',
  /<ShareStylePicker value=\{design\.key\} onChange=\{setPickedKey\} \/>/.test(layar) &&
    /SHARE_DESIGNS\.map/.test(baca('components/common/ShareStylePicker.tsx')) &&
    SHARE.SHARE_DESIGNS.length === 3);
c('gambarnya dibagikan lewat lembar berbagi, bukan ditaruh ke galeri dulu',
  /sharePng\(png, nama, 'Bagikan ke grup keluarga'\)/.test(layar));
c('ada juga jalan kirim teksnya saja, lewat WhatsApp',
  /shareTextToWhatsApp/.test(layar) && /WHATSAPP_ERROR/.test(layar));
c('menyimpan ke Foto tetap pilihan terpisah', /savePngToPhotos\(png, nama\)/.test(layar));
// Yang TIDAK bisa dijanjikan: WhatsApp tidak punya tautan "kirim ke grup X".
c('jujur soal grupnya dipilih sendiri di lembar berbagi',
  /subtitle="Pilih grup keluarga di lembar berbagi"/.test(layar));
c('layar berbaginya tidak menyentuh Firestore sama sekali', (() => {
  const impor = (layar.match(/^import .*$/gm) || []).join('\n');
  return !/firebase|firestore|liveDoc|subscribe|useAuth/i.test(impor);
})());
c('sesinya dioper lewat parameter, bukan dibaca ulang',
  /useLocalSearchParams<\{/.test(layar) && /kind\?: string;/.test(layar));

// =====================================================================
console.log('\n=== 6. Pintunya di Record ===');
// =====================================================================

c('tiap sesi yang direkam punya tombol bagikannya',
  /pathname: '\/workout-share',/.test(rekam) &&
    /💬 Bagikan ke grup/.test(rekam));
c('yang dioper sesi ITU, bukan sesi yang kebetulan terakhir',
  /kind: l\.kind,\s*seconds: String\(l\.seconds\),\s*km: String\(l\.km\),\s*place: l\.place,\s*dayId,/
    .test(rekam.replace(/\s+/g, ' ')
      .replace(/kind: l\.kind, /, 'kind: l.kind,\n                          ')
      .replace(/\s+/g, ' ')));
c('rutenya dapat warna Fitness', /'workout-share': 'fitness',/.test(baca('lib/featureTheme.ts')));
c('membagikan TIDAK mengubah apa pun yang tersimpan',
  !/saveBible|appendFitLog|removeFitLog|setDoc|deleteDoc/.test(layar));

// =====================================================================
console.log('\n=== 7. Aturan repo ===');
// =====================================================================

for (const f of [
  'lib/workoutShare.ts',
  'components/fitness/WorkoutShareCard.tsx',
  'app/workout-share.tsx',
]) {
  const s = baca(f);
  c(`${f}: tidak ada "tekan"`, !/\btekan\b|ditekan|menekan/i.test(s));
  c(`${f}: tidak ada "Klik" (yang dipakai "click")`, !/\bklik\b/i.test(s));
  const t = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  c(`${f}: tak ada tanda pisah panjang di tulisan yang tampil`,
    !/—/.test(t), (t.match(/.{0,30}—.{0,30}/) || [])[0]);
}
c('tidak ada modul native baru (gambarnya tetap SVG yang sudah terpasang)',
  /react-native-svg/.test(kartu) &&
    !/expo-image-manipulator|expo-camera|expo-image-picker/.test(
      [modul, kartu, layar].join('\n')));

console.log(ok ? '\n✅ LULUS — bagikan sesi olahraga.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
