// Satu permintaan (7 Sep 2026): tombol "Bagikan ayatnya ke Instagram Story"
// naik ke ATAS tombol "Sudah baca".
//
// 2 Okt 2026: layar Baca Alkitab jadi Bible Journey (lima langkah). Urutannya
// TETAP dijaga, cuma tempatnya berpindah: keduanya kini di kartu langkah
// 🕊️ Close, dan "Lewati" turun ke kaki layar milik kerangka perjalanannya.
// Jadi yang diperiksa sekarang dua berkas, bukan satu — tapi aturannya sama:
// membagikannya ditawarkan SELAGI ayatnya masih di layar, bukan sesudah
// layarnya selesai dipakai.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const layar = baca('app/bible-reading.tsx');
const langkah = baca('components/spiritual/journey/BibleSteps.tsx');
const kerangka = baca('components/spiritual/BibleJourney.tsx');

console.log('=== Story naik ke atas "Sudah baca" ===');

// Urutannya diperiksa dari POSISI sungguhan di berkasnya, bukan dari
// keberadaan masing-masing potongan.
const story = langkah.indexOf('📸 Bagikan ayatnya ke Instagram Story');
const simpan = langkah.indexOf('label="✅ Sudah baca"');
c('tombol Story berdiri di atas "Sudah baca"',
  story > 0 && simpan > 0 && story < simpan,
  `story@${story} simpan@${simpan}`);

// "Lewati" ada di kaki layar, yang digambar SESUDAH kartu langkahnya — jadi
// urutan Story → Sudah baca → Lewati tetap utuh walau lintas berkas.
const kartu = kerangka.indexOf('<JourneyToneProvider');
const kaki = kerangka.indexOf('{canSkip && (');
c('urutan tumpukannya: Story → Sudah baca → Lewati',
  story < simpan && kartu > 0 && kaki > kartu,
  `kartu@${kartu} kaki@${kaki}`);
c('"Lewati" memang di kaki layar, bukan di dalam kartu langkahnya',
  /Lewati untuk hari ini/.test(kerangka) && !/Lewati/.test(langkah));

// Garis pemisahnya dulu menandai "yang di bawah ini bonus". Di ATAS tombol
// utama tak ada lagi batas yang perlu ditandai.
c('garis pemisahnya ikut dibuang, bukan ditinggal menganggur',
  !/storyDivider/.test(layar + langkah + kerangka));
// Jaraknya tidak lagi diatur per tombol: ketiganya isi SATU kartu, dan jarak
// antar-isinya satu angka milik kartu itu (`gap` di JourneyCard).
c('jaraknya dari gap kartunya, bukan angka lepas per tombol',
  /card: \{[\s\S]*?gap: 14,/.test(
    baca('components/spiritual/journey/JourneyCard.tsx')) &&
    !/marginBottom: \d+/.test(langkah));

// Syaratnya tidak ikut berubah: tanpa acuan tak ada yang bisa dipajang, dan
// Story tetap bisa dibuat sebelum "Sudah baca" di-click.
c('masih muncul hanya setelah ada acuan yang terisi',
  /canShare=\{filled\.length > 0\}/.test(kerangka) &&
    /\{canShare \? \(\s*\n\s*<JourneyAction/.test(langkah));
c('acuan & terjemahannya tetap dioper apa adanya ke layar rancangan',
  /pathname: '\/bible-story'/.test(layar) &&
    /refs: passage,/.test(layar) &&
    /version,/.test(layar));
// 2 Okt 2026: ayat yang ditulis di langkah 💛 Verse ikut dioper, jadi layar
// Story tidak lagi memulai dari kosong. Yang dikosongkan tetap boleh diketik
// di sana, sama seperti dulu.
c('ayat & bunyinya dari langkah Verse ikut dioper',
  /verse: notes\[session\]\.verse,/.test(layar) &&
    /verseText: notes\[session\]\.verseText,/.test(layar));

// Istilah: "click", bukan "tekan" — berlaku di layar maupun komentar kode.
c('tak ada lagi kata "tekan" di berkas ini',
  !/tekan/i.test(layar + langkah + kerangka));

console.log(
  ok ? '\n✅ LULUS — Story naik, garis pemisah dibuang.' : '\n❌ ADA YANG GAGAL',
);
process.exit(ok ? 0 : 1);
