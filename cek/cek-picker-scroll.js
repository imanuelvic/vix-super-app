// 11 Sep 2026 — "semua modal yang berisi datepicker: begitu datepicker-nya
// di-click, otomatis scroll ke bawah sedikit supaya langsung ke arah roda
// tanggal native iOS-nya."
//
// Sebabnya: di iOS spinner tanggal lahir INLINE tepat di bawah kolomnya. Kalau
// kolom itu di bagian bawah form, rodanya lahir DI LUAR layar — yang di-click
// membuka sesuatu yang tidak kelihatan.
//
// Yang dijaga suite ini:
//   1. Aturan menggulungnya benar — DIJALANKAN dari sumbernya, termasuk
//      bagian yang paling gampang salah: "kalau sudah kelihatan, JANGAN
//      digeser". Menggulung sia-sia terasa seperti layar bergerak sendiri.
//   2. Ke-32 pemakai <DateField> tidak perlu disentuh satu pun — kalau sampai
//      perlu, itu 32 kesempatan untuk lupa.
const AKAR = require('./akar');
const fs = require('fs');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const psv = baca('components/common/PickerScrollView.tsx');
const sheet = baca('components/common/SheetModal.tsx');
const dateField = baca('components/common/DateField.tsx');
const timeField = baca('components/common/TimeField.tsx');

// =====================================================================
console.log('=== 1. Aturan menggulungnya, dijalankan dari sumbernya ===');
// =====================================================================
{
  const m = psv.match(
    /const kurang =\s*\n?\s*(.+?);\s*\n\s*if \(kurang <= 0\) return;/,
  );
  c('rumus "berapa yang belum kelihatan" terbaca dari sumbernya', !!m, m?.[1]);

  const jarak = psv.match(/const JARAK = (\d+);/);
  c('jarak sisa di bawah picker dipatok', !!jarak, jarak?.[1]);

  if (m && jarak) {
    // Dijalankan: offsetY + tinggiLayar = batas bawah yang terlihat sekarang.
    const hitung = new Function(
      'y', 'tinggi', 'offsetY', 'tinggiLayar', 'JARAK',
      `return ${m[1].replace(/offsetY\.current/g, 'offsetY')
        .replace(/tinggiLayar\.current/g, 'tinggiLayar')};`,
    );
    const J = Number(jarak[1]);

    // Layar setinggi 400, belum digulung sama sekali.
    // Picker di y=100 setinggi 216 → bawahnya 316 + jarak; masih muat.
    c('picker yang sudah terlihat utuh → tidak digeser',
      hitung(100, 216, 0, 400, J) <= 0);

    // Picker di y=300 → bawahnya 516; yang terlihat cuma sampai 400.
    // Kurangnya 516 + 12 − 400 = 128.
    c('picker yang menggantung di bawah layar → digeser SECUKUPNYA',
      hitung(300, 216, 0, 400, J) === 128, hitung(300, 216, 0, 400, J));

    // Sudah tergulung 100: yang terlihat [100, 500] → picker 300..516 kurang 28.
    c('gulungan yang sudah berjalan ikut diperhitungkan',
      hitung(300, 216, 100, 400, J) === 28, hitung(300, 216, 100, 400, J));

    // Picker jauh di atas layar (sudah tergulung lewat) → nilainya negatif,
    // jadi tidak ada yang menggulung MUNDUR. Yang diminta "scroll ke bawah".
    c('picker di atas layar tidak menarik gulungan mundur',
      hitung(50, 216, 600, 400, J) <= 0);

    // Picker lebih tinggi dari layarnya (iPad / teks besar): yang dikejar
    // bawahnya, jadi bagian atasnya boleh terpotong — bukan sebaliknya.
    c('picker lebih tinggi dari layar tetap menampakkan bagian bawahnya',
      hitung(0, 600, 0, 400, J) === 212);
  }

  // Penjaga yang gampang hilang saat kode dirapikan: tanpa `if (kurang <= 0)`
  // tiap membuka picker akan menggeser layar walau tidak perlu.
  c('ada penjaga "sudah kelihatan → jangan digeser"',
    /if \(kurang <= 0\) return;/.test(psv));
  c('menggulungnya beranimasi, bukan melompat',
    /scrollTo\(\{ y: offsetY\.current \+ kurang, animated: true \}\)/.test(psv));
}

// =====================================================================
console.log('\n=== 2. Diukur dengan cara yang tahan bersarang ===');
// =====================================================================
{
  // INI yang menentukan benar/salahnya di 32 pemakai: <DateField> hampir
  // selalu bersarang beberapa View di dalam form, jadi `layout.y` dari
  // onLayout (relatif ke induk TERDEKAT) akan meleset. measureLayout ke View
  // dalam ScrollView memberi koordinat isi yang sebenarnya.
  c('diukur relatif ke View DALAM ScrollView (innerViewRef)',
    /innerViewRef=\{innerRef as RefObject<View>\}/.test(psv) &&
      /picker\.measureLayout\(\s*\n?\s*inner,/.test(psv));
  c('posisi gulungan diikuti lewat onScroll',
    /offsetY\.current = e\.nativeEvent\.contentOffset\.y;/.test(psv) &&
      /scrollEventThrottle=\{16\}/.test(psv));
  c('tinggi layar diambil dari onLayout wadahnya',
    /tinggiLayar\.current = e\.nativeEvent\.layout\.height;/.test(psv));
  // Wadah yang dioper onScroll/onLayout dari luar tidak boleh kehilangan
  // miliknya sendiri — keduanya dirantai, bukan ditimpa.
  c('onScroll & onLayout milik pemakainya tetap dipanggil',
    /onScroll\?\.\(e\);/.test(psv) && /onLayout\?\.\(e\);/.test(psv));
  // Belum terukur → diam saja; onLayout picker-nya akan memanggil lagi.
  c('belum terukur → diam, bukan menggulung ke angka ngawur',
    /if \(!picker \|\| !inner \|\| tinggiLayar\.current === 0\) return;/.test(psv));
}

// =====================================================================
console.log('\n=== 3. Terpasang sekali, berlaku di semua modal ===');
// =====================================================================
{
  c('SheetModal memakai PickerScrollView, bukan ScrollView biasa',
    /<PickerScrollView/.test(sheet) && !/<ScrollView/.test(sheet));
  c('impor ScrollView yang tak terpakai ikut dibuang',
    !/^\s+ScrollView,$/m.test(sheet));

  // Kedua kolom melapor dengan cara yang SAMA — kalau salah satunya lupa,
  // separuh modal di app ini diam-diam tidak ikut.
  for (const [nama, isi] of [
    ['DateField', dateField],
    ['TimeField', timeField],
  ]) {
    c(`${nama} melapor begitu picker-nya tergambar`,
      /const reveal = usePickerReveal\(\);/.test(isi) &&
        /const pickerRef = useRef<View>\(null\);/.test(isi) &&
        /<View ref=\{pickerRef\} onLayout=\{\(\) => reveal\?\.\(pickerRef\.current\)\}>/.test(isi));
  }

  // Di luar wadah yang bisa digulung, reveal null → tidak terjadi apa-apa.
  // Tanpa `?.` layar non-modal yang memakai DateField akan langsung crash.
  c('di luar wadah gulung, tidak terjadi apa-apa (bukan crash)',
    /export function usePickerReveal\(\): Reveal \| null/.test(psv) &&
      /reveal\?\./.test(dateField) &&
      /reveal\?\./.test(timeField));

  // Tidak ada satu pun pemakai <DateField>/<TimeField> yang perlu diubah.
  const berkas = [];
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('app');
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('components');

  // Kolomnya sendiri & wadahnya jelas TIDAK ikut dihitung — merekalah yang
  // memasang aturannya. (DateField & TimeField saling menyebut di komentar,
  // jadi tanpa daftar ini keduanya ikut tersapu.)
  const PEMBUAT = [
    'components/common/DateField.tsx',
    'components/common/TimeField.tsx',
    'components/common/PickerScrollView.tsx',
    'components/common/SheetModal.tsx',
  ];
  const pemakai = berkas.filter(
    (f) => /<(Date|Time)Field/.test(baca(f)) && !PEMBUAT.includes(f),
  );
  const nakal = pemakai.filter((f) => /usePickerReveal|PickerScrollView/.test(baca(f)));
  c('tak satu pun pemakai kolom tanggal/jam perlu ikut diubah',
    nakal.length === 0,
    nakal.length === 0 ? `${pemakai.length} pemakai, 0 disentuh` : nakal.join(', '));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
