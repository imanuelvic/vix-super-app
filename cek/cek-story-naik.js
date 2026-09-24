// Satu permintaan (7 Sep 2026): tombol "Bagikan ayatnya ke Instagram Story"
// naik ke ATAS tombol "Sudah baca".
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

console.log('=== Story naik ke atas "Sudah baca" ===');

// Urutannya diperiksa dari POSISI sungguhan di berkasnya, bukan dari
// keberadaan masing-masing potongan.
const story = layar.indexOf('📖 Bagikan ayatnya ke Instagram Story');
const simpan = layar.indexOf('label="✅ Sudah baca"');
const lewati = layar.indexOf('label="⏭️ Lewati baca hari ini"');
c('tombol Story berdiri di atas "Sudah baca"',
  story > 0 && simpan > 0 && story < simpan,
  `story@${story} simpan@${simpan}`);
c('urutan tumpukannya: Story → Sudah baca → Lewati',
  story < simpan && simpan < lewati);

// Garis pemisahnya dulu menandai "yang di bawah ini bonus". Di ATAS tombol
// utama tak ada lagi batas yang perlu ditandai.
c('garis pemisahnya ikut dibuang, bukan ditinggal menganggur',
  !/storyDivider/.test(layar));
c('jaraknya pindah ke barisnya sendiri, sama dengan tombol di bawahnya',
  /storyRow: \{[\s\S]{0,200}marginBottom: 10,/.test(layar) &&
    /save: \{ marginBottom: 10 \}/.test(layar));

// Syaratnya tidak ikut berubah: tanpa acuan tak ada yang bisa dipajang, dan
// Story tetap bisa dibuat sebelum bacaannya dicatat.
c('masih muncul hanya setelah ada acuan yang terisi',
  /\{filled\.length > 0 && \(\s*\n\s*<PressableScale\s*\n\s*style=\{styles\.storyRow\}/.test(
    layar,
  ));
c('acuan & terjemahannya tetap dioper apa adanya ke layar rancangan',
  /pathname: '\/bible-story'/.test(layar) &&
    /refs: filled\.join\(', '\),/.test(layar) &&
    /version: versiTerpakai,/.test(layar));

// Istilah: "click", bukan "tekan" — berlaku di layar maupun komentar kode.
c('tak ada lagi kata "tekan" di berkas ini', !/tekan/i.test(layar));

console.log(
  ok ? '\n✅ LULUS — Story naik, garis pemisah dibuang.' : '\n❌ ADA YANG GAGAL',
);
process.exit(ok ? 0 : 1);
