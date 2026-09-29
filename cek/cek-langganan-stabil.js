// Tiga permintaan (29 Sep 2026):
//   1. Chip 🚪 Berangkat & 🏠 Sampai rumah di Catat Meteran DITUKAR
//   2. BUG: centang Night Prayer tidak pernah menempel
//   3. Puasa terkunci jadi TAMPILAN BACA + tenggangnya 3 → 2 hari
//
// Berkas ini juga jadi penjaga tetap untuk sebab bug nomor 2, karena sebabnya
// tidak kelihatan di layar mana pun dan pasti terulang kalau tidak dijaga:
//
//   `useLive` / `useLiveAll` menaruh `onError` di dependency efeknya. Kalau
//   layar mengirim panah yang lahir tiap render, efeknya dipasang ULANG tiap
//   render; `liveDoc` lalu langsung memutar ulang snapshot terakhir yang ia
//   pegang, dan nilai optimistis yang baru saja ditulis layar (centang!)
//   tertimpa nilai lama. Aturannya sudah lama tertulis di hooks/useLive.ts —
//   yang belum ada cuma penegaknya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ts = require(AKAR + '/node_modules/typescript');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Kode saja — komentar yang MENYEBUT sebuah pola jangan terbaca sebagai pemakaian. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const semuaTsx = ['app', 'components'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx$/.test(e.name) ? [d + '/' + e.name] : []);
});

// =====================================================================
console.log('=== 1. Chip Catat Meteran ditukar ===');
// =====================================================================
{
  const lib = kode('lib/token.ts');
  const daftar = /READING_KINDS[\s\S]*?\n\];/.exec(lib)?.[0] ?? '';
  ok('🚪 Berangkat sekarang di DEPAN 🏠 Sampai rumah',
    daftar.indexOf("key: 'out'") > -1 &&
    daftar.indexOf("key: 'out'") < daftar.indexOf("key: 'home'"));
  ok('keduanya utuh: tulisan, lambang, & keterangannya tidak ikut berubah',
    /\{ key: 'out', label: 'Berangkat', icon: '🚪', hint: 'Pagi, sebelum pergi' \}/.test(daftar) &&
    /\{ key: 'home', label: 'Sampai rumah', icon: '🏠', hint: 'Sore\/malam, baru sampai' \}/.test(daftar));
  ok('cuma dua jenis, tidak ada yang tercecer saat ditukar',
    (daftar.match(/key: '/g) ?? []).length === 2);
  // Ini yang paling mudah rusak diam-diam: jatuh-baliknya dulu
  // `READING_KINDS[0]`, jadi menukar urutan ikut menukar arti catatan lama
  // yang jenisnya tak dikenali.
  ok('jatuh-balik jenis asing disebut DENGAN NAMA, bukan lewat nomor urut',
    !/\?\?\s*READING_KINDS\[0\]/.test(lib) &&
    /k\.key === 'home'/.test(lib));
  // Dijalankan sungguhan — bukan sekadar dibaca dari kodenya.
  const T = (() => {
    const js = ts.transpileModule(baca('lib/token.ts'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const mod = { exports: {} };
    new Function('exports', 'module', 'require', js)(mod.exports, mod, () => ({}));
    return mod.exports;
  })();
  ok('dijalankan: chip pertama = Berangkat', T.READING_KINDS[0].key === 'out');
  ok('dijalankan: jenis asing tetap jatuh ke 🏠 Sampai rumah, bukan ke chip pertama',
    T.readingKindMeta('entah-apa').key === 'home', T.readingKindMeta('entah-apa').key);
  ok('dijalankan: jenis yang dikenal tetap benar',
    T.readingKindMeta('out').label === 'Berangkat' &&
    T.readingKindMeta('home').label === 'Sampai rumah');
  // Tebakan chip terpilih TIDAK boleh ikut urutan daftar — ia bergantian dari
  // catatan terakhir, dan itu yang membuat menukar urutan aman.
  ok('chip terpilih tetap ditebak bergantian dari catatan terakhir',
    /terakhir\?\.kind === 'home' \? 'out' : 'home'/.test(
      kode('components/residence/TokenTab.tsx')));
}

// =====================================================================
console.log('\n=== 2. BUG centang Night Prayer: langganan yang stabil ===');
// =====================================================================
{
  const layar = kode('app/night-prayer.tsx');
  ok('onError-nya fungsi stabil (setError), bukan panah yang lahir tiap render',
    /onError: setError/.test(layar) && !/onError: \(\) =>/.test(layar));
  // `todayId` dipakai di dalam langganannya, jadi ia WAJIB disebut di deps —
  // kalau tidak, lewat tengah malam layarnya masih mendengarkan dokumen
  // kemarin. Ini layar yang justru dipakai menjelang tengah malam.
  ok('todayId disebut di deps (lewat tengah malam pindah ke dokumen hari baru)',
    /deps: \[todayId\]/.test(layar));
  ok('centang optimistisnya tetap ada (tampilan dulu, snapshot mengoreksi)',
    /setDay\(\(lama\) => \(\{/.test(layar) && /nightDoneId\(key\)\]: jadi/.test(layar));
  ok('gagal menulis tetap mengembalikan centangnya',
    /setDay\(sebelum\);/.test(layar));

  // ---- Aturan yang sama untuk SELURUH app ----
  // Inilah penegak yang selama ini tidak ada. Sekali lagi ada layar yang
  // mengirim panah, bug yang sama kembali — dan gejalanya (centang tidak
  // menempel) tidak akan menunjuk ke sini sama sekali.
  const nakal = semuaTsx.filter((f) =>
    /useLive(All)?\([\s\S]{0,600}?onError:\s*(\(|async)/.test(kode(f)),
  );
  ok('tidak ada layar lain yang mengirim onError berupa panah ke useLive/useLiveAll',
    nakal.length === 0, nakal.join(', '));
  // Dan aturannya memang masih tertulis di hooknya, bukan cuma di sini.
  ok('aturannya tercatat di hooks/useLive.ts (stabil, bukan panah tiap render)',
    /STABIL/.test(baca('hooks/useLive.ts')));
  ok('onError memang dependency efeknya (sebab bugnya, dijaga apa adanya)',
    /\[user, subscribe, onError\]/.test(baca('hooks/useLive.ts')) &&
    /\[user, when, onError, \.\.\.deps\]/.test(baca('hooks/useLiveAll.ts')));
  // Dan sebab keduanya: liveDoc memutar ulang snapshot terakhir tiap ada
  // pelanggan baru. Itu fitur (layar kedua tidak perlu baca ulang), bukan bug
  // — tapi ia yang mengubah "berlangganan ulang" jadi "tampilan mundur".
  ok('liveDoc memang memutar ulang snapshot terakhir tiap pelanggan baru',
    /if \(e\.live && e\.last\) \{[\s\S]{0,200}onChange\(e\.last\);/.test(baca('lib/liveDoc.ts')));
}

// =====================================================================
console.log('\n=== 3. Puasa terkunci = tampilan baca ===');
// =====================================================================
{
  const layar = kode('app/fasting.tsx');
  const lib = baca('lib/fasting.ts');
  const cabang = (() => {
    const i = layar.indexOf('{terkunci ? (');
    const j = layar.indexOf(') : (', i);
    return i > -1 && j > i ? layar.slice(i, j) : '';
  })();

  ok('tenggangnya 2 hari, bukan 3', /export const FASTING_GRACE_DAYS = 2;/.test(lib));
  ok('ada cabang khusus saat terkunci', cabang !== '');
  ok('tidak ada satu pun kotak isian saat terkunci',
    !/<FormInput/.test(cabang) && !/<DateField/.test(cabang));
  ok('memakai blok baca BERSAMA, sama dengan Catatan Khotbah',
    /<ReadBlock/.test(cabang) &&
    /from '@\/components\/common\/ReadBlock'/.test(baca('app/fasting.tsx')) &&
    /from '@\/components\/common\/ReadBlock'/.test(baca('app/sermon.tsx')));
  ok('blok bacanya satu berkas untuk keduanya, bukan disalin',
    fs.existsSync(path.join(ROOT, 'components/common/ReadBlock.tsx')) &&
    !/function ReadBlock/.test(kode('app/sermon.tsx')) &&
    !/function ReadBlock/.test(layar));
  ok('semua isinya tetap terbaca (tidak ada yang hilang saat dikunci)',
    ['Nama puasa', 'Pokok doa utama', 'Peraturan puasa saya', 'Mulai puasa',
      'Selesai puasa', 'Jawaban Doa'].every((s) => cabang.includes(s)));
  ok('tanggalnya diformat jadi tanggal yang terbaca',
    /formatShortDayDate\(startDate\)/.test(cabang) &&
    /formatShortDayDate\(endDate\)/.test(cabang));
  ok('kartu "Jawaban Doa" tidak digambar kalau memang kosong',
    /\{plan && answer\.trim\(\) \?/.test(cabang));
  // Sisi sebaliknya: yang masih bisa diubah TIDAK boleh ikut kehilangan kolom.
  ok('yang masih bisa diubah tetap punya keenam kolomnya',
    (layar.match(/<FormInput/g) ?? []).length === 4 &&
    (layar.match(/<DateField/g) ?? []).length === 2);
  ok('kolom isian yang tersisa tidak lagi perlu menyebut terkunci',
    !/editable=\{!busy && !terkunci\}/.test(layar) &&
    !/disabled=\{terkunci\}/.test(layar));
  // Yang TIDAK boleh berubah: kuncinya tetap ditegakkan di sumbernya, dan
  // menghapus tetap boleh.
  ok('menyimpan tetap ditolak di sumbernya, bukan cuma kotaknya yang hilang',
    /if \(!user \|\| busy \|\| terkunci\) return;/.test(layar));
  ok('tombol hapus tetap ada walau terkunci', /<InlineDelete/.test(layar));
  ok('keterangan kuncinya ikut menyebut angka yang sama (bukan 3 yang diketik)',
    /\{FASTING_GRACE_DAYS\} hari/.test(baca('app/fasting.tsx')));
}

// =====================================================================
console.log('\n=== 4. Aturan tetap proyek ===');
// =====================================================================
{
  const jalur = [
    'app/night-prayer.tsx', 'app/fasting.tsx',
    'components/common/ReadBlock.tsx', 'lib/token.ts',
  ];
  const berkas = jalur.map(baca);
  ok('tidak ada warna hex mentah', !berkas.some((s) => /#[0-9A-Fa-f]{6}/.test(s)));
  // Istilah "click" berlaku di teks layar MAUPUN komentar, jadi yang diperiksa
  // berkas utuh.
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|tekan|ditekan|menekan)\b/.test(s)));
  // Tanda pisah panjang cuma dilarang di TEKS YANG TAMPIL, jadi komentar
  // dikupas dulu — kalau tidak, penjelasan yang memakainya ikut tertuduh.
  const emDash = [];
  for (const s of jalur.map(kode)) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  ok('tanpa modul native baru (cukup eas update)',
    !berkas.some((s) => /from 'react-native-(?!reanimated|gesture-handler|safe-area-context|svg|webview)/.test(s)));
}

console.log('\n' + (gagal === 0
  ? '✅ LULUS — chip ditukar, centang menempel, puasa terkunci jadi bacaan.'
  : `❌ ${gagal} cek gagal.`));
process.exit(gagal === 0 ? 0 : 1);
