// Langkah 🎵 Worship di Morning Journey (dulu "Memuji & Menyembah 🎶" di
// gerbang doa pagi; 21 Sep 2026 gerbangnya diganti journey tanpa centang).
//
// Yang tetap dijaga: bacaan penyembahannya diundi dari tanggal & dibekukan
// sekali seumur layar, muncul TIAP HARI tanpa syarat, letaknya tetap SEBELUM
// Bapa Kami (penutup) dan sesudah bagian membaca/berefleksi; Syafaat & Doa
// Rantai tetap bersyarat; Bapa Kami tak tersentuh. Yang berubah karena
// konsepnya: tidak ada nomor langkah, tidak ada centang, dan worship boleh
// dilewati tanpa rasa gagal.

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-sembah');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

const layar = baca('components/spiritual/MorningJourney.tsx');
const steps = baca('components/spiritual/journey/JourneySteps.tsx');
const spirit = baca('lib/spiritual.ts');

// ================= 1. Urutan langkah (dari lib/journey.ts sungguhan) =================
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/journey.ts'), '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './core') return { pickOfDay: (list, dayId) => list[0] };
  if (req === './family') return { OWNER_NAME: 'Imanuel Victory Rumayar' };
  if (req === './linking') return { openExternalUrl: async () => undefined };
  return asli(req, parent, isMain);
};
const J = require(path.join(OUT, 'journey.js'));
Module._load = asli;

const urutan = J.JOURNEY_STEPS.map((s) => s.key);
ok('tujuh langkah, urutannya tetap: arrive → receive → reflect → respond → worship → pray → close',
  urutan.join(',') === 'arrive,receive,reflect,respond,worship,pray,close', urutan.join(','));
ok('Worship SESUDAH membaca & berefleksi, SEBELUM Pray, dan Close (Bapa Kami) selalu terakhir',
  urutan.indexOf('worship') > urutan.indexOf('respond') &&
  urutan.indexOf('worship') < urutan.indexOf('pray') &&
  urutan[urutan.length - 1] === 'close');
ok('nextJourneyStep mengalir maju & berhenti di close',
  J.nextJourneyStep('worship') === 'pray' && J.nextJourneyStep('pray') === 'close' && J.nextJourneyStep('close') === null);
ok('jejaknya 🌅 📖 💭 ❤️ 🎵 🙏 🌤️', J.JOURNEY_STEPS.map((s) => s.emoji).join('') === '🌅📖💭❤️🎵🙏🌤️');

// ================= 2. Letaknya di layar =================
ok('layar merender langkah worship di antara respond & pray (tanpa syarat hari)',
  /step === 'respond' \? \([\s\S]*?step === 'worship' \? \(\s*<WorshipStep song=\{song\} passage=\{passage\} onNext=\{next\} \/>\s*\) : step === 'pray'/.test(layar));
ok('tidak ada satu pun langkah yang dibungkus syarat hari (semua lewat step === …)',
  !/chainDue && <\w+Step/.test(layar) && !/showIntercession && <\w+Step/.test(layar));
// Bandingkan: Syafaat & Doa Rantai MEMANG bersyarat (di dalam langkah Pray).
ok('Syafaat & Doa Rantai tetap bersyarat di langkah Pray',
  /\{showIntercession && \(/.test(steps) && /\{chainDue && \(/.test(steps));
ok('hari giliran CL: Doa Rantai menggantikan Doa Syafaat, bukan menambah',
  /const showIntercession = !chainDue;/.test(layar));

// ================= 3. Sifatnya: pilihan, bukan kewajiban =================
ok('tidak ada CheckCircle sama sekali di journey', !/CheckCircle/.test(layar + steps));
ok('worship bisa dilewati lewat tautan tenang ("Skip untuk sekarang")',
  /<JourneyLink label="Skip untuk sekarang" onPress=\{onNext\} \/>/.test(steps));
ok('"Mulai Worship" membuka lagunya (YouTube) lalu melanjutkan',
  /function mulai\(\) \{\s*setError\(null\);\s*void openWorshipSong\(song, \(\) => setError\(WORSHIP_SONG_ERROR\)\);\s*onNext\(\);\s*\}/.test(steps) &&
  /<JourneyNext label="Mulai Worship" onPress=\{mulai\} \/>/.test(steps));
ok('tidak ada hitungan langkah / persen di layar ("N/7", "Selesaikan N langkah")',
  !/Selesaikan \{/.test(layar + steps) && !/\/7|\d+%/.test(layar + steps));

// ================= 4. Isi kartunya =================
ok('satu lagu per hari dari daftar kurasi (≥ 20 lagu), dibuka lewat pencarian YouTube',
  J.WORSHIP_SONGS.length >= 20 &&
  J.WORSHIP_SONGS.every((s) => s.title && s.artist) &&
  J.worshipSongUrl({ title: 'Kau Yang Terindah', artist: 'True Worshippers' }) ===
    'https://www.youtube.com/results?search_query=Kau%20Yang%20Terindah%20True%20Worshippers');
ok('bacaan penyembahan tetap tampil (teks + sumbernya)',
  /\{passage\.text\}/.test(steps) && /- \{passage\.ref\}/.test(steps));
ok('bacaannya diundi tiap hari & dibekukan sekali seumur layar (tidak bertukar tengah malam)',
  /const \[passage\] = useState\(\(\) => worshipPassageOfDay\(todayId\)\);/.test(layar) &&
  /const \[song\] = useState\(\(\) => worshipSongOfDay\(todayId\)\);/.test(layar));
ok('Mazmur 95:1–2 yang dulu tetap ada di daftar undiannya',
  /bersorak-sorai untuk TUHAN/.test(spirit) && /nyanyian syukur/.test(spirit));
ok('memakai kotak & warna yang sudah ada (JourneyBox ungu muda, sumber ayat SPIRITUAL_DARK)',
  /<JourneyBox>\s*<VixText heading="paragraph" additionalStyle=\{js\.boxText\}>\s*\{passage\.text\}/.test(steps) &&
  /boxRef: \{ color: Color\.SPIRITUAL_DARK/.test(baca('components/spiritual/journey/JourneyCard.tsx')));

// ================= 5. Yang TIDAK boleh berubah =================
ok('Doa Rantai tetap bertanda ✅ dari DATANYA (bukan centang tangan)',
  /\{l\.done \? '✅ ' : ''\}/.test(steps) && /✅ Sudah didoakan hari ini/.test(steps));
ok('jalan keluar (lewati pagi ini) tetap ada, kalimatnya tenang, dialognya tidak merah',
  /Lewati untuk hari ini/.test(layar) && /danger=\{false\}/.test(layar) &&
  !/hangus/.test(layar + steps));
ok('teks Bapa Kami tidak tersentuh (lib/journey.ts)',
  /Bapa kami yang di sorga,/.test(J.BAPA_KAMI) &&
  /Karena Engkaulah yang empunya Kerajaan dan kuasa dan kemuliaan sampai selama-lamanya\. Amin\./.test(J.BAPA_KAMI) &&
  /\{BAPA_KAMI\}/.test(steps));
ok('catatan jumlah bagian doa di lib/core.ts ikut dibetulkan',
  /langkah 🙏 Pray di Morning\s*\n\/\/ Journey selalu berisi SATU: Doa Rantai ATAU Doa Syafaat/.test(baca('lib/core.ts')));

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
